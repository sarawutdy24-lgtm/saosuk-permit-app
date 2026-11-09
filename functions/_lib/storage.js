// ที่เก็บไฟล์เอกสาร: ใช้ฐานข้อมูล D1 เดิมได้เลย (ไม่ต้องตั้งค่าเพิ่ม)
// ถ้าผูก R2 bucket (binding "DOCS") ไว้ ระบบจะใช้ R2 ให้อัตโนมัติ
const RAW_CHUNK = 150000; // ไบต์ต่อก้อน (base64 ≈ 200,000 ตัวอักษร — ต่ำกว่าขีดจำกัด 2MB/แถวของ D1)

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const UPLOADS_PER_HOUR = 100;

function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  return btoa(s);
}

export async function putFile(env, key, buf, meta) {
  if (env.DOCS) {
    await env.DOCS.put(key, buf, { httpMetadata: { contentType: meta.type }, customMetadata: { name: meta.name } });
    return;
  }
  const bytes = new Uint8Array(buf);
  const stmts = [
    env.DB.prepare(`INSERT INTO uploaded_files (key, name, type, size, ip) VALUES (?, ?, ?, ?, ?)`)
      .bind(key, meta.name, meta.type, bytes.length, meta.ip || ''),
  ];
  for (let i = 0, idx = 0; i < bytes.length; i += RAW_CHUNK, idx++) {
    stmts.push(env.DB.prepare(`INSERT INTO file_chunks (key, idx, data) VALUES (?, ?, ?)`)
      .bind(key, idx, toBase64(bytes.subarray(i, i + RAW_CHUNK))));
  }
  await env.DB.batch(stmts);
}

// ข้อมูลไฟล์ (ใช้ตรวจว่ามีไฟล์อยู่จริงก่อนผูกกับคำขอ)
export async function fileInfo(env, key) {
  const row = await env.DB.prepare(`SELECT name, type FROM uploaded_files WHERE key = ?`).bind(key).first();
  if (row) return { name: row.name, type: row.type };
  if (env.DOCS) {
    const head = await env.DOCS.head(key);
    if (head) return { name: head.customMetadata?.name || key, type: head.httpMetadata?.contentType || '' };
  }
  return null;
}

export async function getFile(env, key) {
  const row = await env.DB.prepare(`SELECT name, type FROM uploaded_files WHERE key = ?`).bind(key).first();
  if (row) {
    const { results } = await env.DB.prepare(`SELECT data FROM file_chunks WHERE key = ? ORDER BY idx ASC`).bind(key).all();
    const parts = results.map((r) => Uint8Array.from(atob(r.data), (c) => c.charCodeAt(0)));
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let off = 0;
    for (const p of parts) { out.set(p, off); off += p.length; }
    return { body: out, type: row.type, name: row.name };
  }
  if (env.DOCS) {
    const obj = await env.DOCS.get(key);
    if (obj) return { body: obj.body, type: obj.httpMetadata?.contentType || 'application/octet-stream', name: obj.customMetadata?.name || key };
  }
  return null;
}

// ลบไฟล์ที่อัปโหลดแล้วแต่ไม่ได้ผูกกับคำขอใด ๆ เกิน 2 วัน
export async function cleanupOrphans(env) {
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM uploaded_files
      WHERE created_at < datetime('now', '-2 day')
        AND NOT EXISTS (SELECT 1 FROM permit_applications p WHERE p.doc_files LIKE '%' || uploaded_files.key || '%')`),
    env.DB.prepare(`DELETE FROM file_chunks WHERE key NOT IN (SELECT key FROM uploaded_files)`),
  ]);
}

// แนบไฟล์เข้ากับรายการ (ตรวจสอบรูปแบบ key และการมีอยู่จริง)
export async function attachFiles(env, keys, keyRe, existing = []) {
  const out = [...existing];
  if (!Array.isArray(keys)) return out;
  for (const key of keys.slice(0, 5)) {
    if (!keyRe.test(String(key)) || out.some((f) => f.key === key)) continue;
    const info = await fileInfo(env, key);
    if (info) out.push({ key, name: info.name, type: info.type });
  }
  return out;
}

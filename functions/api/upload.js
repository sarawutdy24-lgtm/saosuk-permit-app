import { json, fail, cleanStr } from '../_lib/utils.js';
import { putFile, cleanupOrphans, MAX_FILE_BYTES, UPLOADS_PER_HOUR } from '../_lib/storage.js';

// อัปโหลดเอกสาร (สาธารณะ — ผู้ยื่นคำขอใช้) รองรับ JPG / PNG / PDF ไม่เกิน 5 MB
function sniff(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', type: 'image/png' };
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return { ext: 'pdf', type: 'application/pdf' };
  return null;
}

export async function onRequestGet() {
  return json({ success: true, enabled: true, maxMB: MAX_FILE_BYTES / 1048576 });
}

export async function onRequestPost({ request, env }) {
  try {
    if (Number(request.headers.get('content-length') || 0) > MAX_FILE_BYTES + 300_000) return fail('ไฟล์ใหญ่เกิน 5 MB', 413);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!env.DOCS) {
      const { n } = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM uploaded_files WHERE ip = ? AND created_at > datetime('now', '-1 hour')`
      ).bind(ip).first();
      if (n >= UPLOADS_PER_HOUR) return fail('อัปโหลดบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่', 429);
    }

    // รับได้ 2 แบบ: (1) ส่งไฟล์ตรง ๆ เป็น body + header X-File-Name (หน้าเว็บใช้แบบนี้)
    //               (2) ฟอร์ม multipart (ไว้ใช้กับเครื่องมืออื่น)
    let buf, rawName = '';
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('multipart/form-data')) {
      const file = (await request.formData()).get('file');
      if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') return fail('ไม่พบไฟล์');
      buf = await file.arrayBuffer();
      rawName = file.name || '';
    } else {
      buf = await request.arrayBuffer();
      try { rawName = decodeURIComponent(request.headers.get('X-File-Name') || ''); } catch { rawName = ''; }
    }
    if (!buf.byteLength) return fail('ไฟล์ว่างเปล่า');
    if (buf.byteLength > MAX_FILE_BYTES) return fail('ไฟล์ใหญ่เกิน 5 MB', 413);

    const kind = sniff(new Uint8Array(buf.slice(0, 8)));
    if (!kind) return fail('รองรับเฉพาะไฟล์ JPG, PNG หรือ PDF');

    const key = `${crypto.randomUUID()}.${kind.ext}`;
    const name = cleanStr(rawName, 80) || key;
    await putFile(env, key, buf, { name, type: kind.type, ip });

    // เก็บกวาดไฟล์ค้างเป็นครั้งคราว (ไม่กระทบผู้ใช้ถ้าพลาด)
    if (Math.random() < 0.05) { try { await cleanupOrphans(env); } catch {} }

    return json({ success: true, key, name, size: buf.byteLength, type: kind.type });
  } catch (err) {
    return fail('อัปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 500);
  }
}

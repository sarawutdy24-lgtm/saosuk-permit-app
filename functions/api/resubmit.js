import { json, fail, cleanStr, normPhone, normUrl, FILE_KEY_RE } from '../_lib/utils.js';
import { attachFiles } from '../_lib/storage.js';

// ผู้ยื่นส่งเอกสารแก้ไข/เพิ่มเติม เมื่อสถานะ "ต้องแก้ไขเอกสาร"
// ยืนยันตัวตนด้วย เลขที่คำขอ + เบอร์โทรศัพท์ที่ใช้ยื่น
export async function onRequestPost({ request, env }) {
  try {
    let b;
    try { b = await request.json(); } catch { return fail('รูปแบบข้อมูลไม่ถูกต้อง'); }

    const app_no = cleanStr(b.app_no, 30).toUpperCase();
    const phone = normPhone(b.phone);
    if (!app_no || !phone) return fail('กรุณากรอกเบอร์โทรศัพท์ที่ใช้ยื่นคำขอ');

    const doc_url = normUrl(b.doc_url);
    if (doc_url === null) return fail('ลิงก์เอกสารต้องขึ้นต้นด้วย http:// หรือ https://');
    const note = cleanStr(b.note, 400);

    const row = await env.DB.prepare(
      `SELECT id, status, doc_files FROM permit_applications
       WHERE app_no = ? AND REPLACE(REPLACE(phone, '-', ''), ' ', '') = ?`
    ).bind(app_no, phone).first();
    if (!row) return fail('ไม่พบคำขอ หรือเบอร์โทรศัพท์ไม่ตรงกับที่ใช้ยื่น', 404);
    if (row.status !== 'ACTION_REQUIRED') return fail('คำขอนี้ไม่ได้อยู่ในสถานะที่ต้องแก้ไขเอกสาร', 409);

    let files = [];
    try { files = JSON.parse(row.doc_files || '[]'); } catch {}
    files = await attachFiles(env, b.files, FILE_KEY_RE, files);
    files = files.slice(-10);

    if (!doc_url && !(Array.isArray(b.files) && b.files.length) && !note) {
      return fail('กรุณาแนบเอกสาร ลิงก์ หรือพิมพ์ข้อความถึงเจ้าหน้าที่อย่างน้อย 1 อย่าง');
    }

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE permit_applications
         SET status = 'PENDING', doc_url = COALESCE(?, doc_url), doc_files = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(doc_url || null, files.length ? JSON.stringify(files) : null, row.id),
      env.DB.prepare(
        `INSERT INTO status_history (application_id, status, remark, actor) VALUES (?, 'PENDING', ?, 'applicant')`
      ).bind(row.id, 'ผู้ยื่นส่งเอกสารเพิ่มเติม' + (note ? `: ${note}` : '')),
    ]);

    return json({ success: true });
  } catch (err) {
    return fail('เกิดข้อผิดพลาดในระบบ', 500);
  }
}

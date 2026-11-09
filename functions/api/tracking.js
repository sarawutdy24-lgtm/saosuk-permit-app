import { json, fail, cleanStr, maskName } from '../_lib/utils.js';

// ติดตามสถานะ (สาธารณะ) — ค้นหาแบบ "ตรงทั้งหมด" เท่านั้น ไม่ใช้ LIKE
// เพื่อไม่ให้ใครสุ่มเดา/ไล่ดูข้อมูลของคนอื่นได้ และปิดบังชื่อบางส่วน
export async function onRequestGet({ request, env }) {
  try {
    const q = cleanStr(new URL(request.url).searchParams.get('q'), 40);
    const digits = q.replace(/\D/g, '');

    let where, param;
    if (/^REQ-/i.test(q)) {
      where = 'app_no = ?'; param = q.toUpperCase();
    } else if (digits.length === 13) {
      where = 'id_card = ?'; param = digits;
    } else if (digits.length >= 9 && digits.length <= 10) {
      where = `REPLACE(REPLACE(phone, '-', ''), ' ', '') = ?`; param = digits;
    } else {
      return fail('กรุณากรอกเลขที่คำขอ (REQ-…) เบอร์โทรศัพท์ หรือเลขบัตรประชาชนให้ครบถ้วน');
    }

    const { results } = await env.DB.prepare(`
      SELECT id, app_no, app_type, applicant_name, business_name, business_type, status,
             officer_remark, created_at, updated_at, license_no, approved_at, expires_at
      FROM permit_applications WHERE ${where} ORDER BY id DESC LIMIT 10
    `).bind(param).all();

    let histByApp = {};
    if (results.length) {
      const ids = results.map((r) => r.id);
      const { results: hist } = await env.DB.prepare(
        `SELECT application_id, status, remark, actor, created_at FROM status_history
         WHERE application_id IN (${ids.map(() => '?').join(',')}) ORDER BY id ASC`
      ).bind(...ids).all();
      for (const h of hist) (histByApp[h.application_id] ||= []).push({ status: h.status, remark: h.remark, actor: h.actor, created_at: h.created_at });
    }

    const out = results.map(({ id, applicant_name, ...r }) => ({
      ...r,
      applicant_name: maskName(applicant_name),
      history: histByApp[id] || [],
    }));
    return json({ success: true, results: out });
  } catch (err) {
    return fail('เกิดข้อผิดพลาดในระบบ', 500);
  }
}

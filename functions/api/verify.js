import { json, fail, cleanStr, maskName, bkkToday } from '../_lib/utils.js';

// ตรวจสอบใบอนุญาต (สาธารณะ — ใช้กับ QR Code บนใบอนุญาต)
// เปิดเผยเฉพาะข้อมูลที่จำเป็น ไม่แสดงเลขบัตรประชาชน/เบอร์โทร
export async function onRequestGet({ request, env }) {
  try {
    const no = cleanStr(new URL(request.url).searchParams.get('no'), 40);
    if (!no) return fail('กรุณาระบุเลขที่ใบอนุญาต');

    const row = await env.DB.prepare(`
      SELECT license_no, applicant_name, business_name, business_type, location_address,
             app_type, approved_at, expires_at
      FROM permit_applications
      WHERE license_no = ? AND status = 'APPROVED'
      ORDER BY COALESCE(expires_at, '') DESC, id DESC LIMIT 1
    `).bind(no).first();

    if (!row) return json({ success: true, found: false });

    const valid = !row.expires_at || row.expires_at >= bkkToday();
    return json({
      success: true,
      found: true,
      valid,
      license: { ...row, applicant_name: maskName(row.applicant_name) },
    });
  } catch (err) {
    return fail('เกิดข้อผิดพลาดในระบบ', 500);
  }
}

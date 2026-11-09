import { json, fail, cleanStr, isIsoDate, STATUSES, LICENSE_PREFIX, bkkYearBE, bkkYearCE } from '../_lib/utils.js';

// เจ้าหน้าที่เปลี่ยนสถานะคำขอ (ต้องล็อกอิน — ตรวจใน _middleware.js)
// เมื่ออนุมัติ: ระบบออกเลขใบอนุญาตให้อัตโนมัติ (ต่ออายุ = ใช้เลขเดิม) และบันทึกวันหมดอายุ
export async function onRequestPost({ request, env }) {
  try {
    let body;
    try { body = await request.json(); } catch { return fail('รูปแบบข้อมูลไม่ถูกต้อง'); }

    const id = Number(body.id);
    const status = String(body.status || '');
    const remark = cleanStr(body.officer_remark, 600);
    if (!Number.isInteger(id) || id <= 0) return fail('รหัสคำขอไม่ถูกต้อง');
    if (!STATUSES.includes(status)) return fail('สถานะไม่ถูกต้อง');
    if ((status === 'REJECTED' || status === 'ACTION_REQUIRED') && !remark) {
      return fail('กรุณาระบุเหตุผล / สิ่งที่ต้องแก้ไข เพื่อแจ้งผู้ยื่น');
    }

    let expiresInput = null;
    if (status === 'APPROVED' && body.expires_at) {
      if (!isIsoDate(body.expires_at)) return fail('วันหมดอายุไม่ถูกต้อง');
      expiresInput = body.expires_at;
    }

    const exists = await env.DB.prepare(`SELECT id FROM permit_applications WHERE id = ?`).bind(id).first();
    if (!exists) return fail('ไม่พบคำขอนี้', 404);

    const defaultExpiry = `${bkkYearCE()}-12-31`;
    const prefix = `${LICENSE_PREFIX} ${bkkYearBE()}/`;

    const update = env.DB.prepare(`
      UPDATE permit_applications SET
        status = ?1,
        officer_remark = ?2,
        updated_at = CURRENT_TIMESTAMP,
        approved_at = CASE WHEN ?1 = 'APPROVED' THEN COALESCE(approved_at, CURRENT_TIMESTAMP) ELSE approved_at END,
        expires_at  = CASE WHEN ?1 = 'APPROVED' THEN COALESCE(?3, expires_at, ?4) ELSE expires_at END,
        license_no  = CASE WHEN ?1 = 'APPROVED' THEN COALESCE(license_no,
            CASE WHEN app_type = 'RENEW' AND old_license_no IS NOT NULL AND old_license_no <> ''
                 THEN old_license_no
                 ELSE ?5 || printf('%04d', COALESCE((
                        SELECT MAX(CAST(substr(license_no, instr(license_no, '/') + 1) AS INTEGER))
                        FROM permit_applications WHERE license_no LIKE ?5 || '%'), 0) + 1)
            END) ELSE license_no END
      WHERE id = ?6
    `).bind(status, remark || null, expiresInput, defaultExpiry, prefix, id);

    const history = env.DB.prepare(
      `INSERT INTO status_history (application_id, status, remark, actor) VALUES (?, ?, ?, 'officer')`
    ).bind(id, status, remark || null);

    await env.DB.batch([update, history]);

    const row = await env.DB.prepare(
      `SELECT license_no, approved_at, expires_at FROM permit_applications WHERE id = ?`
    ).bind(id).first();

    return json({ success: true, ...row });
  } catch (err) {
    return fail(err.message, 500);
  }
}

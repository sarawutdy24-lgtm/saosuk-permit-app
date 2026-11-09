import {
  json, fail, cleanStr, validThaiId, normPhone, normUrl, isEmail, bkkYearBE, FILE_KEY_RE,
} from '../_lib/utils.js';
import { attachFiles } from '../_lib/storage.js';

// ผู้ประกอบการยื่นคำขอ (สาธารณะ) — ตรวจข้อมูลฝั่งเซิร์ฟเวอร์ทุกช่อง
export async function onRequestPost({ request, env }) {
  try {
    let b;
    try { b = await request.json(); } catch { return fail('รูปแบบข้อมูลไม่ถูกต้อง'); }

    // honeypot: บอทมักกรอกช่องที่ซ่อนไว้
    if (b.website) return json({ success: true, app_no: 'REQ-0000-00000' });

    const app_type = b.app_type === 'RENEW' ? 'RENEW' : b.app_type === 'NEW' ? 'NEW' : null;
    if (!app_type) return fail('กรุณาเลือกประเภทคำขอ');

    const old_license_no = cleanStr(b.old_license_no, 40);
    if (app_type === 'RENEW' && !old_license_no) return fail('กรุณากรอกเลขที่ใบอนุญาตเดิม');

    const applicant_name = cleanStr(b.applicant_name, 100);
    if (applicant_name.length < 3) return fail('กรุณากรอกชื่อ-นามสกุลให้ครบถ้วน');

    const id_card = String(b.id_card ?? '').replace(/\D/g, '');
    if (!validThaiId(id_card)) return fail('เลขบัตรประชาชนไม่ถูกต้อง');

    const phone = normPhone(b.phone);
    if (!phone) return fail('เบอร์โทรศัพท์ไม่ถูกต้อง (ตัวอย่าง 0812345678)');

    const email = cleanStr(b.email, 120);
    if (email && !isEmail(email)) return fail('รูปแบบอีเมลไม่ถูกต้อง');

    const applicant_address = cleanStr(b.applicant_address, 300);
    if (applicant_address.length < 8) return fail('กรุณากรอกที่อยู่ผู้ขอ (ตามทะเบียนบ้าน)');

    const business_name = cleanStr(b.business_name, 120);
    if (!business_name) return fail('กรุณากรอกชื่อสถานประกอบการ');

    const business_type = cleanStr(b.business_type, 120);
    if (!business_type) return fail('กรุณาเลือกประเภทกิจการ');

    const location_address = cleanStr(b.location_address, 300);
    if (location_address.length < 8) return fail('กรุณากรอกที่ตั้งสถานประกอบการให้ชัดเจน');

    const doc_url = normUrl(b.doc_url);
    if (doc_url === null) return fail('ลิงก์เอกสารต้องขึ้นต้นด้วย http:// หรือ https://');

    // ไฟล์ที่อัปโหลดไว้ — ตรวจว่ามีอยู่จริงก่อนอ้างอิง
    const files = await attachFiles(env, b.files, FILE_KEY_RE);

    // กันส่งซ้ำ: มีคำขอลักษณะเดียวกันที่ยังไม่เสร็จอยู่แล้ว
    const dup = await env.DB.prepare(
      `SELECT app_no FROM permit_applications
       WHERE id_card = ? AND business_name = ? AND app_type = ? AND status IN ('PENDING','ACTION_REQUIRED')
       LIMIT 1`
    ).bind(id_card, business_name, app_type).first();
    if (dup) {
      return fail('มีคำขอลักษณะเดียวกันที่อยู่ระหว่างดำเนินการอยู่แล้ว', 409, { code: 'DUPLICATE', app_no: dup.app_no });
    }

    // เลขคำขอรันตามลำดับ (ไม่สุ่ม จึงไม่ซ้ำ)
    const [, , sel] = await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO permit_applications
          (app_no, app_type, old_license_no, applicant_name, id_card, phone, email,
           business_name, business_type, location_address, applicant_address, doc_url, doc_files)
        VALUES ('TMP', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        app_type, old_license_no || null, applicant_name, id_card, phone, email || null,
        business_name, business_type, location_address, applicant_address,
        doc_url || null, files.length ? JSON.stringify(files) : null
      ),
      env.DB.prepare(`UPDATE permit_applications SET app_no = ? || printf('%05d', last_insert_rowid()) WHERE id = last_insert_rowid()`)
        .bind(`REQ-${bkkYearBE()}-`),
      env.DB.prepare(`SELECT app_no FROM permit_applications WHERE id = last_insert_rowid()`),
      env.DB.prepare(`INSERT INTO status_history (application_id, status, remark, actor)
                      VALUES (last_insert_rowid(), 'PENDING', 'ยื่นคำขอผ่านระบบออนไลน์', 'applicant')`),
    ]);

    return json({ success: true, app_no: sel.results[0].app_no });
  } catch (err) {
    return fail('เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง', 500, { detail: err.message });
  }
}

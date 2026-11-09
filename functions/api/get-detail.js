import { json, fail, parseFiles } from '../_lib/utils.js';

// รายละเอียดคำขอ 1 รายการ + ประวัติสถานะ (ต้องล็อกอินเจ้าหน้าที่)
export async function onRequestGet({ request, env }) {
  try {
    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!Number.isInteger(id) || id <= 0) return fail('รหัสไม่ถูกต้อง');

    const detail = await env.DB.prepare(`SELECT * FROM permit_applications WHERE id = ?`).bind(id).first();
    if (!detail) return fail('ไม่พบข้อมูล', 404);

    const { results: history } = await env.DB.prepare(
      `SELECT status, remark, actor, created_at FROM status_history WHERE application_id = ? ORDER BY id ASC`
    ).bind(id).all();

    return json({ success: true, detail: { ...detail, doc_files: parseFiles(detail.doc_files) }, history });
  } catch (err) {
    return fail(err.message, 500);
  }
}

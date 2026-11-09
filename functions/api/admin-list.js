import { json, fail, parseFiles } from '../_lib/utils.js';

// รายการคำขอทั้งหมด (ต้องล็อกอินเจ้าหน้าที่ — ตรวจใน _middleware.js)
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM permit_applications ORDER BY id DESC LIMIT 3000`
    ).all();
    const rows = results.map((r) => ({ ...r, doc_files: parseFiles(r.doc_files) }));
    return json({ success: true, results: rows });
  } catch (err) {
    return fail(err.message, 500);
  }
}

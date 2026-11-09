import { fail, FILE_KEY_RE } from '../_lib/utils.js';
import { getFile } from '../_lib/storage.js';

// เปิดไฟล์เอกสารที่ผู้ยื่นอัปโหลด (เฉพาะเจ้าหน้าที่ — ตรวจใน _middleware.js)
export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get('key') || '';
  if (!FILE_KEY_RE.test(key)) return fail('ไฟล์ไม่ถูกต้อง');

  const f = await getFile(env, key);
  if (!f) return fail('ไม่พบไฟล์', 404);

  return new Response(f.body, {
    headers: {
      'Content-Type': f.type || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${key}"`,
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

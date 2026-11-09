// ทำงานก่อนทุก /api/* : เตรียมฐานข้อมูล, ตรวจสิทธิ์เจ้าหน้าที่, กัน CSRF, ใส่ security headers
import { ensureSchema, verifySession, fail } from '../_lib/utils.js';

// endpoint ที่ต้องล็อกอินเจ้าหน้าที่เท่านั้น
const PROTECTED = new Set(['/api/admin-list', '/api/get-detail', '/api/update-status', '/api/file']);

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');

  // กัน CSRF: คำขอที่เปลี่ยนข้อมูลต้องมาจากโดเมนเดียวกัน
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('Origin');
    if (origin) {
      let host = '';
      try { host = new URL(origin).host; } catch {}
      if (host !== url.host) return fail('คำขอไม่ถูกต้อง', 403);
    }
  }

  if (!env.DB) return fail('ยังไม่ได้ผูกฐานข้อมูล D1 (binding ชื่อ DB)', 500);
  try {
    await ensureSchema(env.DB);
  } catch (e) {
    return fail('เตรียมฐานข้อมูลไม่สำเร็จ: ' + e.message, 500);
  }

  if (PROTECTED.has(path) && !(await verifySession(request, env))) {
    return fail('กรุณาเข้าสู่ระบบเจ้าหน้าที่', 401, { code: 'UNAUTHORIZED' });
  }

  const res = await next();
  const headers = new Headers(res.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', 'no-store');
  headers.set('Referrer-Policy', 'same-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

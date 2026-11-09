import { json, fail, checkPassword, makeSession, sessionCookie, SESSION_MS } from '../_lib/utils.js';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD) {
    return fail('ยังไม่ได้ตั้งค่ารหัสผ่านเจ้าหน้าที่ (ตัวแปร ADMIN_PASSWORD ใน Cloudflare)', 503);
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const since = Date.now() - WINDOW_MS;

  await env.DB.prepare(`DELETE FROM login_fail WHERE ts < ?`).bind(since).run();
  const { n } = await env.DB.prepare(`SELECT COUNT(*) AS n FROM login_fail WHERE ip = ?`).bind(ip).first();
  if (n >= MAX_FAILS) return fail('ลองเข้าสู่ระบบผิดหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่', 429);

  let body = {};
  try { body = await request.json(); } catch {}

  if (!(await checkPassword(env, body.password))) {
    await env.DB.prepare(`INSERT INTO login_fail (ip, ts) VALUES (?, ?)`).bind(ip, Date.now()).run();
    await new Promise((r) => setTimeout(r, 600));
    return fail('รหัสผ่านไม่ถูกต้อง', 401);
  }

  await env.DB.prepare(`DELETE FROM login_fail WHERE ip = ?`).bind(ip).run();
  const token = await makeSession(env);
  return json({ success: true }, 200, {
    'Set-Cookie': sessionCookie(request, token, SESSION_MS / 1000),
  });
}

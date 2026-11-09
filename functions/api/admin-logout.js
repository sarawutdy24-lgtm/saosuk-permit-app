import { json, sessionCookie } from '../_lib/utils.js';

export async function onRequestPost({ request }) {
  return json({ success: true }, 200, { 'Set-Cookie': sessionCookie(request, '', 0) });
}

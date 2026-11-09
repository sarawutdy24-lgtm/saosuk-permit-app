import { json, verifySession } from '../_lib/utils.js';

export async function onRequestGet({ request, env }) {
  return json({
    success: true,
    authenticated: await verifySession(request, env),
    configured: !!env.ADMIN_PASSWORD,
    uploads: true,
  });
}

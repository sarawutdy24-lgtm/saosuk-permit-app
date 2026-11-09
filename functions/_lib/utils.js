// ไฟล์ช่วยเหลือกลางสำหรับ API ทั้งหมด (ไม่ใช่ route)
export const STATUSES = ['PENDING', 'ACTION_REQUIRED', 'APPROVED', 'REJECTED'];
export const LICENSE_PREFIX = 'สส.';
export const FILE_KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|pdf)$/;

/* ---------- response helpers ---------- */
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}
export const fail = (message, status = 400, extra = {}) => json({ success: false, message, ...extra }, status);

/* ---------- date helpers (เวลาไทย UTC+7) ---------- */
export const bkkNow = () => new Date(Date.now() + 7 * 3600 * 1000);
export const bkkYearCE = () => bkkNow().getUTCFullYear();
export const bkkYearBE = () => bkkYearCE() + 543;
export const bkkToday = () => bkkNow().toISOString().slice(0, 10);

/* ---------- sanitizers / validators ---------- */
export function cleanStr(v, max = 200) {
  return String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function validThaiId(id) {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}

export function normPhone(p) {
  const d = String(p ?? '').replace(/\D/g, '');
  return /^0\d{8,9}$/.test(d) ? d : null;
}

export function normUrl(u) {
  const s = cleanStr(u, 500);
  if (!s) return '';
  try {
    const url = new URL(s);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

export function isIsoDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
}

export function maskName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  const cut = (s, n) => Array.from(s).slice(0, n).join('');
  if (parts.length >= 2) return `${parts[0]} ${cut(parts[parts.length - 1], 2)}•••`;
  return `${cut(parts[0] || '', 3)}•••`;
}

export function parseFiles(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/* ---------- schema (สร้าง/อัปเกรดตารางอัตโนมัติ ไม่ต้องรัน SQL เอง) ---------- */
const SCHEMA_VERSION = '3';
let schemaPromise = null;

export function ensureSchema(db) {
  if (!schemaPromise) {
    schemaPromise = initSchema(db).catch((e) => {
      schemaPromise = null;
      throw e;
    });
  }
  return schemaPromise;
}

async function initSchema(db) {
  const run = (sql) => db.prepare(sql).run();
  await run(`CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT)`);
  const cur = await db.prepare(`SELECT value FROM app_meta WHERE key = 'schema_v'`).first();
  if (cur && cur.value === SCHEMA_VERSION) return;

  await run(`CREATE TABLE IF NOT EXISTS permit_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_no TEXT NOT NULL,
    app_type TEXT NOT NULL DEFAULT 'NEW',
    old_license_no TEXT,
    applicant_name TEXT NOT NULL,
    id_card TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    business_name TEXT NOT NULL,
    business_type TEXT NOT NULL,
    location_address TEXT NOT NULL,
    doc_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    officer_remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    license_no TEXT,
    approved_at TEXT,
    expires_at TEXT,
    applicant_address TEXT,
    doc_files TEXT
  )`);

  const { results } = await db.prepare(`PRAGMA table_info(permit_applications)`).all();
  const have = new Set(results.map((r) => r.name));
  const add = { license_no: 'TEXT', approved_at: 'TEXT', expires_at: 'TEXT', applicant_address: 'TEXT', doc_files: 'TEXT' };
  for (const [col, type] of Object.entries(add)) {
    if (!have.has(col)) await run(`ALTER TABLE permit_applications ADD COLUMN ${col} ${type}`);
  }

  await run(`CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    remark TEXT,
    actor TEXT NOT NULL DEFAULT 'officer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS uploaded_files (
    key TEXT PRIMARY KEY, name TEXT, type TEXT, size INTEGER, ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS file_chunks (
    key TEXT NOT NULL, idx INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (key, idx)
  )`);
  await run(`CREATE INDEX IF NOT EXISTS idx_upl_ip ON uploaded_files(ip, created_at)`);
  await run(`CREATE TABLE IF NOT EXISTS login_fail (ip TEXT NOT NULL, ts INTEGER NOT NULL)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_hist_app ON status_history(application_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_app_no ON permit_applications(app_no)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_app_phone ON permit_applications(phone)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_app_idcard ON permit_applications(id_card)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_app_license ON permit_applications(license_no)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_fail_ip ON login_fail(ip)`);

  // ข้อมูลเก่า: คงเลขใบอนุญาตเดิมที่เคยพิมพ์ไว้ (สส. 2569-XXXX) และวันหมดอายุเดิม 31 ธ.ค. 2569
  await run(`UPDATE permit_applications
    SET license_no = COALESCE(NULLIF(old_license_no, ''), 'สส. ' || REPLACE(app_no, 'REQ-', '')),
        approved_at = COALESCE(approved_at, updated_at, created_at),
        expires_at = COALESCE(expires_at, '2026-12-31')
    WHERE status = 'APPROVED' AND license_no IS NULL`);

  // ข้อมูลเก่า: สร้างประวัติสถานะย้อนหลังให้ครบอย่างน้อย 1 รายการ
  await run(`INSERT INTO status_history (application_id, status, remark, actor, created_at)
    SELECT id, 'PENDING', 'ยื่นคำขอผ่านระบบออนไลน์', 'applicant', created_at
    FROM permit_applications p
    WHERE NOT EXISTS (SELECT 1 FROM status_history h WHERE h.application_id = p.id)`);
  await run(`INSERT INTO status_history (application_id, status, remark, actor, created_at)
    SELECT id, status, officer_remark, 'officer', COALESCE(updated_at, created_at)
    FROM permit_applications p
    WHERE status <> 'PENDING' AND (SELECT COUNT(*) FROM status_history h WHERE h.application_id = p.id) = 1`);

  await run(`INSERT OR REPLACE INTO app_meta (key, value) VALUES ('schema_v', '${SCHEMA_VERSION}')`);
}

/* ---------- admin auth (HMAC cookie) ---------- */
export const SESSION_MS = 12 * 3600 * 1000;
const enc = new TextEncoder();

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(msg))));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const secretOf = (env) => env.SESSION_SECRET || env.ADMIN_PASSWORD || '';

export async function checkPassword(env, input) {
  if (!env.ADMIN_PASSWORD) return false;
  const a = await hmac('pw-check', String(input ?? ''));
  const b = await hmac('pw-check', String(env.ADMIN_PASSWORD));
  return safeEqual(a, b);
}

export async function makeSession(env) {
  const exp = Date.now() + SESSION_MS;
  return `${exp}.${await hmac(secretOf(env), 'v1.' + exp)}`;
}

export async function verifySession(request, env) {
  const secret = secretOf(env);
  if (!secret) return false;
  const m = /(?:^|;\s*)admin_session=([^;]+)/.exec(request.headers.get('Cookie') || '');
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(secret, 'v1.' + exp));
}

export function sessionCookie(request, token, maxAgeSec) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `admin_session=${token}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Strict${secure}`;
}

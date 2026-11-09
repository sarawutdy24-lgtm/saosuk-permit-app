// ฟังก์ชันกลางที่ใช้ทุกหน้า: ไอคอน, วันที่ไทย, เรียก API, toast, header/footer
(function () {
  const C = window.APP_CONFIG;

  /* ---------- icons ---------- */
  const P = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    download: '<path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/>',
    upload: '<path d="M12 16V5"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/>',
    print: '<path d="M7 9V3h10v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    logout: '<path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="m16 8 4 4-4 4M20 12H9"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    store: '<path d="M4 9 5.5 4h13L20 9"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/><path d="M5 12v8h14v-8"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h3M20 17v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    chevL: '<path d="m15 6-6 6 6 6"/>',
    chevR: '<path d="m9 6 6 6-6 6"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.6 1.8-2 3-2s2.4.4 3 2M14 10h4M14 14h3"/>',
  };
  function icon(name, size = 18, extra = '') {
    return `<svg class="ic ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
  }

  /* ---------- helpers ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // เวลาจาก D1 เป็น UTC แบบ "YYYY-MM-DD HH:MM:SS" (ไม่มี Z) — แปลงให้ถูกต้อง
  function parseDate(s) {
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T00:00:00+07:00');
    const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
    return isNaN(d) ? null : d;
  }
  const mk = (o) => new Intl.DateTimeFormat('th-TH-u-ca-buddhist', { timeZone: 'Asia/Bangkok', ...o });
  const F = {
    long: mk({ day: 'numeric', month: 'long', year: 'numeric' }),
    short: mk({ day: 'numeric', month: 'short', year: '2-digit' }),
    time: mk({ day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
  };
  const fmt = (kind) => (s) => { const d = parseDate(s); return d ? F[kind].format(d) : '-'; };
  const fmtDate = fmt('long'), fmtShort = fmt('short'), fmtTime = (s) => { const d = parseDate(s); return d ? F.time.format(d) + ' น.' : '-'; };
  const daysSince = (s) => { const d = parseDate(s); return d ? Math.floor((Date.now() - d.getTime()) / 86400000) : 0; };
  const daysUntil = (s) => { const d = parseDate(s); return d ? Math.ceil((d.getTime() + 86400000 - Date.now()) / 86400000) : null; };

  const maskId = (id) => { const d = String(id || '').replace(/\D/g, ''); return d.length === 13 ? `${d[0]}-${d.slice(1, 5)}-xxxxx-${d.slice(10, 12)}-${d[12]}` : id || '-'; };
  const fmtPhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d.length === 9 ? `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}` : p || '-'; };
  const fmtId = (id) => { const d = String(id || '').replace(/\D/g, ''); return d.length === 13 ? `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}` : id || '-'; };
  const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

  function validThaiId(id) {
    if (!/^\d{13}$/.test(id)) return false;
    let s = 0; for (let i = 0; i < 12; i++) s += +id[i] * (13 - i);
    return (11 - (s % 11)) % 10 === +id[12];
  }

  /* ---------- status ---------- */
  const STATUS = {
    PENDING: { label: 'รอตรวจสอบ', cls: 'amber', t: 't-amber' },
    ACTION_REQUIRED: { label: 'ต้องแก้ไขเอกสาร', cls: 'orange', t: 't-orange' },
    APPROVED: { label: 'อนุมัติแล้ว', cls: 'green', t: 't-green' },
    REJECTED: { label: 'ไม่อนุมัติ', cls: 'red', t: 't-red' },
  };
  const badge = (st) => { const m = STATUS[st]; return m ? `<span class="badge ${m.cls}">${m.label}</span>` : `<span class="badge gray">${esc(st)}</span>`; };
  const typeBadge = (t) => (t === 'RENEW' ? '<span class="badge blue plain">ต่ออายุ</span>' : '<span class="badge gray plain">ขอใหม่</span>');

  /* ---------- api / toast ---------- */
  async function api(url, opts = {}) {
    let res;
    try {
      res = await fetch(url, { credentials: 'same-origin', ...opts });
    } catch {
      throw Object.assign(new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ต'), { network: true });
    }
    let data = null;
    try { data = await res.json(); } catch {}
    if (!data) throw new Error('เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (' + res.status + ')');
    if (!data.success) throw Object.assign(new Error(data.message || 'เกิดข้อผิดพลาด'), { status: res.status, data });
    return data;
  }
  const post = (url, body) => api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  function toast(msg, type = 'ok') {
    let box = $('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = icon(type === 'ok' ? 'check' : 'alert', 18) + `<span>${esc(msg)}</span>`;
    box.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3200);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast('คัดลอกแล้ว'); }
    catch { toast('คัดลอกไม่สำเร็จ', 'err'); }
  }


  /* ---------- uploader (ลากวาง/เลือกไฟล์, ย่อรูปอัตโนมัติ, อัปโหลดทีละไฟล์) ---------- */
  async function shrinkImage(file) {
    if (!/^image\/(jpeg|png)$/.test(file.type)) return file;
    try {
      const bmp = await createImageBitmap(file);
      const MAX = 1800, sc = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
      if (sc === 1 && file.size < 700 * 1024) return file;
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
      if (blob && blob.size < file.size) return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch {}
    return file;
  }

  // root ต้องมี .drop, input[type=file] และ ul.file-list
  function makeUploader(root, { max = 5, onChange } = {}) {
    const drop = $('.drop', root), input = $('input[type=file]', root), list = $('.file-list', root);
    const items = []; let pending = 0;
    const emit = () => onChange && onChange();
    const draw = (extra = '') => {
      list.innerHTML = items.map((f, i) => `<li>${icon('file', 18)}<span class="nm">${esc(f.name)}</span><span class="sz">${fmtSize(f.size)}</span>
        <button type="button" data-i="${i}" aria-label="ลบไฟล์">${icon('x', 16)}</button></li>`).join('') + extra;
      $$('button', list).forEach((b) => b.addEventListener('click', () => { items.splice(+b.dataset.i, 1); draw(); emit(); }));
    };
    async function add(fileList) {
      for (const orig of Array.from(fileList)) {
        if (items.length >= max) { toast(`แนบได้สูงสุด ${max} ไฟล์`, 'err'); break; }
        if (!/^(image\/(jpeg|png)|application\/pdf)$/.test(orig.type)) { toast(`"${orig.name}" ไม่รองรับ (ใช้ JPG, PNG, PDF)`, 'err'); continue; }
        pending++;
        draw(`<li class="up"><span class="spinner dark"></span><span class="nm">กำลังอัปโหลด ${esc(orig.name)}…</span></li>`);
        try {
          const file = await shrinkImage(orig);
          if (file.size > 5 * 1048576) throw new Error(`"${orig.name}" ใหญ่เกิน 5 MB`);
          const fd = new FormData(); fd.append('file', file, file.name);
          const r = await api('/api/upload', { method: 'POST', body: fd });
          items.push({ key: r.key, name: orig.name, size: r.size });
        } catch (e) { toast(e.message, 'err'); }
        pending--; draw(); emit();
      }
    }
    drop.addEventListener('click', () => input.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', () => { add(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => add(e.dataTransfer.files));
    return { get items() { return items; }, get keys() { return items.map((f) => f.key); }, get busy() { return pending > 0; } };
  }

  const dropHtml = (id) => `<div class="drop" tabindex="0" role="button" aria-label="เลือกไฟล์เอกสาร">
      <div class="ico">${icon('upload', 30)}</div>
      <b>แตะเพื่อเลือกไฟล์ หรือลากมาวางที่นี่</b>
      <span class="hint">JPG, PNG, PDF ไม่เกิน 5 MB ต่อไฟล์ (สูงสุด 5 ไฟล์) — ถ่ายรูปจากมือถือได้เลย</span>
      <input type="file" accept="image/jpeg,image/png,application/pdf" multiple hidden>
    </div><ul class="file-list"></ul>`;

  /* ---------- layout (public pages) ---------- */
  const markSvg = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4.5 6v5.5c0 4.4 3 7.6 7.5 9 4.5-1.4 7.5-4.6 7.5-9V6z"/><path d="M8 12.5c1.3-1.2 2.4-1.2 4 0s2.7 1.2 4 0"/></svg>';

  function mountLayout(active) {
    const h = $('#site-header');
    if (h) {
      h.outerHTML = `
      <header class="site-header">
        <div class="container bar">
          <a class="brand" href="index.html">
            <span class="brand-mark">${markSvg}</span>
            <span class="brand-text"><strong>${esc(C.orgShort)}</strong><small>${esc(C.systemName)}</small></span>
          </a>
          <button class="nav-toggle" aria-label="เมนู" aria-expanded="false">${icon('menu', 22)}</button>
          <nav class="nav" id="nav">
            <a href="index.html" class="${active === 'home' ? 'active' : ''}">ยื่นคำขอ</a>
            <a href="track.html" class="${active === 'track' ? 'active' : ''}">ติดตามสถานะ</a>
            <a href="verify.html" class="${active === 'verify' ? 'active' : ''}">ตรวจสอบใบอนุญาต</a>
          </nav>
        </div>
      </header>`;
      const btn = $('.nav-toggle'), nav = $('#nav');
      btn.addEventListener('click', () => { const o = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', o); });
    }
    const f = $('#site-footer');
    if (f) {
      const contact = [
        C.phone && `<div>${icon('phone', 15)} ${esc(C.phone)}</div>`,
        C.email && `<div>${icon('mail', 15)} ${esc(C.email)}</div>`,
        C.officeHours && `<div>${icon('clock', 15)} ${esc(C.officeHours)}</div>`,
        C.address && `<div>${icon('pin', 15)} ${esc(C.address)}</div>`,
      ].filter(Boolean).join('');
      f.outerHTML = `
      <footer class="site-footer">
        <div class="container">
          <div class="cols">
            <div><strong>${esc(C.orgName)}</strong>${esc(C.dept)}<br>${esc(C.district)}</div>
            ${contact ? `<div><strong>ติดต่อสอบถาม</strong>${contact}</div>` : ''}
            <div><strong>เมนู</strong><a href="index.html">ยื่นคำขอ</a><br><a href="track.html">ติดตามสถานะ</a><br><a href="verify.html">ตรวจสอบใบอนุญาต</a></div>
          </div>
          <div class="copy"><span>© ${new Date().getFullYear() + 543} ${esc(C.orgName)}</span><a href="admin.html">สำหรับเจ้าหน้าที่</a></div>
        </div>
      </footer>`;
    }
  }

  window.UI = {
    C, icon, esc, $, $$, parseDate, fmtDate, fmtShort, fmtTime, daysSince, daysUntil,
    maskId, fmtPhone, fmtId, fmtSize, validThaiId, STATUS, badge, typeBadge, api, post, toast, copyText, mountLayout, makeUploader, dropHtml,
  };
})();

(function () {
  const { C, icon, esc, $, $$, api, post, toast, parseDate, fmtDate, fmtShort, fmtTime, daysSince, daysUntil,
    maskId, fmtId, fmtPhone, STATUS, badge, typeBadge, copyText } = UI;

  const PAGE = 15;
  const state = { all: [], status: 'ALL', type: '', q: '', sort: 'new', page: 1, expiring: false, uploads: false };

  /* ---------- static ---------- */
  const markSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4.5 6v5.5c0 4.4 3 7.6 7.5 9 4.5-1.4 7.5-4.6 7.5-9V6z"/><path d="M8 12.5c1.3-1.2 2.4-1.2 4 0s2.7 1.2 4 0"/></svg>';
  $('#adminBrand').innerHTML = `<span class="brand-mark">${markSvg}</span><span class="brand-text"><strong>จัดการคำขอใบอนุญาต</strong><small>${esc(C.dept)} · ${esc(C.orgShort)}</small></span>`;
  $('#btnRefresh').innerHTML = icon('refresh', 15) + ' รีเฟรช';
  $('#btnLogout').innerHTML = icon('logout', 15) + ' ออกจากระบบ';
  $('#lockIco').innerHTML = icon('lock', 28);
  $('#searchIco').innerHTML = icon('search', 18);
  $('#btnCsv').innerHTML = icon('download', 17) + ' ส่งออก CSV';

  /* ---------- auth ---------- */
  function showLogin(configured = true) {
    $('#dash').classList.add('hidden');
    $('#topActions').classList.add('hidden');
    $('#loginView').classList.remove('hidden');
    const nc = $('#notConfigured');
    nc.classList.toggle('hidden', configured);
    if (!configured) nc.innerHTML = icon('alert', 18) + '<span>ยังไม่ได้ตั้งรหัสผ่านเจ้าหน้าที่ — ผู้ดูแลระบบต้องเพิ่มตัวแปร <b>ADMIN_PASSWORD</b> ใน Cloudflare (ดูคู่มือ README)</span>';
    setTimeout(() => $('#pw').focus(), 50);
  }
  function showDash() {
    $('#loginView').classList.add('hidden');
    $('#dash').classList.remove('hidden');
    $('#topActions').classList.remove('hidden');
  }

  async function boot() {
    try {
      const me = await api('/api/admin-me');
      state.uploads = me.uploads;
      if (!me.authenticated) return showLogin(me.configured);
      showDash();
      load();
    } catch (e) { showLogin(); toast(e.message, 'err'); }
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#btnLogin');
    $('#pw').closest('.field').classList.remove('invalid');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> กำลังตรวจสอบ…';
    try {
      await post('/api/admin-login', { password: $('#pw').value });
      $('#pw').value = '';
      showDash(); load();
    } catch (err) {
      const f = $('#pw').closest('.field');
      f.classList.add('invalid'); $('#pwErr').textContent = err.message;
    } finally { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }
  });

  $('#btnLogout').addEventListener('click', async () => {
    try { await post('/api/admin-logout', {}); } catch {}
    closeDrawer(); state.all = [];
    showLogin(true);
  });

  /* ---------- data ---------- */
  async function load() {
    $('#rows').innerHTML = Array.from({ length: 5 }, () => `<tr><td colspan="5"><div class="skeleton" style="height:42px"></div></td></tr>`).join('');
    try {
      const r = await api('/api/admin-list');
      state.all = r.results;
      $('#updatedAt').textContent = 'อัปเดต ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
      render();
    } catch (e) {
      if (e.status === 401) { showLogin(); toast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', 'err'); }
      else $('#rows').innerHTML = `<tr><td colspan="5"><div class="empty">${esc(e.message)}</div></td></tr>`;
    }
  }
  $('#btnRefresh').addEventListener('click', load);

  const isExpiring = (x) => { if (x.status !== 'APPROVED' || !x.expires_at) return false; const d = daysUntil(x.expires_at); return d !== null && d <= C.expireWarnDays; };

  function counts() {
    const c = { ALL: state.all.length, PENDING: 0, ACTION_REQUIRED: 0, APPROVED: 0, REJECTED: 0, EXP: 0 };
    for (const x of state.all) { if (c[x.status] !== undefined) c[x.status]++; if (isExpiring(x)) c.EXP++; }
    return c;
  }

  function sparkline() {
    // จำนวนคำขอ 14 วันล่าสุด (เวลาไทย)
    const key = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d);
    const days = [];
    for (let i = 13; i >= 0; i--) days.push(key(new Date(Date.now() - i * 86400000)));
    const m = Object.fromEntries(days.map((d) => [d, 0]));
    for (const x of state.all) { const d = parseDate(x.created_at); if (d) { const k = key(d); if (k in m) m[k]++; } }
    const max = Math.max(1, ...Object.values(m));
    const total = Object.values(m).reduce((a, b) => a + b, 0);
    const bars = days.map((d, i) => `<i class="${i === 13 ? 'today' : ''}" style="height:${Math.max(7, (m[d] / max) * 100)}%" title="${d}: ${m[d]} คำขอ"></i>`).join('');
    return `<div class="lbl">คำขอใหม่ 14 วันล่าสุด</div><div style="display:flex;align-items:flex-end;gap:12px"><div class="num">${total}</div><div class="spark" style="flex:1">${bars}</div></div>`;
  }

  function renderStats() {
    const c = counts();
    const mk = (key, cls, label, dot) => `<button class="stat ${cls} ${state.status === key && !state.expiring ? 'active' : ''}" data-s="${key}" type="button">
      <div class="lbl">${dot ? `<span class="dotc" style="background:${dot}"></span>` : ''}${label}</div><div class="num">${c[key]}</div></button>`;
    $('#stats').innerHTML =
      mk('ALL', '', 'คำขอทั้งหมด') + mk('PENDING', 'pending', 'รอตรวจสอบ', 'var(--accent)') +
      mk('ACTION_REQUIRED', 'act', 'รอแก้ไขเอกสาร', '#ea580c') + mk('APPROVED', 'ok', 'อนุมัติแล้ว', '#059669') +
      mk('REJECTED', 'bad', 'ไม่อนุมัติ', '#dc2626') + `<div class="stat chart">${sparkline()}</div>`;
    $$('#stats .stat[data-s]').forEach((b) => b.addEventListener('click', () => { state.status = b.dataset.s; state.expiring = false; state.page = 1; render(); }));
    $('#expBtnWrap').innerHTML = c.EXP ? `<button class="expiring" type="button" id="expBtn">${icon('clock', 15)} ใกล้หมดอายุ/หมดอายุ ${c.EXP} ราย${state.expiring ? ' (กำลังกรอง)' : ''}</button>` : '';
    const eb = $('#expBtn');
    if (eb) eb.addEventListener('click', () => { state.expiring = !state.expiring; state.status = state.expiring ? 'APPROVED' : 'ALL'; state.page = 1; render(); });
  }

  function filtered() {
    const kw = state.q.toLowerCase();
    let list = state.all.filter((x) =>
      (state.status === 'ALL' || x.status === state.status) &&
      (!state.type || x.app_type === state.type) &&
      (!state.expiring || isExpiring(x)) &&
      (!kw || [x.app_no, x.applicant_name, x.business_name, x.phone, x.license_no].some((v) => v && String(v).toLowerCase().includes(kw)) ||
        (kw.replace(/\D/g, '').length >= 4 && String(x.phone || '').replace(/\D/g, '').includes(kw.replace(/\D/g, ''))))
    );
    if (state.sort === 'old') list = [...list].sort((a, b) => a.id - b.id);
    return list;
  }

  function render() {
    renderStats();
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    state.page = Math.min(state.page, pages);
    const slice = list.slice((state.page - 1) * PAGE, state.page * PAGE);

    if (!slice.length) {
      $('#rows').innerHTML = `<tr><td colspan="5" style="cursor:default"><div class="empty"><div class="ico">${icon('file', 28)}</div>ไม่พบรายการคำขอ${state.q ? 'ที่ตรงกับ "' + esc(state.q) + '"' : 'ในหมวดนี้'}</div></td></tr>`;
    } else {
      $('#rows').innerHTML = slice.map((x) => {
        const waiting = x.status === 'PENDING' ? daysSince(x.created_at) : null;
        const waitTag = waiting !== null ? `<span class="wait ${waiting >= 7 ? 'late' : ''}">${icon('clock', 13)} รอมา ${waiting === 0 ? 'วันนี้' : waiting + ' วัน'}</span>` : '';
        const exp = isExpiring(x) ? `<span class="wait ${daysUntil(x.expires_at) < 0 ? 'late' : ''}">${icon('clock', 13)} ${daysUntil(x.expires_at) < 0 ? 'หมดอายุแล้ว' : 'หมดอายุ ' + fmtShort(x.expires_at)}</span>` : '';
        const nFiles = (x.doc_files || []).length + (x.doc_url ? 1 : 0);
        return `<tr data-id="${x.id}" tabindex="0">
          <td data-label="เลขคำขอ"><span class="no">${esc(x.app_no)}</span><span class="sub">${esc(fmtShort(x.created_at))}</span>${typeBadge(x.app_type)}</td>
          <td data-label="ผู้ยื่น"><b>${esc(x.applicant_name)}</b><span class="sub">${esc(x.business_name)}</span>${nFiles ? `<span class="sub">${icon('file', 13)} เอกสาร ${nFiles}</span>` : '<span class="sub" style="color:var(--warn)">ยังไม่มีเอกสาร</span>'}</td>
          <td data-label="ประเภท" class="small">${esc(x.business_type)}</td>
          <td data-label="โทร" class="small">${esc(fmtPhone(x.phone))}<span class="sub">${esc(maskId(x.id_card))}</span></td>
          <td data-label="สถานะ">${badge(x.status)}<br>${waitTag}${exp}</td></tr>`;
      }).join('');
      $$('#rows tr[data-id]').forEach((tr) => {
        const open = () => openDrawer(+tr.dataset.id);
        tr.addEventListener('click', open);
        tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
      });
    }

    $('#pager').innerHTML = `<span>แสดง ${list.length ? (state.page - 1) * PAGE + 1 : 0}–${Math.min(state.page * PAGE, list.length)} จาก ${list.length} รายการ</span>
      <span class="btns"><button class="btn btn-ghost btn-sm" id="pPrev" ${state.page <= 1 ? 'disabled' : ''}>${icon('chevL', 15)} ก่อนหน้า</button>
      <span>${state.page} / ${pages}</span>
      <button class="btn btn-ghost btn-sm" id="pNext" ${state.page >= pages ? 'disabled' : ''}>ถัดไป ${icon('chevR', 15)}</button></span>`;
    $('#pPrev').onclick = () => { state.page--; render(); window.scrollTo({ top: 0 }); };
    $('#pNext').onclick = () => { state.page++; render(); window.scrollTo({ top: 0 }); };
  }

  let t;
  $('#search').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value.trim(); state.page = 1; render(); }, 160); });
  $('#typeFilter').addEventListener('change', (e) => { state.type = e.target.value; state.page = 1; render(); });
  $('#sortSel').addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; render(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !$('#dash').classList.contains('hidden')) { e.preventDefault(); $('#search').focus(); }
    if (e.key === 'Escape') closeDrawer();
  });

  /* ---------- CSV ---------- */
  $('#btnCsv').addEventListener('click', () => {
    const list = filtered();
    if (!list.length) return toast('ไม่มีข้อมูลให้ส่งออก', 'err');
    const head = ['เลขคำขอ', 'ประเภทคำขอ', 'วันที่ยื่น', 'ชื่อผู้ยื่น', 'โทรศัพท์', 'ชื่อสถานประกอบการ', 'ประเภทกิจการ', 'ที่ตั้ง', 'สถานะ', 'เลขที่ใบอนุญาต', 'วันที่อนุมัติ', 'วันหมดอายุ', 'หมายเหตุ'];
    const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const rows = list.map((x) => [x.app_no, x.app_type === 'NEW' ? 'ขอใหม่' : 'ต่ออายุ', x.created_at, x.applicant_name, x.phone, x.business_name, x.business_type, x.location_address,
      (STATUS[x.status] || {}).label || x.status, x.license_no, x.approved_at, x.expires_at, x.officer_remark].map(cell).join(','));
    const blob = new Blob(['﻿' + [head.map(cell).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `permit-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
    toast(`ส่งออก ${list.length} รายการแล้ว`);
  });

  /* ---------- drawer ---------- */
  const dotColor = { PENDING: 'var(--accent)', ACTION_REQUIRED: '#ea580c', APPROVED: '#059669', REJECTED: '#dc2626' };
  const remarkChips = {
    ACTION_REQUIRED: ['เอกสารไม่ครบถ้วน', 'ภาพเอกสารไม่ชัดเจน', 'ลิงก์เอกสารเปิดไม่ได้ กรุณาตั้งสิทธิ์การเข้าถึง', 'แผนผังที่ตั้งไม่ชัดเจน', 'ที่อยู่ไม่ตรงกับเอกสาร'],
    REJECTED: ['ไม่ผ่านการตรวจสอบสถานที่', 'ประเภทกิจการไม่ตรงกับข้อกำหนด', 'เอกสารไม่ถูกต้อง'],
    APPROVED: ['ผ่านการตรวจสอบแล้ว'],
    PENDING: [],
  };
  const actorLbl = { applicant: 'ผู้ยื่น', officer: 'เจ้าหน้าที่', system: 'ระบบ' };

  function closeDrawer() { $('#drawerRoot').innerHTML = ''; document.body.style.overflow = ''; }

  async function openDrawer(id) {
    document.body.style.overflow = 'hidden';
    $('#drawerRoot').innerHTML = `<div class="drawer-bg" id="dBg"></div><aside class="drawer" role="dialog" aria-modal="true"><div class="drawer-body"><div class="skeleton" style="height:28px;width:60%;margin-bottom:18px"></div><div class="skeleton" style="height:120px;margin-bottom:14px"></div><div class="skeleton" style="height:160px"></div></div></aside>`;
    $('#dBg').addEventListener('click', closeDrawer);
    try {
      const r = await api('/api/get-detail?id=' + id);
      drawer(r.detail, r.history);
    } catch (e) {
      closeDrawer();
      if (e.status === 401) { showLogin(); }
      toast(e.message, 'err');
    }
  }

  function drawer(d, hist) {
    const files = (d.doc_files || []).map((f) => `<a href="/api/file?key=${encodeURIComponent(f.key)}" target="_blank" rel="noopener">${icon('file', 18)}<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</span>${icon('eye', 16)}</a>`).join('');
    const link = d.doc_url ? `<a href="${esc(d.doc_url)}" target="_blank" rel="noopener noreferrer">${icon('link', 18)}<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.doc_url)}</span></a>` : '';
    const docs = files + link || '<span class="muted small">ผู้ยื่นยังไม่ได้แนบเอกสาร — ใช้สถานะ "รอแก้ไขเอกสาร" เพื่อขอเพิ่ม</span>';

    const license = d.license_no ? `<div class="dsec"><h4>ใบอนุญาต</h4><div class="license-box"><b>${esc(d.license_no)}</b>
      <div class="small" style="margin-top:4px;color:#065f46">ออกเมื่อ ${fmtDate(d.approved_at)} · หมดอายุ ${fmtDate(d.expires_at)}</div></div></div>` : '';

    const tl = hist.slice().reverse().map((h) => {
      const m = STATUS[h.status] || { t: 't-amber', label: h.status };
      return `<li class="${m.t}"><span class="dot"></span><div class="t-head"><span class="t-title">${m.label}</span><span class="t-time">${esc(fmtTime(h.created_at))}</span></div>
        <div class="muted small">โดย${actorLbl[h.actor] || 'เจ้าหน้าที่'}</div>${h.remark ? `<div class="t-note">${esc(h.remark)}</div>` : ''}</li>`;
    }).join('');

    const statusOpts = ['PENDING', 'ACTION_REQUIRED', 'APPROVED', 'REJECTED'].map((s) => `
      <label class="choice"><input type="radio" name="st" value="${s}" ${d.status === s ? 'checked' : ''}>
        <span class="body"><span class="dotc" style="background:${dotColor[s]}"></span><b>${STATUS[s].label}</b></span></label>`).join('');

    const defExp = d.expires_at || `${new Date().getFullYear()}-12-31`;

    $('#drawerRoot').innerHTML = `
      <div class="drawer-bg" id="dBg"></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-label="รายละเอียดคำขอ">
        <div class="drawer-head">
          <div><h2>${esc(d.app_no)}</h2><div style="display:flex;gap:8px;align-items:center;margin-top:6px">${typeBadge(d.app_type)} ${badge(d.status)}</div></div>
          <button class="icon-btn" id="dClose" aria-label="ปิด">${icon('x', 18)}</button>
        </div>
        <div class="drawer-body">
          ${license}
          <div class="dsec"><h4>ผู้ยื่นคำขอ</h4><dl class="dl">
            <dt>ชื่อ-นามสกุล</dt><dd>${esc(d.applicant_name)}</dd>
            <dt>เลขบัตร ปชช.</dt><dd>${esc(fmtId(d.id_card))} <button class="copy" data-copy="${esc(d.id_card)}" title="คัดลอก">${icon('copy', 15)}</button></dd>
            <dt>โทรศัพท์</dt><dd><a href="tel:${esc(d.phone)}">${esc(fmtPhone(d.phone))}</a></dd>
            ${d.email ? `<dt>อีเมล</dt><dd><a href="mailto:${esc(d.email)}">${esc(d.email)}</a></dd>` : ''}
            ${d.applicant_address ? `<dt>ที่อยู่ผู้ขอ</dt><dd>${esc(d.applicant_address)}</dd>` : ''}
            ${d.app_type === 'RENEW' ? `<dt>ใบอนุญาตเดิม</dt><dd>${esc(d.old_license_no || '-')}</dd>` : ''}
          </dl></div>
          <div class="dsec"><h4>สถานประกอบการ</h4><dl class="dl">
            <dt>ชื่อ</dt><dd>${esc(d.business_name)}</dd>
            <dt>ประเภทกิจการ</dt><dd>${esc(d.business_type)}</dd>
            <dt>ที่ตั้ง</dt><dd>${esc(d.location_address)}<br><a class="small" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.location_address + ' ' + C.district)}">${icon('map', 14)} เปิดแผนที่</a></dd>
            <dt>วันที่ยื่น</dt><dd>${esc(fmtTime(d.created_at))}</dd>
          </dl></div>
          <div class="dsec"><h4>เอกสารแนบ</h4><div class="doc-links">${docs}</div></div>

          <div class="dsec"><h4>ดำเนินการ</h4>
            <div class="status-choices" id="stChoices">${statusOpts}</div>
            <div class="field" id="expField" style="${d.status === 'APPROVED' ? '' : 'display:none'}">
              <label for="expires">วันหมดอายุของใบอนุญาต</label>
              <input class="input" type="date" id="expires" value="${esc(defExp)}">
              <div class="hint">ค่าเริ่มต้น: 31 ธันวาคมของปีนี้ — ปรับตามกฎหมาย/ข้อบัญญัติที่ใช้ได้</div>
            </div>
            <div class="field" style="margin-bottom:6px">
              <label for="remark">หมายเหตุ / แจ้งสิ่งที่ต้องแก้ไข <span class="muted small" id="remarkReq"></span></label>
              <textarea class="textarea" id="remark" rows="3" maxlength="600" placeholder="ข้อความนี้จะแสดงให้ผู้ยื่นเห็นในหน้าติดตามสถานะ">${esc(d.officer_remark || '')}</textarea>
              <div class="err">กรุณาระบุเหตุผล เพื่อแจ้งผู้ยื่น</div>
              <div class="chips" id="chips"></div>
            </div>
          </div>

          <div class="dsec"><h4>ประวัติการดำเนินการ</h4><ul class="timeline">${tl}</ul></div>
        </div>
        <div class="drawer-foot">
          <button class="btn btn-primary" id="dSave" style="flex:1">${icon('check', 18)} บันทึกสถานะ</button>
          ${d.status === 'APPROVED' ? `<a class="btn btn-ok" target="_blank" href="print-permit.html?id=${d.id}">${icon('print', 18)} พิมพ์ใบอนุญาต</a>` : ''}
        </div>
      </aside>`;

    $('#dBg').addEventListener('click', closeDrawer);
    $('#dClose').addEventListener('click', closeDrawer);
    $$('[data-copy]').forEach((b) => b.addEventListener('click', () => copyText(b.dataset.copy)));

    const curStatus = () => $('#stChoices input:checked').value;
    const syncStatus = () => {
      const s = curStatus();
      $('#expField').style.display = s === 'APPROVED' ? '' : 'none';
      $('#remarkReq').textContent = s === 'ACTION_REQUIRED' || s === 'REJECTED' ? '(จำเป็น)' : '(ไม่บังคับ)';
      $('#chips').innerHTML = (remarkChips[s] || []).map((c) => `<button type="button" class="chip">${esc(c)}</button>`).join('');
      $$('#chips .chip').forEach((b) => b.addEventListener('click', () => {
        const r = $('#remark'); r.value = r.value && !r.value.includes(b.textContent) ? r.value.replace(/[\s.]+$/, '') + ', ' + b.textContent : b.textContent; r.focus();
        r.closest('.field').classList.remove('invalid');
      }));
    };
    $$('#stChoices input').forEach((i) => i.addEventListener('change', syncStatus));
    syncStatus();

    $('#dSave').addEventListener('click', async (ev) => {
      const status = curStatus(), remark = $('#remark').value.trim();
      const needs = status === 'ACTION_REQUIRED' || status === 'REJECTED';
      $('#remark').closest('.field').classList.toggle('invalid', needs && !remark);
      if (needs && !remark) return $('#remark').focus();
      if (status === 'REJECTED' && !confirm('ยืนยันการ "ไม่อนุมัติ" คำขอนี้?')) return;

      const btn = ev.currentTarget; btn.disabled = true; const old = btn.innerHTML; btn.innerHTML = '<span class="spinner"></span> กำลังบันทึก…';
      try {
        const r = await post('/api/update-status', { id: d.id, status, officer_remark: remark, expires_at: status === 'APPROVED' ? $('#expires').value : undefined });
        toast(status === 'APPROVED' && r.license_no ? `อนุมัติแล้ว — เลขที่ใบอนุญาต ${r.license_no}` : 'บันทึกสถานะเรียบร้อย');
        const det = await api('/api/get-detail?id=' + d.id);
        drawer(det.detail, det.history);
        load();
      } catch (e) {
        toast(e.message, 'err');
        if (e.status === 401) { closeDrawer(); showLogin(); }
        btn.disabled = false; btn.innerHTML = old;
      }
    });
  }

  boot();
})();

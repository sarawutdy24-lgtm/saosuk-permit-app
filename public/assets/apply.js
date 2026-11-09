// หน้ายื่นคำขอ: แบบฟอร์ม 3 ขั้นตอน + ตรวจสอบข้อมูล + อัปโหลดไฟล์ (ถ้าเปิดใช้)
(function () {
  const { C, icon, esc, $, $$, api, post, toast, fmtPhone, fmtId, fmtSize, validThaiId, copyText } = UI;
  UI.mountLayout('home');

  /* ---------- static content from config ---------- */
  $('#heroEyebrow').innerHTML = icon('shield', 16) + ' ' + esc(C.dept) + ' · ' + esc(C.orgShort);
  $('#ctaIcon').innerHTML = icon('arrow', 18);
  $('#ctaTrack').innerHTML = icon('search', 18) + ' ติดตามสถานะ';
  $('#heroChips').innerHTML = ['ยื่นได้ตลอด 24 ชั่วโมง', 'ติดตามสถานะได้ทันที', 'ตรวจสอบใบอนุญาตด้วย QR Code']
    .map((t) => `<span>${icon('check', 16)} ${t}</span>`).join('');
  $('#icoNew').innerHTML = icon('plus', 20);
  $('#icoRenew').innerHTML = icon('refresh', 20);
  $('#consentOrg').textContent = C.orgName;
  $('#btnBack').innerHTML = icon('back', 16) + ' ย้อนกลับ';
  $('#btnNext').innerHTML = 'ถัดไป ' + icon('arrow', 16);
  $('#btnSubmit').innerHTML = icon('check', 18) + ' ส่งคำขอใบอนุญาต';
  $('#business_type').innerHTML = C.businessTypes.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('');

  $('#docsTitle').innerHTML = icon('doc', 18) + ' เอกสารที่ต้องเตรียม';
  $('#docsList').innerHTML = [
    'สำเนาบัตรประชาชนผู้ขอ',
    'สำเนาทะเบียนบ้านผู้ขอ',
    'แผนผังที่ตั้ง / ผังร้านโดยสังเขป',
    'ภาพถ่ายสถานประกอบการ (ถ้ามี)',
  ].map((t) => `<li>${icon('check', 16)}<span>${t}</span></li>`).join('') +
    `<li class="only-renew">${icon('check', 16)}<span><b>ใบอนุญาตฉบับเดิม</b> (กรณีต่ออายุ)</span></li>`;

  const contact = [
    C.phone && `<li>${icon('phone', 16)}<span>${esc(C.phone)}</span></li>`,
    C.email && `<li>${icon('mail', 16)}<span>${esc(C.email)}</span></li>`,
    C.officeHours && `<li>${icon('clock', 16)}<span>${esc(C.officeHours)}</span></li>`,
  ].filter(Boolean).join('');
  if (contact) $('#contactCard').innerHTML = `<h3>${icon('phone', 18)} สอบถามเจ้าหน้าที่</h3><ul class="checklist">${contact}</ul>`;
  else $('#contactCard').remove();

  $('#features').innerHTML = [
    ['clock', 'ยื่นได้ทุกเวลา', 'กรอกคำขอได้ตลอด 24 ชั่วโมง ไม่ต้องรอเวลาทำการ'],
    ['search', 'ติดตามสถานะเอง', 'ดูความคืบหน้าและหมายเหตุจากเจ้าหน้าที่ได้ทันที'],
    ['refresh', 'แก้ไขเอกสารง่าย', 'ถ้าเอกสารไม่ครบ ส่งเพิ่มได้ในหน้าเดียว ไม่ต้องยื่นใหม่'],
    ['qr', 'ตรวจสอบได้ด้วย QR', 'ใบอนุญาตมี QR Code ให้ประชาชนสแกนตรวจสอบความถูกต้อง'],
  ].map(([i, t, d]) => `<div class="card feature"><div class="ico">${icon(i, 24)}</div><h3>${t}</h3><p>${d}</p></div>`).join('');

  /* ---------- state ---------- */
  const form = $('#permitForm');
  const steps = $$('.form-step'), stepEls = $$('#stepper .st');
  let step = 1;

  const val = (id) => $('#' + id).value.trim();
  const type = () => form.querySelector('input[name=app_type]:checked').value;

  function setErr(id, bad, msg) {
    const f = $('#' + id).closest('.field');
    f.classList.toggle('invalid', bad);
    if (msg) f.querySelector('.err').textContent = msg;
    return !bad;
  }

  /* ---------- validators per step ---------- */
  const rules = {
    old_license_no: () => type() !== 'RENEW' || val('old_license_no').length >= 3,
    applicant_name: () => val('applicant_name').length >= 3,
    id_card: () => validThaiId(val('id_card')),
    phone: () => /^0\d{8,9}$/.test(val('phone').replace(/\D/g, '')),
    email: () => !val('email') || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email')),
    applicant_address: () => val('applicant_address').length >= 8,
    business_name: () => val('business_name').length >= 2,
    location_address: () => val('location_address').length >= 8,
    doc_url: () => !val('doc_url') || /^https?:\/\/\S+$/i.test(val('doc_url')),
  };
  const stepFields = { 1: ['old_license_no', 'applicant_name', 'id_card', 'phone', 'email', 'applicant_address'], 2: ['business_name', 'location_address'], 3: ['doc_url'] };

  function validateStep(n) {
    let ok = true, first = null;
    for (const id of stepFields[n]) {
      const good = rules[id]();
      setErr(id, !good);
      if (!good) { ok = false; first = first || $('#' + id); }
    }
    if (n === 3) {
      const c = $('#consent');
      const good = c.checked;
      c.closest('.field').classList.toggle('invalid', !good);
      if (!good) { ok = false; first = first || c; }
    }
    if (first) first.focus({ preventScroll: false });
    return ok;
  }

  // ตรวจทันทีเมื่อออกจากช่อง
  Object.keys(rules).forEach((id) => {
    const el = $('#' + id);
    el.addEventListener('blur', () => { if (el.value || el.closest('.field').classList.contains('invalid')) setErr(id, !rules[id]()); });
    el.addEventListener('input', () => { if (el.closest('.field').classList.contains('invalid') && rules[id]()) setErr(id, false); });
  });
  $('#consent').addEventListener('change', (e) => e.target.closest('.field').classList.toggle('invalid', !e.target.checked));

  // เลขบัตร: รับเฉพาะตัวเลข + แสดงเครื่องหมายถูกเมื่อถูกต้อง
  $('#id_card').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 13);
    const f = e.target.closest('.field');
    f.classList.toggle('valid', e.target.value.length === 13 && validThaiId(e.target.value));
    if (e.target.value.length === 13 && !validThaiId(e.target.value)) setErr('id_card', true);
  });
  $('#phone').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^\d\-\s]/g, ''); });

  /* ---------- type toggle ---------- */
  function syncType() {
    const renew = type() === 'RENEW';
    $('#renewBox').classList.toggle('hidden', !renew);
    $('#apply').classList.toggle('is-renew', renew);
  }
  form.querySelectorAll('input[name=app_type]').forEach((r) => r.addEventListener('change', syncType));

  /* ---------- stepper ---------- */
  function go(n, scroll = true) {
    step = n;
    steps.forEach((s) => s.classList.toggle('active', +s.dataset.step === n));
    stepEls.forEach((s) => {
      const k = +s.dataset.s;
      s.classList.toggle('active', k === n);
      s.classList.toggle('done', k < n);
      s.querySelector('.num').innerHTML = k < n ? icon('check', 16) : k;
    });
    $('#btnBack').style.visibility = n === 1 ? 'hidden' : 'visible';
    $('#btnNext').classList.toggle('hidden', n === 3);
    $('#btnSubmit').classList.toggle('hidden', n !== 3);
    if (n === 3) renderReview();
    if (scroll) $('#formCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('#btnNext').addEventListener('click', () => { if (validateStep(step)) go(step + 1); });
  $('#btnBack').addEventListener('click', () => go(step - 1));
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && step < 3) { e.preventDefault(); $('#btnNext').click(); }
  });

  function renderReview() {
    const rows = [
      ['ประเภทคำขอ', type() === 'RENEW' ? `ต่ออายุใบอนุญาต (เลขเดิม ${esc(val('old_license_no'))})` : 'ขอใบอนุญาตใหม่'],
      ['ผู้ขออนุญาต', esc(val('applicant_name'))],
      ['เลขบัตรประชาชน', esc(fmtId(val('id_card')))],
      ['โทรศัพท์', esc(fmtPhone(val('phone'))) + (val('email') ? ' · ' + esc(val('email')) : '')],
      ['ที่อยู่ผู้ขอ', esc(val('applicant_address'))],
      ['สถานประกอบการ', esc(val('business_name'))],
      ['ประเภทกิจการ', esc(val('business_type'))],
      ['ที่ตั้ง', esc(val('location_address'))],
      ['เอกสารแนบ', uploader.items.length || val('doc_url') ? [uploader.items.length ? uploader.items.length + ' ไฟล์ (' + uploader.items.map((f) => esc(f.name)).join(', ') + ')' : '', val('doc_url') ? 'ลิงก์เอกสาร' : ''].filter(Boolean).join(' + ') : '<span class="muted">ยังไม่ได้แนบ</span>'],
    ];
    $('#review').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    const none = !uploader.items.length && !val('doc_url');
    const w = $('#noDocWarn');
    w.classList.toggle('hidden', !none);
    w.innerHTML = icon('alert', 18) + '<span>ยังไม่ได้แนบเอกสาร — ส่งคำขอได้ แต่เจ้าหน้าที่อาจขอให้ส่งเอกสารเพิ่มเติมภายหลัง</span>';
  }

  /* ---------- uploads ---------- */
  $('#uploadMount').innerHTML = UI.dropHtml();
  const uploader = UI.makeUploader($('#uploadMount'), { max: 5 });

  /* ---------- submit ---------- */
  function modal(html) {
    const o = document.createElement('div');
    o.className = 'overlay';
    o.innerHTML = html;
    document.body.appendChild(o);
    return o;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    for (const n of [1, 2, 3]) if (!validateStep(n)) { go(n); return; }
    if (uploader.busy) return toast('กรุณารอให้อัปโหลดไฟล์เสร็จก่อน', 'err');

    const btn = $('#btnSubmit');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> กำลังส่งข้อมูล…';

    const payload = {
      app_type: type(),
      old_license_no: type() === 'RENEW' ? val('old_license_no') : '',
      applicant_name: val('applicant_name'),
      id_card: val('id_card'),
      phone: val('phone').replace(/\D/g, ''),
      email: val('email'),
      applicant_address: val('applicant_address'),
      business_name: val('business_name'),
      business_type: val('business_type'),
      location_address: val('location_address'),
      doc_url: val('doc_url'),
      files: uploader.keys,
      website: $('#website').value,
    };

    try {
      const r = await post('/api/submit', payload);
      showSuccess(r.app_no);
    } catch (err) {
      if (err.data && err.data.code === 'DUPLICATE') {
        showDuplicate(err.data.app_no);
      } else {
        toast(err.message, 'err');
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = icon('check', 18) + ' ส่งคำขอใบอนุญาต';
    }
  });

  function showSuccess(appNo) {
    const o = modal(`
      <div class="modal" role="dialog" aria-modal="true">
        <div class="badge-ico">${icon('check', 36)}</div>
        <h3>ยื่นคำขอสำเร็จ</h3>
        <p class="muted">กรุณาจดหรือบันทึกเลขที่คำขอนี้ไว้ เพื่อใช้ติดตามสถานะ</p>
        <div class="no"><b>${esc(appNo)}</b><button class="icon-btn" id="mCopy" aria-label="คัดลอก" type="button">${icon('copy', 18)}</button></div>
        <div class="btns">
          <a class="btn btn-primary btn-lg" href="track.html?app_no=${encodeURIComponent(appNo)}">${icon('search', 18)} ติดตามสถานะคำขอ</a>
          <a class="btn btn-ghost" href="index.html">ยื่นคำขอรายการอื่น</a>
        </div>
      </div>`);
    $('#mCopy', o).addEventListener('click', () => copyText(appNo));
  }

  function showDuplicate(appNo) {
    const o = modal(`
      <div class="modal warn" role="dialog" aria-modal="true">
        <div class="badge-ico">${icon('alert', 34)}</div>
        <h3>มีคำขอนี้อยู่ในระบบแล้ว</h3>
        <p class="muted">คำขอลักษณะเดียวกันของท่านอยู่ระหว่างดำเนินการ ไม่จำเป็นต้องยื่นซ้ำ</p>
        <div class="no"><b>${esc(appNo)}</b></div>
        <div class="btns">
          <a class="btn btn-primary btn-lg" href="track.html?app_no=${encodeURIComponent(appNo)}">${icon('search', 18)} ดูสถานะคำขอนี้</a>
          <button class="btn btn-ghost" type="button" id="mClose">ปิด</button>
        </div>
      </div>`);
    $('#mClose', o).addEventListener('click', () => o.remove());
  }

  /* ---------- prefill from ?renew= (ลิงก์จากหน้าติดตามสถานะ) ---------- */
  const qs = new URLSearchParams(location.search);
  if (qs.get('renew')) {
    form.querySelector('input[value=RENEW]').checked = true;
    $('#old_license_no').value = qs.get('renew');
    syncType();
    setTimeout(() => $('#formCard').scrollIntoView({ behavior: 'smooth' }), 300);
  }

  syncType();
  go(1, false);
})();

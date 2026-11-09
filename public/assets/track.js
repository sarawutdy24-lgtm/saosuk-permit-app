(function () {
  const { C, icon, esc, $, $$, api, post, toast, fmtDate, fmtTime, daysUntil, STATUS, badge, typeBadge } = UI;
  UI.mountLayout('track');
  $('#btnSearch').innerHTML = icon('search', 18) + ' ค้นหา';

  const box = $('#results');
  const actor = { applicant: 'ผู้ยื่นคำขอ', officer: 'เจ้าหน้าที่', system: 'ระบบ' };

  function progress(item) {
    const st = item.status;
    // ขั้นตอน: ยื่นคำขอ → ตรวจสอบ → ผลการพิจารณา
    const third = st === 'APPROVED' ? ['done', 'อนุมัติแล้ว']
      : st === 'REJECTED' ? ['bad', 'ไม่อนุมัติ']
      : st === 'ACTION_REQUIRED' ? ['warn', 'ต้องแก้ไขเอกสาร']
      : ['', 'ผลการพิจารณา'];
    const mid = st === 'PENDING' ? 'cur' : 'done';
    return `<div class="progress" aria-label="ความคืบหน้า">
      <div class="p done">ยื่นคำขอแล้ว</div>
      <div class="p ${mid}${st === 'PENDING' ? '' : ''}">ตรวจสอบเอกสาร</div>
      <div class="p ${third[0]}">${third[1]}</div>
    </div>`;
  }

  function message(item) {
    const st = item.status;
    if (st === 'APPROVED') {
      const left = daysUntil(item.expires_at);
      let warn = '';
      if (left !== null && left < 0) warn = `<div class="callout bad">${icon('alert', 20)}<div><b>ใบอนุญาตหมดอายุแล้ว</b> เมื่อวันที่ ${fmtDate(item.expires_at)} — <a href="index.html?renew=${encodeURIComponent(item.license_no || '')}">ยื่นคำขอต่ออายุ</a></div></div>`;
      else if (left !== null && left <= C.expireWarnDays) warn = `<div class="callout warn">${icon('clock', 20)}<div><b>ใบอนุญาตจะหมดอายุในอีก ${left} วัน</b> (${fmtDate(item.expires_at)}) — <a href="index.html?renew=${encodeURIComponent(item.license_no || '')}">ยื่นคำขอต่ออายุ</a></div></div>`;
      return `<div class="callout ok">${icon('shield', 20)}<div><b>คำขอได้รับการอนุมัติแล้ว</b><br>กรุณาติดต่อรับใบอนุญาตที่ ${esc(C.dept)} ${esc(C.orgShort)}${C.officeHours ? ' (' + esc(C.officeHours) + ')' : ''}</div></div>${warn}`;
    }
    if (st === 'REJECTED') return `<div class="callout bad">${icon('x', 20)}<div><b>คำขอไม่ได้รับการอนุมัติ</b><br>โปรดดูเหตุผลจากเจ้าหน้าที่ด้านล่าง หากมีข้อสงสัยโปรดติดต่อเจ้าหน้าที่</div></div>`;
    if (st === 'ACTION_REQUIRED') return `<div class="callout act">${icon('alert', 20)}<div><b>เจ้าหน้าที่ขอให้แก้ไข/ส่งเอกสารเพิ่มเติม</b><br>โปรดดูรายละเอียดด้านล่าง แล้วกดปุ่ม "ส่งเอกสารเพิ่มเติม"</div></div>`;
    return `<div class="callout warn">${icon('clock', 20)}<div><b>อยู่ระหว่างการตรวจสอบ</b><br>เจ้าหน้าที่กำลังตรวจสอบคำขอของท่าน โปรดกลับมาตรวจสอบสถานะอีกครั้งภายหลัง</div></div>`;
  }

  function card(item, i) {
    const m = STATUS[item.status] || { t: 't-amber' };
    const timeline = (item.history || []).map((h) => {
      const hm = STATUS[h.status] || { t: 't-amber', label: h.status };
      const title = h.actor === 'applicant' && h.status === 'PENDING' ? 'ผู้ยื่นส่งคำขอ / เอกสาร' : hm.label;
      return `<li class="${hm.t}">
        <span class="dot"></span>
        <div class="t-head"><span class="t-title" style="color:var(--ink)">${esc(title)}</span><span class="t-time">${esc(fmtTime(h.created_at))}</span></div>
        <div class="muted small">โดย ${actor[h.actor] || 'เจ้าหน้าที่'}</div>
        ${h.remark ? `<div class="t-note">${esc(h.remark)}</div>` : ''}
      </li>`;
    }).reverse().join('');

    const lic = item.status === 'APPROVED' && item.license_no ? `
      <div class="kv" style="background:var(--ok-bg);padding:14px 16px;border-radius:12px">
        <dt>เลขที่ใบอนุญาต</dt><dd><b>${esc(item.license_no)}</b></dd>
        <dt>วันที่อนุมัติ</dt><dd>${fmtDate(item.approved_at)}</dd>
        <dt>หมดอายุ</dt><dd>${fmtDate(item.expires_at)}</dd>
      </div>` : '';

    const resub = item.status === 'ACTION_REQUIRED' ? `
      <div class="resubmit" data-app="${esc(item.app_no)}">
        <h4>${icon('upload', 18)} ส่งเอกสารเพิ่มเติม</h4>
        <div class="field"><span class="lbl">แนบไฟล์เอกสารที่แก้ไขแล้ว</span><div class="r-up">${UI.dropHtml()}</div></div>
        <div class="field"><label>หรือแนบเป็นลิงก์ (ถ้ามี เช่น Google Drive)</label><input class="input r-url" type="url" placeholder="https://drive.google.com/..."></div>
        <div class="field"><label>ข้อความถึงเจ้าหน้าที่ (ถ้ามี)</label><textarea class="textarea r-note" rows="2" maxlength="400" placeholder="เช่น แนบสำเนาทะเบียนบ้านฉบับชัดเจนแล้ว"></textarea></div>
        <div class="field" style="margin-bottom:12px"><label>ยืนยันตัวตนด้วยเบอร์โทรศัพท์ที่ใช้ยื่นคำขอ <span class="req">*</span></label><input class="input r-phone" type="tel" inputmode="tel" placeholder="08x-xxx-xxxx"><div class="err">กรุณากรอกเบอร์โทรศัพท์</div></div>
        <button class="btn btn-primary r-send" type="button">${icon('check', 18)} ส่งให้เจ้าหน้าที่ตรวจสอบอีกครั้ง</button>
      </div>` : '';

    return `<article class="card result">
      <div class="top">
        <div><div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">${typeBadge(item.app_type)}</div><div class="app-no">${esc(item.app_no)}</div></div>
        ${badge(item.status)}
      </div>
      ${progress(item)}
      ${message(item)}
      ${lic}
      <dl class="kv">
        <dt>ผู้ยื่นคำขอ</dt><dd>${esc(item.applicant_name)}</dd>
        <dt>สถานประกอบการ</dt><dd>${esc(item.business_name)}</dd>
        <dt>ประเภทกิจการ</dt><dd>${esc(item.business_type)}</dd>
        <dt>วันที่ยื่น</dt><dd>${esc(fmtTime(item.created_at))}</dd>
      </dl>
      ${item.officer_remark && item.status !== 'APPROVED' ? `<div class="callout ${item.status === 'REJECTED' ? 'bad' : 'act'}">${icon('doc', 20)}<div><b>หมายเหตุจากเจ้าหน้าที่</b><br>${esc(item.officer_remark)}</div></div>` : ''}
      ${resub}
      ${timeline ? `<h4 style="margin:6px 0 14px;font-size:15px">ประวัติการดำเนินการ</h4><ul class="timeline">${timeline}</ul>` : ''}
    </article>`;
  }

  async function search(q) {
    q = q.trim();
    if (!q) { $('#q').focus(); return toast('กรุณากรอกคำค้นหา', 'err'); }
    box.innerHTML = '<div class="card result"><div class="skeleton" style="height:26px;width:40%;margin-bottom:14px"></div><div class="skeleton" style="height:14px;margin-bottom:10px"></div><div class="skeleton" style="height:14px;width:80%"></div></div>';
    try {
      const r = await api('/api/tracking?q=' + encodeURIComponent(q));
      if (!r.results.length) {
        box.innerHTML = `<div class="card result empty"><div class="ico">${icon('search', 26)}</div><b style="color:var(--ink)">ไม่พบข้อมูลคำขอ</b><p class="small" style="margin-top:4px">โปรดตรวจสอบเลขที่คำขอ เบอร์โทรศัพท์ หรือเลขบัตรประชาชนอีกครั้ง</p></div>`;
        return;
      }
      box.innerHTML = r.results.map(card).join('');
      bindResubmit();
      history.replaceState(null, '', '?app_no=' + encodeURIComponent(q));
    } catch (e) {
      box.innerHTML = `<div class="card result"><div class="callout bad" style="margin:0">${icon('alert', 20)}<div>${esc(e.message)}</div></div></div>`;
    }
  }

  function bindResubmit() {
    $$('.resubmit').forEach((r) => {
      const up = UI.makeUploader($('.r-up', r), { max: 5 });
      $('.r-send', r).addEventListener('click', async (ev) => {
        const phone = $('.r-phone', r).value.trim();
        const f = $('.r-phone', r).closest('.field');
        f.classList.toggle('invalid', !phone);
        if (!phone) return;
        if (up.busy) return toast('กรุณารอให้อัปโหลดไฟล์เสร็จก่อน', 'err');
        const btn = ev.currentTarget;
        btn.disabled = true; const old = btn.innerHTML; btn.innerHTML = '<span class="spinner"></span> กำลังส่ง…';
        try {
          await post('/api/resubmit', { app_no: r.dataset.app, phone, doc_url: $('.r-url', r).value.trim(), note: $('.r-note', r).value.trim(), files: up.keys });
          toast('ส่งเอกสารเพิ่มเติมเรียบร้อยแล้ว');
          search(r.dataset.app);
        } catch (e) {
          toast(e.message, 'err');
          btn.disabled = false; btn.innerHTML = old;
        }
      });
    });
  }

  $('#searchForm').addEventListener('submit', (e) => { e.preventDefault(); search($('#q').value); });

  const pre = new URLSearchParams(location.search).get('app_no');
  if (pre) { $('#q').value = pre; search(pre); }
})();

/* ---------- Tab: Kelola TP (gaya spreadsheet: baris & kotak, tempel dari Excel) ---------- */
const parseTSV = txt => {            // TSV ala Excel/Sheets, mendukung sel ber-kutip yang berisi baris baru
  const rows = []; let row = [], cell = '', q = false;
  const s = String(txt).replace(/\r\n?/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"' && cell === '') q = true;
    else if (c === '\t') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  while (rows.length && rows[rows.length - 1].every(x => !String(x).trim())) rows.pop();
  return rows;
};

async function tabKelolaTp(tb) {
  const d = await call('getTpList', St.mk), items = d.items.slice().sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
  tb.innerHTML = `<div class="note info" style="margin-bottom:14px">${ic('info')}<div>TP berlaku untuk <b>${h(d.mk.nama_mapel)} Fase ${h(d.mk.fase)}</b> (dipakai semua kelas fase ini). Tulis frasa kompetensi diawali <i>kata kerja</i>, <b>huruf kecil</b>, <b>tanpa titik</b>, 30–120 karakter. <b>Tips:</b> salin banyak baris dari Excel/Word, klik sebuah kotak, lalu <kbd>Ctrl</kbd>+<kbd>V</kbd> — baris baru dibuat otomatis (dua kolom = Kode &amp; Deskripsi). TP lama tidak dihapus, hanya dinonaktifkan.</div></div>
  <div class="card"><div class="pad row"><b>Daftar Tujuan Pembelajaran</b><span class="chip" id="tpN"></span><span class="sp"></span><button class="btn" id="tpAdd">${ic('plus', 16)} Tambah baris</button><button class="btn pri" id="tpSave" disabled>${ic('check', 16)} Simpan semua</button></div>
  <div class="tw"><table class="tpg"><thead><tr><th class="c" style="width:48px">No</th><th style="width:120px">Kode</th><th>Deskripsi (frasa kompetensi)</th><th class="c" style="width:70px">Aktif</th><th class="c" style="width:74px">Huruf</th><th style="width:40px"></th></tr></thead><tbody id="tpB"></tbody></table></div></div>`;
  const B = $('#tpB');
  const grow = t => { t.style.height = 'auto'; t.style.height = Math.max(40, t.scrollHeight) + 'px'; };
  const trs = () => $$('tr', B);
  const rec = tr => ({ id_tp: tr.dataset.id || '', kode_tp: $('.tk', tr).value.trim(), deskripsi_tp: $('.td', tr).value.trim(), aktif: $('.ta', tr).checked });
  const same = tr => { const o = d.items.find(i => i.id_tp === tr.dataset.id); return !!o && o.kode_tp === rec(tr).kode_tp && o.deskripsi_tp === rec(tr).deskripsi_tp && o.aktif === rec(tr).aktif; };
  const refresh = () => {
    let n = 0, dirty = 0, bad = 0;
    trs().forEach(tr => {
      const r = rec(tr), empty = !r.kode_tp && !r.deskripsi_tp, len = r.deskripsi_tp.length;
      const ng = !empty && (len < 30 || len > 120 || /\.$/.test(r.deskripsi_tp));
      const dr = tr.dataset.id ? !same(tr) : !empty;
      if (!empty) n++; if (dr) dirty++; if (ng && dr) bad++;
      tr.classList.toggle('dirty', dr); tr.classList.toggle('off', !r.aktif && !!tr.dataset.id);
      const c = $('.tc', tr); c.textContent = empty ? '' : len; c.classList.toggle('bad', ng);
      $('.tn', tr).textContent = empty ? '' : n;
    });
    $('#tpN').textContent = `${trs().filter(tr => $('.ta', tr).checked && (rec(tr).deskripsi_tp || tr.dataset.id)).length} aktif`;
    $('#tpSave').disabled = !dirty; $('#tpSave').innerHTML = `${ic('check', 16)} Simpan ${dirty ? dirty + ' perubahan' : 'semua'}`;
  };
  const mkRow = (t, focus) => {
    const tr = document.createElement('tr'); if (t) tr.dataset.id = t.id_tp;
    tr.innerHTML = `<td class="c tn muted"></td><td><input class="inp tk" placeholder="otomatis" value="${h(t ? t.kode_tp : '')}" spellcheck="false"></td><td><textarea class="inp td" rows="1" placeholder="menganalisis struktur teks prosedur" spellcheck="false">${h(t ? t.deskripsi_tp : '')}</textarea></td><td class="c"><input type="checkbox" class="ta" ${!t || t.aktif ? 'checked' : ''}></td><td class="c tc small"></td><td>${t ? '' : `<button class="btn sm ghost tx" title="Hapus baris" aria-label="Hapus baris">${ic('x', 14)}</button>`}</td>`;
    B.appendChild(tr);
    const td = $('.td', tr); grow(td);
    tr.addEventListener('input', e => { if (e.target === td) grow(td); refresh(); });
    tr.addEventListener('change', refresh);
    const x = $('.tx', tr); if (x) x.onclick = () => { tr.remove(); refresh(); };
    tr.addEventListener('paste', e => {
      const txt = (e.clipboardData || window.clipboardData).getData('text'); if (!/[\t\n]/.test(txt.trim())) return;   // satu sel biasa: biarkan default
      const tgt = e.target; if (!tgt.classList.contains('tk') && !tgt.classList.contains('td')) return;
      e.preventDefault();
      const data = parseTSV(txt); if (!data.length) return;
      let col = tgt.classList.contains('tk') ? 0 : 1, cur = tr, wide = data.some(r => r.length > 1);
      data.forEach((cells, i) => {
        if (i > 0) { cur = cur.nextElementSibling && !cur.nextElementSibling.dataset.id ? cur.nextElementSibling : mkRow(null); }
        if (cur.dataset.id && i > 0) cur = mkRow(null);
        const vals = wide ? cells : (col === 0 ? [cells[0]] : [cells[0]]);
        vals.forEach((v, k) => { const f = wide ? (col + k <= 1 ? (col + k === 0 ? $('.tk', cur) : $('.td', cur)) : null) : (col === 0 ? $('.tk', cur) : $('.td', cur)); if (f) { f.value = String(v).replace(/\s*\n\s*/g, ' ').trim(); if (f.tagName === 'TEXTAREA') grow(f); } });
      });
      refresh(); toast(`<b>${data.length} baris</b> ditempel. Periksa lalu klik <b>Simpan</b>.`);
    });
    if (focus) td.focus();
    return tr;
  };
  items.forEach(t => mkRow(t)); mkRow(null); refresh();
  $('#tpAdd').onclick = () => { mkRow(null, true); refresh(); };
  $('#tpSave').onclick = async e => {
    const b = e.currentTarget; let seq = 0; const payload = [];
    trs().forEach(tr => { const r = rec(tr); if (!tr.dataset.id && !r.kode_tp && !r.deskripsi_tp) return; r.urutan = ++seq; payload.push(r); });
    b.disabled = true;
    try { const r = await call('saveTpBatch', St.mk, payload); toast(`<b>TP tersimpan:</b> ${r.added} baru, ${r.updated} diubah.`); if (r.warnings && r.warnings.length) toast(r.warnings.map(h).join('<br>'), 'warn', 8000); await drawTab(); }
    catch (er) { modal({ title: 'TP belum tersimpan', ok: '', cancel: 'Tutup', body: `<div class="note bad">${ic('warn')}<div style="white-space:pre-line">${h(er.message)}</div></div>` }); b.disabled = false; }
  };
}

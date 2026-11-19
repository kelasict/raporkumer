/* ---------- Pengaturan cetak (logo kiri/kanan, gambar latar) ---------- */
let cetakSet = null;
const getCetakSet = async force => (!force && cetakSet) || (cetakSet = await call('getCetakSetting'));
const F4 = { w: 215, h: 330 };                       // kertas F4 / Folio (mm)
const bgTag = () => cetakSet && cetakSet.latar ? `<img class="bgimg" alt="" src="${cetakSet.latar}" style="opacity:${(+cetakSet.latar_opacity || 12) / 100}">` : '';
function kopHtml(title, lines, small) {
  const c = cetakSet || {}, lg = (+c.logo_ukuran || 22) + 'mm', any = c.logo_kiri || c.logo_kanan;
  const im = src => src ? `<img src="${src}" alt="" style="max-width:${lg};max-height:${lg}">` : '';
  return `<div class="kop" style="--lg:${any ? lg : '0mm'}"><div class="kl">${im(c.logo_kiri)}</div><div class="kc"><div class="k1">${h(title)}</div>${lines}</div><div class="kr">${im(c.logo_kanan)}</div></div>`;
}

/** Perkecil gambar di browser agar muat di sel Spreadsheet (maks. `maxLen` karakter data-URL). */
function shrinkImage(file, startPx, maxLen) {
  return new Promise((res, rej) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return rej(new Error('File harus gambar PNG, JPG, atau WEBP.'));
    const u = URL.createObjectURL(file), im = new Image();
    im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Gambar tidak dapat dibaca.')); };
    im.onload = () => {
      URL.revokeObjectURL(u);
      let px = startPx, q = .85;
      for (let i = 0; i < 14; i++) {
        const sc = Math.min(1, px / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.width * sc)); c.height = Math.max(1, Math.round(im.height * sc));
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        let out = c.toDataURL('image/webp', q); if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/png');   // webp menjaga transparansi
        if (out.length <= maxLen) return res(out);
        px = Math.round(px * .8); q = Math.max(.5, q - .06);
      }
      rej(new Error('Gambar terlalu detail. Gunakan gambar yang lebih sederhana/kecil.'));
    };
    im.src = u;
  });
}

async function cetakSettingModal(after) {
  const c = await getCetakSet(), v = { logo_kiri: c.logo_kiri, logo_kanan: c.logo_kanan, latar: c.latar }, ch = {};
  const box = (k, lab, hint) => `<div style="flex:1;min-width:190px"><label class="f">${lab}</label><div class="imgbox" id="ib_${k}"></div><div class="row" style="margin-top:8px"><button class="btn sm" data-up="${k}">${ic('plus', 14)} Pilih gambar</button><button class="btn sm ghost" data-del="${k}">Hapus</button></div><div class="small muted" style="margin-top:4px">${hint}</div></div>`;
  modal({
    title: 'Pengaturan cetak rapor', wide: true,
    body: `<div class="row" style="align-items:flex-start;gap:16px">${box('logo_kiri', 'Logo kiri', 'Mis. logo yayasan/sekolah')}${box('logo_kanan', 'Logo kanan', 'Mis. logo Tut Wuri Handayani')}${box('latar', 'Gambar latar (transparan)', 'Tampil samar di belakang isi rapor')}</div>
      <label class="f">Ukuran logo: <b id="lgV">${c.logo_ukuran}</b> mm</label><input type="range" id="lgR" min="10" max="40" value="${c.logo_ukuran}" style="width:100%">
      <label class="f">Kepekatan gambar latar: <b id="opV">${c.latar_opacity}</b>%</label><input type="range" id="opR" min="3" max="40" value="${c.latar_opacity}" style="width:100%">
      <div class="small muted" style="margin-top:8px">Kertas: F4 (215 × 330 mm). Saat mencetak, pilih ukuran kertas <b>F4 / Folio</b> dan hilangkan centang "Header dan footer" bila ada. Gambar diperkecil otomatis.</div>`,
    ok: 'Simpan',
    onOk: async () => {
      try {
        const rec = { logo_ukuran: $('#lgR').value, latar_opacity: $('#opR').value }; Object.keys(ch).forEach(k => rec[k] = v[k] || '');
        await call('saveCetakSetting', rec); await getCetakSet(true); toast('<b>Pengaturan cetak tersimpan.</b>'); if (after) after();
      } catch (e) { failToast(e); return false; }
    }
  });
  const paint = k => { $('#ib_' + k).innerHTML = v[k] ? `<img src="${v[k]}" alt="">` : '<span class="muted small">Belum ada</span>'; };
  ['logo_kiri', 'logo_kanan', 'latar'].forEach(paint);
  $('#lgR').oninput = e => $('#lgV').textContent = e.target.value; $('#opR').oninput = e => $('#opV').textContent = e.target.value;
  $$('[data-del]').forEach(b => b.onclick = () => { v[b.dataset.del] = ''; ch[b.dataset.del] = 1; paint(b.dataset.del); });
  $$('[data-up]').forEach(b => b.onclick = () => {
    const k = b.dataset.up, i = document.createElement('input'); i.type = 'file'; i.accept = 'image/png,image/jpeg,image/webp';
    i.onchange = async () => { if (!i.files[0]) return; try { v[k] = await shrinkImage(i.files[0], k === 'latar' ? 900 : 300, k === 'latar' ? 150000 : 75000); ch[k] = 1; paint(k); } catch (e) { failToast(e); } };
    i.click();
  });
}

/* ---------- Pratinjau (kertas F4) dengan panah antar-siswa ---------- */
function openPreview(title, sheets, o = {}) {
  closePreview();
  const land = !!o.landscape, nav = o.nav;
  let st = $('#pgStyle'); if (!st) { st = document.createElement('style'); st.id = 'pgStyle'; document.head.appendChild(st); }
  st.textContent = `@page{size:${land ? F4.h + 'mm ' + F4.w : F4.w + 'mm ' + F4.h}mm;margin:10mm 12mm}`;
  const root = document.createElement('div'); root.id = 'pvRoot'; root.className = 'pv';
  root.innerHTML = `<div class="pv-bar">${nav ? `<button class="btn" id="pvPrev" title="Sebelumnya (←)" aria-label="Siswa sebelumnya">${ic('arrow', 16).replace('<svg', '<svg style="transform:scaleX(-1)"')}</button><button class="btn" id="pvNext" title="Berikutnya (→)" aria-label="Siswa berikutnya">${ic('arrow', 16)}</button>` : ''}<b id="pvTtl">${h(title)}</b><span class="chip" id="pvCnt"></span><span class="sp"></span><button class="btn" id="pvClose">Tutup</button><button class="btn warn" id="pvPrint">${ic('book', 16)} Cetak / Simpan PDF</button></div><div class="pv-body ${land ? 'land' : ''}" id="pvBody">${sheets || ''}</div>`;
  document.body.appendChild(root); document.body.classList.add('pv-open');
  $('#pvClose').onclick = closePreview; $('#pvPrint').onclick = () => window.print();
  if (nav) {
    let i = nav.i || 0;
    const show = () => { const r = nav.render(i); $('#pvTtl').textContent = r.title; $('#pvBody').innerHTML = r.html; $('#pvBody').scrollTop = 0; $('#pvCnt').textContent = `${i + 1} / ${nav.n}`; $('#pvPrev').disabled = i <= 0; $('#pvNext').disabled = i >= nav.n - 1; };
    const step = dlt => { const j = i + dlt; if (j >= 0 && j < nav.n) { i = j; show(); } };
    $('#pvPrev').onclick = () => step(-1); $('#pvNext').onclick = () => step(1);
    root._key = e => { if (e.target.closest && e.target.closest('input,textarea,select')) return; if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1); };
    document.addEventListener('keydown', root._key); show();
  }
}
function closePreview() { const r = $('#pvRoot'); if (r) { if (r._key) document.removeEventListener('keydown', r._key); r.remove(); } document.body.classList.remove('pv-open'); }

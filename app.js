
/* ==========================================================================
   Util
   ========================================================================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const IC = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h2M14 11h2M8 15h2M14 15h2M8 19h2M14 19h2"/>',
  spark: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.8c2 .6 3.3 2.4 3.5 5.2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  refresh: '<path d="M20 11a8 8 0 00-14.5-4M4 4v4h4M4 13a8 8 0 0014.5 4M20 20v-4h-4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  book: '<path d="M4 4h10a4 4 0 014 4v12H8a4 4 0 01-4-4z"/><path d="M4 16a4 4 0 014-4h10"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
  out: '<path d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4M16 8l4 4-4 4M20 12H9"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
};
const ic = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${IC[n] || ''}</svg>`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmt = v => v == null || v === '' ? '–' : (Number.isInteger(+v) ? v : (+v).toFixed(2));

function toast(msg, type = 'ok', ms = 4800) {
  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'ok' ? '' : type);
  el.innerHTML = `<span>${ic(type === 'bad' ? 'warn' : 'check', 20)}</span><div>${msg}</div>`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = 0; el.style.transition = '.3s'; setTimeout(() => el.remove(), 300); }, ms);
}

function modal({ title, body, ok = 'Simpan', cancel = 'Batal', danger = false, onOk, wide }) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="mback"><div class="modal" ${wide ? 'style="width:min(720px,100%)"' : ''}><header><h3>${title}</h3><button class="btn sm" data-x>${ic('x', 16)}</button></header><div class="body">${body}</div><footer>${cancel ? `<button class="btn" data-x>${cancel}</button>` : ''}${ok ? `<button class="btn ${danger ? 'danger' : 'pri'}" id="mok">${ok}</button>` : ''}</footer></div></div>`;
  const close = () => root.innerHTML = '';
  $$('[data-x]', root).forEach(b => b.onclick = close);
  $('.mback', root).addEventListener('mousedown', e => { if (e.target.classList.contains('mback')) close(); });
  const okb = $('#mok');
  if (okb) okb.onclick = async () => {
    okb.disabled = true;
    try { const r = await onOk(); if (r !== false) close(); } finally { okb.disabled = false; }
  };
  return { close, root };
}

/* Cache sisi-klien: daftar tugas & ringkasan beranda dipakai ulang agar berpindah menu terasa instan. */
let asgCache = null, homeCache = null;
const ASG_TTL = 45000, WRITE_FN = /^(save|set|import|add|delete|muat|generate|override|reset|finalisasi|bukaKunci|refresh|pasang)/;
const getAsg = async force => {
  if (!force && asgCache && Date.now() - asgCache.t < ASG_TTL) return asgCache.d;
  const d = await call('getAssignments'); asgCache = { d, t: Date.now() }; return d;
};
const applyBoot = b => { if (!b) return; const t = Date.now(); if (b.asg && b.asg.ok) asgCache = { d: b.asg, t }; if (b.beranda && b.beranda.ok) homeCache = { d: b.beranda, t }; };
async function call(fn, ...args) {
  try {
    if (WRITE_FN.test(fn)) { asgCache = null; homeCache = null; }
    const r = await api[fn](...args);
    if (r && r.ok === false) { throw Object.assign(new Error(r.error || 'Terjadi kesalahan.'), { data: r }); }
    return r;
  } catch (e) { throw e; }
}
const failToast = e => toast(h(e.message || e), 'bad', 7000);

/* ==========================================================================
   Adapter API: Apps Script (google.script.run) atau Demo (browser)
   ========================================================================== */
const IS_GAS = typeof google !== 'undefined' && google.script && google.script.run;
const PUBLIC_FN = ['getPublicInfo', 'login', 'setupConnect'];
const TOK = {
  get() { try { return sessionStorage.getItem('rapor_tok') || ''; } catch (e) { return window.__tok || ''; } },
  set(v) { try { v ? sessionStorage.setItem('rapor_tok', v) : sessionStorage.removeItem('rapor_tok'); } catch (e) { window.__tok = v; } }
};
/* Alamat Web App Google (untuk frontend di GitHub Pages): config.js, ?api=..., atau disimpan di browser */
const REMOTE = (() => {
  try { const q = new URLSearchParams(location.search).get('api'); if (q) { localStorage.setItem('rapor_api', q); history.replaceState(null, '', location.pathname); } } catch (e) { }
  let u = ''; try { u = localStorage.getItem('rapor_api') || ''; } catch (e) { }
  return (u || window.RAPOR_API_URL || '').trim();
})();
const rawCall = (name, args) => IS_GAS
  ? new Promise((res, rej) => google.script.run.withSuccessHandler(res).withFailureHandler(e => rej(new Error(e && e.message ? e.message : String(e))))[name](...args))
  : REMOTE
    ? fetch(REMOTE, { method: 'POST', body: JSON.stringify({ name, args }) })
        .then(r => r.json(), () => { throw new Error('Tidak dapat terhubung ke Google Script. Periksa alamat Web App dan pastikan akses "Siapa saja".'); })
    : sleep(120).then(() => { try { return GASDEMO.call(name, args); } catch (e) { return { ok: false, error: e.message }; } });
const rawRpc = (fn, args = []) => rawCall('rpc', [TOK.get(), fn, args]);
let expiring = false;
function sessionExpired(msg) {
  if (expiring) return; expiring = true; setTimeout(() => expiring = false, 800);
  TOK.set(''); closePreview(); $('#modalRoot').innerHTML = '';
  showLogin({ sekolah: St.school || '', info: msg || 'Sesi berakhir. Silakan masuk kembali.' });
}
const api = new Proxy({}, {
  get: (_, fn) => (...args) => PUBLIC_FN.includes(fn) ? rawCall(fn, args)
    : rawRpc(fn, args).then(r => { if (r && r.expired) sessionExpired(r.error); return r; })
});

/* ==========================================================================
   STATE & ROUTER
   ========================================================================== */
const St = { sess: null, view: 'home', mk: null, tab: 'tp', mode: 'nilai', kelas: null, mEnt: 'siswa', mList: ['siswa'], meta: null, school: '' };
const setTitle = t => { $('#ttl').textContent = t; };
const drawAdmin = () => go(St.view);
$('#pwBtn').innerHTML = ic('key', 20); $('#logoutBtn').innerHTML = ic('out', 20); $('#burger').innerHTML = ic('menu', 22); $('#promoI').innerHTML = ic('pen', 24);
$('#burger').onclick = () => document.body.classList.toggle('nav-open');
$('#promoB').onclick = () => { document.body.classList.remove('nav-open'); go('nilai'); };
document.addEventListener('click', e => { if (document.body.classList.contains('nav-open') && !e.target.closest('#side,#burger')) document.body.classList.remove('nav-open'); });

async function go(v, o = {}) {
  closePreview();
  St.view = v; Object.assign(St, o);
  drawNav(v);
  const el = $('#view'); el.classList.remove('view-in'); void el.offsetWidth; el.classList.add('view-in');
  el.innerHTML = v === 'home' ? '<div class="sk3"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>' : '<div class="grid"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>';
  window.scrollTo(0, 0);
  const V = { home: viewHome, sekolah: viewSekolah, master: viewMaster, tp: () => viewTool('tp'), nilai: () => viewTool('nilai'), capaian: () => viewTool('capaian'), leger: viewLeger, datarapor: viewDataRapor, cetak: viewCetak, final: viewRekap, setting: viewSetting, status: viewStatus, akun: viewAkun, editor: viewEditor, about: viewAbout }[v];
  const my = St._n = (St._n || 0) + 1;                       // abaikan hasil/galat dari halaman yang sudah ditinggalkan
  try { await V(); } catch (e) { if (my !== St._n) return; el.innerHTML = `<div class="card pad"><div class="note bad">${ic('warn')}<div>${h(e.message)}</div></div></div>`; }
}

/* ==========================================================================
   MENU UTAMA — tombol besar berwarna
   ========================================================================== */
const MP = (list, ent) => ['master', { mList: list, mEnt: ent }];
const TILES = [
  { g: 'Data induk sekolah', id: 'sekolah', t: 'Identitas Sekolah', s: 'Nama, alamat, kepala sekolah', ic: 'home', c: 'red', r: ['admin'] },
  { id: 'murid', t: 'Data Murid', s: 'Daftar siswa & kelasnya', ic: 'users', c: 'lime', r: ['admin'], go: MP(['siswa'], 'siswa') },
  { id: 'kelas', t: 'Data Kelas', s: 'Kelas, fase, wali kelas', ic: 'list', c: 'orange', r: ['admin'], go: MP(['kelas'], 'kelas') },
  { id: 'akun', t: 'Akun Guru & Admin', s: 'Username, password, peran', ic: 'users', c: 'sky', r: ['admin'] },
  { id: 'mapel', t: 'Mata Pelajaran', s: 'Daftar mapel & kodenya', ic: 'book', c: 'purple', r: ['admin'], go: MP(['mapel'], 'mapel') },
  { g: 'Penilaian', id: 'tp', t: 'Tujuan Pembelajaran', s: 'Isi TP setiap mapel', ic: 'list', c: 'amber', r: ['guru'] },
  { id: 'nilai', t: 'Input Nilai', s: 'Formatif, sumatif, PTS, SAS', ic: 'pen', c: 'magenta', r: ['guru'] },
  { id: 'capaian', t: 'Deskripsi Capaian', s: 'Tersusun otomatis dari nilai', ic: 'spark', c: 'teal', r: ['guru'] },
  { g: 'Rapor', id: 'leger', t: 'Leger Nilai', s: 'Rekap nilai satu kelas', ic: 'chart', c: 'yellow', r: ['guru'] },
  { id: 'datarapor', t: 'Data Rapor Siswa', s: 'Ekskul, kehadiran, catatan wali', ic: 'pen', c: 'lime', r: ['guru'] },
  { id: 'cetak', t: 'Cetak Rapor', s: 'Satu halaman untuk setiap siswa', ic: 'book', c: 'blue', r: ['guru'] },
  { id: 'final', t: 'Finalisasi Rapor', s: 'Kunci nilai bila sudah benar', ic: 'lock', c: 'green', r: ['guru'] },
  { g: 'Lainnya', id: 'setting', t: 'Pengaturan', s: 'Bobot nilai, KKTP, kalimat deskripsi', ic: 'shield', c: 'navy', r: ['admin'] },
  { id: 'status', t: 'Persiapan & Log', s: 'Checklist awal & riwayat', ic: 'check', c: 'sky', r: ['admin'] },
  { id: 'editor', t: 'Editor Data', s: 'Ubah isi database langsung', ic: 'pen', c: 'red', r: ['admin'] },
  { id: 'about', t: 'Panduan', s: 'Cara pakai singkat', ic: 'info', c: 'grey' }
];
(() => { let cur = ''; TILES.forEach(t => { if (t.g) cur = t.g; t._g = cur; }); })();

/* ---------- Navigasi: header pil + sub-menu ---------- */
const NAV = [
  { id: 'home', t: 'Beranda', views: ['home'] },
  { id: 'nilai', t: 'Penilaian', views: ['tp', 'nilai', 'capaian'], sub: ['tp', 'nilai', 'capaian'] },
  { id: 'rapor', t: 'Rapor', views: ['leger', 'datarapor', 'cetak', 'final'], sub: ['leger', 'datarapor', 'cetak', 'final'] },
  { id: 'admin', t: 'Admin', views: ['sekolah', 'master', 'akun', 'setting', 'status', 'editor'], sub: ['sekolah', 'murid', 'kelas', 'mapel', 'akun', 'setting', 'status', 'editor'], r: ['admin'] },
  { id: 'about', t: 'Panduan', views: ['about'] }
];
const tileOf = id => TILES.find(x => x.id === id);
const tileGo = t => t.go ? go(t.go[0], t.go[1]) : go(t.id);
function tileActive(t) { return t.go ? (St.view === 'master' && t.go[1].mList.includes(St.mEnt)) : St.view === t.id; }
const NAVIC = { home: 'home', nilai: 'pen', rapor: 'book', admin: 'shield', about: 'info' };
function drawNav(v) {
  const s = St.sess; if (!s) return;
  const items = NAV.filter(n => !n.r || n.r.some(x => s.roles.includes(x))), cur = items.find(n => n.views.includes(v));
  $('#nav').innerHTML = items.map(n => `<button data-n="${n.id}" class="${cur && cur.id === n.id ? 'on' : ''}"><span class="nb">${ic(NAVIC[n.id] || 'list', 20)}</span>${h(n.t)}</button>`).join('');
  $$('#nav button').forEach(b => b.onclick = () => { document.body.classList.remove('nav-open'); const n = items.find(x => x.id === b.dataset.n); n.sub ? tileGo(tileOf(n.sub[0])) : go(n.views[0]); });
  $('#pgh').classList.toggle('hide', v === 'home');
  const sn = $('#subnav');
  if (cur && cur.sub) {
    sn.innerHTML = cur.sub.map(id => { const t = tileOf(id); return `<button data-s="${id}">${h(t.t)}</button>`; }).join('');
    $$('#subnav button').forEach(b => { const t = tileOf(b.dataset.s); b.classList.toggle('on', tileActive(t)); b.onclick = () => tileGo(t); });
    sn.classList.remove('hide');
  } else { sn.innerHTML = ''; sn.classList.add('hide'); }
}

/* ==========================================================================
   BERANDA — dashboard bergaya kartu (ungu / oranye / lavender / gelap)
   ========================================================================== */
const pct = (a, b) => b ? Math.round(a * 100 / b) : 0;
const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;
const BUBS = ['b1', 'b2', 'b3'];

function homeStats(asg) {
  const items = asg.items || [], wali = asg.wali || [], by = {};
  items.forEach(i => { (by[i.nama_kelas] = by[i.nama_kelas] || []).push(i); });
  const wl = {}; wali.forEach(w => { wl[w.nama_kelas] = w; });
  const kelas = Object.keys(by).sort((a, b) => a.localeCompare(b, 'id', { numeric: true })).map(k => {
    const it = by[k], sis = it.reduce((x, i) => x + i.jumlah_siswa, 0), w = wl[k] || { final: 0, total: 0 };
    return { nama: k, tp: avg(it.map(i => i.progress_tp)), rapor: pct(it.reduce((x, i) => x + i.rapor_terisi, 0), sis), final: pct(w.final, w.total) };
  });
  const sisAll = items.reduce((x, i) => x + i.jumlah_siswa, 0);
  return {
    kelas, items,
    tp: avg(items.map(i => i.progress_tp)),
    rapor: pct(items.reduce((x, i) => x + i.rapor_terisi, 0), sisAll),
    fin: pct(wali.reduce((x, w) => x + w.final, 0), wali.reduce((x, w) => x + w.total, 0)),
    finN: wali.reduce((x, w) => x + w.final, 0), finT: wali.reduce((x, w) => x + w.total, 0)
  };
}

const chartHtml = (st, m) => {
  if (!st.kelas.length) return '<div class="empty small">Belum ada kelas aktif.</div>';
  return `<div class="bars">${st.kelas.map(k => `<div class="bcol" title="${h(k.nama)}: ${k[m]}%"><small>${k[m]}%</small><div class="btrack"><div class="bfill" style="height:${Math.max(k[m], 6)}%"></div></div></div>`).join('')}</div><div class="blab">${st.kelas.map(k => `<em>${h(k.nama)}</em>`).join('')}</div>`;
};
const AVA_SVG = '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#cfe3da"/><circle cx="50" cy="40" r="19" fill="#f6c9a8"/><path d="M30 38c0-14 9-22 21-22s20 8 19 22c-5-8-10-11-20-11s-15 3-20 11z" fill="#3b2f2a"/><path d="M14 100c2-22 16-34 36-34s34 12 36 34z" fill="#4f9a8c"/><circle cx="43" cy="42" r="2" fill="#3b2f2a"/><circle cx="57" cy="42" r="2" fill="#3b2f2a"/><path d="M44 50q6 5 12 0" stroke="#b5654a" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const HERO_SVG = '<svg viewBox="0 0 100 100"><rect x="14" y="22" width="72" height="50" rx="8" fill="#fff"/><rect x="20" y="28" width="60" height="38" rx="4" fill="#d3e7e0"/><path d="M28 40h30M28 48h38M28 56h22" stroke="#4f9a8c" stroke-width="4" stroke-linecap="round"/><circle cx="72" cy="42" r="7" fill="#f4bd54"/><rect x="40" y="76" width="20" height="5" rx="2.5" fill="#fff"/></svg>';
const PLANT_SVG = '<svg viewBox="0 0 80 110"><path d="M40 100V50" stroke="#5b9a8f" stroke-width="4" stroke-linecap="round"/><ellipse cx="26" cy="52" rx="16" ry="8" transform="rotate(-35 26 52)" fill="#7fb8a8"/><ellipse cx="54" cy="38" rx="16" ry="8" transform="rotate(35 54 38)" fill="#5b9a8f"/><ellipse cx="28" cy="30" rx="13" ry="7" transform="rotate(-40 28 30)" fill="#a9cfb4"/><path d="M22 100h36l-4 -14H26z" fill="#f08a6a"/></svg>';
const donutSvg = (parts) => {
  const R = 15.9155, tot = parts.reduce((x, y) => x + y.v, 0) || 1; let off = 0;
  return `<svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="${R}" fill="none" stroke="#f1e8da" stroke-width="6"/>${parts.map(p => { const l = p.v * 100 / tot, e = `<circle cx="21" cy="21" r="${R}" fill="none" stroke="${p.c}" stroke-width="6" stroke-dasharray="${Math.max(l - 0.8, 0)} ${100 - Math.max(l - 0.8, 0)}" stroke-dashoffset="${-off}" stroke-linecap="round"/>`; off += l; return l > 0 ? e : ''; }).join('')}</svg>`;
};

function paintHome(b, asg) {
  const s = St.sess, hr = new Date().getHours(), gr = hr < 11 ? 'Selamat pagi' : hr < 15 ? 'Selamat siang' : hr < 18 ? 'Selamat sore' : 'Selamat malam';
  const st = homeStats(asg), p = b.persiapan;
  const need = st.items.filter(i => i.jumlah_tp > 0 && i.progress_tp < 100).sort((a, c) => a.progress_tp - c.progress_tp).slice(0, 5);
  const seen = {}, subj = st.items.filter(i => !seen[i.id_mapel] && (seen[i.id_mapel] = 1)).slice(0, 14);
  const vis = TILES.filter(t => !t.r || t.r.some(x => s.roles.includes(x))), groups = [];
  vis.forEach(t => { let g = groups.find(x => x.n === t._g); if (!g) groups.push(g = { n: t._g, items: [] }); g.items.push(t); });
  const M = St.dm || 'tp', MT = { tp: 'Nilai TP', rapor: 'Nilai rapor', final: 'Final' };
  const terisi = Math.max(st.rapor - st.fin, 0), belum = Math.max(100 - st.rapor, 0);
  $('#view').innerHTML = `
  ${p && !p.siap ? `<div class="alert" style="display:flex;gap:12px;align-items:center;padding:14px 18px;margin-bottom:16px">${ic('warn', 22)}<div style="flex:1"><b>Persiapan belum selesai</b> (${p.selesai} dari ${p.total} langkah). Selesaikan dulu agar guru bisa mulai input nilai.</div><button class="btn pri" data-go="status">Buka checklist</button></div>` : ''}
  <section class="hro"><div class="ph">${HERO_SVG}</div>
    <div class="tx"><span class="tag">${h(b.sekolah.nama || 'Nama sekolah belum diisi')}</span>
      <h2>${gr}, ${h(s.nama)}!</h2>
      <p>Tahun ajaran ${h(s.tahun_ajaran)} · Semester ${h(s.semester)}. Lengkapi Tujuan Pembelajaran dan nilai siswa, lalu cetak rapor dengan mudah.</p>
      <div class="hb"><button class="btn pri" data-go="nilai">${ic('pen', 16)} Input nilai</button><button class="btn" data-go="cetak">${ic('book', 16)} Cetak rapor</button></div></div>
    <div class="plant">${PLANT_SVG}</div></section>
  <div class="stats4">
    <div class="st s1"><div class="ic">${ic('users', 26)}</div><span>Siswa Aktif</span><b>${b.siswa}</b><small>${b.kelas} kelas</small></div>
    <div class="st s2"><div class="ic">${ic('book', 26)}</div><span>Mata Pelajaran</span><b>${b.mapel}</b><small>${st.items.length} pasangan kelas-mapel</small></div>
    <div class="st s3"><div class="ic">${ic('list', 26)}</div><span>Nilai TP Terisi</span><b>${st.tp}%</b><small>rata-rata semua kelas</small></div>
    <div class="st s4"><div class="ic">${ic('lock', 26)}</div><span>Rapor Final</span><b>${st.fin}%</b><small>${st.finN} dari ${st.finT}</small></div>
  </div>
  <div class="r2">
    <div class="dcard"><div class="dhd"><div><h3>Progres per Kelas</h3><div class="sub">Persentase penyelesaian</div></div>
      <div class="seg2" id="dm">${Object.keys(MT).map(k => `<button data-m="${k}" class="${k === M ? 'on' : ''}">${MT[k]}</button>`).join('')}</div></div>
      <div id="chart">${chartHtml(st, M)}</div></div>
    <div class="dcard"><div class="dhd"><div><h3>Komposisi Rapor</h3><div class="sub">Status pengisian seluruh kelas</div></div></div>
      <div class="donut"><div class="dn">${donutSvg([{ v: st.fin, c: '#5b9a8f' }, { v: terisi, c: '#f4bd54' }, { v: belum, c: '#f4a98d' }])}<div class="dc2"><b>${st.rapor}%</b><small>terisi</small></div></div>
        <div class="lgd"><div><i style="background:#5b9a8f"></i>Final<span>${st.fin}%</span></div><div><i style="background:#f4bd54"></i>Terisi<span>${terisi}%</span></div><div><i style="background:#f4a98d"></i>Belum<span>${belum}%</span></div></div></div></div>
  </div>
  <div class="r2">
    <div class="dcard"><h3>Perlu Dilengkapi</h3><div class="sub">Nilai TP paling sedikit terisi</div>
      ${need.length ? need.map((i, n) => `<button class="lrow" data-mk="${h(i.id_mapel_kelas)}"><span class="bub ${BUBS[n % 3]}">${ic('pen', 18)}</span><div><b>${h(i.nama_mapel)}</b><small>${h(i.nama_kelas)} · ${i.jumlah_siswa} siswa</small></div><span class="t">${i.progress_tp}%</span></button>`).join('')
        : `<div class="lrow" style="cursor:default"><span class="bub b3">${ic('check', 18)}</span><div><b>Semua nilai TP sudah terisi</b><small>Tidak ada yang perlu dikejar.</small></div></div>`}</div>
    <div class="dcard"><h3>Mata Pelajaran</h3><div class="sub">Klik untuk langsung input nilai</div><div class="chips2">${subj.length ? subj.map(i => `<button data-mk="${h(i.id_mapel_kelas)}">${h(i.nama_mapel)}</button>`).join('') : '<span class="muted small">Belum ada mapel aktif.</span>'}</div></div>
  </div>
  ${groups.map(g => `<div class="mgrp">${h(g.n)}</div><div class="mtiles">${g.items.map(t => `<button class="mt" data-t="${t.id}"><span class="mi">${ic(t.ic, 22)}</span><span>${h(t.t)}<small>${h(t.s)}</small></span></button>`).join('')}</div>`).join('')}`;
  $$('.mt').forEach(x => x.onclick = () => tileGo(tileOf(x.dataset.t)));
  $$('[data-go]').forEach(x => x.onclick = () => go(x.dataset.go));
  $$('[data-mk]').forEach(x => x.onclick = () => { St.mk = x.dataset.mk; go('nilai'); });
  $$('#dm button').forEach(x => x.onclick = () => { St.dm = x.dataset.m; $$('#dm button').forEach(y => y.classList.toggle('on', y === x)); $('#chart').innerHTML = chartHtml(st, St.dm); });
}

async function viewHome() {
  setTitle('Beranda');
  const cached = homeCache && asgCache;
  if (cached) {
    paintHome(homeCache.d, asgCache.d);                                    // tampil seketika dari cache
    if (Date.now() - Math.min(homeCache.t, asgCache.t) < ASG_TTL) return;
  }
  try {
    const b = await call('getBoot'); applyBoot(b);                          // satu panggilan: ringkasan + daftar tugas
    if (St.view === 'home') paintHome(b.beranda, b.asg);
  } catch (e) { if (!cached) throw e; }
}

/* ==========================================================================
   ALAT PENILAIAN: pilih kelas & mapel → isi (TP / Input Nilai / Capaian)
   ========================================================================== */
async function viewTool(kind) {
  const C = { nilai: { t: 'Input Nilai', tabs: [['tp', 'Formatif (TP)'], ['akhir', 'Sumatif, PTS & SAS']], def: 'tp' }, tp: { t: 'Tujuan Pembelajaran', def: 'kelolatp' }, capaian: { t: 'Deskripsi Capaian', def: 'cap' } }[kind];
  setTitle(C.t);
  const a = await getAsg(), items = a.items;
  if (!items.length) { $('#view').innerHTML = `<div class="card empty">Belum ada kelas atau mata pelajaran aktif.<br><span class="small">Admin menambahkannya di menu <b>Data Kelas</b> dan <b>Mata Pelajaran</b>.</span></div>`; return; }
  if (!items.some(i => i.id_mapel_kelas === St.mk)) St.mk = items[0].id_mapel_kelas;
  if (C.tabs) { if (!C.tabs.some(x => x[0] === St.tab)) St.tab = C.def; } else St.tab = C.def;
  const info = () => items.find(i => i.id_mapel_kelas === St.mk);
  $('#view').innerHTML = `<div class="card pad"><div class="row" style="align-items:flex-end"><div style="flex:1;min-width:260px"><label class="f" style="margin-top:0" for="pick">Pilih kelas & mata pelajaran</label>
    <select class="inp" id="pick">${items.map(i => `<option value="${h(i.id_mapel_kelas)}" ${i.id_mapel_kelas === St.mk ? 'selected' : ''}>${h(i.nama_kelas)} — ${h(i.nama_mapel)}</option>`).join('')}</select></div>
    ${C.tabs ? `<div class="seg" id="tabs">${C.tabs.map(x => `<button data-t="${x[0]}">${x[1]}</button>`).join('')}</div>` : ''}</div>
    <div class="row small" id="pinfo" style="margin-top:12px"></div></div><div id="tabBody" style="margin-top:14px"></div>`;
  const pinfo = () => { const i = info(); $('#pinfo').innerHTML = `<span class="chip brand">Fase ${h(i.fase)}</span><span class="chip">${i.jumlah_siswa} siswa</span><span class="chip">${i.jumlah_tp} TP</span><span class="chip ${i.progress_tp >= 100 ? 'ok' : 'warn'}">Nilai TP terisi ${i.progress_tp}%</span><span class="chip">${i.capaian} deskripsi</span>`; };
  $('#pick').onchange = e => { St.mk = e.target.value; pinfo(); drawTab(); };
  $$('#tabs button').forEach(b => b.onclick = () => { St.tab = b.dataset.t; drawTab(); });
  pinfo(); await drawTab();
}
async function drawTab() {
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === St.tab));
  const tb = $('#tabBody'); tb.innerHTML = '<div class="skel"></div>';
  try {
    if (St.tab === 'tp') await tabTp(tb); else if (St.tab === 'akhir') await tabAkhir(tb);
    else if (St.tab === 'cap') await tabCap(tb); else await tabKelolaTp(tb);
  } catch (e) { tb.innerHTML = `<div class="note bad">${ic('warn')}<div>${h(e.message)}</div></div>`; }
}

/* ==========================================================================
   IDENTITAS SEKOLAH
   ========================================================================== */
async function viewSekolah() {
  setTitle('Identitas Sekolah');
  const v = (await call('getSekolah')).values;
  const F = [['nama', 'Nama sekolah', 'SMP IT AL-KAUTSAR'], ['npsn', 'NPSN (8 digit)', '10700000'], ['nss', 'NSS', ''], ['alamat', 'Alamat (jalan)', 'Jl. Pendidikan No. 1'], ['kode_pos', 'Kode pos', ''], ['desa', 'Desa/Kelurahan', ''], ['kecamatan', 'Kecamatan', ''], ['kabupaten', 'Kabupaten/Kota', ''], ['provinsi', 'Provinsi', ''], ['website', 'Website', ''], ['email', 'Email sekolah', ''],
    ['kepala', 'Nama kepala sekolah (dengan gelar)', ''], ['nip_kepala', 'NIP / NIPY kepala sekolah', ''], ['kota_ttd', 'Kota tempat tanda tangan rapor', ''], ['tanggal_rapor', 'Tanggal pembagian rapor', '', 'date']];
  $('#view').innerHTML = `<div class="note info" style="margin-bottom:14px">${ic('info')}<div>Data ini tampil pada <b>kop</b> dan <b>tanda tangan</b> setiap rapor. Cukup diisi sekali.</div></div>
  <div class="card pad"><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:0 18px">${F.map(f => `<div><label class="f" for="sk_${f[0]}">${f[1]}${f[0] === 'nama' ? ' <span style="color:var(--bad)">*</span>' : ''}</label><input class="inp" id="sk_${f[0]}" type="${f[3] || 'text'}" value="${h(v[f[0]])}" placeholder="${h(f[2])}"></div>`).join('')}</div>
  <div id="skErr"></div><div class="row" style="margin-top:18px"><span class="sp"></span><button class="btn warn" id="skSave">${ic('check', 16)} Simpan identitas sekolah</button></div></div>`;
  $('#skSave').onclick = async e => {
    const b = e.currentTarget, rec = {}; F.forEach(f => rec[f[0]] = $('#sk_' + f[0]).value); b.disabled = true; $('#skErr').innerHTML = '';
    try { await call('saveSekolah', rec); toast('<b>Identitas sekolah tersimpan.</b>'); }
    catch (er) { $('#skErr').innerHTML = `<div class="note bad" style="margin-top:12px">${ic('warn')}<div>${h(er.message)}</div></div>`; } finally { b.disabled = false; }
  };
}

/* ==========================================================================
   Halaman pembungkus untuk fitur admin
   ========================================================================== */
const MASTER_TITLE = { siswa: 'Data Murid', anggota: 'Data Murid', kelas: 'Data Kelas', mapel: 'Mata Pelajaran' };
async function viewMaster() { setTitle(MASTER_TITLE[St.mEnt] || 'Data Master'); $('#view').innerHTML = '<div id="abody"></div>'; await adminMaster($('#abody')); }
async function viewSetting() { setTitle('Pengaturan'); $('#view').innerHTML = '<div id="abody"></div>'; await adminSettings($('#abody')); }
async function viewStatus() { setTitle('Persiapan & Log'); $('#view').innerHTML = '<div id="abody"></div>'; await adminRingkasan($('#abody')); }

/* ==========================================================================
   CETAK: pratinjau A4, leger, rapor per siswa
   ========================================================================== */
const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const tglID = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[3]} ${BLN[+m[2] - 1]} ${m[1]}` : ''; };
const smtLabel = s => String(s) === '1' ? '1 (Ganjil)' : '2 (Genap)';

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

const ROM = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'], TER = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas', 'Dua Belas', 'Tiga Belas'];
const kepTeks = (kep, t) => kep === 'Naik' ? `Naik ke kelas ${ROM[t + 1]} ( ${TER[t + 1]} )` : kep === 'Tinggal' ? `Tinggal di kelas ${ROM[t]} ( ${TER[t]} )` : kep === 'Lulus' ? 'Lulus' : '';
const pref = (p, v) => new RegExp('^(' + p.replace('.', '') + '|kelurahan|kecamatan)', 'i').test(v) ? v : p + ' ' + v;
const rnd = v => v == null ? '–' : Math.round(v);

const idnHtml = (s, k, kl) => `<table class="idn"><colgroup><col style="width:21%"><col style="width:2%"><col><col style="width:17%"><col style="width:2%"><col style="width:20%"></colgroup>
      <tr><td class="nw">Nama Peserta Didik</td><td>:</td><td><b>${h(s.nama)}</b></td><td class="nw">Kelas</td><td>:</td><td>${h(kl.nama_kelas)}</td></tr>
      <tr><td class="nw">NIS / NISN</td><td>:</td><td>${h([s.nis, s.nisn].filter(Boolean).join(' / '))}</td><td class="nw">Fase</td><td>:</td><td>${h(kl.fase)}</td></tr>
      <tr><td class="nw">Sekolah</td><td>:</td><td>${h(k.nama)}</td><td class="nw">Semester</td><td>:</td><td>${h(smtLabel(kl.semester))}</td></tr>
      <tr><td class="nw">Alamat</td><td>:</td><td>${h([k.alamat, k.desa && pref('Desa', k.desa)].filter(Boolean).join(', '))}</td><td class="nw">Tahun Pelajaran</td><td>:</td><td>${h(kl.tahun_ajaran)}</td></tr></table>`;
const alamatSekolah = k => [k.alamat, k.desa && pref('Desa', k.desa), k.kecamatan && pref('Kec.', k.kecamatan), k.kabupaten, k.provinsi, k.kode_pos].filter(Boolean).join(', ');
const kopLines = k => `<div class="k2">${h(k.nama || 'NAMA SEKOLAH')}</div><div class="k3">${[k.npsn && 'NPSN: ' + k.npsn, k.nss && 'NSS: ' + k.nss].filter(Boolean).map(h).join(' · ')}</div><div class="k3">${h(alamatSekolah(k))}</div><div class="k3">${[k.website, k.email].filter(Boolean).map(h).join(' · ')}</div>`;
const ttdHtml = (d, k) => { const tgl = [k.kota_ttd, tglID(k.tanggal_rapor)].filter(Boolean).join(', ');
  return `<div class="ttd"><div><br>Orang Tua / Wali<br><br><br><br>(..............................)</div><div>${h(tgl)}<br>Wali Kelas<br><br><br><br><b><u>${h(d.wali.nama || '..............................')}</u></b><br>${d.wali.nip ? 'NIP. ' + h(d.wali.nip) : ''}</div>
      <div class="ctr">Mengetahui,<br>Kepala Sekolah<br><br><br><br><b><u>${h(k.kepala || '..............................')}</u></b><br>${k.nip_kepala ? 'NIP/NIPY. ' + h(k.nip_kepala) : ''}</div></div>`; };
const hadirHtml = x => `<div class="r2"><table class="rp" style="width:42%"><thead><tr><th colspan="2">Ketidakhadiran</th></tr></thead><tbody><tr><td>Sakit</td><td class="c">${x.sakit || 0} hari</td></tr><tr><td>Izin</td><td class="c">${x.izin || 0} hari</td></tr><tr><td>Tanpa Keterangan</td><td class="c">${x.alpa || 0} hari</td></tr></tbody></table>
      <div class="ctt" style="flex:1;margin:0"><b>Catatan Wali Kelas:</b><br>${h(x.catatan_wali || '')}</div></div>`;

/** Rapor PTS (Penilaian Tengah Semester): No, Mata Pelajaran, Nilai PTS, Terlampaui/Belum Terlampaui. */
function ptsSheet(d, s) {
  const k = d.sekolah, kl = d.kelas, x = s.data || {};
  const groups = []; s.items.forEach(it => { let g = groups.find(y => y.n === it.kelompok); if (!g) groups.push(g = { n: it.kelompok, rows: [] }); g.rows.push(it); });
  let no = 0;
  const ket = it => it.sts == null ? '–' : it.sts >= it.kktp ? 'Terlampaui' : 'Belum Terlampaui';
  const rows = groups.map(g => (g.n !== 'Umum' ? `<tr class="grp"><td colspan="4">${h(g.n === 'P5' ? 'Projek Penguatan Profil Pelajar Pancasila' : g.n)}</td></tr>` : '') +
    g.rows.map(it => `<tr><td class="c">${++no}</td><td>${h(it.mapel)}</td><td class="c b">${rnd(it.sts)}</td><td class="c">${ket(it)}</td></tr>`).join('')).join('');
  return `<section class="sheet">${bgTag()}<div class="in">
    ${kopHtml('LAPORAN HASIL BELAJAR PENILAIAN TENGAH SEMESTER (PTS)', kopLines(k))}
    ${idnHtml(s, k, kl)}
    <table class="rp"><thead><tr><th style="width:6%">No</th><th>Mata Pelajaran</th><th style="width:20%">Nilai PTS</th><th style="width:26%">Keterangan</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="small" style="margin-top:6px;font-size:8.5pt">Terlampaui = nilai PTS mencapai KKTP mata pelajaran; Belum Terlampaui = di bawah KKTP.</div>
    ${hadirHtml(x)}
    ${ttdHtml(d, k)}</div></section>`;
}

function raporSheet(d, s) {
  const k = d.sekolah, kl = d.kelas, x = s.data || {}, alamat = [k.alamat, k.desa && pref('Desa', k.desa), k.kecamatan && pref('Kec.', k.kecamatan), k.kabupaten, k.provinsi, k.kode_pos].filter(Boolean).join(', ');
  const groups = []; s.items.forEach(it => { let g = groups.find(y => y.n === it.kelompok); if (!g) groups.push(g = { n: it.kelompok, rows: [] }); g.rows.push(it); });
  let no = 0;
  const rows = groups.map(g => (g.n !== 'Umum' ? `<tr class="grp"><td colspan="4">${h(g.n === 'P5' ? 'Projek Penguatan Profil Pelajar Pancasila' : g.n)}</td></tr>` : '') +
    g.rows.map(it => `<tr><td class="c">${++no}</td><td>${h(it.mapel)}</td><td class="c b">${rnd(it.nilai)}</td><td class="cap">${it.deskripsi ? h(it.deskripsi) : '–'}</td></tr>`).join('')).join('');
  const eks = s.ekskul && s.ekskul.length ? s.ekskul.map((e, i) => `<tr><td class="c">${i + 1}</td><td>${h(e.nama)}</td><td class="c">${h(e.predikat)}</td><td>${h(e.ket)}</td></tr>`).join('') : `<tr><td class="c">1</td><td>–</td><td class="c">–</td><td>–</td></tr>`;
  const tgl = [k.kota_ttd, tglID(k.tanggal_rapor)].filter(Boolean).join(', ');
  const kep = kl.semester === '2' || kl.semester === 2 ? kepTeks(x.keputusan, +kl.tingkat) : '';
  return `<section class="sheet">${bgTag()}${s.final ? '' : '<div class="wm">DRAFT</div>'}<div class="in">
    ${kopHtml('LAPORAN HASIL BELAJAR (RAPOR)', kopLines(k))}
    ${idnHtml(s, k, kl)}
    <table class="rp"><thead><tr><th style="width:5%">No</th><th style="width:26%">Muatan Pelajaran</th><th style="width:11%">Nilai Akhir</th><th>Capaian Kompetensi</th></tr></thead><tbody>${rows}</tbody></table>
    <table class="rp" style="margin-top:10px"><thead><tr><th style="width:5%">No</th><th style="width:30%">Ekstrakurikuler</th><th style="width:14%">Predikat</th><th>Keterangan</th></tr></thead><tbody>${eks}</tbody></table>
    <div class="r2"><table class="rp" style="width:42%"><thead><tr><th colspan="2">Ketidakhadiran</th></tr></thead><tbody><tr><td>Sakit</td><td class="c">${x.sakit || 0} hari</td></tr><tr><td>Izin</td><td class="c">${x.izin || 0} hari</td></tr><tr><td>Tanpa Keterangan</td><td class="c">${x.alpa || 0} hari</td></tr></tbody></table>
      <div class="ctt" style="flex:1;margin:0"><b>Catatan Wali Kelas:</b><br>${h(x.catatan_wali || '')}</div></div>
    ${kep ? `<div class="ctt" style="min-height:0"><b>Keputusan:</b> Berdasarkan hasil yang dicapai pada semester 1 dan 2, peserta didik ditetapkan: <b>${h(kep)}</b></div>` : ''}
    <div class="ttd"><div><br>Orang Tua / Wali<br><br><br><br>(..............................)</div><div>${h(tgl)}<br>Wali Kelas<br><br><br><br><b><u>${h(d.wali.nama || '..............................')}</u></b><br>${d.wali.nip ? 'NIP. ' + h(d.wali.nip) : ''}</div>
      <div class="ctr">Mengetahui,<br>Kepala Sekolah<br><br><br><br><b><u>${h(k.kepala || '..............................')}</u></b><br>${k.nip_kepala ? 'NIP/NIPY. ' + h(k.nip_kepala) : ''}</div></div></div></section>`;
}

function legerSheet(d) {
  const k = d.sekolah, B = d.batas;
  return `<section class="sheet">${bgTag()}<div class="in">${kopHtml('LEGER NILAI RAPOR', `<div class="k2" style="font-size:13pt">${h(k.nama || 'NAMA SEKOLAH')}</div><div class="k3">Kelas ${h(d.kelas.nama_kelas)} · Fase ${h(d.kelas.fase)} · Semester ${h(smtLabel(d.kelas.semester))} · Tahun Pelajaran ${h(d.kelas.tahun_ajaran)}</div>`)}
  <table class="rp" style="font-size:8.5pt"><thead><tr><th>No</th><th style="text-align:left">Nama</th>${d.mapel.map(m => `<th>${h(m.nama)}</th>`).join('')}<th>Jumlah</th><th>Rata-rata</th><th>Rank</th><th>S</th><th>I</th><th>A</th><th>Keputusan</th></tr></thead><tbody>
  ${d.siswa.map((s, i) => `<tr><td class="c">${h(s.no_absen || i + 1)}</td><td>${h(s.nama)}</td>${d.mapel.map(m => { const v = s.nilai[m.id_mapel]; return `<td class="c" style="${v != null && v < B ? 'font-weight:700;text-decoration:underline' : ''}">${rnd(v)}</td>`; }).join('')}<td class="c b">${s.jumlah ? Math.round(s.jumlah * 100) / 100 : '–'}</td><td class="c">${s.rata == null ? '–' : s.rata}</td><td class="c b">${s.rank == null ? '–' : s.rank}</td><td class="c">${s.sakit || 0}</td><td class="c">${s.izin || 0}</td><td class="c">${s.alpa || 0}</td><td class="c">${h(s.keputusan || '')}</td></tr>`).join('')}
  <tr class="sum"><td colspan="2" class="c">RATA-RATA MAPEL</td>${d.mapel.map(m => `<td class="c">${d.rata_mapel[m.id_mapel] == null ? '–' : d.rata_mapel[m.id_mapel]}</td>`).join('')}<td colspan="7"></td></tr>
  <tr class="sum"><td colspan="2" class="c">% TUNTAS (≥ ${B})</td>${d.mapel.map(m => `<td class="c">${d.tuntas_mapel[m.id_mapel] == null ? '–' : d.tuntas_mapel[m.id_mapel] + '%'}</td>`).join('')}<td colspan="7"></td></tr></tbody></table>
  <div class="small" style="margin-top:8px;font-size:8.5pt">Nilai bergaris bawah = di bawah KKTP bawaan (${B}). Nilai dibulatkan; jumlah dan peringkat dihitung dari nilai tanpa pembulatan.</div></div></section>`;
}

async function kelasPicker(title, render) {
  setTitle(title);
  const a = await getAsg(), list = a.wali;
  if (!list.length) { $('#view').innerHTML = '<div class="card empty">Belum ada kelas aktif.<br><span class="small">Admin menambahkannya di menu <b>Data Kelas</b>.</span></div>'; return; }
  if (!St.kelas || !list.find(k => k.id_kelas === St.kelas)) St.kelas = list[0].id_kelas;
  $('#view').innerHTML = `<div class="card pad"><div class="row" style="align-items:flex-end"><div style="min-width:260px"><label class="f" style="margin-top:0" for="ksel">Pilih kelas</label><select class="inp" id="ksel">${list.map(k => `<option value="${h(k.id_kelas)}" ${k.id_kelas === St.kelas ? 'selected' : ''}>${h(k.nama_kelas)} (${k.jumlah_siswa} siswa)</option>`).join('')}</select></div><span class="sp"></span><div class="row" id="ktools"></div></div></div><div id="kbody" style="margin-top:14px"></div>`;
  const load = async () => { $('#kbody').innerHTML = '<div class="skel"></div>'; $('#ktools').innerHTML = ''; try { await render($('#kbody'), $('#ktools')); } catch (e) { $('#kbody').innerHTML = `<div class="note bad">${ic('warn')}<div>${h(e.message)}</div></div>`; } };
  $('#ksel').onchange = e => { St.kelas = e.target.value; load(); };
  await load();
}

async function viewLeger() {
  await kelasPicker('Leger Nilai', async (body, tools) => {
    const d = await call('getLeger', St.kelas), B = d.batas;
    tools.innerHTML = `<button class="btn" id="lgXl">${ic('book', 16)} Unduh Excel</button><button class="btn pri" id="lgPrint">${ic('book', 16)} Cetak leger</button>`; preXL();
    $('#lgXl').onclick = () => xlSave(`Leger_${fileSafe(d.kelas.nama_kelas)}.xlsx`, [{ name: 'Leger', w: [6, 14, 30, ...d.mapel.map(() => 14), 9, 10, 10], rows: [
      ['LEGER NILAI — ' + d.kelas.nama_kelas + ' · TA ' + St.sess.tahun_ajaran + ' · Semester ' + St.sess.semester], [],
      ['No', 'NISN', 'Nama Siswa', ...d.mapel.map(m => m.nama), 'Jumlah', 'Rata-rata', 'Peringkat'],
      ...d.siswa.map((s, i) => [s.no_absen || i + 1, String(s.nisn || ''), s.nama, ...d.mapel.map(m => s.nilai[m.id_mapel] ?? ''), s.jumlah || '', s.rata ?? '', s.rank ?? '']),
      ['', '', 'Rata-rata mapel', ...d.mapel.map(m => d.rata_mapel[m.id_mapel] ?? '')],
      ['', '', '% tuntas (≥ ' + B + ')', ...d.mapel.map(m => d.tuntas_mapel[m.id_mapel] == null ? '' : d.tuntas_mapel[m.id_mapel] + '%')]] }]);
    $('#lgPrint').onclick = async () => { await getCetakSet(); openPreview('Leger Nilai · ' + d.kelas.nama_kelas, legerSheet(d), { landscape: true }); };
    body.innerHTML = `<div class="card"><div class="tw"><table><thead><tr><th class="stk" style="width:46px">No</th><th class="stk2" style="min-width:190px">Nama siswa</th>${d.mapel.map(m => `<th class="c">${h(m.nama)}</th>`).join('')}<th class="c">Jumlah</th><th class="c">Rata-rata</th><th class="c">Rank</th></tr></thead><tbody>
    ${d.siswa.map((s, i) => `<tr><td class="stk c muted">${h(s.no_absen || i + 1)}</td><td class="stk2"><b>${h(s.nama)}</b></td>${d.mapel.map(m => { const v = s.nilai[m.id_mapel]; return `<td class="c avg" style="${v != null && v < B ? 'color:var(--bad)' : ''}">${v == null ? '<span class="muted">–</span>' : v}</td>`; }).join('')}<td class="c avg">${s.jumlah || '–'}</td><td class="c">${s.rata == null ? '–' : s.rata}</td><td class="c"><b>${s.rank == null ? '–' : s.rank}</b></td></tr>`).join('') || `<tr><td colspan="${d.mapel.length + 5}" class="empty">Belum ada siswa di kelas ini.</td></tr>`}
    <tr><td class="stk"></td><td class="stk2"><b>Rata-rata mapel</b></td>${d.mapel.map(m => `<td class="c"><b>${d.rata_mapel[m.id_mapel] == null ? '–' : d.rata_mapel[m.id_mapel]}</b></td>`).join('')}<td colspan="3"></td></tr>
    <tr><td class="stk"></td><td class="stk2"><b>% tuntas (≥ ${B})</b></td>${d.mapel.map(m => `<td class="c">${d.tuntas_mapel[m.id_mapel] == null ? '–' : d.tuntas_mapel[m.id_mapel] + '%'}</td>`).join('')}<td colspan="3"></td></tr></tbody></table></div></div>
    <div class="small muted" style="margin-top:8px">Nilai merah = di bawah batas tuntas. Nilai rapor muncul setelah nilai TP, non-tes, dan tes terisi.</div>`;
  });
}

async function viewDataRapor() {
  await kelasPicker('Data Rapor Siswa', async (body, tools) => {
    const d = await call('getDataRapor', St.kelas), smt2 = String(d.kelas.semester) === '2';
    const rows = d.siswa;
    body.innerHTML = `<div class="note info" style="margin-bottom:12px">${ic('info')}<div>Isi <b>kehadiran</b>, <b>catatan wali kelas</b>, dan <b>ekstrakurikuler</b> tiap siswa. Data ini tercetak di rapor.${smt2 ? ' Kolom <b>Keputusan</b> (naik/tinggal kelas) tercetak pada rapor semester 2.' : ''}</div></div>
    <div class="card"><div class="tw"><table><thead><tr><th class="stk" style="width:46px">No</th><th class="stk2" style="min-width:190px">Nama siswa</th><th class="c" style="min-width:56px">Sakit</th><th class="c" style="min-width:56px">Izin</th><th class="c" style="min-width:56px">Alpa</th><th style="min-width:230px">Catatan wali kelas</th><th>Ekstrakurikuler</th>${smt2 ? '<th style="min-width:110px">Keputusan</th>' : ''}</tr></thead>
    <tbody>${rows.map((s, i) => `<tr data-a="${h(s.id_anggota)}"><td class="stk c muted">${h(s.no_absen || i + 1)}</td><td class="stk2"><b>${h(s.nama)}</b></td>
      ${['sakit', 'izin', 'alpa'].map(f => `<td class="c"><input class="ni" data-f="${f}" inputmode="numeric" value="${s[f]}"></td>`).join('')}
      <td><input class="inp" data-f="catatan_wali" value="${h(s.catatan_wali)}" style="min-width:220px"></td>
      <td><button class="btn ghost" data-ek style="padding:5px 10px">${ic('pen', 14)} <span data-ekt></span></button></td>
      ${smt2 ? `<td><select class="inp" data-f="keputusan"><option value=""></option>${d.opsi.keputusan.map(o => `<option ${s.keputusan === o ? 'selected' : ''}>${o}</option>`).join('')}</select></td>` : ''}</tr>`).join('')}</tbody></table></div></div>
    <div class="savebar"><div><span id="dc">Tidak ada perubahan</span><button class="btn warn" id="save" disabled>${ic('check', 16)} Simpan data rapor</button></div></div>`;
    const dirty = new Set(), ekText = s => [1, 2, 3].filter(i => s['ekskul_' + i]).map(i => s['ekskul_' + i]).join(', ') || 'Isi';
    const mark = (tr, a) => { dirty.add(a); const bads = $$('.ni.err', body).length; $('#dc').textContent = bads ? bads + ' sel tidak valid' : dirty.size + ' siswa diubah'; $('#save').disabled = !dirty.size || !!bads; };
    $$('tbody tr', body).forEach(tr => {
      const s = rows.find(x => x.id_anggota === tr.dataset.a);
      $('[data-ekt]', tr).textContent = ekText(s);
      $$('[data-f]', tr).forEach(inp => inp.addEventListener('input', () => {
        const f = inp.dataset.f;
        if (inp.classList.contains('ni')) { const v = inp.value.trim() === '' ? 0 : Number(inp.value), bad = !Number.isInteger(v) || v < 0 || v > 366; inp.classList.toggle('err', bad); if (!bad) s[f] = v; }
        else s[f] = inp.value;
        inp.classList.add('dirty'); mark(tr, s.id_anggota);
      }));
      $('[data-ek]', tr).onclick = () => modal({ title: 'Ekstrakurikuler — ' + s.nama, wide: true, body: `<div class="small muted" style="margin-bottom:8px">Isi sampai 3 kegiatan. Kosongkan nama bila tidak ada.</div>${[1, 2, 3].map(i => `<div class="row" style="align-items:flex-end;flex-wrap:nowrap;gap:8px;margin-bottom:6px"><div style="flex:2"><label class="f">Kegiatan ${i}</label><input class="inp" id="ek_n${i}" value="${h(s['ekskul_' + i])}"></div><div style="flex:1.2"><label class="f">Predikat</label><select class="inp" id="ek_p${i}"><option value=""></option>${d.opsi.predikat.map(o => `<option ${s['predikat_' + i] === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div><div style="flex:3"><label class="f">Keterangan</label><input class="inp" id="ek_k${i}" value="${h(s['ket_' + i])}"></div></div>`).join('')}`,
        onOk: () => { [1, 2, 3].forEach(i => { s['ekskul_' + i] = $('#ek_n' + i).value.trim(); s['predikat_' + i] = $('#ek_p' + i).value; s['ket_' + i] = $('#ek_k' + i).value.trim(); }); $('[data-ekt]', tr).textContent = ekText(s); mark(tr, s.id_anggota); } });
    });
    if (smt2) tools.innerHTML = `<button class="btn ghost" id="allNaik">Set semua "Naik"</button>`, $('#allNaik').onclick = () => { rows.forEach(s => { s.keputusan = 'Naik'; dirty.add(s.id_anggota); }); $$('[data-f="keputusan"]', body).forEach(x => { x.value = 'Naik'; x.classList.add('dirty'); }); $('#dc').textContent = dirty.size + ' siswa diubah'; $('#save').disabled = false; };
    $('#save').onclick = async () => {
      const keys = ['sakit', 'izin', 'alpa', 'catatan_wali', 'keputusan', 'tinggi_badan', 'berat_badan', 'kondisi_kesehatan', 'prestasi'].concat([1, 2, 3].flatMap(i => ['ekskul_' + i, 'predikat_' + i, 'ket_' + i]));
      const items = [...dirty].map(a => { const s = rows.find(x => x.id_anggota === a), o = { id_anggota: a }; keys.forEach(k => { if (s[k] !== undefined) o[k] = s[k]; }); return o; });
      const b = $('#save'); b.disabled = true; b.textContent = 'Menyimpan…';
      try { const r = await call('saveDataRapor', St.kelas, items); toast(`<b>${r.saved} data rapor tersimpan.</b>`); if (r.errors.length) toast(r.errors.map(h).join('<br>'), 'warn', 8000); dirty.clear(); $$('.dirty', body).forEach(x => x.classList.remove('dirty')); $('#dc').textContent = 'Tersimpan'; }
      catch (er) { failToast(er); b.disabled = false; } finally { b.innerHTML = ic('check', 16) + ' Simpan data rapor'; }
    };
  });
}

async function viewCetak() {
  await kelasPicker('Cetak Rapor', async (body, tools) => {
    const [d] = await Promise.all([call('getCetakRapor', St.kelas), getCetakSet()]), T = d.total_mapel, n = d.siswa.length;
    const nFinal = d.siswa.filter(s => s.final).length, jenis = St.cj === 'sts' ? 'sts' : 'smt', sheet = jenis === 'sts' ? ptsSheet : raporSheet, nm = jenis === 'sts' ? 'Rapor PTS' : 'Rapor';
    tools.innerHTML = `<div class="seg" id="cj"><button data-j="smt" class="${jenis === 'smt' ? 'on' : ''}">Rapor Semester</button><button data-j="sts" class="${jenis === 'sts' ? 'on' : ''}">Rapor PTS</button></div>
      <button class="btn" id="cSet">${ic('pen', 15)} Logo &amp; latar</button>${n ? `<button class="btn pri" id="cAll">${ic('book', 16)} Cetak semua (${n})</button>` : ''}`;
    $$('#cj button').forEach(b => b.onclick = () => { St.cj = b.dataset.j; go('cetak'); });
    $('#cSet').onclick = () => cetakSettingModal();
    const open = i => openPreview(`${nm} · ${d.siswa[i].nama}`, '', { nav: { n, i, render: j => ({ title: `${nm} · ${d.siswa[j].nama}`, html: sheet(d, d.siswa[j]) }) } });
    if (n) $('#cAll').onclick = () => openPreview(`${nm} ${d.kelas.nama_kelas} · ${n} siswa`, d.siswa.map(s => sheet(d, s)).join(''));
    const st = s => s.final ? '<span class="chip ok">' + ic('lock', 12) + ' Final</span>' : s.lengkap === T && T ? '<span class="chip info">Lengkap · belum final</span>' : `<span class="chip warn">Belum lengkap (${s.lengkap}/${T})</span>`;
    const hasSts = s => s.items.filter(i => i.sts != null).length;
    body.innerHTML = jenis === 'sts' ? `<div class="note info" style="margin-bottom:12px">${ic('info')}<div><b>Rapor PTS</b> memuat nilai PTS tiap mata pelajaran dengan keterangan <b>Terlampaui</b> / <b>Belum Terlampaui</b> (dibandingkan KKTP mapel). Isi nilai PTS di menu <b>Input Nilai</b>. Dapat dicetak kapan saja (tanpa finalisasi).</div></div>`
      : nFinal < n ? `<div class="note warn" style="margin-bottom:12px">${ic('warn')}<div>Rapor yang belum difinalisasi dicetak dengan tanda air <b>DRAFT</b>. Finalisasi dulu di menu <b>Finalisasi Rapor</b> untuk cetak resmi.</div></div>` : '';
    body.innerHTML += `<div class="card"><div class="tw"><table><thead><tr><th class="c" style="width:56px">No</th><th>Nama siswa</th><th>NISN</th><th class="c">${jenis === 'sts' ? 'PTS terisi' : 'Mapel terisi'}</th><th class="c">Rata-rata</th><th>Status</th><th></th></tr></thead><tbody>
    ${d.siswa.map((s, i) => `<tr><td class="c muted">${h(s.no_absen || i + 1)}</td><td><b>${h(s.nama)}</b></td><td>${h(s.nisn)}</td><td class="c">${jenis === 'sts' ? hasSts(s) : s.lengkap}/${T}</td><td class="c avg">${jenis === 'sts' ? (() => { const v = s.items.filter(x => x.sts != null).map(x => x.sts); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 100) / 100 : '–'; })() : s.rata == null ? '–' : s.rata}</td><td>${jenis === 'sts' ? (hasSts(s) === T && T ? '<span class="chip info">PTS lengkap</span>' : `<span class="chip warn">Belum lengkap</span>`) : st(s)}</td><td style="text-align:right"><button class="btn sm pri" data-p="${i}">${ic('book', 14)} Lihat & cetak</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Belum ada siswa di kelas ini.</td></tr>'}</tbody></table></div></div>`;
    $$('[data-p]', body).forEach(b => b.onclick = () => open(+b.dataset.p));
  });
}


/* ==========================================================================
   WORKSPACE (Nilai TP / Nilai Akhir / Capaian / Kelola TP)
   ========================================================================== */
/* ==========================================================================
   EXCEL — unduh templat & unggah .xlsx (SheetJS dimuat saat dibutuhkan)
   ========================================================================== */
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let _xl = null;
const loadXL = () => _xl || (_xl = window.XLSX ? Promise.resolve(window.XLSX) : new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = XLSX_URL;
  s.onload = () => res(window.XLSX);
  s.onerror = () => { _xl = null; rej(new Error('Pustaka Excel gagal dimuat. Periksa koneksi internet lalu coba lagi.')); };
  document.head.appendChild(s);
}));
const preXL = () => { loadXL().catch(() => { }); };
const fileSafe = s => String(s || '').replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '');
async function xlSave(file, sheets) {
  try {
    const X = await loadXL(), wb = X.utils.book_new();
    sheets.forEach(sh => { const ws = X.utils.aoa_to_sheet(sh.rows); if (sh.w) ws['!cols'] = sh.w.map(w => ({ wch: w })); X.utils.book_append_sheet(wb, ws, sh.name); });
    X.writeFile(wb, file); toast(`<b>${h(file)}</b> diunduh.`);
  } catch (e) { failToast(e); }
}
const xlCell = v => {
  if (v instanceof Date) { const d = new Date(v.getTime() + 12 * 36e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  return v == null ? '' : String(v).trim();
};
async function xlRead(file) {
  const X = await loadXL(), wb = X.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]]; if (!ws) throw new Error('File Excel kosong.');
  return X.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false }).map(r => r.map(xlCell)).filter(r => r.some(c => c !== ''));
}
function pickXlsx(cb) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = '.xlsx,.xls,.csv';
  i.onchange = async () => { const f = i.files[0]; if (!f) return; try { await cb(await xlRead(f), f); } catch (e) { failToast(e); } };
  i.click();
}
const xlBtns = (t, u) => `<button class="btn sm" data-xl="tpl">${ic('book', 14)} ${t || 'Unduh templat Excel'}</button><button class="btn sm" data-xl="up">${ic('plus', 14)} ${u || 'Impor Excel'}</button>`;
const nisnKey = v => { v = String(v || '').replace(/\D/g, ''); return /^\d{6,9}$/.test(v) ? v.padStart(10, '0') : v; };
const nameKey = v => String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
/** Cocokkan baris Excel dengan siswa (NISN dulu, lalu nama). */
function xlMatch(rows, siswa) {
  const hi = rows.findIndex(r => r.some(c => /^(nisn|nama)/i.test(c)));
  if (hi < 0) throw new Error('Baris judul tidak ditemukan. Gunakan templat Excel dari tombol "Templat".');
  const hdr = rows[hi].map(c => c.trim()), low = hdr.map(c => c.toLowerCase());
  const ci = low.findIndex(c => c === 'nisn'), cn = low.findIndex(c => /^nama/.test(c));
  const byN = {}, byNm = {}; siswa.forEach(s => { if (s.nisn) byN[nisnKey(s.nisn)] = s; byNm[nameKey(s.nama)] = s; });
  const recs = [], miss = [];
  rows.slice(hi + 1).forEach(r => {
    const s = (ci >= 0 && r[ci] && byN[nisnKey(r[ci])]) || (cn >= 0 && byNm[nameKey(r[cn])]);
    s ? recs.push({ s, row: r }) : miss.push((cn >= 0 && r[cn]) || (ci >= 0 && r[ci]) || '(tanpa nama)');
  });
  return { hdr, low, recs, miss };
}
const parseNil = raw => { const v = Number(String(raw).replace(',', '.')); return Number.isInteger(v) && v >= 0 && v <= 100 ? v : NaN; };
const curMK = () => (asgCache && asgCache.d.items.find(i => i.id_mapel_kelas === St.mk)) || { nama_kelas: '', nama_mapel: '' };
const impReport = (n, bad, miss, lock) => {
  let m = `<b>${n} nilai dibaca dari Excel.</b> Periksa lalu klik <b>Simpan</b>.`;
  if (lock) m += ` ${lock} siswa dilewati (rapor terkunci).`;
  toast(m, n ? 'ok' : 'warn', 7000);
  if (miss.length) toast(`${miss.length} baris tidak cocok dengan siswa:<br>${miss.slice(0, 6).map(h).join('<br>')}${miss.length > 6 ? '<br>…' : ''}`, 'warn', 9000);
  if (bad.length) toast(`${bad.length} sel diabaikan (harus bilangan bulat 0–100):<br>${bad.slice(0, 6).map(h).join('<br>')}${bad.length > 6 ? '<br>…' : ''}`, 'bad', 9000);
};

/* ----- Contoh isi templat data induk ----- */
const XL_EX = { nisn: '0012345678', nis: '1001', nama_siswa: 'Contoh Siswa', jenis_kelamin: 'L', tempat_lahir: 'Bandung', tanggal_lahir: '2012-05-17', agama: 'Islam', pendidikan_sebelumnya: 'SD Contoh', alamat: 'Jl. Contoh No. 1', nama_ayah: 'Nama Ayah', nama_ibu: 'Nama Ibu', pekerjaan_ayah: 'Wiraswasta', pekerjaan_ibu: 'Ibu rumah tangga', alamat_ortu: 'Jl. Contoh No. 1', nama_wali: '', nama_kelas: 'VII A', no_absen: '1', nama: 'Nama Guru', username: 'namaguru', password: 'minimal6huruf', nip: '', peran: 'Guru' };
function xlTemplateMaster(cols, judul, extra) {
  return xlSave('Templat-' + fileSafe(judul) + '.xlsx', [
    { name: 'Data', rows: [cols, cols.map(c => XL_EX[c] ?? '')], w: cols.map(c => Math.max(14, c.length + 4)) },
    { name: 'Petunjuk', w: [100], rows: [['PETUNJUK PENGISIAN — ' + judul], ['1. Isi data mulai baris ke-3 pada sheet "Data". Baris contoh (baris ke-2) HAPUS.'], ['2. Jangan ubah/hapus baris judul (baris ke-1). Maksimal 500 baris per impor.'], ['3. NISN diketik sebagai teks 10 digit (awalan 0 dipertahankan).'], ['4. Tanggal ditulis yyyy-mm-dd atau dd/mm/yyyy. Jenis kelamin diisi L atau P.'], ...(extra || []).map(x => [x]), ['5. Setelah itu: menu Impor → Unggah file Excel → Periksa data → Impor.']] }
  ]);
}
/** Pasang tombol templat/unggah pada dialog impor (textarea #imTx). */
function xlWireImport(cols, judul, extra) {
  $('[data-xl=tpl]').onclick = () => xlTemplateMaster(cols, judul, extra);
  $('[data-xl=up]').onclick = () => pickXlsx(rows => {
    $('#imTx').value = rows.map(r => r.join('\t')).join('\n'); $('#imTx').dispatchEvent(new Event('input'));
    toast(`<b>${Math.max(rows.length - 1, 0)} baris</b> dibaca dari Excel. Klik <b>Periksa data</b>.`);
  });
}

/* ---------- Tab: Nilai TP ---------- */
async function tabTp(tb) {
  const d = await call('getFormData', St.mk), B = St.sess.config.batas_tuntas;
  if (!d.tp.length) { tb.innerHTML = `<div class="card empty">Belum ada TP aktif untuk mapel & fase ini.<br><button class="btn pri" style="margin-top:14px" id="gotp">Tambah TP</button></div>`; $('#gotp').onclick = () => go('tp'); return; }
  const cur = {}, orig = {};
  d.siswa.forEach(s => d.tp.forEach(t => { const k = s.id_anggota + '|' + t.id_tp, v = d.nilai[k] || { nilai: null, remedial: null }; cur[k] = { n: v.nilai, r: v.remedial }; orig[k] = { n: v.nilai, r: v.remedial }; }));
  const eff = (s) => { const v = d.tp.map(t => { const c = cur[s.id_anggota + '|' + t.id_tp]; return c.n == null ? c.r : (c.r == null ? c.n : Math.max(c.n, c.r)); }).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const cls = v => v == null ? '' : v < B ? 'low' : v >= 90 ? 'hi' : '';
  let mode = St.mode;
  const draw = () => {
    tb.innerHTML = `
    <div class="card">
      <div class="pad row" style="padding-bottom:6px">
        <div class="seg" id="seg"><button data-m="nilai" class="${mode === 'nilai' ? 'on' : ''}">Nilai sumatif</button><button data-m="rem" class="${mode === 'rem' ? 'on' : ''}">Remedial</button></div>
        <span class="small muted">${mode === 'nilai' ? 'Isi bilangan bulat 0–100. Nilai &lt; ' + B + ' ditandai merah.' : 'Remedial hanya untuk siswa yang sudah punya nilai. Nilai rapor memakai nilai tertinggi.'}</span>
        <span class="sp"></span>
        <span class="chip info">Enter / ↓ pindah baris</span>
      </div>
      <div class="tw"><table id="gt"><thead><tr><th class="stk" style="width:46px">No</th><th class="stk2" style="min-width:190px">Nama siswa</th>
        ${d.tp.map(t => `<th class="c" title="${h(t.deskripsi_tp)}">${h(t.kode_tp)}<small>${h(t.deskripsi_tp)}</small></th>`).join('')}<th class="c">Rata-rata</th></tr></thead>
      <tbody>${d.siswa.map((s, i) => `<tr data-a="${h(s.id_anggota)}"><td class="stk c muted">${h(s.no_absen || i + 1)}</td><td class="stk2"><b>${h(s.nama)}</b>${s.locked ? ` <span class="chip ok" title="Rapor difinalisasi">${ic('lock', 12)}</span>` : ''}</td>
        ${d.tp.map(t => { const k = s.id_anggota + '|' + t.id_tp, c = cur[k], isRem = mode === 'rem'; const val = isRem ? c.r : c.n; const dis = s.locked || (isRem && c.n == null);
          return `<td class="c"><input class="ni ${cls(isRem ? c.r : c.n)}" inputmode="numeric" data-k="${h(k)}" value="${val == null ? '' : val}" ${dis ? 'disabled' : ''} placeholder="${isRem ? (c.n == null ? '' : '–') : ''}">${isRem ? (c.n != null ? `<span class="rem" style="color:var(--muted)">asli ${c.n}</span>` : '') : (c.r != null ? `<span class="rem">R ${c.r}</span>` : '')}</td>`; }).join('')}
        <td class="c avg" data-avg="${h(s.id_anggota)}">${fmt(eff(s) == null ? null : Math.round(eff(s) * 100) / 100)}</td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="savebar"><div><span id="dcount">Tidak ada perubahan</span><button class="btn warn" id="save" disabled>${ic('check', 16)} Simpan perubahan</button></div></div>`;
    $$('#seg button').forEach(b => b.onclick = () => { mode = St.mode = b.dataset.m; draw(); });
    $('.pad', tb).insertAdjacentHTML('beforeend', xlBtns('Templat Excel', 'Impor Excel'));
    $('[data-xl=tpl]', tb).onclick = xlTpl; $('[data-xl=up]', tb).onclick = () => pickXlsx(xlImp); preXL();
    $$('.ni', tb).forEach(i => { if (isDirty(i.dataset.k)) i.classList.add('dirty'); });
    const inputs = $$('.ni', tb);
    inputs.forEach(inp => {
      inp.addEventListener('input', () => onInput(inp));
      inp.addEventListener('focus', () => inp.select());
      inp.addEventListener('keydown', e => {
        if (!['Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
        e.preventDefault();
        const td = inp.closest('td'), tr = td.parentElement, idx = [...tr.children].indexOf(td), dir = e.key === 'ArrowUp' ? 'previousElementSibling' : 'nextElementSibling';
        let r = tr[dir]; while (r) { const t = r.children[idx].querySelector('.ni:not(:disabled)'); if (t) { t.focus(); break; } r = r[dir]; }
      });
    });
    $('#save').onclick = () => doSave();
    refreshCount();
  };
  const isDirty = k => cur[k].n !== orig[k].n || cur[k].r !== orig[k].r;
  const xlTpl = () => {
    const mk = curMK(), cols = ['No Absen', 'NISN', 'Nama Siswa', ...d.tp.map(t => t.kode_tp), ...d.tp.map(t => t.kode_tp + ' (remedial)')];
    xlSave(`Nilai-TP_${fileSafe(mk.nama_kelas)}_${fileSafe(mk.nama_mapel)}.xlsx`, [
      { name: 'Nilai TP', w: [9, 14, 30, ...d.tp.map(() => 11), ...d.tp.map(() => 17)], rows: [cols, ...d.siswa.map(s => [s.no_absen ?? '', String(s.nisn || ''), s.nama,
        ...d.tp.map(t => { const v = cur[s.id_anggota + '|' + t.id_tp].n; return v == null ? '' : v; }), ...d.tp.map(t => { const v = cur[s.id_anggota + '|' + t.id_tp].r; return v == null ? '' : v; })])] },
      { name: 'Petunjuk', w: [100], rows: [['PETUNJUK — ' + mk.nama_mapel + ' · ' + mk.nama_kelas], ['1. Isi nilai (bilangan bulat 0–100) pada kolom kode TP. Kolom "(remedial)" hanya untuk siswa yang sudah punya nilai asli.'], ['2. Jangan ubah judul kolom, NISN, atau nama siswa (dipakai untuk mencocokkan). Sel kosong = tidak mengubah nilai yang ada.'], ['3. Simpan, lalu klik "Impor Excel". Nilai masuk ke tabel; periksa, lalu klik "Simpan perubahan".'], ['4. Siswa dengan rapor terkunci (final) dilewati.'], ...d.tp.map(t => [t.kode_tp + ' = ' + t.deskripsi_tp])] }]);
  };
  const xlImp = rows => {
    const m = xlMatch(rows, d.siswa), nc = {}, rc = {};
    m.low.forEach((c, j) => { const rem = /remedial/.test(c), code = c.replace(/\(?\s*remedial\s*\)?/, '').trim(), t = d.tp.find(t => String(t.kode_tp).toLowerCase() === code); if (t) (rem ? rc : nc)[t.id_tp] = j; });
    if (!Object.keys(nc).length && !Object.keys(rc).length) throw new Error('Tidak ada kolom yang cocok dengan kode TP (' + d.tp.map(t => t.kode_tp).join(', ') + '). Gunakan templat dari tombol "Templat Excel".');
    let n = 0, lock = 0; const bad = [];
    [[nc, 'n'], [rc, 'r']].forEach(([cols, fld]) => m.recs.forEach(({ s, row }) => {
      if (s.locked) { if (fld === 'n') lock++; return; }
      d.tp.forEach(t => {
        const j = cols[t.id_tp]; if (j === undefined || row[j] === '') return;
        const v = parseNil(row[j]); if (isNaN(v)) { bad.push(`${s.nama} · ${t.kode_tp}${fld === 'r' ? ' (remedial)' : ''}: "${row[j]}"`); return; }
        const c = cur[s.id_anggota + '|' + t.id_tp];
        if (fld === 'r' && c.n == null) { bad.push(`${s.nama} · ${t.kode_tp}: remedial tanpa nilai asli`); return; }
        if (c[fld] !== v) { c[fld] = v; n++; }
      });
    }));
    draw(); impReport(n, bad, m.miss, lock);
  };
  const onInput = inp => {
    const k = inp.dataset.k, raw = inp.value.trim(), isRem = mode === 'rem';
    let v = raw === '' ? null : Number(raw);
    const bad = raw !== '' && (!Number.isInteger(v) || v < 0 || v > 100);
    inp.classList.toggle('err', bad);
    if (!bad) { if (isRem) cur[k].r = v; else cur[k].n = v; inp.classList.toggle('dirty', isDirty(k)); inp.classList.toggle('low', !isDirty(k) && v != null && v < B); }
    const aid = k.split('|')[0], s = d.siswa.find(x => x.id_anggota === aid), av = eff(s);
    $(`[data-avg="${aid}"]`, tb).textContent = av == null ? '–' : fmt(Math.round(av * 100) / 100);
    refreshCount();
  };
  const refreshCount = () => {
    const n = Object.keys(cur).filter(isDirty).length, bad = $$('.ni.err', tb).length;
    $('#dcount').textContent = bad ? `${bad} sel tidak valid` : n ? `${n} perubahan belum disimpan` : 'Tidak ada perubahan';
    $('#save').disabled = !n || !!bad;
  };
  const doSave = async () => {
    const btn = $('#save');
    const items = Object.keys(cur).filter(isDirty).map(k => { const [a, t] = k.split('|'); return { id_anggota: a, id_tp: t, nilai: cur[k].n, nilai_remedial: cur[k].r }; });
    btn.disabled = true; btn.innerHTML = 'Menyimpan…';
    try {
      const r = await call('saveNilaiTp', St.mk, items);
      Object.keys(cur).forEach(k => orig[k] = { ...cur[k] });
      $$('.ni.dirty', tb).forEach(x => x.classList.remove('dirty'));
      let m = `<b>${r.inserted + r.updated} nilai tersimpan.</b>`;
      if (r.deskripsi_generated) m += ` ${r.deskripsi_generated} deskripsi otomatis diperbarui.`;
      if (r.deskripsi_skipped_incomplete) m += ` ${r.deskripsi_skipped_incomplete} siswa menunggu nilai TP lengkap.`;
      if (r.deskripsi_skipped_override) m += ` ${r.deskripsi_skipped_override} deskripsi diedit manual (tidak ditimpa).`;
      if (r.locked) m += ` ${r.locked} nilai ditolak: rapor terkunci.`;
      toast(m, r.error_count ? 'warn' : 'ok', 6500);
      if (r.error_count) toast(r.errors.map(h).join('<br>'), 'bad', 9000);
      refreshCount();
    } catch (er) { failToast(er); } finally { const b = $('#save'); if (b) { b.innerHTML = ic('check', 16) + ' Simpan perubahan'; refreshCount(); } }
  };
  draw();
}

/* ---------- Tab: Nilai Akhir ---------- */
async function tabAkhir(tb) {
  const d = await call('getAkhirData', St.mk), w = d.bobot, K = d.kktp;
  const pk = n => n == null ? '' : n >= K.a ? 'A' : n >= K.b ? 'B' : n >= K.c ? 'C' : 'D';
  const av = a => { const v = a.filter(x => x != null); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : null; };
  const calc = s => { const M = av(s.sum), N = s.sts, Q = av([s.non_tes, s.tes]), wm = w.sumatif / 100, ws = w.sas / 100; if (M == null) return null; let v; if (N == null && Q == null) v = M; else if (Q == null) v = wm * M + ws * N; else if (N == null) v = wm * M + ws * Q; else v = ((wm * M + ws * Q) + N) / 2; return Math.round(v * 100) / 100; };
  const FLD = [...Array(10)].map((_, i) => ['s' + i, 'S' + (i + 1)]).concat([['sts', 'PTS'], ['nt', 'Non-tes'], ['t', 'Tes']]);
  const getF = (s, f) => f[0] === 's' && f !== 'sts' ? s.sum[+f.slice(1)] : f === 'sts' ? s.sts : f === 'nt' ? s.non_tes : s.tes;
  const setF = (s, f, v) => { if (f[0] === 's' && f !== 'sts') s.sum[+f.slice(1)] = v; else if (f === 'sts') s.sts = v; else if (f === 'nt') s.non_tes = v; else s.tes = v; };
  const showNilai = v => v == null ? '–' : Math.round(v);
  tb.innerHTML = `
  ${w.valid ? '' : `<div class="note warn" style="margin-bottom:12px">${ic('warn')}<div>Total bobot = ${w.total}. Seharusnya 100. Nilai tetap tersimpan, tetapi periksa pengaturan.</div></div>`}
  <div class="card">
    <div class="pad" style="padding-bottom:6px"><div class="row"><b>Cara hitung nilai rapor</b><span class="sp"></span><span class="small muted">KKTP mapel ini: <b>A ≥ ${K.a}</b> · <b>B ≥ ${K.b}</b> · <b>C ≥ ${K.c}</b> · D &lt; ${K.c}</span></div>
      <div class="small muted" style="margin-top:6px;line-height:1.6"><b>S1–S10</b> = sumatif lingkup materi (rata-ratanya jadi nilai sumatif) · <b>PTS</b> = sumatif tengah semester · <b>Non-tes</b> &amp; <b>Tes</b> = sumatif akhir semester (SAS).<br>Nilai rapor = rata-rata dari ( ${w.sumatif}% sumatif + ${w.sas}% SAS ) dan PTS. Bila salah satu belum ada, dipakai yang tersedia. Kolom boleh dikosongkan.</div></div>
    <div class="tw"><table style="width:auto;min-width:100%"><thead><tr><th class="stk" style="width:46px">No</th><th class="stk2" style="min-width:180px">Nama siswa</th>${FLD.map(f => `<th class="c" style="min-width:${f[0] === 'nt' || f[0] === 't' ? 62 : 50}px">${f[1]}</th>`).join('')}<th class="c">Rata sumatif</th><th class="c">SAS</th><th class="c">Nilai rapor</th><th class="c">Predikat</th></tr></thead>
    <tbody>${d.siswa.map((s, i) => `<tr data-a="${h(s.id_anggota)}"><td class="stk c muted">${h(s.no_absen || i + 1)}</td><td class="stk2"><b>${h(s.nama)}</b>${s.locked ? ` <span class="chip ok">${ic('lock', 12)}</span>` : ''}</td>
      ${FLD.map(f => `<td class="c"><input class="ni" data-f="${f[0]}" inputmode="numeric" value="${getF(s, f[0]) ?? ''}" ${s.locked ? 'disabled' : ''}></td>`).join('')}
      <td class="c avg" data-m>${fmt(s.na_sumatif)}</td><td class="c avg" data-q>${fmt(s.na_sas)}</td>
      <td class="c avg" data-rp style="font-size:16px">${showNilai(s.nilai_rapor)}</td><td class="c" data-pr>${s.predikat ? `<span class="pred ${s.predikat}">${s.predikat}</span>` : '–'}</td></tr>`).join('')}</tbody></table></div>
  </div>
  <div class="savebar"><div><span id="dc">Tidak ada perubahan</span><button class="btn warn" id="save" disabled>${ic('check', 16)} Simpan nilai</button></div></div>`;
  const dirty = new Set();
  $('.pad', tb).insertAdjacentHTML('beforeend', `<div class="row" style="margin-top:12px">${xlBtns('Templat Excel', 'Impor Excel')}</div>`); preXL();
  const lbl = f => f[1].toLowerCase().replace(/\s|-/g, '');
  $('[data-xl=tpl]', tb).onclick = () => {
    const mk = curMK();
    xlSave(`Nilai-Sumatif_${fileSafe(mk.nama_kelas)}_${fileSafe(mk.nama_mapel)}.xlsx`, [
      { name: 'Nilai Sumatif', w: [9, 14, 30, ...FLD.map(() => 9)], rows: [['No Absen', 'NISN', 'Nama Siswa', ...FLD.map(f => f[1])], ...d.siswa.map(s => [s.no_absen ?? '', String(s.nisn || ''), s.nama, ...FLD.map(f => getF(s, f[0]) ?? '')])] },
      { name: 'Petunjuk', w: [100], rows: [['PETUNJUK — ' + mk.nama_mapel + ' · ' + mk.nama_kelas], ['1. S1–S10 = sumatif lingkup materi; PTS = sumatif tengah semester; Non-tes & Tes = sumatif akhir semester (SAS).'], ['2. Isi bilangan bulat 0–100. Sel kosong = tidak mengubah nilai yang ada. Jangan ubah judul kolom, NISN, atau nama siswa.'], ['3. Simpan, klik "Impor Excel", periksa tabel, lalu klik "Simpan nilai".'], ['4. Siswa dengan rapor terkunci (final) dilewati.']] }]);
  };
  $('[data-xl=up]', tb).onclick = () => pickXlsx(rows => {
    const m = xlMatch(rows, d.siswa), cols = {};
    FLD.forEach(f => { const j = m.low.findIndex(c => { c = c.replace(/\s|-/g, ''); return c === lbl(f) || (f[0] === 'sts' && c === 'sts'); }); if (j >= 0) cols[f[0]] = j; });
    if (!Object.keys(cols).length) throw new Error('Kolom nilai (S1–S10, PTS, Non-tes, Tes) tidak ditemukan. Gunakan templat dari tombol "Templat Excel".');
    let n = 0, lock = 0; const bad = [];
    m.recs.forEach(({ s, row }) => {
      if (s.locked) { lock++; return; }
      const tr = $(`tr[data-a="${s.id_anggota}"]`, tb);
      Object.keys(cols).forEach(f => {
        const raw = row[cols[f]]; if (raw === '') return;
        const v = parseNil(raw); if (isNaN(v)) { bad.push(`${s.nama} · ${f.toUpperCase()}: "${raw}"`); return; }
        const inp = $(`.ni[data-f="${f}"]`, tr); if (inp && inp.value !== String(v)) { inp.value = v; inp.dispatchEvent(new Event('input')); n++; }
      });
    });
    impReport(n, bad, m.miss, lock);
  });
  $$('tbody tr', tb).forEach(tr => {
    const s = d.siswa.find(x => x.id_anggota === tr.dataset.a);
    $$('.ni', tr).forEach(inp => inp.addEventListener('input', () => {
      const raw = inp.value.trim(), v = raw === '' ? null : Number(raw), bad = raw !== '' && (!Number.isInteger(v) || v < 0 || v > 100);
      inp.classList.toggle('err', bad);
      if (!bad) { setF(s, inp.dataset.f, v); dirty.add(s.id_anggota); inp.classList.add('dirty'); }
      const rp = calc(s); $('[data-m]', tr).textContent = fmt(av(s.sum) == null ? null : Math.round(av(s.sum) * 100) / 100); $('[data-q]', tr).textContent = fmt(av([s.non_tes, s.tes]) == null ? null : Math.round(av([s.non_tes, s.tes]) * 100) / 100);
      $('[data-rp]', tr).textContent = showNilai(rp); $('[data-pr]', tr).innerHTML = rp == null ? '–' : `<span class="pred ${pk(rp)}">${pk(rp)}</span>`;
      const bads = $$('.ni.err', tb).length; $('#dc').textContent = bads ? bads + ' sel tidak valid' : dirty.size + ' siswa diubah'; $('#save').disabled = !dirty.size || !!bads;
    }));
    $$('.ni', tr).forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const nx = tr.nextElementSibling; if (nx) $(`.ni[data-f="${inp.dataset.f}"]`, nx)?.focus(); } }));
  });
  $('#save').onclick = async () => {
    const items = [...dirty].map(a => { const s = d.siswa.find(x => x.id_anggota === a); return { id_anggota: a, sum: s.sum, sts: s.sts, non_tes: s.non_tes, tes: s.tes }; });
    const b = $('#save'); b.disabled = true; b.textContent = 'Menyimpan…';
    try {
      const r = await call('saveNilaiAkhir', St.mk, items);
      toast(`<b>${r.saved} nilai tersimpan.</b>${r.locked ? ' ' + r.locked + ' ditolak (terkunci).' : ''}`, 'ok'); if (r.warning) toast(h(r.warning), 'warn', 8000);
      dirty.clear(); $$('.ni.dirty', tb).forEach(x => x.classList.remove('dirty')); $('#dc').textContent = 'Tersimpan';
    } catch (er) { failToast(er); b.disabled = false; } finally { b.innerHTML = ic('check', 16) + ' Simpan nilai'; }
  };
}

/* ---------- Tab: Capaian ---------- */
async function tabCap(tb) {
  const d = await call('getCapaian', St.mk); let filter = 'all', q = '';
  const stLabel = { OTOMATIS: ['ok', 'Otomatis'], SIAP: ['info', 'Siap disimpan'], MANUAL: ['warn', 'Diedit manual'], INCOMPLETE: ['', 'Nilai belum lengkap'], NO_DATA: ['', 'Belum ada TP'], MANUAL_OVERRIDE_AKTIF: ['warn', 'Diedit manual'] };
  const counts = { all: d.items.length, ok: d.items.filter(x => x.deskripsi).length, man: d.items.filter(x => x.status === 'MANUAL').length, inc: d.items.filter(x => !x.deskripsi).length };
  const draw = () => {
    const list = d.items.filter(x => (filter === 'all' || (filter === 'ok' && x.deskripsi) || (filter === 'man' && x.status === 'MANUAL') || (filter === 'inc' && !x.deskripsi)) && x.nama.toLowerCase().includes(q));
    $('#capList').innerHTML = list.length ? list.map(x => { const [c, l] = stLabel[x.status] || ['', x.status];
      return `<div class="card cap ${x.status === 'MANUAL' ? '' : ''}"><div class="n">${h(x.no_absen || '•')}</div><div><div class="row"><b>${h(x.nama)}</b><span class="chip ${c}">${l}${x.status === 'INCOMPLETE' ? ` (${x.dinilai}/${x.total})` : ''}</span>${x.locked ? `<span class="chip ok">${ic('lock', 12)} Final</span>` : ''}
        ${x.nilai_tertinggi != null ? `<span class="small muted">tertinggi ${x.nilai_tertinggi}${x.nilai_terendah != null ? ' · terendah ' + x.nilai_terendah : ''}</span>` : ''}</div>
        ${x.deskripsi ? `<p>${h(x.deskripsi)}</p>` : `<p class="muted small" style="font-style:italic">Deskripsi akan tersusun otomatis setelah semua nilai TP siswa ini terisi.</p>`}
        ${x.catatan ? `<div class="small muted" style="margin-top:6px">Alasan edit: ${h(x.catatan)}</div>` : ''}</div>
        <div class="acts">${x.locked ? '' : `${x.status === 'MANUAL' ? `<button class="btn sm" data-r="${h(x.id_anggota)}">${ic('undo', 14)} Kembalikan ke otomatis</button>` : (x.status === 'OTOMATIS' || x.status === 'SIAP') ? `<button class="btn sm" data-g="${h(x.id_anggota)}">${ic('refresh', 14)} Generate ulang</button>` : ''}
          ${x.deskripsi || x.status === 'SIAP' ? `<button class="btn sm" data-e="${h(x.id_anggota)}">${ic('pen', 14)} Edit</button>` : ''}`}</div></div>`; }).join('') : '<div class="card empty">Tidak ada data yang cocok.</div>';
    $$('[data-g]', tb).forEach(b => b.onclick = async () => { b.disabled = true; try { await call('generateCapaian', St.mk, b.dataset.g, false); toast('Deskripsi diperbarui.'); await drawTab(); } catch (e) { failToast(e); b.disabled = false; } });
    $$('[data-r]', tb).forEach(b => b.onclick = async () => { b.disabled = true; try { const r = await call('resetCapaian', St.mk, b.dataset.r); toast('Dikembalikan ke deskripsi otomatis.'); if (r.info) toast(h(r.info), 'warn'); await drawTab(); } catch (e) { failToast(e); b.disabled = false; } });
    $$('[data-e]', tb).forEach(b => b.onclick = () => editCap(d, d.items.find(x => x.id_anggota === b.dataset.e)));
  };
  tb.innerHTML = `<div class="row" style="margin-bottom:14px"><div class="seg" id="flt"><button data-f="all" class="on">Semua ${counts.all}</button><button data-f="ok">Tersusun ${counts.ok}</button><button data-f="man">Manual ${counts.man}</button><button data-f="inc">Belum lengkap ${counts.inc}</button></div>
    <input class="inp" id="qs" placeholder="Cari nama siswa…" style="max-width:240px"><span class="sp"></span><button class="btn pri" id="genK">${ic('spark', 16)} Generate kelas</button></div><div id="capList" style="display:grid;gap:12px"></div>`;
  draw();
  $$('#flt button').forEach(b => b.onclick = () => { filter = b.dataset.f; $$('#flt button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('#qs').oninput = e => { q = e.target.value.toLowerCase(); draw(); };
  $('#genK').onclick = async e => {
    const b = e.currentTarget; b.disabled = true;
    try { const r = await call('generateKelas', St.mk); toast(`<b>${r.generated} deskripsi dihasilkan</b> dari ${r.total} siswa.${r.incomplete ? ' ' + r.incomplete + ' belum lengkap.' : ''}${r.override ? ' ' + r.override + ' manual (dilewati).' : ''}`); await drawTab(); }
    catch (er) { failToast(er); b.disabled = false; }
  };
}
function editCap(d, x) {
  const m = modal({
    title: 'Edit deskripsi · ' + h(x.nama), ok: 'Simpan edit manual', wide: true,
    body: `<div class="note info">${ic('info')}<div>Kalimat pertama sebaiknya menyebut kekuatan siswa. Edit manual <b>tidak akan ditimpa</b> generate otomatis sampai Anda memilih “Kembalikan ke otomatis”.</div></div>
      <label class="f">Deskripsi capaian kompetensi</label><textarea class="inp" id="eTxt">${h(x.deskripsi || '')}</textarea><div class="cnt" id="eCnt"></div>
      <label class="f">Alasan perubahan <span class="muted">(wajib, min. 10 karakter)</span></label><input class="inp" id="eAl" placeholder="mis. menambahkan konteks projek kelompok">`,
    onOk: async () => {
      try { const r = await call('overrideCapaian', St.mk, x.id_anggota, $('#eTxt').value, $('#eAl').value); toast('Deskripsi disimpan sebagai edit manual.'); if (r.warning) toast(h(r.warning), 'warn', 9000); await drawTab(); }
      catch (e) { failToast(e); return false; }
    }
  });
  const cnt = () => { const n = $('#eTxt').value.length; $('#eCnt').textContent = n + ' / ' + d.max_char; $('#eCnt').classList.toggle('bad', n > d.max_char); };
  $('#eTxt').oninput = cnt; cnt();
}

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
  tb.innerHTML = `<div class="note info" style="margin-bottom:14px">${ic('info')}<div>Daftar ini khusus <b>${h(d.mk.nama_mapel)} · Kelas tingkat ${h(d.mk.tingkat)}</b> (Fase ${h(d.mk.fase)}). TP tingkat lain tidak ditampilkan dan tidak terpengaruh. Panjang deskripsi bebas. <b>Tips:</b> salin banyak baris dari Excel/Word, klik sebuah kotak, lalu <kbd>Ctrl</kbd>+<kbd>V</kbd> — baris baru dibuat otomatis (dua kolom = Kode &amp; Deskripsi). TP lama tidak dihapus, hanya dinonaktifkan.</div></div>
  ${d.items.some(i => i.lama) ? `<div class="note warn" style="margin-bottom:14px">${ic('warn')}<div><b>${d.items.filter(i => i.lama).length} TP lama</b> belum ditentukan tingkatnya, jadi tampil di semua tingkat. Hilangkan centang <b>Aktif</b> pada TP yang bukan milik tingkat ${h(d.mk.tingkat)}, lalu <b>Simpan</b> — yang tetap dicentang terkunci khusus untuk tingkat ${h(d.mk.tingkat)}, yang tidak dicentang dibiarkan untuk tingkat lain.</div></div>` : ''}
  <div class="card"><div class="pad row"><b>Daftar Tujuan Pembelajaran</b><span class="chip" id="tpN"></span><span class="sp"></span><button class="btn" id="tpAdd">${ic('plus', 16)} Tambah baris</button><button class="btn pri" id="tpSave" disabled>${ic('check', 16)} Simpan semua</button></div>
  <div class="tw"><table class="tpg"><thead><tr><th class="c" style="width:48px">No</th><th style="width:120px">Kode</th><th>Deskripsi tujuan pembelajaran</th><th class="c" style="width:70px">Aktif</th><th class="c" style="width:74px">Huruf</th><th style="width:40px"></th></tr></thead><tbody id="tpB"></tbody></table></div></div>`;
  const B = $('#tpB');
  const grow = t => { t.style.height = 'auto'; t.style.height = Math.max(40, t.scrollHeight) + 'px'; };
  const trs = () => $$('tr', B);
  const rec = tr => ({ id_tp: tr.dataset.id || '', kode_tp: $('.tk', tr).value.trim(), deskripsi_tp: $('.td', tr).value.trim(), aktif: $('.ta', tr).checked });
  const same = tr => { const o = d.items.find(i => i.id_tp === tr.dataset.id); return !!o && o.kode_tp === rec(tr).kode_tp && o.deskripsi_tp === rec(tr).deskripsi_tp && o.aktif === rec(tr).aktif; };
  const refresh = () => {
    let n = 0, dirty = 0, bad = 0;
    trs().forEach(tr => {
      const r = rec(tr), empty = !r.kode_tp && !r.deskripsi_tp, len = r.deskripsi_tp.length;
      const ng = !empty && !r.deskripsi_tp;
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

/* ==========================================================================
   REKAP & FINALISASI
   ========================================================================== */
async function viewRekap() {
  setTitle('Rekap & Finalisasi');
  const a = await getAsg(), list = a.wali;
  if (!list.length) { $('#view').innerHTML = '<div class="card empty">Belum ada kelas aktif.</div>'; return; }
  if (!St.kelas || !list.find(k => k.id_kelas === St.kelas)) St.kelas = list[0].id_kelas;
  const draw = async () => {
    const d = await call('getRekap', St.kelas), pct = d.total ? Math.round(d.lengkap * 100 / d.total) : 0, B = d.batas_tuntas;
    const siswa = {}; d.rows.forEach(r => (siswa[r.id_anggota] = siswa[r.id_anggota] || { nama: r.nama, nisn: r.nisn, rows: [] }).rows.push(r));
    const mapels = [...new Set(d.rows.map(r => r.mapel))];
    $('#rk').innerHTML = `
    <div class="tiles"><div class="card tile"><div class="ico">${ic('check', 22)}</div><div><b>${pct}%</b><span>Nilai rapor lengkap (${d.lengkap}/${d.total})</span></div></div>
      <div class="card tile"><div class="ico">${ic('lock', 22)}</div><div><b>${d.final}/${d.total}</b><span>Sudah difinalisasi</span></div></div>
      <div class="card tile"><div class="ico">${ic('users', 22)}</div><div><b>${Object.keys(siswa).length}</b><span>Siswa</span></div></div></div>
    <div class="card"><div class="pad row"><b>Rekap nilai rapor · ${h(d.kelas.nama_kelas)}</b><span class="sp"></span>
      ${St.sess.roles.includes('admin') && d.final ? `<button class="btn danger" id="unl">${ic('lock', 15)} Buka kunci</button>` : ''}
      <button class="btn pri" id="fin" ${d.final >= d.total && d.total ? 'disabled' : ''}>${ic('lock', 15)} Finalisasi kelas</button></div>
    <div class="tw"><table><thead><tr><th class="stk" style="min-width:200px">Siswa</th>${mapels.map(m => `<th class="c">${h(m)}</th>`).join('')}</tr></thead><tbody>
    ${Object.values(siswa).map(s => `<tr><td class="stk"><b>${h(s.nama)}</b><div class="small muted">${h(s.nisn)}</div></td>${mapels.map(m => { const r = s.rows.find(x => x.mapel === m); return `<td class="c">${r && r.nilai_rapor != null ? `<b style="color:${r.nilai_rapor < B ? 'var(--bad)' : 'inherit'}">${r.nilai_rapor}</b> <span class="pred ${r.predikat}">${r.predikat}</span>${r.final ? ` <span class="muted">${ic('lock', 12)}</span>` : ''}` : '<span class="muted">–</span>'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div></div>`;
    const fin = $('#fin'); if (fin) fin.onclick = () => {
      modal({ title: 'Finalisasi rapor ' + h(d.kelas.nama_kelas), ok: 'Ya, finalisasi', danger: false,
        body: `<div class="note warn">${ic('warn')}<div>Setelah difinalisasi, <b>nilai TP, nilai akhir, dan deskripsi</b> semua mapel di kelas ini terkunci dan guru tidak dapat mengubahnya. Pastikan seluruh data sudah benar.</div></div>`,
        onOk: async () => { try { const r = await call('finalisasiKelas', St.kelas, false); toast(`<b>${r.count} nilai dikunci.</b>`); await draw(); } catch (e) {
          if (e.data && e.data.missing) { toast(h(e.message), 'bad', 9000); modal({ title: 'Belum bisa difinalisasi', ok: '', cancel: 'Tutup', body: `<div class="note bad">${ic('warn')}<div>${h(e.message)}</div></div><div class="small" style="margin-top:10px;max-height:240px;overflow:auto">${e.data.missing.map(x => '• ' + h(x)).join('<br>')}</div>` }); return false; }
          failToast(e); return false; } } }); };
    const unl = $('#unl'); if (unl) unl.onclick = () => modal({ title: 'Buka kunci finalisasi', ok: 'Buka kunci', danger: true, body: `<div class="note warn">${ic('warn')}<div>Aksi ini dicatat pada log audit.</div></div><label class="f">Alasan (min. 10 karakter)</label><input class="inp" id="ual">`,
      onOk: async () => { try { const r = await call('bukaKunciKelas', St.kelas, $('#ual').value); toast(r.count + ' nilai dibuka.'); await draw(); } catch (e) { failToast(e); return false; } } });
  };
  $('#view').innerHTML = `<div class="row" style="margin-bottom:14px"><label class="small muted">Kelas</label><select class="inp" id="ksel" style="width:auto">${list.map(k => `<option value="${h(k.id_kelas)}" ${k.id_kelas === St.kelas ? 'selected' : ''}>${h(k.nama_kelas)} (${k.jumlah_siswa} siswa)</option>`).join('')}</select></div><div id="rk"></div>`;
  $('#ksel').onchange = e => { St.kelas = e.target.value; $('#rk').innerHTML = '<div class="skel"></div>'; draw().catch(failToast); };
  await draw();
}

/* ==========================================================================
   ADMIN — Ringkasan · Pengaturan · Data Master
   ========================================================================== */
/* ---------- Ringkasan + checklist ---------- */
async function adminRingkasan(el) {
  const [st, d] = await Promise.all([call('getSetupStatus'), call('getAdminOverview')]);
  const done = st.items.filter(i => i.ok).length, pct = Math.round(done * 100 / st.items.length);
  const kosong = ['guru', 'kelas', 'siswa'].every(id => !st.items.find(i => i.id === id).ok);
  el.innerHTML = `
  <div class="card" style="margin-bottom:18px"><div class="pad row"><div><h3 style="font-size:17px;font-weight:800">${st.siap ? '✅ Aplikasi siap dipakai guru' : 'Persiapan aplikasi'}</h3>
    <div class="small muted">${st.siap ? 'Semua langkah wajib sudah selesai.' : 'Selesaikan langkah bertanda ! atau ○ agar guru dapat mulai input nilai.'}</div></div><span class="sp"></span>
    <span class="chip ${st.siap ? 'ok' : 'warn'}">${done} / ${st.items.length} selesai</span>
    ${kosong ? `<button class="btn" id="seed">${ic('spark', 15)} Isi data contoh</button>` : ''}</div>
    <div style="padding:0 22px 6px"><div class="bar"><i style="width:${pct}%"></i></div></div>
    <div class="chk">${st.items.map((i, n) => `<div class="chk-row">
      <span class="chk-ic ${i.ok ? (i.warn ? 'warn' : 'ok') : 'todo'}">${i.ok ? (i.warn ? '!' : ic('check', 15)) : n + 1}</span>
      <div class="chk-t"><b>${h(i.judul)}</b><div class="small muted">${h(i.detail)}</div></div>
      ${i.aksi ? `<button class="btn sm ${i.ok ? '' : 'pri'}" data-a="${h(i.aksi)}">${i.aksi === 'backup' ? 'Aktifkan' : i.ok ? 'Kelola' : 'Atur sekarang'} →</button>` : ''}</div>`).join('')}</div></div>
  <div class="tiles"><div class="card tile"><div class="ico">${ic('users', 22)}</div><div><b>${d.siswa_aktif}</b><span>Siswa aktif</span></div></div>
  <div class="card tile"><div class="ico">${ic('book', 22)}</div><div><b>${d.guru}</b><span>Guru aktif</span></div></div>
  <div class="card tile"><div class="ico">${ic('list', 22)}</div><div><b>${d.kelas.length}</b><span>Kelas aktif</span></div></div></div>
  <div class="card"><div class="pad row"><b>Kemajuan per kelas</b><span class="sp"></span><button class="btn" id="rfr">${ic('refresh', 15)} Perbarui 14_REKAP_RAPOR</button><button class="btn pri" id="gall">${ic('spark', 15)} Generate semua deskripsi</button></div>
  <div class="tw"><table><thead><tr><th>Kelas</th><th class="c">Siswa</th><th>Nilai rapor lengkap</th><th>Finalisasi</th></tr></thead><tbody>
  ${d.kelas.map(k => { const p = k.total ? Math.round(k.lengkap * 100 / k.total) : 0, f = k.total ? Math.round(k.final * 100 / k.total) : 0; return `<tr><td><b>${h(k.nama_kelas)}</b></td><td class="c">${k.siswa}</td><td style="min-width:200px"><div class="row"><div class="bar" style="flex:1"><i style="width:${p}%"></i></div><b class="small">${p}%</b></div></td><td style="min-width:160px"><div class="row"><div class="bar" style="flex:1"><i style="width:${f}%;background:linear-gradient(90deg,#f59e0b,#fbbf24)"></i></div><b class="small">${f}%</b></div></td></tr>`; }).join('') || '<tr><td colspan="4" class="empty">Belum ada kelas.</td></tr>'}</tbody></table></div></div>
  <div class="sechead"><h2>Log audit terbaru</h2></div>
  <div class="card"><div class="tw" style="max-height:420px"><table><thead><tr><th>Waktu</th><th>Pengguna</th><th>Sheet</th><th>Aksi</th><th>Referensi</th><th>Keterangan</th></tr></thead><tbody>
  ${d.log.map(l => `<tr><td class="small">${h(String(l.waktu).replace('T', ' ').slice(0, 19))}</td><td class="small">${h(l.user)}</td><td class="small">${h(l.sheet)}</td><td><span class="chip ${({ GENERATE: 'info', OVERRIDE: 'warn', FINALIZE: 'ok', INSERT: 'brand' })[l.aksi] || ''}">${h(l.aksi)}</span></td><td class="small">${h(l.ref)}</td><td class="small" style="white-space:normal;max-width:300px">${h(l.ket)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Belum ada aktivitas.</td></tr>'}</tbody></table></div></div>`;
  $$('[data-a]', el).forEach(b => b.onclick = async () => {
    const a = b.dataset.a;
    if (a === 'backup') { b.disabled = true; try { await call('pasangBackup'); toast('Backup harian aktif (pukul 01:00).'); await drawAdmin(); } catch (e) { failToast(e); b.disabled = false; } return; }
    const R = { pengaturan: ['setting', {}], sekolah: ['sekolah', {}], akun: ['akun', {}], mapel: MP(['mapel'], 'mapel'), kelas: MP(['kelas'], 'kelas'), siswa: MP(['siswa', 'anggota'], 'siswa'), anggota: MP(['siswa', 'anggota'], 'anggota') }[a];
    go(R[0], R[1]);
  });
  const seed = $('#seed'); if (seed) seed.onclick = async () => { seed.disabled = true; try { await call('muatDataContoh'); toast('Data contoh dimuat. Muat ulang halaman jika akun Anda belum terdaftar sebagai guru.'); await drawAdmin(); } catch (e) { failToast(e); seed.disabled = false; } };
  $('#gall').onclick = async e => { const b = e.currentTarget; b.disabled = true; try { const r = await call('generateSemua'); toast(`<b>${r.generated} deskripsi dihasilkan.</b> ${r.incomplete} belum lengkap, ${r.override} manual dilewati.`); await drawAdmin(); } catch (er) { failToast(er); b.disabled = false; } };
  $('#rfr').onclick = async e => { const b = e.currentTarget; b.disabled = true; try { const r = await call('refreshRekap'); toast(r.baris + ' baris rekap diperbarui.'); } catch (er) { failToast(er); } b.disabled = false; };
}

/* ---------- Pengaturan sekolah ---------- */
async function adminSettings(el) {
  const d = await call('getSettings'), v = d.values, lock = d.locked;
  const ITEM_OPT = [['{deskripsi_tp}', 'Ringkas — hanya frasa TP (disarankan untuk rapor resmi)'], ['{kode_tp} ({deskripsi_tp})', 'Dengan kode TP (untuk rekap internal)']];
  const preset = ITEM_OPT.some(o => o[0] === v.t_item) ? v.t_item : '__custom';
  const fld = (id, label, val, extra = '', help = '') => `<div><label class="f" for="${id}">${label}</label><input class="inp" id="${id}" value="${h(val)}" ${extra}>${help ? `<div class="small muted" style="margin-top:4px">${help}</div>` : ''}</div>`;
  el.innerHTML = `
  ${lock ? `<div class="note warn" style="margin-bottom:14px">${ic('lock')}<div>Sudah ada rapor yang difinalisasi, jadi <b>bobot dan batas tuntas dikunci</b>. Buka kunci kelas di menu Rekap bila perlu mengubahnya.</div></div>` : ''}
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr));align-items:start">
    <div class="card pad"><h3>Periode</h3><div class="small muted">Dipakai sebagai nilai awal saat menambah kelas baru.</div>
      <div class="row" style="align-items:flex-start;margin-top:4px"><div style="flex:1">${fld('sTa', 'Tahun ajaran', v.tahun_ajaran, 'placeholder="2026/2027"')}</div>
      <div style="width:130px"><label class="f" for="sSm">Semester</label><select class="inp" id="sSm"><option value="1" ${v.semester == 1 ? 'selected' : ''}>1 (Ganjil)</option><option value="2" ${v.semester == 2 ? 'selected' : ''}>2 (Genap)</option></select></div></div></div>

    <div class="card pad"><h3>Penilaian</h3><div class="small muted">Nilai rapor = rata-rata dari (sumatif × bobot + SAS × bobot) dan nilai PTS. KKTP di bawah ini berlaku untuk semua mapel, kecuali diubah di <b>Mata Pelajaran</b>.</div>
      <div class="row" style="align-items:flex-start;margin-top:4px;flex-wrap:nowrap">
        <div style="flex:1">${fld('sB1', 'Bobot sumatif (%)', v.bobot_sumatif, `type="number" min="0" max="100" ${lock ? 'disabled' : ''}`)}</div>
        <div style="flex:1">${fld('sB2', 'Bobot SAS (%)', v.bobot_sas, `type="number" min="0" max="100" ${lock ? 'disabled' : ''}`)}</div></div>
      <div class="row" style="margin:8px 0 2px"><span class="small muted">Total bobot</span><span class="chip" id="sTot"></span></div>
      <div class="row" style="align-items:flex-start;flex-wrap:nowrap;margin-top:6px">
        <div style="flex:1">${fld('sBt', 'KKTP predikat C', v.batas_tuntas, `type="number" min="40" max="90" ${lock ? 'disabled' : ''}`, 'Di bawah ini = D')}</div>
        <div style="flex:1">${fld('sKb', 'KKTP predikat B', v.kktp_b, `type="number" min="41" max="98" ${lock ? 'disabled' : ''}`)}</div>
        <div style="flex:1">${fld('sKa', 'KKTP predikat A', v.kktp_a, `type="number" min="42" max="100" ${lock ? 'disabled' : ''}`)}</div></div>
      <div class="row small" style="margin-top:10px;gap:8px" id="sPred"></div></div>

    <div class="card pad" style="grid-column:1/-1"><h3>Deskripsi capaian otomatis</h3><div class="small muted">Deskripsi disusun dari nilai formatif tiap TP, dikelompokkan menurut predikat TP tersebut. Ubah kalimat pembukanya di sini.</div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:0 18px">
        ${fld('sLa', 'Pembuka predikat A', v.l_a)}${fld('sLb', 'Pembuka predikat B', v.l_b)}${fld('sLc', 'Pembuka predikat C', v.l_c)}${fld('sLd', 'Pembuka predikat D', v.l_d)}
        ${fld('sSp', 'Pemisah antar TP', v.sep)}${fld('sMc', 'Maksimal karakter deskripsi', v.max_char, 'type="number" min="100" max="3000"')}
      </div>
      <label class="f">Pratinjau</label><div class="quote" id="sPrev" style="line-height:1.7"></div></div>

  </div>
  <div class="savebar"><div><span id="sMsg">Pengaturan sekolah</span><button class="btn warn" id="sSave">${ic('check', 16)} Simpan pengaturan</button></div></div>`;
  const val = id => $('#' + id).value;
  const collect = () => ({ tahun_ajaran: val('sTa'), semester: val('sSm'), bobot_sumatif: val('sB1'), bobot_sas: val('sB2'), batas_tuntas: val('sBt'), kktp_b: val('sKb'), kktp_a: val('sKa'), max_char: val('sMc'), l_a: val('sLa'), l_b: val('sLb'), l_c: val('sLc'), l_d: val('sLd'), sep: val('sSp') });
  const upd = () => {
    const c = collect(), tot = (+c.bobot_sumatif || 0) + (+c.bobot_sas || 0), C = +c.batas_tuntas || 0, Bk = +c.kktp_b || 0, A = +c.kktp_a || 0;
    $('#sTot').textContent = tot; $('#sTot').className = 'chip ' + (tot === 100 ? 'ok' : 'bad');
    $('#sPred').innerHTML = `<span class="pred A">A</span> ${A}–100 <span class="pred B">B</span> ${Bk}–${A - 1} <span class="pred C">C</span> ${C}–${Bk - 1} <span class="pred D">D</span> 0–${C - 1}`;
    const sp = c.sep || '; ';
    $('#sPrev').innerHTML = h(`${c.l_a} menganalisis teks prosedur${sp}menyajikan data dalam tabel. ${c.l_c} menyusun laporan sederhana. ${c.l_d} membuat kesimpulan.`);
  };
  $$('input,select', el).forEach(i => i.addEventListener('input', upd)); upd();
  $('#sSave').onclick = async e => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Menyimpan…';
    try {
      await call('saveSettings', collect());
      St.sess = await api.getSessionInfo(); $('#taChip').textContent = 'TA ' + St.sess.tahun_ajaran + ' · Smt ' + St.sess.semester;
      toast('<b>Pengaturan tersimpan.</b> Berlaku untuk generate berikutnya.');
    } catch (er) { failToast(er); } finally { b.disabled = false; b.innerHTML = ic('check', 16) + ' Simpan pengaturan'; }
  };
}

/* ---------- Data master ---------- */
const PILL = { siswa: 'Daftar murid', anggota: 'Masuk kelas' };
const MASTER_HELP = {
  mapel: 'Daftar mata pelajaran. Kode singkat (mis. MTK) dipakai pada ID dan tidak boleh sama.',
  kelas: 'Fase terisi otomatis dari tingkat (7–9 = Fase D). Wali kelas tampil pada tanda tangan rapor. Mapel otomatis tersedia untuk setiap kelas aktif.',
  siswa: 'Data induk siswa beserta kelasnya. Satu kali Impor dari Excel sudah memasukkan data siswa sekaligus menempatkannya ke kelas (kolom nama_kelas & no_absen). Siswa tidak dihapus, hanya diubah statusnya.',
  anggota: 'Memasukkan siswa ke sebuah kelas. Untuk banyak siswa, gunakan Impor (kolom: nisn, nama_kelas, no_absen).'
};
const REF_VIEW = { id_wali_kelas: '_wali', id_guru: '_guru', id_mapel: '_mapel', id_kelas: '_kelas', id_siswa: '_siswa' };
async function adminMaster(el) {
  const meta = await call('getMasterMeta'); St.meta = meta;
  const ent = St.mList.includes(St.mEnt) ? St.mEnt : St.mList[0], E = meta.entities[ent];
  const data = await call('listMaster', ent); let q = '', onlyActive = true;
  const cols = E.fields.filter(f => f.list); let kf = '';
  if (ent === 'siswa') cols.splice(1, 0, { k: '_kelas', l: 'Kelas', t: 'text', virt: 1 }, { k: '_absen', l: 'No. absen', t: 'text', virt: 1 });
  const kelasOpts = ent === 'siswa' ? [...new Map(data.rows.flatMap(r => (r._kid || []).map((id, i) => [id, (r._kelas || '').split(', ')[i] || id]))).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'id', { numeric: true })) : [];
  const cell = (f, r) => {
    if (f.k === 'status' || f.k === 'aktif' || f.k === 'status_keanggotaan') return `<span class="chip ${r._aktif ? 'ok' : ''}">${f.t === 'bool' ? (r._aktif ? 'Aktif' : 'Nonaktif') : h(r[f.k])}</span>`;
    if (f.t === 'ref') return h(r[REF_VIEW[f.k]] || '–');
    if (f.t === 'bool') return r[f.k] ? '✓' : '–';
    return h(r[f.k] === '' || r[f.k] == null ? '–' : r[f.k]);
  };
  el.innerHTML = `
  ${St.mList.length > 1 ? `<div class="seg" id="mseg" style="margin-bottom:14px">${St.mList.map(k => `<button data-e="${k}" class="${k === ent ? 'on' : ''}">${h(PILL[k] || meta.entities[k].label)}</button>`).join('')}</div>` : ''}
  <div class="note info" style="margin-bottom:14px">${ic('info')}<div>${h(MASTER_HELP[ent])}</div></div>
  <div class="card"><div class="pad row"><input class="inp" id="mq" placeholder="Cari…" style="max-width:240px">${ent === 'siswa' ? `<select class="inp" id="mkf" style="width:auto"><option value="">Semua kelas</option><option value="-">Belum punya kelas</option>${kelasOpts.map(([id, n]) => `<option value="${h(id)}">${h(n)}</option>`).join('')}</select>` : ''}<label class="small row" style="gap:6px;cursor:pointer"><input type="checkbox" id="mact" checked> Hanya yang aktif</label><span class="sp"></span><span class="chip" id="mcnt"></span>
    ${E.imp ? `<button class="btn" id="mimp">${ic('plus', 15)} Impor dari Excel</button>` : ''}<button class="btn pri" id="madd">${ic('plus', 15)} Tambah ${h(E.label.toLowerCase())}</button></div>
  <div class="tw"><table><thead><tr>${cols.map(f => `<th>${h(f.l)}</th>`).join('')}<th></th></tr></thead><tbody id="mbody"></tbody></table></div></div>`;
  const draw = () => {
    const rows = data.rows.filter(r => (!onlyActive || r._aktif) && (!kf || (kf === '-' ? !(r._kid || []).length : (r._kid || []).includes(kf))) && (!q || JSON.stringify(r).toLowerCase().includes(q)));
    $('#mcnt').textContent = rows.length + ' data';
    $('#mbody').innerHTML = rows.map(r => `<tr style="${r._aktif ? '' : 'opacity:.55'}">${cols.map(f => `<td>${cell(f, r)}</td>`).join('')}<td style="text-align:right"><button class="btn sm" data-ed="${h(r._id)}">${ic('pen', 14)} Edit</button> <button class="btn sm ${r._aktif ? 'danger' : ''}" data-tg="${h(r._id)}">${r._aktif ? 'Nonaktifkan' : 'Aktifkan'}</button></td></tr>`).join('') || `<tr><td colspan="${cols.length + 1}" class="empty">Belum ada data. Klik “Tambah” untuk memulai.</td></tr>`;
    $$('[data-ed]', el).forEach(b => b.onclick = () => masterForm(ent, data.rows.find(r => r._id === b.dataset.ed)));
    $$('[data-tg]', el).forEach(b => b.onclick = async () => {
      const r = data.rows.find(x => x._id === b.dataset.tg); b.disabled = true;
      try { await call('setMasterActive', ent, r._id, !r._aktif); toast(r._aktif ? 'Dinonaktifkan. Data tetap tersimpan.' : 'Diaktifkan kembali.'); await drawAdmin(); } catch (e) { failToast(e); b.disabled = false; }
    });
  };
  draw();
  $$('#mseg button').forEach(b => b.onclick = () => go('master', { mEnt: b.dataset.e }));
  $('#mq').oninput = e => { q = e.target.value.toLowerCase(); draw(); };
  $('#mact').onchange = e => { onlyActive = e.target.checked; draw(); };
  if ($('#mkf')) $('#mkf').onchange = e => { kf = e.target.value; draw(); };
  $('#madd').onclick = () => masterForm(ent, null);
  const imp = $('#mimp'); if (imp) imp.onclick = () => masterImport(ent);
}

function masterForm(ent, row) {
  const meta = St.meta, E = meta.entities[ent], opts = meta.opts, dflt = meta.defaults || {};
  const inputFor = f => {
    const id = 'mf_' + f.k, dis = row && f.lock ? 'disabled' : '', cur = row ? row[f.k] : (f.d !== undefined ? f.d : (dflt[f.k] !== undefined ? dflt[f.k] : ''));
    let ctl;
    if (f.t === 'select') ctl = `<select class="inp" id="${id}" ${dis}>${f.req ? '' : '<option value="">—</option>'}${f.o.map(o => `<option ${String(cur) === o ? 'selected' : ''}>${h(o)}</option>`).join('')}</select>`;
    else if (f.t === 'ref') {
      const list = (opts[f.ref] || []).slice(); if (row && cur && !list.some(o => o.v === cur)) list.unshift({ v: cur, l: row[REF_VIEW[f.k]] || cur });
      ctl = `<select class="inp" id="${id}" ${dis}><option value="">${f.req ? '— pilih —' : '— tidak ada —'}</option>${list.map(o => `<option value="${h(o.v)}" ${cur === o.v ? 'selected' : ''}>${h(o.l)}</option>`).join('')}</select>`;
    } else if (f.t === 'bool') ctl = `<select class="inp" id="${id}"><option value="1" ${cur !== false ? 'selected' : ''}>Ya</option><option value="0" ${cur === false ? 'selected' : ''}>Tidak</option></select>`;
    else ctl = `<input class="inp" id="${id}" type="${f.t === 'number' ? 'number' : f.t === 'date' ? 'date' : 'text'}" value="${h(cur)}" ${dis} ${f.t === 'email' ? 'inputmode="email" autocapitalize="off"' : ''}>`;
    return `<div><label class="f" for="${id}">${h(f.l)}${f.req ? ' <span style="color:var(--bad)">*</span>' : ''}</label>${ctl}${f.help ? `<div class="small muted" style="margin-top:4px">${h(f.help)}</div>` : ''}</div>`;
  };
  modal({
    title: (row ? 'Edit ' : 'Tambah ') + E.label.toLowerCase(), wide: true, ok: 'Simpan',
    body: `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0 16px">${E.fields.map(inputFor).join('')}</div><div id="mfErr"></div>`,
    onOk: async () => {
      const rec = { _id: row ? row._id : '' };
      E.fields.forEach(f => { const el = $('#mf_' + f.k); if (el && !(row && f.lock)) rec[f.k] = f.t === 'bool' ? el.value === '1' : el.value; });
      try { await call('saveMaster', ent, rec); toast('<b>Tersimpan.</b>'); await drawAdmin(); }
      catch (e) { $('#mfErr').innerHTML = `<div class="note bad" style="margin-top:12px">${ic('warn')}<div>${h(e.message)}</div></div>`; return false; }
    }
  });
}

function masterImport(ent) {
  const E = St.meta.entities[ent]; let checked = false;
  const m = modal({
    title: 'Impor ' + E.label.toLowerCase() + ' dari Excel', wide: true, ok: 'Periksa data',
    body: `<div class="row" style="margin-bottom:12px">${xlBtns()}</div><div class="note info">${ic('info')}<div>Cara cepat: unduh templat, isi, lalu <b>Impor Excel</b>. Atau di Excel/Google Sheets, siapkan kolom dengan <b>baris judul</b>: <code>${E.imp.join('</code>, <code>')}</code>. Blok seluruhnya (termasuk judul), salin, lalu tempel di bawah. Maksimal 500 baris.${ent === 'siswa' ? '<br><b>Satu file untuk semuanya:</b> kolom <code>nama_kelas</code> (harus sama dengan nama kelas aktif) dan <code>no_absen</code> otomatis memasukkan siswa ke kelas. Boleh dikosongkan. NISN yang sudah terdaftar hanya dimasukkan ke kelas, datanya tidak diubah.' : ''}</div></div>
      <textarea class="inp" id="imTx" style="min-height:190px;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;white-space:pre" placeholder="${h(E.imp.join('\t'))}"></textarea><div id="imRes"></div>`,
    onOk: async () => {
      const txt = $('#imTx').value, btn = $('#mok');
      try {
        const r = await call('importMaster', ent, txt, checked);
        if (checked) { toast(`<b>${r.inserted} data diimpor.</b>`); await drawAdmin(); return true; }
        const ok = r.error_count === 0 && r.valid > 0;
        $('#imRes').innerHTML = `<div class="note ${ok ? 'ok' : r.valid ? 'warn' : 'bad'}" style="margin-top:12px">${ic(ok ? 'check' : 'warn')}<div><b>${r.valid} dari ${r.total} baris valid.</b>${r.error_count ? ` ${r.error_count} baris bermasalah, perbaiki lalu periksa ulang:` : ' Siap diimpor.'}
          ${r.errors.length ? `<div class="small" style="margin-top:6px;max-height:150px;overflow:auto">${r.errors.map(x => `• Baris ${x.baris}: ${h(x.pesan)}`).join('<br>')}</div>` : ''}</div></div>`;
        if (ok) { checked = true; btn.textContent = `Impor ${r.valid} data sekarang`; }
        return false;
      } catch (e) { $('#imRes').innerHTML = `<div class="note bad" style="margin-top:12px">${ic('warn')}<div>${h(e.message)}</div></div>`; return false; }
    }
  });
  $('#imTx').oninput = () => { if (checked) { checked = false; $('#mok').textContent = 'Periksa data'; } };
  xlWireImport(E.imp, E.label, ent === 'siswa' ? ['Kolom nama_kelas harus persis sama dengan nama kelas aktif (mis. VII Bilingual) dan boleh dikosongkan.', 'Isi no_absen (angka) bila perlu. NISN yang sudah terdaftar hanya dimasukkan ke kelas.'] : ent === 'anggota' ? ['Kolom nama_kelas harus persis sama dengan nama kelas aktif; NISN harus sudah ada di Data Murid.'] : []); preXL();
}

/* ==========================================================================
   PANDUAN
   ========================================================================== */
function viewAbout() {
  setTitle('Panduan');
  const c = St.sess.config;
  $('#view').innerHTML = `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
  <div class="card pad"><h3>Untuk guru (semua guru dapat mengakses semua kelas & mapel)</h3><ol style="line-height:1.9;padding-left:20px;margin:10px 0 0"><li>Menu <b>Tujuan Pembelajaran</b>: pilih kelas &amp; mapel, tulis TP (cukup sekali).</li><li>Menu <b>Input Nilai</b>, tab <b>Formatif (TP)</b>: isi nilai tiap TP. Deskripsi capaian tersusun otomatis.</li><li>Tab <b>Sumatif, PTS &amp; SAS</b>: isi S1–S10, PTS, non-tes, dan tes. Nilai rapor dan predikat langsung terhitung.</li><li>Menu <b>Deskripsi Capaian</b>: periksa atau ubah kalimat bila perlu.</li></ol></div>
  <div class="card pad"><h3>Rapor kelas</h3><ol style="line-height:1.9;padding-left:20px;margin:10px 0 0"><li><b>Data Rapor Siswa</b>: kehadiran, catatan wali kelas, ekstrakurikuler, dan keputusan naik kelas.</li><li><b>Leger Nilai</b>: periksa nilai semua mapel satu kelas.</li><li><b>Finalisasi Rapor</b>: kunci nilai bila sudah benar.</li><li><b>Cetak Rapor</b>: satu halaman per siswa, lalu <i>Cetak / Simpan PDF</i>.</li></ol></div>
  <div class="card pad"><h3>Untuk admin / operator</h3><ol style="line-height:1.9;padding-left:20px;margin:10px 0 0"><li>Ikuti <b>Persiapan &amp; Log</b>: checklist langkah awal.</li><li>Isi <b>Identitas Sekolah</b>, <b>Akun Guru &amp; Admin</b> (buat username &amp; password), <b>Mata Pelajaran</b> (termasuk KKTP), <b>Data Kelas</b>, <b>Data Murid</b>.</li><li><b>Editor Data</b>: ubah isi sheet apa pun secara langsung bila perlu koreksi mendalam (tercatat di log).</li><li><b>Pengaturan</b>: bobot nilai, KKTP bawaan, kalimat deskripsi.</li></ol></div>
  <div class="card pad"><h3>Rumus nilai rapor</h3><div class="small muted" style="line-height:1.8;margin-top:6px">Sumatif = rata-rata S1–S10 · SAS = rata-rata non-tes &amp; tes.<br>Bila ada sumatif, PTS, dan SAS: <b>nilai rapor = rata-rata ( ${c.bobot_sumatif}% sumatif + ${c.bobot_sas}% SAS , PTS )</b>.<br>Bila PTS kosong: ${c.bobot_sumatif}% sumatif + ${c.bobot_sas}% SAS. Bila SAS kosong: ${c.bobot_sumatif}% sumatif + ${c.bobot_sas}% PTS. Hanya sumatif: nilai sumatif itu.</div></div>
  <div class="card pad"><h3>Predikat &amp; deskripsi otomatis</h3><div style="display:grid;gap:8px;margin-top:12px"><div class="row"><span class="pred A">A</span>Sangat Baik · ≥ ${c.kktp_a}</div><div class="row"><span class="pred B">B</span>Baik · ${c.kktp_b}–${c.kktp_a - 1}</div><div class="row"><span class="pred C">C</span>Cukup · ${c.batas_tuntas}–${c.kktp_b - 1}</div><div class="row"><span class="pred D">D</span>Perlu Bantuan · &lt; ${c.batas_tuntas}</div></div>
  <div class="small muted" style="margin-top:12px;line-height:1.7">KKTP bawaan di atas dapat diubah per mapel di <b>Mata Pelajaran</b>. Tiap TP dikelompokkan menurut nilainya (A/B/C/D), lalu dirangkai dengan kalimat pembuka yang sesuai.</div></div></div>`;
}

/* ==========================================================================
   AKUN GURU & ADMIN
   ========================================================================== */
const genPw = () => { const c = 'abcdefghjkmnpqrstuvwxyz23456789'; let o = ''; for (let i = 0; i < 8; i++) o += c[Math.floor(Math.random() * c.length)]; return o; };
async function viewAkun() {
  setTitle('Akun Guru & Admin');
  const d = await call('listAkun'); let q = '', onlyActive = false;
  $('#view').innerHTML = `<div class="note info" style="margin-bottom:14px">${ic('info')}<div>Setiap guru masuk memakai <b>username &amp; password</b> yang dibuat di sini. <b>Semua guru</b> dapat mengakses semua kelas dan mata pelajaran; <b>Admin</b> juga dapat mengelola data induk, akun, pengaturan, dan Editor Data. Password disimpan terenkripsi (hash) — tidak bisa dilihat lagi, hanya bisa direset.</div></div>
  <div class="card"><div class="pad row"><input class="inp" id="aq" placeholder="Cari nama / username…" style="max-width:260px"><label class="small row" style="gap:6px;cursor:pointer"><input type="checkbox" id="aact"> Hanya yang aktif</label><span class="sp"></span><span class="chip" id="acnt"></span>
    <button class="btn" id="aimp">${ic('plus', 15)} Impor dari Excel</button><button class="btn pri" id="aadd">${ic('plus', 15)} Tambah akun</button></div>
  <div class="tw"><table><thead><tr><th>Nama guru</th><th>Username</th><th>NIP</th><th>Peran</th><th>Status</th><th>Password</th><th></th></tr></thead><tbody id="abody2"></tbody></table></div></div>`;
  const draw = () => {
    const rows = d.rows.filter(r => (!onlyActive || r.status === 'Aktif') && (!q || (r.nama_guru + ' ' + r.username).toLowerCase().includes(q)));
    $('#acnt').textContent = rows.length + ' akun';
    $('#abody2').innerHTML = rows.map(r => `<tr style="${r.status === 'Aktif' ? '' : 'opacity:.55'}"><td><b>${h(r.nama_guru)}</b>${r._id === d.me ? ' <span class="chip brand">Anda</span>' : ''}</td><td><code>${h(r.username)}</code></td><td>${h(r.nip || '–')}</td>
      <td><span class="chip ${r.peran === 'Admin' ? 'warn' : 'info'}">${h(r.peran)}</span></td><td><span class="chip ${r.status === 'Aktif' ? 'ok' : ''}">${h(r.status)}</span></td>
      <td>${r.punya_password ? '<span class="chip ok">Sudah diatur</span>' : '<span class="chip bad">Belum</span>'}</td>
      <td style="text-align:right;white-space:nowrap"><button class="btn sm" data-ed="${h(r._id)}">${ic('pen', 14)} Edit</button> <button class="btn sm" data-pw="${h(r._id)}">${ic('lock', 14)} Reset password</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Belum ada akun.</td></tr>';
    $$('[data-ed]').forEach(b => b.onclick = () => akunForm(d.rows.find(r => r._id === b.dataset.ed), false));
    $$('[data-pw]').forEach(b => b.onclick = () => akunForm(d.rows.find(r => r._id === b.dataset.pw), true));
  };
  draw();
  $('#aq').oninput = e => { q = e.target.value.toLowerCase(); draw(); };
  $('#aact').onchange = e => { onlyActive = e.target.checked; draw(); };
  $('#aadd').onclick = () => akunForm(null, false);
  $('#aimp').onclick = akunImport;
}
function akunForm(row, pwOnly) {
  const nw = !row, v = row || { nama_guru: '', nip: '', username: '', peran: 'Guru', status: 'Aktif' };
  const sel = (id, list, cur) => `<select class="inp" id="${id}">${list.map(o => `<option ${o === cur ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  modal({
    title: nw ? 'Tambah akun' : pwOnly ? 'Reset password — ' + h(v.nama_guru) : 'Edit akun — ' + h(v.nama_guru), wide: !pwOnly, ok: 'Simpan',
    body: `${pwOnly ? `<div class="note info">${ic('info')}<div>Username: <b>${h(v.username)}</b>. Password lama tidak bisa dilihat; isi password baru lalu sampaikan ke guru yang bersangkutan.</div></div>` : `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0 16px">
      <div><label class="f" for="ak1">Nama guru (dengan gelar) <span style="color:var(--bad)">*</span></label><input class="inp" id="ak1" value="${h(v.nama_guru)}"></div>
      <div><label class="f" for="ak2">Username <span style="color:var(--bad)">*</span></label><input class="inp" id="ak2" value="${h(v.username)}" autocapitalize="off" placeholder="huruf kecil, mis. budi.s"><div class="small muted" style="margin-top:4px">3-30 karakter: huruf, angka, titik, _ atau -</div></div>
      <div><label class="f" for="ak3">NIP</label><input class="inp" id="ak3" value="${h(v.nip)}"></div>
      <div><label class="f" for="ak4">Peran</label>${sel('ak4', ['Guru', 'Admin'], v.peran)}<div class="small muted" style="margin-top:4px">Admin: mengelola data induk, akun & pengaturan.</div></div>
      <div><label class="f" for="ak5">Status</label>${sel('ak5', ['Aktif', 'Nonaktif'], v.status)}<div class="small muted" style="margin-top:4px">Akun nonaktif tidak bisa masuk.</div></div></div>`}
      <label class="f" for="ak6">${nw ? 'Password awal <span style="color:var(--bad)">*</span>' : pwOnly ? 'Password baru <span style="color:var(--bad)">*</span>' : 'Password baru (kosongkan bila tidak diubah)'}</label>
      <div class="row" style="flex-wrap:nowrap"><input class="inp" id="ak6" autocomplete="off" placeholder="min. 6 karakter" style="flex:1"><button class="btn" type="button" id="akGen">${ic('refresh', 14)} Acak</button></div><div id="akErr"></div>`,
    onOk: async () => {
      const rec = pwOnly ? { _id: row._id, nama_guru: v.nama_guru, nip: v.nip, username: v.username, peran: v.peran, status: v.status, password: $('#ak6').value }
        : { _id: row ? row._id : '', nama_guru: $('#ak1').value, username: $('#ak2').value, nip: $('#ak3').value, peran: $('#ak4').value, status: $('#ak5').value, password: $('#ak6').value };
      try { await call('saveAkun', rec); toast(pwOnly || rec.password ? `<b>Tersimpan.</b> Username <b>${h(rec.username)}</b>${rec.password ? ' · password: <b>' + h(rec.password) + '</b>' : ''}` : '<b>Tersimpan.</b>', 'ok', 9000); await viewAkun(); }
      catch (e) { $('#akErr').innerHTML = `<div class="note bad" style="margin-top:12px">${ic('warn')}<div>${h(e.message)}</div></div>`; return false; }
    }
  });
  $('#akGen').onclick = () => { $('#ak6').value = genPw(); };
}
function akunImport() {
  let checked = false;
  modal({
    title: 'Impor akun dari Excel', wide: true, ok: 'Periksa data',
    body: `<div class="row" style="margin-bottom:12px">${xlBtns()}</div><div class="note info">${ic('info')}<div>Siapkan kolom dengan <b>baris judul</b>: <code>nama</code>, <code>username</code>, <code>password</code>, <code>nip</code>, <code>peran</code> (peran boleh kosong = Guru). Blok seluruhnya, salin, lalu tempel di bawah. Maksimal 200 akun.</div></div>
      <textarea class="inp" id="imTx" style="min-height:190px;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;white-space:pre" placeholder="nama\tusername\tpassword\tnip\tperan"></textarea><div id="imRes"></div>`,
    onOk: async () => {
      try {
        const r = await call('importAkun', $('#imTx').value, checked);
        if (checked) { toast(`<b>${r.inserted} akun dibuat.</b>`); await viewAkun(); return true; }
        const ok = r.error_count === 0 && r.valid > 0;
        $('#imRes').innerHTML = `<div class="note ${ok ? 'ok' : r.valid ? 'warn' : 'bad'}" style="margin-top:12px">${ic(ok ? 'check' : 'warn')}<div><b>${r.valid} dari ${r.total} baris valid.</b>${r.error_count ? ` ${r.error_count} baris bermasalah:` : ' Siap diimpor.'}${r.errors.length ? `<div class="small" style="margin-top:6px;max-height:150px;overflow:auto">${r.errors.map(x => `• Baris ${x.baris}: ${h(x.pesan)}`).join('<br>')}</div>` : ''}</div></div>`;
        if (ok) { checked = true; $('#mok').textContent = `Buat ${r.valid} akun sekarang`; }
        return false;
      } catch (e) { $('#imRes').innerHTML = `<div class="note bad" style="margin-top:12px">${ic('warn')}<div>${h(e.message)}</div></div>`; return false; }
    }
  });
  $('#imTx').oninput = () => { if (checked) { checked = false; $('#mok').textContent = 'Periksa data'; } };
  xlWireImport(['nama', 'username', 'password', 'nip', 'peran'], 'Akun Guru', ['Kolom peran: Guru atau Admin (kosong = Guru). Password minimal 6 karakter.']); preXL();
}

/* ==========================================================================
   EDITOR DATA — ubah isi sheet apa pun (admin). Setiap perubahan tercatat di 15_LOG.
   ========================================================================== */
async function viewEditor() {
  setTitle('Editor Data');
  const sh = await call('getEditorSheets');
  const E = { name: St.edSheet && sh.sheets.some(x => x.name === St.edSheet) ? St.edSheet : '01_SISWA', q: '', off: 0, data: null, dirty: {}, sel: {} };
  $('#view').innerHTML = `<div class="note warn" style="margin-bottom:14px">${ic('warn')}<div><b>Hati-hati:</b> perubahan di sini langsung masuk ke database tanpa pengecekan alur biasa. Nilai dibatasi 0–100 dan kolom pilihan divalidasi; <b>nilai rapor dihitung ulang otomatis</b> bila Anda mengubah sumatif/PTS/non-tes/tes. Kolom password tidak tampil. Semua perubahan dicatat di log.</div></div>
  <div class="card pad"><div class="row" style="align-items:flex-end"><div style="min-width:260px;flex:1"><label class="f" style="margin-top:0" for="edS">Sheet</label><select class="inp" id="edS">${sh.sheets.map(x => `<option value="${h(x.name)}" ${x.name === E.name ? 'selected' : ''}>${h(x.name)} (${x.rows} baris${x.readonly ? ', hanya-baca' : ''})</option>`).join('')}</select></div>
    <div style="min-width:220px"><label class="f" style="margin-top:0" for="edQ">Cari</label><input class="inp" id="edQ" placeholder="ketik lalu Enter"></div>
    <button class="btn" id="edAdd">${ic('plus', 15)} Tambah baris</button><button class="btn danger" id="edDel" disabled>Hapus terpilih</button></div></div>
  <div id="edBody" style="margin-top:14px"></div>
  <div class="savebar hide" id="edBar"><div><span id="edMsg"></span><button class="btn" id="edUndo">Batalkan</button><button class="btn warn" id="edSave">${ic('check', 16)} Simpan perubahan</button></div></div>`;
  const nDirty = () => Object.keys(E.dirty).length, nSel = () => Object.keys(E.sel).length;
  const bar = () => { $('#edBar').classList.toggle('hide', !nDirty()); $('#edMsg').textContent = nDirty() + ' sel diubah'; const d = $('#edDel'); d.disabled = !nSel(); d.textContent = nSel() ? `Hapus ${nSel()} baris` : 'Hapus terpilih'; };
  const load = async () => {
    E.dirty = {}; E.sel = {}; bar(); const body = $('#edBody'); body.innerHTML = '<div class="skel"></div>';
    try { E.data = await call('getEditorData', E.name, E.q, E.off, 100); } catch (e) { body.innerHTML = `<div class="note bad">${ic('warn')}<div>${h(e.message)}</div></div>`; return; }
    const D = E.data, ro = D.readonly;
    body.innerHTML = `<div class="card"><div class="pad row"><b>${h(E.name)}</b><span class="chip">${D.total} baris</span><span class="sp"></span>
      <button class="btn sm" id="edPrev" ${E.off <= 0 ? 'disabled' : ''}>← Sebelumnya</button><span class="small muted">${D.total ? E.off + 1 : 0}–${Math.min(E.off + D.limit, D.total)}</span><button class="btn sm" id="edNext" ${E.off + D.limit >= D.total ? 'disabled' : ''}>Berikutnya →</button></div>
      <div class="tw" style="max-height:68vh"><table class="edtable"><thead><tr>${ro || D.nodelete ? '' : '<th></th>'}<th>#</th>${D.headers.map(x => `<th>${h(x)}</th>`).join('')}</tr></thead><tbody>
      ${D.rows.map(r => `<tr>${ro || D.nodelete ? '' : `<td><input type="checkbox" data-sel="${r.r}"></td>`}<td class="small muted">${r.r}</td>${D.headers.map((x, i) => {
        const v = r.v[i], id = `${r.r}|${x}`, en = D.enums[x], hid = D.hidden.includes(x);
        if (ro || hid) return `<td class="small" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h(v === '' || v == null ? '' : v)}</td>`;
        if (en) return `<td><select class="cell" data-c="${h(id)}" data-old="${h(String(v))}">${(en.includes(String(v)) ? en : [String(v)].concat(en)).map(o => `<option ${String(o) === String(v) ? 'selected' : ''}>${h(o)}</option>`).join('')}</select></td>`;
        return `<td><input class="cell" data-c="${h(id)}" data-old="${h(String(v))}" value="${h(String(v))}"></td>`;
      }).join('')}</tr>`).join('') || `<tr><td colspan="${D.headers.length + 2}" class="empty">Tidak ada data.</td></tr>`}</tbody></table></div></div>`;
    $$('.cell', body).forEach(el => el.addEventListener('input', () => {
      const k = el.dataset.c; if (el.value === el.dataset.old) { delete E.dirty[k]; el.classList.remove('dirty'); } else { E.dirty[k] = el.value; el.classList.add('dirty'); } bar();
    }));
    $$('[data-sel]', body).forEach(c => c.onchange = () => { c.checked ? E.sel[c.dataset.sel] = 1 : delete E.sel[c.dataset.sel]; bar(); });
    const pv = $('#edPrev'), nx = $('#edNext'); if (pv) pv.onclick = () => { E.off = Math.max(0, E.off - D.limit); load(); }; if (nx) nx.onclick = () => { E.off += D.limit; load(); };
    $('#edAdd').disabled = ro; if (ro) $('#edDel').disabled = true;
  };
  const guard = () => !nDirty() || confirm('Ada perubahan yang belum disimpan. Buang perubahan?');
  $('#edS').onchange = e => { if (!guard()) { e.target.value = E.name; return; } E.name = St.edSheet = e.target.value; E.off = 0; E.q = ''; $('#edQ').value = ''; load(); };
  $('#edQ').onkeydown = e => { if (e.key === 'Enter') { if (!guard()) return; E.q = e.target.value; E.off = 0; load(); } };
  $('#edUndo').onclick = () => load();
  $('#edSave').onclick = async e => {
    const b = e.currentTarget, edits = Object.keys(E.dirty).map(k => { const [r, ...c] = k.split('|'), col = c.join('|'), el = $(`[data-c="${CSS.escape(k)}"]`); return { r: +r, c: col, old: el.dataset.old, v: E.dirty[k] }; });
    b.disabled = true;
    try { const r = await call('saveCells', E.name, edits); toast(`<b>${r.saved} sel tersimpan.</b>`); await load(); } catch (er) { failToast(er); } finally { b.disabled = false; }
  };
  $('#edDel').onclick = () => {
    const rows = Object.keys(E.sel).map(Number);
    modal({ title: 'Hapus ' + rows.length + ' baris?', ok: 'Ya, hapus', danger: true, body: `<div class="note bad">${ic('warn')}<div>Baris <b>dihapus permanen</b> dari sheet <b>${h(E.name)}</b> (isi lamanya tetap tercatat di log). Untuk menyembunyikan data tanpa menghapus, ubah kolom status / aktif saja.</div></div>`,
      onOk: async () => { try { const r = await call('deleteRows', E.name, rows); toast(`<b>${r.deleted} baris dihapus.</b>`); await load(); } catch (er) { failToast(er); return false; } } });
  };
  $('#edAdd').onclick = () => {
    const D = E.data; if (!D) return;
    modal({ title: 'Tambah baris — ' + h(E.name), wide: true, ok: 'Tambah',
      body: `<div class="small muted" style="margin-bottom:8px">Kolom ID boleh dikosongkan (dibuat otomatis). Kolom password tidak diisi di sini.</div><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 14px">${D.headers.filter(x => !D.hidden.includes(x)).map((x, i) => `<div><label class="f" for="na${i}">${h(x)}</label>${D.enums[x] ? `<select class="inp" id="na${i}" data-h="${h(x)}">${D.enums[x].map(o => `<option>${h(o)}</option>`).join('')}</select>` : `<input class="inp" id="na${i}" data-h="${h(x)}">`}</div>`).join('')}</div><div id="naErr"></div>`,
      onOk: async () => { const rec = {}; $$('[data-h]', $('#modalRoot')).forEach(el => rec[el.dataset.h] = el.value);
        try { await call('addRow', E.name, rec); toast('<b>Baris ditambahkan.</b>'); E.off = 0; E.q = ''; await load(); } catch (er) { $('#naErr').innerHTML = `<div class="note bad" style="margin-top:12px">${ic('warn')}<div>${h(er.message)}</div></div>`; return false; } } });
  };
  await load();
}

/* ==========================================================================
   BOOT
   ========================================================================== */
const LOGO_SVG = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h10a4 4 0 014 4v12H8a4 4 0 01-4-4z"/><path d="M4 16a4 4 0 014-4h10"/></svg>';
function bootUI(msg) {
  $('#boot > div').innerHTML = `<div class="logo">${LOGO_SVG}</div><h2>Rapor Kurikulum Merdeka</h2><p id="bootmsg">${h(msg || 'Memuat halaman login…')}</p><div class="spin" id="bootspin"></div>`;
}
const landing = () => 'home';

function lgShell(inner, cls) {
  const b = $('#boot'); b.classList.remove('hide'); b.classList.add('lg');
  b.firstElementChild.innerHTML = `<div class="lgwrap">${inner}</div>`;
}
const eyeBtn = id => `<button type="button" class="eye" data-eye="${id}">Lihat</button>`;
function wireEyes() { $$('[data-eye]').forEach(b => b.onclick = () => { const i = $('#' + b.dataset.eye); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.textContent = show ? 'Sembunyi' : 'Lihat'; }); }
const DEMO_HINT = (IS_GAS || REMOTE) ? '' : `<div class="hint"><b>Akun demo</b> (klik untuk mengisi):<br><button data-fill="admin|admin123">admin · Admin</button><button data-fill="lantabura|guru123">lantabura · Guru</button><button data-fill="guru|guru123">guru · Guru</button></div>`;

function showSetup(p) {
  const needSheet = p.setup === 'sheet';
  lgShell(`<div class="lgbrand">Rapor Kurikulum Merdeka</div><div class="lgcard"><h2 style="letter-spacing:.14em;font-size:19px">SIAPKAN APLIKASI</h2>
    <div class="note2">${needSheet ? 'Langkah satu kali: hubungkan Spreadsheet database dan buat akun admin pertama.' : 'Database sudah terhubung. Buat akun admin pertama untuk mulai memakai aplikasi.'}</div>
    ${needSheet ? `<label for="suLink">Link Google Spreadsheet (kosong)</label><input class="in" id="suLink" placeholder="https://docs.google.com/spreadsheets/d/…" autocomplete="off"><div class="note2" style="text-align:left;margin:6px 0 0">Buka <b>sheets.new</b>, beri nama, lalu salin link dari bilah alamat.</div>` : ''}
    <label for="suNama">Nama lengkap admin</label><input class="in" id="suNama" placeholder="mis. Operator Sekolah" autocomplete="name">
    <label for="suU">Username admin</label><input class="in" id="suU" placeholder="mis. admin" autocomplete="username" autocapitalize="off">
    <label for="suP">Password (min. 6 karakter)</label><div class="pw"><input class="in" id="suP" type="password" autocomplete="new-password">${eyeBtn('suP')}</div>
    <label for="suP2">Ulangi password</label><input class="in" id="suP2" type="password" autocomplete="new-password">
    <div id="suErr"></div><button class="go" id="suGo">Siapkan &amp; buat admin</button>
    <p class="foot">Akun admin yang dibuat di sini bisa menambah akun guru di menu <b>Akun Guru &amp; Admin</b>.</p></div>`);
  wireEyes();
  const go = async () => {
    const b = $('#suGo'), pw = $('#suP').value; $('#suErr').innerHTML = '';
    const bad = m => { $('#suErr').innerHTML = `<div class="err">${h(m)}</div>`; };
    if (pw !== $('#suP2').value) return bad('Password dan ulangi password tidak sama.');
    b.disabled = true; b.textContent = needSheet ? 'Menyiapkan… (±20 detik)' : 'Membuat akun…';
    try {
      const r = await api.setupConnect(needSheet ? $('#suLink').value : '', $('#suU').value, pw, $('#suNama').value);
      if (r.ok === false) throw new Error(r.error);
      const l = await api.login($('#suU').value, pw); if (l.ok === false) throw new Error(l.error);
      TOK.set(l.token); await boot();
    } catch (e) { bad(e.message || e); b.disabled = false; b.textContent = 'Siapkan & buat admin'; }
  };
  $('#suGo').onclick = go; $$('#boot .in').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') go(); });
}

function showLogin(p) {
  St.school = p.sekolah || St.school || '';
  lgShell(`<div class="lgbrand">${h(St.school || 'Rapor Kurikulum Merdeka')}</div><div class="lgcard"><h2>MASUK</h2>
    <label for="lgU">Username</label><input class="in" id="lgU" placeholder="username Anda" autocomplete="username" autocapitalize="off" spellcheck="false">
    <label for="lgP">Password</label><div class="pw"><input class="in" id="lgP" type="password" placeholder="••••••••" autocomplete="current-password">${eyeBtn('lgP')}</div>
    <div id="lgMsg">${p.info ? `<div class="inf">${h(p.info)}</div>` : ''}${p.error ? `<div class="err">${h(p.error)}</div>` : ''}</div>
    <button class="go" id="lgGo">Masuk</button>${DEMO_HINT}${IS_GAS ? '' : `<div class="hint" style="margin-top:12px"><button type="button" id="lgApi">${REMOTE ? 'Ganti / putuskan alamat Google Script' : 'Sambungkan ke Google Script'}</button></div>`}
    <p class="foot">Peran (guru / admin) dikenali otomatis dari akun Anda.</p></div>`);
  wireEyes();
  const lgApi = $('#lgApi'); if (lgApi) lgApi.onclick = () => { const v = prompt('Tempel alamat Web App Google Script (berakhiran /exec).\nKosongkan untuk memutuskan sambungan.', REMOTE); if (v === null) return; try { v.trim() ? localStorage.setItem('rapor_api', v.trim()) : localStorage.removeItem('rapor_api'); } catch (e) { } location.reload(); };
  $$('[data-fill]').forEach(b => b.onclick = () => { const [u, pw] = b.dataset.fill.split('|'); $('#lgU').value = u; $('#lgP').value = pw; $('#lgGo').click(); });
  const go = async () => {
    const u = $('#lgU').value.trim(), pw = $('#lgP').value, b = $('#lgGo');
    if (!u || !pw) { $('#lgMsg').innerHTML = '<div class="err">Isi username dan password.</div>'; return; }
    b.disabled = true; b.textContent = 'Memeriksa…'; $('#lgMsg').innerHTML = '';
    try {
      const r = await api.login(u, pw);
      if (!r || r.ok === false) throw new Error((r && r.error) || 'Gagal masuk.');
      TOK.set(r.token);
      let bt = r.boot;                                         // data dashboard ikut dikirim saat login (hemat satu panggilan)
      if (!bt) { bt = await rawRpc('getBoot'); if (!bt.ok) throw new Error(bt.error || 'Gagal memuat akun.'); }
      await enterApp(bt.info, bt);
    } catch (e) { $('#lgMsg').innerHTML = `<div class="err">${h(e.message || e)}</div>`; b.disabled = false; b.textContent = 'Masuk'; $('#lgP').select(); }
  };
  $('#lgGo').onclick = go; $$('#boot .in').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') go(); });
  setTimeout(() => $('#lgU') && $('#lgU').focus(), 50);
}

/* ---------- Masuk ke aplikasi ---------- */
const ROLE_LABEL = { guru: 'Guru', admin: 'Admin' };
const initial = n => (String(n || '?').replace(/^(Ibu|Bapak|Pak|Bu)\s+/i, '')[0] || '?').toUpperCase();
function fillHeader(s) {
  $('#meName').textContent = s.nama; $('#meRole').textContent = s.admin ? 'Admin' : 'Guru';
  $('#avt').innerHTML = AVA_SVG; $('#taChip').textContent = 'TA ' + s.tahun_ajaran + ' · Smt ' + s.semester;
}
async function enterApp(s, bt) {
  applyBoot(bt); St.sess = s; St.school = s.sekolah || St.school; fillHeader(s); St.view = 'home'; St.kelas = null; St.mk = null;
  $('#boot').classList.add('hide');
  await go('home');
}
const DEMO_ON = (() => { try { const q = new URLSearchParams(location.search); if (q.get('demo') === '1') localStorage.setItem('rapor_demo', '1'); if (q.get('demo') === '0') localStorage.removeItem('rapor_demo'); return localStorage.getItem('rapor_demo') === '1'; } catch (e) { return false; } })();
function showConnect() {
  lgShell(`<div class="lgbrand">Rapor Kurikulum Merdeka</div><div class="lgcard"><h2>HUBUNGKAN</h2>
    <p style="margin:0 0 6px;font-size:13.5px;line-height:1.5">Tempel alamat <b>Web App Google Script</b> (Deploy → Aplikasi web, berakhiran <b>/exec</b>) agar login memakai akun dari Spreadsheet sekolah.</p>
    <label for="apU">Alamat Web App</label><input class="in" id="apU" placeholder="https://script.google.com/macros/s/.../exec" autocapitalize="off" spellcheck="false">
    <div id="apMsg"></div><button class="go" id="apGo">Hubungkan</button>
    <div class="hint" style="margin-top:12px"><button type="button" id="apDemo">Coba mode demo</button></div></div>`);
  const go = () => { const v = $('#apU').value.trim(); if (!/^https:\/\/script\.google\.com\/.+\/exec/.test(v)) { $('#apMsg').innerHTML = '<div class="err">Alamat tidak valid. Harus berawalan https://script.google.com/ dan berakhiran /exec.</div>'; return; } try { localStorage.setItem('rapor_api', v); } catch (e) { } location.reload(); };
  $('#apGo').onclick = go; $('#apU').onkeydown = e => { if (e.key === 'Enter') go(); };
  $('#apDemo').onclick = () => { try { localStorage.setItem('rapor_demo', '1'); } catch (e) { } location.reload(); };
}
async function boot() {
  if (!IS_GAS && !REMOTE && !DEMO_ON) { showConnect(); return; }
  if (!IS_GAS && !REMOTE) { Demo.init(); $('#demoBar').classList.remove('hide'); }
  // Tampilkan halaman login LANGSUNG (tanpa menunggu pengecekan server).
  showLogin({ sekolah: '' });
  // Pengecekan berjalan di latar belakang; bila gagal/lambat, halaman login tetap bisa dipakai.
  try {
    const p = await Promise.race([api.getPublicInfo(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))]);
    if (!p || p.ok === false) return;
    St.school = p.sekolah || '';
    if (p.setup) { if (!$('#lgU') || !$('#lgU').value) showSetup(p); return; }       // belum ada admin -> layar siapkan aplikasi
    const br = $('#boot .lgbrand'); if (br && St.school) br.textContent = St.school; // tampilkan nama sekolah
    if (TOK.get()) {                                                                  // lanjutkan sesi yang masih berlaku
      const bt = await rawRpc('getBoot');
      if (bt && bt.ok) { await enterApp(bt.info, bt); return; }
      TOK.set('');
    }
  } catch (e) { /* abaikan: login tetap tampil */ }
}
const on = (sel, ev, fn) => { const el = $(sel); if (el) el['on' + ev] = fn; };
on('#logoutBtn', 'click', async () => { try { await rawRpc('logout'); } catch (e) { } TOK.set(''); location.reload(); });
on('#resetDemo', 'click', () => { if (confirm('Reset semua data demo ke kondisi awal?')) { Demo.reset(); TOK.set(''); location.reload(); } });
on('#pwBtn', 'click', () => modal({
  title: 'Ganti password', ok: 'Simpan password',
  body: `<label class="f" style="margin-top:0" for="pw0">Password lama</label><input class="inp" id="pw0" type="password" autocomplete="current-password">
    <label class="f" for="pw1">Password baru (min. 6 karakter)</label><input class="inp" id="pw1" type="password" autocomplete="new-password">
    <label class="f" for="pw2">Ulangi password baru</label><input class="inp" id="pw2" type="password" autocomplete="new-password"><div id="pwErr"></div>`,
  onOk: async () => {
    const bad = m => { $('#pwErr').innerHTML = `<div class="note bad" style="margin-top:12px">${ic('warn')}<div>${h(m)}</div></div>`; return false; };
    if ($('#pw1').value !== $('#pw2').value) return bad('Password baru dan ulangi password tidak sama.');
    try { await call('changePassword', $('#pw0').value, $('#pw1').value); toast('<b>Password berhasil diganti.</b>'); } catch (e) { return bad(e.message); }
  }
}));

/* ==========================================================================
   MODE DEMO (GitHub Pages) — backend asli (*.gs) dijalankan di browser oleh
   window.GASDEMO, yang disisipkan scripts/build_pages.py. Tidak aktif di Apps Script.
   ========================================================================== */
const Demo = {
  init() { GASDEMO.init(); },
  reset() { GASDEMO.reset(); }
};

boot();

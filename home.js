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
function drawNav(v) {
  const s = St.sess; if (!s) return;
  const items = NAV.filter(n => !n.r || n.r.some(x => s.roles.includes(x))), cur = items.find(n => n.views.includes(v));
  $('#nav').innerHTML = items.map(n => `<button data-n="${n.id}" class="${cur && cur.id === n.id ? 'on' : ''}">${h(n.t)}</button>`).join('');
  $$('#nav button').forEach(b => b.onclick = () => { const n = items.find(x => x.id === b.dataset.n); n.sub ? tileGo(tileOf(n.sub[0])) : go(n.views[0]); });
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
  const vals = st.kelas.map(k => k[m]), mx = Math.max(...vals);
  return `<div class="bars">${st.kelas.map(k => `<div class="bcol ${k[m] === mx && mx > 0 ? 'mx' : ''}" title="${h(k.nama)}: ${k[m]}%"><small>${k[m]}%</small><div class="btrack"><div class="bfill" style="height:${Math.max(k[m], 4)}%"></div></div><em>${h(k.nama)}</em></div>`).join('')}</div>`;
};

function paintHome(b, asg) {
  const s = St.sess, hr = new Date().getHours(), gr = hr < 11 ? 'Selamat pagi' : hr < 15 ? 'Selamat siang' : hr < 18 ? 'Selamat sore' : 'Selamat malam';
  const st = homeStats(asg), p = b.persiapan, now = new Date();
  const need = st.items.filter(i => i.jumlah_tp > 0 && i.progress_tp < 100).sort((a, c) => a.progress_tp - c.progress_tp).slice(0, 5);
  const seen = {}, subj = st.items.filter(i => !seen[i.id_mapel] && (seen[i.id_mapel] = 1)).slice(0, 14);
  const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const DH = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const wk = DH.map((d, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return `<div class="${x.toDateString() === now.toDateString() ? 'on' : ''}">${d}<b>${x.getDate()}</b></div>`; }).join('');
  const vis = TILES.filter(t => !t.r || t.r.some(x => s.roles.includes(x))), groups = [];
  vis.forEach(t => { let g = groups.find(x => x.n === t._g); if (!g) groups.push(g = { n: t._g, items: [] }); g.items.push(t); });
  const M = St.dm || 'tp', MT = { tp: 'Nilai TP', rapor: 'Nilai rapor', final: 'Final' };
  $('#view').innerHTML = `
  ${p && !p.siap ? `<div class="alert">${ic('warn', 22)}<div><b>Persiapan belum selesai</b> (${p.selesai} dari ${p.total} langkah). Selesaikan dulu agar guru bisa mulai input nilai.</div><button class="btn pri" data-go="status">Buka checklist ${ic('arrow', 15)}</button></div>` : ''}
  <div class="dash">
    <div class="dcol">
      <div class="dc pu"><span class="pill">${h(b.sekolah.nama || 'Nama sekolah belum diisi')}</span>
        <div class="hi">${gr},<br>${h(s.nama)}</div>
        <div class="sub">TA ${h(s.tahun_ajaran)} · Semester ${h(s.semester)}${b.sekolah.npsn ? ' · NPSN ' + h(b.sekolah.npsn) : ''}</div>
        <div class="btns"><button class="btn" data-go="nilai">${ic('pen', 16)} Input nilai</button><button class="btn dkb" data-go="cetak">${ic('book', 16)} Cetak rapor</button></div></div>
      <div class="sg">
        <div class="sc"><div class="bub b1">${ic('users', 20)}</div><b>${b.siswa}</b><span>Siswa aktif</span></div>
        <div class="sc"><div class="bub b2">${ic('book', 20)}</div><b>${b.mapel}</b><span>Mapel</span></div>
        <div class="sc"><div class="bub b3">${ic('list', 20)}</div><b>${b.kelas}</b><span>Kelas</span></div></div>
      <div class="dc dk"><h3>Finalisasi rapor</h3><div class="sub">Nilai yang sudah dikunci</div>
        <div class="lb"><span class="big">${st.fin}%</span><span class="sub">${st.finN} dari ${st.finT}</span></div>
        <div class="pbar"><i style="width:${st.fin}%"></i></div>
        <div class="btns"><button class="btn" data-go="final">${ic('lock', 15)} Buka finalisasi</button></div></div>
    </div>
    <div class="dcol">
      <div class="dc wh"><div class="chd"><h3>Progres per kelas</h3>
        <div class="seg2" id="dm">${Object.keys(MT).map(k => `<button data-m="${k}" class="${k === M ? 'on' : ''}">${MT[k]}</button>`).join('')}</div></div>
        <div id="chart">${chartHtml(st, M)}</div></div>
      <div class="dc or"><h3>Nilai rapor terisi</h3><div class="sub">Seluruh kelas dan mapel</div>
        <div class="lb"><span class="big">${st.rapor}%</span><span class="pill">Nilai TP ${st.tp}%</span></div>
        <div class="pbar"><i style="width:${st.rapor}%"></i></div></div>
      <div class="dc wh"><h3>Mata pelajaran</h3><div class="chips2">${subj.length ? subj.map(i => `<button data-mk="${h(i.id_mapel_kelas)}">${h(i.nama_mapel)}</button>`).join('') : '<span class="muted small">Belum ada mapel aktif.</span>'}</div></div>
    </div>
    <div class="dcol">
      <div class="dc lv"><h3>Perlu dilengkapi</h3><div class="sub" style="margin-bottom:12px">Nilai TP paling sedikit terisi</div>
        ${need.length ? need.map((i, n) => `<button class="lrow" data-mk="${h(i.id_mapel_kelas)}"><span class="bub ${BUBS[n % 3]}">${ic('pen', 18)}</span><div><b>${h(i.nama_mapel)}</b><small>${h(i.nama_kelas)} · ${i.jumlah_siswa} siswa</small></div><span class="t">${i.progress_tp}%</span></button>`).join('')
          : `<div class="lrow" style="cursor:default"><span class="bub b3">${ic('check', 18)}</span><div><b>Semua nilai TP sudah terisi</b><small>Tidak ada yang perlu dikejar.</small></div></div>`}</div>
      <div class="dc dk"><h3>${BLN[now.getMonth()]} ${now.getFullYear()}</h3><div class="sub">Minggu ini</div><div class="wk">${wk}</div></div>
    </div>
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

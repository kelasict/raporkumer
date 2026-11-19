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
const hadirHtml = x => `<div class="row2"><table class="rp" style="width:42%"><thead><tr><th colspan="2">Ketidakhadiran</th></tr></thead><tbody><tr><td>Sakit</td><td class="c">${x.sakit || 0} hari</td></tr><tr><td>Izin</td><td class="c">${x.izin || 0} hari</td></tr><tr><td>Tanpa Keterangan</td><td class="c">${x.alpa || 0} hari</td></tr></tbody></table>
      <div class="ctt" style="flex:1;margin:0"><b>Catatan Wali Kelas:</b><br>${h(x.catatan_wali || '')}</div></div>`;

/** Rapor Sumatif Tengah Semester (STS): nilai sumatif & STS per mapel, tanpa deskripsi/ekskul/keputusan. */
function stsSheet(d, s) {
  const k = d.sekolah, kl = d.kelas, x = s.data || {};
  const groups = []; s.items.forEach(it => { let g = groups.find(y => y.n === it.kelompok); if (!g) groups.push(g = { n: it.kelompok, rows: [] }); g.rows.push(it); });
  let no = 0;
  const ket = it => it.sts == null ? '–' : it.sts >= it.kktp ? 'Tuntas' : 'Belum tuntas';
  const rows = groups.map(g => (g.n !== 'Umum' ? `<tr class="grp"><td colspan="6">${h(g.n === 'P5' ? 'Projek Penguatan Profil Pelajar Pancasila' : g.n)}</td></tr>` : '') +
    g.rows.map(it => `<tr><td class="c">${++no}</td><td>${h(it.mapel)}</td><td class="c">${rnd(it.kktp)}</td><td class="c">${rnd(it.sumatif)}</td><td class="c b">${rnd(it.sts)}</td><td class="c">${ket(it)}</td></tr>`).join('')).join('');
  const vals = s.items.filter(i => i.sts != null).map(i => i.sts), rata = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100 : null;
  return `<section class="sheet">${bgTag()}<div class="in">
    ${kopHtml('LAPORAN HASIL BELAJAR TENGAH SEMESTER (STS)', kopLines(k))}
    ${idnHtml(s, k, kl)}
    <table class="rp"><thead><tr><th style="width:5%">No</th><th>Muatan Pelajaran</th><th style="width:11%">KKTP</th><th style="width:16%">Nilai Sumatif<br><span style="font-weight:400;font-size:8.5pt">(rata-rata)</span></th><th style="width:13%">Nilai STS</th><th style="width:16%">Keterangan</th></tr></thead><tbody>${rows}
    <tr class="sum"><td colspan="4" class="c">Rata-rata nilai STS</td><td class="c">${rata == null ? '–' : String(rata).replace('.', ',')}</td><td></td></tr></tbody></table>
    ${hadirHtml(x)}
    ${ttdHtml(d, k)}</div></section>`;
}

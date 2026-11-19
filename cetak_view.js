async function viewCetak() {
  await kelasPicker('Cetak Rapor', async (body, tools) => {
    const [d] = await Promise.all([call('getCetakRapor', St.kelas), getCetakSet()]), T = d.total_mapel, n = d.siswa.length;
    const nFinal = d.siswa.filter(s => s.final).length, jenis = St.cj === 'sts' ? 'sts' : 'smt', sheet = jenis === 'sts' ? stsSheet : raporSheet, nm = jenis === 'sts' ? 'Rapor STS' : 'Rapor';
    tools.innerHTML = `<div class="seg" id="cj"><button data-j="smt" class="${jenis === 'smt' ? 'on' : ''}">Rapor Semester</button><button data-j="sts" class="${jenis === 'sts' ? 'on' : ''}">Rapor STS</button></div>
      <button class="btn" id="cSet">${ic('pen', 15)} Logo &amp; latar</button>${n ? `<button class="btn pri" id="cAll">${ic('book', 16)} Cetak semua (${n})</button>` : ''}`;
    $$('#cj button').forEach(b => b.onclick = () => { St.cj = b.dataset.j; go('cetak'); });
    $('#cSet').onclick = () => cetakSettingModal();
    const open = i => openPreview(`${nm} · ${d.siswa[i].nama}`, '', { nav: { n, i, render: j => ({ title: `${nm} · ${d.siswa[j].nama}`, html: sheet(d, d.siswa[j]) }) } });
    if (n) $('#cAll').onclick = () => openPreview(`${nm} ${d.kelas.nama_kelas} · ${n} siswa`, d.siswa.map(s => sheet(d, s)).join(''));
    const st = s => s.final ? '<span class="chip ok">' + ic('lock', 12) + ' Final</span>' : s.lengkap === T && T ? '<span class="chip info">Lengkap · belum final</span>' : `<span class="chip warn">Belum lengkap (${s.lengkap}/${T})</span>`;
    const hasSts = s => s.items.filter(i => i.sts != null).length;
    body.innerHTML = jenis === 'sts' ? `<div class="note info" style="margin-bottom:12px">${ic('info')}<div><b>Rapor STS</b> memuat nilai sumatif (rata-rata) dan nilai STS tiap mapel, tanpa deskripsi capaian. Isi nilai STS di menu <b>Input Nilai</b>. Dapat dicetak kapan saja (tanpa finalisasi).</div></div>`
      : nFinal < n ? `<div class="note warn" style="margin-bottom:12px">${ic('warn')}<div>Rapor yang belum difinalisasi dicetak dengan tanda air <b>DRAFT</b>. Finalisasi dulu di menu <b>Finalisasi Rapor</b> untuk cetak resmi.</div></div>` : '';
    body.innerHTML += `<div class="card"><div class="tw"><table><thead><tr><th class="c" style="width:56px">No</th><th>Nama siswa</th><th>NISN</th><th class="c">${jenis === 'sts' ? 'STS terisi' : 'Mapel terisi'}</th><th class="c">Rata-rata</th><th>Status</th><th></th></tr></thead><tbody>
    ${d.siswa.map((s, i) => `<tr><td class="c muted">${h(s.no_absen || i + 1)}</td><td><b>${h(s.nama)}</b></td><td>${h(s.nisn)}</td><td class="c">${jenis === 'sts' ? hasSts(s) : s.lengkap}/${T}</td><td class="c avg">${jenis === 'sts' ? (() => { const v = s.items.filter(x => x.sts != null).map(x => x.sts); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 100) / 100 : '–'; })() : s.rata == null ? '–' : s.rata}</td><td>${jenis === 'sts' ? (hasSts(s) === T && T ? '<span class="chip info">STS lengkap</span>' : `<span class="chip warn">Belum lengkap</span>`) : st(s)}</td><td style="text-align:right"><button class="btn sm pri" data-p="${i}">${ic('book', 14)} Lihat & cetak</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Belum ada siswa di kelas ini.</td></tr>'}</tbody></table></div></div>`;
    $$('[data-p]', body).forEach(b => b.onclick = () => open(+b.dataset.p));
  });
}


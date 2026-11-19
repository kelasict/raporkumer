/* ----------------------------------------------------------------------------
 *  TP (07_TUJUAN_PEMBELAJARAN)
 * -------------------------------------------------------------------------- */

function getTpList(idMK) {
  return wrap_(function () {
    var a = mkAuth_(idMK);
    var list = tpFor_(a.mk.id_mapel, a.kelas, false)
      .map(function (t) { return { id_tp: t.id_tp, kode_tp: t.kode_tp, deskripsi_tp: t.deskripsi_tp, urutan: num_(t.urutan), aktif: notFalse_(t.aktif), lama: !t.tingkat }; });
    return { ok: true, mk: { nama_mapel: a.mapel.nama_mapel, fase: a.kelas.fase, tingkat: a.kelas.tingkat, nama_kelas: a.kelas.nama_kelas }, items: list };
  });
}

/** Simpan banyak baris TP sekaligus (gaya spreadsheet) untuk TINGKAT kelas terpilih. Semua-atau-tidak-sama-sekali. Panjang deskripsi tidak dibatasi. */
function saveTpBatch(idMK, items) {
  return wrap_(function () {
    return withLock_(function () {
      var a = mkAuth_(idMK), t = table_(S.TP), ting = a.kelas.tingkat;
      if (!items || !items.length) throw new Error('Tidak ada baris untuk disimpan.');
      if (items.length > 300) throw new Error('Maksimal 300 baris per simpan.');
      var mine = tpFor_(a.mk.id_mapel, a.kelas, false);
      var byId = idx_(mine, 'id_tp'), errors = [], warns = [], plan = [], seq = 0, used = {};
      items.forEach(function (tp, i) {
        var kode = String(tp.kode_tp || '').trim(), desk = String(tp.deskripsi_tp || '').trim(), no = i + 1;
        if (!tp.id_tp && !kode && !desk) return;                          // baris kosong diabaikan
        seq++;
        var urut = num_(tp.urutan); if (urut === null) urut = seq;
        if (!kode) kode = 'TP ' + seq;
        var err = '';
        if (!desk) err = 'deskripsi TP wajib diisi';
        else if (desk.length > 5000) err = 'deskripsi terlalu panjang (maks 5000 karakter)';
        else if (urut < 1) err = 'urutan harus angka >= 1';
        else if (tp.id_tp && !byId[tp.id_tp]) err = 'TP tidak ditemukan untuk mapel & tingkat ini';
        else if (used[kode.toLowerCase()]) err = 'kode "' + kode + '" dobel';
        if (err) { errors.push('Baris ' + no + ': ' + err); return; }
        used[kode.toLowerCase()] = 1;
        plan.push({ id_tp: tp.id_tp || '', kode: kode, desk: desk, urut: urut, aktif: tp.aktif !== false });
      });
      if (errors.length) throw new Error(errors.length + ' baris bermasalah, tidak ada yang disimpan:\n' + errors.slice(0, 10).join('\n') + (errors.length > 10 ? '\n…' : ''));
      var planIds = {}; plan.forEach(function (p) { if (p.id_tp) planIds[p.id_tp] = 1; });
      mine.forEach(function (r) { if (!planIds[r.id_tp] && used[String(r.kode_tp).toLowerCase()]) errors.push('Kode "' + r.kode_tp + '" bentrok dengan TP lain yang tidak ikut disimpan.'); });
      if (errors.length) throw new Error(errors.join('\n'));
      var kodeMapel = String(a.mapel.kode_mapel || a.mapel.id_mapel.replace(/^MPL-/, '')).toUpperCase(), upd = 0, added = [];
      plan.forEach(function (p) {
        var ex = p.id_tp ? byId[p.id_tp] : null;
        if (ex) {
          if (!ex.tingkat && !p.aktif) return;                            // TP lama yang tidak dicentang: dibiarkan (milik tingkat lain)
          var claim = !ex.tingkat;                                        // TP lama: kunci ke tingkat ini
          if (claim || ex.kode_tp !== p.kode || ex.deskripsi_tp !== p.desk || num_(ex.urutan) !== p.urut || notFalse_(ex.aktif) !== p.aktif) {
            log_(S.TP, 'UPDATE', ex.id_tp, ex.kode_tp + ' | ' + ex.deskripsi_tp + ' | ' + ex.aktif, p.kode + ' | ' + p.desk + ' | ' + p.aktif, 'tingkat ' + ting);
            ex.kode_tp = p.kode; ex.deskripsi_tp = p.desk; ex.urutan = p.urut; ex.aktif = p.aktif; ex.tingkat = ting; upd++;
          }
        } else {
          var id = 'TP-' + kodeMapel + '-' + a.kelas.fase + ting + '-' + pad_(p.urut, 3), base = id, n = 1;
          while (t.rows.some(function (r) { return r.id_tp === id; }) || added.some(function (r) { return r.id_tp === id; })) id = base + '-' + (++n);
          added.push({ id_tp: id, id_mapel: a.mk.id_mapel, fase: a.kelas.fase, kode_tp: p.kode, deskripsi_tp: p.desk, urutan: p.urut, aktif: p.aktif, tingkat: ting });
          log_(S.TP, 'INSERT', id, '', p.kode + ' | ' + p.desk, 'tingkat ' + ting);
        }
      });
      if (upd) writeAll_(t);
      if (added.length) appendObjs_(t, added);
      return { ok: true, updated: upd, added: added.length, warnings: warns };
    });
  });
}

/* ----------------------------------------------------------------------------
 *  REKAP, FINALISASI, ADMIN
 * -------------------------------------------------------------------------- */

function walAuth_(idKelas) {
  var s = session_();
  var k = idx_(table_(S.KELAS).rows, 'id_kelas')[idKelas]; if (!k) throw new Error('Kelas tidak ditemukan.');
  return { s: s, kelas: k };
}

function rekapRows_(idKelas) {
  var c = cfg_(), mapel = idx_(table_(S.MAPEL).rows, 'id_mapel'), kelas = idx_(table_(S.KELAS).rows, 'id_kelas');
  var naIdx = naIndex_(), ntpBy = groupBy_(table_(S.NTP).rows, function (r) { return r.id_anggota + '|' + r.id_mapel; });
  var capIdx = {}; table_(S.CAP).rows.forEach(function (r) { capIdx[r.id_anggota + '|' + r.id_mapel] = r; });
  var kls = idKelas ? [idKelas] : Object.keys(kelas).filter(function (k) { return kelas[k].status === 'Aktif'; });
  var rows = [];
  kls.forEach(function (kid) {
    var mks = table_(S.MK).rows.filter(function (m) { return m.id_kelas === kid && m.status === 'Aktif'; });
    anggotaAktif_(kid).forEach(function (a) {
      mks.forEach(function (mk) {
        var key = a.id_anggota + '|' + mk.id_mapel, vals = (ntpBy[key] || []).map(nf_).filter(function (v) { return v !== null; });
        var rata = vals.length ? round2_(vals.reduce(function (s, v) { return s + v; }, 0) / vals.length) : null, na = naIdx[key] || {}, mp = mapel[mk.id_mapel] || {};
        var rp = hitungNA_(na, c).nilai_rapor;
        rows.push({ id_anggota: a.id_anggota, nisn: a.nisn, nama: a.nama, kelas: kelas[kid].nama_kelas, id_mapel: mk.id_mapel, mapel: mp.nama_mapel || mk.id_mapel, kelompok: mp.kelompok || 'Umum', kktp: kktp_(mp),
          rata_rata_tp: rata, nilai_rapor: rp, predikat: rp === null ? '' : predikat_(rp, mp).kode, deskripsi: capIdx[key] ? capIdx[key].deskripsi_rapor : '', final: !!isTrue_(na.status_final) });
      });
    });
  });
  return rows;
}

function getRekap(idKelas) {
  return wrap_(function () {
    var w = walAuth_(idKelas), rows = rekapRows_(idKelas), c = cfg_();
    var done = rows.filter(function (r) { return r.nilai_rapor !== null; }).length;
    var fin = rows.filter(function (r) { return r.final; }).length;
    return { ok: true, kelas: { id_kelas: idKelas, nama_kelas: w.kelas.nama_kelas }, rows: rows, lengkap: done, total: rows.length, final: fin, batas_tuntas: c.batas_tuntas };
  });
}

function refreshRekap() {
  return wrap_(function () {
    adminOrOwner_();
    return withLock_(function () {
      var rows = rekapRows_(null), sh = ss_().getSheetByName(S.REKAP);
      if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 8).clearContent();
      if (rows.length) sh.getRange(2, 1, rows.length, 8).setValues(rows.map(function (r) { return [r.nisn, r.nama, r.kelas, r.mapel, out_(r.rata_rata_tp), out_(r.nilai_rapor), r.predikat, r.deskripsi]; }));
      return { ok: true, baris: rows.length };
    });
  });
}

function finalisasiKelas(idKelas, paksa) {
  return wrap_(function () {
    return withLock_(function () {
      var w = walAuth_(idKelas), c = cfg_();
      var mks = table_(S.MK).rows.filter(function (m) { return m.id_kelas === idKelas && m.status === 'Aktif'; });
      var ang = anggotaAktif_(idKelas), mapel = idx_(table_(S.MAPEL).rows, 'id_mapel'), missing = [];
      var rows = rekapRows_(idKelas);
      rows.forEach(function (r) { if (r.nilai_rapor === null) missing.push(r.nama + ' - ' + r.mapel); });
      if (missing.length && !(paksa && w.s.admin)) {
        return { ok: false, error: missing.length + ' nilai rapor belum lengkap. Lengkapi nilai sumatif/STS/SAS terlebih dahulu.', missing: missing.slice(0, 30) };
      }
      if (!c.bobot_valid) return { ok: false, error: 'Total bobot di _CONFIG = ' + c.bobot_total + ' (harus 100). Perbaiki sebelum finalisasi.' };
      var ensure = [], aIds = {}; ang.forEach(function (a) { aIds[a.id_anggota] = 1; mks.forEach(function (m) { ensure.push({ id_anggota: a.id_anggota, id_mapel: m.id_mapel }); }); });
      ensureNA_(ensure);
      var t = table_(S.NA), n = 0, tgl = now_();
      var mapelIds = {}; mks.forEach(function (m) { mapelIds[m.id_mapel] = 1; });
      t.rows.forEach(function (r) {
        if (aIds[r.id_anggota] && mapelIds[r.id_mapel] && !isTrue_(r.status_final)) { r.status_final = true; r.tanggal_finalisasi = tgl; n++; log_(S.NA, 'FINALIZE', r.id_nilai_akhir, 'FALSE', 'TRUE', w.kelas.nama_kelas); }
      });
      writeCols_(t, ['status_final', 'tanggal_finalisasi']);
      return { ok: true, count: n, kelas: w.kelas.nama_kelas };
    });
  });
}

function bukaKunciKelas(idKelas, alasan) {
  return wrap_(function () {
    return withLock_(function () {
      var s = session_(); if (!s.admin) throw new Error('Hanya admin yang dapat membuka kunci finalisasi.');
      alasan = String(alasan || '').trim(); if (alasan.length < 10) throw new Error('Alasan wajib diisi (minimal 10 karakter).');
      var aIds = {}; anggotaAktif_(idKelas).forEach(function (a) { aIds[a.id_anggota] = 1; });
      var t = table_(S.NA), n = 0;
      t.rows.forEach(function (r) { if (aIds[r.id_anggota] && isTrue_(r.status_final)) { r.status_final = false; r.tanggal_finalisasi = ''; n++; log_(S.NA, 'UPDATE', r.id_nilai_akhir, 'status_final=TRUE', 'status_final=FALSE', 'BUKA KUNCI: ' + alasan); } });
      writeCols_(t, ['status_final', 'tanggal_finalisasi']);
      return { ok: true, count: n };
    });
  });
}

function getAdminOverview() {
  return wrap_(function () {
    var s = session_(); if (!s.admin) throw new Error('Hanya admin.');
    var kelas = table_(S.KELAS).rows.filter(function (k) { return k.status === 'Aktif'; });
    var rows = rekapRows_(null), by = groupBy_(rows, function (r) { return r.kelas; });
    var ringkas = kelas.map(function (k) {
      var rs = by[k.nama_kelas] || [], ok = rs.filter(function (r) { return r.nilai_rapor !== null; }).length, fin = rs.filter(function (r) { return r.final; }).length;
      return { id_kelas: k.id_kelas, nama_kelas: k.nama_kelas, siswa: anggotaAktif_(k.id_kelas).length, total: rs.length, lengkap: ok, final: fin };
    });
    var lg = table_(S.LOG); var recent = lg.rows.slice(-25).reverse().map(function (r) { return { waktu: r.timestamp, user: r.user_email, sheet: r.sheet, aksi: r.aksi, ref: r.id_referensi, ket: r.keterangan }; });
    var siswaAktif = table_(S.SISWA).rows.filter(function (x) { return x.status === 'Aktif'; }).length;
    return { ok: true, siswa_aktif: siswaAktif, guru: table_(S.GURU).rows.filter(function (g) { return g.status === 'Aktif'; }).length, kelas: ringkas, log: recent };
  });
}


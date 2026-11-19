/* ============================================================================
 *  API PUBLIK (dipanggil Web App via google.script.run)
 * ========================================================================== */

/** Info akun yang sedang login + pengaturan (dipanggil lewat rpc setelah login). */
function getSessionInfo() {
  return wrap_(function () {
    var s = session_(), c = cfg_();
    return {
      ok: true, username: s.username, nama: s.nama, id_guru: s.id_guru, roles: s.roles, admin: s.admin, sekolah: sekolah_().nama,
      tahun_ajaran: c.tahun_ajaran, semester: c.semester,
      config: { batas_tuntas: c.batas_tuntas, kktp_b: c.kktp_b, kktp_a: c.kktp_a, max_char: c.max_char, bobot_sumatif: c.bobot_sumatif, bobot_sas: c.bobot_sas, bobot_valid: c.bobot_valid, bobot_total: c.bobot_total }
    };
  });
}

/** Satu panggilan untuk memuat dashboard: sesi + ringkasan + daftar tugas (mengurangi bolak-balik jaringan). */
function getBoot() {
  var info = getSessionInfo();
  if (!info.ok) return info;
  var ber = getBeranda(), asg = getAssignments();
  return { ok: true, info: info, beranda: ber, asg: asg };
}

/** Semua guru melihat semua kelas & mapel aktif (tidak ada penugasan per guru). */
function getAssignments() {
  return wrap_(function () {
    session_();
    var ck = CacheService.getScriptCache();
    if (ck.get('mk_ok') !== '1') { if (needSyncMK_()) withLock_(function () { syncMK_(); }); else ck.put('mk_ok', '1', 600); }
    var kelas = idx_(table_(S.KELAS).rows, 'id_kelas'), mapel = idx_(table_(S.MAPEL).rows, 'id_mapel');
    var ntpBy = groupBy_(table_(S.NTP).rows, function (r) { return r.id_anggota + '|' + r.id_mapel; });
    var naIdx = naIndex_(), capIdx = {};
    table_(S.CAP).rows.forEach(function (r) { capIdx[r.id_anggota + '|' + r.id_mapel] = r; });
    function build(mk) {
      var k = kelas[mk.id_kelas], m = mapel[mk.id_mapel]; if (!k || !m) return null;
      var ang = anggotaAktif_(k.id_kelas), tps = tpAktif_(mk.id_mapel, k), tpIds = {};
      tps.forEach(function (t) { tpIds[t.id_tp] = 1; });
      var filled = 0, cap = 0, fin = 0, rapor = 0;
      ang.forEach(function (a) {
        var key = a.id_anggota + '|' + mk.id_mapel;
        filled += (ntpBy[key] || []).filter(function (r) { return tpIds[r.id_tp] && num_(r.nilai) !== null; }).length;
        if (capIdx[key]) cap++;
        var na = naIdx[key]; if (na) { if (isTrue_(na.status_final)) fin++; if (num_(na.nilai_rapor) !== null) rapor++; }
      });
      var denom = ang.length * tps.length;
      return {
        id_mapel_kelas: mk.id_mapel_kelas, id_kelas: k.id_kelas, nama_kelas: k.nama_kelas, fase: k.fase, id_mapel: m.id_mapel, nama_mapel: m.nama_mapel,
        jumlah_siswa: ang.length, jumlah_tp: tps.length,
        progress_tp: denom ? Math.round(filled * 100 / denom) : 0, capaian: cap, rapor_terisi: rapor, final: fin
      };
    }
    var items = table_(S.MK).rows.filter(function (mk) { return mk.status === 'Aktif'; }).map(build).filter(Boolean)
      .sort(function (a, b) { return String(a.nama_kelas).localeCompare(String(b.nama_kelas)) || 0; });
    var wali = Object.keys(kelas).filter(function (id) { return kelas[id].status === 'Aktif'; }).map(function (id) {
      var ang = anggotaAktif_(id), mks = table_(S.MK).rows.filter(function (m) { return m.id_kelas === id && m.status === 'Aktif'; });
      var fin = 0, tot = ang.length * mks.length;
      ang.forEach(function (a) { mks.forEach(function (m) { var na = naIdx[a.id_anggota + '|' + m.id_mapel]; if (na && isTrue_(na.status_final)) fin++; }); });
      return { id_kelas: id, nama_kelas: kelas[id].nama_kelas, jumlah_siswa: ang.length, jumlah_mapel: mks.length, final: fin, total: tot };
    });
    return { ok: true, items: items, wali: wali };
  });
}

function getFormData(idMK) {
  return wrap_(function () {
    var a = mkAuth_(idMK);
    var siswa = anggotaAktif_(a.kelas.id_kelas), tps = tpAktif_(a.mk.id_mapel, a.kelas), naIdx = naIndex_();
    var tpIds = {}; tps.forEach(function (t) { tpIds[t.id_tp] = 1; });
    var aIds = {}; siswa.forEach(function (x) { aIds[x.id_anggota] = 1; });
    var nilai = {};
    table_(S.NTP).rows.forEach(function (r) {
      if (r.id_mapel === a.mk.id_mapel && aIds[r.id_anggota] && tpIds[r.id_tp]) nilai[r.id_anggota + '|' + r.id_tp] = { nilai: num_(r.nilai), remedial: num_(r.nilai_remedial) };
    });
    siswa.forEach(function (x) { var na = naIdx[x.id_anggota + '|' + a.mk.id_mapel]; x.locked = !!(na && isTrue_(na.status_final)); });
    return {
      ok: true, mk: { id_mapel_kelas: idMK, id_kelas: a.kelas.id_kelas, nama_kelas: a.kelas.nama_kelas, fase: a.kelas.fase, id_mapel: a.mk.id_mapel, nama_mapel: a.mapel.nama_mapel },
      siswa: siswa, tp: tps.map(function (t) { return { id_tp: t.id_tp, kode_tp: t.kode_tp, deskripsi_tp: t.deskripsi_tp, urutan: t.urutan }; }), nilai: nilai
    };
  });
}

function saveNilaiTp(idMK, items) {
  return wrap_(function () {
    return withLock_(function () {
      var a = mkAuth_(idMK), c = cfg_(), idm = a.mk.id_mapel;
      if (!items || !items.length) throw new Error('Tidak ada data untuk disimpan.');
      var ang = {}; anggotaAktif_(a.kelas.id_kelas).forEach(function (x) { ang[x.id_anggota] = x; });
      var tpById = idx_(tpAktif_(idm, a.kelas), 'id_tp');
      var t = table_(S.NTP), idx = {};
      t.rows.forEach(function (r) { idx[r.id_anggota + '|' + r.id_tp] = r; });
      var na = naIndex_(), errors = [], ins = [], upd = 0, skipped = 0, locked = 0, touched = {}, updTouched = false;
      var tgl = now_();

      items.forEach(function (it) {
        var label = (ang[it.id_anggota] ? ang[it.id_anggota].nama : it.id_anggota) + ' / ' + (tpById[it.id_tp] ? tpById[it.id_tp].kode_tp : it.id_tp);
        if (!ang[it.id_anggota]) { errors.push(label + ': siswa bukan anggota aktif kelas ini'); return; }
        if (!tpById[it.id_tp]) { errors.push(label + ': TP tidak valid untuk mapel/tingkat kelas ini'); return; }
        var nilai = num_(it.nilai), rem = num_(it.nilai_remedial);
        if (nilai !== null && !isInt100_(nilai)) { errors.push(label + ': nilai harus bilangan bulat 0-100'); return; }
        if (rem !== null && !isInt100_(rem)) { errors.push(label + ': nilai remedial harus bilangan bulat 0-100'); return; }
        var nar = na[it.id_anggota + '|' + idm];
        if (nar && isTrue_(nar.status_final)) { locked++; return; }
        var key = it.id_anggota + '|' + it.id_tp, ex = idx[key];
        if (!ex) {
          if (nilai === null) { skipped++; return; }
          var o = { id_nilai_tp: newId_('NTP'), id_anggota: it.id_anggota, id_mapel: idm, id_tp: it.id_tp, nilai: nilai, nilai_remedial: rem === null ? '' : rem, nilai_final: '', jenis_sumatif: it.jenis_sumatif || 'Sumatif', tanggal_input: tgl, id_guru: a.sess.id_guru || a.sess.email, catatan: it.catatan || '' };
          ins.push(o); idx[key] = o;
          log_(S.NTP, 'INSERT', o.id_nilai_tp, '', nilai + (rem !== null ? ' (rem ' + rem + ')' : ''), key);
        } else {
          var oldN = num_(ex.nilai), oldR = num_(ex.nilai_remedial);
          var newN = nilai === null ? oldN : nilai;
          if (oldN === newN && oldR === rem) { skipped++; return; }
          ex.nilai = newN; ex.nilai_remedial = rem === null ? '' : rem; ex.tanggal_input = tgl; ex.id_guru = a.sess.id_guru || a.sess.email;
          upd++; updTouched = true;
          log_(S.NTP, 'UPDATE', ex.id_nilai_tp, oldN + (oldR !== null ? '/' + oldR : ''), newN + (rem !== null ? '/' + rem : ''), key);
        }
        touched[it.id_anggota + '|' + idm] = { id_anggota: it.id_anggota, id_mapel: idm };
      });

      if (updTouched) { writeCols_(t, ['nilai', 'nilai_remedial']); writeCols_(t, ['tanggal_input', 'id_guru']); }
      var newOnly = ins.filter(function (o) { return t.rows.indexOf(o) < 0; });
      if (newOnly.length) {
        var start = appendObjs_(t, newOnly), L = colLetter_(colIdx_(t, 'nilai')), R = colLetter_(colIdx_(t, 'nilai_remedial')), f = [];
        for (var i = 0; i < newOnly.length; i++) { var rr = start + i; f.push(['=IF(' + L + rr + '="","",MAX(' + L + rr + ',N(' + R + rr + ')))']); }
        t.sh.getRange(start, colIdx_(t, 'nilai_final'), newOnly.length, 1).setFormulas(f);
      }

      var pairs = Object.keys(touched).map(function (k) { return touched[k]; });
      ensureNA_(pairs);
      var ctx = genCtx_(), res = { generated: 0, incomplete: 0, override: 0 };
      var results = pairs.map(function (p) { return { p: p, r: computeCap_(ctx, p.id_anggota, p.id_mapel, false) }; });
      persistCap_(ctx, results, res);

      return {
        ok: true, inserted: ins.length, updated: upd, skipped: skipped, locked: locked, errors: errors.slice(0, 15), error_count: errors.length,
        deskripsi_generated: res.generated, deskripsi_skipped_incomplete: res.incomplete, deskripsi_skipped_override: res.override
      };
    });
  });
}

var NA_VAL = ['sum_1', 'sum_2', 'sum_3', 'sum_4', 'sum_5', 'sum_6', 'sum_7', 'sum_8', 'sum_9', 'sum_10', 'nilai_sts', 'nilai_non_tes', 'nilai_tes', 'na_sumatif', 'na_sas', 'nilai_rapor', 'predikat'];

function getAkhirData(idMK) {
  return wrap_(function () {
    var a = mkAuth_(idMK), c = cfg_(), idm = a.mk.id_mapel;
    var siswa = anggotaAktif_(a.kelas.id_kelas), naIdx = naIndex_(), k = kktp_(a.mapel);
    var out = siswa.map(function (x) {
      var na = naIdx[x.id_anggota + '|' + idm] || {}, sum = [];
      for (var i = 1; i <= 10; i++) sum.push(num_(na['sum_' + i]));
      var h = hitungNA_(na, c);
      return { id_anggota: x.id_anggota, no_absen: x.no_absen, nisn: x.nisn, nama: x.nama, sum: sum, sts: num_(na.nilai_sts), non_tes: num_(na.nilai_non_tes), tes: num_(na.nilai_tes),
        na_sumatif: num_(h.na_sumatif), na_sas: num_(h.na_sas), nilai_rapor: h.nilai_rapor, predikat: h.nilai_rapor === null ? '' : predikat_(h.nilai_rapor, a.mapel).kode, locked: !!isTrue_(na.status_final) };
    });
    return { ok: true, mk: { id_mapel_kelas: idMK, nama_kelas: a.kelas.nama_kelas, nama_mapel: a.mapel.nama_mapel }, siswa: out, kktp: k, bobot: { sumatif: c.bobot_sumatif, sas: c.bobot_sas, valid: c.bobot_valid, total: c.bobot_total } };
  });
}

/** items: [{id_anggota, sum:[10 nilai], sts, non_tes, tes}] — nilai kosong boleh. */
function saveNilaiAkhir(idMK, items) {
  return wrap_(function () {
    return withLock_(function () {
      var a = mkAuth_(idMK), c = cfg_(), idm = a.mk.id_mapel;
      if (!items || !items.length) throw new Error('Tidak ada data untuk disimpan.');
      var ang = {}; anggotaAktif_(a.kelas.id_kelas).forEach(function (x) { ang[x.id_anggota] = x; });
      var errors = [], saved = 0, locked = 0, pairs = [], valid = [];
      items.forEach(function (it) {
        var nm = ang[it.id_anggota] ? ang[it.id_anggota].nama : it.id_anggota;
        if (!ang[it.id_anggota]) { errors.push(nm + ': bukan anggota aktif kelas ini'); return; }
        var vals = {}, bad = false;
        for (var i = 0; i < 10; i++) { var v = num_(it.sum && it.sum[i]); if (v !== null && !isInt100_(v)) bad = true; vals['sum_' + (i + 1)] = v; }
        ['sts', 'non_tes', 'tes'].forEach(function (f) { var v = num_(it[f]); if (v !== null && !isInt100_(v)) bad = true; vals[f === 'sts' ? 'nilai_sts' : 'nilai_' + f] = v; });
        if (bad) { errors.push(nm + ': nilai harus bilangan bulat 0-100'); return; }
        valid.push({ id_anggota: it.id_anggota, vals: vals });
        pairs.push({ id_anggota: it.id_anggota, id_mapel: idm });
      });
      ensureNA_(pairs);
      var tb = table_(S.NA), idx = naIndex_();
      valid.forEach(function (v) {
        var r = idx[v.id_anggota + '|' + idm];
        if (isTrue_(r.status_final)) { locked++; return; }
        var old = r.nilai_rapor;
        Object.keys(v.vals).forEach(function (k) { r[k] = v.vals[k] === null ? '' : v.vals[k]; });
        recalcNA_(r, a.mapel); saved++;
        log_(S.NA, 'UPDATE', r.id_nilai_akhir, old, r.nilai_rapor, 'sumatif/STS/SAS; bobot ' + c.bobot_sumatif + '/' + c.bobot_sas);
      });
      writeCols_(tb, NA_VAL);
      return { ok: true, saved: saved, locked: locked, errors: errors, warning: c.bobot_valid ? '' : 'Total bobot di _CONFIG = ' + c.bobot_total + ' (bukan 100). Nilai tersimpan, namun periksa pengaturan bobot.' };
    });
  });
}

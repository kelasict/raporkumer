/* ============================================================================
 *  DATA RAPOR SISWA — ekstrakurikuler, kehadiran, catatan wali, keputusan
 *  (setara lembar EKS & NOTE pada file Excel rapor). Diisi wali kelas/admin.
 * ========================================================================== */

var DR_TEXT = ['ekskul_1', 'predikat_1', 'ket_1', 'ekskul_2', 'predikat_2', 'ket_2', 'ekskul_3', 'predikat_3', 'ket_3', 'tinggi_badan', 'berat_badan', 'kondisi_kesehatan', 'prestasi', 'catatan_wali', 'keputusan'];
var DR_NUM = ['sakit', 'izin', 'alpa'];
var DR_PREDIKAT = ['', 'Sangat Baik', 'Baik', 'Cukup', 'Kurang'];
var DR_KEPUTUSAN = ['', 'Naik', 'Tinggal', 'Lulus'];

function drIndex_() { return idx_(table_(S.DR).rows, 'id_anggota'); }

function drBlank_() {
  var o = {}; DR_TEXT.forEach(function (k) { o[k] = ''; }); DR_NUM.forEach(function (k) { o[k] = 0; }); return o;
}

function drOut_(r) {
  var o = drBlank_();
  if (r) { DR_TEXT.forEach(function (k) { o[k] = r[k] === undefined || r[k] === null ? '' : String(r[k]); }); DR_NUM.forEach(function (k) { o[k] = num_(r[k]) || 0; }); }
  return o;
}

function getDataRapor(idKelas) {
  return wrap_(function () {
    var w = walAuth_(idKelas), idx = drIndex_();
    var siswa = anggotaAktif_(idKelas).map(function (a) { var o = drOut_(idx[a.id_anggota]); o.id_anggota = a.id_anggota; o.no_absen = a.no_absen; o.nama = a.nama; return o; });
    return { ok: true, kelas: { id_kelas: idKelas, nama_kelas: w.kelas.nama_kelas, tingkat: w.kelas.tingkat, semester: w.kelas.semester }, siswa: siswa, opsi: { predikat: DR_PREDIKAT.slice(1), keputusan: DR_KEPUTUSAN.slice(1) } };
  });
}

/** items: [{id_anggota, ...field}] — hanya field yang dikirim yang diubah. */
function saveDataRapor(idKelas, items) {
  return wrap_(function () {
    walAuth_(idKelas);
    return withLock_(function () {
      if (!items || !items.length) throw new Error('Tidak ada data untuk disimpan.');
      var ang = {}; anggotaAktif_(idKelas).forEach(function (a) { ang[a.id_anggota] = a; });
      var t = table_(S.DR), idx = idx_(t.rows, 'id_anggota'), errors = [], add = [], saved = 0;
      items.forEach(function (it) {
        var a = ang[it.id_anggota]; if (!a) { errors.push(it.id_anggota + ': bukan anggota aktif kelas ini'); return; }
        var upd = {}, bad = '';
        DR_TEXT.forEach(function (k) {
          if (it[k] === undefined) return;
          var v = String(it[k] === null ? '' : it[k]).trim();
          if (v.length > 600) bad = k + ' terlalu panjang (maks 600 karakter)';
          if (/^predikat_/.test(k) && DR_PREDIKAT.indexOf(v) < 0) bad = 'Predikat ekstrakurikuler harus ' + DR_PREDIKAT.slice(1).join('/');
          if (k === 'keputusan' && DR_KEPUTUSAN.indexOf(v) < 0) bad = 'Keputusan harus ' + DR_KEPUTUSAN.slice(1).join('/');
          upd[k] = v;
        });
        DR_NUM.forEach(function (k) {
          if (it[k] === undefined) return;
          var n = num_(it[k]); if (n === null) n = 0;
          if (!Number.isInteger(n) || n < 0 || n > 366) bad = 'Jumlah ' + k + ' harus bilangan bulat 0-366';
          upd[k] = n;
        });
        if (bad) { errors.push(a.nama + ': ' + bad); return; }
        var ex = idx[it.id_anggota];
        if (!ex) { ex = drBlank_(); ex.id_anggota = it.id_anggota; add.push(ex); idx[it.id_anggota] = ex; }
        Object.keys(upd).forEach(function (k) { ex[k] = upd[k]; });
        saved++; log_(S.DR, 'UPDATE', it.id_anggota, '', Object.keys(upd).join(','), 'data rapor siswa');
      });
      if (add.length) appendObjs_(t, add);
      writeCols_(t, DR_TEXT.concat(DR_NUM));
      return { ok: true, saved: saved, errors: errors };
    });
  });
}

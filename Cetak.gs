/* ============================================================================
 *  CETAK — beranda, identitas sekolah, leger nilai, data cetak rapor per siswa
 * ========================================================================== */

var SEKOLAH_KEYS = ['nama', 'npsn', 'nss', 'alamat', 'kode_pos', 'desa', 'kecamatan', 'kabupaten', 'provinsi', 'website', 'email', 'kepala', 'nip_kepala', 'kota_ttd', 'tanggal_rapor'];
var KELOMPOK_URUT = { 'Umum': 1, 'Muatan Lokal': 2, 'P5': 3 };

/** Identitas sekolah disimpan di _CONFIG dengan awalan "sekolah_". */
function sekolah_() {
  var m = {}; table_(S.CONFIG).rows.forEach(function (r) { if (r.key) m[r.key] = r.value; });
  var o = {}; SEKOLAH_KEYS.forEach(function (k) { var v = m['sekolah_' + k]; o[k] = v === undefined || v === null ? '' : String(v); });
  return o;
}

function getSekolah() {
  return wrap_(function () { adminOnly_(); return { ok: true, values: sekolah_() }; });
}

function saveSekolah(v) {
  return wrap_(function () {
    adminOnly_();
    return withLock_(function () {
      var out = {};
      SEKOLAH_KEYS.forEach(function (k) { out[k] = String(v && v[k] !== undefined && v[k] !== null ? v[k] : '').trim(); });
      if (!out.nama) throw new Error('Nama sekolah wajib diisi.');
      if (out.npsn && !/^\d{8}$/.test(out.npsn)) throw new Error('NPSN harus 8 digit angka.');
      if (out.tanggal_rapor && !/^\d{4}-\d{2}-\d{2}$/.test(out.tanggal_rapor)) throw new Error('Tanggal rapor harus berformat yyyy-mm-dd.');
      var t = table_(S.CONFIG), idx = idx_(t.rows, 'key'), add = [];
      SEKOLAH_KEYS.forEach(function (k) {
        var key = 'sekolah_' + k, row = idx[key];
        if (row) {
          if (String(row.value) !== out[k]) { log_(S.CONFIG, 'UPDATE', key, row.value, out[k], 'identitas sekolah'); row.value = out[k]; }
        } else { add.push({ key: key, value: out[k], keterangan: 'Identitas sekolah' }); }
      });
      writeCols_(t, ['value']);
      if (add.length) {   // format teks dulu agar NPSN/NIP tidak berubah jadi angka
        var start = t.sh.getLastRow() + 1, rg = t.sh.getRange(start, 1, add.length, 3);
        rg.setNumberFormats(add.map(function () { return ['@', '@', '@']; }));
        rg.setValues(add.map(function (o) { return [o.key, o.value, o.keterangan]; }));
        add.forEach(function (o, i) { o._row = start + i; t.rows.push(o); });
      }
      return { ok: true };
    });
  });
}

function getBeranda() {
  return wrap_(function () {
    var s = session_(), sk = sekolah_();
    var res = {
      ok: true, sekolah: { nama: sk.nama, npsn: sk.npsn },
      siswa: table_(S.SISWA).rows.filter(function (r) { return r.status === 'Aktif'; }).length,
      mapel: table_(S.MAPEL).rows.filter(function (r) { return notFalse_(r.aktif); }).length,
      kelas: table_(S.KELAS).rows.filter(function (r) { return r.status === 'Aktif'; }).length
    };
    if (s.admin) {
      var st = getSetupStatus();
      if (st.ok) res.persiapan = { selesai: st.items.filter(function (i) { return i.ok; }).length, total: st.items.length, siap: st.siap };
    }
    return res;
  });
}

/** Urutan mapel pada rapor/leger: Umum → Muatan Lokal → P5; di dalam kelompok mengikuti urutan penugasan. */
function mapelKelas_(idKelas) {
  var mapel = idx_(table_(S.MAPEL).rows, 'id_mapel'), seen = {}, list = [];
  table_(S.MK).rows.forEach(function (m) {
    if (m.id_kelas !== idKelas || m.status !== 'Aktif' || seen[m.id_mapel] || !mapel[m.id_mapel]) return;
    seen[m.id_mapel] = 1; list.push({ id_mapel: m.id_mapel, nama: mapel[m.id_mapel].nama_mapel, kelompok: mapel[m.id_mapel].kelompok || 'Umum' });
  });
  list.sort(function (a, b) { return (KELOMPOK_URUT[a.kelompok] || 9) - (KELOMPOK_URUT[b.kelompok] || 9); });   // urutan penugasan dipertahankan (stabil)
  return list;
}

function ekskulText_(dr) {
  var out = []; [1, 2, 3].forEach(function (i) { if (dr['ekskul_' + i]) out.push(dr['ekskul_' + i] + (dr['predikat_' + i] ? ' (' + dr['predikat_' + i] + ')' : '')); });
  return out.join('; ');
}

/** Hitung jumlah, rata-rata, dan peringkat (peringkat kompetisi: nilai sama → rank sama). */
function peringkat_(siswa) {
  var ada = siswa.filter(function (s) { return s.n > 0; }).sort(function (a, b) { return b.jumlah - a.jumlah; });
  ada.forEach(function (s, i) { s.rank = i > 0 && ada[i - 1].jumlah === s.jumlah ? ada[i - 1].rank : i + 1; });
  siswa.forEach(function (s) { if (!s.n) s.rank = null; });
}

function getLeger(idKelas) {
  return wrap_(function () {
    var w = walAuth_(idKelas), c = cfg_(), mp = mapelKelas_(idKelas), rows = rekapRows_(idKelas);
    var by = {}; rows.forEach(function (r) { by[r.id_anggota + '|' + r.id_mapel] = r; });
    var drx = drIndex_();
    var siswa = anggotaAktif_(idKelas).map(function (a) {
      var dr = drOut_(drx[a.id_anggota]);
      var o = { id_anggota: a.id_anggota, no_absen: a.no_absen, nisn: a.nisn, nama: a.nama, nilai: {}, jumlah: 0, n: 0, sakit: dr.sakit, izin: dr.izin, alpa: dr.alpa, ekskul: ekskulText_(dr), keputusan: dr.keputusan || '' };
      mp.forEach(function (m) { var r = by[a.id_anggota + '|' + m.id_mapel], v = r ? r.nilai_rapor : null; o.nilai[m.id_mapel] = v; if (v !== null && v !== undefined) { o.jumlah += v; o.n++; } });
      o.rata = o.n ? round2_(o.jumlah / o.n) : null; return o;
    });
    peringkat_(siswa);
    var rata = {}, tuntas = {};
    mp.forEach(function (m) {
      var v = siswa.map(function (s) { return s.nilai[m.id_mapel]; }).filter(function (x) { return x !== null && x !== undefined; });
      rata[m.id_mapel] = v.length ? round2_(v.reduce(function (a, b) { return a + b; }, 0) / v.length) : null;
      tuntas[m.id_mapel] = v.length ? Math.round(v.filter(function (x) { return x >= c.batas_tuntas; }).length * 100 / v.length) : null;
    });
    return { ok: true, kelas: { id_kelas: idKelas, nama_kelas: w.kelas.nama_kelas, fase: w.kelas.fase, tahun_ajaran: w.kelas.tahun_ajaran || c.tahun_ajaran, semester: w.kelas.semester || c.semester },
      mapel: mp, siswa: siswa.map(function (s) { delete s.n; return s; }), rata_mapel: rata, tuntas_mapel: tuntas, batas: c.batas_tuntas, sekolah: sekolah_() };
  });
}

/** Data seluruh siswa satu kelas untuk dicetak (satu halaman rapor per siswa). */
function getCetakRapor(idKelas) {
  return wrap_(function () {
    var w = walAuth_(idKelas), c = cfg_(), mp = mapelKelas_(idKelas), rows = rekapRows_(idKelas), drx = drIndex_();
    var by = {}; rows.forEach(function (r) { by[r.id_anggota + '|' + r.id_mapel] = r; });
    var naIdx = naIndex_();
    var wali = idx_(table_(S.GURU).rows, 'id_guru')[w.kelas.id_wali_kelas] || {};
    var siswa = anggotaAktif_(idKelas).map(function (a) {
      var dr = drOut_(drx[a.id_anggota]);
      var o = { id_anggota: a.id_anggota, no_absen: a.no_absen, nisn: a.nisn, nis: a.nis, nama: a.nama, items: [], jumlah: 0, n: 0, final: mp.length > 0, lengkap: 0, data: dr,
        ekskul: [1, 2, 3].filter(function (i) { return dr['ekskul_' + i]; }).map(function (i) { return { nama: dr['ekskul_' + i], predikat: dr['predikat_' + i], ket: dr['ket_' + i] }; }) };
      mp.forEach(function (m) {
        var r = by[a.id_anggota + '|' + m.id_mapel] || {}, v = r.nilai_rapor === undefined ? null : r.nilai_rapor;
        if (v !== null) { o.jumlah += v; o.n++; o.lengkap++; }
        if (!r.final) o.final = false;
        var na = naIdx[a.id_anggota + '|' + m.id_mapel] || {}, hs = hitungNA_(na, c), sts = num_(na.nilai_sts);
        o.items.push({ id_mapel: m.id_mapel, mapel: m.nama, kelompok: m.kelompok, kktp: r.kktp ? r.kktp.c : c.batas_tuntas, nilai: v, predikat: r.predikat || '', deskripsi: r.deskripsi || '', sts: sts, sumatif: hs.na_sumatif === '' ? null : hs.na_sumatif });
      });
      o.rata = o.n ? round2_(o.jumlah / o.n) : null; return o;
    });
    peringkat_(siswa);
    return { ok: true, sekolah: sekolah_(), batas: c.batas_tuntas, total_mapel: mp.length,
      kelas: { id_kelas: idKelas, nama_kelas: w.kelas.nama_kelas, fase: w.kelas.fase, tingkat: w.kelas.tingkat, tahun_ajaran: w.kelas.tahun_ajaran || c.tahun_ajaran, semester: w.kelas.semester || c.semester },
      wali: { nama: wali.nama_guru || '', nip: wali.nip || '' }, siswa: siswa.map(function (s) { delete s.n; return s; }) };
  });
}


/* ----------------------------------------------------------------------------
 *  PENGATURAN CETAK — logo kiri/kanan & gambar latar (disimpan di _CONFIG, dipecah per 40.000 karakter)
 * -------------------------------------------------------------------------- */
var CETAK_IMG = { logo_kiri: 80000, logo_kanan: 80000, latar: 160000 };
var CETAK_CHUNK = 40000;

function cetakCfg_() {
  var m = {}; table_(S.CONFIG).rows.forEach(function (r) { if (r.key && String(r.key).indexOf('cetak_') === 0) m[r.key] = r.value === undefined || r.value === null ? '' : String(r.value); });
  var o = { logo_ukuran: m.cetak_logo_ukuran || '22', latar_opacity: m.cetak_latar_opacity || '12' };
  Object.keys(CETAK_IMG).forEach(function (k) {
    var n = parseInt(m['cetak_' + k + '_n'], 10) || 0, p = [];
    for (var i = 0; i < n; i++) p.push(m['cetak_' + k + '_' + i] || '');
    o[k] = p.join('');
  });
  return o;
}

function getCetakSetting() {
  return wrap_(function () { session_(); var o = cetakCfg_(); o.ok = true; return o; });
}

function saveCetakSetting(v) {
  return wrap_(function () {
    session_();
    return withLock_(function () {
      v = v || {};
      var t = table_(S.CONFIG), idx = idx_(t.rows, 'key'), add = [], changed = false;
      function put(key, val, ket) {
        val = String(val);
        var row = idx[key];
        if (row) { if (String(row.value) !== val) { row.value = val; changed = true; } }
        else if (val !== '') { var o = { key: key, value: val, keterangan: ket || 'Pengaturan cetak' }; add.push(o); idx[key] = o; }
      }
      var ukr = parseInt(v.logo_ukuran, 10), opa = parseInt(v.latar_opacity, 10);
      if (v.logo_ukuran !== undefined) { if (!(ukr >= 10 && ukr <= 40)) throw new Error('Ukuran logo harus 10-40 mm.'); put('cetak_logo_ukuran', ukr); }
      if (v.latar_opacity !== undefined) { if (!(opa >= 3 && opa <= 40)) throw new Error('Kepekatan latar harus 3-40%.'); put('cetak_latar_opacity', opa); }
      Object.keys(CETAK_IMG).forEach(function (k) {
        if (v[k] === undefined) return;
        var d = String(v[k] || '');
        if (d && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/.test(d)) throw new Error('Format gambar tidak valid (harus PNG/JPEG/WEBP).');
        if (d.length > CETAK_IMG[k]) throw new Error('Gambar terlalu besar. Gunakan gambar yang lebih kecil.');
        var old = parseInt((idx['cetak_' + k + '_n'] || {}).value, 10) || 0, n = Math.ceil(d.length / CETAK_CHUNK);
        for (var i = 0; i < Math.max(n, old); i++) put('cetak_' + k + '_' + i, d.substr(i * CETAK_CHUNK, CETAK_CHUNK), 'Gambar cetak (potongan)');
        put('cetak_' + k + '_n', n);
        log_(S.CONFIG, 'UPDATE', 'cetak_' + k, '', d ? 'gambar ' + d.length + ' karakter' : 'dihapus', 'pengaturan cetak');
      });
      if (changed) writeCols_(t, ['value']);
      if (add.length) appendObjs_(t, add);
      return { ok: true };
    });
  });
}

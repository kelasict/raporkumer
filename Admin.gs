/* ============================================================================
 *  ADMIN — setup awal, pengaturan sekolah, data master, checklist kesiapan
 *  Semua fungsi publik di sini dipanggil dari Web App (halaman Admin).
 *  Admin = akun dengan peran Admin (lihat Auth.gs).
 * ========================================================================== */

function adminOnly_() {
  var s = session_();
  if (!s.admin) throw new Error('Hanya admin/operator yang dapat membuka fitur ini.');
  return s;
}

/* ----------------------------------------------------------------------------
 *  1. DATA CONTOH & BACKUP (setup awal ada di Auth.gs)
 * -------------------------------------------------------------------------- */

/** Mengisi data contoh (hanya bila data induk masih kosong). */
function muatDataContoh() {
  return wrap_(function () {
    adminOnly_();
    if (table_(S.SISWA).rows.length || table_(S.KELAS).rows.length || table_(S.GURU).rows.length) {
      throw new Error('Data contoh hanya bisa dimuat saat data siswa, kelas, dan guru masih kosong.');
    }
    seedDemo_();
    syncMK_();
    return { ok: true };
  });
}

function pasangBackup() {
  return wrap_(function () { adminOnly_(); installTriggers_(); return { ok: true }; });
}

/* ----------------------------------------------------------------------------
 *  2. PENGATURAN SEKOLAH (_CONFIG)
 * -------------------------------------------------------------------------- */

var SETTING_MAP = {
  tahun_ajaran: 'tahun_ajaran_aktif', semester: 'semester_aktif',
  bobot_sumatif: 'bobot_sumatif', bobot_sas: 'bobot_sas',
  batas_tuntas: 'batas_tuntas', kktp_b: 'kktp_b', kktp_a: 'kktp_a', max_char: 'max_char_deskripsi',
  l_a: 'label_a', l_b: 'label_b', l_c: 'label_c', l_d: 'label_d', sep: 'template_separator_tp'
};

function anyFinal_() { return table_(S.NA).rows.some(function (r) { return isTrue_(r.status_final); }); }

function getSettings() {
  return wrap_(function () {
    adminOnly_();
    var c = cfg_(), v = {};
    v.tahun_ajaran = c.tahun_ajaran; v.semester = c.semester;
    v.bobot_sumatif = c.bobot_sumatif; v.bobot_sas = c.bobot_sas;
    v.batas_tuntas = c.batas_tuntas; v.kktp_b = c.kktp_b; v.kktp_a = c.kktp_a; v.max_char = c.max_char;
    v.l_a = c.l_a; v.l_b = c.l_b; v.l_c = c.l_c; v.l_d = c.l_d; v.sep = c.sep;
    return { ok: true, values: v, locked: anyFinal_() };
  });
}

function saveSettings(v) {
  return wrap_(function () {
    adminOnly_();
    return withLock_(function () {
      var cur = cfg_(), out = {};
      function intIn(k, label, min, max) {
        var n = Number(v[k]);
        if (v[k] === '' || v[k] === null || v[k] === undefined || !Number.isInteger(n) || n < min || n > max) throw new Error(label + ' harus bilangan bulat ' + min + '-' + max + '.');
        return n;
      }
      out.tahun_ajaran = String(v.tahun_ajaran || '').trim();
      if (!/^\d{4}\/\d{4}$/.test(out.tahun_ajaran)) throw new Error('Tahun ajaran harus berformat 2026/2027.');
      out.semester = String(v.semester);
      if (out.semester !== '1' && out.semester !== '2') throw new Error('Semester harus 1 atau 2.');
      out.bobot_sumatif = intIn('bobot_sumatif', 'Bobot sumatif lingkup materi', 0, 100);
      out.bobot_sas = intIn('bobot_sas', 'Bobot sumatif akhir semester (SAS)', 0, 100);
      var total = out.bobot_sumatif + out.bobot_sas;
      if (total !== 100) throw new Error('Total bobot harus 100 (sekarang ' + total + ').');
      out.batas_tuntas = intIn('batas_tuntas', 'KKTP predikat C', 40, 90);
      out.kktp_b = intIn('kktp_b', 'KKTP predikat B', 41, 98);
      out.kktp_a = intIn('kktp_a', 'KKTP predikat A', 42, 100);
      if (!(out.batas_tuntas < out.kktp_b && out.kktp_b < out.kktp_a)) throw new Error('Batas harus berurutan: C < B < A (mis. 75, 83, 92).');
      out.max_char = intIn('max_char', 'Maksimal karakter deskripsi', 100, 3000);
      ['l_a', 'l_b', 'l_c', 'l_d'].forEach(function (k) { out[k] = String(v[k] || '').trim(); if (!out[k]) throw new Error('Kalimat pembuka predikat ' + k.slice(2).toUpperCase() + ' tidak boleh kosong.'); });
      out.sep = String(v.sep === undefined || v.sep === '' ? '; ' : v.sep);

      var changedScore = out.bobot_sumatif !== cur.bobot_sumatif || out.bobot_sas !== cur.bobot_sas || out.batas_tuntas !== cur.batas_tuntas || out.kktp_b !== cur.kktp_b || out.kktp_a !== cur.kktp_a;
      if (changedScore && anyFinal_()) throw new Error('Bobot dan KKTP tidak dapat diubah karena sudah ada rapor yang difinalisasi. Buka kunci kelas terlebih dahulu.');

      var t = table_(S.CONFIG), idx = idx_(t.rows, 'key'), add = [];
      Object.keys(SETTING_MAP).forEach(function (k) {
        var key = SETTING_MAP[k], val = out[k];
        var row = idx[key];
        if (row) {
          if (String(row.value) !== String(val)) { log_(S.CONFIG, 'UPDATE', key, row.value, val, 'pengaturan sekolah'); row.value = val; }
        } else { add.push({ key: key, value: val, keterangan: '' }); log_(S.CONFIG, 'INSERT', key, '', val, 'pengaturan sekolah'); }
      });
      writeCols_(t, ['value']);
      if (add.length) appendObjs_(t, add);

      var ref = table_(S.REF), touched = false;
      ref.rows.forEach(function (r) {
        if (r.jenis_ref !== 'PREDIKAT') return;
        if (r.kode === 'A') { r.nilai_min = out.kktp_a; touched = true; }
        if (r.kode === 'B') { r.nilai_min = out.kktp_b; r.nilai_max = out.kktp_a - 1; touched = true; }
        if (r.kode === 'C') { r.nilai_min = out.batas_tuntas; r.nilai_max = out.kktp_b - 1; touched = true; }
        if (r.kode === 'D') { r.nilai_max = out.batas_tuntas - 1; touched = true; }
      });
      if (touched) writeCols_(ref, ['nilai_min', 'nilai_max']);
      delete _mem.cfg;

      return { ok: true };
    });
  });
}

/* ----------------------------------------------------------------------------
 *  3. CHECKLIST KESIAPAN
 * -------------------------------------------------------------------------- */

function getSetupStatus() {
  return wrap_(function () {
    adminOnly_();
    var c = cfg_(), guru = table_(S.GURU).rows, mapel = table_(S.MAPEL).rows, kelas = table_(S.KELAS).rows,
      siswa = table_(S.SISWA).rows, ang = table_(S.ANGGOTA).rows, mk = table_(S.MK).rows, tp = table_(S.TP).rows;
    var gA = guru.filter(function (g) { return g.status === 'Aktif'; }), mA = mapel.filter(function (m) { return notFalse_(m.aktif); }),
      kA = kelas.filter(function (k) { return k.status === 'Aktif'; }), sA = siswa.filter(function (s) { return s.status === 'Aktif'; }),
      mkA = mk.filter(function (m) { return m.status === 'Aktif'; });
    var kAids = {}; kA.forEach(function (k) { kAids[k.id_kelas] = k; });
    var memberOf = {}; ang.forEach(function (a) { if (a.status_keanggotaan === 'Aktif' && kAids[a.id_kelas]) memberOf[a.id_siswa] = 1; });
    var tanpaKelas = sA.filter(function (s) { return !memberOf[s.id_siswa]; }).length;
    var tpMiss = {}, tpCnt = 0;
    mkA.forEach(function (m) {
      var k = kAids[m.id_kelas]; if (!k) return;
      var ada = tpAktif_(m.id_mapel, k).length > 0;
      if (!ada) { var key = m.id_mapel + '|' + k.fase + '|' + k.tingkat; if (!tpMiss[key]) { tpMiss[key] = 1; tpCnt++; } }
    });
    var kelasTanpaWali = kA.filter(function (k) { return !k.id_wali_kelas; }).length;
    var sk = sekolah_();
    var backup = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'backupHarian'; });
    var items = [
      { id: 'ss', judul: 'Spreadsheet terhubung', ok: true, detail: 'Database: ' + ss_().getName(), aksi: null },
      { id: 'cfg', judul: 'Pengaturan sekolah', ok: c.bobot_valid && !!c.tahun_ajaran, detail: c.bobot_valid ? 'TA ' + c.tahun_ajaran + ' · semester ' + c.semester + ' · KKTP ' + c.batas_tuntas + '/' + c.kktp_b + '/' + c.kktp_a : 'Total bobot ' + c.bobot_total + ' (harus 100)', aksi: 'pengaturan' },
      { id: 'sekolah', judul: 'Identitas sekolah', ok: !!(sk.nama && sk.kepala), detail: sk.nama ? sk.nama + (sk.kepala ? '' : ' · nama kepala sekolah belum diisi') : 'Belum diisi (dipakai pada kop rapor)', aksi: 'sekolah' },
      { id: 'guru', judul: 'Akun guru', ok: gA.length > 0, detail: gA.length + ' akun aktif (' + gA.filter(function (g) { return g.peran === 'Admin'; }).length + ' admin)', aksi: 'akun' },
      { id: 'mapel', judul: 'Mata pelajaran', ok: mA.length > 0, detail: mA.length + ' mapel aktif', aksi: 'mapel' },
      { id: 'kelas', judul: 'Kelas', ok: kA.length > 0, detail: kA.length + ' kelas aktif' + (kelasTanpaWali ? ' · ' + kelasTanpaWali + ' belum ada wali kelas' : ''), aksi: 'kelas', warn: kA.length > 0 && kelasTanpaWali > 0 },
      { id: 'siswa', judul: 'Siswa', ok: sA.length > 0, detail: sA.length + ' siswa aktif', aksi: 'siswa' },
      { id: 'anggota', judul: 'Siswa masuk kelas', ok: sA.length > 0 && tanpaKelas === 0, detail: tanpaKelas ? tanpaKelas + ' siswa aktif belum masuk kelas' : (sA.length ? 'Semua siswa sudah punya kelas' : 'Belum ada siswa'), aksi: 'anggota' },
      { id: 'tp', judul: 'Tujuan Pembelajaran', ok: mkA.length > 0 && tpCnt === 0, detail: tpCnt ? tpCnt + ' kombinasi mapel & tingkat belum punya TP (guru mengisinya di menu Tujuan Pembelajaran)' : (mkA.length ? 'Semua mapel sudah punya TP' : 'Menunggu data kelas & mapel'), aksi: null },
      { id: 'backup', judul: 'Backup harian otomatis', ok: backup, detail: backup ? 'Aktif, pukul 01:00 ke folder _BACKUP di Drive' : 'Belum aktif', aksi: backup ? null : 'backup' }
    ];
    return { ok: true, items: items, siap: items.every(function (i) { return i.ok || i.id === 'backup'; }) };
  });
}

/* ----------------------------------------------------------------------------
 *  4. DATA MASTER (mapel, kelas, siswa, anggota kelas; mapel-kelas otomatis)
 * -------------------------------------------------------------------------- */

var FASE_LIST = ['A', 'B', 'C', 'D', 'E', 'F'];

function masters_() {
  if (_mem.masters) return _mem.masters;
  var c = cfg_();
  var M = {
    mapel: {
      sheet: S.MAPEL, key: 'id_mapel', label: 'Mata pelajaran', title: 'nama_mapel', active: { f: 'aktif', on: true, off: false },
      fields: [
        { k: 'nama_mapel', l: 'Nama mapel', t: 'text', req: 1, list: 1 },
        { k: 'kode_mapel', l: 'Kode singkat', t: 'text', req: 1, list: 1, upper: 1, re: /^[A-Z0-9]{2,8}$/, reMsg: 'Kode mapel 2-8 huruf/angka tanpa spasi, mis. MTK.', help: 'Dipakai pada ID, mis. MPL-MTK. Tidak boleh sama.' },
        { k: 'kelompok', l: 'Kelompok', t: 'select', o: ['Umum', 'Muatan Lokal', 'P5'], d: 'Umum', list: 1 },
        { k: 'kktp_c', l: 'KKTP predikat C (batas bawah)', t: 'number', min: 40, max: 90, d: c.batas_tuntas, help: 'Nilai di bawah angka ini = predikat D (Perlu Bantuan).' },
        { k: 'kktp_b', l: 'KKTP predikat B', t: 'number', min: 41, max: 98, d: c.kktp_b },
        { k: 'kktp_a', l: 'KKTP predikat A', t: 'number', min: 42, max: 100, d: c.kktp_a },
        { k: 'aktif', l: 'Aktif', t: 'bool', d: true, list: 1 }
      ]
    },
    kelas: {
      sheet: S.KELAS, key: 'id_kelas', label: 'Kelas', title: 'nama_kelas', active: { f: 'status', on: 'Aktif', off: 'Arsip' },
      fields: [
        { k: 'nama_kelas', l: 'Nama kelas', t: 'text', req: 1, list: 1, help: 'Mis. VII A' },
        { k: 'tingkat', l: 'Tingkat (1-12)', t: 'number', min: 1, max: 12, req: 1, list: 1 },
        { k: 'fase', l: 'Fase', t: 'select', o: FASE_LIST, list: 1, help: 'Kosongkan untuk diisi otomatis dari tingkat (7-9 = Fase D).' },
        { k: 'tahun_ajaran', l: 'Tahun ajaran', t: 'text', d: c.tahun_ajaran, re: /^\d{4}\/\d{4}$/, reMsg: 'Tahun ajaran berformat 2026/2027.' },
        { k: 'semester', l: 'Semester', t: 'select', o: ['1', '2'], d: c.semester },
        { k: 'id_wali_kelas', l: 'Wali kelas', t: 'ref', ref: 'guru', list: 1 },
        { k: 'status', l: 'Status', t: 'select', o: ['Aktif', 'Arsip'], d: 'Aktif', list: 1 }
      ]
    },
    siswa: {
      sheet: S.SISWA, key: 'id_siswa', label: 'Siswa', title: 'nama_siswa', active: { f: 'status', on: 'Aktif', off: 'Keluar' },
      fields: [
        { k: 'nama_siswa', l: 'Nama peserta didik', t: 'text', req: 1, list: 1 },
        { k: 'nis', l: 'NIS', t: 'text', list: 1 },
        { k: 'nisn', l: 'NISN (10 digit)', t: 'text', req: 1, list: 1, re: /^\d{10}$/, reMsg: 'NISN harus 10 digit angka.' },
        { k: 'jenis_kelamin', l: 'L/P', t: 'select', o: ['L', 'P'], list: 1 },
        { k: 'tempat_lahir', l: 'Tempat lahir', t: 'text' },
        { k: 'tanggal_lahir', l: 'Tanggal lahir', t: 'date' },
        { k: 'agama', l: 'Agama', t: 'text' },
        { k: 'pendidikan_sebelumnya', l: 'Pendidikan sebelumnya', t: 'text' },
        { k: 'alamat', l: 'Alamat peserta didik', t: 'text' },
        { k: 'nama_ayah', l: 'Nama ayah', t: 'text' },
        { k: 'nama_ibu', l: 'Nama ibu', t: 'text' },
        { k: 'pekerjaan_ayah', l: 'Pekerjaan ayah', t: 'text' },
        { k: 'pekerjaan_ibu', l: 'Pekerjaan ibu', t: 'text' },
        { k: 'alamat_ortu', l: 'Alamat orang tua', t: 'text' },
        { k: 'nama_wali', l: 'Nama wali (bila ada)', t: 'text' },
        { k: 'status', l: 'Status', t: 'select', o: ['Aktif', 'Lulus', 'Pindah', 'Keluar'], d: 'Aktif', list: 1 }
      ], imp: ['nisn', 'nis', 'nama_siswa', 'jenis_kelamin', 'tempat_lahir', 'tanggal_lahir', 'agama', 'pendidikan_sebelumnya', 'alamat', 'nama_ayah', 'nama_ibu', 'pekerjaan_ayah', 'pekerjaan_ibu', 'alamat_ortu', 'nama_wali', 'nama_kelas', 'no_absen']
    },
    anggota: {
      sheet: S.ANGGOTA, key: 'id_anggota', label: 'Anggota kelas', title: 'id_anggota', active: { f: 'status_keanggotaan', on: 'Aktif', off: 'Keluar' },
      fields: [
        { k: 'id_kelas', l: 'Kelas', t: 'ref', ref: 'kelas', req: 1, lock: 1, list: 1 },
        { k: 'id_siswa', l: 'Siswa', t: 'ref', ref: 'siswa', req: 1, lock: 1, list: 1 },
        { k: 'no_absen', l: 'No. absen', t: 'number', min: 1, max: 99, list: 1 },
        { k: 'tanggal_masuk', l: 'Tanggal masuk', t: 'date' },
        { k: 'status_keanggotaan', l: 'Status', t: 'select', o: ['Aktif', 'Pindah', 'Keluar'], d: 'Aktif', list: 1 }
      ], imp: ['nisn', 'nama_kelas', 'no_absen']
    }
  };
  return (_mem.masters = M);
}

function mctx_() {
  var c = { cfg: cfg_() };
  c.guru = idx_(table_(S.GURU).rows, 'id_guru'); c.kelas = idx_(table_(S.KELAS).rows, 'id_kelas');
  c.mapel = idx_(table_(S.MAPEL).rows, 'id_mapel'); c.siswa = idx_(table_(S.SISWA).rows, 'id_siswa');
  c.nisn = {}; table_(S.SISWA).rows.forEach(function (r) { if (r.nisn) c.nisn[String(r.nisn)] = r.id_siswa; });
  c.kode = {}; table_(S.MAPEL).rows.forEach(function (r) { if (r.kode_mapel) c.kode[String(r.kode_mapel).toUpperCase()] = r.id_mapel; });
  c.agt = {}; c.mem = {}; table_(S.ANGGOTA).rows.forEach(function (r) { c.agt[r.id_siswa + '|' + r.id_kelas] = r.id_anggota; if (r.status_keanggotaan === 'Aktif') (c.mem[r.id_siswa] = c.mem[r.id_siswa] || []).push({ k: r.id_kelas, n: r.no_absen }); });
  function mx(rows, key) { var n = 0; rows.forEach(function (r) { var m = String(r[key]).match(/(\d+)$/); if (m) n = Math.max(n, +m[1]); }); return n; }
  c.seq = { siswa: mx(table_(S.SISWA).rows, 'id_siswa'), anggota: mx(table_(S.ANGGOTA).rows, 'id_anggota') };
  c.year = String(c.cfg.tahun_ajaran).slice(0, 4) || String(new Date().getFullYear());
  return c;
}

function faseDariTingkat_(t) { return t <= 2 ? 'A' : t <= 4 ? 'B' : t <= 6 ? 'C' : t <= 9 ? 'D' : t === 10 ? 'E' : 'F'; }

function cleanFields_(def, rec, forImport) {
  var out = {};
  def.fields.forEach(function (f) {
    var raw = rec[f.k]; if (raw === undefined || raw === null) raw = '';
    if (typeof raw === 'string') raw = raw.trim();
    if (raw === '' && f.d !== undefined) raw = f.d;
    if (raw === '') { if (f.req) throw new Error(f.l + ' wajib diisi.'); out[f.k] = f.t === 'bool' ? false : ''; return; }
    if (f.t === 'email') {
      raw = String(raw).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) throw new Error('Email tidak valid: ' + raw);
    } else if (f.t === 'number') {
      var n = Number(raw);
      if (isNaN(n) || !Number.isInteger(n)) throw new Error(f.l + ' harus bilangan bulat.');
      if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) throw new Error(f.l + ' harus antara ' + f.min + ' dan ' + f.max + '.');
      raw = n;
    } else if (f.t === 'bool') {
      raw = raw === true || /^(true|1|ya|aktif)$/i.test(String(raw));
    } else if (f.t === 'select') {
      raw = String(raw);
      var hit = f.o.filter(function (o) { return o.toLowerCase() === raw.toLowerCase(); })[0];
      if (hit === undefined) throw new Error(f.l + ' harus salah satu dari: ' + f.o.join(', ') + '.');
      raw = hit;
    } else if (f.t === 'date') {
      raw = String(raw);
      var d = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
      if (d) raw = d[3] + '-' + pad_(d[2], 2) + '-' + pad_(d[1], 2);
      if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) throw new Error(f.l + ' harus berformat yyyy-mm-dd.');
      raw = raw.slice(0, 10);
    } else {
      raw = String(raw);
      if (f.k === 'nisn' && forImport && /^\d{6,9}$/.test(raw)) raw = pad_(raw, 10);
      if (f.upper) raw = raw.toUpperCase();
      if (f.re && !f.re.test(raw)) throw new Error(f.reMsg || (f.l + ' tidak valid.'));
    }
    out[f.k] = raw;
  });
  return out;
}

/** Validasi + susun objek siap tulis. ex = baris lama (update) atau null (baru). */
function prepare_(ent, rec, ex, ctx, forImport) {
  var def = masters_()[ent], now = now_(), obj;
  var clean = cleanFields_(def, ex ? mergeRec_(def, rec, ex) : rec, forImport);
  if (ex) {
    def.fields.forEach(function (f) { if (f.lock) clean[f.k] = ex[f.k]; });
    obj = {}; Object.keys(ex).forEach(function (k) { obj[k] = ex[k]; });
    Object.keys(clean).forEach(function (k) { obj[k] = clean[k]; });
  } else { obj = clean; }
  var self = ex ? ex[def.key] : null, i;

  if (ent === 'mapel') {
    var kk = ctx.kode[obj.kode_mapel]; if (kk && kk !== self) throw new Error('Kode mapel ' + obj.kode_mapel + ' sudah dipakai.');
    var kc = num_(obj.kktp_c), kb = num_(obj.kktp_b), ka = num_(obj.kktp_a);
    if (kc !== null && kb !== null && ka !== null && !(kc < kb && kb < ka)) throw new Error('KKTP harus berurutan C < B < A (mis. 75, 83, 92).');
    if (!ex) obj.id_mapel = 'MPL-' + obj.kode_mapel;
    if (!ex && ctx.mapel[obj.id_mapel]) throw new Error('ID ' + obj.id_mapel + ' sudah ada.');
    ctx.kode[obj.kode_mapel] = obj.id_mapel; ctx.mapel[obj.id_mapel] = obj;
  } else if (ent === 'kelas') {
    if (!obj.fase) obj.fase = faseDariTingkat_(obj.tingkat);
    if (obj.id_wali_kelas) {
      var w = ctx.guru[obj.id_wali_kelas]; if (!w) throw new Error('Wali kelas tidak ditemukan.');
      if (w.status !== 'Aktif') throw new Error('Wali kelas harus guru yang berstatus Aktif.');
    }
    if (!ex) {
      obj.id_kelas = 'KLS-' + String(obj.tahun_ajaran).slice(0, 4) + '-' + obj.nama_kelas.replace(/\s+/g, '').toUpperCase();
      if (ctx.kelas[obj.id_kelas]) throw new Error('Kelas ' + obj.nama_kelas + ' untuk TA ' + obj.tahun_ajaran + ' sudah ada.');
    }
    ctx.kelas[obj.id_kelas] = obj;
  } else if (ent === 'siswa') {
    var ns = ctx.nisn[obj.nisn]; if (ns && ns !== self) throw new Error('NISN ' + obj.nisn + ' sudah terdaftar.');
    if (!ex) { ctx.seq.siswa++; obj.id_siswa = 'SIS-' + ctx.year + '-' + pad_(ctx.seq.siswa, 4); obj.created_at = now; }
    obj.updated_at = now; ctx.nisn[obj.nisn] = obj.id_siswa; ctx.siswa[obj.id_siswa] = obj;
  } else if (ent === 'anggota') {
    var k = ctx.kelas[obj.id_kelas], s = ctx.siswa[obj.id_siswa];
    if (!k) throw new Error('Kelas tidak ditemukan.'); if (!s) throw new Error('Siswa tidak ditemukan.');
    if (!ex) {
      if (k.status !== 'Aktif') throw new Error('Kelas ' + k.nama_kelas + ' tidak aktif.');
      if (s.status !== 'Aktif') throw new Error('Siswa ' + s.nama_siswa + ' tidak berstatus Aktif.');
      if (ctx.agt[obj.id_siswa + '|' + obj.id_kelas]) throw new Error(s.nama_siswa + ' sudah terdaftar di kelas ' + k.nama_kelas + '.');
      ctx.seq.anggota++; obj.id_anggota = 'AGT-' + pad_(ctx.seq.anggota, 6);
      if (!obj.tanggal_masuk) obj.tanggal_masuk = now.slice(0, 10);
      ctx.agt[obj.id_siswa + '|' + obj.id_kelas] = obj.id_anggota;
    }
  }
  return obj;
}

function mergeRec_(def, rec, ex) {
  var m = {};
  def.fields.forEach(function (f) { m[f.k] = rec[f.k] === undefined ? ex[f.k] : rec[f.k]; });
  return m;
}

/** Tulis baris ke sheet (format teks untuk kolom non-angka agar nol di depan tidak hilang). */
function writeRows_(def, t, objs, isNew) {
  if (!objs.length) return;
  invMK_(t);
  var numCols = {}; def.fields.forEach(function (f) { if (f.t === 'number') numCols[f.k] = 1; if (f.t === 'bool') numCols[f.k] = 2; });
  var fmt = t.headers.map(function (h) { return numCols[h] === 1 ? '0' : numCols[h] === 2 ? 'General' : '@'; });
  function vals(o) { return t.headers.map(function (h) { return out_(o[h]); }); }
  if (isNew) {
    var start = t.sh.getLastRow() + 1, rg = t.sh.getRange(start, 1, objs.length, t.headers.length);
    rg.setNumberFormats(objs.map(function () { return fmt; })); rg.setValues(objs.map(vals));
    objs.forEach(function (o, i) { o._row = start + i; t.rows.push(o); });
  } else {
    objs.forEach(function (o) {
      var rg = t.sh.getRange(o._row, 1, 1, t.headers.length);
      rg.setNumberFormats([fmt]); rg.setValues([vals(o)]);
    });
  }
}

function masterRowView_(ent, r, ctx) {
  var def = masters_()[ent], o = { _id: r[def.key] };
  def.fields.forEach(function (f) { o[f.k] = f.t === 'bool' ? notFalse_(r[f.k]) : r[f.k]; });
  var a = def.active; o._aktif = a.on === true ? notFalse_(r[a.f]) : r[a.f] === a.on;
  if (ent === 'kelas') { var w = ctx.guru[r.id_wali_kelas]; o._wali = w ? w.nama_guru : ''; }
  if (ent === 'siswa') { var ms = (ctx.mem && ctx.mem[r.id_siswa]) || []; o._kelas = ms.map(function (m) { return ctx.kelas[m.k] ? ctx.kelas[m.k].nama_kelas : ''; }).filter(Boolean).join(', '); o._kid = ms.map(function (m) { return m.k; }); o._absen = ms.length ? ms[0].n : ''; }
  if (ent === 'anggota') { var s = ctx.siswa[r.id_siswa], k = ctx.kelas[r.id_kelas]; o._siswa = s ? s.nama_siswa : r.id_siswa; o._nisn = s ? s.nisn : ''; o._kelas = k ? k.nama_kelas : r.id_kelas; }
  return o;
}

function getMasterMeta() {
  return wrap_(function () {
    adminOnly_();
    var M = masters_(), ctx = mctx_(), ents = {};
    Object.keys(M).forEach(function (k) {
      var d = M[k];
      ents[k] = {
        label: d.label, key: d.key, imp: d.imp || null,
        fields: d.fields.map(function (f) { return { k: f.k, l: f.l, t: f.t, o: f.o, ref: f.ref, req: !!f.req, help: f.help || '', list: !!f.list, lock: !!f.lock, d: typeof f.d === 'function' ? undefined : f.d }; })
      };
    });
    function opts(rows, v, l, keep) { return rows.filter(keep).map(function (r) { return { v: r[v], l: l(r) }; }); }
    return {
      ok: true, entities: ents,
      opts: {
        guru: opts(table_(S.GURU).rows, 'id_guru', function (r) { return r.nama_guru; }, function (r) { return r.status === 'Aktif'; }),
        kelas: opts(table_(S.KELAS).rows, 'id_kelas', function (r) { return r.nama_kelas + ' (' + r.tahun_ajaran + ')'; }, function (r) { return r.status === 'Aktif'; }),
        mapel: opts(table_(S.MAPEL).rows, 'id_mapel', function (r) { return r.nama_mapel; }, function (r) { return notFalse_(r.aktif); }),
        siswa: opts(table_(S.SISWA).rows, 'id_siswa', function (r) { return r.nama_siswa + ' · ' + r.nisn; }, function (r) { return r.status === 'Aktif'; })
      },
      defaults: { tahun_ajaran: ctx.cfg.tahun_ajaran, semester: ctx.cfg.semester }
    };
  });
}

function listMaster(ent) {
  return wrap_(function () {
    adminOnly_();
    var def = masters_()[ent]; if (!def) throw new Error('Jenis data tidak dikenal.');
    var ctx = mctx_();
    return { ok: true, rows: table_(def.sheet).rows.map(function (r) { return masterRowView_(ent, r, ctx); }) };
  });
}

function saveMaster(ent, rec) {
  return wrap_(function () {
    adminOnly_();
    return withLock_(function () {
      var def = masters_()[ent]; if (!def) throw new Error('Jenis data tidak dikenal.');
      var t = table_(def.sheet), ctx = mctx_(), id = rec && rec._id, ex = null;
      if (id) { ex = t.rows.filter(function (r) { return r[def.key] === id; })[0]; if (!ex) throw new Error('Data tidak ditemukan.'); }
      var old = ex ? JSON.stringify(masterRowView_(ent, ex, ctx)) : '';
      var obj = prepare_(ent, rec || {}, ex, ctx, false);
      if (ex) { Object.keys(obj).forEach(function (k) { ex[k] = obj[k]; }); writeRows_(def, t, [ex], false); log_(def.sheet, 'UPDATE', id, old.slice(0, 300), '', 'data master'); }
      else { writeRows_(def, t, [obj], true); log_(def.sheet, 'INSERT', obj[def.key], '', obj[def.title] || '', 'data master'); }
      if (ent === 'kelas' || ent === 'mapel') { delete _mem.masters; syncMK_(); }
      return { ok: true, id: obj[def.key] };
    });
  });
}

/** Aktifkan/nonaktifkan (soft delete sesuai PRD: data tidak pernah dihapus). */
function setMasterActive(ent, id, active) {
  return wrap_(function () {
    adminOnly_();
    return withLock_(function () {
      var def = masters_()[ent]; if (!def) throw new Error('Jenis data tidak dikenal.');
      var t = table_(def.sheet), ex = t.rows.filter(function (r) { return r[def.key] === id; })[0];
      if (!ex) throw new Error('Data tidak ditemukan.');
      var a = def.active, rec = {}; def.fields.forEach(function (f) { rec[f.k] = ex[f.k]; });
      rec[a.f] = active ? a.on : a.off;
      var ctx = mctx_(), obj = prepare_(ent, rec, ex, ctx, false);
      Object.keys(obj).forEach(function (k) { ex[k] = obj[k]; });
      writeRows_(def, t, [ex], false);
      log_(def.sheet, 'UPDATE', id, active ? 'nonaktif' : 'aktif', active ? 'aktif' : 'nonaktif', 'soft delete');
      if (ent === 'kelas' || ent === 'mapel') syncMK_();
      return { ok: true };
    });
  });
}

/** Impor dari tempelan Excel/CSV. commit=false → hanya cek (pratinjau). */
function importMaster(ent, text, commit) {
  return wrap_(function () {
    adminOnly_();
    var def = masters_()[ent]; if (!def || !def.imp) throw new Error('Impor tidak tersedia untuk data ini.');
    var lines = String(text || '').split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (lines.length < 2) throw new Error('Tempel minimal 1 baris header dan 1 baris data.');
    if (lines.length > 501) throw new Error('Maksimal 500 baris per impor.');
    var delim = lines[0].indexOf('\t') >= 0 ? '\t' : lines[0].indexOf(';') >= 0 ? ';' : ',';
    function split(l) { return l.split(delim).map(function (x) { return x.trim().replace(/^"|"$/g, ''); }); }
    var alias = {}; def.fields.forEach(function (f) { alias[f.k] = f.k; alias[f.l.toLowerCase()] = f.k; });
    alias['nama_kelas'] = 'nama_kelas'; alias['nama kelas'] = 'nama_kelas'; alias['kelas'] = 'nama_kelas'; alias['nama'] = def.fields[0].k;
    var head = split(lines[0]).map(function (h) { h = h.toLowerCase(); return alias[h] || h; });
    var need = def.imp.filter(function (k) { return !(ent === 'siswa' && k === 'nama_kelas') && ['nisn', 'nama_siswa', 'nama_guru', 'email', 'nama_kelas'].indexOf(k) >= 0 || ['nip', 'nis', 'no_absen', 'jenis_kelamin', 'tempat_lahir', 'tanggal_lahir', 'agama', 'pendidikan_sebelumnya', 'alamat', 'nama_ayah', 'nama_ibu', 'pekerjaan_ayah', 'pekerjaan_ibu', 'alamat_ortu', 'nama_wali'].indexOf(k) < 0; });
    need.forEach(function (k) { if (head.indexOf(k) < 0) throw new Error('Kolom "' + k + '" tidak ditemukan pada header. Kolom yang dikenali: ' + def.imp.join(', ') + '.'); });

    var work = function () {
      var t = table_(def.sheet), ctx = mctx_(), errors = [], objs = [], enr = [], validRows = 0, enrolOnly = 0;
      var kelasByNama = {}; Object.keys(ctx.kelas).forEach(function (id) { var k = ctx.kelas[id]; if (k.status === 'Aktif') kelasByNama[String(k.nama_kelas).replace(/\s+/g, '').toUpperCase()] = id; });
      var siswaByNisn = ctx.nisn;
      for (var i = 1; i < lines.length; i++) {
        var cells = split(lines[i]), row = {};
        head.forEach(function (h, j) { row[h] = cells[j] === undefined ? '' : cells[j]; });
        try {
          var rec = row;
          if (ent === 'siswa') {                                            // satu impor: data siswa + masuk kelas
            var nis = String(row.nisn || '').trim(); if (/^\d{6,9}$/.test(nis)) nis = pad_(nis, 10); row.nisn = nis;
            var kn = String(row.nama_kelas || '').trim(), kid2 = '';
            if (kn) { kid2 = kelasByNama[kn.replace(/\s+/g, '').toUpperCase()]; if (!kid2) throw new Error('Kelas "' + kn + '" tidak ditemukan/aktif.'); }
            var exSid = siswaByNisn[nis];
            if (exSid && kid2) { enr.push(prepare_('anggota', { id_kelas: kid2, id_siswa: exSid, no_absen: row.no_absen }, null, ctx, true)); validRows++; enrolOnly++; continue; }
            var so = prepare_('siswa', row, null, ctx, true);
            if (kid2) enr.push(prepare_('anggota', { id_kelas: kid2, id_siswa: so.id_siswa, no_absen: row.no_absen }, null, ctx, true));
            objs.push(so); validRows++; continue;
          }
          if (ent === 'anggota') {
            var nisn = String(row.nisn || ''); if (/^\d{6,9}$/.test(nisn)) nisn = pad_(nisn, 10);
            var sid = siswaByNisn[nisn]; if (!sid) throw new Error('NISN ' + row.nisn + ' tidak ditemukan di data siswa.');
            var kid = kelasByNama[String(row.nama_kelas || '').replace(/\s+/g, '').toUpperCase()]; if (!kid) throw new Error('Kelas "' + row.nama_kelas + '" tidak ditemukan/aktif.');
            rec = { id_kelas: kid, id_siswa: sid, no_absen: row.no_absen };
          }
          objs.push(prepare_(ent, rec, null, ctx, true));
        } catch (e) { errors.push({ baris: i + 1, pesan: e.message }); }
      }
      if (ent !== 'siswa') validRows = objs.length;
      var res = { ok: true, total: lines.length - 1, valid: validRows, errors: errors.slice(0, 40), error_count: errors.length };
      if (commit && (objs.length || enr.length)) {
        if (errors.length) throw new Error('Perbaiki ' + errors.length + ' baris yang salah terlebih dahulu, lalu coba lagi.');
        if (objs.length) { writeRows_(def, t, objs, true); log_(def.sheet, 'INSERT', '', '', objs.length + ' baris', 'impor ' + ent); }
        if (enr.length) { writeRows_(masters_().anggota, table_(S.ANGGOTA), enr, true); log_(S.ANGGOTA, 'INSERT', '', '', enr.length + ' baris', 'impor siswa + kelas'); res.enrolled = enr.length; }
        if (ent === 'kelas' || ent === 'mapel') syncMK_();
        res.inserted = objs.length;
      }
      return res;
    };
    return commit ? withLock_(work) : work();
  });
}

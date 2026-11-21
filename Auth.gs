/* ============================================================================
 *  AUTH — login username/password milik aplikasi (tanpa validasi akun Google)
 *
 *  Alur:  login(username, password) → token acak (disimpan di CacheService, 6 jam)
 *         setiap panggilan berikutnya lewat rpc(token, namaFungsi, [argumen])
 *  Password tidak pernah disimpan polos: disimpan sebagai hash SHA-256 berulang + salt
 *  di sheet 05_GURU (kolom password_hash & salt).
 *  Peran: Guru (semua fitur penilaian & rapor) dan Admin (+ data master, akun, pengaturan, editor data).
 * ========================================================================== */

/* ---------- penjaga fungsi yang bisa dipanggil langsung dari browser ---------- */

/** Hanya pemilik script (menjalankan dari editor/menu Spreadsheet). */
function ownerOnly_() {
  var a = '', o = '';
  try { a = String(Session.getActiveUser().getEmail() || '').toLowerCase(); o = String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); } catch (e) { }
  if (!a || a !== o) throw new Error('Fungsi ini hanya dapat dijalankan pemilik script dari editor atau menu Spreadsheet.');
}
/** Admin yang sudah login (lewat rpc) atau pemilik script (editor/menu). */
function adminOrOwner_() {
  if (_mem.tok) { if (!session_().admin) throw new Error('Hanya admin yang dapat membuka fitur ini.'); return; }
  ownerOnly_();
}

/* ---------- hash password ---------- */

function sha256hex_(str) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function hashPw_(salt, pw) {
  var h = salt + '|' + pw;
  for (var i = 0; i < 200; i++) h = sha256hex_(h + '|' + salt);
  return h;
}
function makePw_(pw) {
  var salt = Utilities.getUuid().replace(/-/g, '');
  return { salt: salt, hash: hashPw_(salt, String(pw)) };
}
function checkPw_(g, pw) {
  if (!g || !g.salt || !g.password_hash) return false;
  var h = hashPw_(String(g.salt), String(pw)), x = String(g.password_hash), diff = h.length === x.length ? 0 : 1;
  for (var i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ (x.charCodeAt(i) || 0);
  return diff === 0;
}
function newToken_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }

function cleanUser_(u) {
  u = String(u || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(u)) throw new Error('Username 3-30 karakter: huruf kecil, angka, titik, garis bawah atau strip (tanpa spasi).');
  return u;
}
function cleanPw_(p) {
  p = String(p === undefined || p === null ? '' : p);
  if (p.length < 6) throw new Error('Password minimal 6 karakter.');
  if (p.length > 100) throw new Error('Password maksimal 100 karakter.');
  return p;
}

/* ---------- skema 05_GURU (migrasi dari versi lama yang memakai kolom email) ---------- */

function migrateGuru_(ss) {
  var sh = ss.getSheetByName(S.GURU);
  if (!sh || sh.getLastRow() === 0) return;
  var want = HEADERS[S.GURU], cur = sh.getRange(1, 1, 1, want.length).getValues()[0];
  if (cur[3] === 'username') return;
  var oldN = Math.max(sh.getLastRow() - 1, 0), rows = oldN ? sh.getRange(2, 1, oldN, 5).getValues() : [], used = {};
  var out = rows.map(function (r) {
    var u = String(r[3] || '').split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (u.length < 3) u = ('guru' + String(r[0]).replace(/\D/g, '')).toLowerCase();
    var base = u, n = 1; while (used[u]) u = base + (++n); used[u] = 1;
    return [r[0], r[1], r[2], u, 'Guru', '', '', r[4] || 'Aktif'];
  });
  sh.getRange(1, 1, 1, want.length).setValues([want]).setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
  if (sh.getLastColumn() > want.length) sh.getRange(1, want.length + 1, 1, sh.getLastColumn() - want.length).clearContent();
  if (out.length) { sh.getRange(2, 1, out.length, 8).setNumberFormat('@'); sh.getRange(2, 1, out.length, 8).setValues(out); }
}

function hasAdmin_() {
  try {
    var t = table_(S.GURU);
    return t.rows.some(function (g) { return g.peran === 'Admin' && g.status === 'Aktif' && g.password_hash; });
  } catch (e) { return false; }
}

/* ============================================================================
 *  API TANPA LOGIN
 * ========================================================================== */

/** Dipanggil halaman login: status aplikasi (perlu setup atau tidak) + nama sekolah. */
function getPublicInfo() {
  return wrap_(function () {
    if (!isReady_()) return { ok: true, setup: 'sheet', sekolah: '' };
    return { ok: true, setup: hasAdmin_() ? '' : 'admin', sekolah: sekolah_().nama };
  });
}

function login(username, password) {
  return wrap_(function () {
    if (!isReady_()) throw new Error('Aplikasi belum disiapkan.');
    var u = String(username || '').trim().toLowerCase(), cache = CacheService.getScriptCache(), fk = 'fail_' + u.slice(0, 40);
    if (!u || !password) throw new Error('Isi username dan password.');
    if (Number(cache.get(fk) || 0) >= 5) throw new Error('Terlalu banyak percobaan gagal. Coba lagi dalam 10 menit.');
    var g = table_(S.GURU).rows.filter(function (r) { return String(r.username).toLowerCase() === u; })[0];
    if (!checkPw_(g, password)) {
      cache.put(fk, String(Number(cache.get(fk) || 0) + 1), 600);
      throw new Error('Username atau password salah.');
    }
    if (g.status !== 'Aktif') throw new Error('Akun ini dinonaktifkan. Hubungi admin.');
    cache.remove(fk);
    var tok = newToken_();
    cache.put('tok_' + tok, g.id_guru, 21600);
    _mem.email = g.username;
    withLock_(function () { log_(S.LOG, 'LOGIN', g.id_guru, '', '', 'masuk'); });
    _mem.tok = tok;                                // sertakan data dashboard agar tidak perlu panggilan kedua
    var bt = getBoot();
    return { ok: true, token: tok, boot: bt && bt.ok ? bt : null };
  });
}

/**
 * Setup pertama kali. Mode 'sheet': tempel link Spreadsheet + buat admin pertama.
 * Mode 'admin': Spreadsheet sudah terhubung tetapi belum punya admin (mis. setelah pembaruan versi).
 * Hanya bisa dijalankan selama belum ada admin — siapa pun yang pertama menyelesaikannya menjadi admin.
 */
function setupConnect(urlOrId, username, password, nama) {
  return wrap_(function () {
    return withLock_(function () {
      var ready = isReady_();
      if (ready && hasAdmin_()) throw new Error('Aplikasi sudah disiapkan. Silakan masuk dengan akun Anda.');
      var u = cleanUser_(username), pw = cleanPw_(password), nm = String(nama || '').trim();
      if (!nm) throw new Error('Nama lengkap admin wajib diisi.');
      var txt = String(urlOrId || '').trim(), ss = null;
      if (txt) {
        var m = txt.match(/\/d\/([a-zA-Z0-9_-]{20,})/) || txt.match(/^([a-zA-Z0-9_-]{20,})$/);
        if (!m) throw new Error('Link Spreadsheet tidak dikenali. Salin link lengkap dari bilah alamat browser saat Spreadsheet terbuka.');
        try { ss = SpreadsheetApp.openById(m[1]); }
        catch (e) { throw new Error('Spreadsheet tidak dapat dibuka. Pastikan link benar dan pemilik aplikasi memiliki akses edit ke Spreadsheet itu.'); }
      } else if (ready) { ss = ss_(); }
      else {
        try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
        if (!ss) throw new Error('Tempel link Spreadsheet terlebih dahulu.');
      }
      PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
      _mem = { ss: ss };
      buildStructure_(ss);
      _mem = { ss: ss };
      var t = table_(S.GURU);
      var ex = t.rows.filter(function (g) { return String(g.username).toLowerCase() === u; })[0], p = makePw_(pw);
      if (ex) {                                   // akun lama (hasil migrasi) dengan username sama → dijadikan admin
        ex.peran = 'Admin'; ex.status = 'Aktif'; ex.nama_guru = ex.nama_guru || nm; ex.password_hash = p.hash; ex.salt = p.salt;
        t.sh.getRange(ex._row, 3, 1, 6).setNumberFormat('@'); t.sh.getRange(ex._row, 3, 1, 6).setValues([[ex.nama_guru, ex.username, ex.peran, ex.password_hash, ex.salt, ex.status]]);
      } else {
        var n = 0; t.rows.forEach(function (g) { var q = String(g.id_guru).match(/(\d+)$/); if (q) n = Math.max(n, +q[1]); });
        var o = { id_guru: 'GRU-' + pad_(n + 1, 4), nip: '', nama_guru: nm, username: u, peran: 'Admin', password_hash: p.hash, salt: p.salt, status: 'Aktif' };
        putGuru_(t, [o], true);
      }
      var backup = true;
      try { installTriggers_(); } catch (e) { backup = false; }
      _mem.email = u; log_(S.GURU, 'INSERT', u, '', 'Admin', 'setup awal: admin pertama');
      return { ok: true, nama: ss.getName(), url: ss.getUrl(), backup: backup };
    });
  });
}

/**
 * PEMULIHAN (jalankan dari editor Apps Script: pilih fungsi ini lalu klik Run).
 * Bila password admin lupa: mengatur ulang ke password sementara yang tampil di Log eksekusi.
 */
function pulihkanAdmin() {
  ownerOnly_();
  _mem = {};
  var tmp = 'admin' + Math.floor(100000 + Math.random() * 899999), p = makePw_(tmp), t = table_(S.GURU);
  var a = t.rows.filter(function (g) { return g.peran === 'Admin'; })[0];
  if (a) {
    a.status = 'Aktif'; a.password_hash = p.hash; a.salt = p.salt;
    t.sh.getRange(a._row, 5, 1, 4).setNumberFormat('@'); t.sh.getRange(a._row, 5, 1, 4).setValues([[a.peran, a.password_hash, a.salt, a.status]]);
  } else {
    a = { id_guru: 'GRU-' + pad_(t.rows.length + 1, 4), nip: '', nama_guru: 'Administrator', username: 'admin', peran: 'Admin', password_hash: p.hash, salt: p.salt, status: 'Aktif' };
    putGuru_(t, [a], true);
  }
  Logger.log('Username: ' + a.username + '  |  Password sementara: ' + tmp + '  (segera ganti setelah masuk)');
  return 'Username: ' + a.username + ' | Password sementara: ' + tmp;
}

/* ============================================================================
 *  DISPATCHER rpc — semua panggilan setelah login lewat sini
 * ========================================================================== */

function rpcTable_() {
  return {
    getBoot: getBoot, getCetakSetting: getCetakSetting, saveCetakSetting: saveCetakSetting, saveTpBatch: saveTpBatch, getSessionInfo: getSessionInfo, logout: logout, changePassword: changePassword,
    getAssignments: getAssignments, getFormData: getFormData, saveNilaiTp: saveNilaiTp, getAkhirData: getAkhirData, saveNilaiAkhir: saveNilaiAkhir,
    getTpList: getTpList, getRekap: getRekap, refreshRekap: refreshRekap, finalisasiKelas: finalisasiKelas, bukaKunciKelas: bukaKunciKelas, getAdminOverview: getAdminOverview,
    getSekolah: getSekolah, saveSekolah: saveSekolah, getBeranda: getBeranda, getLeger: getLeger, getCetakRapor: getCetakRapor,
    getDataRapor: getDataRapor, saveDataRapor: saveDataRapor,
    generateCapaian: generateCapaian, generateKelas: generateKelas, generateSemua: generateSemua, getCapaian: getCapaian, overrideCapaian: overrideCapaian, resetCapaian: resetCapaian,
    getSettings: getSettings, saveSettings: saveSettings, getSetupStatus: getSetupStatus, muatDataContoh: muatDataContoh, pasangBackup: pasangBackup,
    getMasterMeta: getMasterMeta, listMaster: listMaster, saveMaster: saveMaster, setMasterActive: setMasterActive, importMaster: importMaster,
    listAkun: listAkun, saveAkun: saveAkun, importAkun: importAkun,
    getEditorSheets: getEditorSheets, getEditorData: getEditorData, saveCells: saveCells, addRow: addRow, deleteRows: deleteRows
  };
}

function rpc(token, fn, args) {
  try {
    var f = rpcTable_()[fn];
    if (typeof f !== 'function' || !Object.prototype.hasOwnProperty.call(rpcTable_(), fn)) return { ok: false, error: 'Fungsi tidak dikenal.' };
    if (!isReady_()) return { ok: false, expired: true, error: 'Aplikasi belum disiapkan.' };
    _mem.tok = String(token || '');
    session_();
    var r = f.apply(null, Array.isArray(args) ? args : []);
    if (r && r.ok === false && r.error === 'SESI_HABIS') return { ok: false, expired: true, error: 'Sesi berakhir. Silakan masuk kembali.' };
    return r;
  } catch (e) {
    var m = String(e && e.message ? e.message : e);
    if (m === 'SESI_HABIS') return { ok: false, expired: true, error: 'Sesi berakhir. Silakan masuk kembali.' };
    return { ok: false, error: m };
  }
}

function logout() {
  return wrap_(function () {
    try { CacheService.getScriptCache().remove('tok_' + String(_mem.tok || '')); } catch (e) { }
    return { ok: true };
  });
}

function changePassword(lama, baru) {
  return wrap_(function () {
    var s = session_(), pw = cleanPw_(baru);
    return withLock_(function () {
      var t = table_(S.GURU), g = t.rows.filter(function (r) { return r.id_guru === s.id_guru; })[0];
      if (!checkPw_(g, lama)) throw new Error('Password lama salah.');
      var p = makePw_(pw); g.password_hash = p.hash; g.salt = p.salt;
      t.sh.getRange(g._row, 6, 1, 2).setNumberFormat('@'); t.sh.getRange(g._row, 6, 1, 2).setValues([[g.password_hash, g.salt]]);
      log_(S.GURU, 'PASSWORD', g.id_guru, '', '', 'ganti password sendiri');
      return { ok: true };
    });
  });
}

/* ============================================================================
 *  KELOLA AKUN (admin)
 * ========================================================================== */

function putGuru_(t, objs, isNew) {
  objs.forEach(function (o) { if (o.id_guru) CacheService.getScriptCache().remove('ses_' + o.id_guru); });
  function vals(o) { return t.headers.map(function (h) { return out_(o[h]); }); }
  if (isNew) {
    var start = t.sh.getLastRow() + 1, rg = t.sh.getRange(start, 1, objs.length, t.headers.length);
    rg.setNumberFormat('@'); rg.setValues(objs.map(vals));
    objs.forEach(function (o, i) { o._row = start + i; t.rows.push(o); });
  } else {
    objs.forEach(function (o) { var rg = t.sh.getRange(o._row, 1, 1, t.headers.length); rg.setNumberFormat('@'); rg.setValues([vals(o)]); });
  }
}

function akunView_(g) {
  return { _id: g.id_guru, id_guru: g.id_guru, nama_guru: g.nama_guru, nip: g.nip, username: g.username, peran: g.peran || 'Guru', status: g.status, punya_password: !!(g.password_hash && g.salt) };
}

function listAkun() {
  return wrap_(function () { adminOnly_(); return { ok: true, rows: table_(S.GURU).rows.map(akunView_), me: session_().id_guru }; });
}

function checkAkun_(t, rec, ex, me) {
  var nama = String(rec.nama_guru || '').trim(); if (!nama) throw new Error('Nama guru wajib diisi.');
  var u = cleanUser_(rec.username);
  var dup = t.rows.filter(function (g) { return String(g.username).toLowerCase() === u && (!ex || g.id_guru !== ex.id_guru); })[0];
  if (dup) throw new Error('Username "' + u + '" sudah dipakai ' + dup.nama_guru + '.');
  var peran = String(rec.peran || 'Guru'); if (peran !== 'Guru' && peran !== 'Admin') throw new Error('Peran harus Guru atau Admin.');
  var status = String(rec.status || 'Aktif'); if (status !== 'Aktif' && status !== 'Nonaktif') throw new Error('Status harus Aktif atau Nonaktif.');
  if (ex) {
    var tetapAdmin = peran === 'Admin' && status === 'Aktif';
    if (ex.peran === 'Admin' && ex.status === 'Aktif' && !tetapAdmin) {
      var lain = t.rows.filter(function (g) { return g.id_guru !== ex.id_guru && g.peran === 'Admin' && g.status === 'Aktif'; }).length;
      if (!lain) throw new Error('Harus tersisa minimal satu admin aktif.');
    }
    if (ex.id_guru === me && (peran !== 'Admin' || status !== 'Aktif')) throw new Error('Anda tidak dapat menurunkan atau menonaktifkan akun Anda sendiri.');
    if (status === 'Nonaktif' && ex.status === 'Aktif' && table_(S.KELAS).rows.some(function (k) { return k.id_wali_kelas === ex.id_guru && k.status === 'Aktif'; })) throw new Error('Guru ini masih menjadi wali kelas aktif. Ganti wali kelasnya dahulu.');
  }
  return { nama_guru: nama, nip: String(rec.nip || '').trim(), username: u, peran: peran, status: status };
}

function saveAkun(rec) {
  return wrap_(function () {
    var s = adminOnly_(); rec = rec || {};
    return withLock_(function () {
      var t = table_(S.GURU), ex = null;
      if (rec._id) { ex = t.rows.filter(function (g) { return g.id_guru === rec._id; })[0]; if (!ex) throw new Error('Akun tidak ditemukan.'); }
      var c = checkAkun_(t, rec, ex, s.id_guru), pwText = rec.password === undefined || rec.password === null ? '' : String(rec.password);
      if (!ex && !pwText) throw new Error('Password awal wajib diisi untuk akun baru.');
      if (ex) {
        var old = ex.username + '/' + ex.peran + '/' + ex.status;
        Object.keys(c).forEach(function (k) { ex[k] = c[k]; });
        if (pwText) { var p = makePw_(cleanPw_(pwText)); ex.password_hash = p.hash; ex.salt = p.salt; }
        putGuru_(t, [ex], false);
        log_(S.GURU, pwText ? 'PASSWORD' : 'UPDATE', ex.id_guru, old, c.username + '/' + c.peran + '/' + c.status, pwText ? 'reset password oleh admin' : 'ubah akun');
        return { ok: true, id: ex.id_guru };
      }
      var n = 0; t.rows.forEach(function (g) { var q = String(g.id_guru).match(/(\d+)$/); if (q) n = Math.max(n, +q[1]); });
      var np = makePw_(cleanPw_(pwText)), o = { id_guru: 'GRU-' + pad_(n + 1, 4), password_hash: np.hash, salt: np.salt };
      Object.keys(c).forEach(function (k) { o[k] = c[k]; });
      putGuru_(t, [o], true);
      log_(S.GURU, 'INSERT', o.id_guru, '', c.username + '/' + c.peran, 'akun baru');
      return { ok: true, id: o.id_guru };
    });
  });
}

/** Impor banyak akun: kolom nama, username, password, nip, peran (peran boleh kosong = Guru). commit=false → pratinjau. */
function importAkun(text, commit) {
  return wrap_(function () {
    adminOnly_();
    var lines = String(text || '').split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (lines.length < 2) throw new Error('Tempel minimal 1 baris header dan 1 baris data.');
    if (lines.length > 201) throw new Error('Maksimal 200 akun per impor.');
    var delim = lines[0].indexOf('\t') >= 0 ? '\t' : lines[0].indexOf(';') >= 0 ? ';' : ',';
    function split(l) { return l.split(delim).map(function (x) { return x.trim().replace(/^"|"$/g, ''); }); }
    var al = { nama: 'nama_guru', 'nama guru': 'nama_guru', nama_guru: 'nama_guru', username: 'username', password: 'password', nip: 'nip', peran: 'peran' };
    var head = split(lines[0]).map(function (h) { return al[h.toLowerCase()] || h.toLowerCase(); });
    ['nama_guru', 'username', 'password'].forEach(function (k) { if (head.indexOf(k) < 0) throw new Error('Kolom "' + k + '" tidak ada pada header. Kolom: nama, username, password, nip, peran.'); });
    var work = function () {
      var t = table_(S.GURU), n = 0, errors = [], objs = [], seen = {};
      t.rows.forEach(function (g) { var q = String(g.id_guru).match(/(\d+)$/); if (q) n = Math.max(n, +q[1]); });
      for (var i = 1; i < lines.length; i++) {
        var cells = split(lines[i]), row = {};
        head.forEach(function (h, j) { row[h] = cells[j] === undefined ? '' : cells[j]; });
        try {
          var c = checkAkun_(t, { nama_guru: row.nama_guru, nip: row.nip, username: row.username, peran: row.peran || 'Guru', status: 'Aktif' }, null, '');
          if (seen[c.username]) throw new Error('Username "' + c.username + '" muncul dua kali.'); seen[c.username] = 1;
          var p = makePw_(cleanPw_(row.password)); n++;
          var o = { id_guru: 'GRU-' + pad_(n, 4), password_hash: p.hash, salt: p.salt }; Object.keys(c).forEach(function (k) { o[k] = c[k]; });
          objs.push(o);
        } catch (e) { errors.push({ baris: i + 1, pesan: e.message }); }
      }
      var res = { ok: true, total: lines.length - 1, valid: objs.length, errors: errors.slice(0, 40), error_count: errors.length };
      if (commit && objs.length) {
        if (errors.length) throw new Error('Perbaiki ' + errors.length + ' baris yang salah terlebih dahulu.');
        putGuru_(t, objs, true); log_(S.GURU, 'INSERT', '', '', objs.length + ' akun', 'impor akun'); res.inserted = objs.length;
      }
      return res;
    };
    return commit ? withLock_(work) : work();
  });
}

/* ============================================================================
 *  EDITOR DATA (admin) — mengubah isi sheet apa pun secara langsung, dengan validasi dan log
 * ========================================================================== */

/* Tabel konfigurasi editor bergantung pada objek S (Config.gs). Dibuat saat pertama dipakai (bukan saat file dimuat)
   supaya tidak error "Cannot read properties of undefined (reading 'LOG')" bila urutan file di Apps Script berbeda. */
var _editCfg = null;
function editCfg_() {
  if (_editCfg) return _editCfg;
  var c = { ro: {}, hidden: {}, nodel: {}, status: {} };
  c.ro[S.LOG] = 1; c.ro[S.REKAP] = 1;
  c.hidden[S.GURU] = { password_hash: 1, salt: 1 };
  c.nodel[S.GURU] = 1; c.nodel[S.CONFIG] = 1; c.nodel[S.REF] = 1;
  c.status[S.SISWA] = ['Aktif', 'Lulus', 'Pindah', 'Keluar']; c.status[S.KELAS] = ['Aktif', 'Arsip']; c.status[S.GURU] = ['Aktif', 'Nonaktif'];
  c.status[S.MK] = ['Aktif', 'Nonaktif']; c.status[S.PROJEK] = ['Aktif', 'Nonaktif'];
  return (_editCfg = c);
}
var EDIT_NUM = /^(sum_\d+|nilai|nilai_remedial|nilai_final|nilai_sts|nilai_non_tes|nilai_tes|na_sumatif|na_sas|nilai_rapor|no_absen|kktp_[abc]|sakit|izin|alpa|urutan|tingkat|tinggi_badan|berat_badan|jam_per_minggu|nilai_tertinggi|nilai_terendah|batas_tuntas_saat_generate)$/;
var EDIT_SCORE = /^(sum_\d+|nilai|nilai_remedial|nilai_final|nilai_sts|nilai_non_tes|nilai_tes|na_sumatif|na_sas|nilai_rapor)$/;
var EDIT_BOOL = /^(aktif|status_final|status_manual_edit)$/;
var EDIT_ENUM = {
  jenis_kelamin: ['', 'L', 'P'], peran: ['Guru', 'Admin'], kelompok: ['Umum', 'Muatan Lokal', 'P5'], fase: ['A', 'B', 'C', 'D', 'E', 'F'],
  predikat: ['', 'A', 'B', 'C', 'D'], jenis_sumatif: ['Formatif', 'Sumatif', 'Projek'], keputusan: ['', 'Naik', 'Tinggal', 'Lulus'],
  predikat_1: ['', 'Sangat Baik', 'Baik', 'Cukup', 'Kurang'], predikat_2: ['', 'Sangat Baik', 'Baik', 'Cukup', 'Kurang'], predikat_3: ['', 'Sangat Baik', 'Baik', 'Cukup', 'Kurang']
};

function editSheet_(name, forWrite) {
  if (SHEET_ORDER.indexOf(name) < 0) throw new Error('Sheet tidak dikenal.');
  if (forWrite && editCfg_().ro[name]) throw new Error('Sheet ' + name + ' hanya-baca (dibuat otomatis).');
  return table_(name);
}

function getEditorSheets() {
  return wrap_(function () {
    adminOnly_();
    return { ok: true, sheets: SHEET_ORDER.map(function (n) { return { name: n, rows: Math.max(ss_().getSheetByName(n).getLastRow() - 1, 0), readonly: !!editCfg_().ro[n] }; }) };
  });
}

function getEditorData(name, q, offset, limit) {
  return wrap_(function () {
    adminOnly_();
    var t = editSheet_(name, false), hid = editCfg_().hidden[name] || {}, term = String(q || '').trim().toLowerCase(), off = Math.max(Number(offset) || 0, 0), lim = Math.min(Math.max(Number(limit) || 100, 1), 300);
    var rows = t.rows;
    if (term) rows = rows.filter(function (r) { return t.headers.some(function (h) { return !hid[h] && String(r[h]).toLowerCase().indexOf(term) >= 0; }); });
    var page = rows.slice(off, off + lim).map(function (r) {
      return { r: r._row, v: t.headers.map(function (h) { return hid[h] ? (r[h] ? '••••••' : '') : out_(r[h]); }) };
    });
    var enums = {}; t.headers.forEach(function (h) { var e = h === 'status' || h === 'status_keanggotaan' ? (h === 'status' ? editCfg_().status[name] : ['Aktif', 'Pindah', 'Keluar']) : EDIT_ENUM[h]; if (e) enums[h] = e; });
    return { ok: true, headers: t.headers, rows: page, total: rows.length, offset: off, limit: lim, readonly: !!editCfg_().ro[name], hidden: Object.keys(hid), enums: enums, nodelete: !!editCfg_().nodel[name] };
  });
}

function enumFor_(name, h) {
  return (h === 'status' && editCfg_().status[name]) ? editCfg_().status[name] : (h === 'status_keanggotaan' ? ['Aktif', 'Pindah', 'Keluar'] : EDIT_ENUM[h]);
}

/** Ubah teks isian menjadi nilai bertipe sesuai kolom; melempar Error bila tidak valid. */
function coerce_(name, h, text, oldVal) {
  var v = text === undefined || text === null ? '' : (typeof text === 'string' ? text.trim() : text);
  if (EDIT_BOOL.test(h)) {
    if (v === '') return '';
    if (/^(true|1|ya)$/i.test(String(v))) return true; if (/^(false|0|tidak)$/i.test(String(v))) return false;
    throw new Error(h + ' harus TRUE atau FALSE.');
  }
  var en = enumFor_(name, h);
  if (en) { var hit = en.filter(function (o) { return String(o).toLowerCase() === String(v).toLowerCase(); })[0]; if (hit === undefined) throw new Error(h + ' harus salah satu dari: ' + en.filter(Boolean).join(', ') + (en.indexOf('') >= 0 ? ' (atau kosong)' : '') + '.'); return hit; }
  if (v === '') return '';
  if (EDIT_NUM.test(h) || typeof oldVal === 'number') {
    var n = Number(String(v).replace(',', '.'));
    if (isNaN(n)) throw new Error(h + ' harus berupa angka.');
    if (EDIT_SCORE.test(h) && (n < 0 || n > 100)) throw new Error(h + ' harus 0-100.');
    return n;
  }
  if (h === 'username') return cleanUser_(v);
  if (/^tanggal_(lahir|masuk)$/.test(h)) {
    var d = String(v).match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/); if (d) v = d[3] + '-' + pad_(d[2], 2) + '-' + pad_(d[1], 2);
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(v))) throw new Error(h + ' harus berformat yyyy-mm-dd.');
    return String(v).slice(0, 10);
  }
  return String(v);
}

function afterEdit_(name, rows) {
  CacheService.getScriptCache().remove('mk_ok'); delete _mem.ang; delete _mem.sisIdx;
  if (name === S.GURU) { var c = CacheService.getScriptCache(); table_(S.GURU).rows.forEach(function (g) { c.remove('ses_' + g.id_guru); }); }
  delete _mem.masters; delete _mem.cfg;
  if (name === S.NA) {
    var t = table_(S.NA), mp = idx_(table_(S.MAPEL).rows, 'id_mapel');
    rows.forEach(function (r) { var row = t.rows.filter(function (x) { return x._row === r; })[0]; if (row) recalcNA_(row, mp[row.id_mapel]); });
    writeCols_(t, ['na_sumatif', 'na_sas', 'nilai_rapor', 'predikat']);
  }
  if (name === S.KELAS || name === S.MAPEL) syncMK_();
}

function saveCells(name, edits) {
  return wrap_(function () {
    var s = adminOnly_();
    if (!Array.isArray(edits) || !edits.length) throw new Error('Tidak ada perubahan.');
    if (edits.length > 300) throw new Error('Maksimal 300 sel sekali simpan.');
    return withLock_(function () {
      var t = editSheet_(name, true), hid = editCfg_().hidden[name] || {}, byRow = {}, plan = [], rowsTouched = {};
      t.rows.forEach(function (r) { byRow[r._row] = r; });
      edits.forEach(function (e) {
        var row = byRow[e.r], h = e.c;
        if (!row) throw new Error('Baris ' + e.r + ' tidak ada lagi. Muat ulang data.');
        if (t.headers.indexOf(h) < 0) throw new Error('Kolom ' + h + ' tidak dikenal.');
        if (hid[h]) throw new Error('Kolom ' + h + ' tidak dapat diubah di sini (gunakan Kelola Akun).');
        if (String(out_(row[h])) !== String(out_(e.old))) throw new Error('Baris ' + e.r + ' kolom ' + h + ' sudah diubah pihak lain. Muat ulang data lalu coba lagi.');
        var val = coerce_(name, h, e.v, row[h]);
        plan.push({ row: row, h: h, val: val, old: row[h] });
      });
      // validasi silang sederhana
      plan.forEach(function (p) {
        if (name === S.GURU && p.h === 'username') {
          var dup = table_(S.GURU).rows.filter(function (g) { return g !== p.row && String(g.username).toLowerCase() === p.val; })[0]; if (dup) throw new Error('Username ' + p.val + ' sudah dipakai.');
        }
        if (name === S.GURU && (p.h === 'peran' || p.h === 'status') && p.row.id_guru === s.id_guru && p.val !== (p.h === 'peran' ? 'Admin' : 'Aktif')) throw new Error('Anda tidak dapat menurunkan atau menonaktifkan akun Anda sendiri.');
      });
      plan.forEach(function (p) {
        var rg = t.sh.getRange(p.row._row, colIdx_(t, p.h));
        if (typeof p.val === 'string') rg.setNumberFormat('@');
        rg.setValue(p.val);
        p.row[p.h] = p.val; rowsTouched[p.row._row] = 1;
        log_(name, 'EDIT', 'r' + p.row._row + '.' + p.h, p.old, p.val, 'editor data');
      });
      afterEdit_(name, Object.keys(rowsTouched).map(Number));
      return { ok: true, saved: plan.length };
    });
  });
}

function addRow(name, rec) {
  return wrap_(function () {
    adminOnly_(); rec = rec || {};
    return withLock_(function () {
      var t = editSheet_(name, true), hid = editCfg_().hidden[name] || {}, o = {}, idh = t.headers[0];
      if (name === S.GURU) throw new Error('Tambah akun lewat menu Kelola Akun.');
      t.headers.forEach(function (h) {
        if (hid[h]) { o[h] = ''; return; }
        var en = enumFor_(name, h), raw = rec[h];
        if (en && en.indexOf('') < 0 && (raw === undefined || raw === null || String(raw).trim() === '')) raw = en[0];   // kolom pilihan wajib: pakai pilihan pertama
        o[h] = coerce_(name, h, raw, undefined);
      });
      if (!o[idh]) o[idh] = newId_(String(name).replace(/^\d+_/, '').slice(0, 3).toUpperCase());
      if (t.rows.some(function (r) { return String(r[idh]) === String(o[idh]); })) throw new Error(idh + ' "' + o[idh] + '" sudah ada.');
      if (!t.headers.some(function (h) { return h !== idh && String(o[h]) !== '' ; })) throw new Error('Isi minimal satu kolom selain ID.');
      var start = t.sh.getLastRow() + 1, rg = t.sh.getRange(start, 1, 1, t.headers.length);
      rg.setNumberFormats([t.headers.map(function (h) { return typeof o[h] === 'string' ? '@' : 'General'; })]);
      rg.setValues([t.headers.map(function (h) { return out_(o[h]); })]);
      o._row = start; t.rows.push(o);
      log_(name, 'INSERT', o[idh], '', '', 'editor data: baris baru');
      afterEdit_(name, [start]);
      return { ok: true, row: start, id: o[idh] };
    });
  });
}

function deleteRows(name, rows) {
  return wrap_(function () {
    adminOnly_();
    if (!Array.isArray(rows) || !rows.length) throw new Error('Pilih baris yang akan dihapus.');
    if (rows.length > 100) throw new Error('Maksimal 100 baris sekali hapus.');
    return withLock_(function () {
      var t = editSheet_(name, true);
      if (editCfg_().nodel[name]) throw new Error('Baris di sheet ini tidak boleh dihapus' + (name === S.GURU ? ' (nonaktifkan akun di Kelola Akun).' : '.'));
      var by = {}; t.rows.forEach(function (r) { by[r._row] = r; });
      var list = rows.map(Number).filter(function (n, i, a) { return a.indexOf(n) === i; }).sort(function (a, b) { return b - a; });
      list.forEach(function (n) { if (!by[n]) throw new Error('Baris ' + n + ' tidak ada lagi. Muat ulang data.'); });
      list.forEach(function (n) { log_(name, 'DELETE', 'r' + n + ' ' + String(by[n][t.headers[0]]), JSON.stringify(by[n]).slice(0, 300), '', 'editor data: hapus baris'); t.sh.deleteRow(n); });
      delete _mem[name];
      afterEdit_(name, []);
      return { ok: true, deleted: list.length };
    });
  });
}

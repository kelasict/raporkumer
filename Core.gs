/* ============================================================================
 *  UTILITAS DASAR
 * ========================================================================== */

var _mem = {};
var _logBuf = [];

function ss_() {
  if (_mem.ss) return _mem.ss;
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  var s = null;
  try { s = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { s = null; }
  if (!s) throw new Error('BELUM_SETUP');
  return (_mem.ss = s);
}

/** True bila Spreadsheet sudah terhubung DAN seluruh sheet wajib sudah ada. */
function isReady_() {
  var cache = CacheService.getScriptCache();
  if (!_mem.ready) {
    if (cache.get('ready') === '1') _mem.ready = true;
    else {
      try {
        var ss = ss_(), ok = SHEET_ORDER.every(function (n) { return !!ss.getSheetByName(n); });
        if (!ok) return false;
        cache.put('ready', '1', 600); _mem.ready = true;
      } catch (e) { return false; }
    }
  }
  if (cache.get('mig_tp') !== '1') { try { migrateTp_(ss_()); cache.put('mig_tp', '1', 21600); } catch (e) { } }
  return true;
}

function norm_(v) {
  if (v instanceof Date) {
    var tz = Session.getScriptTimeZone(), full = Utilities.formatDate(v, tz, "yyyy-MM-dd'T'HH:mm:ss");
    return full.slice(11) === '00:00:00' ? full.slice(0, 10) : full;   // tanggal saja bila tanpa jam
  }
  return v;
}

/** Baca satu sheet menjadi {sh, headers, rows[]} (di-cache per eksekusi). */
function table_(name) {
  if (_mem[name]) return _mem[name];
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Sheet ' + name + ' tidak ditemukan. Jalankan setupSpreadsheet().');
  var lr = sh.getLastRow(), lc = HEADERS[name].length;
  var headers = sh.getRange(1, 1, 1, lc).getValues()[0], rows = [];
  if (lr >= 2) {
    var vals = sh.getRange(2, 1, lr - 1, lc).getValues();
    for (var i = 0; i < vals.length; i++) {
      var o = { _row: i + 2 };
      for (var j = 0; j < lc; j++) o[headers[j]] = norm_(vals[i][j]);
      rows.push(o);
    }
  }
  return (_mem[name] = { sh: sh, headers: headers, rows: rows, name: name });
}

function colIdx_(t, h) { var i = t.headers.indexOf(h); if (i < 0) throw new Error('Kolom ' + h + ' tidak ada di ' + t.name); return i + 1; }
function colLetter_(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

/** Tulis ulang kolom-kolom (harus berdampingan & tanpa formula) untuk semua baris cache. */
function invMK_(t) { delete _mem.ang; delete _mem.sisIdx; if (t && (t.name === S.KELAS || t.name === S.MAPEL)) CacheService.getScriptCache().remove('mk_ok'); }
function writeCols_(t, names) {
  invMK_(t);
  if (!t.rows.length) return;
  var idx = names.map(function (n) { return colIdx_(t, n); });
  var c1 = Math.min.apply(null, idx), c2 = Math.max.apply(null, idx), hs = t.headers.slice(c1 - 1, c2);
  var vals = t.rows.map(function (r) { return hs.map(function (h) { return out_(r[h]); }); });
  t.sh.getRange(2, c1, vals.length, hs.length).setValues(vals);
}

/** Tulis ulang seluruh isi sheet tanpa formula (dipakai 10_CAPAIAN). */
function writeAll_(t) {
  invMK_(t);
  if (!t.rows.length) return;
  var vals = t.rows.map(function (r) { return t.headers.map(function (h) { return out_(r[h]); }); });
  t.sh.getRange(2, 1, vals.length, t.headers.length).setValues(vals);
  t.rows.forEach(function (r, i) { r._row = i + 2; });
}

function out_(v) { return v === undefined || v === null ? '' : v; }

/** Tambah baris di akhir sheet + cache. Mengembalikan baris pertama. */
function appendObjs_(t, objs) {
  if (!objs.length) return 0;
  invMK_(t);
  var start = t.sh.getLastRow() + 1;
  var vals = objs.map(function (o) { return t.headers.map(function (h) { return out_(o[h]); }); });
  t.sh.getRange(start, 1, vals.length, t.headers.length).setValues(vals);
  objs.forEach(function (o, i) { o._row = start + i; t.rows.push(o); });
  return start;
}

function idx_(rows, key) { var m = {}; rows.forEach(function (r) { if (r[key] !== '' && r[key] != null) m[r[key]] = r; }); return m; }
function groupBy_(rows, fn) { var m = {}; rows.forEach(function (r) { var k = fn(r); (m[k] = m[k] || []).push(r); }); return m; }
function isTrue_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function notFalse_(v) { return !(v === false || String(v).toUpperCase() === 'FALSE'); }
function num_(v) { if (v === '' || v === null || v === undefined) return null; var n = Number(v); return isNaN(n) ? null : n; }
function isInt100_(n) { return n !== null && Number.isInteger(n) && n >= 0 && n <= 100; }
function round2_(x) { return Math.round(x * 100) / 100; }
function pad_(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
function now_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"); }
function newId_(prefix) { return prefix + '-' + Date.now() + '-' + pad_(Math.floor(Math.random() * 10000), 4); }

function log_(sheet, aksi, ref, oldV, newV, ket) {
  _logBuf.push([new Date(), (_mem.email || ''), sheet, aksi, ref, String(oldV === undefined ? '' : oldV).slice(0, 500), String(newV === undefined ? '' : newV).slice(0, 500), ket || '']);
}
function flushLog_() {
  if (!_logBuf.length) return;
  var sh = ss_().getSheetByName(S.LOG), start = sh.getLastRow() + 1;
  sh.getRange(start, 1, _logBuf.length, 8).setValues(_logBuf);
  _logBuf = [];
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { try { flushLog_(); } catch (e) { } lock.releaseLock(); }
}

function wrap_(fn) {
  try { return fn(); } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }
}

/* ============================================================================
 *  KONFIGURASI, SESI, OTORISASI
 * ========================================================================== */

function cfg_() {
  if (_mem.cfg) return _mem.cfg;
  var m = {};
  table_(S.CONFIG).rows.forEach(function (r) { if (r.key) m[r.key] = r.value; });
  function g(k, d) { return (m[k] === undefined || m[k] === '') ? d : m[k]; }
  var sep = String(m.template_separator_tp === undefined || m.template_separator_tp === '' ? '; ' : m.template_separator_tp);
  var c = {
    tahun_ajaran: String(g('tahun_ajaran_aktif', '')), semester: String(g('semester_aktif', '1')),
    bobot_sumatif: Number(g('bobot_sumatif', 40)), bobot_sas: Number(g('bobot_sas', 60)),
    batas_tuntas: Number(g('batas_tuntas', 75)), kktp_b: Number(g('kktp_b', 83)), kktp_a: Number(g('kktp_a', 92)),
    max_char: Number(g('max_char_deskripsi', 1500)),
    l_a: String(g('label_a', 'Sangat menguasai dalam')), l_b: String(g('label_b', 'Menunjukkan penguasaan yang baik dalam')),
    l_c: String(g('label_c', 'Menunjukkan pemahaman yang cukup dalam')), l_d: String(g('label_d', 'Perlu bantuan dalam')),
    sep: sep
  };
  c.bobot_total = c.bobot_sumatif + c.bobot_sas;
  c.bobot_valid = c.bobot_total === 100;
  return (_mem.cfg = c);
}

/** Sesi dari token login (disimpan di CacheService). Melempar SESI_HABIS bila tidak valid. */
function session_() {
  if (_mem.sess) return _mem.sess;
  var tok = String(_mem.tok || '');
  if (!/^[a-f0-9]{64}$/.test(tok)) throw new Error('SESI_HABIS');
  var cache = CacheService.getScriptCache(), id = cache.get('tok_' + tok);
  if (!id) throw new Error('SESI_HABIS');
  var g, raw = cache.get('ses_' + id);
  if (raw) { try { g = JSON.parse(raw); } catch (e) { g = null; } }
  if (!g) {
    var r0 = table_(S.GURU).rows.filter(function (r) { return r.id_guru === id && r.status === 'Aktif'; })[0];
    if (!r0) throw new Error('SESI_HABIS');
    g = { id_guru: r0.id_guru, username: r0.username, nama_guru: r0.nama_guru, nip: r0.nip || '', peran: r0.peran };
    cache.put('ses_' + id, JSON.stringify(g), 300);
  }
  cache.put('tok_' + tok, id, 21600);          // perpanjang 6 jam sejak aktivitas terakhir
  var admin = g.peran === 'Admin';
  _mem.email = g.username;
  return (_mem.sess = { email: g.username, username: g.username, id_guru: g.id_guru, nama: g.nama_guru, nip: g.nip || '', admin: admin, roles: admin ? ['guru', 'admin'] : ['guru'] });
}

/** Semua guru boleh mengakses semua mapel & kelas aktif (tanpa penugasan per guru). */
function mkAuth_(idMK) {
  var sess = session_();
  var mk = table_(S.MK).rows.filter(function (m) { return m.id_mapel_kelas === idMK; })[0];
  if (!mk || mk.status !== 'Aktif') throw new Error('Mapel & kelas tidak ditemukan atau nonaktif.');
  var kelas = idx_(table_(S.KELAS).rows, 'id_kelas')[mk.id_kelas];
  var mapel = idx_(table_(S.MAPEL).rows, 'id_mapel')[mk.id_mapel];
  if (!kelas || !mapel) throw new Error('Data kelas/mapel tidak lengkap.');
  return { sess: sess, mk: mk, kelas: kelas, mapel: mapel };
}

/** Daftar mapel-kelas dibentuk otomatis: setiap kelas aktif × setiap mapel aktif. */
function planMK_() {
  var t = table_(S.MK), have = {}, kA = {}, mA = {}, add = [], flip = [];
  t.rows.forEach(function (r) { have[r.id_kelas + '|' + r.id_mapel] = r; });
  var kelas = table_(S.KELAS).rows, mapel = table_(S.MAPEL).rows;
  kelas.forEach(function (k) { if (k.status === 'Aktif') kA[k.id_kelas] = 1; });
  mapel.forEach(function (m) { if (notFalse_(m.aktif)) mA[m.id_mapel] = 1; });
  kelas.forEach(function (k) { if (!kA[k.id_kelas]) return; mapel.forEach(function (m) {
    if (!mA[m.id_mapel] || have[k.id_kelas + '|' + m.id_mapel]) return;
    add.push({ id_mapel_kelas: 'MK-' + String(k.id_kelas).replace(/^KLS-/, '') + '-' + String(m.kode_mapel || m.id_mapel).replace(/^MPL-/, ''), id_kelas: k.id_kelas, id_mapel: m.id_mapel, id_guru: '', jam_per_minggu: '', status: 'Aktif' });
  }); });
  t.rows.forEach(function (r) { var want = kA[r.id_kelas] && mA[r.id_mapel] ? 'Aktif' : 'Nonaktif'; if (r.status !== want) flip.push([r, want]); });
  return { add: add, flip: flip };
}
function needSyncMK_() { var p = planMK_(); return p.add.length + p.flip.length > 0; }
/** Panggil di dalam withLock_. */
function syncMK_() {
  var p = planMK_(), t = table_(S.MK);
  if (p.flip.length) { p.flip.forEach(function (f) { f[0].status = f[1]; }); writeCols_(t, ['status']); }
  if (p.add.length) appendObjs_(t, p.add);
  CacheService.getScriptCache().put('mk_ok', '1', 600);
  return p.add.length + p.flip.length;
}

function anggotaAktif_(idKelas) {
  var memo = _mem.ang || (_mem.ang = {});
  if (memo[idKelas]) return memo[idKelas];
  var sis = _mem.sisIdx || (_mem.sisIdx = idx_(table_(S.SISWA).rows, 'id_siswa'));
  return memo[idKelas] = table_(S.ANGGOTA).rows.filter(function (a) { return a.id_kelas === idKelas && a.status_keanggotaan === 'Aktif' && sis[a.id_siswa] && sis[a.id_siswa].status === 'Aktif'; })
    .sort(function (a, b) { return (num_(a.no_absen) || 9999) - (num_(b.no_absen) || 9999) || String(sis[a.id_siswa].nama_siswa).localeCompare(String(sis[b.id_siswa].nama_siswa)); })
    .map(function (a) { var x = sis[a.id_siswa]; return { id_anggota: a.id_anggota, id_siswa: a.id_siswa, no_absen: a.no_absen, nisn: x.nisn, nis: x.nis, nama: x.nama_siswa, jk: x.jenis_kelamin, tempat_lahir: x.tempat_lahir, tanggal_lahir: x.tanggal_lahir, agama: x.agama, pendidikan_sebelumnya: x.pendidikan_sebelumnya, alamat: x.alamat, nama_ayah: x.nama_ayah, nama_ibu: x.nama_ibu, pekerjaan_ayah: x.pekerjaan_ayah, pekerjaan_ibu: x.pekerjaan_ibu, alamat_ortu: x.alamat_ortu, nama_wali: x.nama_wali }; });
}

/** TP milik satu kelas: mapel sama, fase sama, dan TINGKAT sama (TP lama yang belum bertingkat tampil di semua tingkat sampai disimpan). */
function tpFor_(idMapel, kelas, onlyAktif) {
  var ting = String(kelas.tingkat === undefined || kelas.tingkat === null ? '' : kelas.tingkat);
  return table_(S.TP).rows.filter(function (t) {
    return t.id_mapel === idMapel && t.fase === kelas.fase && (t.tingkat === '' || t.tingkat === undefined || t.tingkat === null || String(t.tingkat) === ting) && (!onlyAktif || notFalse_(t.aktif));
  }).sort(function (a, b) { return (num_(a.urutan) || 0) - (num_(b.urutan) || 0); });
}
function tpAktif_(idMapel, kelas) { return tpFor_(idMapel, kelas, true); }

/** Migrasi sekali: tambah kolom `tingkat` pada 07_TUJUAN_PEMBELAJARAN. TP yang nilainya hanya ada di satu tingkat otomatis dikunci ke tingkat itu. */
function migrateTp_(ss) {
  var sh = ss.getSheetByName(S.TP); if (!sh) return;
  var want = HEADERS[S.TP], n = want.length;
  if (sh.getRange(1, n, 1, 1).getValues()[0][0] === 'tingkat') return;
  sh.getRange(1, n).setValue('tingkat').setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
  var lr = sh.getLastRow(); if (lr < 2) return;
  var ids = sh.getRange(2, 1, lr - 1, 1).getValues(), res = ids.map(function () { return ['']; });
  function rd(name, cols) { var s = ss.getSheetByName(name); if (!s || s.getLastRow() < 2) return []; return s.getRange(2, 1, s.getLastRow() - 1, cols).getValues(); }
  var kls = {}; rd(S.KELAS, 3).forEach(function (r) { kls[r[0]] = String(r[2]); });
  var ang = {}; rd(S.ANGGOTA, 2).forEach(function (r) { ang[r[0]] = kls[r[1]] || ''; });
  var seen = {}; rd(S.NTP, 4).forEach(function (r) { var t = ang[r[1]]; if (!t || !r[3]) return; (seen[r[3]] = seen[r[3]] || {})[t] = 1; });
  ids.forEach(function (r, i) { var k = Object.keys(seen[r[0]] || {}); if (k.length === 1) res[i][0] = Number(k[0]) || k[0]; });
  sh.getRange(2, n, res.length, 1).setValues(res);
  delete _mem[S.TP];
}

function nf_(r) { var n = num_(r.nilai), m = num_(r.nilai_remedial); if (n === null) return m; return m === null ? n : Math.max(n, m); }

/** KKTP per mapel: batas predikat C, B, A (D = di bawah C). Kosong → nilai bawaan _CONFIG. */
function kktp_(mp) {
  var c = cfg_(), C = num_(mp && mp.kktp_c), B = num_(mp && mp.kktp_b), A = num_(mp && mp.kktp_a);
  return { c: C === null ? c.batas_tuntas : C, b: B === null ? c.kktp_b : B, a: A === null ? c.kktp_a : A };
}

/** Predikat A/B/C/D menurut KKTP mapel (kategori yang sama dengan lembar KKTP). */
function predikat_(n, mp) {
  if (n === null || n === undefined || n === '') return { kode: '', label: '' };
  var k = kktp_(mp);
  if (n >= k.a) return { kode: 'A', label: 'Sangat Baik' };
  if (n >= k.b) return { kode: 'B', label: 'Baik' };
  if (n >= k.c) return { kode: 'C', label: 'Cukup' };
  return { kode: 'D', label: 'Perlu Bantuan' };
}

function naIndex_() { var m = {}; table_(S.NA).rows.forEach(function (r) { m[r.id_anggota + '|' + r.id_mapel] = r; }); return m; }

function avg_(arr) {
  var v = arr.filter(function (x) { return x !== null && x !== undefined && x !== ''; }).map(Number);
  return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null;
}

/** Nilai rapor sesuai lembar Excel (LEGER):
 *  M = rata-rata sumatif lingkup materi, N = sumatif tengah semester (STS), Q = rata-rata SAS (non-tes, tes).
 *  M saja → M | M+N → 40%M+60%N | M+Q → 40%M+60%Q | M+N+Q → rata-rata( 40%M+60%Q , N ) | tanpa M → kosong. */
function hitungNA_(row, c) {
  var sum = []; for (var i = 1; i <= 10; i++) sum.push(num_(row['sum_' + i]));
  var M = avg_(sum), N = num_(row.nilai_sts), Q = avg_([num_(row.nilai_non_tes), num_(row.nilai_tes)]);
  var wM = c.bobot_sumatif / 100, wS = c.bobot_sas / 100, v = null;
  if (M !== null) {
    if (N === null && Q === null) v = M;
    else if (Q === null) v = wM * M + wS * N;
    else if (N === null) v = wM * M + wS * Q;
    else v = ((wM * M + wS * Q) + N) / 2;
  }
  return { na_sumatif: M === null ? '' : round2_(M), na_sas: Q === null ? '' : round2_(Q), nilai_rapor: v === null ? null : round2_(v) };
}

/** Hitung ulang kolom turunan pada satu baris NA (tanpa menulis ke sheet). */
function recalcNA_(row, mp) {
  var c = cfg_(), h = hitungNA_(row, c);
  row.na_sumatif = h.na_sumatif; row.na_sas = h.na_sas;
  row.nilai_rapor = h.nilai_rapor === null ? '' : h.nilai_rapor;
  row.predikat = h.nilai_rapor === null ? '' : predikat_(h.nilai_rapor, mp).kode;
  return h.nilai_rapor;
}

function ensureNA_(pairs) {
  var t = table_(S.NA), idx = naIndex_(), add = [], seen = {};
  pairs.forEach(function (p) {
    var k = p.id_anggota + '|' + p.id_mapel;
    if (idx[k] || seen[k]) return; seen[k] = 1;
    var o = { id_nilai_akhir: newId_('NA'), id_anggota: p.id_anggota, id_mapel: p.id_mapel, status_final: false, tanggal_finalisasi: '' };
    t.headers.forEach(function (h) { if (o[h] === undefined) o[h] = ''; });
    add.push(o);
  });
  if (add.length) appendObjs_(t, add);
}

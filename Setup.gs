/* ============================================================================
 *  ENTRY POINT WEB APP + MENU
 * ========================================================================== */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Rapor Kurikulum Merdeka')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** API untuk frontend yang dihosting di luar Apps Script (mis. GitHub Pages).
 *  Body: JSON {name, args} dikirim sebagai text/plain agar tanpa preflight CORS. */
function doPost(e) {
  var out;
  try {
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}'), args = Array.isArray(b.args) ? b.args : [];
    if (b.name === 'getPublicInfo') out = getPublicInfo();
    else if (b.name === 'login') out = login(args[0], args[1]);
    else if (b.name === 'setupConnect') out = setupConnect(args[0], args[1], args[2], args[3]);
    else if (b.name === 'rpc') out = rpc(args[0], args[1], args[2]);
    else out = { ok: false, error: 'Fungsi tidak dikenal.' };
  } catch (err) { out = { ok: false, error: String(err && err.message ? err.message : err) }; }
  return ContentService.createTextOutput(JSON.stringify(out === undefined ? null : out)).setMimeType(ContentService.MimeType.JSON);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Rapor Merdeka')
    .addItem('Siapkan struktur sheet', 'setupSpreadsheet')
    .addItem('Isi data contoh (demo)', 'seedDemo')
    .addSeparator()
    .addItem('Isi ID otomatis (jika mengisi manual di sheet)', 'isiIdOtomatis')
    .addItem('Perbarui 14_REKAP_RAPOR', 'refreshRekap')
    .addToUi();
}

/** Trigger sederhana: normalisasi email guru & validasi NISN (untuk operator). */
function onEdit(e) {
  try {
    var sh = e.range.getSheet(), name = sh.getName();
    if (e.range.getRow() < 2) return;
    var hdr = sh.getRange(1, e.range.getColumn()).getValue();
    if (name === S.GURU && hdr === 'username') {
      e.range.setValue(String(e.range.getValue()).trim().toLowerCase());
    }
    if (name === S.SISWA && hdr === 'nisn') {
      var v = String(e.range.getValue());
      if (v && !/^\d{10}$/.test(v)) e.source.toast('NISN harus 10 digit angka.', 'Validasi', 6);
    }
  } catch (err) { /* abaikan */ }
}

/* ============================================================================
 *  SETUP
 * ========================================================================== */

/** Dipanggil dari menu Spreadsheet atau editor: memakai Spreadsheet tempat script terpasang. */
function setupSpreadsheet() { ownerOnly_(); return setupSpreadsheet_(); }
function setupSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Script ini tidak terikat ke Spreadsheet. Buka layar "Setup awal" di Web App dan tempel link Spreadsheet.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  _mem.ss = ss;
  buildStructure_(ss);
  toast_('Struktur sheet siap. Langkah berikut: deploy Web App lalu buka dan lengkapi Admin.');
  return 'OK';
}

/** Membuat 18 sheet, header, nilai bawaan, dropdown. Aman dijalankan berulang (tidak menimpa data). */
function buildStructure_(ss) {
  migrateGuru_(ss);
  SHEET_ORDER.forEach(function (name, i) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name, i);
    var hdr = HEADERS[name];
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, hdr.length).setValues([hdr])
        .setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
  });
  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);

  var cfg = ss.getSheetByName(S.CONFIG);
  if (cfg.getLastRow() < 2) cfg.getRange(2, 1, DEFAULT_CONFIG.length, 3).setValues(DEFAULT_CONFIG);
  cfg.getRange('B2:B' + (DEFAULT_CONFIG.length + 1)).setNumberFormat('@');

  var ref = ss.getSheetByName(S.REF);
  if (ref.getLastRow() < 2) {
    var rows = DEFAULT_REF.map(function (r) {
      return [r[0], r[1], r[2], r[3], r[4] === undefined ? '' : r[4], r[5] === undefined ? '' : r[5], true];
    });
    ref.getRange(2, 1, rows.length, 7).setValues(rows);
    ref.getRange(2, 2, rows.length, 1).setNumberFormat('@');
  }

  // Dropdown (lapis 1 integritas)
  setList_(ss.getSheetByName(S.SISWA), 5, ['L', 'P']);
  setList_(ss.getSheetByName(S.SISWA), 17, ['Aktif', 'Lulus', 'Pindah', 'Keluar']);
  setList_(ss.getSheetByName(S.KELAS), 4, ['A', 'B', 'C', 'D', 'E', 'F']);
  setList_(ss.getSheetByName(S.KELAS), 8, ['Aktif', 'Arsip']);
  setList_(ss.getSheetByName(S.ANGGOTA), 6, ['Aktif', 'Pindah', 'Keluar']);
  setList_(ss.getSheetByName(S.MAPEL), 4, ['Umum', 'Muatan Lokal', 'P5']);
  setList_(ss.getSheetByName(S.GURU), 5, ['Guru', 'Admin']);
  setList_(ss.getSheetByName(S.GURU), 8, ['Aktif', 'Nonaktif']);
  setList_(ss.getSheetByName(S.MK), 6, ['Aktif', 'Nonaktif']);
  setList_(ss.getSheetByName(S.NTP), 8, ['Formatif', 'Sumatif', 'Projek']);
  ss.getSheetByName(S.SISWA).getRange('B:C').setNumberFormat('@');
  ss.getSheetByName(S.SISWA).getRange('G:G').setNumberFormat('@');

  // Conditional format FK (lapis 2): id_kelas di 03 harus ada di 02
  var an = ss.getSheetByName(S.ANGGOTA);
  an.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($B2<>"",COUNTIF(\'02_KELAS\'!$A:$A,$B2)=0)')
      .setBackground('#fecaca').setRanges([an.getRange('B2:B')]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($C2<>"",COUNTIF(\'01_SISWA\'!$A:$A,$C2)=0)')
      .setBackground('#fecaca').setRanges([an.getRange('C2:C')]).build()
  ]);

  ss.getSheetByName(S.GURU).getRange('F:G').setNumberFormat('@');
  ss.getSheetByName(S.GURU).getRange('A1').setNote('Kolom password_hash & salt dikelola aplikasi. Jangan diisi manual; ubah password lewat menu Kelola Akun.');
  ss.getSheetByName(S.REKAP).getRange('A1').setNote('VIEW. Jangan diisi manual. Diperbarui lewat menu Rapor Merdeka > Perbarui 14_REKAP_RAPOR.');
}

/** Toast hanya bila dijalankan dari Spreadsheet (di Web App tidak ada UI Spreadsheet). */
function toast_(msg) {
  try { var a = SpreadsheetApp.getActive(); if (a) a.toast(msg, 'Rapor Merdeka', 8); } catch (e) { }
}

function setList_(sh, col, list) {
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).build();
  sh.getRange(2, col, 1000, 1).setDataValidation(rule);
}

function installTriggers() { ownerOnly_(); return installTriggers_(); }
function installTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'backupHarian') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('backupHarian').timeBased().everyDays(1).atHour(1).create();
  toast_('Backup harian pukul 01:00 terpasang.');
}

function backupHarian() {
  var bk = CacheService.getScriptCache();
  if (bk.get('bk_lock')) return;               // maksimal satu salinan per 6 jam (pemanggilan berulang diabaikan)
  bk.put('bk_lock', '1', 21600);
  var ss = ss_();
  var it = DriveApp.getFoldersByName('_BACKUP');
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder('_BACKUP');
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  DriveApp.getFileById(ss.getId()).makeCopy('RAPOR-backup-' + stamp, folder);
  var cutoff = Date.now() - 90 * 86400000, files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (f.getName().indexOf('RAPOR-backup-') === 0 && f.getDateCreated().getTime() < cutoff) f.setTrashed(true);
  }
}

/** Isi ID otomatis untuk baris yang kolom id-nya kosong. */
function isiIdOtomatis() {
  ownerOnly_();
  var yr = String(new Date().getFullYear());
  [[S.SISWA, 'id_siswa', 'SIS-' + yr + '-', 4], [S.GURU, 'id_guru', 'GRU-', 4], [S.ANGGOTA, 'id_anggota', 'AGT-', 6]]
    .forEach(function (c) {
      var sh = ss_().getSheetByName(c[0]); if (!sh || sh.getLastRow() < 2) return;
      var rng = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()), vals = rng.getValues();
      var maxN = 0;
      vals.forEach(function (r) { var m = String(r[0]).match(/(\d+)$/); if (m) maxN = Math.max(maxN, +m[1]); });
      var anyName = c[0] === S.SISWA ? 3 : (c[0] === S.GURU ? 2 : 1);
      vals.forEach(function (r) { if (!r[0] && r[anyName]) { maxN++; r[0] = c[2] + pad_(maxN, c[3]); } });
      sh.getRange(2, 1, vals.length, 1).setValues(vals.map(function (r) { return [r[0]]; }));
    });
}


/* ============================================================================
 *  DATA CONTOH (opsional) — jalankan dari menu "Isi data contoh"
 * ========================================================================== */

function seedDemo() { ownerOnly_(); return seedDemo_(); }
function seedDemo_() {
  if (!isReady_()) setupSpreadsheet_();
  var ss = ss_(), D = SEED_ALKAUTSAR;
  if (ss.getSheetByName(S.SISWA).getLastRow() > 1) { toast_('Sheet 01_SISWA sudah berisi data, data contoh tidak dimuat.'); return false; }
  function putObjs(name, objs, textCols) {
    if (!objs.length) return;
    var sh = ss.getSheetByName(name), hdr = HEADERS[name];
    (textCols || []).forEach(function (h) { sh.getRange(2, hdr.indexOf(h) + 1, objs.length, 1).setNumberFormat('@'); });
    sh.getRange(2, 1, objs.length, hdr.length).setValues(objs.map(function (o) { return hdr.map(function (h) { return o[h] === undefined || o[h] === null ? '' : o[h]; }); }));
  }
  // _CONFIG: tahun ajaran, semester, identitas sekolah
  var cf = table_(S.CONFIG), ci = idx_(cf.rows, 'key');
  function setCfg(k, v) { if (ci[k]) ci[k].value = v; }
  setCfg('tahun_ajaran_aktif', D.kelas.tahun_ajaran); setCfg('semester_aktif', D.kelas.semester);
  SEKOLAH_KEYS.forEach(function (k) { setCfg('sekolah_' + k, D.sekolah[k] || ''); });
  writeCols_(cf, ['value']);

  var idGuru = 'GRU-0001', idKelas = 'KLS-2023-7BIL', now = new Date();
  var pw = makePw_('guru123');
  putObjs(S.GURU, [{ id_guru: idGuru, nip: D.kelas.nip_wali, nama_guru: D.kelas.wali, username: 'lantabura', peran: 'Guru', password_hash: pw.hash, salt: pw.salt, status: 'Aktif' }], ['password_hash', 'salt']);
  var mapel = D.mapel.map(function (m) { return { id_mapel: 'MPL-' + m.kode, nama_mapel: m.nama, kode_mapel: m.kode, kelompok: m.kelompok, kktp_c: m.kktp_c, kktp_b: m.kktp_b, kktp_a: m.kktp_a, aktif: true }; });
  putObjs(S.MAPEL, mapel);
  putObjs(S.KELAS, [{ id_kelas: idKelas, nama_kelas: D.kelas.nama, tingkat: D.kelas.tingkat, fase: D.kelas.fase, tahun_ajaran: D.kelas.tahun_ajaran, semester: D.kelas.semester, id_wali_kelas: idGuru, status: 'Aktif' }]);
  var sis = [], ag = [], dr = [], idA = [];
  D.siswa.forEach(function (x, i) {
    var id = 'SIS-2023-' + pad_(i + 1, 4), ida = 'AGT-' + pad_(i + 1, 6); idA.push(ida);
    var o = { id_siswa: id, status: 'Aktif', created_at: now, updated_at: now, jenis_kelamin: x.jk };
    ['nisn', 'nis', 'tempat_lahir', 'tanggal_lahir', 'agama', 'pendidikan_sebelumnya', 'alamat', 'nama_ayah', 'nama_ibu', 'pekerjaan_ayah', 'pekerjaan_ibu', 'alamat_ortu', 'nama_wali'].forEach(function (k) { o[k] = x[k]; });
    o.nama_siswa = x.nama; sis.push(o);
    ag.push({ id_anggota: ida, id_kelas: idKelas, id_siswa: id, no_absen: x.no, tanggal_masuk: now, status_keanggotaan: 'Aktif' });
    var d = { id_anggota: ida, sakit: x.sakit, izin: x.izin, alpa: x.alpa, catatan_wali: x.catatan, keputusan: x.keputusan };
    (x.ekskul || []).forEach(function (e, j) { d['ekskul_' + (j + 1)] = e.nama; d['predikat_' + (j + 1)] = e.predikat; d['ket_' + (j + 1)] = e.ket; });
    dr.push(d);
  });
  putObjs(S.SISWA, sis, ['nisn', 'nis', 'tanggal_lahir']); putObjs(S.ANGGOTA, ag); putObjs(S.DR, dr);
  putObjs(S.MK, mapel.map(function (m) { return { id_mapel_kelas: 'MK-7BIL-' + m.kode_mapel, id_kelas: idKelas, id_mapel: m.id_mapel, id_guru: '', status: 'Aktif' }; }));
  var tpRows = [], tpId = {}, urut = {};
  D.tp.forEach(function (t) {
    var kode = t.mapel.replace('MPL-', ''), m = D.mapel.filter(function (x) { return x.id === t.mapel; })[0], idm = 'MPL-' + m.kode;
    var id = 'TP-' + m.kode + '-D-' + pad_(t.urutan, 3); (tpId[idm] = tpId[idm] || []).push(id);
    tpRows.push({ id_tp: id, id_mapel: idm, fase: 'D', kode_tp: t.kode, deskripsi_tp: t.deskripsi, urutan: t.urutan, aktif: true, tingkat: D.kelas.tingkat });
  });
  putObjs(S.TP, tpRows);
  var ntp = [], na = [], mapelById = {}; mapel.forEach(function (m) { mapelById[m.id_mapel] = m; });
  var c = cfg_(), seq = 0;
  D.nilai.forEach(function (n) {
    var m = D.mapel.filter(function (x) { return x.id === n.mapel; })[0], idm = 'MPL-' + m.kode, ida = idA[n.siswa];
    n.f.forEach(function (v, j) { if (v !== null && tpId[idm][j]) ntp.push({ id_nilai_tp: 'NTP-' + pad_(++seq, 6), id_anggota: ida, id_mapel: idm, id_tp: tpId[idm][j], nilai: v, nilai_final: v, jenis_sumatif: 'Formatif', tanggal_input: now, id_guru: idGuru }); });
    var row = { id_nilai_akhir: 'NA-' + pad_(seq + 100000, 6) + '-' + n.siswa, id_anggota: ida, id_mapel: idm, status_final: false, tanggal_finalisasi: '', nilai_sts: n.sts, nilai_non_tes: n.nt, nilai_tes: n.t };
    n.s.forEach(function (v, j) { row['sum_' + (j + 1)] = v; });
    recalcNA_(row, mapelById[idm]); na.push(row);
  });
  putObjs(S.NTP, ntp); putObjs(S.NA, na);
  var who = _mem.email || 'data-contoh', tok = _mem.tok;
  _mem = { email: who, tok: tok };   // muat ulang cache, lalu susun deskripsi capaian otomatis
  var ctx = genCtx_(), res = { generated: 0, incomplete: 0, override: 0 }, results = [];
  mapel.forEach(function (m) { idA.forEach(function (ida) { results.push({ p: { id_anggota: ida, id_mapel: m.id_mapel }, r: computeCap_(ctx, ida, m.id_mapel, false) }); }); });
  persistCap_(ctx, results, res);
  flushLog_();
  toast_('Data contoh SMP IT Al-Kautsar dimuat: ' + D.siswa.length + ' siswa, ' + mapel.length + ' mapel. Akun guru contoh: lantabura / guru123.');
  return true;
}

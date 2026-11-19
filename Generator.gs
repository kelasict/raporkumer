/* ----------------------------------------------------------------------------
 *  AUTO-GENERATE DESKRIPSI (Bagian 7 PRD)
 * -------------------------------------------------------------------------- */

function genCtx_() {
  var c = { cfg: cfg_() };
  c.kelasById = idx_(table_(S.KELAS).rows, 'id_kelas');
  c.anggotaById = idx_(table_(S.ANGGOTA).rows, 'id_anggota');
  c.mapelById = idx_(table_(S.MAPEL).rows, 'id_mapel');
  c.tpAll = table_(S.TP).rows; c.tpById = idx_(c.tpAll, 'id_tp');
  c.nilai = groupBy_(table_(S.NTP).rows, function (r) { return r.id_anggota + '|' + r.id_mapel; });
  c.cap = table_(S.CAP); c.capIdx = {};
  c.cap.rows.forEach(function (r) { c.capIdx[r.id_anggota + '|' + r.id_mapel] = r; });
  c.na = naIndex_();
  return c;
}

function itemTp_(tp) {
  return (String(tp.deskripsi_tp || '').trim() || String(tp.kode_tp || '')).replace(/[\s.;,]+$/, '');
}

function potongDiKataTerakhir_(text, max) {
  if (text.length <= max) return text;
  var cut = text.substring(0, max), sp = cut.lastIndexOf(' ');
  return (sp > 0 ? cut.substring(0, sp) : cut).replace(/[\s,;:]+$/, '');
}

/** Murni hitung (tanpa tulis). Mengembalikan {ok, rec} atau {ok:false, reason}. */
function computeCap_(ctx, idAnggota, idMapel, force) {
  var c = ctx.cfg, ang = ctx.anggotaById[idAnggota];
  if (!ang) return { ok: false, reason: 'ANGGOTA_TIDAK_ADA' };
  var kelas = ctx.kelasById[ang.id_kelas], existing = ctx.capIdx[idAnggota + '|' + idMapel];
  if (existing && isTrue_(existing.status_manual_edit) && !force) return { ok: false, reason: 'MANUAL_OVERRIDE_AKTIF' };
  var tps = ctx.tpAll.filter(function (t) { return t.id_mapel === idMapel && t.fase === kelas.fase && (!t.tingkat || String(t.tingkat) === String(kelas.tingkat)) && notFalse_(t.aktif); })
    .sort(function (a, b) { return (num_(a.urutan) || 0) - (num_(b.urutan) || 0); });
  if (!tps.length) return { ok: false, reason: 'NO_DATA', dinilai: 0, total: 0 };
  var map = {}; (ctx.nilai[idAnggota + '|' + idMapel] || []).forEach(function (r) { var v = nf_(r); if (v !== null) map[r.id_tp] = v; });
  var scored = tps.filter(function (t) { return map[t.id_tp] !== undefined; });
  if (!scored.length) return { ok: false, reason: 'INCOMPLETE', dinilai: 0, total: tps.length };

  var vals = scored.map(function (t) { return map[t.id_tp]; });
  var vmax = Math.max.apply(null, vals), vmin = Math.min.apply(null, vals);
  var hi = scored.filter(function (t) { return map[t.id_tp] === vmax; }).slice(0, 3);
  var lo = scored.filter(function (t) { return map[t.id_tp] === vmin; }).slice(0, 3);
  // Kategori per TP menurut KKTP mapel (sama dengan lembar Excel): A ≥ a | B ≥ b | C ≥ c | D < c
  var k = kktp_(ctx.mapelById[idMapel]), G = { A: [], B: [], C: [], D: [] };
  scored.forEach(function (t) { var v = map[t.id_tp]; G[v >= k.a ? 'A' : v >= k.b ? 'B' : v >= k.c ? 'C' : 'D'].push(itemTp_(t)); });
  var L = { A: c.l_a, B: c.l_b, C: c.l_c, D: c.l_d };
  function bagian(keys) { return keys.filter(function (x) { return G[x].length; }).map(function (x) { return L[x] + ' ' + G[x].join(c.sep) + '.'; }).join(' '); }
  var dT = bagian(['A', 'B']), dR = bagian(['C', 'D']);
  var fin = bagian(['A', 'B', 'C', 'D']), warn = '';
  if (fin.length > c.max_char) { fin = potongDiKataTerakhir_(fin, c.max_char - 3) + '...'; warn = 'TRUNCATED'; }
  return {
    ok: true, warn: warn,
    rec: {
      id_tp_tertinggi: hi.map(function (t) { return t.id_tp; }).join(';'), nilai_tertinggi: vmax, daftar_kode_tp_tinggi: hi.map(function (t) { return t.kode_tp; }).join('; '),
      id_tp_terendah: lo.map(function (t) { return t.id_tp; }).join(';'), nilai_terendah: vmin, daftar_kode_tp_rendah: lo.map(function (t) { return t.kode_tp; }).join('; '),
      deskripsi_tinggi: dT, deskripsi_rendah: dR, deskripsi_rapor: fin, batas_tuntas_saat_generate: k.c, versi_algoritma: VERSI_ALGO
    }
  };
}

/** Simpan hasil compute (batch, satu kali tulis). res = penghitung. force → reset manual. */
function persistCap_(ctx, results, res, force) {
  var email = (_mem.email || session_().email), changed = false;
  results.forEach(function (x) {
    var r = x.r, p = x.p;
    if (!r.ok) {
      if (r.reason === 'INCOMPLETE' || r.reason === 'NO_DATA') res.incomplete++;
      else if (r.reason === 'MANUAL_OVERRIDE_AKTIF') res.override++;
      return;
    }
    var key = p.id_anggota + '|' + p.id_mapel, ex = ctx.capIdx[key], naRow = ctx.na[key];
    if (naRow && isTrue_(naRow.status_final)) { res.locked = (res.locked || 0) + 1; return; }
    var base = {}; Object.keys(r.rec).forEach(function (k) { base[k] = r.rec[k]; });
    base.generated_at = now_(); base.generated_by = email;
    if (!ex) {
      base.id_capaian = newId_('CAP'); base.id_anggota = p.id_anggota; base.id_mapel = p.id_mapel; base.status_manual_edit = false; base.catatan_guru = '';
      ctx.cap.rows.push(base); ctx.capIdx[key] = base;
      log_(S.CAP, 'GENERATE', base.id_capaian, '', base.deskripsi_rapor, r.warn ? 'deskripsi dipotong (max_char)' : '');
    } else {
      var old = ex.deskripsi_rapor;
      Object.keys(base).forEach(function (k) { ex[k] = base[k]; });
      if (force) { ex.status_manual_edit = false; ex.catatan_guru = ''; }
      log_(S.CAP, 'GENERATE', ex.id_capaian, old, ex.deskripsi_rapor, r.warn ? 'deskripsi dipotong (max_char)' : '');
    }
    res.generated++; changed = true;
  });
  if (changed) {
    var t = ctx.cap, before = t.sh.getLastRow() - 1, rows = t.rows;
    var vals = rows.map(function (r) { return t.headers.map(function (h) { return out_(r[h]); }); });
    t.sh.getRange(2, 1, vals.length, t.headers.length).setValues(vals);
    rows.forEach(function (r, i) { r._row = i + 2; });
  }
}

function generateCapaian(idMK, idAnggota, force) {
  return wrap_(function () {
    return withLock_(function () {
      var a = mkAuth_(idMK), ang = anggotaAktif_(a.kelas.id_kelas).filter(function (x) { return x.id_anggota === idAnggota; })[0];
      if (!ang) throw new Error('Siswa bukan anggota aktif kelas ini.');
      var ctx = genCtx_(), res = { generated: 0, incomplete: 0, override: 0 };
      var r = computeCap_(ctx, idAnggota, a.mk.id_mapel, !!force);
      persistCap_(ctx, [{ p: { id_anggota: idAnggota, id_mapel: a.mk.id_mapel }, r: r }], res, !!force);
      if (!r.ok) return { ok: false, reason: r.reason, dinilai: r.dinilai, total: r.total, error: reasonText_(r) };
      return { ok: true, deskripsi: r.rec.deskripsi_rapor, locked: res.locked || 0 };
    });
  });
}

function reasonText_(r) {
  if (r.reason === 'INCOMPLETE') return 'Belum ada nilai formatif untuk TP mapel ini (' + r.dinilai + ' dari ' + r.total + ' TP).';
  if (r.reason === 'NO_DATA') return 'Belum ada TP aktif untuk mapel & tingkat ini.';
  if (r.reason === 'MANUAL_OVERRIDE_AKTIF') return 'Deskripsi sudah diedit manual. Gunakan "Kembalikan ke Otomatis".';
  return r.reason;
}

function generateKelas(idMK) {
  return wrap_(function () {
    return withLock_(function () {
      var a = mkAuth_(idMK), ctx = genCtx_(), res = { generated: 0, incomplete: 0, override: 0 };
      var list = anggotaAktif_(a.kelas.id_kelas);
      var results = list.map(function (x) { var p = { id_anggota: x.id_anggota, id_mapel: a.mk.id_mapel }; return { p: p, r: computeCap_(ctx, p.id_anggota, p.id_mapel, false) }; });
      persistCap_(ctx, results, res);
      return { ok: true, total: list.length, generated: res.generated, incomplete: res.incomplete, override: res.override, locked: res.locked || 0 };
    });
  });
}

function generateSemua() {
  return wrap_(function () {
    var s = session_(); if (!s.admin) throw new Error('Hanya admin yang dapat menjalankan generate semua.');
    return withLock_(function () {
      var ctx = genCtx_(), res = { generated: 0, incomplete: 0, override: 0 }, results = [];
      table_(S.MK).rows.filter(function (m) { return m.status === 'Aktif'; }).forEach(function (mk) {
        anggotaAktif_(mk.id_kelas).forEach(function (x) { results.push({ p: { id_anggota: x.id_anggota, id_mapel: mk.id_mapel }, r: computeCap_(ctx, x.id_anggota, mk.id_mapel, false) }); });
      });
      persistCap_(ctx, results, res);
      return { ok: true, total: results.length, generated: res.generated, incomplete: res.incomplete, override: res.override, locked: res.locked || 0 };
    });
  });
}

function getCapaian(idMK) {
  return wrap_(function () {
    var a = mkAuth_(idMK), ctx = genCtx_(), idm = a.mk.id_mapel, c = ctx.cfg;
    var items = anggotaAktif_(a.kelas.id_kelas).map(function (x) {
      var key = x.id_anggota + '|' + idm, ex = ctx.capIdx[key], r = computeCap_(ctx, x.id_anggota, idm, true), na = ctx.na[key];
      var o = { id_anggota: x.id_anggota, nama: x.nama, no_absen: x.no_absen, locked: !!(na && isTrue_(na.status_final)), dinilai: r.dinilai, total: r.total };
      if (ex) {
        o.status = isTrue_(ex.status_manual_edit) ? 'MANUAL' : 'OTOMATIS'; o.deskripsi = ex.deskripsi_rapor; o.catatan = ex.catatan_guru; o.generated_at = ex.generated_at;
        o.nilai_tertinggi = ex.nilai_tertinggi; o.nilai_terendah = ex.nilai_terendah; o.kode_tinggi = ex.daftar_kode_tp_tinggi; o.kode_rendah = ex.daftar_kode_tp_rendah;
      } else if (r.ok) { o.status = 'SIAP'; o.deskripsi = r.rec.deskripsi_rapor; o.nilai_tertinggi = r.rec.nilai_tertinggi; o.nilai_terendah = r.rec.nilai_terendah; }
      else { o.status = r.reason; o.deskripsi = ''; }
      return o;
    });
    return { ok: true, mk: { id_mapel_kelas: idMK, nama_kelas: a.kelas.nama_kelas, nama_mapel: a.mapel.nama_mapel }, items: items, batas_tuntas: c.batas_tuntas, max_char: c.max_char };
  });
}

function overrideCapaian(idMK, idAnggota, teks, alasan) {
  return wrap_(function () {
    return withLock_(function () {
      var a = mkAuth_(idMK), ctx = genCtx_(), c = ctx.cfg, idm = a.mk.id_mapel;
      teks = String(teks || '').trim(); alasan = String(alasan || '').trim();
      if (!anggotaAktif_(a.kelas.id_kelas).some(function (x) { return x.id_anggota === idAnggota; })) throw new Error('Siswa bukan anggota aktif kelas ini.');
      if (!teks) throw new Error('Teks deskripsi tidak boleh kosong.');
      if (teks.length > c.max_char) throw new Error('Deskripsi maksimal ' + c.max_char + ' karakter (sekarang ' + teks.length + ').');
      if (alasan.length < 10) throw new Error('Alasan perubahan wajib diisi (minimal 10 karakter).');
      var key = idAnggota + '|' + idm, na = ctx.na[key];
      if (na && isTrue_(na.status_final)) throw new Error('Rapor sudah difinalisasi; deskripsi tidak dapat diubah.');
      var chk = computeCap_(ctx, idAnggota, idm, true), warning = '';
      var kk = kktp_(ctx.mapelById[idm]);
      if (chk.ok && chk.rec.nilai_terendah < kk.c && !/perlu/i.test(teks)) warning = 'Ada TP di bawah KKTP (' + kk.c + '), namun teks tidak memuat kata "perlu". Pastikan kelemahan tetap disebut.';
      var ex = ctx.capIdx[key], old = ex ? ex.deskripsi_rapor : '';
      if (!ex) {
        ex = { id_capaian: newId_('CAP'), id_anggota: idAnggota, id_mapel: idm, versi_algoritma: VERSI_ALGO, batas_tuntas_saat_generate: c.batas_tuntas };
        ctx.cap.rows.push(ex);
      }
      ex.deskripsi_rapor = teks; ex.status_manual_edit = true; ex.catatan_guru = alasan; ex.generated_at = now_(); ex.generated_by = session_().email;
      writeAllCap_(ctx);
      log_(S.CAP, 'OVERRIDE', ex.id_capaian, old, teks, alasan);
      return { ok: true, warning: warning };
    });
  });
}

function writeAllCap_(ctx) {
  var t = ctx.cap, vals = t.rows.map(function (r) { return t.headers.map(function (h) { return out_(r[h]); }); });
  if (vals.length) t.sh.getRange(2, 1, vals.length, t.headers.length).setValues(vals);
  t.rows.forEach(function (r, i) { r._row = i + 2; });
}

function resetCapaian(idMK, idAnggota) {
  return wrap_(function () {
    return withLock_(function () {
      var a = mkAuth_(idMK), ctx = genCtx_(), idm = a.mk.id_mapel, key = idAnggota + '|' + idm, ex = ctx.capIdx[key];
      if (!ex) throw new Error('Belum ada deskripsi untuk siswa ini.');
      var na = ctx.na[key]; if (na && isTrue_(na.status_final)) throw new Error('Rapor sudah difinalisasi.');
      var res = { generated: 0, incomplete: 0, override: 0 };
      var r = computeCap_(ctx, idAnggota, idm, true);
      log_(S.CAP, 'OVERRIDE', ex.id_capaian, ex.deskripsi_rapor, '', 'reset ke otomatis');
      if (r.ok) { persistCap_(ctx, [{ p: { id_anggota: idAnggota, id_mapel: idm }, r: r }], res, true); return { ok: true, deskripsi: r.rec.deskripsi_rapor }; }
      ex.status_manual_edit = false; ex.catatan_guru = ''; writeAllCap_(ctx);
      return { ok: true, deskripsi: ex.deskripsi_rapor, info: reasonText_(r) };
    });
  });
}


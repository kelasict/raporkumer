/* ==========================================================================
   EXCEL — unduh templat & unggah .xlsx (SheetJS dimuat saat dibutuhkan)
   ========================================================================== */
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let _xl = null;
const loadXL = () => _xl || (_xl = window.XLSX ? Promise.resolve(window.XLSX) : new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = XLSX_URL;
  s.onload = () => res(window.XLSX);
  s.onerror = () => { _xl = null; rej(new Error('Pustaka Excel gagal dimuat. Periksa koneksi internet lalu coba lagi.')); };
  document.head.appendChild(s);
}));
const preXL = () => { loadXL().catch(() => { }); };
const fileSafe = s => String(s || '').replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '');
async function xlSave(file, sheets) {
  try {
    const X = await loadXL(), wb = X.utils.book_new();
    sheets.forEach(sh => { const ws = X.utils.aoa_to_sheet(sh.rows); if (sh.w) ws['!cols'] = sh.w.map(w => ({ wch: w })); X.utils.book_append_sheet(wb, ws, sh.name); });
    X.writeFile(wb, file); toast(`<b>${h(file)}</b> diunduh.`);
  } catch (e) { failToast(e); }
}
const xlCell = v => {
  if (v instanceof Date) { const d = new Date(v.getTime() + 12 * 36e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  return v == null ? '' : String(v).trim();
};
async function xlRead(file) {
  const X = await loadXL(), wb = X.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]]; if (!ws) throw new Error('File Excel kosong.');
  return X.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false }).map(r => r.map(xlCell)).filter(r => r.some(c => c !== ''));
}
function pickXlsx(cb) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = '.xlsx,.xls,.csv';
  i.onchange = async () => { const f = i.files[0]; if (!f) return; try { await cb(await xlRead(f), f); } catch (e) { failToast(e); } };
  i.click();
}
const xlBtns = (t, u) => `<button class="btn sm" data-xl="tpl">${ic('book', 14)} ${t || 'Unduh templat Excel'}</button><button class="btn sm" data-xl="up">${ic('plus', 14)} ${u || 'Impor Excel'}</button>`;
const nisnKey = v => { v = String(v || '').replace(/\D/g, ''); return /^\d{6,9}$/.test(v) ? v.padStart(10, '0') : v; };
const nameKey = v => String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
/** Cocokkan baris Excel dengan siswa (NISN dulu, lalu nama). */
function xlMatch(rows, siswa) {
  const hi = rows.findIndex(r => r.some(c => /^(nisn|nama)/i.test(c)));
  if (hi < 0) throw new Error('Baris judul tidak ditemukan. Gunakan templat Excel dari tombol "Templat".');
  const hdr = rows[hi].map(c => c.trim()), low = hdr.map(c => c.toLowerCase());
  const ci = low.findIndex(c => c === 'nisn'), cn = low.findIndex(c => /^nama/.test(c));
  const byN = {}, byNm = {}; siswa.forEach(s => { if (s.nisn) byN[nisnKey(s.nisn)] = s; byNm[nameKey(s.nama)] = s; });
  const recs = [], miss = [];
  rows.slice(hi + 1).forEach(r => {
    const s = (ci >= 0 && r[ci] && byN[nisnKey(r[ci])]) || (cn >= 0 && byNm[nameKey(r[cn])]);
    s ? recs.push({ s, row: r }) : miss.push((cn >= 0 && r[cn]) || (ci >= 0 && r[ci]) || '(tanpa nama)');
  });
  return { hdr, low, recs, miss };
}
const parseNil = raw => { const v = Number(String(raw).replace(',', '.')); return Number.isInteger(v) && v >= 0 && v <= 100 ? v : NaN; };
const curMK = () => (asgCache && asgCache.d.items.find(i => i.id_mapel_kelas === St.mk)) || { nama_kelas: '', nama_mapel: '' };
const impReport = (n, bad, miss, lock) => {
  let m = `<b>${n} nilai dibaca dari Excel.</b> Periksa lalu klik <b>Simpan</b>.`;
  if (lock) m += ` ${lock} siswa dilewati (rapor terkunci).`;
  toast(m, n ? 'ok' : 'warn', 7000);
  if (miss.length) toast(`${miss.length} baris tidak cocok dengan siswa:<br>${miss.slice(0, 6).map(h).join('<br>')}${miss.length > 6 ? '<br>…' : ''}`, 'warn', 9000);
  if (bad.length) toast(`${bad.length} sel diabaikan (harus bilangan bulat 0–100):<br>${bad.slice(0, 6).map(h).join('<br>')}${bad.length > 6 ? '<br>…' : ''}`, 'bad', 9000);
};

/* ----- Contoh isi templat data induk ----- */
const XL_EX = { nisn: '0012345678', nis: '1001', nama_siswa: 'Contoh Siswa', jenis_kelamin: 'L', tempat_lahir: 'Bandung', tanggal_lahir: '2012-05-17', agama: 'Islam', pendidikan_sebelumnya: 'SD Contoh', alamat: 'Jl. Contoh No. 1', nama_ayah: 'Nama Ayah', nama_ibu: 'Nama Ibu', pekerjaan_ayah: 'Wiraswasta', pekerjaan_ibu: 'Ibu rumah tangga', alamat_ortu: 'Jl. Contoh No. 1', nama_wali: '', nama_kelas: 'VII A', no_absen: '1', nama: 'Nama Guru', username: 'namaguru', password: 'minimal6huruf', nip: '', peran: 'Guru' };
function xlTemplateMaster(cols, judul, extra) {
  return xlSave('Templat-' + fileSafe(judul) + '.xlsx', [
    { name: 'Data', rows: [cols, cols.map(c => XL_EX[c] ?? '')], w: cols.map(c => Math.max(14, c.length + 4)) },
    { name: 'Petunjuk', w: [100], rows: [['PETUNJUK PENGISIAN — ' + judul], ['1. Isi data mulai baris ke-3 pada sheet "Data". Baris contoh (baris ke-2) HAPUS.'], ['2. Jangan ubah/hapus baris judul (baris ke-1). Maksimal 500 baris per impor.'], ['3. NISN diketik sebagai teks 10 digit (awalan 0 dipertahankan).'], ['4. Tanggal ditulis yyyy-mm-dd atau dd/mm/yyyy. Jenis kelamin diisi L atau P.'], ...(extra || []).map(x => [x]), ['5. Setelah itu: menu Impor → Unggah file Excel → Periksa data → Impor.']] }
  ]);
}
/** Pasang tombol templat/unggah pada dialog impor (textarea #imTx). */
function xlWireImport(cols, judul, extra) {
  $('[data-xl=tpl]').onclick = () => xlTemplateMaster(cols, judul, extra);
  $('[data-xl=up]').onclick = () => pickXlsx(rows => {
    $('#imTx').value = rows.map(r => r.join('\t')).join('\n'); $('#imTx').dispatchEvent(new Event('input'));
    toast(`<b>${Math.max(rows.length - 1, 0)} baris</b> dibaca dari Excel. Klik <b>Periksa data</b>.`);
  });
}

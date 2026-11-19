# Rapor Kurikulum Merdeka

Aplikasi rapor berbasis **Google Apps Script + Google Spreadsheet** (database), dengan alur dan rumus yang mengikuti
file Excel `RAPOR_FIKS_7B_SEMESTER_2.xlsx` (SMP IT Al-Kautsar, kelas VII Bilingual).
Tampilan depan juga bisa dibuka di **GitHub Pages** sebagai demo.

## Fitur utama
- **Login username & password milik aplikasi** (tanpa validasi akun Google). Password disimpan sebagai hash SHA-256 berulang + salt, sesi memakai token acak 6 jam, dan ada pembatasan 5× salah password per 10 menit.
- **Semua guru dapat mengakses semua kelas & mapel** — tidak ada penugasan guru. Daftar mapel-kelas dibentuk otomatis dari kelas aktif × mapel aktif.
- **Admin**: Akun Guru & Admin (tambah/ubah/nonaktifkan, reset password, impor banyak akun), Pengaturan, data induk, buka kunci finalisasi, dan **Editor Data** (ubah/tambah/hapus isi sheet mana pun dengan validasi, hitung ulang nilai otomatis, dan log).
- **Identitas Sekolah** (NPSN, NSS, alamat, kepala sekolah, tanggal rapor) → kop & tanda tangan rapor.
- **Data Murid** lengkap (NIS, NISN, L/P, tempat/tanggal lahir, agama, pendidikan sebelumnya, alamat, data orang tua/wali).
- **Mata Pelajaran** dengan **KKTP per mapel** (batas predikat C, B, A; di bawah C = D).
- **Input Nilai**: Formatif per TP · Sumatif S1–S10 · STS · SAS (non-tes & tes).
- **Nilai rapor** = rata-rata dari (40% sumatif + 60% SAS) dan STS; bila ada komponen kosong, dipakai yang tersedia (sama dengan LEGER di Excel).
- **Deskripsi capaian otomatis** dari nilai formatif: TP dikelompokkan A/B/C/D menurut KKTP mapel, lalu dirangkai dengan kalimat pembuka yang bisa diubah di Pengaturan.
- **Data Rapor Siswa**: ekstrakurikuler (3 kegiatan), sakit/izin/alpa, catatan wali kelas, keputusan naik/tinggal.
- **Leger Nilai** (jumlah, rata-rata, peringkat, % tuntas) dan **Cetak Rapor** satu halaman A4 per siswa (atau semua siswa satu kelas). Rapor belum final diberi tanda air DRAFT.
- Finalisasi/penguncian nilai per kelas, riwayat perubahan (log), Pengaturan, impor CSV data master.

## Isi repositori
| Berkas | Fungsi |
|---|---|
| `apps-script/*.gs` | Backend: `Config`, `Core`, `Setup`, `Auth`, `ApiNilai`, `Generator`, `ApiRapor`, `Admin`, `Cetak`, `DataRapor`, `SeedData` |
| `apps-script/Index.html` | Frontend (satu berkas) |
| `apps-script/appsscript.json` | Manifest (zona waktu, scope, Web App) |
| `data/seed_alkautsar.json` | Data contoh dari file Excel (28 siswa × 12 mapel) |
| `scripts/build_pages.py` | Membangun `docs/index.html` (frontend + backend asli yang berjalan di browser) |
| `docs/index.html` | Hasil build untuk GitHub Pages — **jangan diedit langsung** |

## Memasang di Google (± 10 menit)
1. Buat **Spreadsheet baru yang kosong**, lalu buka *Ekstensi → Apps Script* (atau buat proyek Apps Script mandiri).
2. Salin semua berkas `apps-script/*.gs` dan `Index.html` ke editor, lalu isi `appsscript.json` (aktifkan *Tampilkan berkas manifes* di Pengaturan Proyek). Hapus berkas `index.html` huruf kecil bila ada.
3. *Deploy → Aplikasi web (Deployment baru)*: jalankan sebagai **Saya**, akses **Siapa saja**. (Karena login memakai username/password aplikasi, akses harus "Siapa saja"; bila opsi ini tidak muncul, admin Google Workspace sekolah perlu mengizinkan berbagi di luar domain.)
4. Buka URL Web App → layar **Siapkan aplikasi**: tempel link Spreadsheet, buat **username & password admin**. Siapa pun yang pertama menyelesaikan layar ini menjadi admin — lakukan segera setelah deploy.
5. Masuk sebagai admin → **Persiapan & Log** (checklist), **Akun Guru & Admin** (buat akun guru, bisa impor dari Excel), **Identitas Sekolah**, **Data Kelas/Murid/Mapel**. Untuk mencoba cepat: *Persiapan & Log → Isi data contoh* (akun guru contoh `lantabura` / `guru123`).
6. **Lupa password admin?** Di editor Apps Script jalankan fungsi `pulihkanAdmin`; password sementara tampil di *Log eksekusi*.
7. Setelah mengganti file kode, **Deploy → Kelola deployment → Edit → Versi baru → Deploy**, dan jalankan `doGet` sekali dari editor untuk memberi izin.

Pembaruan dari versi lama: tempel semua file baru, deploy versi baru. Sheet `05_GURU` otomatis dimigrasi (kolom email → username; akun lama perlu diberi password oleh admin). Layar *Siapkan aplikasi* akan meminta pembuatan admin pertama. Sheet `06_MAPEL_KELAS` kini dikelola otomatis (kolom id_guru dibiarkan kosong).

## Demo di GitHub Pages
1. Jalankan `python3 scripts/build_pages.py` setiap kali ada perubahan di `apps-script/` (menghasilkan `docs/index.html`).
2. Push ke GitHub; workflow `.github/workflows/pages.yml` menayangkan folder `docs`. (Atau *Settings → Pages → Deploy from branch → /docs*.)
3. Di mode demo, kode backend yang sama dijalankan di browser dengan Spreadsheet tiruan; data tersimpan di localStorage. Akun demo: `admin / admin123`, `lantabura / guru123`, `guru / guru123`. Tombol *Reset data demo* mengembalikan data awal.

## Mencetak rapor
Menu **Cetak Rapor** → pilih kelas → *Lihat & cetak* (satu siswa) atau *Cetak semua* → **Cetak / Simpan PDF** (pilih "Simpan sebagai PDF"; skala 100%, hapus centang header/footer browser). Isi dulu Identitas Sekolah, Data Rapor Siswa, dan finalisasi nilai agar tanda air DRAFT hilang.

## Catatan
- Wali kelas hanya menentukan nama pada tanda tangan rapor; semua guru boleh finalisasi dan mencetak, sedangkan **buka kunci** hanya untuk admin.
- Rapor P5 (proyek) dan sampul/biodata rapor belum ada.
- Backend diuji lewat simulasi layanan Apps Script, dan seluruh nilai rapor data contoh dicocokkan dengan LEGER Excel; belum diuji langsung di Google.

## Memakai GitHub Pages dengan akun & data asli (tanpa mode demo)
1. Tempel `apps-script/*` terbaru (berisi `doPost`) ke Apps Script, lalu **Deploy → Versi baru** (akses: Siapa saja).
2. Salin URL Web App (berakhiran `/exec`), isikan ke `docs/config.js`: `window.RAPOR_API_URL = 'https://script.google.com/macros/s/.../exec';` lalu commit.
   Alternatif tanpa commit: di halaman login klik **Sambungkan ke Google Script**, atau buka `https://<user>.github.io/<repo>/?api=<URL>`.
3. Bila alamat terisi, bar kuning & akun demo hilang; login memakai akun dari Spreadsheet.

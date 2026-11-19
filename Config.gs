/**
 * ============================================================================
 *  RAPOR KURIKULUM MERDEKA — Backend Google Apps Script (PRD v3.0)
 * ============================================================================
 *  PETA FILE (semua file berbagi satu lingkup global Apps Script):
 *
 *   Config.gs     Konstanta: nama sheet, header kolom, nilai bawaan _CONFIG
 *   Core.gs       Alat dasar: akses sheet, kunci, log, konfigurasi, sesi & hak akses
 *   Auth.gs       Login username/password, sesi token, rpc, kelola akun, editor data (admin)
 *   Setup.gs      doGet, menu Spreadsheet, penyiapan sheet, backup, data contoh
 *   ApiNilai.gs   API guru: dashboard, nilai TP, nilai akhir
 *   Generator.gs  Deskripsi capaian otomatis (Bagian 7 PRD) + edit manual
 *   ApiRapor.gs   API: kelola TP, rekap, finalisasi, ringkasan admin
 *   Admin.gs      API admin: setup awal, pengaturan sekolah, data master, checklist
 *   Cetak.gs      Identitas sekolah, beranda, leger nilai, data cetak rapor per siswa
 *
 *  Pemasangan cukup mengikuti layar "Setup awal" di Web App (lihat README).
 *  Tidak ada ID Spreadsheet yang perlu ditulis di kode.
 * ============================================================================
 */

var S = {
  CONFIG: '_CONFIG', REF: '00_REF', SISWA: '01_SISWA', KELAS: '02_KELAS',
  ANGGOTA: '03_ANGGOTA_KELAS', MAPEL: '04_MAPEL', GURU: '05_GURU',
  MK: '06_MAPEL_KELAS', TP: '07_TUJUAN_PEMBELAJARAN', NTP: '08_NILAI_SUMATIF_TP',
  NA: '09_NILAI_AKHIR_SEMESTER', CAP: '10_CAPAIAN_KOMPETENSI',
  PROJEK: '11_PROJEK_P5', NP5: '12_NILAI_P5', RP5: '13_RAPOR_P5',
  REKAP: '14_REKAP_RAPOR', LOG: '15_LOG', DR: '16_DATA_RAPOR'
};

var VERSI_ALGO = 'v4.0';

var HEADERS = {};
HEADERS[S.CONFIG]  = ['key', 'value', 'keterangan'];
HEADERS[S.REF]     = ['jenis_ref', 'kode', 'label', 'urutan', 'nilai_min', 'nilai_max', 'aktif'];
HEADERS[S.SISWA]   = ['id_siswa', 'nisn', 'nis', 'nama_siswa', 'jenis_kelamin', 'tempat_lahir', 'tanggal_lahir', 'agama', 'pendidikan_sebelumnya', 'alamat', 'nama_ayah', 'nama_ibu', 'pekerjaan_ayah', 'pekerjaan_ibu', 'alamat_ortu', 'nama_wali', 'status', 'created_at', 'updated_at'];
HEADERS[S.KELAS]   = ['id_kelas', 'nama_kelas', 'tingkat', 'fase', 'tahun_ajaran', 'semester', 'id_wali_kelas', 'status'];
HEADERS[S.ANGGOTA] = ['id_anggota', 'id_kelas', 'id_siswa', 'no_absen', 'tanggal_masuk', 'status_keanggotaan'];
HEADERS[S.MAPEL]   = ['id_mapel', 'nama_mapel', 'kode_mapel', 'kelompok', 'kktp_c', 'kktp_b', 'kktp_a', 'aktif'];
HEADERS[S.GURU]    = ['id_guru', 'nip', 'nama_guru', 'username', 'peran', 'password_hash', 'salt', 'status'];
HEADERS[S.MK]      = ['id_mapel_kelas', 'id_kelas', 'id_mapel', 'id_guru', 'jam_per_minggu', 'status'];
HEADERS[S.TP]      = ['id_tp', 'id_mapel', 'fase', 'kode_tp', 'deskripsi_tp', 'urutan', 'aktif', 'tingkat'];
HEADERS[S.NTP]     = ['id_nilai_tp', 'id_anggota', 'id_mapel', 'id_tp', 'nilai', 'nilai_remedial', 'nilai_final', 'jenis_sumatif', 'tanggal_input', 'id_guru', 'catatan'];
HEADERS[S.NA]      = ['id_nilai_akhir', 'id_anggota', 'id_mapel', 'sum_1', 'sum_2', 'sum_3', 'sum_4', 'sum_5', 'sum_6', 'sum_7', 'sum_8', 'sum_9', 'sum_10', 'nilai_sts', 'nilai_non_tes', 'nilai_tes', 'na_sumatif', 'na_sas', 'nilai_rapor', 'predikat', 'status_final', 'tanggal_finalisasi'];
HEADERS[S.CAP]     = ['id_capaian', 'id_anggota', 'id_mapel', 'id_tp_tertinggi', 'nilai_tertinggi', 'daftar_kode_tp_tinggi', 'id_tp_terendah', 'nilai_terendah', 'daftar_kode_tp_rendah', 'deskripsi_tinggi', 'deskripsi_rendah', 'deskripsi_rapor', 'batas_tuntas_saat_generate', 'versi_algoritma', 'generated_at', 'generated_by', 'status_manual_edit', 'catatan_guru'];
HEADERS[S.PROJEK] = ['id_projek', 'nama_projek', 'tema', 'fase', 'tahun_ajaran', 'semester', 'id_guru_koordinator', 'deskripsi_projek', 'status'];
HEADERS[S.NP5]    = ['id_nilai_p5', 'id_projek', 'id_anggota', 'dimensi', 'subelemen', 'capaian', 'catatan_proses'];
HEADERS[S.RP5]    = ['id_anggota', 'id_projek', 'deskripsi_p5'];
HEADERS[S.REKAP]  = ['nisn', 'nama_siswa', 'kelas', 'mapel', 'rata_rata_tp', 'nilai_rapor', 'predikat', 'deskripsi_rapor'];
HEADERS[S.DR]     = ['id_anggota', 'ekskul_1', 'predikat_1', 'ket_1', 'ekskul_2', 'predikat_2', 'ket_2', 'ekskul_3', 'predikat_3', 'ket_3', 'tinggi_badan', 'berat_badan', 'kondisi_kesehatan', 'prestasi', 'sakit', 'izin', 'alpa', 'catatan_wali', 'keputusan'];
HEADERS[S.LOG]    = ['timestamp', 'user_email', 'sheet', 'aksi', 'id_referensi', 'nilai_lama', 'nilai_baru', 'keterangan'];

var SHEET_ORDER = [S.CONFIG, S.REF, S.SISWA, S.KELAS, S.ANGGOTA, S.MAPEL, S.GURU, S.MK, S.TP, S.NTP, S.NA, S.CAP, S.PROJEK, S.NP5, S.RP5, S.DR, S.REKAP, S.LOG];

var DEFAULT_CONFIG = [
  ['tahun_ajaran_aktif', '2026/2027', ''],
  ['semester_aktif', '1', ''],
  ['bobot_sumatif', 40, 'Persen: bobot nilai sumatif lingkup materi'],
  ['bobot_sas', 60, 'Persen: bobot sumatif akhir semester (SAS)'],
  ['batas_tuntas', 75, 'KKTP bawaan: batas predikat Cukup (C). Bisa diubah per mapel'],
  ['kktp_b', 83, 'KKTP bawaan: batas predikat Baik (B)'],
  ['kktp_a', 92, 'KKTP bawaan: batas predikat Sangat Baik (A)'],
  ['max_char_deskripsi', 1500, 'Batas panjang deskripsi capaian'],
  ['label_a', 'Sangat menguasai dalam', 'Kalimat pembuka capaian predikat A'],
  ['label_b', 'Menunjukkan penguasaan yang baik dalam', 'Kalimat pembuka capaian predikat B'],
  ['label_c', 'Menunjukkan pemahaman yang cukup dalam', 'Kalimat pembuka capaian predikat C'],
  ['label_d', 'Perlu bantuan dalam', 'Kalimat pembuka capaian predikat D'],
  ['template_separator_tp', '; ', 'Pemisah antar TP'],
  ['versi_skema', '4.0', ''],
  ['sekolah_nama', '', 'Identitas sekolah (diisi lewat menu Identitas Sekolah)'],
  ['sekolah_npsn', '', ''], ['sekolah_nss', '', ''], ['sekolah_alamat', '', ''], ['sekolah_kode_pos', '', ''], ['sekolah_desa', '', ''], ['sekolah_kecamatan', '', ''],
  ['sekolah_kabupaten', '', ''], ['sekolah_provinsi', '', ''], ['sekolah_website', '', ''], ['sekolah_email', '', ''], ['sekolah_kepala', '', ''], ['sekolah_nip_kepala', '', ''],
  ['sekolah_kota_ttd', '', ''], ['sekolah_tanggal_rapor', '', 'yyyy-mm-dd']
];

var DEFAULT_REF = [
  ['FASE', 'A', 'Fase A', 1], ['FASE', 'B', 'Fase B', 2], ['FASE', 'C', 'Fase C', 3],
  ['FASE', 'D', 'Fase D', 4], ['FASE', 'E', 'Fase E', 5], ['FASE', 'F', 'Fase F', 6],
  ['JK', 'L', 'Laki-laki', 1], ['JK', 'P', 'Perempuan', 2],
  ['SEMESTER', '1', 'Ganjil', 1], ['SEMESTER', '2', 'Genap', 2],
  ['PREDIKAT', 'A', 'Sangat Baik', 1, 92, 100], ['PREDIKAT', 'B', 'Baik', 2, 83, 91],
  ['PREDIKAT', 'C', 'Cukup', 3, 75, 82], ['PREDIKAT', 'D', 'Perlu Bantuan', 4, 0, 74],
  ['DIMENSI_P5', 'D1', 'Beriman & Berakhlak Mulia', 1], ['DIMENSI_P5', 'D2', 'Berkebinekaan Global', 2],
  ['DIMENSI_P5', 'D3', 'Bergotong Royong', 3], ['DIMENSI_P5', 'D4', 'Mandiri', 4],
  ['DIMENSI_P5', 'D5', 'Bernalar Kritis', 5], ['DIMENSI_P5', 'D6', 'Kreatif', 6],
  ['CAPAIAN_P5', 'BB', 'Belum Berkembang', 1], ['CAPAIAN_P5', 'MB', 'Mulai Berkembang', 2],
  ['CAPAIAN_P5', 'BSH', 'Berkembang Sesuai Harapan', 3], ['CAPAIAN_P5', 'SB', 'Sangat Berkembang', 4],
  ['STATUS_SISWA', 'Aktif', 'Aktif', 1], ['STATUS_SISWA', 'Lulus', 'Lulus', 2],
  ['STATUS_SISWA', 'Pindah', 'Pindah', 3], ['STATUS_SISWA', 'Keluar', 'Keluar', 4]
];


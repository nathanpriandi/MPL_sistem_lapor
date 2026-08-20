# Manual Operasional Administrator (Admin Runbook)

Dokumen ini panduan operasional bagi **Admin Operasional** dalam mengelola sistem pelaporan digital harian perusahaan agribisnis terintegrasi.

---

## 🔑 Akses & Hak Akses Central Spreadsheet

Sistem pelaporan ini terpusat pada satu Google Spreadsheet utama: **`Sistem Pelaporan Digital Operasional`**.

Spreadsheet ini memiliki tab utama:
1. **`Laporan_Operasional_Raw`**: Data mentah laporan operasional harian, kegiatan, panen, dan penjualan (Auto-populated).
2. **`Admin_Queue`**: **Tampilan Kerja Utama Admin**. Menyaring seluruh laporan dari `Laporan_Operasional_Raw` yang belum selesai (`Review_Status != "Closed"`), diurutkan berdasarkan tingkat keparahan (Urgent paling atas).
3. **`Sensitive_Restricted`**: Laporan yang ditandai sensitif oleh pelapor. **Akses terbatas khusus Admin & Manager**.
4. **`Archive_Reports`**: Arsip laporan selesai yang telah melewati batas retensi otomatis.

---

## 🌐 Troubleshooting URL & Multi-Account Browser

> [!IMPORTANT]
> **Catatan Penanganan Akses Multi-Akun Google:**
> *Jika muncul 'Sorry, unable to open the file', jangan ketik ulang URL — gunakan kembali QR code atau shortcut yang sudah tersedia.*

- **Penyebab Utama:** Google Workspace sering membingungkan nomor slot akun (`/u/0/`, `/u/1/`) ketika satu browser membuka beberapa akun Google sekaligus.
- **Solusi Standar Operasional:**
  1. **Profil Browser Terpisah (Desktop Admin & Manager):** Buat profil Google Chrome / Edge khusus untuk akun kerja perusahaan agribisnis. Ini menghilangkan kerancuan pindah akun Google.
  2. **Shortcut Layar Utama (Perangkat Lapangan / Ponsel):** Pasang shortcut Web App di layar utama ponsel staf lapangan saat inisialisasi awal.
  3. **QR Code Resmi:** Cetak QR Code yang mengarah ke URL kanonis Web App hasil deployment resmi (diambil dari *Deploy → Manage deployments*).

---

## 🛠️ Alur Kerja Harian Admin (Daily Workflow)

### 1. Login & Identitas Pengguna (Internal Console)
- Akses halaman admin via **Web App Internal Console (`admin.html`)** yang telah dilindungi sistem otorisasi **RBAC (Role-Based Access Control)** ketat (Option A):
  - Peran **`admin`**: Hanya dapat mengakses Antrean Triage Admin (`admin.html`).
  - Peran **`manager`**: Hanya dapat mengakses Manager Dashboard (`dashboard.html`).
  - Peran **`both`**: Dapat mengakses kedua halaman konsol internal.
  - Akun Google lain yang tidak terdaftar di Script Properties akan langsung ditolak (menampilkan kartu *Access Restricted*).
- Header aplikasi menampilkan **Identity Strip** yang mengonfirmasi alamat email Google Anda dan peran resmi (`Admin Operasional`).
- Manfaatkan **Panel Tautan Cepat (Quick Links)** untuk membuka Google Spreadsheet terpusat atau mengedit Google Forms secara langsung tanpa mencari di Google Drive.

### 2. Meninjau Antrean & Pencarian Detail (`Admin_Queue`)
- Antrean laporan disortir otomatis berdasarkan tingkat keparahan triage: **Urgent** (peringkat 1), **Warning** (peringkat 2), dan **Normal** (peringkat 3).
- Gunakan tombol **Filter Lanjutan ▾** untuk membuka bar pencarian:
  - **Pencarian Kata Kunci / ID**: Ketik Kode Karyawan (`EMP-101`), Kata Kronologi, atau Report ID di kotak pencarian.
  - **Filter Lokasi / Site**: Saring laporan spesifik Site A (Kebun), Site B (Peternakan), Site C (Pabrik), atau Site D (Logistik).
  - **Filter Rentang Tanggal**: Tentukan tanggal mulai dan selesai laporan.
  - **Filter Cepat**: Tombol *Semua Pending*, *Urgent*, dan *Sensitif*.
  - **Navigasi Halaman (Pagination)**: Tabel menampilkan 25 laporan per halaman dengan kontrol Prev/Next yang responsif.

### 3. Panel Detail Interaktif (Detail Modal)
- Klik tombol **Lihat** pada baris laporan untuk membuka **Detail Modal**.
- Modal menampilkan rincian lengkap: Report ID, Sumber Sheet, Kode Karyawan, Lokasi Site, Timestamp Submit, Badges Triage, serta Kronologi/Rincian lengkap.
- Anda dapat memperbarui status review langsung dari dalam modal dengan memilih opsi dropdown dan menekan **Simpan Status**. Notifikasi Toast konfirmasi akan muncul mengonfirmasi keberhasilan pembaruan.

### 4. Mengubah Status Review (`Review_Status`)
- Pembaruan status dapat dilakukan melalui **Detail Modal** atau dropdown **Review Status** pada tabel `Admin_Queue`.
- Pilihan status review:
  - `Unreviewed` (Belum diperiksa)
  - `In Review` (Sedang diproses / diverifikasi)
  - `Action Needed` (Memerlukan tindakan manajerial)
  - `Closed` (Selesai ditangani)

> **Catatan**: Begitu status diubah menjadi `Closed`, baris tersebut akan secara otomatis hilang dari antrean aktif `Admin_Queue` (kecuali dicari secara khusus melalui bar pencarian).

### 5. Ekspor Data ke CSV (Export CSV)
- Untuk kebutuhan laporan cetak, audit, atau analisis lanjutan Excel, klik tombol **Export CSV** di pojok kanan atas antrean.
- Sistem akan secara otomatis mengunduh file `.csv` yang berisi seluruh data antrean sesuai filter yang sedang aktif saat itu.

### 6. Pembaruan Otomatis (Soft Auto-Refresh)
- Antrean Admin Queue secara otomatis memperbarui data secara berkala (setiap 60 detik) tanpa mengganggu pekerjaan Anda jika Detail Modal sedang dibuka.
- Anda juga dapat menekan tombol **Refresh** kapan saja untuk pembaruan instan.

### 7. Penanganan Laporan Sensitif (`Sensitive_Restricted` Tab)
- Laporan yang ditandai sensitif secara otomatis diisolasi ke tab **`Sensitive_Restricted`** dan **tidak akan pernah muncul di `Admin_Queue`** demi menjaga kerahasiaan data.
- Admin yang berwenang wajib meninjau tab sensitif melalui tombol filter *Sensitif* atau membuka tab spreadsheet `Sensitive_Restricted` secara berkala.

### 8. Manajemen Form & Custom Form Builder (`forms.html`)
- **Kartu Metrik Summary**: Menampilkan metrik terpusat (*Total Form Terdaftar*, *Form Status Aktif*, *Form Harian & Umum*, *Form Kustom Lapangan*) dalam grid 4-kolom responsif.
- **Tautan Spreadsheet Dedicated (`Buka Sheet Data`)**: Setiap kartu formulir memiliki tombol dedicated *Buka Sheet Data* yang mengarahkan langsung ke Google Spreadsheet / tab data khusus dari form tersebut.
- **Pembuatan Form Kustom Lapangan**:
  - Klik **Buat Form Baru** untuk membuka modal multi-seksi (*Detail & Identitas Form* dan *Susun Pertanyaan Form*).
  - Pilihan Tipe Pertanyaan Kustom: *Teks Singkat*, *Paragraf / Textarea*, *Pilihan Dropdown*, *Pilihan Checkbox (Multi-select)*, *Tanggal*, dan *Foto Lampiran Lapangan*.
  - Penyusunan bidang dilengkapi fitur tambah row beranimasi, scrollbar mandiri, serta pratinjau foto interaktif pada `dynamicform.html`.
- **Pratinjau & Akses Publik**:
  - Tombol **Pratinjau** pada setiap kartu form membuka tampilan publik form yang siap digunakan staf lapangan.
  - Opsi **Google Form Editor** dan tombol utilitas hapus terisolasi dengan hierarki visual yang rapi.

---

## 🚨 Penanganan Notifikasi Urgent & Laporan Sensitif

1. **Email Notifikasi Urgent**:
   Jika ada laporan mengandung kata kunci kritis (misal: *kecelakaan, kebakaran, hama meledak*), sistem otomatis mengirimkan email alert seketika ke `ADMIN_EMAIL`.
2. **Laporan Sensitif**:
   Jika pelapor mencentang *Informasi Sensitif?*, laporan tersebut dipindahkan secara otomatis ke tab `Sensitive_Restricted` dan dihapus dari aliran publik `General_Raw`.

---

## 📦 Kebijakan Retensi & Pengarsipan Data (Data Archival Policy)

- **Retensi Otomatis 90 Hari (`RETENTION_DAYS`):**
  Untuk mencegah penumpukan data pada sheet aktif dan mematuhi prinsip minimisasi data UU PDP, sistem menjalankan proses pengarsipan otomatis `archiveOldReports()` pada tanggal 1 setiap bulan (pukul 01:00 WIB).
- **Kriteria Pengarsipan:**
  Laporan dengan `Review_Status = 'Closed'` yang memiliki tanggal laporan lebih lama dari batas hari retensi akan dipindahkan secara otomatis dari tab data aktif ke tab `Archive_Reports`.
- **Integritas Metrik Manajerial:**
  Statistik dan metrik manajerial pada Manager Dashboard dihitung secara dinamis dari data operasional berjalan, sehingga analitik tetap akurat dan mutakhir.

---

## ⚙️ Penyesuaian Kata Kunci (Keyword Adjustment)

Admin dapat menyesuaikan istilah lokal (istilah pertanian / pabrik setempat) dalam file `src/Automation.gs`:
- `URGENT_KEYWORDS`: Kata kunci tingkat bahaya tinggi / darurat.
- `WARNING_KEYWORDS`: Kata kunci keterlambatan / masalah ringan.



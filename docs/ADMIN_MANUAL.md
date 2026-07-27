# Manual Operasional Administrator (Admin Runbook)

Dokumen ini panduan operasional bagi **Admin Operasional** dalam mengelola sistem pelaporan digital harian perusahaan agribisnis terintegrasi.

---

## 🔑 Akses & Hak Akses Central Spreadsheet

Sistem pelaporan ini terpusat pada satu Google Spreadsheet utama: **`Sistem Pelaporan Digital Operasional`**.

Spreadsheet ini memiliki 5 Tab utama:
1. **`Daily_Raw`**: Data mentah laporan harian operasional (Auto-populated).
2. **`General_Raw`**: Data mentah laporan umum / catatan lapangan (Auto-populated).
3. **`Admin_Queue`**: **Tampilan Kerja Utama Admin**. Menyaring seluruh laporan dari `Daily_Raw` dan `General_Raw` yang belum selesai (`Review_Status != "Closed"`), diurutkan berdasarkan tingkat keparahan (Urgent paling atas).
4. **`Sensitive_Restricted`**: Laporan yang ditandai sensitif oleh pelapor. **Akses terbatas khusus Admin & Manager**.
5. **`Weekly_Summary`**: Rekapitulasi mingguan untuk dibaca oleh Looker Studio Manager Dashboard.

---

## 🛠️ Alur Kerja Harian Admin (Daily Workflow)

### 1. Login & Identitas Pengguna (Internal Console)
- Akses halaman admin via **Web App Internal Console (`admin.html`)** yang telah dilindungi sistem otorisasi **RBAC (Role-Based Access Control)**.
- Header aplikasi menampilkan **Identity Strip** yang mengonfirmasi alamat email Google Anda dan peran resmi (misal: `Admin Operasional`).
- Jika akun Anda terdaftar hanya sebagai Manager, sistem akan menampilkan pemberitahuan akses terbatas khusus peran Admin.

### 2. Meninjau Antrean & Pencarian Detail (`Admin_Queue`)
- Antrean laporan disortir otomatis berdasarkan tingkat keparahan triage: **Urgent** (peringkat 1), **Warning** (peringkat 2), dan **Normal** (peringkat 3).
- Gunakan **Bar Filter Lanjutan**:
  - **Pencarian Kata Kunci / ID**: Ketik Kode Karyawan (`EMP-101`), Kata Kronologi, atau Report ID di kotak pencarian.
  - **Filter Lokasi / Site**: Saring laporan spesifik Site A (Kebun), Site B (Peternakan), Site C (Pabrik), atau Site D (Logistik).
  - **Filter Rentang Tanggal**: Tentukan tanggal mulai dan selesai laporan.
  - **Filter Cepat**: Tombol *Semua Pending*, *Urgent*, dan *Sensitif*.
  - **Navigasi Halaman (Pagination)**: Tabel menampilkan 25 laporan per halaman dengan kontrol Prev/Next yang responsif.

### 3. Panel Detail Interaktif (Detail Modal)
- Klik tombol **Lihat** pada baris laporan untuk membuka **Detail Modal**.
- Modal menampilkan rincian lengkap: Report ID, Sumber Sheet, Kode Karyawan, Lokasi Site, Timestamp Submit, Badges Triage, serta Kronologi/Rincian lengkap.
- Anda dapat memperbarui status review langsung dari dalam modal dengan memilih opsi dropdown dan menekan **Simpan Status**. Notifikasi Toast akan muncul mengonfirmasi keberhasilan update.

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

---

## 🚨 Penanganan Notifikasi Urgent & Laporan Sensitif

1. **Email Notifikasi Urgent**:
   Jika ada laporan mengandung kata kunci kritis (misal: *kecelakaan, kebakaran, hama meledak*), sistem otomatis mengirimkan email alert seketika ke `ADMIN_EMAIL`.
2. **Laporan Sensitif**:
   Jika pelapor mencentang *Informasi Sensitif?*, laporan tersebut dipindahkan secara otomatis ke tab `Sensitive_Restricted` dan dihapus dari aliran publik `General_Raw`.

---

## ⚙️ Penyesuaian Kata Kunci (Keyword Adjustment)

Admin dapat menyesuaikan istilah lokal (istilah pertanian / pabrik setempat) dalam file `src/Automation.gs`:
- `URGENT_KEYWORDS`: Kata kunci tingkat bahaya tinggi / darurat.
- `WARNING_KEYWORDS`: Kata kunci keterlambatan / masalah ringan.


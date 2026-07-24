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

### 1. Meninjau Antrean (`Admin_Queue`)
- Buka antrean via **Web App Admin Interface (`admin.html`)** atau tab `Admin_Queue` pada Spreadsheet.
- Setiap laporan memiliki **`Report_ID`** unik (UUID di Kolom 1) untuk pencarian dan pembaruan status yang presisi.
- Periksa laporan berdasarkan tingkat keparahan:
  - **Urgent**: Harus segera ditindaklanjuti atau dikonfirmasi ke lapangan.
  - **Warning**: Memerlukan perhatian atau koordinasi logistik/perbaikan.
  - **Normal**: Laporan operasional rutin.

### 2. Mengubah Status Review (`Review_Status`)
- Pembaruan status dapat dilakukan langsung melalui antarmuka **Web App Admin (`admin.html`)** atau secara manual pada kolom **`Review_Status`** di tab mentah (`Daily_Raw` / `General_Raw`).
- Pilihan status review:
  - `Unreviewed` (Belum diperiksa)
  - `In Review` (Sedang diproses / diverifikasi)
  - `Action Needed` (Memerlukan tindakan manajerial)
  - `Closed` (Selesai ditangani)

> **Catatan**: Begitu status diubah menjadi `Closed`, baris tersebut akan secara otomatis hilang dari tampilan `Admin_Queue`.

### 3. Penanganan Laporan Sensitif (`Sensitive_Restricted` Tab)
- Laporan yang ditandai sensitif secara otomatis diisolasi ke tab **`Sensitive_Restricted`** dan **tidak akan pernah muncul di `Admin_Queue`** demi menjaga kerahasiaan data.
- Admin dan Manager yang berwenang wajib membuka tab `Sensitive_Restricted` secara berkala untuk meninjau laporan sensitif (dapat dicari berdasarkan `Report_ID`) dan memperbarui kolom `Review_Status` (misal: `In Review`, `Action Needed`, atau `Closed (Sensitive)`).

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

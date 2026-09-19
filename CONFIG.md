# Operational Configuration, Environment & Security Guide

This document lists all system environment settings, script properties, security controls, and operational parameters for the **Digital Reporting System (Sistem Lapor MPL)**.

---

## 1. Google Script Properties (Required Setup)

After running `setupReportingSystem()`, you must set the following properties in Apps Script (**Project Settings -> Script Properties** or via `Setup.gs` initialization):

| Property Name | Example / Expected Value | Description |
|---|---|---|
| `PORTFOLIO_MODE` | `true` | Optional flag. Set to `true` (default) for portfolio showcase demonstration mode; set to `false` for strict enterprise corporate production. |
| `ADMIN_EMAIL` | `yourname@gmail.com` | Primary Admin Google email. Receives urgent incident alerts and daily 17:00 WIB digests. |
| `MANAGER_EMAIL` | `yourname@gmail.com` | Primary Manager Google email. Receives weekly Monday 08:00 WIB executive summary digests. |
| `SPREADSHEET_ID` | `1A2b3C4d5E...` | Generated automatically by `Setup.gs` or linked to your central operational Google Sheet. |
| `MAIN_FORM_ID` | `1F2g3H4i5J...` | Generated automatically by `Setup.gs` for the unified Operational Google Form. |
| `PUBLIC_WEB_APP_URL` | `https://script.google.com/macros/s/.../exec` | Deployment URL for public field-staff portal (`?page=index`). Also supports alias `PUBLIC_URL`. |
| `INTERNAL_WEB_APP_URL` | `https://script.google.com/macros/s/.../exec` | Deployment URL for Admin Queue and Manager Dashboard console. Also supports alias `INTERNAL_URL`. |
| `PUBLIC_DEPLOYMENT_ID` | `AKfycb...` | Explicit Deployment ID for the public portal to enforce isolation from internal console routes. |

---

## 1.1 Google Script Properties (Optional Operational & Storage Tuning)

| Property Name | Example / Expected Value | Description |
|---|---|---|
| `RETENTION_DAYS` | `90` | Retention threshold in days for daily spreadsheet tabs (`Laporan_YYYY-MM-DD`) and Google Drive photo folders (`MPL_Dokumentasi_Foto/YYYY-MM-DD`). Default: 90 days. |
| `DRIVE_PHOTO_FOLDER_ID` | `1A2b3C4d5E...` | Optional root Google Drive folder ID for field photo uploads. If unset, automatically creates `MPL_Dokumentasi_Foto`. |

---

## 2. Enterprise Cybersecurity Controls

The application enforces end-to-end multi-layer defense managed by `SecurityService.gs`:

### 2.1 Rate Limiting Architecture
Implemented using `CacheService.getScriptCache()` token buckets:
- **Authentication & Identity Routes**: Max **5 attempts per 15 minutes (900 seconds)** per caller identity. Protects against brute-force and role spoofing.
- **Report & Form Submissions**: Max **30 submissions per minute (60 seconds)**. Protects against spam flood and denial-of-service.
- **Read & Analytics Queries**: Max **120 queries per minute (60 seconds)**.
- **General Administrative Actions**: Max **60 operations per minute (60 seconds)**.

### 2.2 Input Sanitization & Formula Injection Neutralization (CWE-1236)
- Any cell value written to Google Sheets starting with dangerous formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`, `|`) is automatically neutralized (prefixed with `'`) to prevent malicious formula execution or data exfiltration.
- HTML output is sanitized to prevent Stored / Reflected Cross-Site Scripting (XSS / CWE-79).

### 2.3 Payload Size & MIME Type Whitelisting
- Maximum total JSON request payload: **15 MB**.
- Maximum single photo attachment: **5 MB**.
- Allowed image MIME types: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/heic`, `image/heif`.
- Malformed payloads and non-whitelisted binary uploads are immediately rejected with HTTP status errors.

### 2.4 Strict RBAC Function-Level Access Control (BFLA/IDOR Mitigation)
Every client-callable RPC method in `ClientAPI.gs` asserts user roles via `SecurityService.AccessGuard`:
- `requireSuperadmin()`: Strictly limits account provisioning, trigger registration, and database purges to Superadmin.
- `requireAdminOrSuperadmin()`: Protects operational queues, form configurations, and employee rosters.
- `requireManagerOrSuperadmin()`: Protects executive dashboards and decision metrics.
- `requireAuthorizedStaff()`: Blocks unauthenticated callers from reading internal company datasets.

---

## 3. Indonesian Keyword Rules for Automated Flagging

The triage engine in `src/Automation.gs` categorizes incoming field reports into three severity levels:

### Urgent Keywords (`urgent` severity -> triggers immediate email alert to Admin):
- **Safety & Disasters**: `kecelakaan`, `kebakaran`, `banjir`, `darurat`, `cedera`, `korban`
- **Equipment & Infrastructure Breakdown**: `rusak berat`, `bocor`, `meledak`, `mati total`, `patah`, `tumbang`
- **Agri & Farming Outbreaks**: `hama`, `wabah`, `penyakit`, `mati masal`, `terkontaminasi`, `keracunan`, `pestisida`

### Warning Keywords (`warning` severity -> highlighted in Admin Queue):
- **Delays & Shortages**: `kurang`, `terlambat`, `lambat`, `habis`, `tertunda`, `stok tipis`
- **Minor Malfunctions**: `mogok`, `rusak ringan`, `bising`, `bocor halus`, `baterai lemah`
- **Weather Disruptions**: `hujan deras`, `angin kencang`, `becek`, `akses tertutup`

### Normal Keywords (`normal` severity):
- All routine reports passing standard operations.

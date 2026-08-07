# Operational Configuration & Placeholders Guide

This document lists all system environment settings, script properties, and operational parameters for the **Digital Reporting System**.

---

## 1. Google Script Properties (Required Setup)

After running `setupReportingSystem()`, you must set the following properties in Apps Script (**Project Settings -> Script Properties** or via `Setup.gs` update):

| Property Name | Example / Expected Value | Description |
|---|---|---|
| `ADMIN_EMAIL` | `admin.operasional@perusahaan-agri.co.id` | Receives urgent incident alerts and daily 17:00 WIB digests |
| `MANAGER_EMAIL` | `general.manager@perusahaan-agri.co.id` | Receives weekly Monday 08:00 WIB executive summary digests |
| `SPREADSHEET_ID` | `1A2b3C4d5E...` | Generated automatically by `Setup.gs` |
| `MAIN_FORM_ID` | `1F2g3H4i5J...` | Generated automatically by `Setup.gs` for the unified Operational Form |
| `PUBLIC_WEB_APP_URL` | `https://script.google.com/macros/s/.../exec` | Deployment A URL for the public field-staff portal. Set manually after Deployment A is created. |
| `INTERNAL_WEB_APP_URL` | `https://script.google.com/macros/s/.../exec` | Deployment B URL for Admin Queue and Manager Dashboard. Set manually after Deployment B is created. |

`WEB_APP_URL`, `DAILY_FORM_ID`, and `GENERAL_FORM_ID` are retired. Use `MAIN_FORM_ID` alongside explicit `PUBLIC_WEB_APP_URL` and `INTERNAL_WEB_APP_URL` properties instead.

## 1.1 Google Script Properties (Optional Operational Tuning)

| Property Name | Example / Expected Value | Description |
|---|---|---|
| `RETENTION_DAYS` | `90` | Optional archive threshold for `archiveOldReports()`. If unset or invalid, the system uses the safe default of 90 days. |

---

## 2. Integrated Agriculture Site Locations (Indonesia Context)

The default form site dropdown options represent an integrated agriculture supply chain:

1. **Site A — Kebun & Lahan Pertanian** (Crops / Agricultural Land)
2. **Site B — Peternakan & Kandang** (Livestock / Poultry / Dairy)
3. **Site C — Pabrik Pengolahan & Pakan** (Processing Plant / Feed Mill / End-Product Unit)
4. **Site D — Logistik & Gudang Distribution** (Warehouse & Transport Hub)

*To customize these site names, edit `src/Setup.gs` in `setupDailyForm()` and `setupGeneralForm()` before running provision.*

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

---

## 4. Key Architecture & Policy Decisions

- **Attachment Handling (Option A)**:
  Forms do not enforce Google Login to keep friction zero for non-tech-savvy field staff. Photo evidence for general/incident reports is submitted via site WhatsApp directly to the operational admin referencing timestamp and Site location.
- **Sensitive Data Isolation**:
  General reports with the **Informasi sensitif? / Contains sensitive info?** checkbox enabled are automatically removed from `General_Raw` and appended exclusively to `Sensitive_Restricted`.
- **Looker Studio Integration**:
  Looker Studio connects directly to the `Weekly_Summary` tab (which is aggregated automatically by the weekly trigger script).

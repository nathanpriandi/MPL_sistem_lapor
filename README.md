# Sistem Pelaporan Digital — Integrated Agriculture Reporting System

![Stack](https://img.shields.io/badge/Stack-Google%20Forms%20%7C%20Sheets%20%7C%20Apps%20Script%20%7C%20Looker%20Studio-green)
![Budget](https://img.shields.io/badge/Budget-Zero%20IDR%20%2F%20Free%20Tier-blue)
![Compliance](https://img.shields.io/badge/UU%20PDP-Considerations%20Addressed-orange)
![Deployments](https://img.shields.io/badge/Architecture-Integrated%20Tab--per--Form%20Pattern-purple)

A zero-budget, modern digital reporting system designed for an integrated agriculture enterprise in Indonesia (Farming, Livestock, Processing Plant, Logistics & End-Products). Replaces traditional paper reports with a mobile-first Web App portal, dynamic form management builder, automated triage engine, sensitive data isolation, strict Role-Based Access Control (RBAC), and executive dashboards.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Client Layer
        A1[Staf & Mandor Lapangan] -->|Submit Mobile Portal / QR Code| B1[Deployment A: Public Web Portal<br/>Daily Report + General Report + Dynamic Custom Forms]
        A2[Admin Operasional] -->|Visit Internal URL| B2[Deployment B: Internal Operations Console<br/>Admin Queue & Form Management]
        A3[Manager Operasional] -->|Visit Internal URL| B3[Deployment B: Internal Operations Console<br/>Manager Dashboard]
    end

    subgraph Server Layer - Apps Script Engine
        B1 -->|ClientAPI submitDailyReport / submitGeneralReport / submitDynamicFormResponse| C[Google Apps Script Engine<br/>Web.gs / FormHandlers.gs / ReportService.gs]
        C --> D[Automation.gs<br/>Triage Engine & Keyword Evaluation]
        D -->|Urgent Alert| E1[Instant Email Alert to ADMIN_EMAIL]
        D -->|Normal / Warning| E2[Single Integrated Google Spreadsheet]
        C -->|Sensitive Flag Checked| F[Sensitive Tab<br/>Isolated Restricted Sheet Access]
    end

    subgraph Data & Analytics Layer
        E2 -->|Tab-per-Form: Laporan Operasional Harian / Laporan Umum / Custom Tabs| G1[Admin Queue Triage View]
        E2 -->|Per-Form Photo Folders| G2[Reporting System Photos Drive Folder]
        E2 -->|Integrated Dashboard Analytics| G3[Manager Dashboard & Looker Studio]
        E2 -->|Monthly Trigger| H[archiveClosedReports Trigger<br/>Data Retention Archive]
    end
```

---

## 📁 Repository Structure

```
MPL_sistem_lapor/
├── package.json               # Node & clasp dev dependencies
├── .clasp.json.template       # Clasp deployment configuration template
├── CONFIG.md                  # Operational settings, site lists, & keyword rules
├── README.md                  # System architecture, deployment guide & reference
├── src/
│   ├── appsscript.json        # Apps Script manifest (Asia/Jakarta timezone & scopes)
│   ├── Setup.gs               # Spreadsheet & Google Form provisioning logic
│   ├── Automation.gs          # Triage keyword engine & data archival (archiveClosedReports)
│   ├── AdminService.gs        # Internal admin queue processing & review status management
│   ├── ReportService.gs       # Report submission coordinator, photo upload & dynamic form handler
│   ├── FormManagementService.gs # Form registry CRUD, integrated spreadsheet tab-per-form provisioner
│   ├── SpreadsheetRepository.gs # DAO layer for single integrated spreadsheet reads/writes & GID lookups
│   ├── ConfigRepository.gs    # Script Properties configuration wrapper
│   ├── DomainEntities.gs      # Domain data models (DailyReport, GeneralReport, QueueItem)
│   ├── TriageEngine.gs        # Triage keyword matcher & severity ranker
│   ├── NotificationAdapter.gs # Email alert dispatcher
│   ├── FormHandlers.gs        # Native Google Form trigger handlers
│   ├── Triggers.gs            # Time-driven and event trigger setup
│   ├── Utils.gs               # Date helpers & unit test suites
│   ├── MockSimulator.gs       # Seed mock test data generator
│   ├── Web.gs                 # HTTP doGet router, RBAC auth, deployment check, includeApp()
│   ├── ClientAPI.gs           # Server RPC bridge for Web App (google.script.run)
│   │
│   ├── index.html             # Public Daily Report Form view
│   ├── general.html           # Public General Report Form view
│   ├── dynamicform.html       # Public Dynamic Custom Form intake view (supports photo upload)
│   ├── admin.html             # Internal Admin Triage Queue view (Modal detail, search, filter, CSV)
│   ├── dashboard.html         # Internal Executive Manager Dashboard view (KPIs, Charts, CSV export)
│   ├── forms.html             # Internal Form Management console (Create form, edit tampilan, direct sheet GID links)
│   ├── header.html            # Shared top navigation header partial & active user identity strip
│   ├── sidebar.html           # Internal Operations Console sidebar navigation
│   ├── style.html             # Component design tokens, CSS stylesheet, toasts, modals
│   └── app.html               # Client JS bridge, triage helper engine, toast & CSV utilities
└── docs/
    ├── USER_GUIDE_DAILY_REPORT.md # Field staff step-by-step user guide
    ├── ADMIN_MANUAL.md        # Admin runbook & queue management guide
    └── CONSENT_NOTICE_UU_PDP.md   # Plain-language Indonesia UU PDP privacy notice
```

> 💡 **Single Source of Truth**: All code lives exclusively in `src/`. Running `npm run push` deploys `src/` directly to Google Apps Script.

---

## 🚀 Quick Setup & Deployment Guide

### Step 1: Prerequisites & Dependencies
1. A dedicated Google Account created for the company system.
2. Enable Apps Script API at [script.google.com/home/usersettings](https://script.google.com/home/usersettings).
3. Install project dependencies locally:
   ```bash
   npm install
   ```

### Step 2: Google Authentication & Project Creation
```bash
# Login to Google Account via clasp CLI
npx clasp login

# Initialize standalone Apps Script project
npx clasp create --type standalone --title "Sistem Pelaporan MPL" --rootDir src
```

### Step 3: Push Source Code & Provision Infrastructure
```bash
# Push code to Google Apps Script
npm run push

# Open Apps Script Web Editor
npm run open
```
In the Apps Script editor:
1. Open `Setup.gs`.
2. Run `setupReportingSystem()` to automatically create the Integrated Spreadsheet, unified Google Form, and initial sheet tabs.
3. Check the Execution Log for generated `SPREADSHEET_ID` and `MAIN_FORM_ID`.

---

## ⚙️ Script Properties Configuration

In the Apps Script Editor, go to **Project Settings** (⚙️) → **Script Properties** and set the following properties:

| Property Name | Required | Example / Description |
|---|---|---|
| `ADMIN_EMAIL` | **Yes** | Active Admin Google account email (e.g. `mpl.sisteminformasi@gmail.com`). Receives urgent alerts. |
| `MANAGER_EMAIL` | **Yes** | Active Manager Google account email. Receives weekly executive digests. |
| `SPREADSHEET_ID` | **Yes** | ID of the single integrated Google Spreadsheet (auto-generated by `Setup.gs`). |
| `MAIN_FORM_ID` | **Yes** | ID of the Unified Operational Google Form (auto-generated by `Setup.gs`). |
| `REGISTERED_FORMS_JSON` | **Auto** | JSON array of all registered forms, tab GIDs, and Drive photo folder metadata. |
| `PUBLIC_WEB_APP_URL` | **Yes** | Web App URL of **Deployment A** (Public Access). Set after creating Deployment A. |
| `INTERNAL_WEB_APP_URL` | **Yes** | Web App URL of **Deployment B** (Internal Operations Console). Set after creating Deployment B. |
| `RETENTION_DAYS` | Optional | Archive threshold in days for `archiveClosedReports()`. Defaults to `30` if unset. |

---

## 🌐 Dual Web App Deployment Model

To maintain zero friction for field staff while strictly securing internal admin functions, deploy two Web App instances from the same Apps Script project:

### Deployment A — Public Portal (Field Staff)
- **Deploy** → **New deployment**
- **Select type**: `Web app`
- **Description**: `Deployment A — Public Field Staff Intake`
- **Execute as**: `Me`
- **Who has access**: `Anyone` *(No Google Login required)*
- **Result**: Field staff land directly on Daily Report, General Report, or Dynamic Custom forms.

### Deployment B — Internal Operations Console (Admin & Manager)
- **Deploy** → **New deployment**
- **Select type**: `Web app`
- **Description**: `Deployment B — Internal Operations Console`
- **Execute as**: `Me`
- **Who has access**: `Anyone with Google account` *(Enforces Google login)*
- **Result**: Admin and Manager accounts land directly on their role-specific views (`admin.html`, `dashboard.html`, or `forms.html`).

> ⚠️ **Important Step**: Copy the exact Web App URLs from **Deploy → Manage deployments** into `PUBLIC_WEB_APP_URL` and `INTERNAL_WEB_APP_URL` in Script Properties so deployment detection and quick navigation operate properly.

---

## ⚡ Core Features & Technical Highlights

1. **Zero-Friction Field Intake (`index.html`, `general.html`, `dynamicform.html`)**:
   - Mobile-responsive layout, clean form validation, and dynamic issue checkbox selectors.
   - Supports photo attachments (`Foto_Lampiran`) stored cleanly in per-form Drive folders.

2. **Form Management Console (`forms.html` & `FormManagementService.gs`)**:
   - Admin tool to create custom forms (dynamic fields, dropdowns, photo uploads), edit titles/descriptions, and activate/deactivate forms.
   - **Integrated Single Spreadsheet (Tab-per-Form)**: Each form owns a dedicated tab within `SPREADSHEET_ID`.
   - **Direct Tab Links (`#gid=...`)**: `Buka Sheet Data` opens the integrated spreadsheet directly at the form's specific tab GID.

3. **Automated Triage Engine (`TriageEngine.gs`)**:
   - Scans narrative text against Indonesian keyword dictionaries (`urgent` vs `warning` severity).
   - Automatically ranks incidents and dispatches instant email alerts to `ADMIN_EMAIL` for urgent flags (e.g. *kebakaran, kecelakaan, wabah, mati masal*).

4. **Sensitive Data Isolation (`SpreadsheetRepository.gs`)**:
   - Reports marked with *Informasi Sensitif?* are isolated exclusively to a single shared `Sensitive` tab, keeping confidential reports hidden from standard sheet views.

5. **Strict Per-Role RBAC & Role-Aware Landing (`Web.gs`)**:
   - Gated via `getUserRole()` against `ADMIN_EMAIL` and `MANAGER_EMAIL`.
   - Bare URLs on Deployment B automatically route based on role (`admin` -> Admin Queue, `manager` -> Manager Dashboard).
   - Deployment A attempts to access internal pages are cleanly blocked with an Access Restricted card.

6. **Automated Data Lifecycle (`archiveClosedReports`)**:
   - Time-driven trigger archives closed reports older than retention threshold into `Archive_Reports`, keeping active sheets fast and lightweight.

---

## ⚖️ Legal & Privacy Compliance (UU PDP)

This technical architecture addresses data protection requirements under Indonesia's **Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)**:
- **Data Minimization**: Uses Employee IDs (`EmpID`) rather than full personal identity records.
- **Access Limitation & Isolation**: Dedicated `Sensitive` tab ensures sensitive field reports are isolated to authorized admins.
- **RBAC Enforcement**: Admin Queue, Form Management, and Manager Dashboard views are restricted to authorized operational emails.
- **Staff Consent Notice**: Includes `docs/CONSENT_NOTICE_UU_PDP.md` for posting at operational sites.

---

*Note: Built for Integrated Agriculture Operations (Farming, Livestock, Processing Plant, Logistics).*
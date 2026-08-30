# Sistem Lapor MPL — Integrated Agriculture Reporting System

![Stack](https://img.shields.io/badge/Stack-Google%20Forms%20%7C%20Sheets%20%7C%20Apps%20Script%20%7C%20Clasp-green)
![Budget](https://img.shields.io/badge/Budget-Zero%20IDR%20%2F%20Free%20Tier-blue)
![Compliance](https://img.shields.io/badge/UU%20PDP-UU%20No.%2027%20Tahun%202022%20Compliant-orange)
![Deployments](https://img.shields.io/badge/Architecture-Dual%20Deployment%20RBAC%20Pattern-purple)

A zero-budget, modern digital reporting system engineered for an integrated agriculture enterprise in Indonesia (Farming, Livestock, Processing Plant, Logistics & End-Products). Replaces traditional manual paper reports with a mobile-first Web App portal, dynamic 6-step operational reporting wizard, live hybrid camera capture, form blueprint manager, automated triage engine, sensitive data isolation, strict Role-Based Access Control (RBAC), and real-time executive dashboards.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Client Layer
        A1[Staf & Mandor Lapangan] -->|Mobile Browser / QR Code| B1[Deployment A: Public Web Portal<br/>Unified 6-Step Operational Form + Dynamic Custom Forms]
        A2[Admin Operasional] -->|Google Account Login| B2[Deployment B: Internal Operations Console<br/>Admin Queue, Form Settings & Employee Registry]
        A3[Manager Operasional] -->|Google Account Login| B3[Deployment B: Internal Operations Console<br/>Executive Analytics Dashboard & Export]
    end

    subgraph Server Layer - Apps Script Engine
        B1 -->|ClientAPI submitOperationalReport / submitDynamicFormResponse| C[Google Apps Script Engine<br/>Web.gs / FormHandlers.gs / ReportService.gs / ClientAPI.gs]
        C --> D[TriageEngine.gs<br/>Automated Obstacle & Urgency Evaluator]
        D -->|Urgent Priority| E1[Instant Email Alert Dispatcher<br/>NotificationAdapter.gs]
        D -->|Normal / Urgent Record| E2[Single Integrated Google Spreadsheet<br/>SpreadsheetRepository.gs]
        C -->|Sensitive Flag Checked| F[Sensitive_Restricted Sheet Tab<br/>Isolated Confidential Access]
    end

    subgraph Data & Analytics Layer
        E2 -->|Tab-per-Form: Laporan Operasional & Custom Form Tabs| G1[Admin Triage Queue & Inspector Modal<br/>admin.html]
        E2 -->|Per-Form Photo Folders on Google Drive| G2[Drive Photo Evidence Archive<br/>3x Photos per Report]
        E2 -->|Period Analytics Engine: AnalyticsService.gs| G3[Executive Manager Dashboard & Charts<br/>dashboard.html]
        E2 -->|Monthly Time-Driven Trigger| H[archiveClosedReports Trigger<br/>Data Lifecycle & Archival Tab]
    end
```

---

## 📁 Repository Structure

```
MPL_sistem_lapor/
├── package.json               # Node.js dev dependencies & clasp CLI scripts
├── .clasp.json.template       # Clasp deployment configuration template
├── CONFIG.md                  # Operational parameters, site registry & keyword rules
├── README.md                  # System architecture, deployment guide & technical reference
├── src/
│   ├── appsscript.json        # Apps Script manifest (Asia/Jakarta timezone & scopes)
│   ├── Setup.gs               # Spreadsheet, Google Drive folders & initial schema provisioning
│   ├── Automation.gs          # Triage keyword engine & automated data retention triggers
│   ├── AdminService.gs        # Internal admin queue processing, review verification & employee registry
│   ├── AnalyticsService.gs    # Executive analytics computations, harvest yields & revenue trends
│   ├── AuthService.gs         # RBAC session validation & Google account role gating
│   ├── ReportService.gs       # Report submission coordinator, photo upload & dynamic form intake
│   ├── FormManagementService.gs # Form schema registry CRUD, step builders & tab-per-form provisioning
│   ├── SpreadsheetRepository.gs # DAO layer for integrated spreadsheet reads/writes & GID lookups
│   ├── ConfigRepository.gs    # Script Properties configuration wrapper
│   ├── DomainEntities.gs      # Domain data models, employee master registry & severity constants
│   ├── TriageEngine.gs        # Triage obstacle evaluator & severity classifier
│   ├── NotificationAdapter.gs # Instant HTML email alert dispatcher
│   ├── FormHandlers.gs        # Native Google Form trigger handlers
│   ├── Triggers.gs            # Time-driven and event trigger management
│   ├── Utils.gs               # Date formatting, rupiah formatters & validation helper utilities
│   ├── MockSimulator.gs       # Seed mock test generator for staging validation
│   ├── Web.gs                 # HTTP doGet router, RBAC authentication, deployment check & layout includes
│   ├── ClientAPI.gs           # Server RPC bridge for Web App (google.script.run dispatcher)
│   │
│   ├── index.html             # Public Unified 6-Step Operational Reporting Form with camera capture
│   ├── camera.html            # Standalone pop-up WebRTC camera fallback page
│   ├── dynamicform.html       # Public Dynamic Custom Form intake view (supports dynamic fields & photos)
│   ├── admin.html             # Internal Admin Queue view (Inspector modal, search, filters & CSV export)
│   ├── dashboard.html         # Executive Manager Analytics Dashboard (KPIs, Yields, Revenue & Trends)
│   ├── employees.html         # Internal Employee Master Settings (ID Prefix, Division & PIC SGA 2-Tier)
│   ├── forms.html             # Form Schema Blueprint Manager (Lokasi, Tindakan, Komoditas, Custom Questions)
│   ├── roles.html             # Superadmin Role & Access Permission management view
│   ├── brand.html             # Master SVG brand mark and corporate wordmark partial
│   ├── header.html            # Public form display-only header partial & user identity strip
│   ├── sidebar.html           # Internal Operations Console sidebar navigation with integrated brand header
│   ├── style.html             # Design token stylesheet (CSS variables, buttons, modals, toasts, badges)
│   └── app.html               # Client JS bridge, toast notifications, export utilities & guide modals
└── docs/
    ├── USER_GUIDE_DAILY_REPORT.md # Field staff step-by-step reporting guide
    ├── ADMIN_MANUAL.md        # Admin runbook & queue management guide
    └── CONSENT_NOTICE_UU_PDP.md   # Plain-language Indonesia UU PDP privacy notice
```

> 💡 **Single Source of Truth**: All operational source code lives exclusively in `src/`. Running `npm run push` deploys `src/` directly to Google Apps Script.

---

## 🚀 Quick Setup & Deployment Guide

### Step 1: Prerequisites & Dependencies
1. A Google Workspace or Gmail account designated for the enterprise reporting system.
2. Enable Google Apps Script API at [script.google.com/home/usersettings](https://script.google.com/home/usersettings).
3. Install project dependencies locally:
   ```bash
   npm install
   ```

### Step 2: Google Authentication & Clasp Setup
```bash
# Login to Google Account via Clasp CLI
npx clasp login

# Initialize standalone Apps Script project
npx clasp create --type standalone --title "Sistem Pelaporan MPL" --rootDir src
```

### Step 3: Push Code & Provision System
```bash
# Deploy code to Google Apps Script
npm run push

# Open the Apps Script Web Editor
npm run open
```
In the Apps Script web editor:
1. Open `Setup.gs`.
2. Run `setupReportingSystem()` to automatically create the Integrated Spreadsheet, Drive photo folders, and initial sheet tabs.
3. Check the **Execution Log** for the generated `SPREADSHEET_ID` and `MAIN_FORM_ID`.

---

## ⚙️ Script Properties Configuration

In the Apps Script Editor, go to **Project Settings** (⚙️) → **Script Properties** and configure the following parameters:

| Property Name | Required | Example / Description |
|---|---|---|
| `ADMIN_EMAIL` | **Yes** | Active Admin Google email (e.g. `mpl.sisteminformasi@gmail.com`). Receives instant urgent notifications. |
| `MANAGER_EMAIL` | **Yes** | Active Executive Manager Google email. Receives weekly digests and accesses Analytics. |
| `SPREADSHEET_ID` | **Yes** | ID of the single integrated Google Spreadsheet (auto-generated by `Setup.gs`). |
| `MAIN_FORM_ID` | **Yes** | ID of the Unified Operational Google Form (auto-generated by `Setup.gs`). |
| `REGISTERED_FORMS_JSON` | **Auto** | JSON array of all registered dynamic custom forms, tab GIDs, and Drive photo folders. |
| `PUBLIC_WEB_APP_URL` | **Yes** | Web App URL of **Deployment A** (Public Access). Set after creating Deployment A. |
| `INTERNAL_WEB_APP_URL` | **Yes** | Web App URL of **Deployment B** (Internal Operations Console). Set after creating Deployment B. |
| `RETENTION_DAYS` | Optional | Archival threshold in days for `archiveOldReports()`. Defaults to `90` days. |

---

## 🌐 Dual Web App Deployment Model

To ensure zero friction for field staff on mobile devices while securing internal management data, deploy two Web App instances from the same script project:

### Deployment A — Public Portal (Field Staff)
- **Deploy** → **New deployment**
- **Type**: `Web app`
- **Description**: `Deployment A — Public Field Staff Intake`
- **Execute as**: `Me`
- **Who has access**: `Anyone` *(No Google login required)*
- **Landing**: Directly loads the 6-Step Operational Reporting Form (`index.html`) or Dynamic Custom Forms (`dynamicform.html`).

### Deployment B — Internal Operations Console (Admin & Manager)
- **Deploy** → **New deployment**
- **Type**: `Web app`
- **Description**: `Deployment B — Internal Operations Console`
- **Execute as**: `Me`
- **Who has access**: `Anyone with Google account` *(Requires Google login)*
- **Landing**: Automatically evaluates user email and routes to `admin.html` (Admin), `dashboard.html` (Manager), `employees.html`, or `forms.html`.

> ⚠️ **Configuration Step**: Copy both Web App URLs into `PUBLIC_WEB_APP_URL` and `INTERNAL_WEB_APP_URL` in **Script Properties** so role routing and inter-module links work properly.

---

## ⚡ Core Features & Technical Capabilities

### 1. Unified 6-Step Operational Reporting Wizard (`index.html`)
- **Step 1: PIC & Site Identity**: Selects verified Employee ID with automatic name/division lookup, activity selection (Tanam/Tebar, Panen/Jual, Pengawasan, Administrasi), and site location.
- **Step 2: Planting / Seeding (Conditional)**: Records commodity, land area ($m^2$/Ha), seed quantity, and planting status.
- **Step 3: Harvest & Sales (Conditional)**: Captures harvest quantity (Kg), unit price, total revenue (Rp), buyer details, and logistics channel.
- **Step 4: Supervision & Field Activities**: Tracks supervision actions, office admin notes, obstacles, and immediate mitigation attempts.
- **Step 5: Hybrid Camera Documentation**: Captures 3 required photos (Activity, Yield/Product, Team Documentation) with client-side JPEG compression, EXIF removal, and date/time watermarks.
- **Step 6: Review & Final Submission**: Real-time review summary with a 3-column single-row mobile photo grid before submission.

### 2. Hybrid Camera Architecture (Web & Mobile)
- **Mobile Devices**: Directly invokes the native camera (`capture="environment"`) with zero permission friction.
- **Desktop/Web Browsers**: Uses a responsive in-page modal (`#cameraModal`) with a live WebRTC viewfinder. If the browser blocks WebRTC, it falls back seamlessly to a local file selector or a standalone camera popup tab (`camera.html`).

### 3. Employee Master & 2-Tier SGA Role Structure (`employees.html` & `DomainEntities.gs`)
- **Management (`MNJ-01`..`09`) & Alprof (`ALP-01`..`07`)**: Full direct reporting permissions (`isPic: true`).
- **PIC SGA (`SGA-01` Ketut & `SGA-02` Amas S)**: Designated PICs with exclusive authorization to submit official operational reports for the SGA division and record team attendance.
- **SGA Field Members (`SGA-03`..`12`)**: Field team members whose attendance is logged via PIC SGA.
- **Employee Settings Console**: Real-time CRUD interface with auto-increment ID generation, division filters, and `PIC SGA` badge indicators (`badge-div-pic-sga`).

### 4. Form Blueprint & Schema Manager (`forms.html`)
- Visual form builder allowing admins to configure active options for **Lokasi**, **Tindakan Pengawasan**, **Komoditas Pertanian**, and **Status Pengelolaan**.
- Supports adding dynamic custom fields across Steps 1 through 5.
- Real-time schema synchronization with draft status detection and reset capabilities.

### 5. Automated Triage Engine (`TriageEngine.gs`)
- Evaluates field reports for operational obstacles (`Kendala Kegiatan`).
- Reports with verified obstacles are automatically tagged as **`Urgent`** and trigger instant email alerts to `ADMIN_EMAIL`.
- Standard operational reports are classified as **`Normal`**.

### 6. Executive Manager Analytics Dashboard (`dashboard.html` & `AnalyticsService.gs`)
- **Period Filter Engine**: Computes KPIs across `This Week`, `Last Week`, `This Month`, `This Quarter`, `This Year`, or custom date ranges.
- **Key Metrics**: Harvest volume (Kg), gross sales revenue (Rp), average price realization, planting area coverage, and active field workers.
- **Visual Analytics**: Interactive commodity breakdown charts, revenue trends, and operational obstacle tracker.
- **Data Export**: One-click CSV export of filtered analytical datasets.

---

## ⚖️ Legal & Privacy Compliance (UU PDP No. 27 Tahun 2022)

The system adheres to Indonesia's Personal Data Protection Law (**Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi**):
- **Data Minimization (Pasal 16)**: Form intake utilizes standardized Employee IDs (`EmpID`) rather than sensitive government ID numbers.
- **Access Control & RBAC (Pasal 35)**: Internal administration consoles are strictly restricted to authenticated operational Google accounts.
- **Confidential Data Isolation**: Reports flagged as *Sensitive* are stored in a segregated `Sensitive_Restricted` tab.
- **Transparent Privacy Consent**: Integrated privacy modal in the reporting form footer with plain-language terms (`docs/CONSENT_NOTICE_UU_PDP.md`).
- **Data Lifecycle & Archival**: Automatic archiving of historical reports older than 90 days (`archiveOldReports`).

---

*Developed for Integrated Agriculture & Agro-Industrial Operations (Planting, Harvest, Livestock, Processing Plant & Logistics).*
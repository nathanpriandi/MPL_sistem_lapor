# Sistem Pelaporan Digital — Integrated Agriculture Reporting System

![Stack](https://img.shields.io/badge/Stack-Google%20Forms%20%7C%20Sheets%20%7C%20Apps%20Script%20%7C%20Looker%20Studio-green)
![Budget](https://img.shields.io/badge/Budget-Zero%20IDR%20%2F%20Free%20Tier-blue)
![Compliance](https://img.shields.io/badge/UU%20PDP-Considerations%20Addressed-orange)

A zero-budget, modern digital reporting system designed for an integrated agriculture business in Indonesia (Farming, Livestock, Processing Plant, Logistics & End-Products). Replaces traditional daily paper reports with an automated, low-friction mobile workflow, automated triage engine, sensitive data isolation, role-based access control (RBAC), and executive dashboards.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    A[Staf & Mandor Lapangan] -->|Submit via HP/Browser| B[Public Web Portal / Google Forms<br/>Daily Report + General Report]
    B --> C[Google Spreadsheet<br/>Central Database]
    C --> D[Google Apps Script Engine<br/>Flagging, Routing, Notifications, RBAC]
    D --> E[Admin_Queue Tab<br/>Filtered & Color-Coded]
    D --> F[Sensitive_Restricted Tab<br/>Narrow Access Only]
    D --> G[Weekly_Summary Tab]
    G --> H[Looker Studio Dashboard / Manager View]
    E --> I[Admin Operasional Console]
    H --> J[Manager Operasional Dashboard]
```

---

## 📁 Repository Structure

```
MPL_sistem_lapor/
├── package.json               # Node & clasp dev dependencies
├── .clasp.json.template       # Clasp deployment configuration template
├── CONFIG.md                  # Operational settings, site lists, & keyword rules
├── README.md                  # Project documentation and developer guide
├── src/
│   ├── appsscript.json        # Apps Script manifest (Asia/Jakarta timezone & scopes)
│   ├── Setup.gs               # Spreadsheet & Google Form provisioning logic
│   ├── Automation.gs          # Triage keyword engine & 90-day data archival (archiveOldReports)
│   ├── FormHandlers.gs        # Form submission handlers & sensitive row routing
│   ├── Notifications.gs       # Urgent alerts, daily admin & weekly manager digests
│   ├── Triggers.gs            # Automated trigger setup (daily digests, weekly summaries, monthly archival)
│   ├── Utils.gs              # Looker Studio aggregation, date helpers, unit tests
│   ├── MockSimulator.gs       # Seed mock test data generator
│   ├── Web.gs                 # Web App HTTP doGet router, strict RBAC auth, keyword injection
│   ├── ClientAPI.gs           # Server RPC bridge for Web App (google.script.run & Quick Links)

│   ├── index.html             # Public Daily Report Form view
│   ├── general.html           # Public General Report Form view
│   ├── admin.html             # Internal Admin Triage Queue view (Modal detail, search, filter, CSV export)
│   ├── dashboard.html         # Internal Executive Manager Dashboard view (KPIs, Charts, CSV export)
│   ├── style.html             # Component design tokens, CSS stylesheet, toasts, modals
│   └── app.html               # Client JS bridge, triage helper engine, toast & CSV utilities
└── docs/
    ├── USER_GUIDE_DAILY_REPORT.md # Field staff step-by-step user guide
    ├── ADMIN_MANUAL.md        # Admin runbook & queue management guide
    └── CONSENT_NOTICE_UU_PDP.md   # Plain-language Indonesia UU PDP privacy notice
```

> 💡 **Single Source of Truth**: All application code lives exclusively in `src/`. `clasp push` deploys `src/` directly to Google Apps Script.

---

## 🚀 Quick Setup & Deployment Guide

### Prerequisites
1. Dedicated Google Account created for the company system.
2. Enable Apps Script API at [script.google.com/home/usersettings](https://script.google.com/home/usersettings).

### Step 1: Local Installation
```bash
# Install dependencies (clasp & Google Apps Script types)
npm install
```

### Step 2: Google Account Authentication & Project Creation
```bash
# Login to company Google account via clasp CLI
npx clasp login

# Initialize standalone Apps Script project
npx clasp create --type standalone --title "Reporting System Automation" --rootDir src
```

### Step 3: Code Deployment
```bash
# Push all source files to Google Apps Script
npm run push

# Open Apps Script Web Editor
npm run open
```

### Step 4: Web App Deployment (Dual Deployment Pattern)
To serve the primary Web App frontend while ensuring security:
1. **Deployment A (Public Portal — Field Staff)**:
   - Click **Deploy** -> **New deployment**.
   - Type: **Web app**.
   - Description: `Public Intake Forms (Field Staff)`.
   - **Execute as**: `Me`.
   - **Who has access**: `Anyone` (No Google login required).
   - *Share this URL with field staff or convert to site QR codes. Gated shell hides internal links.*

2. **Deployment B (Internal Operations Console — Admin & Manager)**:
   - Click **Deploy** -> **New deployment**.
   - Type: **Web app**.
   - Description: `Internal Operations Queue & Dashboard`.
   - **Execute as**: `Me`.
   - **Who has access**: `Anyone with Google account`.
   - *Access to `admin.html` and `dashboard.html` is strictly gated by `getUserRole()` against `ADMIN_EMAIL` and `MANAGER_EMAIL` Script Properties.*

---

## 🔒 Human Action Checklist (Non-Automatable Steps)

- [ ] Enable Apps Script API on dedicated Google Account.
- [ ] Run `npx clasp login` and authorize OAuth consent.
- [ ] Deploy Web App **Deployment A** (Public intake, Access: `Anyone`) for field staff.
- [ ] Deploy Web App **Deployment B** (Internal views, Access: `Anyone with Google account`) for Admin & Manager.
- [ ] Print QR Codes / Links for Web App & Google Forms backup at farm/plant sites.
- [ ] Post staff privacy notice (`docs/CONSENT_NOTICE_UU_PDP.md`).
- [ ] *(Optional)* Connect Looker Studio ([lookerstudio.google.com](https://lookerstudio.google.com)) to `Weekly_Summary` tab for deeper ad-hoc analytics.

---

## 🧪 Testing & Verification

1. Run `testKeywordMatcher()` in `src/Utils.gs` from Apps Script editor to verify keyword rules.
2. Submit a test entry in **Daily Report** with an urgent keyword (e.g. `kebakaran` or `rusak berat`). Verify instant email alert to `ADMIN_EMAIL` and Toast notification on client.
3. Submit a test entry in **General Report** with *Informasi Sensitif?* checked. Verify row moves to `Sensitive_Restricted` and is removed from `General_Raw`.
4. Test RBAC: Access `?page=admin` with a Manager-only email to verify custom role-aware Access Restricted message.
5. Export CSV: Click **Export CSV** in Admin Queue or **Export Summary CSV** in Manager Dashboard to verify client-side CSV downloads.

---

## ⚖️ Legal & Privacy Compliance

This system addresses key technical data protection considerations under Indonesia's **Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)** by implementing data minimization (Employee IDs), restricted access isolation for sensitive reports, role-based access control, and explicit staff privacy notices.

*Note: This technical implementation addresses privacy design considerations; it does not constitute formal legal certification.*
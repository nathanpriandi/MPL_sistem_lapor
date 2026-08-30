/**
 * Setup.gs — System Provisioning and Initialization
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: PROVISIONING / INITIALIZATION
 * Responsibility: Run-once provisioning script for generating spreadsheets, forms, and script properties.
 */

const SHEET_NAMES = Object.freeze({
  MASTER_LAPORAN: 'Master_Laporan'
});

/**
 * Main provisioning function. Run once manually from Apps Script editor or clasp run.
 * Creates Spreadsheet, Master Sheet Tab (Master_Laporan), sets standard 35 columns, and stores Script Properties.
 * No irrelevant/duplicate tabs (Admin_Queue, Sensitive, Photo_Log, Master_Karyawan, Form Responses) are created.
 * Daily tabs (Laporan_YYYY-MM-DD) will be lazily generated only when reports are submitted on that day.
 */
function setupReportingSystem() {
  Logger.log('Starting system provisioning with Master Sheet & Lazy Daily Tab architecture...');

  // Clear legacy script properties (DAILY_FORM_ID, GENERAL_FORM_ID, REGISTERED_FORMS_JSON)
  try {
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty('REGISTERED_FORMS_JSON');
    Logger.log('Purged legacy script properties.');
  } catch (e) {}
  
  // 1. Create Central Spreadsheet
  const ss = SpreadsheetApp.create('Sistem Lapor MPL — Database Operasional');
  const ssId = ss.getId();
  Logger.log('Created Spreadsheet ID: ' + ssId);

  // 2. Create Google Form & Link Destination (for Google Form backup link)
  const mainFormId = setupOperationalForm(ssId);

  // 3. Setup Permanent Master Sheet Tab: Master_Laporan
  const sheets = ss.getSheets();
  let masterSheet = sheets[0];
  masterSheet.setName(SHEET_NAMES.MASTER_LAPORAN);

  // Apply standard columns from OPERATIONAL_REPORT_FIELDS with high-contrast formatting
  const opHeaders = OPERATIONAL_REPORT_FIELDS.map(f => f.header);
  applyHeaderStyle(masterSheet, opHeaders);

  // 4. Remove any extra default or form tabs created by Google Form destination binding
  Utilities.sleep(1500);
  cleanupIrrelevantSpreadsheetTabs(ssId);

  // 5. Store Properties via ConfigRepository
  ConfigRepository.setProperties({
    'SPREADSHEET_ID': ssId,
    'MAIN_FORM_ID': mainFormId,
    'ADMIN_EMAIL': ConfigRepository.PLACEHOLDER_ADMIN,
    'MANAGER_EMAIL': ConfigRepository.PLACEHOLDER_MANAGER
  });

  Logger.log('=== PROVISIONING COMPLETE ===');
  Logger.log('Spreadsheet URL: ' + ss.getUrl());
  Logger.log('Master Sheet Provisioned: ' + SHEET_NAMES.MASTER_LAPORAN);
}

/**
 * Applies high-contrast bold dark headers with neutral light gray background.
 * Overrides any white text or default themes from Google Form bindings.
 * @param {Sheet} sheet 
 * @param {Array<string>} headers 
 */
function applyHeaderStyle(sheet, headers) {
  if (!sheet || !headers || headers.length === 0) return;
  const maxCols = sheet.getMaxColumns();
  if (maxCols < headers.length) {
    sheet.insertColumnsAfter(maxCols, headers.length - maxCols);
  }
  const range = sheet.getRange(1, 1, 1, headers.length);
  range.setValues([headers]);
  range.setFontWeight('bold')
       .setFontColor('#0f172a')         // High-contrast slate black text
       .setBackground('#e2e8f0')       // Clean neutral light gray background
       .setFontSize(10)
       .setVerticalAlignment('middle')
       .setWrap(false);
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 32);
}

/**
 * Configure Headers and Formulas for Sheet
 */
function setupSheetHeaders(mainSheet) {
  if (mainSheet) {
    const opHeaders = OPERATIONAL_REPORT_FIELDS.map(f => f.header);
    applyHeaderStyle(mainSheet, opHeaders);
  }
}

/**
 * Maintenance helper: Re-synchronizes headers, purges obsolete tabs, and un-shifts any legacy rows.
 */
function repairSpreadsheetHeadersAndData() {
  Logger.log('Starting spreadsheet header repair & cleanup...');
  const ss = SpreadsheetRepository.getSpreadsheet();
  if (!ss) {
    Logger.log('Spreadsheet unavailable.');
    return;
  }

  // 1. Cleanup all irrelevant/duplicate tabs
  cleanupIrrelevantSpreadsheetTabs();

  const opHeaders = OPERATIONAL_REPORT_FIELDS.map(f => f.header);

  // 2. Format and fix Master_Laporan and all daily sheets
  const targetSheets = [];
  const masterSheet = ss.getSheetByName(SHEET_NAMES.MASTER_LAPORAN) || ss.insertSheet(SHEET_NAMES.MASTER_LAPORAN, 0);
  targetSheets.push(masterSheet);

  ss.getSheets().forEach(s => {
    if (/^Laporan_\d{4}-\d{2}-\d{2}$/i.test(s.getName()) && !targetSheets.includes(s)) {
      targetSheets.push(s);
    }
  });

  targetSheets.forEach(sheet => {
    if (!sheet) return;
    applyHeaderStyle(sheet, opHeaders);

    // Fix shifted data rows if old 35-column layout was present
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow > 1 && lastCol >= 34) {
      const dataRange = sheet.getRange(2, 1, lastRow - 1, Math.max(lastCol, opHeaders.length + 1));
      const values = dataRange.getValues();
      let modified = false;

      values.forEach(row => {
        // If col 29 (Foto_URL index 29) is empty, col 30 has drive url, and col 34 has 'Belum Terverifikasi'
        const colFoto1 = String(row[29] || '');
        const colFoto2 = String(row[30] || '');
        const colStatus34 = String(row[34] || '').toLowerCase();
        if (!colFoto1 && (colFoto2.includes('drive.google.com') || colFoto2.includes('[Foto')) && (colStatus34.includes('terverifikasi') || colStatus34.includes('ditolak') || colStatus34.includes('unverified') || colStatus34.includes('unreviewed'))) {
          // Row was shifted by 1 starting at index 3 (old Kode_Kegiatan_Ref)
          // Shift indices 3..33 left by 1
          for (let c = 3; c < opHeaders.length; c++) {
            row[c] = row[c + 1] || '';
          }
          row[opHeaders.length] = ''; // clear 35th column
          modified = true;
        }
      });

      if (modified) {
        dataRange.setValues(values);
        Logger.log(`Fixed shifted data rows in sheet ${sheet.getName()}`);
      }

      // Clear extra columns beyond opHeaders.length
      if (sheet.getMaxColumns() > opHeaders.length) {
        sheet.getRange(1, opHeaders.length + 1, sheet.getMaxRows(), sheet.getMaxColumns() - opHeaders.length).clear();
      }
    }
  });

  Logger.log('Successfully repaired headers and aligned data rows for all sheets.');
}

/**
 * Phase 20 Data & Header Maintenance:
 * Clears stale test data rows and re-applies headers cleanly.
 */
function resetTestDataAndHeaders() {
  const ss = SpreadsheetRepository.getSpreadsheet();
  if (!ss) return;

  cleanupIrrelevantSpreadsheetTabs();

  let masterSheet = ss.getSheetByName(SHEET_NAMES.MASTER_LAPORAN);
  if (masterSheet) {
    masterSheet.clearContents();
    const opHeaders = OPERATIONAL_REPORT_FIELDS.map(f => f.header);
    applyHeaderStyle(masterSheet, opHeaders);
  }
  Logger.log('Reset test data and re-applied Master_Laporan headers successfully.');
}

/**
 * Sets up Master_Karyawan sheet tab if explicitly requested.
 * @param {Spreadsheet} ss
 */
function setupMasterKaryawanSheet(ss) {
  if (!ss) return;
  let sheet = ss.getSheetByName('Master_Karyawan');
  if (!sheet) {
    sheet = ss.insertSheet('Master_Karyawan');
  }
  const headers = ['ID_Karyawan', 'Nama_Karyawan', 'Divisi', 'Status'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e2e8f0');
  sheet.setFrozenRows(1);

  if (sheet.getLastRow() <= 1 && typeof EMPLOYEE_REGISTRY !== 'undefined') {
    const rows = EMPLOYEE_REGISTRY.map(e => [e.id, e.name, e.division, 'Aktif']);
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    Logger.log(`Populated Master_Karyawan with ${rows.length} employee records.`);
  }
}

/**
 * Diagnostic helper to test admin queue query from Apps Script Editor.
 */
function testAdminQueue() {
  const queue = AdminService.getAdminQueueData();
  Logger.log('Admin Queue Count: ' + (queue ? queue.length : 0));
  Logger.log('First 2 Items: ' + JSON.stringify((queue || []).slice(0, 2)));
  return queue;
}

/**
 * Authorizes Google Drive API permissions for the Apps Script project container.
 */
function authorizeDriveScope() {
  const root = DriveApp.getRootFolder();
  Logger.log('DriveApp scope authorized successfully. Root folder: ' + root.getName());
  const folderName = 'MPL_Dokumentasi_Foto';
  const iter = DriveApp.getFoldersByName(folderName);
  let rootFolder = null;
  if (iter.hasNext()) {
    rootFolder = iter.next();
  } else {
    rootFolder = DriveApp.createFolder(folderName);
  }
  if (rootFolder) {
    ConfigRepository.setProperty('DRIVE_PHOTO_FOLDER_ID', rootFolder.getId());
  }

  // Automatically purge legacy "Reporting System Photos" folder if found
  try {
    const legacyIter = DriveApp.getFoldersByName('Reporting System Photos');
    while (legacyIter.hasNext()) {
      const f = legacyIter.next();
      f.setTrashed(true);
      Logger.log('Purged legacy "Reporting System Photos" folder.');
    }
  } catch (e) {}

  return rootFolder ? rootFolder.getName() : root.getName();
}

/**
 * Diagnostic helper to test dashboard stats calculation from Apps Script Editor.
 */
function testDashboardStats() {
  const stats = AdminService.getDashboardStats({ period: 'this_month' });
  Logger.log('Dashboard Stats Result: ' + JSON.stringify(stats));
  return stats;
}

/**
 * Creates and configures the Unified Operational Form (Matching Latest Google Form Configuration)
 * Eliminates manual Nama & Divisi inputs in favor of ID Karyawan.
 */
function setupOperationalForm(ssId) {
  const form = FormApp.create('Laporan Harian MPL');
  form.setDescription('Formulir harian operasional kegiatan beserta panen dan penjualan.');
  try { form.setCollectEmail(false); } catch (e) {}
  try { form.setRequireLogin(false); } catch (e) {}

  // Page 1: Identitas & Informasi Utama
  form.addTextItem()
    .setTitle('ID Karyawan')
    .setHelpText('Masukkan ID karyawan Anda')
    .setRequired(true);

  form.addTextItem()
    .setTitle('Nomor Telepon')
    .setHelpText('Nomor telepon aktif PIC pelapor')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Lokasi Kegiatan')
    .setChoiceValues(['Jonggol', 'Cikalong', 'Quilling', 'Jakarta'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Kegiatan yang Dilakukan')
    .setChoiceValues(['Agro', 'Ternak', 'Office', 'Pengawasan'])
    .setRequired(true);

  // Page 2: Kegiatan Tanam / Tebar
  form.addPageBreakItem().setTitle('Kegiatan Tanam / Tebar');
  form.addMultipleChoiceItem()
    .setTitle('Status Pengelolaan')
    .setChoiceValues(['Swakelola', 'Petani binaan', 'Kemitraan'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Komoditas')
    .setChoiceValues(['Alpukat', 'Pisang', 'Jagung Manis', 'Terong', 'Cabe', 'Jagung Tebon', 'Jagung Hibrida', 'Edamame', 'Pembibitan Kopi', 'Pembibitan Pala'])
    .setRequired(true);

  form.addTextItem().setTitle('Lokasi / Blok').setHelpText('Contoh: Blok A1').setRequired(true);
  form.addTextItem().setTitle('Luas Lahan (m²)').setRequired(true);
  form.addTextItem().setTitle('Jumlah Benih yang Digunakan').setRequired(true);
  form.addDateItem().setTitle('Tanggal Tanam / Tebar').setRequired(true);
  form.addTextItem().setTitle('Estimasi Panen (Hari Setelah Tanam / HST)').setRequired(true);

  // Page 3: Kegiatan Panen & Penjualan Agro
  form.addPageBreakItem().setTitle('Kegiatan Panen & Penjualan Agro');
  form.addMultipleChoiceItem()
    .setTitle('Status Pengelolaan')
    .setChoiceValues(['Swakelola', 'Petani binaan', 'Kemitraan'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Komoditas')
    .setChoiceValues(['Alpukat', 'Pisang', 'Jagung Manis', 'Terong', 'Cabe', 'Jagung Tebon', 'Jagung Hibrida', 'Edamame', 'Pembibitan Kopi', 'Pembibitan Pala'])
    .setRequired(true);

  form.addTextItem().setTitle('Lokasi / Blok').setHelpText('Contoh: Blok A1').setRequired(true);
  form.addTextItem().setTitle('Luas Lahan (m²)').setRequired(true);
  form.addDateItem().setTitle('Tanggal Panen').setRequired(true);
  form.addTextItem().setTitle('Jumlah Panen (kg)').setRequired(true);
  form.addDateItem().setTitle('Tanggal Penjualan').setRequired(true);
  form.addCheckboxItem()
    .setTitle('Tujuan Distribusi')
    .setChoiceValues(['Penjualan', 'Penggunaan Internal']);

  // Page 4: Detail Penjualan Agro
  form.addSectionHeaderItem().setTitle('Detail Penjualan Agro');
  form.addTextItem().setTitle('Jumlah Penjualan Unit');
  form.addTextItem().setTitle('Harga Satuan (Rp)');
  form.addTextItem().setTitle('Total Harga');
  form.addTextItem().setTitle('Nama Pembeli');
  form.addTextItem().setTitle('No Telepon Pembeli');
  form.addTextItem().setTitle('Alamat Pembeli');

  // Page 5: Detail Penggunaan Internal
  form.addSectionHeaderItem().setTitle('Detail Penggunaan Internal');
  form.addTextItem().setTitle('Jumlah Unit Penggunaan');
  form.addCheckboxItem()
    .setTitle('Tujuan Penggunaan')
    .setChoiceValues(['MPL Jonggol', 'MPL Cikalong', 'Villa Quiling', 'Pasir Putih']);

  // Page 6: Kegiatan Peternakan
  form.addPageBreakItem().setTitle('Kegiatan Peternakan');
  form.addMultipleChoiceItem()
    .setTitle('Jenis Ternak')
    .setChoiceValues(['Sapi', 'Kambing', 'Domba', 'Ayam Broiler', 'Ayam KUB', 'Ayam KUB Petelur']);
  form.addTextItem().setTitle('Ternak Masuk - Kelahiran (Ekor)').setHelpText('Kosongkan/isi 0 jika tidak ada');
  form.addTextItem().setTitle('Ternak Masuk - Pembelian (Ekor)').setHelpText('Kosongkan/isi 0 jika tidak ada');
  form.addTextItem().setTitle('Ternak Keluar - Kematian (Ekor)').setHelpText('Kosongkan/isi 0 jika tidak ada');
  form.addTextItem().setTitle('Ternak Keluar - Penjualan (Ekor)').setHelpText('Kosongkan/isi 0 jika tidak ada');
  form.addTextItem().setTitle('Populasi Ternak Saat Ini (Ekor)');
  form.addTextItem().setTitle('Pakan Masuk (Kg)');
  form.addTextItem().setTitle('Pakan Keluar (Kg)');
  form.addMultipleChoiceItem()
    .setTitle('Jenis Komoditas Ternak')
    .setChoiceValues(['Daging Sapi', 'Susu Sapi', 'Kambing Hidup', 'Domba Hidup', 'Ayam Hidup', 'Telur Ayam', 'Karkas Ayam', 'Pupuk Kandang / Kohe', 'Lainnya']);
  form.addTextItem().setTitle('Jumlah Penjualan Ternak');
  form.addTextItem().setTitle('Harga Satuan Ternak (Rp)');
  form.addTextItem().setTitle('Total Harga Ternak (Rp)');

  // Page 7: Kegiatan Pengawasan
  form.addPageBreakItem().setTitle('Kegiatan Pengawasan');
  form.addMultipleChoiceItem()
    .setTitle('Tindakan Pengawasan')
    .setChoiceValues(['Komoditas pertanian / perkebunan', 'Komoditas peternakan', 'Petani binaan'])
    .setRequired(true);
  form.addParagraphTextItem()
    .setTitle('Detail Pengawasan')
    .setRequired(true);

  // Page 8: Kendala & Catatan Pelaporan
  form.addPageBreakItem().setTitle('Kendala & Catatan Pelaporan');
  form.addParagraphTextItem().setTitle('Capaian Kegiatan');
  form.addParagraphTextItem().setTitle('Kendala Kegiatan (jika ada)');
  form.addParagraphTextItem().setTitle('Upaya Yang Dilakukan (jika ada)');

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ssId);
  Logger.log('Operational Form Published URL: ' + form.getPublishedUrl());
  return form.getId();
}

/**
 * Updates an already-existing Google Form to the latest design/questions without losing responses.
 * Run this function from Apps Script Editor or Admin Workspace.
 */
function syncLiveGoogleFormItems() {
  const formId = ConfigRepository.getMainFormId();
  if (!formId) {
    Logger.log('No MAIN_FORM_ID configured in Script Properties.');
    return { success: false, message: 'MAIN_FORM_ID belum terdaftar di Script Properties.' };
  }
  
  const form = FormApp.openById(formId);
  Logger.log('Syncing Google Form: ' + form.getTitle() + ' (' + formId + ')');

  // Loop through items and update titles/options
  const items = form.getItems();
  items.forEach(item => {
    const title = item.getTitle();
    // 1. Update Komoditas items
    if (title === 'Komoditas') {
      try {
        const mc = item.asMultipleChoiceItem();
        mc.setChoiceValues(['Alpukat', 'Pisang', 'Jagung Manis', 'Terong', 'Cabe', 'Jagung Tebon', 'Jagung Hibrida', 'Edamame', 'Pembibitan Kopi', 'Pembibitan Pala']);
      } catch (e) {}
    }
    // 2. Update Pengawasan title
    if (title === 'Pengawasan' || title === 'Kategori Pengawasan') {
      item.setTitle('Tindakan Pengawasan');
    }
    // 3. Update Nomor Telepon title
    if (title === 'Nomor Telepon / WhatsApp') {
      item.setTitle('Nomor Telepon');
      try { item.setHelpText('Nomor telepon aktif PIC pelapor'); } catch (e) {}
    }
  });

  // Check if 'Nomor Telepon' item exists, if not insert it right after ID Karyawan
  const hasPhone = items.some(it => it.getTitle() === 'Nomor Telepon');
  if (!hasPhone) {
    let idIndex = items.findIndex(it => it.getTitle() === 'ID Karyawan');
    const phoneItem = form.addTextItem();
    phoneItem.setTitle('Nomor Telepon')
      .setHelpText('Nomor telepon aktif PIC pelapor')
      .setRequired(true);
    if (idIndex >= 0) {
      try { form.moveItem(phoneItem.getIndex(), idIndex + 1); } catch (e) {}
    }
  }

  Logger.log('Google Form synced successfully: ' + form.getPublishedUrl());
  return { success: true, url: form.getPublishedUrl() };
}

/**
 * Maintenance & Optimization Function:
 * Omits irrelevant and duplicate tabs from the central spreadsheet.
 * Retains permanent Master_Laporan and active daily tabs (Laporan_YYYY-MM-DD).
 * Strictly deletes legacy duplicates: Form Responses, Laporan Operasional, Sensitive, Admin_Queue, Photo_Log, Master_Karyawan, Sheet1.
 * @param {string} [targetSsId]
 * @returns {{ success: boolean, deletedTabs: Array<string>, keptTabs: Array<string> }}
 */
function cleanupIrrelevantSpreadsheetTabs(targetSsId) {
  const ssId = targetSsId || ConfigRepository.getSpreadsheetId() || '1kzJI_6Er-DI1Ty7Kc6sEkl6STK0fTih4RcHh8HJf0dI';
  let ss;
  try {
    ss = SpreadsheetApp.openById(ssId);
  } catch (e) {
    Logger.log('Spreadsheet unavailable: ' + e.toString());
    return { success: false, message: 'Spreadsheet tidak ditemukan: ' + e.toString() };
  }

  // 1. Ensure Master_Laporan exists as anchor and has high-contrast headers
  const opHeaders = OPERATIONAL_REPORT_FIELDS.map(f => f.header);
  let masterSheet = ss.getSheetByName('Master_Laporan');
  if (!masterSheet) {
    masterSheet = ss.insertSheet('Master_Laporan', 0);
    applyHeaderStyle(masterSheet, opHeaders);
  } else if (masterSheet.getLastRow() === 0) {
    applyHeaderStyle(masterSheet, opHeaders);
  } else {
    // Re-apply style to header row 1 to guarantee high contrast
    applyHeaderStyle(masterSheet, opHeaders);
  }

  const allSheets = ss.getSheets();
  const deletedTabs = [];
  const keptTabs = [];

  const irrelevantNames = new Set([
    'admin_queue',
    'laporan_operasional_raw',
    'laporan operasional',
    'sensitive',
    'photo_log',
    'master_karyawan',
    'form responses 2',
    'form responses 1',
    'form responses 3',
    'jawaban formulir 1',
    'jawaban formulir 2',
    'jawaban formulir 3',
    'sheet1',
    'sheet 1'
  ]);

  allSheets.forEach(sheet => {
    const sheetName = sheet.getName();
    const cleanName = sheetName.toLowerCase().trim();

    // 1. Always keep Master_Laporan and active daily report tabs (Laporan_YYYY-MM-DD)
    if (cleanName === 'master_laporan' || /^laporan_\d{4}-\d{2}-\d{2}$/i.test(sheetName)) {
      keptTabs.push(sheetName);
      return;
    }

    // 2. If tab matches irrelevant/stale patterns, delete it safely
    const isIrrelevant = irrelevantNames.has(cleanName) || 
                         cleanName.includes('form responses') || 
                         cleanName.includes('jawaban formulir') || 
                         cleanName === 'laporan operasional' ||
                         cleanName === 'sensitive';

    if (isIrrelevant) {
      try {
        if (ss.getSheets().length > 1) {
          ss.deleteSheet(sheet);
          deletedTabs.push(sheetName);
          Logger.log(`SpreadsheetRepository: Deleted irrelevant sheet tab '${sheetName}'.`);
        }
      } catch (e) {
        Logger.log(`SpreadsheetRepository Error deleting '${sheetName}': ${e.toString()}`);
      }
    } else {
      keptTabs.push(sheetName);
    }
  });

  Logger.log(`Cleanup completed. Deleted (${deletedTabs.length}): ${deletedTabs.join(', ')} | Kept (${keptTabs.length}): ${keptTabs.join(', ')}`);
  return {
    success: true,
    deletedTabs: deletedTabs,
    keptTabs: keptTabs
  };
}

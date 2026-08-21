/**
 * Setup.gs — System Provisioning and Initialization
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: PROVISIONING / INITIALIZATION
 * Responsibility: Run-once provisioning script for generating spreadsheets, forms, and script properties.
 */

const SHEET_NAMES = Object.freeze({
  OPERATIONAL_RAW: 'Laporan_Operasional_Raw',
  ADMIN_QUEUE: 'Admin_Queue',
  ARCHIVE_REPORTS: 'Archive_Reports'
});

/**
 * Main provisioning function. Run once manually from Apps Script editor or clasp run.
 * Creates Spreadsheet, Tabs, Operational Form, sets headers, and stores Script Properties.
 */
function setupReportingSystem() {
  Logger.log('Starting system provisioning...');

  // Clear legacy script properties (DAILY_FORM_ID, GENERAL_FORM_ID, REGISTERED_FORMS_JSON)
  try {
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty('DAILY_FORM_ID');
    props.deleteProperty('GENERAL_FORM_ID');
    props.deleteProperty('REGISTERED_FORMS_JSON');
    Logger.log('Purged legacy script properties.');
  } catch (e) {}
  
  // 1. Create Central Spreadsheet
  const ss = SpreadsheetApp.create('Sistem Pelaporan Digital Operasional');
  const ssId = ss.getId();
  Logger.log('Created Spreadsheet ID: ' + ssId);

  // 2. Create Google Form & Link Destination
  const mainFormId = setupOperationalForm(ssId);

  // 3. Locate response sheet and rename to Laporan_Operasional_Raw
  Utilities.sleep(1000); // Allow Apps Script destination binding to finish
  const sheets = ss.getSheets();
  
  let mainSheet = sheets.find(s => s.getName().includes('Form Responses 1') || s.getName().includes('Jawaban Formulir 1'));
  if (!mainSheet) mainSheet = sheets[0];
  mainSheet.setName(SHEET_NAMES.OPERATIONAL_RAW);

  const adminQueueSheet = ss.getSheetByName(SHEET_NAMES.ADMIN_QUEUE) || ss.insertSheet(SHEET_NAMES.ADMIN_QUEUE);

  // Remove default "Sheet1" if present
  const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Lembur1') || ss.getSheetByName('Sheet 1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  // 4. Define and Set Headers via SpreadsheetRepository
  setupSheetHeaders(mainSheet, adminQueueSheet);

  // 5. Store Properties via ConfigRepository
  ConfigRepository.setProperties({
    'SPREADSHEET_ID': ssId,
    'MAIN_FORM_ID': mainFormId,
    'ADMIN_EMAIL': ConfigRepository.PLACEHOLDER_ADMIN,
    'MANAGER_EMAIL': ConfigRepository.PLACEHOLDER_MANAGER
  });

  Logger.log('=== PROVISIONING COMPLETE ===');
  Logger.log('Spreadsheet URL: ' + ss.getUrl());
  Logger.log('Action Required: Please update ADMIN_EMAIL and MANAGER_EMAIL in Script Properties if needed.');
}

/**
 * Configure Headers and Formulas for all Tabs
 */
function setupSheetHeaders(mainSheet, adminQueueSheet) {
  SpreadsheetRepository.setupSheetHeaders(mainSheet, adminQueueSheet);
}

/**
 * Maintenance helper: Re-synchronizes headers and fixes mismatched rows in active central spreadsheet.
 */
function repairSpreadsheetHeadersAndData() {
  Logger.log('Starting spreadsheet header repair...');
  const ss = SpreadsheetRepository.getSpreadsheet();
  if (!ss) {
    Logger.log('Spreadsheet unavailable.');
    return;
  }

  const forms = FormManagementService.getFormList();
  const opForm = forms.find(f => (f.type || '').toLowerCase() === 'operasional' || f.isDefaultMain || f.isDefault) || { title: 'Laporan Operasional' };
  const mainSheet = FormManagementService.resolveFormTab_(ss, opForm);
  const adminQueueSheet = ss.getSheetByName(SHEET_NAMES.ADMIN_QUEUE) || ss.insertSheet(SHEET_NAMES.ADMIN_QUEUE);
  let photoLogSheet = ss.getSheetByName('Photo_Log');
  if (!photoLogSheet) {
    photoLogSheet = ss.insertSheet('Photo_Log');
  }

  SpreadsheetRepository.setupSheetHeaders(mainSheet, adminQueueSheet, photoLogSheet);
  Logger.log('Successfully repaired headers for ' + mainSheet.getName());
}

/**
 * Creates and configures the Unified Operational Form (Kegiatan, Panen & Penjualan)
 */
function setupOperationalForm(ssId) {
  const form = FormApp.create('Laporan Harian MPL');
  form.setDescription('Formulir harian operasional kegiatan beserta panen dan penjualan.');
  try { form.setCollectEmail(false); } catch (e) {}
  try { form.setRequireLogin(false); } catch (e) {}

  // Page 1: Informasi Utama & Kegiatan
  form.addTextItem()
    .setTitle('Nama')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Divisi')
    .setChoiceValues(['Agro', 'Ternak', 'Ikan', 'Lainnya'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Lokasi Kegiatan')
    .setChoiceValues(['Sektor 1 + Ciomas', 'Sektor 2', 'Sektor 3', 'Sektor 4', 'Gunung Batu'])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Kegiatan yang Dilakukan')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Kegiatan tambahan')
    .setChoiceValues(['Tanam atau Tebar', 'Panen atau Penjualan']);

  form.addMultipleChoiceItem()
    .setTitle('Pengawasan')
    .setChoiceValues(['Komoditas pertanian / perkebunan', 'Komoditas peternakan', 'Petani binaan']);

  // Page 2: Kegiatan Tanam / Tebar
  form.addPageBreakItem().setTitle('Kegiatan Tanam / Tebar');
  form.addMultipleChoiceItem()
    .setTitle('Status Pengelolaan')
    .setChoiceValues(['Swakelola', 'Petani binaan', 'Kemitraan']);

  form.addMultipleChoiceItem()
    .setTitle('Komoditas')
    .setChoiceValues(['Pisang', 'Jagung Manis', 'Terong', 'Cabe', 'Jagung Tebon', 'Jagung Hibrida', 'Edamame', 'Penyemaian']);

  form.addTextItem().setTitle('Luas Lahan (m²)');
  form.addTextItem().setTitle('Jumlah Benih yang Digunakan');
  form.addDateItem().setTitle('Tanggal Tanam / Tebar');
  form.addTextItem().setTitle('Estimasi Panen (Hari Setelah Tanam / HST)');

  // Page 3: Kegiatan Panen & Penjualan
  form.addPageBreakItem().setTitle('Kegiatan Panen & Penjualan');
  form.addMultipleChoiceItem()
    .setTitle('Status Pengelolaan')
    .setChoiceValues(['Swakelola', 'Petani binaan', 'Kemitraan']);

  form.addMultipleChoiceItem()
    .setTitle('Komoditas')
    .setChoiceValues(['Pisang', 'Jagung Manis', 'Terong', 'Cabe', 'Jagung Tebon', 'Jagung Hibrida', 'Edamame', 'Penyemaian']);

  form.addTextItem().setTitle('Luas Lahan (m²)');
  form.addDateItem().setTitle('Tanggal Panen');
  form.addTextItem().setTitle('Jumlah Panen (kg)');
  form.addDateItem().setTitle('Tanggal Penjualan');
  form.addMultipleChoiceItem()
    .setTitle('Tujuan Distribusi')
    .setChoiceValues(['Penjualan eksternal', 'Penjualan internal', 'Penggunaan']);

  // Page 4: Detail Penjualan
  form.addSectionHeaderItem().setTitle('Detail Penjualan');
  form.addTextItem().setTitle('Jumlah Penjualan Unit');
  form.addTextItem().setTitle('Harga Satuan (Rp)');
  form.addTextItem().setTitle('Total Harga');

  // Page 5: Detail Penggunaan
  form.addSectionHeaderItem().setTitle('Detail Penggunaan');
  form.addTextItem().setTitle('Jumlah Unit Penggunaan');
  form.addCheckboxItem()
    .setTitle('Tujuan Penggunaan')
    .setChoiceValues(['MPL Jonggol', 'MPL Cikalong', 'Villa Quiling', 'Pasir Putih']);

  // Page 6: Kendala & Catatan Pelaporan
  form.addSectionHeaderItem().setTitle('Kendala & Catatan Pelaporan');
  form.addParagraphTextItem().setTitle('Capaian Kegiatan');
  form.addParagraphTextItem().setTitle('Kendala Kegiatan (jika ada)');
  form.addParagraphTextItem().setTitle('Upaya Yang Dilakukan (jika ada)');

  form.addSectionHeaderItem()
    .setTitle('Catatan Bukti Foto')
    .setHelpText('Untuk melampirkan foto bukti kegiatan, gunakan Formulir Web App.');

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ssId);
  Logger.log('Operational Form Published URL: ' + form.getPublishedUrl());
  return form.getId();
}

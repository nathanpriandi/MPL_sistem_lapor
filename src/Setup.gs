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
 * Creates and configures the Unified Operational Form (Kegiatan, Panen & Penjualan)
 */
function setupOperationalForm(ssId) {
  const form = FormApp.create('Laporan Operasional (Kegiatan, Panen & Penjualan)');
  form.setDescription('Formulir harian operasional pertanian, peternakan, perikanan, panen, dan penjualan.');
  try { form.setCollectEmail(false); } catch (e) {}
  try { form.setRequireLogin(false); } catch (e) {}

  form.addTextItem()
    .setTitle('Nama PIC Lokasi')
    .setHelpText('Masukkan nama penanggung jawab lokasi / pelapor')
    .setRequired(true);

  const pageAgro = form.addPageBreakItem().setTitle('Detail Kegiatan Agro');
  const pageTernakIkan = form.addPageBreakItem().setTitle('Detail Kegiatan Ternak/Ikan');
  const pageLanjutan = form.addPageBreakItem().setTitle('Estimasi & Data Panen/Penjualan Opsional');

  const divisiItem = form.addMultipleChoiceItem().setTitle('Bidang/Divisi').setRequired(true);
  divisiItem.setChoices([
    divisiItem.createChoice('Agro (Pertanian/Perkebunan)', pageAgro),
    divisiItem.createChoice('Ternak (Peternakan)', pageTernakIkan),
    divisiItem.createChoice('Ikan (Perikanan)', pageTernakIkan)
  ]);

  form.addTextItem()
    .setTitle('Lokasi Kegiatan')
    .setRequired(true);

  form.addTextItem()
    .setTitle('Jenis Kegiatan')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Target Kegiatan')
    .setRequired(true);

  form.addTextItem()
    .setTitle('Luas Area Kegiatan (Ha)')
    .setValidation(FormApp.createTextValidation().requireNumber().build());

  form.addTextItem()
    .setTitle('Jumlah Populasi Tanaman/Bibit/Ternak')
    .setValidation(FormApp.createTextValidation().requireNumber().build());

  // Page Agro branch
  pageAgro.setGoToPage(pageLanjutan);
  form.addDateItem().setTitle('Jadwal/Tgl Tanam').setRequired(true);

  // Page Ternak/Ikan branch
  pageTernakIkan.setGoToPage(pageLanjutan);
  form.addDateItem().setTitle('Jadwal/Tgl Check in/Tebar').setRequired(true);

  // Page Lanjutan - common estimation & optional harvest/sales fields
  form.addDateItem().setTitle('Jadwal/Perkiraan Panen Tgl').setRequired(true);
  
  // Optional Panen & Penjualan fields
  form.addTextItem().setTitle('Kode Kegiatan Referensi (jika laporan lanjutan)');
  form.addDateItem().setTitle('Tgl Panen (Opsional)');
  form.addTextItem()
    .setTitle('Jumlah Panen (Opsional)')
    .setValidation(FormApp.createTextValidation().requireNumber().build());
  form.addDateItem().setTitle('Tgl Penjualan (Opsional)');
  form.addTextItem()
    .setTitle('Harga Jual (Opsional)')
    .setValidation(FormApp.createTextValidation().requireNumber().build());
  form.addTextItem()
    .setTitle('Jumlah Penjualan Unit (Opsional)')
    .setValidation(FormApp.createTextValidation().requireNumber().build());
  form.addTextItem()
    .setTitle('Nilai Penjualan Rp (Opsional)')
    .setValidation(FormApp.createTextValidation().requireNumber().build());

  // Optional Kendala & Upaya
  form.addParagraphTextItem().setTitle('Kendala Kegiatan (jika ada)');
  form.addParagraphTextItem().setTitle('Upaya Yang Dilakukan (jika ada)');

  form.addSectionHeaderItem()
    .setTitle('Catatan Bukti Foto')
    .setHelpText('Untuk melampirkan foto bukti kegiatan (Wajib), gunakan Formulir Web App.');

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ssId);
  Logger.log('Operational Form Published URL: ' + form.getPublishedUrl());
  return form.getId();
}

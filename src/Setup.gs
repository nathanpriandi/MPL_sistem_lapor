/**
 * Setup.gs — System Provisioning and Initialization
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: PROVISIONING / INITIALIZATION
 * Responsibility: Run-once provisioning script for generating spreadsheets, forms, and script properties.
 */

/**
 * Main provisioning function. Run once manually from Apps Script editor or clasp run.
 * Creates Spreadsheet, Tabs, Daily Form, General Form, sets headers, and stores Script Properties.
 */
function setupReportingSystem() {
  Logger.log('Starting system provisioning...');
  
  // 1. Create Central Spreadsheet
  const ss = SpreadsheetApp.create('Sistem Pelaporan Digital Operasional');
  const ssId = ss.getId();
  Logger.log('Created Spreadsheet ID: ' + ssId);

  // 2. Create Google Forms & Link Destination (creates Form Responses 1 & 2)
  const dailyFormId = setupDailyForm(ssId);
  const generalFormId = setupGeneralForm(ssId);

  // 3. Locate response sheets and rename to Daily_Raw and General_Raw
  Utilities.sleep(1000); // Allow Apps Script destination binding to finish
  const sheets = ss.getSheets();
  
  let dailySheet = sheets.find(s => s.getName().includes('Form Responses 1') || s.getName().includes('Jawaban Formulir 1'));
  if (!dailySheet) dailySheet = sheets[0];
  dailySheet.setName(SHEET_NAMES.DAILY_RAW);

  let generalSheet = sheets.find(s => s.getName().includes('Form Responses 2') || s.getName().includes('Jawaban Formulir 2'));
  if (!generalSheet) generalSheet = ss.insertSheet(SHEET_NAMES.GENERAL_RAW);
  else generalSheet.setName(SHEET_NAMES.GENERAL_RAW);

  const adminQueueSheet = ss.getSheetByName(SHEET_NAMES.ADMIN_QUEUE) || ss.insertSheet(SHEET_NAMES.ADMIN_QUEUE);
  const sensitiveSheet = ss.getSheetByName(SHEET_NAMES.SENSITIVE_RESTRICTED) || ss.insertSheet(SHEET_NAMES.SENSITIVE_RESTRICTED);
  const summarySheet = ss.getSheetByName(SHEET_NAMES.WEEKLY_SUMMARY) || ss.insertSheet(SHEET_NAMES.WEEKLY_SUMMARY);

  // Remove default "Sheet1" if present
  const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Lembur1') || ss.getSheetByName('Sheet 1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  // 4. Define and Set Headers via SpreadsheetRepository
  setupSheetHeaders(dailySheet, generalSheet, adminQueueSheet, sensitiveSheet, summarySheet);

  // 5. Store Properties via ConfigRepository
  ConfigRepository.setProperties({
    'SPREADSHEET_ID': ssId,
    'DAILY_FORM_ID': dailyFormId,
    'GENERAL_FORM_ID': generalFormId,
    'ADMIN_EMAIL': ConfigRepository.PLACEHOLDER_ADMIN,
    'MANAGER_EMAIL': ConfigRepository.PLACEHOLDER_MANAGER
  });

  Logger.log('=== PROVISIONING COMPLETE ===');
  Logger.log('Spreadsheet URL: ' + ss.getUrl());
  Logger.log('Action Required: Please update ADMIN_EMAIL and MANAGER_EMAIL in Script Properties if needed.');
}

/**
 * Configure Headers and Formulas for all 5 Tabs
 */
function setupSheetHeaders(dailySheet, generalSheet, adminQueueSheet, sensitiveSheet, summarySheet) {
  SpreadsheetRepository.setupSheetHeaders(dailySheet, generalSheet, adminQueueSheet, sensitiveSheet, summarySheet);
}

/**
 * Creates and configures the Daily Report Form
 */
function setupDailyForm(ssId) {
  const form = FormApp.create('Laporan Operasional Harian (Daily Operational Report)');
  form.setDescription('Isi laporan harian aktivitas operasional pertanian, peternakan, dan pabrik.');
  try { form.setCollectEmail(false); } catch (e) {}
  try { form.setRequireLogin(false); } catch (e) {}

  form.addTextItem()
    .setTitle('Kode Karyawan / Employee ID')
    .setHelpText('Masukkan kode karyawan Anda (contoh: EMP-102)')
    .setRequired(true);

  form.addListItem()
    .setTitle('Lokasi / Site')
    .setChoiceValues([
      'Site A — Kebun & Lahan Pertanian', 
      'Site B — Peternakan & Kandang', 
      'Site C — Pabrik Pengolahan & Pakan', 
      'Site D — Logistik & Gudang'
    ])
    .setRequired(true);

  form.addDateItem()
    .setTitle('Tanggal Laporan / Date')
    .setRequired(true);

  form.addListItem()
    .setTitle('Status Tugas / Task Status')
    .setChoiceValues(['Completed', 'In Progress', 'Delayed'])
    .setRequired(true);

  form.addTextItem()
    .setTitle('Hasil Panen / Yield (kg)')
    .setHelpText('Isi angka total hasil panen/produksi dalam kg (jika ada)');

  form.addCheckboxItem()
    .setTitle('Ada Masalah? / Issues')
    .setChoiceValues(['Equipment', 'Weather', 'Shortage', 'None']);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ssId);
  Logger.log('Daily Form Published URL: ' + form.getPublishedUrl());
  return form.getId();
}

/**
 * Creates and configures the General Report Form
 */
function setupGeneralForm(ssId) {
  const form = FormApp.create('Laporan Umum & Catatan Lapangan (General Report)');
  form.setDescription('Laporan kejadian umum, kondisi lapangan, atau insiden.');
  try { form.setCollectEmail(false); } catch (e) {}
  try { form.setRequireLogin(false); } catch (e) {}

  form.addTextItem()
    .setTitle('Kode Karyawan / Employee ID')
    .setHelpText('Masukkan kode karyawan Anda (contoh: EMP-102)')
    .setRequired(true);

  form.addListItem()
    .setTitle('Lokasi / Site')
    .setChoiceValues([
      'Site A — Kebun & Lahan Pertanian', 
      'Site B — Peternakan & Kandang', 
      'Site C — Pabrik Pengolahan & Pakan', 
      'Site D — Logistik & Gudang'
    ])
    .setRequired(true);

  form.addDateItem()
    .setTitle('Tanggal Laporan / Date')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Rincian Laporan / Details')
    .setHelpText('Jelaskan aktivitas, kendala, atau kronologi secara detail.')
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('Informasi Sensitif? / Sensitive Information')
    .setChoiceValues(['Ya / Yes (Laporan ini berisi data sensitif/privat)']);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ssId);
  Logger.log('General Form Published URL: ' + form.getPublishedUrl());
  return form.getId();
}

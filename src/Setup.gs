/**
 * Setup.gs — System Provisioning and Initialization
 * Digital Reporting System for Integrated Agriculture Company
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

  // 2. Setup Tabs
  const dailySheet = ss.getSheets()[0];
  dailySheet.setName('Daily_Raw');
  
  const generalSheet = ss.insertSheet('General_Raw');
  const adminQueueSheet = ss.insertSheet('Admin_Queue');
  const sensitiveSheet = ss.insertSheet('Sensitive_Restricted');
  const summarySheet = ss.insertSheet('Weekly_Summary');

  // 3. Define and Set Headers
  setupSheetHeaders(dailySheet, generalSheet, adminQueueSheet, sensitiveSheet, summarySheet);

  // 4. Create Google Forms & Link Destination
  const dailyFormId = setupDailyForm(ssId);
  const generalFormId = setupGeneralForm(ssId);

  // 5. Store Properties in ScriptProperties
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    'SPREADSHEET_ID': ssId,
    'DAILY_FORM_ID': dailyFormId,
    'GENERAL_FORM_ID': generalFormId,
    'ADMIN_EMAIL': 'admin.operasional@perusahaan-agri.co.id',
    'MANAGER_EMAIL': 'manager.operasional@perusahaan-agri.co.id'
  });

  Logger.log('=== PROVISIONING COMPLETE ===');
  Logger.log('Spreadsheet URL: ' + ss.getUrl());
  Logger.log('Action Required: Please update ADMIN_EMAIL and MANAGER_EMAIL in Script Properties if needed.');
}

/**
 * Configure Headers and Formulas for all 5 Tabs
 */
function setupSheetHeaders(dailySheet, generalSheet, adminQueueSheet, sensitiveSheet, summarySheet) {
  const dailyHeaders = [
    'Timestamp', 
    'Kode Karyawan / Employee ID', 
    'Lokasi / Site', 
    'Tanggal Laporan / Date', 
    'Status Tugas / Task Status', 
    'Hasil Panen / Yield (kg)', 
    'Ada Masalah? / Issues', 
    'Flag_Severity', 
    'Severity_Rank', 
    'Flag_Category', 
    'Review_Status'
  ];

  const generalHeaders = [
    'Timestamp', 
    'Kode Karyawan / Employee ID', 
    'Lokasi / Site', 
    'Tanggal Laporan / Date', 
    'Rincian Laporan / Details', 
    'Informasi Sensitif? / Sensitive', 
    'Flag_Severity', 
    'Severity_Rank', 
    'Flag_Category', 
    'Review_Status'
  ];

  const summaryHeaders = [
    'Tahun-Minggu (Year-Week)', 
    'Lokasi / Site', 
    'Total Daily Reports', 
    'Total General Reports', 
    'Total Urgent Flags', 
    'Total Warning Flags', 
    'Total Sensitive Reports', 
    'Total Panen / Yield (kg)', 
    'Last Updated'
  ];

  // Set Daily_Raw headers
  dailySheet.getRange(1, 1, 1, dailyHeaders.length).setValues([dailyHeaders]).setFontWeight('bold').setBackground('#e8f0fe');
  
  // Set General_Raw headers
  generalSheet.getRange(1, 1, 1, generalHeaders.length).setValues([generalHeaders]).setFontWeight('bold').setBackground('#e8f0fe');

  // Set Sensitive_Restricted headers
  sensitiveSheet.getRange(1, 1, 1, generalHeaders.length).setValues([generalHeaders]).setFontWeight('bold').setBackground('#fce8e6');

  // Set Weekly_Summary headers
  summarySheet.getRange(1, 1, 1, summaryHeaders.length).setValues([summaryHeaders]).setFontWeight('bold').setBackground('#e6f4ea');

  // Setup Admin_Queue headers & QUERY formula
  const queueHeaders = [
    'Source Sheet',
    'Timestamp', 
    'Kode Karyawan', 
    'Lokasi / Site', 
    'Tanggal', 
    'Status/Rincian', 
    'Hasil Panen (kg) / Sensitive', 
    'Issues / -', 
    'Flag_Severity', 
    'Severity_Rank', 
    'Flag_Category', 
    'Review_Status'
  ];
  adminQueueSheet.getRange(1, 1, 1, queueHeaders.length).setValues([queueHeaders]).setFontWeight('bold').setBackground('#feefc3');
  
  // QUERY formula combining unresolved Daily and General reports sorted by Severity_Rank (Col 10)
  const queryFormula = `=QUERY({
    ARRAYFORMULA(IF(LEN(Daily_Raw!A2:A), "Daily_Raw", "")), Daily_Raw!A2:K;
    ARRAYFORMULA(IF(LEN(General_Raw!A2:A), "General_Raw", "")), General_Raw!A2:E, General_Raw!F2:F, ARRAYFORMULA(IF(LEN(General_Raw!A2:A), "", "")), General_Raw!G2:J
  }, "select * where Col1 is not null and Col12 != 'Closed' order by Col10 asc, Col2 desc", 0)`;

  adminQueueSheet.getRange(2, 1).setFormula(queryFormula);
}

/**
 * Creates and configures the Daily Report Form
 */
function setupDailyForm(ssId) {
  const form = FormApp.create('Laporan Operasional Harian (Daily Operational Report)');
  form.setDescription('Isi laporan harian aktivitas operasional pertanian, peternakan, dan pabrik.');
  form.setCollectEmail(false);
  form.setRequireLogin(false);

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
  form.setCollectEmail(false);
  form.setRequireLogin(false);

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

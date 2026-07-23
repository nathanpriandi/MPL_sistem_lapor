/**
 * FormHandlers.gs — Google Form Submission Event Triggers
 * Digital Reporting System for Integrated Agriculture Company
 */

/**
 * Triggered on submission of Daily Operational Form.
 * @param {Object} e - Form submit event object.
 */
function onDailyFormSubmit(e) {
  try {
    const range = e.range;
    const sheet = range.getSheet();
    const row = range.getRow();
    const lastCol = sheet.getLastColumn();
    const rowData = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

    Logger.log('Processing Daily Form Submit at row: ' + row);

    // Evaluate flags based on content
    const flag = evaluateFlags(rowData);

    // Populate Flag_Severity (Col 8), Severity_Rank (Col 9), Flag_Category (Col 10), Review_Status (Col 11)
    sheet.getRange(row, 8).setValue(flag.severity);
    sheet.getRange(row, 9).setValue(flag.rank);
    sheet.getRange(row, 10).setValue(flag.category);
    sheet.getRange(row, 11).setValue('Unreviewed');

    // Highlight row color if urgent or warning
    applyRowHighlighting(sheet, row, flag.severity);

    // Notify Admin immediately if urgent
    if (flag.severity === 'urgent') {
      notifyAdminUrgent('Daily_Raw', row, rowData, flag);
    }
  } catch (err) {
    Logger.log('Error in onDailyFormSubmit: ' + err.toString());
  }
}

/**
 * Triggered on submission of General Report Form.
 * @param {Object} e - Form submit event object.
 */
function onGeneralFormSubmit(e) {
  try {
    const range = e.range;
    const sheet = range.getSheet();
    const row = range.getRow();
    const lastCol = sheet.getLastColumn();
    const rowData = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

    Logger.log('Processing General Form Submit at row: ' + row);

    // 1. Check for sensitive information flag
    if (isSensitiveRow(rowData)) {
      Logger.log('Sensitive flag detected. Isolating row to Sensitive_Restricted...');
      moveRowToSensitiveTab(sheet, row, rowData);
      return;
    }

    // 2. Standard report processing
    const flag = evaluateFlags(rowData);

    // Populate Flag_Severity (Col 7), Severity_Rank (Col 8), Flag_Category (Col 9), Review_Status (Col 10)
    sheet.getRange(row, 7).setValue(flag.severity);
    sheet.getRange(row, 8).setValue(flag.rank);
    sheet.getRange(row, 9).setValue(flag.category);
    sheet.getRange(row, 10).setValue('Unreviewed');

    applyRowHighlighting(sheet, row, flag.severity);

    if (flag.severity === 'urgent') {
      notifyAdminUrgent('General_Raw', row, rowData, flag);
    }
  } catch (err) {
    Logger.log('Error in onGeneralFormSubmit: ' + err.toString());
  }
}

/**
 * Moves sensitive row to Sensitive_Restricted sheet and deletes it from source sheet.
 */
function moveRowToSensitiveTab(sourceSheet, row, rowData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sensitiveSheet = ss.getSheetByName('Sensitive_Restricted');
  
  const flag = evaluateFlags(rowData);
  
  // Append row data plus flag annotations including Severity_Rank
  const sensitiveRowData = [
    rowData[0], // Timestamp
    rowData[1], // EmpID
    rowData[2], // Site
    rowData[3], // Date
    rowData[4], // Details
    rowData[5], // Sensitive Flag
    flag.severity,
    flag.rank,
    flag.category,
    'Unreviewed (Sensitive)'
  ];

  sensitiveSheet.appendRow(sensitiveRowData);
  sourceSheet.deleteRow(row);

  // Send restricted alert to Admin
  const adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  if (adminEmail) {
    MailApp.sendEmail({
      to: adminEmail,
      subject: '[SENSITIVE REPORT RECEIVED] New isolated entry in Sensitive_Restricted',
      body: `Laporan sensitif baru telah diserahkan dan dipindahkan secara otomatis ke tab Sensitive_Restricted.\n\n` +
            `Lokasi / Site: ${rowData[2]}\n` +
            `Kode Karyawan: ${rowData[1]}\n` +
            `Tanggal: ${rowData[3]}\n\n` +
            `Silakan periksa tab Sensitive_Restricted untuk rincian lengkap.`
    });
  }
}

/**
 * Applies soft background color based on severity.
 */
function applyRowHighlighting(sheet, row, severity) {
  const lastCol = sheet.getLastColumn();
  const range = sheet.getRange(row, 1, 1, lastCol);
  
  if (severity === 'urgent') {
    range.setBackground('#fce8e6'); // Light red
  } else if (severity === 'warning') {
    range.setBackground('#fef7e0'); // Light yellow
  }
}

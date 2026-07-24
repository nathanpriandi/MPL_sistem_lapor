/**
 * Ensures row has a Report_ID UUID in Col 1.
 * If row came from Google Form (where Col 1 is Timestamp), shifts data right by 1 column.
 */
function ensureReportId(sheet, row, rowData) {
  if (typeof rowData[0] === 'string' && rowData[0].length === 36 && rowData[0].includes('-')) {
    return rowData[0];
  }
  const reportId = Utilities.getUuid();
  const shiftedRowData = [reportId].concat(rowData);
  sheet.getRange(row, 1, 1, shiftedRowData.length).setValues([shiftedRowData]);
  return reportId;
}

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
    let rowData = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

    Logger.log('Processing Daily Form Submit at row: ' + row);
    ensureReportId(sheet, row, rowData);
    rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Evaluate flags based on content
    const flag = evaluateFlags(rowData);

    // Populate Flag_Severity (Col 9), Severity_Rank (Col 10), Flag_Category (Col 11), Review_Status (Col 12)
    sheet.getRange(row, 9).setValue(flag.severity);
    sheet.getRange(row, 10).setValue(flag.rank);
    sheet.getRange(row, 11).setValue(flag.category);
    sheet.getRange(row, 12).setValue('Unreviewed');

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
    let rowData = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

    Logger.log('Processing General Form Submit at row: ' + row);
    ensureReportId(sheet, row, rowData);
    rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

    // 1. Check for sensitive information flag (Col 7 / index 6)
    if (isSensitiveRow(rowData)) {
      Logger.log('Sensitive flag detected. Isolating row to Sensitive_Restricted...');
      moveRowToSensitiveTab(sheet, row, rowData);
      return;
    }

    // 2. Standard report processing
    const flag = evaluateFlags(rowData);

    // Populate Flag_Severity (Col 8), Severity_Rank (Col 9), Flag_Category (Col 10), Review_Status (Col 11)
    sheet.getRange(row, 8).setValue(flag.severity);
    sheet.getRange(row, 9).setValue(flag.rank);
    sheet.getRange(row, 10).setValue(flag.category);
    sheet.getRange(row, 11).setValue('Unreviewed');

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
  
  // Append row data plus flag annotations including Report_ID in Col 1
  const sensitiveRowData = [
    rowData[0], // Report_ID
    rowData[1], // Timestamp
    rowData[2], // EmpID
    rowData[3], // Site
    rowData[4], // Date
    rowData[5], // Details
    rowData[6], // Sensitive Flag
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
            `Report ID: ${rowData[0]}\n` +
            `Lokasi / Site: ${rowData[3]}\n` +
            `Kode Karyawan: ${rowData[2]}\n` +
            `Tanggal: ${rowData[4]}\n\n` +
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

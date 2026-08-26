/**
 * FormHandlers.gs — Google Forms Event Trigger Delivery Controller
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: DELIVERY / EVENT HANDLERS
 * Responsibility: Catches Google Form submit events and delegates processing to ReportService.
 */

/**
 * Ensures row has a Report_ID UUID in Col 1.
 * Maintains backward compatibility wrapper.
 * @param {Sheet} sheet 
 * @param {number} row 
 * @param {Array} rowData 
 * @returns {string}
 */
function ensureReportId(sheet, row, rowData) {
  return SpreadsheetRepository.ensureReportId(sheet, row, rowData);
}

/**
 * Triggered on submission of Operational Google Form.
 * @param {Object} e - Form submit event object.
 */
function onFormSubmit(e) {
  ReportService.processFormSubmit(e);
}


/**
 * Moves sensitive row to Sensitive_Restricted sheet and deletes it from source sheet.
 * Backward compatibility wrapper.
 * @param {Sheet} sourceSheet 
 * @param {number} row 
 * @param {Array} rowData 
 */
function moveRowToSensitiveTab(sourceSheet, row, rowData) {
  const info = SpreadsheetRepository.moveRowToSensitiveTab(sourceSheet, row, rowData);
  NotificationAdapter.sendSensitiveAlert(info);
}

/**
 * Applies soft background color based on severity.
 * Backward compatibility wrapper.
 * @param {Sheet} sheet 
 * @param {number} row 
 * @param {string} severity 
 */
function applyRowHighlighting(sheet, row, severity) {
  SpreadsheetRepository.applyRowHighlighting(sheet, row, severity);
}

/**
 * ReportService.gs — Application Service for Operational Report Submissions
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: APPLICATION / SERVICE
 * Responsibility: Coordinates validation, triage evaluation, persistence, and notifications.
 */

const ReportService = {
  /**
   * Submits a new Daily Operational Report from Web App.
   * @param {Object} payload - { empId, site, date, taskStatus, yieldKg, issues }
   * @returns {{ success: boolean, reportId: string }}
   */
  submitDailyReport: function(payload) {
    if (!payload || !payload.empId || !payload.site || !payload.date || !payload.taskStatus) {
      throw new Error('Missing required daily report fields.');
    }

    const report = DailyReport(payload);
    const flag = TriageEngine.evaluate([report.empId, report.site, report.date, report.taskStatus, report.yieldKg, report.issues]);
    
    const result = SpreadsheetRepository.saveDailyReport(report, flag);

    if (flag.severity === ReportSeverity.URGENT) {
      NotificationAdapter.sendUrgentAlert(SHEET_NAMES.DAILY_RAW, result.row, result.rowData, flag);
    }

    return { success: true, reportId: result.reportId };
  },

  /**
   * Submits a new General Narrative & Incident Report from Web App.
   * @param {Object} payload - { empId, site, date, details, isSensitive }
   * @returns {{ success: boolean, reportId: string, isSensitive: boolean }}
   */
  submitGeneralReport: function(payload) {
    if (!payload || !payload.empId || !payload.site || !payload.date || !payload.details) {
      throw new Error('Missing required general report fields.');
    }

    const report = GeneralReport(payload);
    const flag = TriageEngine.evaluate([report.empId, report.site, report.date, report.details]);

    if (payload.isSensitive || TriageEngine.isSensitiveRow([report.details, report.sensitiveText])) {
      report.isSensitive = true;
      const result = SpreadsheetRepository.saveSensitiveReport(report, flag);
      
      NotificationAdapter.sendSensitiveAlert({
        reportId: result.reportId,
        site: report.site,
        empId: report.empId,
        date: report.date
      });

      return { success: true, reportId: result.reportId, isSensitive: true };
    }

    const result = SpreadsheetRepository.saveGeneralReport(report, flag);

    if (flag.severity === ReportSeverity.URGENT) {
      NotificationAdapter.sendUrgentAlert(SHEET_NAMES.GENERAL_RAW, result.row, result.rowData, flag);
    }

    return { success: true, reportId: result.reportId, isSensitive: false };
  },

  /**
   * Handles Google Form submit trigger for Daily Report Form.
   * @param {Object} e - Event object.
   */
  processDailyFormSubmit: function(e) {
    try {
      const range = e.range;
      const sheet = range.getSheet();
      const row = range.getRow();
      const lastCol = sheet.getLastColumn();
      let rowData = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

      Logger.log('ReportService: Processing Daily Form Submit at row: ' + row);
      SpreadsheetRepository.ensureReportId(sheet, row, rowData);
      rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

      const flag = TriageEngine.evaluate(rowData);

      // Populate Flag_Severity (Col 9), Severity_Rank (Col 10), Flag_Category (Col 11), Review_Status (Col 12)
      sheet.getRange(row, 9).setValue(flag.severity);
      sheet.getRange(row, 10).setValue(flag.rank);
      sheet.getRange(row, 11).setValue(flag.category);
      sheet.getRange(row, 12).setValue(ReviewStatus.UNREVIEWED);

      SpreadsheetRepository.applyRowHighlighting(sheet, row, flag.severity);

      if (flag.severity === ReportSeverity.URGENT) {
        NotificationAdapter.sendUrgentAlert(SHEET_NAMES.DAILY_RAW, row, rowData, flag);
      }
    } catch (err) {
      Logger.log('ReportService Error in processDailyFormSubmit: ' + err.toString());
    }
  },

  /**
   * Handles Google Form submit trigger for General Report Form.
   * @param {Object} e - Event object.
   */
  processGeneralFormSubmit: function(e) {
    try {
      const range = e.range;
      const sheet = range.getSheet();
      const row = range.getRow();
      const lastCol = sheet.getLastColumn();
      let rowData = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

      Logger.log('ReportService: Processing General Form Submit at row: ' + row);
      SpreadsheetRepository.ensureReportId(sheet, row, rowData);
      rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

      if (TriageEngine.isSensitiveRow(rowData)) {
        Logger.log('ReportService: Sensitive flag detected. Isolating row to Sensitive_Restricted...');
        const info = SpreadsheetRepository.moveRowToSensitiveTab(sheet, row, rowData);
        NotificationAdapter.sendSensitiveAlert(info);
        return;
      }

      const flag = TriageEngine.evaluate(rowData);

      // Populate Flag_Severity (Col 8), Severity_Rank (Col 9), Flag_Category (Col 10), Review_Status (Col 11)
      sheet.getRange(row, 8).setValue(flag.severity);
      sheet.getRange(row, 9).setValue(flag.rank);
      sheet.getRange(row, 10).setValue(flag.category);
      sheet.getRange(row, 11).setValue(ReviewStatus.UNREVIEWED);

      SpreadsheetRepository.applyRowHighlighting(sheet, row, flag.severity);

      if (flag.severity === ReportSeverity.URGENT) {
        NotificationAdapter.sendUrgentAlert(SHEET_NAMES.GENERAL_RAW, row, rowData, flag);
      }
    } catch (err) {
      Logger.log('ReportService Error in processGeneralFormSubmit: ' + err.toString());
    }
  }
};

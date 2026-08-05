/**
 * SpreadsheetRepository.gs — Central Data Access Object (DAO) for SpreadsheetApp
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: INFRASTRUCTURE
 * Responsibility: Manages sheet schemas, range operations, row highlighting, and multi-sheet queries.
 * Eliminates magic column numbers and scattered SpreadsheetApp calls.
 */

const SHEET_NAMES = Object.freeze({
  DAILY_RAW: 'Daily_Raw',
  GENERAL_RAW: 'General_Raw',
  SENSITIVE_RESTRICTED: 'Sensitive_Restricted',
  ADMIN_QUEUE: 'Admin_Queue',
  WEEKLY_SUMMARY: 'Weekly_Summary',
  ARCHIVE_REPORTS: 'Archive_Reports'
});

const SpreadsheetRepository = {
  /**
   * Opens central spreadsheet using SPREADSHEET_ID from ConfigRepository.
   * Parameterized to accept a specific spreadsheetId if provided.
   * @param {string} [spreadsheetId]
   * @returns {Spreadsheet} Spreadsheet object.
   */
  getSpreadsheet: function(spreadsheetId) {
    const ssId = spreadsheetId || ConfigRepository.getSpreadsheetId();
    if (!ssId) {
      throw new Error('SPREADSHEET_ID missing in Script Properties.');
    }
    return SpreadsheetApp.openById(ssId);
  },

  /**
   * Returns sheet by name or null if missing.
   * @param {string} sheetName 
   * @param {string} [spreadsheetId]
   * @returns {Sheet|null}
   */
  getSheet: function(sheetName, spreadsheetId) {
    try {
      const ss = this.getSpreadsheet(spreadsheetId);
      return ss.getSheetByName(sheetName);
    } catch (e) {
      Logger.log(`SpreadsheetRepository Error getting sheet ${sheetName}: ${e.toString()}`);
      return null;
    }
  },

  /**
   * Ensures row has a Report_ID UUID in Col 1.
   * If row came from Google Form (where Col 1 is Timestamp), shifts data right by 1 column.
   * @param {Sheet} sheet 
   * @param {number} row 
   * @param {Array} rowData 
   * @returns {string} Report UUID.
   */
  ensureReportId: function(sheet, row, rowData) {
    if (typeof rowData[0] === 'string' && rowData[0].length === 36 && rowData[0].includes('-')) {
      return rowData[0];
    }
    const reportId = Utilities.getUuid();
    const shiftedRowData = [reportId].concat(rowData);
    sheet.getRange(row, 1, 1, shiftedRowData.length).setValues([shiftedRowData]);
    return reportId;
  },

  /**
   * Applies soft background color based on severity.
   * @param {Sheet} sheet 
   * @param {number} row 
   * @param {'urgent'|'warning'|'normal'} severity 
   */
  applyRowHighlighting: function(sheet, row, severity) {
    if (!sheet) return;
    const lastCol = sheet.getLastColumn();
    const range = sheet.getRange(row, 1, 1, lastCol);
    
    if (severity === ReportSeverity.URGENT) {
      range.setBackground('#fce8e6'); // Light red
    } else if (severity === ReportSeverity.WARNING) {
      range.setBackground('#fef7e0'); // Light yellow
    }
  },

  /**
   * Appends and annotates a new Daily Report row into target dedicated sheet.
   * @param {Object} report - DailyReport object.
   * @param {Object} flag - TriageResult object.
   * @param {string} [targetSheetId] - Dedicated Spreadsheet ID.
   * @returns {{ success: boolean, reportId: string }}
   */
  saveDailyReport: function(report, flag, targetSheetId) {
    const ss = targetSheetId ? SpreadsheetApp.openById(targetSheetId) : this.getSpreadsheet();
    const sheet = ss.getSheetByName('Raw') || ss.getSheetByName(SHEET_NAMES.DAILY_RAW) || ss.getSheets()[0];
    const nowStr = formatDate(new Date());
    const reportId = report.reportId || Utilities.getUuid();

    const rowData = [
      reportId,
      nowStr,
      report.empId,
      report.site,
      report.date,
      report.taskStatus,
      report.yieldKg || 0,
      report.issues,
      flag.severity,
      flag.keywords.join(', '),
      flag.isUrgent ? 'YES' : 'NO',
      ReviewStatus.UNREVIEWED
    ];

    sheet.appendRow(rowData);
    const newRow = sheet.getLastRow();
    this.applyRowHighlighting(sheet, newRow, flag.severity);

    return { success: true, reportId: reportId };
  },

  /**
   * Appends and annotates a new General Report row into target dedicated sheet.
   * If sensitive, routes to Sensitive tab.
   * @param {Object} report - GeneralReport object.
   * @param {Object} flag - TriageResult object.
   * @param {string} [targetSheetId] - Dedicated Spreadsheet ID.
   * @returns {{ success: boolean, reportId: string, isSensitive?: boolean }}
   */
  saveGeneralReport: function(report, flag, targetSheetId) {
    const ss = targetSheetId ? SpreadsheetApp.openById(targetSheetId) : this.getSpreadsheet();
    const reportId = report.reportId || Utilities.getUuid();
    const nowStr = formatDate(new Date());

    if (report.isSensitive) {
      const sensitiveSheet = ss.getSheetByName('Sensitive') || ss.getSheetByName(SHEET_NAMES.SENSITIVE_RESTRICTED) || ss.getSheets()[1];
      const sensitiveRowData = [
        reportId,
        nowStr,
        report.empId,
        report.site,
        report.date,
        report.details,
        'YES',
        flag.severity,
        flag.rank,
        flag.category,
        ReviewStatus.UNREVIEWED_SENSITIVE
      ];

      sensitiveSheet.appendRow(sensitiveRowData);
      return { success: true, reportId: reportId, isSensitive: true };
    }

    const rawSheet = ss.getSheetByName('Raw') || ss.getSheetByName(SHEET_NAMES.GENERAL_RAW) || ss.getSheets()[0];
    const rawRowData = [
      reportId,
      nowStr,
      report.empId,
      report.site,
      report.date,
      report.details,
      'NO',
      flag.severity,
      flag.keywords.join(', '),
      flag.isUrgent ? 'YES' : 'NO',
      ReviewStatus.UNREVIEWED
    ];

    rawSheet.appendRow(rawRowData);
    const newRow = rawSheet.getLastRow();
    this.applyRowHighlighting(rawSheet, newRow, flag.severity);

    return { success: true, reportId: reportId, isSensitive: false };
  },

  /**
   * Reads Admin Queue rows across all registered forms' dedicated spreadsheets.
   * Dynamically merges and sorts queue items by timestamp descending.
   * @returns {Array} Array of QueueItem objects.
   */
  getAdminQueueData: function() {
    const forms = FormManagementService.getFormList();
    const mergedQueue = [];

    forms.forEach(f => {
      if (!f.sheetId) return;
      try {
        const ss = SpreadsheetApp.openById(f.sheetId);
        
        // 1. Read Raw sheet
        const rawSheet = ss.getSheetByName('Raw') || ss.getSheetByName(SHEET_NAMES.DAILY_RAW) || ss.getSheetByName(SHEET_NAMES.GENERAL_RAW) || ss.getSheets()[0];
        if (rawSheet && rawSheet.getLastRow() > 1) {
          const rawValues = rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, rawSheet.getLastColumn()).getValues();
          rawValues.forEach(row => {
            if (row[0] || row[1]) {
              mergedQueue.push(QueueItem({
                source: f.title || 'Form Laporan',
                reportId: String(row[0] || ''),
                timestamp: formatDate(row[1] || new Date()),
                empId: String(row[2] || ''),
                site: String(row[3] || ''),
                date: formatDate(row[4] || new Date()),
                detail: String(row[5] || '-'),
                yieldOrSensitive: String(row[6] || '-'),
                issues: String(row[7] || '-'),
                severity: String(row[8] || ReportSeverity.NORMAL).toLowerCase(),
                rank: (row[8] === ReportSeverity.URGENT) ? 1 : ((row[8] === ReportSeverity.WARNING) ? 2 : 3),
                category: String(row[9] || 'ROUTINE'),
                reviewStatus: String(row[11] || row[10] || ReviewStatus.UNREVIEWED)
              }));
            }
          });
        }

        // 2. Read Sensitive sheet if present
        const sensitiveSheet = ss.getSheetByName('Sensitive') || ss.getSheetByName(SHEET_NAMES.SENSITIVE_RESTRICTED);
        if (sensitiveSheet && sensitiveSheet.getLastRow() > 1) {
          const sensitiveValues = sensitiveSheet.getRange(2, 1, sensitiveSheet.getLastRow() - 1, sensitiveSheet.getLastColumn()).getValues();
          sensitiveValues.forEach(row => {
            if (row[0] || row[1]) {
              mergedQueue.push(QueueItem({
                source: `${f.title || 'Form Laporan'} (Sensitif)`,
                reportId: String(row[0] || ''),
                timestamp: formatDate(row[1] || new Date()),
                empId: String(row[2] || ''),
                site: String(row[3] || ''),
                date: formatDate(row[4] || new Date()),
                detail: String(row[5] || '-'),
                yieldOrSensitive: String(row[6] || 'YES'),
                issues: 'Informasi Sensitif',
                severity: String(row[7] || ReportSeverity.WARNING).toLowerCase(),
                rank: 2,
                category: String(row[9] || 'RESTRICTED'),
                reviewStatus: String(row[10] || ReviewStatus.UNREVIEWED_SENSITIVE)
              }));
            }
          });
        }
      } catch (err) {
        Logger.log(`SpreadsheetRepository Notice: Could not read sheet ${f.sheetId} for form ${f.id}: ${err.toString()}`);
      }
    });

    // Fallback: If no dedicated per-form sheet rows were found, read old central spreadsheet
    if (mergedQueue.length === 0) {
      try {
        const oldSsId = ConfigRepository.getSpreadsheetId();
        if (oldSsId) {
          const oldSs = SpreadsheetApp.openById(oldSsId);
          const legacyQueue = oldSs.getSheetByName(SHEET_NAMES.ADMIN_QUEUE);
          if (legacyQueue && legacyQueue.getLastRow() > 1) {
            const values = legacyQueue.getDataRange().getValues().slice(1);
            values.forEach(row => {
              if (row[0] || row[1]) {
                mergedQueue.push(QueueItem({
                  source: row[0],
                  reportId: row[1],
                  timestamp: row[2],
                  empId: row[3],
                  site: row[4],
                  date: row[5],
                  detail: row[6],
                  yieldOrSensitive: row[7],
                  issues: row[8],
                  severity: row[9],
                  rank: row[10],
                  category: row[11],
                  reviewStatus: row[12]
                }));
              }
            });
          }
        }
      } catch (e) {}
    }

    // Sort queue items by timestamp descending
    mergedQueue.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    return mergedQueue;
  },

  /**
   * Updates Review_Status of a report by matching Report_ID across all per-form dedicated spreadsheets.
   * @param {string} reportId 
   * @param {string} newStatus 
   * @returns {{ success: boolean, reportId: string, sheet?: string, updatedStatus?: string, error?: string }}
   */
  updateReviewStatus: function(reportId, newStatus) {
    const forms = FormManagementService.getFormList();

    for (let f = 0; f < forms.length; f++) {
      const form = forms[f];
      if (!form.sheetId) continue;

      try {
        const ss = SpreadsheetApp.openById(form.sheetId);
        const sheets = ss.getSheets();

        for (let s = 0; s < sheets.length; s++) {
          const sheet = sheets[s];
          const values = sheet.getDataRange().getValues();
          if (!values || values.length <= 1) continue;

          for (let r = 1; r < values.length; r++) {
            if (String(values[r][0]) === String(reportId)) {
              const lastCol = sheet.getLastColumn();
              sheet.getRange(r + 1, lastCol).setValue(newStatus);
              Logger.log(`SpreadsheetRepository: Updated report ${reportId} in sheet ${form.sheetId} (${sheet.getName()}) row ${r + 1} to status: ${newStatus}`);
              return { success: true, reportId: reportId, sheet: sheet.getName(), updatedStatus: newStatus };
            }
          }
        }
      } catch (err) {
        Logger.log(`SpreadsheetRepository Notice: Error searching sheet ${form.sheetId}: ${err.toString()}`);
      }
    }

    return { success: false, error: 'Report_ID not found in dedicated sheets.' };
  },

  /**
   * Aggregates stats for Executive Dashboard across all dedicated per-form spreadsheets.
   * @returns {Object|null} Stats object.
   */
  getDashboardStatsData: function() {
    const forms = FormManagementService.getFormList();

    let totalReports = 0;
    let totalYieldKg = 0;
    let urgentCount = 0;
    let sensitiveCount = 0;

    const siteBreakdown = {
      'Site A — Kebun & Lahan Pertanian': 0,
      'Site B — Peternakan & Kandang': 0,
      'Site C — Pabrik Pengolahan & Pakan': 0,
      'Site D — Logistik & Gudang': 0
    };

    const yieldBreakdown = { normal: 0, warning: 0, urgent: 0 };
    const severityDist = { normal: 0, warning: 0, urgent: 0 };

    forms.forEach(f => {
      if (!f.sheetId) return;
      try {
        const ss = SpreadsheetApp.openById(f.sheetId);
        
        // 1. Process Raw sheet
        const rawSheet = ss.getSheetByName('Raw') || ss.getSheets()[0];
        if (rawSheet && rawSheet.getLastRow() > 1) {
          const values = rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, rawSheet.getLastColumn()).getValues();
          values.forEach(row => {
            if (row[0] || row[1]) {
              totalReports++;
              const site = String(row[3] || '');
              if (siteBreakdown.hasOwnProperty(site)) siteBreakdown[site]++;

              const yieldVal = parseFloat(row[6]) || 0;
              totalYieldKg += yieldVal;

              const severity = String(row[8] || 'normal').toLowerCase();
              if (severity === ReportSeverity.URGENT) {
                urgentCount++;
                severityDist.urgent++;
                yieldBreakdown.urgent += yieldVal;
              } else if (severity === ReportSeverity.WARNING) {
                severityDist.warning++;
                yieldBreakdown.warning += yieldVal;
              } else {
                severityDist.normal++;
                yieldBreakdown.normal += yieldVal;
              }
            }
          });
        }

        // 2. Process Sensitive sheet if present
        const sensitiveSheet = ss.getSheetByName('Sensitive');
        if (sensitiveSheet && sensitiveSheet.getLastRow() > 1) {
          const values = sensitiveSheet.getRange(2, 1, sensitiveSheet.getLastRow() - 1, sensitiveSheet.getLastColumn()).getValues();
          values.forEach(row => {
            if (row[0] || row[1]) {
              totalReports++;
              sensitiveCount++;
              const site = String(row[3] || '');
              if (siteBreakdown.hasOwnProperty(site)) siteBreakdown[site]++;

              const severity = String(row[7] || 'warning').toLowerCase();
              if (severity === ReportSeverity.URGENT) {
                urgentCount++;
                severityDist.urgent++;
              } else {
                severityDist.warning++;
              }
            }
          });
        }
      } catch (err) {}
    });

    return {
      totalReports: totalReports,
      totalYieldKg: Math.round(totalYieldKg * 100) / 100,
      urgentCount: urgentCount,
      sensitiveCount: sensitiveCount,
      siteBreakdown: siteBreakdown,
      yieldBreakdown: yieldBreakdown,
      severityDist: severityDist
    };
  }
};

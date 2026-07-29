/**
 * SpreadsheetRepository.gs — Central Data Access Object (DAO) for SpreadsheetApp
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: INFRASTRUCTURE
 * Responsibility: Manages sheet schemas, range operations, row highlighting, and queries.
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
   * @returns {Spreadsheet} Spreadsheet object.
   */
  getSpreadsheet: function() {
    const ssId = ConfigRepository.getSpreadsheetId();
    if (!ssId) {
      throw new Error('SPREADSHEET_ID missing in Script Properties.');
    }
    return SpreadsheetApp.openById(ssId);
  },

  /**
   * Returns sheet by name or null if missing.
   * @param {string} sheetName 
   * @returns {Sheet|null}
   */
  getSheet: function(sheetName) {
    try {
      const ss = this.getSpreadsheet();
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
   * Appends and annotates a new Daily Report row.
   * @param {Object} report - DailyReport object.
   * @param {Object} flag - TriageResult object.
   * @returns {{ success: boolean, reportId: string }}
   */
  saveDailyReport: function(report, flag) {
    const ss = this.getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.DAILY_RAW);
    const nowStr = formatDate(new Date());
    const reportId = report.reportId || Utilities.getUuid();

    const rowData = [
      reportId,
      nowStr,
      report.empId,
      report.site,
      report.date,
      report.taskStatus,
      report.yieldKg,
      report.issues
    ];

    sheet.appendRow(rowData);
    const row = sheet.getLastRow();

    // Set Flag_Severity (Col 9), Severity_Rank (Col 10), Flag_Category (Col 11), Review_Status (Col 12)
    sheet.getRange(row, 9).setValue(flag.severity);
    sheet.getRange(row, 10).setValue(flag.rank);
    sheet.getRange(row, 11).setValue(flag.category);
    sheet.getRange(row, 12).setValue(ReviewStatus.UNREVIEWED);

    this.applyRowHighlighting(sheet, row, flag.severity);

    return { success: true, reportId: reportId, row: row, rowData: rowData };
  },

  /**
   * Appends and annotates a new General Report row.
   * @param {Object} report - GeneralReport object.
   * @param {Object} flag - TriageResult object.
   * @returns {{ success: boolean, reportId: string, isSensitive: boolean }}
   */
  saveGeneralReport: function(report, flag) {
    const ss = this.getSpreadsheet();
    const nowStr = formatDate(new Date());
    const reportId = report.reportId || Utilities.getUuid();

    if (report.isSensitive) {
      return this.saveSensitiveReport(report, flag);
    }

    const generalSheet = ss.getSheetByName(SHEET_NAMES.GENERAL_RAW);
    const rowData = [
      reportId,
      nowStr,
      report.empId,
      report.site,
      report.date,
      report.details,
      report.sensitiveText
    ];

    generalSheet.appendRow(rowData);
    const row = generalSheet.getLastRow();

    // Set Flag_Severity (Col 8), Severity_Rank (Col 9), Flag_Category (Col 10), Review_Status (Col 11)
    generalSheet.getRange(row, 8).setValue(flag.severity);
    generalSheet.getRange(row, 9).setValue(flag.rank);
    generalSheet.getRange(row, 10).setValue(flag.category);
    generalSheet.getRange(row, 11).setValue(ReviewStatus.UNREVIEWED);

    this.applyRowHighlighting(generalSheet, row, flag.severity);

    return { success: true, reportId: reportId, isSensitive: false, row: row, rowData: rowData };
  },

  /**
   * Appends a report to Sensitive_Restricted sheet.
   * @param {Object} report 
   * @param {Object} flag 
   * @returns {{ success: boolean, reportId: string, isSensitive: boolean }}
   */
  saveSensitiveReport: function(report, flag) {
    const ss = this.getSpreadsheet();
    const sensitiveSheet = ss.getSheetByName(SHEET_NAMES.SENSITIVE_RESTRICTED);
    const nowStr = formatDate(new Date());
    const reportId = report.reportId || Utilities.getUuid();

    const sensitiveRowData = [
      reportId,
      nowStr,
      report.empId,
      report.site,
      report.date,
      report.details,
      report.sensitiveText,
      flag.severity,
      flag.rank,
      flag.category,
      ReviewStatus.UNREVIEWED_SENSITIVE
    ];

    sensitiveSheet.appendRow(sensitiveRowData);

    return { success: true, reportId: reportId, isSensitive: true };
  },

  /**
   * Relocates sensitive row from General_Raw to Sensitive_Restricted during Google Form triggers.
   */
  moveRowToSensitiveTab: function(sourceSheet, row, rowData) {
    const ss = this.getSpreadsheet();
    const sensitiveSheet = ss.getSheetByName(SHEET_NAMES.SENSITIVE_RESTRICTED);
    const flag = TriageEngine.evaluate(rowData);
    
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
      ReviewStatus.UNREVIEWED_SENSITIVE
    ];

    sensitiveSheet.appendRow(sensitiveRowData);
    sourceSheet.deleteRow(row);

    return { reportId: rowData[0], site: rowData[3], empId: rowData[2], date: rowData[4] };
  },

  /**
   * Reads Admin_Queue rows for client display.
   * @returns {Array} Array of QueueItem objects.
   */
  getAdminQueueData: function() {
    const queueSheet = this.getSheet(SHEET_NAMES.ADMIN_QUEUE);
    if (!queueSheet) return [];

    const values = queueSheet.getDataRange().getValues();
    if (!values || values.length <= 1) return [];

    const queueRows = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row[0] && row[0] !== '') {
        queueRows.push(QueueItem({
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
    }

    return queueRows;
  },

  /**
   * Updates Review_Status of a report by matching Report_ID across raw sheets.
   * @param {string} reportId 
   * @param {string} newStatus 
   * @returns {{ success: boolean, reportId: string, sheet?: string, updatedStatus?: string, error?: string }}
   */
  updateReviewStatus: function(reportId, newStatus) {
    const ss = this.getSpreadsheet();
    const sheetsToSearch = [
      { name: SHEET_NAMES.DAILY_RAW, statusCol: 12 },
      { name: SHEET_NAMES.GENERAL_RAW, statusCol: 11 },
      { name: SHEET_NAMES.SENSITIVE_RESTRICTED, statusCol: 11 }
    ];

    for (let s = 0; s < sheetsToSearch.length; s++) {
      const info = sheetsToSearch[s];
      const sheet = ss.getSheetByName(info.name);
      if (!sheet) continue;

      const values = sheet.getDataRange().getValues();
      for (let r = 1; r < values.length; r++) {
        if (String(values[r][0]) === String(reportId)) {
          sheet.getRange(r + 1, info.statusCol).setValue(newStatus);
          Logger.log(`SpreadsheetRepository: Updated report ${reportId} in ${info.name} row ${r + 1} to status: ${newStatus}`);
          return { success: true, reportId: reportId, sheet: info.name, updatedStatus: newStatus };
        }
      }
    }

    return { success: false, error: 'Report_ID not found in raw sheets.' };
  },

  /**
   * Aggregates stats for Executive Dashboard.
   * @returns {Object|null} Stats object.
   */
  getDashboardStatsData: function() {
    const ss = this.getSpreadsheet();
    const dailySheet = ss.getSheetByName(SHEET_NAMES.DAILY_RAW);
    const generalSheet = ss.getSheetByName(SHEET_NAMES.GENERAL_RAW);
    const sensitiveSheet = ss.getSheetByName(SHEET_NAMES.SENSITIVE_RESTRICTED);

    if (!dailySheet || !generalSheet || !sensitiveSheet) return null;

    const dailyValues = dailySheet.getDataRange().getValues().slice(1);
    const generalValues = generalSheet.getDataRange().getValues().slice(1);
    const sensitiveValues = sensitiveSheet.getDataRange().getValues().slice(1);

    let totalYield = 0;
    let urgentCount = 0;
    let warningCount = 0;
    let normalCount = 0;

    dailyValues.forEach(row => {
      totalYield += parseFloat(row[6]) || 0;
      const sev = String(row[8]).toLowerCase();
      if (sev === ReportSeverity.URGENT) urgentCount++;
      else if (sev === ReportSeverity.WARNING) warningCount++;
      else normalCount++;
    });

    generalValues.forEach(row => {
      const sev = String(row[7]).toLowerCase();
      if (sev === ReportSeverity.URGENT) urgentCount++;
      else if (sev === ReportSeverity.WARNING) warningCount++;
      else normalCount++;
    });

    sensitiveValues.forEach(row => {
      const sev = String(row[7]).toLowerCase();
      if (sev === ReportSeverity.URGENT) urgentCount++;
      else if (sev === ReportSeverity.WARNING) warningCount++;
      else normalCount++;
    });

    const sites = [
      'Site A — Kebun & Lahan Pertanian', 
      'Site B — Peternakan & Kandang', 
      'Site C — Pabrik Pengolahan & Pakan', 
      'Site D — Logistik & Gudang'
    ];

    const allReports = dailyValues.concat(generalValues).concat(sensitiveValues);
    const siteCounts = sites.map(site => {
      return allReports.filter(row => row[3] === site || row[2] === site).length;
    });

    return {
      totalReports: allReports.length,
      totalYield: totalYield,
      urgentCount: urgentCount,
      warningCount: warningCount,
      normalCount: normalCount,
      sensitiveCount: sensitiveValues.length,
      siteCounts: siteCounts
    };
  },

  /**
   * Archives closed reports older than cutoff date into Archive_Reports tab.
   * @param {number} retentionDays 
   * @returns {{ success: boolean, totalArchived: number }}
   */
  archiveClosedReports: function(retentionDays) {
    const ss = this.getSpreadsheet();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    cutoffDate.setHours(0, 0, 0, 0);

    let archiveSheet = ss.getSheetByName(SHEET_NAMES.ARCHIVE_REPORTS);
    if (!archiveSheet) {
      archiveSheet = ss.insertSheet(SHEET_NAMES.ARCHIVE_REPORTS);
      const archiveHeaders = [
        'Original_Sheet', 'Report_ID', 'Timestamp', 'EmpID', 'Site',
        'ReportDate', 'Details_Or_Status', 'Yield_Or_Sensitive', 'Issues',
        'Flag_Severity', 'Severity_Rank', 'Flag_Category', 'Review_Status', 'Archived_At'
      ];
      archiveSheet.getRange(1, 1, 1, archiveHeaders.length)
        .setValues([archiveHeaders])
        .setFontWeight('bold')
        .setBackground('#e2e8f0');
    }

    const rawSheets = [
      { name: SHEET_NAMES.DAILY_RAW, statusCol: 12, dateCol: 5 },
      { name: SHEET_NAMES.GENERAL_RAW, statusCol: 11, dateCol: 5 },
      { name: SHEET_NAMES.SENSITIVE_RESTRICTED, statusCol: 11, dateCol: 5 }
    ];

    let totalArchived = 0;
    const nowStr = formatDate(new Date());

    rawSheets.forEach(sheetInfo => {
      const sheet = ss.getSheetByName(sheetInfo.name);
      if (!sheet) return;

      const values = sheet.getDataRange().getValues();
      if (values.length <= 1) return;

      // Iterate backwards to preserve row indices during deletion
      for (let r = values.length - 1; r >= 1; r--) {
        const row = values[r];
        const status = String(row[sheetInfo.statusCol - 1] || '').trim().toLowerCase();
        
        if (status.includes('closed')) {
          const dateVal = row[sheetInfo.dateCol - 1] || row[1];
          let rowDate = null;

          if (dateVal instanceof Date) {
            rowDate = dateVal;
          } else if (typeof dateVal === 'string' && dateVal.trim() !== '') {
            rowDate = new Date(dateVal);
          }

          if (rowDate && !isNaN(rowDate.getTime()) && rowDate < cutoffDate) {
            let archiveRow = [];
            if (sheetInfo.name === SHEET_NAMES.DAILY_RAW) {
              archiveRow = [
                sheetInfo.name, row[0], row[1], row[2], row[3], row[4],
                `Status: ${row[5]}`, row[6], row[7], row[8], row[9], row[10], row[11], nowStr
              ];
            } else {
              archiveRow = [
                sheetInfo.name, row[0], row[1], row[2], row[3], row[4],
                row[5], row[6], '-', row[7], row[8], row[9], row[10], nowStr
              ];
            }

            archiveSheet.appendRow(archiveRow);
            sheet.deleteRow(r + 1);
            totalArchived++;
          }
        }
      }
    });

    return { success: true, totalArchived: totalArchived };
  },

  /**
   * Initializes tab headers and QUERY formula during provisioning.
   */
  setupSheetHeaders: function(dailySheet, generalSheet, adminQueueSheet, sensitiveSheet, summarySheet) {
    const dailyHeaders = [
      'Report_ID', 'Timestamp', 'Kode Karyawan / Employee ID', 'Lokasi / Site',
      'Tanggal Laporan / Date', 'Status Tugas / Task Status', 'Hasil Panen / Yield (kg)',
      'Ada Masalah? / Issues', 'Flag_Severity', 'Severity_Rank', 'Flag_Category', 'Review_Status'
    ];

    const generalHeaders = [
      'Report_ID', 'Timestamp', 'Kode Karyawan / Employee ID', 'Lokasi / Site',
      'Tanggal Laporan / Date', 'Rincian Laporan / Details', 'Informasi Sensitif? / Sensitive',
      'Flag_Severity', 'Severity_Rank', 'Flag_Category', 'Review_Status'
    ];

    const summaryHeaders = [
      'Tahun-Minggu (Year-Week)', 'Lokasi / Site', 'Total Daily Reports', 'Total General Reports',
      'Total Urgent Flags', 'Total Warning Flags', 'Total Sensitive Reports', 'Total Panen / Yield (kg)', 'Last Updated'
    ];

    const queueHeaders = [
      'Source Sheet', 'Report_ID', 'Timestamp', 'Kode Karyawan', 'Lokasi / Site', 'Tanggal',
      'Status/Rincian', 'Hasil Panen (kg) / Sensitive', 'Issues / -', 'Flag_Severity', 'Severity_Rank', 'Flag_Category', 'Review_Status'
    ];

    dailySheet.getRange(1, 1, 1, dailyHeaders.length).setValues([dailyHeaders]).setFontWeight('bold').setBackground('#e8f0fe');
    generalSheet.getRange(1, 1, 1, generalHeaders.length).setValues([generalHeaders]).setFontWeight('bold').setBackground('#e8f0fe');
    sensitiveSheet.getRange(1, 1, 1, generalHeaders.length).setValues([generalHeaders]).setFontWeight('bold').setBackground('#fce8e6');
    summarySheet.getRange(1, 1, 1, summaryHeaders.length).setValues([summaryHeaders]).setFontWeight('bold').setBackground('#e6f4ea');
    adminQueueSheet.getRange(1, 1, 1, queueHeaders.length).setValues([queueHeaders]).setFontWeight('bold').setBackground('#feefc3');

    const queryFormula = `=QUERY({
      ARRAYFORMULA(IF(LEN(Daily_Raw!A2:A), "Daily_Raw", "")), Daily_Raw!A2:L;
      ARRAYFORMULA(IF(LEN(General_Raw!A2:A), "General_Raw", "")), General_Raw!A2:F, General_Raw!G2:G, ARRAYFORMULA(IF(LEN(General_Raw!A2:A), "", "")), General_Raw!H2:K
    }, "select * where Col1 is not null and Col13 != 'Closed' order by Col11 asc, Col3 desc", 0)`;

    adminQueueSheet.getRange(2, 1).setFormula(queryFormula);
  }
};

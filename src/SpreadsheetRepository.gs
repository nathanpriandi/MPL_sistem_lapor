/**
 * SpreadsheetRepository.gs — Database Abstraction & Data Access Object (DAO)
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: INFRASTRUCTURE / REPOSITORY
 * Responsibility: Performs all low-level Google Sheets API reads, writes, schema lookups,
 * multi-tab queue aggregation within single integrated spreadsheet, historical data migration, 
 * and row highlighting formatting.
 */

const SpreadsheetRepository = {

  /**
   * Returns central Integrated Spreadsheet instance.
   * @returns {Spreadsheet}
   */
  getSpreadsheet: function() {
    const ssId = ConfigRepository.getSpreadsheetId();
    if (!ssId) {
      throw new Error('Spreadsheet ID belum dikonfigurasi di Script Properties.');
    }
    return SpreadsheetApp.openById(ssId);
  },

  /**
   * Generates a UUID string v4.
   * @returns {string} UUID
   */
  generateUUID: function() {
    return Utilities.getUuid();
  },

  /**
   * Ensures row has a Report_ID UUID in Col 1.
   * If Col 1 is a Timestamp or missing, generates a UUID and prepends/sets it.
   * @param {Sheet} sheet 
   * @param {number} row 
   * @param {Array} rowData 
   * @returns {string} Report_ID UUID
   */
  ensureReportId: function(sheet, row, rowData) {
    const firstCell = String(rowData[0] || '').trim();
    
    // Check if firstCell is already a UUID (36 chars with hyphens)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firstCell);
    
    if (isUuid) {
      return firstCell;
    }

    const uuid = this.generateUUID();

    if (!firstCell || firstCell.includes('-') && firstCell.includes(':') || !isNaN(Date.parse(firstCell))) {
      sheet.insertColumnBefore(1);
      sheet.getRange(row, 1).setValue(uuid);
      sheet.getRange(1, 1).setValue('Report_ID');
      Logger.log(`SpreadsheetRepository: Prepended UUID ${uuid} at row ${row}`);
    } else {
      sheet.getRange(row, 1).setValue(uuid);
      Logger.log(`SpreadsheetRepository: Replaced Col 1 with UUID ${uuid} at row ${row}`);
    }

    return uuid;
  },

  /**
   * Applies soft background row highlighting based on triage severity level.
   * @param {Sheet} sheet 
   * @param {number} row 
   * @param {string} severity 
   */
  applyRowHighlighting: function(sheet, row, severity) {
    if (!sheet || row <= 1) return;
    
    const lastCol = sheet.getLastColumn();
    const range = sheet.getRange(row, 1, 1, lastCol);
    const sev = (severity || 'normal').toLowerCase();

    let hexColor = '#ffffff'; // Normal / routine default
    if (sev === ReportSeverity.URGENT) {
      hexColor = '#fecaca'; // Soft red highlight
    } else if (sev === ReportSeverity.WARNING) {
      hexColor = '#fef08a'; // Soft yellow highlight
    }

    range.setBackground(hexColor);
  },

  /**
   * Relocates a sensitive report row from its source sheet to the single shared Sensitive tab of the integrated spreadsheet.
   * Deletes original row from source sheet.
   * @param {Sheet} sourceSheet 
   * @param {number} sourceRow 
   * @param {Array} rowData 
   * @returns {{ reportId: string, empId: string, site: string, date: string, details: string }}
   */
  moveRowToSensitiveTab: function(sourceSheet, sourceRow, rowData) {
    const ss = sourceSheet.getParent();
    let sensitiveSheet = ss.getSheetByName('Sensitive') || ss.getSheetByName(SHEET_NAMES.SENSITIVE_RESTRICTED);
    
    if (!sensitiveSheet) {
      sensitiveSheet = ss.insertSheet('Sensitive');
      sensitiveSheet.getRange('A1:K1').setValues([[
        'Report_ID', 'Timestamp', 'Emp_ID', 'Site', 'Date', 'Details', 
        'Sensitive_Flag', 'Foto_Lampiran', 'Severity', 'Flagged_Keywords', 'Reviewed'
      ]]);
      sensitiveSheet.getRange('A1:K1').setFontWeight('bold').setBackground('#fef2f2');
      sensitiveSheet.setFrozenRows(1);
    }

    const reportId = rowData[0] || this.generateUUID();
    const timestamp = rowData[1] || formatDate(new Date());
    const empId = rowData[2] || '';
    const site = rowData[3] || '';
    const date = rowData[4] || '';
    const details = rowData[5] || '';
    const sensitiveFlag = 'YES (Routed to Sensitive)';
    const photoUrl = rowData[8] || '';

    const sensitiveRow = [
      reportId,
      timestamp,
      empId,
      site,
      date,
      details,
      sensitiveFlag,
      photoUrl,
      ReportSeverity.WARNING,
      'SENSITIVE',
      ReviewStatus.UNREVIEWED_SENSITIVE
    ];

    sensitiveSheet.appendRow(sensitiveRow);
    const newRowIndex = sensitiveSheet.getLastRow();
    this.applyRowHighlighting(sensitiveSheet, newRowIndex, ReportSeverity.WARNING);

    // Delete row from raw source sheet
    try {
      sourceSheet.deleteRow(sourceRow);
    } catch (e) {
      Logger.log('SpreadsheetRepository Warning: Failed to delete row from source sheet: ' + e.toString());
    }

    return {
      reportId: reportId,
      empId: empId,
      site: site,
      date: date,
      details: details
    };
  },

  /**
   * Saves a new Daily Operational Report into integrated spreadsheet.
   * @param {Object} report 
   * @param {Object} flag 
   * @returns {{ reportId: string, row: number }}
   */
  saveDailyReport: function(report, flag) {
    const ss = this.getSpreadsheet();
    const forms = FormManagementService.getFormList();
    const dForm = forms.find(f => (f.type || '').toLowerCase() === 'harian' || f.isDefaultDaily) || { title: 'Laporan Operasional Harian' };
    const sheet = FormManagementService.resolveFormTab_(ss, dForm);

    const reportId = this.generateUUID();
    const rowData = [
      reportId,
      formatDate(new Date()),
      report.empId,
      report.site,
      report.date,
      report.taskStatus,
      report.yieldKg,
      report.issues,
      report.photoUrl || '',
      flag.severity,
      flag.keywords.join(', '),
      ReviewStatus.UNREVIEWED
    ];

    sheet.appendRow(rowData);
    const newRowIndex = sheet.getLastRow();
    this.applyRowHighlighting(sheet, newRowIndex, flag.severity);

    return { reportId: reportId, row: newRowIndex };
  },

  /**
   * Saves a new General Report into integrated spreadsheet.
   * @param {Object} report 
   * @param {Object} flag 
   * @returns {{ reportId: string, row: number }}
   */
  saveGeneralReport: function(report, flag) {
    const ss = this.getSpreadsheet();
    const forms = FormManagementService.getFormList();
    const gForm = forms.find(f => (f.type || '').toLowerCase() === 'umum' || f.isDefaultGeneral) || { title: 'Laporan Umum & Catatan Lapangan' };

    const reportId = this.generateUUID();

    if (report.isSensitive) {
      let sensitiveSheet = ss.getSheetByName('Sensitive') || ss.getSheetByName(SHEET_NAMES.SENSITIVE_RESTRICTED);
      if (!sensitiveSheet) {
        sensitiveSheet = ss.insertSheet('Sensitive');
        sensitiveSheet.getRange('A1:K1').setValues([[
          'Report_ID', 'Timestamp', 'Emp_ID', 'Site', 'Date', 'Details', 
          'Sensitive_Flag', 'Foto_Lampiran', 'Severity', 'Flagged_Keywords', 'Reviewed'
        ]]);
        sensitiveSheet.getRange('A1:K1').setFontWeight('bold').setBackground('#fef2f2');
        sensitiveSheet.setFrozenRows(1);
      }

      const rowData = [
        reportId,
        formatDate(new Date()),
        report.empId,
        report.site,
        report.date,
        report.details,
        'YES',
        report.photoUrl || '',
        flag.severity,
        flag.keywords.join(', '),
        ReviewStatus.UNREVIEWED_SENSITIVE
      ];

      sensitiveSheet.appendRow(rowData);
      const newRowIndex = sensitiveSheet.getLastRow();
      this.applyRowHighlighting(sensitiveSheet, newRowIndex, flag.severity);
      return { reportId: reportId, row: newRowIndex };
    }

    const sheet = FormManagementService.resolveFormTab_(ss, gForm);
    const rowData = [
      reportId,
      formatDate(new Date()),
      report.empId,
      report.site,
      report.date,
      report.details,
      'NO',
      'None',
      report.photoUrl || '',
      flag.severity,
      flag.keywords.join(', '),
      ReviewStatus.UNREVIEWED
    ];

    sheet.appendRow(rowData);
    const newRowIndex = sheet.getLastRow();
    this.applyRowHighlighting(sheet, newRowIndex, flag.severity);

    return { reportId: reportId, row: newRowIndex };
  },

  /**
   * Fetches unified Admin Triage Queue across all form tabs inside the single integrated spreadsheet.
   * Merges, ranks, and sorts report items chronologically.
   * Single file open performance optimization.
   * @returns {Array<Object>} List of QueueItem objects.
   */
  getAdminQueueData: function() {
    const mainSsId = ConfigRepository.getSpreadsheetId();
    if (!mainSsId) return [];

    const ss = SpreadsheetApp.openById(mainSsId);
    const forms = FormManagementService.getFormList();
    const mergedQueue = [];

    forms.forEach(f => {
      try {
        const rawSheet = FormManagementService.resolveFormTab_(ss, f);
        if (rawSheet && rawSheet.getLastRow() > 1) {
          const rawValues = rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, rawSheet.getLastColumn()).getValues();
          rawValues.forEach(row => {
            if (row[0] || row[1]) {
              const photoVal = String(row[8] || '');
              const severityVal = String(row[9] || row[8] || ReportSeverity.NORMAL).toLowerCase();
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
                photoUrl: photoVal.startsWith('http') ? photoVal : '',
                severity: severityVal,
                rank: (severityVal === ReportSeverity.URGENT) ? 1 : ((severityVal === ReportSeverity.WARNING) ? 2 : 3),
                category: String(row[10] || 'ROUTINE'),
                reviewStatus: String(row[11] || row[10] || ReviewStatus.UNREVIEWED)
              }));
            }
          });
        }
      } catch (err) {
        Logger.log(`SpreadsheetRepository Notice: Could not read sheet tab for form ${f.id}: ${err.toString()}`);
      }
    });

    // Process single shared Sensitive sheet
    try {
      const sensitiveSheet = ss.getSheetByName('Sensitive') || ss.getSheetByName(SHEET_NAMES.SENSITIVE_RESTRICTED);
      if (sensitiveSheet && sensitiveSheet.getLastRow() > 1) {
        const sensitiveValues = sensitiveSheet.getRange(2, 1, sensitiveSheet.getLastRow() - 1, sensitiveSheet.getLastColumn()).getValues();
        sensitiveValues.forEach(row => {
          if (row[0] || row[1]) {
            const photoVal = String(row[7] || '');
            const severityVal = String(row[8] || ReportSeverity.WARNING).toLowerCase();
            mergedQueue.push(QueueItem({
              source: `Laporan Sensitif / Insiden`,
              reportId: String(row[0] || ''),
              timestamp: formatDate(row[1] || new Date()),
              empId: String(row[2] || ''),
              site: String(row[3] || ''),
              date: formatDate(row[4] || new Date()),
              detail: String(row[5] || '-'),
              yieldOrSensitive: String(row[6] || 'YES'),
              issues: 'Informasi Sensitif',
              photoUrl: photoVal.startsWith('http') ? photoVal : '',
              severity: severityVal,
              rank: 2,
              category: String(row[9] || 'RESTRICTED'),
              reviewStatus: String(row[10] || ReviewStatus.UNREVIEWED_SENSITIVE)
            }));
          }
        });
      }
    } catch (e) {}

    // Sort queue items by timestamp descending
    mergedQueue.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    return mergedQueue;
  },

  /**
   * Updates Review_Status of a report by matching Report_ID across all tabs of integrated spreadsheet.
   * Single file open performance optimization.
   * @param {string} reportId 
   * @param {string} newStatus 
   * @returns {{ success: boolean, reportId: string, sheet?: string, updatedStatus?: string, error?: string }}
   */
  updateReviewStatus: function(reportId, newStatus) {
    const mainSsId = ConfigRepository.getSpreadsheetId();
    if (!mainSsId) return { success: false, error: 'Spreadsheet ID belum dikonfigurasi.' };

    try {
      const ss = SpreadsheetApp.openById(mainSsId);
      const sheets = ss.getSheets();

      for (let s = 0; s < sheets.length; s++) {
        const sheet = sheets[s];
        if (sheet.getLastRow() <= 1) continue;

        const data = sheet.getDataRange().getValues();
        const lastCol = sheet.getLastColumn();

        for (let r = 1; r < data.length; r++) {
          if (String(data[r][0] || '').trim() === String(reportId).trim()) {
            sheet.getRange(r + 1, lastCol).setValue(newStatus);
            Logger.log(`SpreadsheetRepository: Updated Report_ID ${reportId} status to ${newStatus} in sheet tab ${sheet.getName()}`);
            return {
              success: true,
              reportId: reportId,
              sheet: sheet.getName(),
              updatedStatus: newStatus
            };
          }
        }
      }
    } catch (err) {
      Logger.log(`SpreadsheetRepository Notice: Error updating review status: ${err.toString()}`);
    }

    return { success: false, reportId: reportId, error: 'Report_ID tidak ditemukan di sheet.' };
  },

  /**
   * Calculates dashboard summary statistics across all form tabs inside integrated spreadsheet.
   * Single file open performance optimization.
   * @returns {Object} Dashboard stats payload.
   */
  getDashboardStatsData: function() {
    const mainSsId = ConfigRepository.getSpreadsheetId();
    if (!mainSsId) return {};

    const ss = SpreadsheetApp.openById(mainSsId);
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
      try {
        const rawSheet = FormManagementService.resolveFormTab_(ss, f);
        if (rawSheet && rawSheet.getLastRow() > 1) {
          const values = rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, rawSheet.getLastColumn()).getValues();
          values.forEach(row => {
            if (row[0] || row[1]) {
              totalReports++;
              const site = String(row[3] || '');
              if (siteBreakdown.hasOwnProperty(site)) siteBreakdown[site]++;

              const yieldVal = parseFloat(row[6]) || 0;
              totalYieldKg += yieldVal;

              const severity = String(row[9] || row[8] || 'normal').toLowerCase();
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
      } catch (err) {}
    });

    // Process single shared Sensitive sheet
    try {
      const sensitiveSheet = ss.getSheetByName('Sensitive') || ss.getSheetByName(SHEET_NAMES.SENSITIVE_RESTRICTED);
      if (sensitiveSheet && sensitiveSheet.getLastRow() > 1) {
        const values = sensitiveSheet.getRange(2, 1, sensitiveSheet.getLastRow() - 1, sensitiveSheet.getLastColumn()).getValues();
        values.forEach(row => {
          if (row[0] || row[1]) {
            totalReports++;
            sensitiveCount++;
            const site = String(row[3] || '');
            if (siteBreakdown.hasOwnProperty(site)) siteBreakdown[site]++;

            const severity = String(row[8] || row[7] || 'warning').toLowerCase();
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

    return {
      totalReports: totalReports,
      totalYieldKg: Math.round(totalYieldKg * 100) / 100,
      totalYield: Math.round(totalYieldKg * 100) / 100,
      urgentCount: urgentCount,
      sensitiveCount: sensitiveCount,
      normalCount: severityDist.normal,
      warningCount: severityDist.warning,
      siteBreakdown: siteBreakdown,
      siteCounts: [
        siteBreakdown['Site A — Kebun & Lahan Pertanian'] || 0,
        siteBreakdown['Site B — Peternakan & Kandang'] || 0,
        siteBreakdown['Site C — Pabrik Pengolahan & Pakan'] || 0,
        siteBreakdown['Site D — Logistik & Gudang'] || 0
      ],
      yieldBreakdown: yieldBreakdown,
      severityDist: severityDist
    };
  },

  /**
   * Archives closed reports older than retentionDays across all tabs in integrated spreadsheet.
   * Single file open performance optimization.
   * @param {number} retentionDays 
   * @returns {{ success: boolean, totalArchived: number }}
   */
  archiveClosedReports: function(retentionDays = 30) {
    const mainSsId = ConfigRepository.getSpreadsheetId();
    if (!mainSsId) return { success: false, totalArchived: 0 };

    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    let totalArchived = 0;

    try {
      const ss = SpreadsheetApp.openById(mainSsId);
      let archiveSheet = ss.getSheetByName(SHEET_NAMES.ARCHIVE_REPORTS);
      if (!archiveSheet) {
        archiveSheet = ss.insertSheet(SHEET_NAMES.ARCHIVE_REPORTS);
        archiveSheet.getRange('A1:M1').setValues([[
          'Report_ID', 'Timestamp', 'Emp_ID', 'Site', 'Date', 'Details', 
          'Yield_Kg_Or_Sensitive', 'Issues', 'Foto_Lampiran', 'Severity', 'Rank', 'Category', 'Review_Status', 'Archived_At'
        ]]);
        archiveSheet.getRange('A1:M1').setFontWeight('bold').setBackground('#e2e8f0');
        archiveSheet.setFrozenRows(1);
      }

      const forms = FormManagementService.getFormList();
      const sheetsToScan = forms.map(f => FormManagementService.resolveFormTab_(ss, f)).concat([ss.getSheetByName('Sensitive')]).filter(Boolean);

      sheetsToScan.forEach(sheet => {
        if (!sheet || sheet.getLastRow() <= 1) return;

        const values = sheet.getDataRange().getValues();
        const lastCol = sheet.getLastColumn();

        for (let r = values.length - 1; r >= 1; r--) {
          const row = values[r];
          const status = String(row[lastCol - 1] || '').toLowerCase().trim();
          const dateVal = row[4] || row[1];
          const rowTime = dateVal ? new Date(dateVal).getTime() : 0;

          if (status === 'closed' || status === 'ditutup' || status === 'reviewed') {
            if (rowTime && rowTime < cutoffTime) {
              const archiveRowData = row.concat([formatDate(new Date())]);
              archiveSheet.appendRow(archiveRowData);
              sheet.deleteRow(r + 1);
              totalArchived++;
            }
          }
        }
      });
    } catch (err) {
      Logger.log(`SpreadsheetRepository Error archiving closed reports: ${err.toString()}`);
    }

    Logger.log(`SpreadsheetRepository: Archived ${totalArchived} closed reports.`);
    return { success: true, totalArchived: totalArchived };
  }
};

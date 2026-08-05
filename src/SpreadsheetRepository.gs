/**
 * SpreadsheetRepository.gs — Database Abstraction & Data Access Object (DAO)
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: INFRASTRUCTURE / REPOSITORY
 * Responsibility: Performs all low-level Google Sheets API reads, writes, schema lookups,
 * multi-sheet queue aggregation across per-form dedicated spreadsheets, historical data migration triggers, 
 * and row highlighting formatting.
 */

const SpreadsheetRepository = {

  /**
   * Returns central Spreadsheet instance.
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
   * Relocates a sensitive report row from its source sheet to the Sensitive tab of its spreadsheet.
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
   * Fetches unified Admin Triage Queue across all per-form dedicated spreadsheets.
   * Auto-triggers historical data migration if per-form dedicated spreadsheets are empty.
   * Merges, ranks, and sorts report items chronologically.
   * @returns {Array<Object>} List of QueueItem objects.
   */
  getAdminQueueData: function() {
    const forms = FormManagementService.getFormList();
    const mergedQueue = [];

    forms.forEach(f => {
      if (!f.sheetId) return;
      try {
        const ss = SpreadsheetApp.openById(f.sheetId);
        const cleanTitle = (f.title || '').trim();
        
        // 1. Read primary response sheet
        const rawSheet = (cleanTitle ? ss.getSheetByName(cleanTitle) : null) || 
                         ss.getSheetByName('Raw') || 
                         ss.getSheetByName(SHEET_NAMES.DAILY_RAW) || 
                         ss.getSheetByName(SHEET_NAMES.GENERAL_RAW) || 
                         ss.getSheets()[0];

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

    // Auto-migrate historical rows from central spreadsheet if per-form sheets were empty
    if (mergedQueue.length === 0) {
      try {
        Logger.log('SpreadsheetRepository: No per-form rows found. Triggering historical data migration...');
        const migrationResult = FormManagementService.migrateHistoricalDataToPerFormSheets();
        if (migrationResult.dailyCount > 0 || migrationResult.generalCount > 0 || migrationResult.sensitiveCount > 0) {
          // Re-run getAdminQueueData recursively once to read the newly migrated rows!
          return this.getAdminQueueData();
        }
      } catch (migrationErr) {
        Logger.log('SpreadsheetRepository Warning: Auto-migration failed: ' + migrationErr.toString());
      }
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
          if (sheet.getLastRow() <= 1) continue;

          const data = sheet.getDataRange().getValues();
          const lastCol = sheet.getLastColumn();

          for (let r = 1; r < data.length; r++) {
            if (String(data[r][0] || '').trim() === String(reportId).trim()) {
              sheet.getRange(r + 1, lastCol).setValue(newStatus);
              Logger.log(`SpreadsheetRepository: Updated Report_ID ${reportId} status to ${newStatus} in sheet ${form.sheetId} (${sheet.getName()})`);
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
        Logger.log(`SpreadsheetRepository Notice: Error updating review status for form ${form.id}: ${err.toString()}`);
      }
    }

    return { success: false, reportId: reportId, error: 'Report_ID tidak ditemukan di spreadsheet manapun.' };
  },

  /**
   * Calculates dashboard summary statistics across all per-form dedicated spreadsheets.
   * @returns {Object} Dashboard stats payload.
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
        const cleanTitle = (f.title || '').trim();
        
        // 1. Process primary response sheet
        const rawSheet = (cleanTitle ? ss.getSheetByName(cleanTitle) : null) || ss.getSheetByName('Raw') || ss.getSheets()[0];
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
  },

  /**
   * Archives closed reports older than retentionDays across all dedicated per-form spreadsheets.
   * @param {number} retentionDays 
   * @returns {{ success: boolean, totalArchived: number }}
   */
  archiveClosedReports: function(retentionDays = 30) {
    const forms = FormManagementService.getFormList();
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    let totalArchived = 0;

    forms.forEach(form => {
      if (!form.sheetId) return;

      try {
        const ss = SpreadsheetApp.openById(form.sheetId);
        let archiveSheet = ss.getSheetByName(SHEET_NAMES.ARCHIVE_REPORTS);
        if (!archiveSheet) {
          archiveSheet = ss.insertSheet(SHEET_NAMES.ARCHIVE_REPORTS);
          archiveSheet.getRange('A1:M1').setValues([[
            'Report_ID', 'Timestamp', 'Emp_ID', 'Site', 'Date', 'Details', 
            'Yield_Kg_Or_Sensitive', 'Issues', 'Severity', 'Rank', 'Category', 'Review_Status', 'Archived_At'
          ]]);
          archiveSheet.getRange('A1:M1').setFontWeight('bold').setBackground('#e2e8f0');
          archiveSheet.setFrozenRows(1);
        }

        const cleanTitle = (form.title || '').trim();
        const primarySheet = (cleanTitle ? ss.getSheetByName(cleanTitle) : null) || ss.getSheetByName('Raw') || ss.getSheets()[0];
        const sensitiveSheet = ss.getSheetByName('Sensitive');

        const sheetsToScan = [primarySheet, sensitiveSheet].filter(Boolean);
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
        Logger.log(`SpreadsheetRepository Error archiving sheet ${form.sheetId}: ${err.toString()}`);
      }
    });

    Logger.log(`SpreadsheetRepository: Archived ${totalArchived} closed reports.`);
    return { success: true, totalArchived: totalArchived };
  }
};

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
   * Sets up header rows and formatting for all sheets during system setup.
   * @param {Sheet} mainSheet 
   * @param {Sheet} adminQueueSheet 
   * @param {Sheet} summarySheet 
   */
  setupSheetHeaders: function(mainSheet, adminQueueSheet, summarySheet) {
    // 1. Operational Raw Sheet (26 columns schema)
    if (mainSheet) {
      const opHeaders = [
        'Report_ID', 'Kode_Kegiatan', 'Kode_Kegiatan_Ref', 'Timestamp', 'Nama_PIC', 'Bidang_Divisi', 
        'Lokasi_Kegiatan', 'Jenis_Kegiatan', 'Target_Kegiatan', 'Luas_Area_Ha', 'Jumlah_Populasi', 
        'Tgl_Tanam', 'Tgl_CheckIn_Tebar', 'Tgl_Perkiraan_Panen', 'Tgl_Panen', 'Jumlah_Panen', 
        'Tgl_Penjualan', 'Harga_Jual', 'Jumlah_Penjualan_Unit', 'Nilai_Penjualan_Rp', 'Kendala', 
        'Upaya', 'Foto_URL', 'Severity', 'Flagged_Keywords', 'Reviewed'
      ];
      mainSheet.getRange(1, 1, 1, opHeaders.length).setValues([opHeaders]);
      mainSheet.getRange(1, 1, 1, opHeaders.length).setFontWeight('bold').setBackground('#f8fafc');
      mainSheet.setFrozenRows(1);
    }

    // 2. Admin Queue Sheet
    if (adminQueueSheet) {
      const queueHeaders = [
        'Sumber', 'Kode_Kegiatan', 'Timestamp', 'Nama_PIC', 'Bidang_Divisi', 
        'Lokasi_Kegiatan', 'Ringkasan', 'Tingkat_Keparahan', 'Kategori', 'Status_Peninjauan', 'Foto_URL'
      ];
      adminQueueSheet.getRange(1, 1, 1, queueHeaders.length).setValues([queueHeaders]);
      adminQueueSheet.getRange(1, 1, 1, queueHeaders.length).setFontWeight('bold').setBackground('#f1f5f9');
      adminQueueSheet.setFrozenRows(1);
    }

    // 3. Weekly Summary Sheet
    if (summarySheet) {
      const summaryHeaders = [
        'Week_Label', 'Site_Location', 'Daily_Reports_Count', 'General_Reports_Count', 
        'Total_Yield_Kg', 'Urgent_Incidents_Count', 'Warning_Reports_Count', 'Last_Updated'
      ];
      summarySheet.getRange(1, 1, 1, summaryHeaders.length).setValues([summaryHeaders]);
      summarySheet.getRange(1, 1, 1, summaryHeaders.length).setFontWeight('bold').setBackground('#e2e8f0');
      summarySheet.setFrozenRows(1);
    }
  },

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
   * Saves a new Operational Report into integrated spreadsheet.
   * @param {Object} report 
   * @param {Object} flag 
   * @returns {{ reportId: string, row: number, kodeKegiatan: string }}
   */
  saveOperationalReport: function(report, flag) {
    const ss = this.getSpreadsheet();
    const forms = FormManagementService.getFormList();
    const opForm = forms.find(f => (f.type || '').toLowerCase() === 'operasional' || f.isDefaultMain || f.isDefault) || { title: 'Laporan Operasional' };
    const sheet = FormManagementService.resolveFormTab_(ss, opForm);

    const reportId = report.reportId || this.generateUUID();
    const rowData = [
      reportId,
      report.kodeKegiatan || '',
      report.kodeKegiatanRef || '',
      report.timestamp || formatDate(new Date()),
      report.namaPic || '',
      report.bidangDivisi || '',
      report.lokasiKegiatan || '',
      report.jenisKegiatan || '',
      report.targetKegiatan || '',
      report.luasAreaHa || '',
      report.jumlahPopulasi || '',
      report.tglTanam || '',
      report.tglCheckInTebar || '',
      report.tglPerkiraanPanen || '',
      report.tglPanen || '',
      report.jumlahPanen || '',
      report.tglPenjualan || '',
      report.hargaJual || '',
      report.jumlahPenjualanUnit || '',
      report.nilaiPenjualanRp || '',
      report.kendala || '',
      report.upaya || '',
      report.fotoUrl || '',
      flag.severity || ReportSeverity.NORMAL,
      (flag.keywords || []).join(', '),
      ReviewStatus.UNREVIEWED
    ];

    sheet.appendRow(rowData);
    const newRowIndex = sheet.getLastRow();
    this.applyRowHighlighting(sheet, newRowIndex, flag.severity);

    return { reportId: reportId, row: newRowIndex, kodeKegiatan: report.kodeKegiatan };
  },

  /**
   * Builds a map of column header name to 0-based column index from row 1 of a sheet.
   * @param {Sheet} sheet 
   * @returns {Object.<string, number>}
   */
  getHeaderMap_: function(sheet) {
    if (!sheet || sheet.getLastColumn() === 0) return {};
    try {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const map = {};
      headers.forEach((h, idx) => {
        if (h) {
          map[String(h).trim()] = idx;
        }
      });
      return map;
    } catch (e) {
      return {};
    }
  },

  /**
   * Safely gets cell value from row array using header map, with positional fallback.
   * @param {Array} row 
   * @param {Object.<string, number>} headerMap 
   * @param {string} headerName 
   * @param {number} [fallbackIndex] 
   * @returns {*}
   */
  getCellValue_: function(row, headerMap, headerName, fallbackIndex) {
    if (headerMap && headerMap.hasOwnProperty(headerName)) {
      const idx = headerMap[headerName];
      return (idx !== undefined && idx < row.length) ? row[idx] : '';
    }
    return (fallbackIndex !== undefined && fallbackIndex < row.length) ? row[fallbackIndex] : '';
  },

  /**
   * Fetches unified Admin Triage Queue across all form tabs inside the single integrated spreadsheet.
   * Reads fields dynamically by header name.
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
          const headerMap = this.getHeaderMap_(rawSheet);
          const rawValues = rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, rawSheet.getLastColumn()).getValues();

          rawValues.forEach(row => {
            let reportId = String(this.getCellValue_(row, headerMap, 'Report_ID', 0) || '');
            let kodeKegiatan = String(this.getCellValue_(row, headerMap, 'Kode_Kegiatan', 1) || '-');
            let timestamp = formatDate(this.getCellValue_(row, headerMap, 'Timestamp', 3) || new Date());
            let namaPic = String(this.getCellValue_(row, headerMap, 'Nama_PIC', 4) || '-');
            let divisi = String(this.getCellValue_(row, headerMap, 'Bidang_Divisi', 5) || '-');
            let lokasi = String(this.getCellValue_(row, headerMap, 'Lokasi_Kegiatan', 6) || '-');
            let jenis = String(this.getCellValue_(row, headerMap, 'Jenis_Kegiatan', 7) || '');
            let tglPanen = this.getCellValue_(row, headerMap, 'Tgl_Panen', 14);
            let jumlahPanen = parseFloat(this.getCellValue_(row, headerMap, 'Jumlah_Panen', 15)) || 0;
            let nilaiPenjualan = parseFloat(this.getCellValue_(row, headerMap, 'Nilai_Penjualan_Rp', 19)) || 0;

            if (reportId || kodeKegiatan !== '-' || namaPic !== '-') {
              let ringkasan = jenis;
              if (jumlahPanen > 0) ringkasan += ` | Panen: ${jumlahPanen} Kg`;
              if (nilaiPenjualan > 0) ringkasan += ` | Jual: Rp ${nilaiPenjualan.toLocaleString('id-ID')}`;
              if (!ringkasan) ringkasan = 'Laporan Operasional';

              let photoVal = String(this.getCellValue_(row, headerMap, 'Foto_URL', 22) || '');
              let severityVal = String(this.getCellValue_(row, headerMap, 'Severity', 23) || ReportSeverity.NORMAL).toLowerCase();
              let keywordsVal = String(this.getCellValue_(row, headerMap, 'Flagged_Keywords', 24) || '');
              let reviewStatusVal = String(this.getCellValue_(row, headerMap, 'Reviewed', 25) || ReviewStatus.UNREVIEWED);

              mergedQueue.push(QueueItem({
                source: 'Operasional',
                reportId: reportId,
                kodeKegiatan: kodeKegiatan,
                timestamp: timestamp,
                namaPic: namaPic,
                divisi: divisi,
                lokasi: lokasi,
                ringkasan: ringkasan,
                photoUrl: photoVal.startsWith('http') ? photoVal : '',
                severity: severityVal,
                rank: severityVal === ReportSeverity.URGENT ? 1 : (severityVal === ReportSeverity.WARNING ? 2 : 3),
                category: keywordsVal ? keywordsVal : 'ROUTINE',
                reviewStatus: reviewStatusVal,
                raw: row
              }));
            }
          });
        }
      } catch (err) {
        Logger.log(`SpreadsheetRepository Notice: Could not read sheet tab for form ${f.id}: ${err.toString()}`);
      }
    });

    mergedQueue.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    return mergedQueue;
  },

  /**
   * Updates Review_Status of a report by matching Report_ID across all tabs of integrated spreadsheet.
   * @param {string} reportId 
   * @param {string} newStatus 
   * @returns {{ success: boolean, reportId: string, sheet?: string, updatedStatus?: string, error?: string }}
   */
  updateReviewStatus: function(reportId, newStatus) {
    const mainSsId = ConfigRepository.getSpreadsheetId();
    if (!mainSsId) {
      throw new Error('Spreadsheet ID belum dikonfigurasi.');
    }

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
   * Reads fields dynamically by header name.
   * @returns {Object} Dashboard stats payload.
   */
  getDashboardStatsData: function() {
    const mainSsId = ConfigRepository.getSpreadsheetId();
    if (!mainSsId) return {};

    const ss = SpreadsheetApp.openById(mainSsId);
    const forms = FormManagementService.getFormList();

    let totalReports = 0;
    let totalActiveKegiatan = 0;
    let totalPanenVolume = 0;
    let totalNilaiPenjualanRp = 0;
    let urgentCount = 0;
    let warningCount = 0;
    let normalCount = 0;

    const divisiBreakdown = {
      'Agro (Pertanian/Perkebunan)': 0,
      'Ternak (Peternakan)': 0,
      'Ikan (Perikanan)': 0
    };
    const severityDist = { normal: 0, warning: 0, urgent: 0 };

    forms.forEach(f => {
      try {
        const rawSheet = FormManagementService.resolveFormTab_(ss, f);
        if (rawSheet && rawSheet.getLastRow() > 1) {
          const headerMap = this.getHeaderMap_(rawSheet);
          const values = rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, rawSheet.getLastColumn()).getValues();

          values.forEach(row => {
            const reportId = String(this.getCellValue_(row, headerMap, 'Report_ID', 0) || '');
            const kodeKegiatan = String(this.getCellValue_(row, headerMap, 'Kode_Kegiatan', 1) || '');
            const namaPic = String(this.getCellValue_(row, headerMap, 'Nama_PIC', 4) || '');

            if (reportId || kodeKegiatan || namaPic) {
              totalReports++;
              const divisi = String(this.getCellValue_(row, headerMap, 'Bidang_Divisi', 5) || '');

              if (divisi.includes('Agro') || divisi.includes('Pertanian')) divisiBreakdown['Agro (Pertanian/Perkebunan)']++;
              else if (divisi.includes('Ternak') || divisi.includes('Peternakan')) divisiBreakdown['Ternak (Peternakan)']++;
              else if (divisi.includes('Ikan') || divisi.includes('Perikanan')) divisiBreakdown['Ikan (Perikanan)']++;
              else if (divisiBreakdown.hasOwnProperty(divisi)) divisiBreakdown[divisi]++;

              const tglPanen = this.getCellValue_(row, headerMap, 'Tgl_Panen', 14);
              const jumlahPanen = parseFloat(this.getCellValue_(row, headerMap, 'Jumlah_Panen', 15)) || 0;
              const nilaiPenjualan = parseFloat(this.getCellValue_(row, headerMap, 'Nilai_Penjualan_Rp', 19)) || 0;
              
              totalPanenVolume += jumlahPanen;
              totalNilaiPenjualanRp += nilaiPenjualan;

              if (jumlahPanen === 0 && (!tglPanen || String(tglPanen).trim() === '')) {
                totalActiveKegiatan++;
              }

              const severity = String(this.getCellValue_(row, headerMap, 'Severity', 23) || 'normal').toLowerCase();
              if (severity === ReportSeverity.URGENT) {
                urgentCount++;
                severityDist.urgent++;
              } else if (severity === ReportSeverity.WARNING) {
                warningCount++;
                severityDist.warning++;
              } else {
                normalCount++;
                severityDist.normal++;
              }
            }
          });
        }
      } catch (err) {
        Logger.log(`SpreadsheetRepository Error in getDashboardStatsData for form ${f.id}: ${err.toString()}`);
      }
    });

    return {
      totalReports: totalReports,
      totalActiveKegiatan: totalActiveKegiatan,
      totalPanenVolume: Math.round(totalPanenVolume * 100) / 100,
      totalNilaiPenjualanRp: totalNilaiPenjualanRp,
      urgentCount: urgentCount,
      warningCount: warningCount,
      normalCount: normalCount,
      divisiBreakdown: divisiBreakdown,
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

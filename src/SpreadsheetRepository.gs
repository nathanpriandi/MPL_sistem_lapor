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
   */
  setupSheetHeaders: function(mainSheet, adminQueueSheet, photoLogSheet) {
    // 1. Operational Raw Sheet (derived from single source of truth OPERATIONAL_REPORT_FIELDS)
    if (mainSheet) {
      const opHeaders = OPERATIONAL_REPORT_FIELDS.map(f => f.header);
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

    // 3. Photo Log Sheet
    if (photoLogSheet) {
      this.setupPhotoLogHeaders(photoLogSheet);
    }
  },

  setupPhotoLogHeaders: function(photoLogSheet) {
    if (photoLogSheet) {
      const photoLogHeaders = ['Report_ID', 'Kode_Kegiatan', 'Foto_URL', 'Drive_File_ID', 'Upload_Timestamp', 'Expiry_Date', 'Status'];
      photoLogSheet.getRange(1, 1, 1, photoLogHeaders.length).setValues([photoLogHeaders]);
      photoLogSheet.getRange(1, 1, 1, photoLogHeaders.length).setFontWeight('bold').setBackground('#f1f5f9');
      photoLogSheet.setFrozenRows(1);
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

    // Auto-verify & re-align Row 1 headers to match OPERATIONAL_REPORT_FIELDS (32 columns)
    const opHeaders = OPERATIONAL_REPORT_FIELDS.map(f => f.header);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, opHeaders.length).setValues([opHeaders]);
      sheet.getRange(1, 1, 1, opHeaders.length).setFontWeight('bold').setBackground('#f8fafc');
      sheet.setFrozenRows(1);
    } else {
      const currentHeaders = sheet.getRange(1, 1, 1, opHeaders.length).getValues()[0];
      const needsUpdate = opHeaders.some((h, idx) => String(currentHeaders[idx] || '').trim() !== String(h).trim());
      if (needsUpdate) {
        sheet.getRange(1, 1, 1, opHeaders.length).setValues([opHeaders]);
        sheet.getRange(1, 1, 1, opHeaders.length).setFontWeight('bold').setBackground('#f8fafc');
        sheet.setFrozenRows(1);
      }
    }

    const reportId = report.reportId || this.generateUUID();
    report.reportId = reportId;

    const rowData = OPERATIONAL_REPORT_FIELDS.map(field => field.getValue(report, flag));

    sheet.appendRow(rowData);
    const newRowIndex = sheet.getLastRow();
    this.applyRowHighlighting(sheet, newRowIndex, flag ? flag.severity : null);

    return { reportId: reportId, row: newRowIndex, kodeKegiatan: report.kodeKegiatan };
  },

  /**
   * Logs photo upload tracking entry into Photo_Log sheet tab.
   * @param {string} reportId 
   * @param {string} kodeKegiatan 
   * @param {string} fotoUrl 
   * @param {string} driveFileId 
   */
  logPhotoUpload: function(reportId, kodeKegiatan, fotoUrl, driveFileId) {
    try {
      const ss = this.getSpreadsheet();
      let sheet = ss.getSheetByName('Photo_Log');
      if (!sheet) {
        sheet = ss.insertSheet('Photo_Log');
        this.setupPhotoLogHeaders(sheet);
      }
      const now = new Date();
      const expiry = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
      sheet.appendRow([
        reportId || '',
        kodeKegiatan || '',
        fotoUrl || '',
        driveFileId || '',
        formatDate(now),
        formatDate(expiry),
        'Aktif'
      ]);
    } catch (e) {
      Logger.log('SpreadsheetRepository Error: Failed to log photo upload. ' + e.toString());
    }
  },

  /**
   * Scans Photo_Log for expired photos (>7 days old), trashes the Drive file,
   * updates status to 'Dihapus', and replaces Foto_URL in operational sheet with deletion marker.
   * @returns {{ success: boolean, purgedCount: number }}
   */
  purgeExpiredPhotos: function() {
    const DELETION_MARKER = '[Foto dihapus otomatis - 7 hari]';
    let purgedCount = 0;
    try {
      const ss = this.getSpreadsheet();
      const photoLogSheet = ss.getSheetByName('Photo_Log');
      if (!photoLogSheet || photoLogSheet.getLastRow() <= 1) {
        return { success: true, purgedCount: 0 };
      }

      const logValues = photoLogSheet.getRange(2, 1, photoLogSheet.getLastRow() - 1, 7).getValues();
      const forms = FormManagementService.getFormList();
      const opForm = forms.find(f => (f.type || '').toLowerCase() === 'operasional' || f.isDefaultMain || f.isDefault) || { title: 'Laporan Operasional' };
      const opSheet = FormManagementService.resolveFormTab_(ss, opForm);
      if (!opSheet) return { success: true, purgedCount: 0 };

      const headerMap = this.getHeaderMap_(opSheet);
      const fotoColIdx = (headerMap['Foto_URL'] !== undefined) ? (headerMap['Foto_URL'] + 1) : 29;
      const reportIdColIdx = (headerMap['Report_ID'] !== undefined) ? (headerMap['Report_ID'] + 1) : 1;

      const now = new Date();

      logValues.forEach((row, i) => {
        const reportId = String(row[0] || '');
        const fotoUrl = String(row[2] || '');
        const driveFileId = String(row[3] || '');
        const expiryDateRaw = row[5];
        const status = String(row[6] || '');

        if (status === 'Aktif' && expiryDateRaw) {
          const expiryDate = new Date(expiryDateRaw);
          if (now >= expiryDate) {
            // 1. Soft delete Drive file (30-day recovery in trash)
            if (driveFileId && typeof DriveApp !== 'undefined') {
              try {
                const file = DriveApp.getFileById(driveFileId);
                if (file) file.setTrashed(true);
              } catch (e) {
                Logger.log(`SpreadsheetRepository Notice: Could not trash Drive file ${driveFileId}: ${e.toString()}`);
              }
            }

            // 2. Mark Photo_Log as Dihapus
            photoLogSheet.getRange(i + 2, 7).setValue('Dihapus');

            // 3. Replace Foto_URL in Operational Sheet
            if (opSheet.getLastRow() > 1) {
              const opRows = opSheet.getRange(2, 1, opSheet.getLastRow() - 1, opSheet.getLastColumn()).getValues();
              for (let r = 0; r < opRows.length; r++) {
                const currentReportId = String(opRows[r][reportIdColIdx - 1] || '');
                const currentFotoUrl = String(opRows[r][fotoColIdx - 1] || '');
                if ((reportId && currentReportId === reportId) || (fotoUrl && currentFotoUrl === fotoUrl)) {
                  opSheet.getRange(r + 2, fotoColIdx).setValue(DELETION_MARKER);
                  break;
                }
              }
            }
            purgedCount++;
          }
        }
      });
    } catch (err) {
      Logger.log('SpreadsheetRepository Error in purgeExpiredPhotos: ' + err.toString());
    }
    return { success: true, purgedCount: purgedCount };
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
    const forms = FormManagementService.getRegisteredFormsRaw_ ? FormManagementService.getRegisteredFormsRaw_() : FormManagementService.getFormList({ lightweight: true });
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
            let jumlahPanen = parseFloat(this.getCellValue_(row, headerMap, 'Jumlah_Panen_Kg') || this.getCellValue_(row, headerMap, 'Jumlah_Panen', 15)) || 0;
            let nilaiPenjualan = parseFloat(this.getCellValue_(row, headerMap, 'Total_Harga_Rp') || this.getCellValue_(row, headerMap, 'Nilai_Penjualan_Rp', 19)) || 0;
            let kendalaVal = String(this.getCellValue_(row, headerMap, 'Kendala', 20) || '');
            let upayaVal = String(this.getCellValue_(row, headerMap, 'Upaya', 21) || '');

            if (reportId || kodeKegiatan !== '-' || namaPic !== '-') {
              let ringkasan = jenis;
              if (jumlahPanen > 0) ringkasan += ` | Panen: ${jumlahPanen} Kg`;
              if (nilaiPenjualan > 0) ringkasan += ` | Jual: Rp ${nilaiPenjualan.toLocaleString('id-ID')}`;
              if (!ringkasan) ringkasan = 'Laporan Operasional';

              let photoVal = String(this.getCellValue_(row, headerMap, 'Foto_URL') || '');
              if (!photoVal.startsWith('http')) {
                const foundUrl = row.find(c => typeof c === 'string' && c.trim().startsWith('http'));
                if (foundUrl) photoVal = String(foundUrl).trim();
              }

              let severityVal = String(this.getCellValue_(row, headerMap, 'Severity', 29) || ReportSeverity.NORMAL).toLowerCase();
              let keywordsVal = String(this.getCellValue_(row, headerMap, 'Flagged_Keywords', 30) || '');
              let reviewStatusVal = String(this.getCellValue_(row, headerMap, 'Reviewed', 31) || ReviewStatus.UNREVIEWED);

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
                jumlahPanen: jumlahPanen,
                nilaiPenjualanRp: nilaiPenjualan,
                kendala: kendalaVal,
                upaya: upayaVal,
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
   * Scoped to current calendar month with distinct activity grouping, per-division separation,
   * tiered overdue harvest detection, open obstacle tracking, and quiet site coverage.
   * @returns {Object} Comprehensive dashboard stats payload.
   */
  getDashboardStatsData: function() {
    const mainSsId = ConfigRepository.getSpreadsheetId();
    if (!mainSsId) return {};

    const ss = SpreadsheetApp.openById(mainSsId);
    const forms = FormManagementService.getRegisteredFormsRaw_ ? FormManagementService.getRegisteredFormsRaw_() : FormManagementService.getFormList({ lightweight: true });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11

    const INDO_MONTHS = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const currentPeriodLabel = `${INDO_MONTHS[currentMonth]} ${currentYear}`;

    const curMonthStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
    const curMonthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    const priorMonthStart = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
    const priorMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    const DIV_KEYS = {
      AGRO: 'Agro (Pertanian/Perkebunan)',
      TERNAK: 'Ternak (Peternakan)',
      IKAN: 'Ikan (Perikanan)'
    };

    function normalizeDivisi(divisiStr) {
      const s = String(divisiStr || '').toLowerCase();
      if (s.includes('agro') || s.includes('tani') || s.includes('kebun') || s.includes('pertanian') || s.includes('perkebunan')) {
        return DIV_KEYS.AGRO;
      }
      if (s.includes('ternak') || s.includes('kandang') || s.includes('peternakan')) {
        return DIV_KEYS.TERNAK;
      }
      if (s.includes('ikan') || s.includes('kolam') || s.includes('tambak') || s.includes('perikanan')) {
        return DIV_KEYS.IKAN;
      }
      return DIV_KEYS.AGRO;
    }

    function parseDateSafe(val) {
      if (!val) return null;
      if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }

    function formatDateOnly(d) {
      if (!d) return '-';
      try {
        return Utilities.formatDate(d, 'Asia/Jakarta', 'yyyy-MM-dd');
      } catch (e) {
        return String(d).split('T')[0];
      }
    }

    let totalReports = 0;
    let totalActiveKegiatan = 0;
    let totalNilaiPenjualanRp = 0;
    let priorMonthNilaiPenjualanRp = 0;

    let urgentCount = 0;
    let warningCount = 0;
    let normalCount = 0;

    let urgentOverdueCount = 0;
    let warningOverdueCount = 0;
    let openObstaclesCount = 0;
    let unansweredObstaclesCount = 0;

    const divisiBreakdown = {
      [DIV_KEYS.AGRO]: { activityCount: 0, rawReportCount: 0, panenVolume: 0, nilaiPenjualanRp: 0, unit: 'Kg' },
      [DIV_KEYS.TERNAK]: { activityCount: 0, rawReportCount: 0, panenVolume: 0, nilaiPenjualanRp: 0, unit: 'Ekor / Unit' },
      [DIV_KEYS.IKAN]: { activityCount: 0, rawReportCount: 0, panenVolume: 0, nilaiPenjualanRp: 0, unit: 'Kg' }
    };

    const severityDist = { normal: 0, warning: 0, urgent: 0 };
    const attentionList = [];
    const coverageMap = new Map();

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const monthShort = INDO_MONTHS[currentMonth].substring(0, 3);
    const weeklyTrend = [
      { weekLabel: `M1 (1-7 ${monthShort})`, agroSales: 0, ternakSales: 0, ikanSales: 0, agroPanen: 0, ternakPanen: 0, ikanPanen: 0, totalSales: 0 },
      { weekLabel: `M2 (8-14 ${monthShort})`, agroSales: 0, ternakSales: 0, ikanSales: 0, agroPanen: 0, ternakPanen: 0, ikanPanen: 0, totalSales: 0 },
      { weekLabel: `M3 (15-21 ${monthShort})`, agroSales: 0, ternakSales: 0, ikanSales: 0, agroPanen: 0, ternakPanen: 0, ikanPanen: 0, totalSales: 0 },
      { weekLabel: `M4 (22-${daysInMonth} ${monthShort})`, agroSales: 0, ternakSales: 0, ikanSales: 0, agroPanen: 0, ternakPanen: 0, ikanPanen: 0, totalSales: 0 }
    ];

    const currentMonthItems = [];
    const allKnownCodesSet = new Set();
    const parentCodeMap = new Map();

    // 1. First Pass: Read rows across all sheets and extract date & code information
    forms.forEach(f => {
      try {
        const rawSheet = FormManagementService.resolveFormTab_(ss, f);
        if (rawSheet && rawSheet.getLastRow() > 1) {
          const headerMap = this.getHeaderMap_(rawSheet);
          const values = rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, rawSheet.getLastColumn()).getValues();

          values.forEach(row => {
            const reportId = String(this.getCellValue_(row, headerMap, 'Report_ID', 0) || '').trim();
            const kodeKegiatan = String(this.getCellValue_(row, headerMap, 'Kode_Kegiatan', 1) || '').trim();
            const kodeKegiatanRef = String(this.getCellValue_(row, headerMap, 'Kode_Kegiatan_Ref', 2) || '').trim();
            const rawTimestamp = this.getCellValue_(row, headerMap, 'Timestamp', 3);
            const namaPic = String(this.getCellValue_(row, headerMap, 'Nama_PIC', 4) || '').trim();
            const divisiRaw = String(this.getCellValue_(row, headerMap, 'Bidang_Divisi', 5) || '').trim();
            const lokasi = String(this.getCellValue_(row, headerMap, 'Lokasi_Kegiatan', 6) || '').trim();
            const jenis = String(this.getCellValue_(row, headerMap, 'Jenis_Kegiatan', 7) || '').trim();

            const tglPerkiraanPanen = this.getCellValue_(row, headerMap, 'Tgl_Perkiraan_Panen', 13);
            const tglPanen = this.getCellValue_(row, headerMap, 'Tgl_Panen', 14);
            const jumlahPanen = parseFloat(this.getCellValue_(row, headerMap, 'Jumlah_Panen', 15)) || 0;
            const nilaiPenjualan = parseFloat(this.getCellValue_(row, headerMap, 'Nilai_Penjualan_Rp', 19)) || 0;
            const kendala = String(this.getCellValue_(row, headerMap, 'Kendala', 20) || '').trim();
            const upaya = String(this.getCellValue_(row, headerMap, 'Upaya', 21) || '').trim();
            const severity = String(this.getCellValue_(row, headerMap, 'Severity', 23) || 'normal').toLowerCase();

            if (!reportId && !kodeKegiatan && !namaPic) return;

            const rowDate = parseDateSafe(rawTimestamp) || parseDateSafe(tglPanen) || new Date();
            const normDivisi = normalizeDivisi(divisiRaw);

            // Track coverage for site/PIC across all records
            if (lokasi && namaPic) {
              const covKey = `${lokasi}|||${namaPic}`;
              const existingCov = coverageMap.get(covKey);
              if (!existingCov || (rowDate && rowDate.getTime() > existingCov.date.getTime())) {
                coverageMap.set(covKey, {
                  lokasi: lokasi,
                  namaPic: namaPic,
                  divisi: normDivisi,
                  date: rowDate,
                  dateStr: formatDateOnly(rowDate)
                });
              }
            }

            // Check prior month for trend calculation
            if (rowDate >= priorMonthStart && rowDate <= priorMonthEnd) {
              priorMonthNilaiPenjualanRp += nilaiPenjualan;
            }

            // Check current month inclusion
            if (rowDate >= curMonthStart && rowDate <= curMonthEnd) {
              if (kodeKegiatan) {
                allKnownCodesSet.add(kodeKegiatan);
              }

              currentMonthItems.push({
                reportId: reportId,
                kodeKegiatan: kodeKegiatan,
                kodeKegiatanRef: kodeKegiatanRef,
                date: rowDate,
                timestampStr: formatDateOnly(rowDate),
                namaPic: namaPic,
                divisi: normDivisi,
                lokasi: lokasi,
                jenis: jenis,
                tglPerkiraanPanen: tglPerkiraanPanen,
                tglPanen: tglPanen,
                jumlahPanen: jumlahPanen,
                nilaiPenjualan: nilaiPenjualan,
                kendala: kendala,
                upaya: upaya,
                severity: severity
              });
            }
          });
        }
      } catch (err) {
        Logger.log(`SpreadsheetRepository Error in getDashboardStatsData for form ${f.id}: ${err.toString()}`);
      }
    });

    // 2. Second Pass: Build distinct-activity tree & reconcile references
    allKnownCodesSet.forEach(code => parentCodeMap.set(code, code));
    currentMonthItems.forEach(item => {
      if (item.kodeKegiatan && item.kodeKegiatanRef && allKnownCodesSet.has(item.kodeKegiatanRef)) {
        parentCodeMap.set(item.kodeKegiatan, item.kodeKegiatanRef);
      }
    });

    function resolveRoot(code) {
      let curr = code;
      const visited = new Set();
      while (parentCodeMap.has(curr) && parentCodeMap.get(curr) !== curr && !visited.has(curr)) {
        visited.add(curr);
        curr = parentCodeMap.get(curr);
      }
      return curr;
    }

    const distinctActivitiesSet = new Set();
    const divisiActivitiesMap = {
      [DIV_KEYS.AGRO]: new Set(),
      [DIV_KEYS.TERNAK]: new Set(),
      [DIV_KEYS.IKAN]: new Set()
    };

    // 3. Process current month aggregation metrics
    currentMonthItems.forEach(item => {
      totalReports++;

      // Distinct activity key calculation
      let activityRootKey = '';
      if (item.kodeKegiatan) {
        activityRootKey = resolveRoot(item.kodeKegiatan);
      } else {
        activityRootKey = `_anon_${item.reportId || Math.random()}`;
      }
      distinctActivitiesSet.add(activityRootKey);

      // Divisional breakdown aggregation
      const divObj = divisiBreakdown[item.divisi] || divisiBreakdown[DIV_KEYS.AGRO];
      divObj.rawReportCount++;
      divObj.panenVolume += item.jumlahPanen;
      divObj.nilaiPenjualanRp += item.nilaiPenjualan;
      if (divisiActivitiesMap[item.divisi]) {
        divisiActivitiesMap[item.divisi].add(activityRootKey);
      }

      totalNilaiPenjualanRp += item.nilaiPenjualan;

      // Active kegiatan awaiting harvest (no harvest date and 0 harvest yield)
      const tglPanenStr = String(item.tglPanen || '').trim();
      if (item.jumlahPanen === 0 && (!tglPanenStr || tglPanenStr === '-')) {
        totalActiveKegiatan++;
      }

      // Severity Distribution
      if (item.severity === ReportSeverity.URGENT) {
        urgentCount++;
        severityDist.urgent++;
      } else if (item.severity === ReportSeverity.WARNING) {
        warningCount++;
        severityDist.warning++;
      } else {
        normalCount++;
        severityDist.normal++;
      }

      // Overdue Harvest Evaluation
      // (Tgl_Panen is empty and Tgl_Perkiraan_Panen is in the past: 8-14 days = warning, 15+ days = urgent)
      if (!tglPanenStr || tglPanenStr === '-') {
        const perkiraanDate = parseDateSafe(item.tglPerkiraanPanen);
        if (perkiraanDate && perkiraanDate.getTime() < now.getTime()) {
          const diffMs = now.getTime() - perkiraanDate.getTime();
          const daysLate = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          if (daysLate >= 8) {
            const isUrgent = daysLate >= 15;
            const itemSev = isUrgent ? ReportSeverity.URGENT : ReportSeverity.WARNING;
            if (isUrgent) urgentOverdueCount++;
            else warningOverdueCount++;

            attentionList.push({
              id: item.reportId || item.kodeKegiatan || `overdue_${Math.random()}`,
              type: 'overdue_harvest',
              severity: itemSev,
              rank: isUrgent ? 1 : 2,
              badgeLabel: isUrgent ? 'Panen Sangat Terlambat' : 'Panen Terlambat',
              kodeKegiatan: item.kodeKegiatan || '-',
              lokasi: item.lokasi || '-',
              pic: item.namaPic || '-',
              divisi: item.divisi,
              details: `Perkiraan panen ${formatDateOnly(perkiraanDate)} (${daysLate} hari lewat). Belum terealisasi.`,
              daysLate: daysLate,
              timestamp: item.timestampStr
            });
          }
        }
      }

      // Open Obstacles Evaluation
      if (item.kendala && item.kendala !== '-') {
        openObstaclesCount++;
        const hasNoUpaya = !item.upaya || item.upaya === '-';
        if (hasNoUpaya) unansweredObstaclesCount++;

        const itemSev = hasNoUpaya ? ReportSeverity.URGENT : ReportSeverity.WARNING;
        attentionList.push({
          id: item.reportId || item.kodeKegiatan || `obstacle_${Math.random()}`,
          type: 'open_obstacle',
          severity: itemSev,
          rank: hasNoUpaya ? 1 : 2,
          badgeLabel: hasNoUpaya ? 'Kendala Tanpa Upaya' : 'Kendala Lapangan',
          kodeKegiatan: item.kodeKegiatan || '-',
          lokasi: item.lokasi || '-',
          pic: item.namaPic || '-',
          divisi: item.divisi,
          details: `Kendala: "${item.kendala}"${!hasNoUpaya ? ' | Upaya: "' + item.upaya + '"' : ' | ⚠️ Belum ada upaya penanganan tercatat'}`,
          kendala: item.kendala,
          upaya: item.upaya,
          hasNoUpaya: hasNoUpaya,
          timestamp: item.timestampStr
        });
      }

      // Weekly trend bucketing
      if (item.date) {
        const dayOfMonth = item.date.getDate();
        let bIdx = 0;
        if (dayOfMonth >= 22) bIdx = 3;
        else if (dayOfMonth >= 15) bIdx = 2;
        else if (dayOfMonth >= 8) bIdx = 1;
        else bIdx = 0;

        if (item.divisi === DIV_KEYS.AGRO) {
          weeklyTrend[bIdx].agroSales += item.nilaiPenjualan;
          weeklyTrend[bIdx].agroPanen += item.jumlahPanen;
        } else if (item.divisi === DIV_KEYS.TERNAK) {
          weeklyTrend[bIdx].ternakSales += item.nilaiPenjualan;
          weeklyTrend[bIdx].ternakPanen += item.jumlahPanen;
        } else if (item.divisi === DIV_KEYS.IKAN) {
          weeklyTrend[bIdx].ikanSales += item.nilaiPenjualan;
          weeklyTrend[bIdx].ikanPanen += item.jumlahPanen;
        }
        weeklyTrend[bIdx].totalSales += item.nilaiPenjualan;
      }
    });

    // Populate distinct activity counts per division
    Object.keys(divisiBreakdown).forEach(k => {
      divisiBreakdown[k].activityCount = (divisiActivitiesMap[k] ? divisiActivitiesMap[k].size : 0);
      divisiBreakdown[k].panenVolume = Math.round(divisiBreakdown[k].panenVolume * 100) / 100;
    });

    // 4. Site/PIC Inactivity Check (Quiet sites: 14+ days)
    coverageMap.forEach((entry) => {
      if (entry.date) {
        const diffMs = now.getTime() - entry.date.getTime();
        const daysInactive = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (daysInactive >= 14) {
          attentionList.push({
            id: `quiet_${entry.lokasi}_${entry.namaPic}`,
            type: 'quiet_site_pic',
            severity: ReportSeverity.WARNING,
            rank: 2,
            badgeLabel: 'Lokasi & PIC Pasif',
            kodeKegiatan: '-',
            lokasi: entry.lokasi,
            pic: entry.namaPic,
            divisi: entry.divisi,
            details: `Tidak ada laporan masuk selama ${daysInactive} hari (terakhir: ${entry.dateStr}).`,
            daysInactive: daysInactive,
            timestamp: entry.dateStr
          });
        }
      }
    });

    // 5. Sort attention list: urgent (rank 1) before warning (rank 2); unanswered obstacles and longest overdue first
    attentionList.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.hasNoUpaya && !b.hasNoUpaya) return -1;
      if (!a.hasNoUpaya && b.hasNoUpaya) return 1;
      if (a.daysLate !== undefined && b.daysLate !== undefined) {
        return b.daysLate - a.daysLate;
      }
      return (b.daysInactive || 0) - (a.daysInactive || 0);
    });

    // 6. Month-over-month trend calculation
    const salesTrendPercent = priorMonthNilaiPenjualanRp > 0 
      ? Math.round(((totalNilaiPenjualanRp - priorMonthNilaiPenjualanRp) / priorMonthNilaiPenjualanRp) * 100)
      : null;

    return {
      currentPeriodLabel: currentPeriodLabel,
      totalReports: totalReports,
      distinctActivityCount: distinctActivitiesSet.size,
      totalActiveKegiatan: totalActiveKegiatan,
      totalNilaiPenjualanRp: totalNilaiPenjualanRp,
      priorMonthNilaiPenjualanRp: priorMonthNilaiPenjualanRp,
      salesTrendPercent: salesTrendPercent,
      divisiBreakdown: divisiBreakdown,
      overdueCounts: {
        urgent: urgentOverdueCount,
        warning: warningOverdueCount,
        total: urgentOverdueCount + warningOverdueCount
      },
      openObstaclesCount: openObstaclesCount,
      unansweredObstaclesCount: unansweredObstaclesCount,
      urgentCount: urgentCount,
      warningCount: warningCount,
      normalCount: normalCount,
      severityDist: severityDist,
      attentionList: attentionList,
      weeklyTrend: weeklyTrend
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

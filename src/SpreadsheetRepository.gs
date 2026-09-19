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
   * Applies robust high-contrast header formatting (dark slate font on neutral light-gray background).
   * Overrides any white text or default themes from Google Form bindings.
   * @param {Sheet} sheet 
   * @param {Array<string>} headers 
   */
  applyHeaderStyle: function(sheet, headers) {
    if (!sheet || !headers || headers.length === 0) return;
    const maxCols = sheet.getMaxColumns();
    if (maxCols < headers.length) {
      sheet.insertColumnsAfter(maxCols, headers.length - maxCols);
    }
    const range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    range.setFontWeight('bold')
         .setFontColor('#0f172a')         // High-contrast slate black text
         .setBackground('#e2e8f0')       // Clean neutral light gray background
         .setFontSize(10)
         .setVerticalAlignment('middle')
         .setWrap(false);
    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, 32);
  },

  /**
   * Sets up header rows and formatting for standard operational sheet tabs.
   * @param {Sheet} sheet 
   */
  setupSheetHeaders: function(sheet) {
    if (sheet) {
      const opHeaders = OPERATIONAL_REPORT_FIELDS.map(f => f.header);
      this.applyHeaderStyle(sheet, opHeaders);
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
    let ssId = ConfigRepository.getSpreadsheetId();
    if (ssId) {
      try {
        const ss = SpreadsheetApp.openById(ssId);
        if (ss) return ss;
      } catch (e) {
        Logger.log('SpreadsheetRepository: Configured SPREADSHEET_ID unavailable (' + ssId + '): ' + e.toString());
      }
    }
    
    // Auto-discovery from Drive if SPREADSHEET_ID is missing/invalid
    try {
      if (typeof DriveApp !== 'undefined') {
        const files = DriveApp.getFilesByName('Sistem Lapor MPL — Database Operasional');
        while (files.hasNext()) {
          const file = files.next();
          if (!file.isTrashed()) {
            ssId = file.getId();
            ConfigRepository.setProperty('SPREADSHEET_ID', ssId);
            return SpreadsheetApp.openById(ssId);
          }
        }
      }
    } catch (eDrive) {
      Logger.log('SpreadsheetRepository auto-discovery notice: ' + eDrive.toString());
    }

    // Auto-create central database spreadsheet if none exists
    try {
      const newSs = SpreadsheetApp.create('Sistem Lapor MPL — Database Operasional');
      ssId = newSs.getId();
      ConfigRepository.setProperty('SPREADSHEET_ID', ssId);
      let masterSheet = newSs.getSheets()[0];
      masterSheet.setName('Master_Laporan');
      const opHeaders = OPERATIONAL_REPORT_FIELDS.map(f => f.header);
      this.applyHeaderStyle(masterSheet, opHeaders);
      Logger.log('SpreadsheetRepository: Auto-created new central spreadsheet: ' + ssId);
      return newSs;
    } catch (eCreate) {
      Logger.log('SpreadsheetRepository Fatal Error creating spreadsheet: ' + eCreate.toString());
      throw new Error('Spreadsheet database tidak dapat diakses atau dibuat: ' + eCreate.toString());
    }
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
      sensitiveSheet.getRange('A1:J1').setValues([[
        'Report_ID', 'Timestamp', 'Emp_ID', 'Site', 'Date', 'Details', 
        'Sensitive_Flag', 'Foto_Lampiran', 'Severity', 'Reviewed'
      ]]);
      sensitiveSheet.getRange('A1:J1').setFontWeight('bold').setBackground('#fef2f2');
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
      ReviewStatus.UNVERIFIED
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
   * Validates and auto-repairs row 1 headers of a sheet to strictly match effectiveHeaders.
   * Seamlessly expands columns and applies header styling without mutating existing data.
   * @param {Sheet} sheet 
   * @param {Array<string>} effectiveHeaders 
   */
  ensureHeaderRow_: function(sheet, effectiveHeaders) {
    if (!sheet || !Array.isArray(effectiveHeaders) || effectiveHeaders.length === 0) return;
    
    // Ensure sheet has enough physical columns
    const maxCols = sheet.getMaxColumns();
    if (maxCols < effectiveHeaders.length) {
      sheet.insertColumnsAfter(maxCols, effectiveHeaders.length - maxCols);
    }

    if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
      this.applyHeaderStyle(sheet, effectiveHeaders);
      return;
    }
    const currentCols = sheet.getLastColumn();
    const currentHeaders = sheet.getRange(1, 1, 1, Math.max(currentCols, effectiveHeaders.length)).getValues()[0];
    const isMismatched = currentCols !== effectiveHeaders.length || 
                         effectiveHeaders.some((h, idx) => String(currentHeaders[idx] || '').trim() !== String(h).trim());
    if (isMismatched) {
      this.applyHeaderStyle(sheet, effectiveHeaders);
    }
  },

  /**
   * Synchronizes dynamic custom field headers across Master_Laporan and all active report tabs.
   * Ensures new custom fields are appended as headers with proper formatting without mutating existing row data.
   * @param {Array<Object>} customFields 
   * @returns {{ success: boolean, headersCount: number, customFieldsCount: number }}
   */
  syncSpreadsheetCustomHeaders: function(customFields) {
    const ss = this.getSpreadsheet();
    const effectiveHeaders = getEffectiveOperationalHeaders(customFields || []);

    // 1. Sync Master_Laporan
    let masterSheet = ss.getSheetByName('Master_Laporan');
    if (!masterSheet) {
      masterSheet = ss.insertSheet('Master_Laporan', 0);
    }
    this.ensureHeaderRow_(masterSheet, effectiveHeaders);

    // 2. Sync all active daily tabs (Laporan_YYYY-MM-DD)
    const sheets = ss.getSheets();
    sheets.forEach(s => {
      if (/^Laporan_\d{4}-\d{2}-\d{2}$/i.test(s.getName())) {
        this.ensureHeaderRow_(s, effectiveHeaders);
      }
    });
    
    Logger.log(`SpreadsheetRepository: Synced ${effectiveHeaders.length} headers (including ${customFields ? customFields.length : 0} custom fields) to Master_Laporan and daily sheets.`);
    return {
      success: true,
      headersCount: effectiveHeaders.length,
      customFieldsCount: customFields ? customFields.length : 0
    };
  },

  /**
   * Saves a new Operational Report into integrated spreadsheet.
   * Appends report to both Master_Laporan (permanent history) and Laporan_YYYY-MM-DD (active daily tab),
   * correctly populating standard 34 columns plus all dynamic custom field values.
   * @param {Object} report 
   * @param {Object} flag 
   * @returns {{ reportId: string, row: number, kodeKegiatan: string, tabName: string }}
   */
  saveOperationalReport: function(report, flag) {
    const ss = this.getSpreadsheet();
    const now = new Date();
    const dateStr = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyy-MM-dd');
    const tabName = 'Laporan_' + dateStr;

    // Retrieve active form schema for dynamic custom fields
    let customFields = [];
    try {
      const activeSchema = ConfigRepository.getReportingFormSchema();
      if (activeSchema && Array.isArray(activeSchema.customFields)) {
        customFields = activeSchema.customFields;
      }
    } catch (e) {
      Logger.log('SpreadsheetRepository: Notice reading active schema: ' + e.toString());
    }

    const effectiveHeaders = getEffectiveOperationalHeaders(customFields);

    const reportId = report.reportId || this.generateUUID();
    report.reportId = reportId;

    // 1. Base 34 standard values
    const baseRowData = OPERATIONAL_REPORT_FIELDS.map(field => field.getValue(report, flag));

    // 2. Dynamic custom field values mapped by label, id, or case-insensitive match
    const customResponses = report.customResponses || {};
    const customRowData = customFields.map(field => {
      let val = '';
      if (customResponses[field.label] !== undefined && customResponses[field.label] !== null) {
        val = customResponses[field.label];
      } else if (customResponses[field.id] !== undefined && customResponses[field.id] !== null) {
        val = customResponses[field.id];
      } else {
        const foundKey = Object.keys(customResponses).find(k => k.toLowerCase().trim() === String(field.label).toLowerCase().trim());
        if (foundKey) val = customResponses[foundKey];
      }
      return Array.isArray(val) ? val.join(', ') : String(val);
    });

    const fullRowData = baseRowData.concat(customRowData).map(val => {
      return (typeof SecurityService !== 'undefined' && SecurityService.InputSanitizer)
        ? SecurityService.InputSanitizer.sanitizeForSpreadsheet(val)
        : val;
    });

    // 1. Permanent Master Sheet Tab: Master_Laporan (Contains every single data ever submitted)
    let masterSheet = ss.getSheetByName('Master_Laporan');
    if (!masterSheet) {
      masterSheet = ss.insertSheet('Master_Laporan', 0);
    }
    this.ensureHeaderRow_(masterSheet, effectiveHeaders);
    masterSheet.appendRow(fullRowData);
    this.applyRowHighlighting(masterSheet, masterSheet.getLastRow(), flag ? flag.severity : null);

    // 2. Active Daily Tab: Laporan_YYYY-MM-DD (Created on-demand only when a report is submitted)
    let dailySheet = ss.getSheetByName(tabName);
    if (!dailySheet) {
      dailySheet = ss.insertSheet(tabName);
    }
    this.ensureHeaderRow_(dailySheet, effectiveHeaders);
    dailySheet.appendRow(fullRowData);
    const newRowIndex = dailySheet.getLastRow();
    this.applyRowHighlighting(dailySheet, newRowIndex, flag ? flag.severity : null);

    return { reportId: reportId, row: newRowIndex, kodeKegiatan: report.kodeKegiatan, tabName: tabName };
  },

  /**
   * Logs photo upload tracking entry.
   * Note: Photo_Log tab creation omitted as per client architecture directive. Photo URLs are stored directly in report rows.
   * @param {string} reportId 
   * @param {string} kodeKegiatan 
   * @param {string} fotoUrl 
   * @param {string} driveFileId 
   */
  logPhotoUpload: function(reportId, kodeKegiatan, fotoUrl, driveFileId) {
    // No-op: Photo URLs are persisted directly in Master_Laporan and daily sheets
    return;
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
   * Safely finds a field value from a row using fuzzy/synonym matching on headers.
   * Handles variations like "Estimasi Panen (HST)", "Tgl Tanam", "Estimasi_Panen_HST", etc.
   * @param {Array} row 
   * @param {Object.<string, number>} headerMap 
   * @param {string} fieldKey 
   * @param {string} primaryHeader 
   * @returns {*}
   */
  findRowValueByField_: function(row, headerMap, fieldKey, primaryHeader) {
    if (!headerMap || !row) return '';

    // 1. Direct match on primary header
    if (headerMap.hasOwnProperty(primaryHeader)) {
      const idx = headerMap[primaryHeader];
      if (idx !== undefined && idx < row.length) return row[idx];
    }

    // 2. Direct match with spaces instead of underscores
    const spaceHeader = primaryHeader.replace(/_/g, ' ');
    if (headerMap.hasOwnProperty(spaceHeader)) {
      const idx = headerMap[spaceHeader];
      if (idx !== undefined && idx < row.length) return row[idx];
    }

    // 3. Direct match on fieldKey
    if (headerMap.hasOwnProperty(fieldKey)) {
      const idx = headerMap[fieldKey];
      if (idx !== undefined && idx < row.length) return row[idx];
    }

    // 4. Normalized fuzzy search across headers (lowercase, stripped punctuation)
    const normKey = fieldKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normHeader = primaryHeader.toLowerCase().replace(/[^a-z0-9]/g, '');

    const headerKeys = Object.keys(headerMap);
    for (let i = 0; i < headerKeys.length; i++) {
      const h = headerKeys[i];
      const normH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      const idx = headerMap[h];
      if (idx === undefined || idx >= row.length) continue;

      if (normH === normKey || normH === normHeader) {
        return row[idx];
      }

      // Specific field alias matching
      if (fieldKey === 'anggotaTerlapor' && (normH === 'anggotaterlapor' || normH.includes('anggotaterlapor') || normH.includes('anggotatim') || normH.includes('anggotatimsga') || normH === 'tim' || normH === 'anggota')) {
        return row[idx];
      }
      if (fieldKey === 'estimasiPanenHst' && (normH.includes('estimasipanen') || normH.includes('hst') || normH.includes('perkiraanpanen') || normH.includes('umurpanen'))) {
        return row[idx];
      }
      if (fieldKey === 'tglTanam' && (normH.includes('tgltanam') || normH.includes('tanggaltanam'))) {
        return row[idx];
      }
      if (fieldKey === 'jumlahBenih' && (normH.includes('jumlahbenih') || normH.includes('benih') || normH.includes('bibit'))) {
        return row[idx];
      }
      if (fieldKey === 'luasLahanM2' && (normH === 'luaslahanm2' || normH === 'luaslahan' || normH.includes('luasarea') || normH.includes('luaslahantanam'))) {
        return row[idx];
      }
      if (fieldKey === 'luasLahanPanenM2' && (normH.includes('luaslahanpanen') || normH.includes('luaspanen'))) {
        return row[idx];
      }
      if ((fieldKey === 'lokasiBlok' || fieldKey === 'lokasiBlokTanam') && (normH.includes('lokasiblok') || normH.includes('bloktanam') || normH === 'blok' || normH === 'petak' || normH.includes('petaklahan'))) {
        return row[idx];
      }
      if (fieldKey === 'lokasiBlokPanen' && (normH.includes('lokasiblokpanen') || normH.includes('blokpanen') || normH.includes('petakpanen'))) {
        return row[idx];
      }
      if (fieldKey === 'komoditas' && (normH === 'komoditas' || normH.includes('komoditastanam') || normH === 'tanaman')) {
        return row[idx];
      }
      if (fieldKey === 'komoditasPanen' && (normH.includes('komoditaspanen') || normH.includes('hasilpanen'))) {
        return row[idx];
      }
      if (fieldKey === 'jumlahPanen' && (normH.includes('jumlahpanen') || normH.includes('volumepanen') || normH.includes('hasilpanenkg') || normH === 'panenkg')) {
        return row[idx];
      }
      if (fieldKey === 'totalHargaRp' && (normH.includes('totalharga') || normH.includes('nilaipenjualan') || normH.includes('hargatotal'))) {
        return row[idx];
      }
      if (fieldKey === 'jumlahPenjualanUnit' && (normH.includes('jumlahpenjualanunit') || normH.includes('unitpenjualan') || normH.includes('jumlahpenjualan'))) {
        return row[idx];
      }
      if (fieldKey === 'jumlahUnitPenggunaan' && (normH.includes('jumlahunitpenggunaan') || normH.includes('unitpenggunaan'))) {
        return row[idx];
      }
      if (fieldKey === 'tujuanPenggunaan' && (normH.includes('tujuanpenggunaan') || normH.includes('penggunaaninternal'))) {
        return row[idx];
      }
      if (fieldKey === 'tujuanDistribusi' && (normH.includes('tujuandistribusi') || normH.includes('distribusi'))) {
        return row[idx];
      }
      if (fieldKey === 'jenisTernak' && (normH.includes('jenisternak') || normH === 'ternak')) {
        return row[idx];
      }
      if (fieldKey === 'populasiTernak' && (normH.includes('populasiternak') || normH === 'populasi')) {
        return row[idx];
      }
      if (fieldKey === 'pakanMasukKg' && (normH.includes('pakanmasuk') || normH.includes('pakanmasukkg'))) {
        return row[idx];
      }
      if (fieldKey === 'pakanKeluarKg' && (normH.includes('pakankeluar') || normH.includes('pakankeluarkg'))) {
        return row[idx];
      }
      if (fieldKey === 'jenisKomoditasTernak' && (normH.includes('jeniskomoditasternak') || normH.includes('komoditasternak'))) {
        return row[idx];
      }
      if (fieldKey === 'jumlahPenjualanTernak' && (normH.includes('jumlahpenjualanternak') || normH.includes('penjualanternak'))) {
        return row[idx];
      }
      if (fieldKey === 'hargaSatuanTernakRp' && (normH.includes('hargasatuanternak'))) {
        return row[idx];
      }
      if (fieldKey === 'totalHargaTernakRp' && (normH.includes('totalhargaternak') || normH.includes('nilaiternak'))) {
        return row[idx];
      }
      if (fieldKey === 'rincianPerawatanAgro' && (normH.includes('rincianperawatan') || normH.includes('perawatanagro'))) {
        return row[idx];
      }
      if (fieldKey === 'ternakMasukKelahiranQty' && (normH.includes('kelahiran') || normH.includes('masukkelahiran'))) {
        return row[idx];
      }
      if (fieldKey === 'ternakMasukPembelianQty' && (normH.includes('pembelian') || normH.includes('masukpembelian'))) {
        return row[idx];
      }
      if (fieldKey === 'ternakKeluarKematianQty' && (normH.includes('kematian') || normH.includes('keluarkematian'))) {
        return row[idx];
      }
      if (fieldKey === 'ternakKeluarPenjualanQty' && (normH.includes('keluarpenjualan') || normH.includes('ternakkeluarpenjualan'))) {
        return row[idx];
      }
      if (fieldKey === 'ternakMasukQty' && (normH.includes('ternakmasukqty') || normH.includes('masukekor'))) {
        return row[idx];
      }
      if (fieldKey === 'ternakKeluarQty' && (normH.includes('ternakkeluarqty') || normH.includes('keluarekor'))) {
        return row[idx];
      }
    }

    return '';
  },

  /**
   * Discovers all report sheets (including Master_Laporan, daily tabs Laporan_YYYY-MM-DD, and canonical form tabs).
   * @param {Spreadsheet} ss 
   * @returns {Array<Sheet>} List of resolved report sheet objects.
   */
  getAllReportSheets_: function(ss) {
    if (!ss) ss = this.getSpreadsheet();
    const allSheets = ss.getSheets();
    const matched = [];
    const seenIds = new Set();

    // 0. Include Master_Laporan if present
    const masterSheet = ss.getSheetByName('Master_Laporan');
    if (masterSheet && !seenIds.has(masterSheet.getSheetId())) {
      matched.push(masterSheet);
      seenIds.add(masterSheet.getSheetId());
    }

    // 1. Find all daily tabs matching Laporan_YYYY-MM-DD
    allSheets.forEach(s => {
      const name = s.getName();
      if (/^Laporan_\d{4}-\d{2}-\d{2}$/.test(name)) {
        if (!seenIds.has(s.getSheetId())) {
          matched.push(s);
          seenIds.add(s.getSheetId());
        }
      }
    });

    // 2. Also include canonical form tabs for backward compatibility
    try {
      const forms = FormManagementService.getRegisteredFormsRaw_ ? FormManagementService.getRegisteredFormsRaw_() : FormManagementService.getFormList({ lightweight: true });
      forms.forEach(f => {
        try {
          const s = FormManagementService.resolveFormTab_(ss, f);
          if (s && !seenIds.has(s.getSheetId())) {
            seenIds.add(s.getSheetId());
            matched.push(s);
          }
        } catch (e) {}
      });
    } catch (e) {}

    return matched;
  },

  /**
   * Fetches unified Admin Triage Queue across all daily report tabs and registered form tabs.
   * Reads fields dynamically by header name and deduplicates across synced/mirror tabs.
   * @returns {Array<Object>} List of QueueItem objects.
   */
  getAdminQueueData: function() {
    let ss;
    try {
      ss = this.getSpreadsheet();
    } catch (e) {
      Logger.log('SpreadsheetRepository.getAdminQueueData: ' + e.toString());
      return [];
    }
    if (!ss) return [];

    // Auto-cleanup irrelevant/duplicate tabs if any stale legacy tabs are detected
    try {
      if (typeof cleanupIrrelevantSpreadsheetTabs === 'function') {
        const hasIrrelevant = ss.getSheets().some(s => {
          const n = s.getName().toLowerCase().trim();
          return n === 'admin_queue' || n === 'laporan_operasional_raw' || n === 'laporan operasional' || n === 'sensitive' || n === 'photo_log' || n.startsWith('form responses') || n.startsWith('jawaban formulir');
        });
        if (hasIrrelevant) {
          cleanupIrrelevantSpreadsheetTabs();
        }
      }
    } catch (eClean) {
      Logger.log('SpreadsheetRepository Notice: Stale tab auto-cleanup: ' + eClean.toString());
    }

    const sheets = this.getAllReportSheets_(ss);
    const mergedQueue = [];
    const seenFingerprints = new Set();

    sheets.forEach(sheet => {
      if (!sheet) return;
      const sheetName = sheet.getName();
      try {
        if (sheet.getLastRow() > 1) {
          const headerMap = this.getHeaderMap_(sheet);
          const headerNames = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
          const rawValues = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

          rawValues.forEach((row, rowIndex) => {
            const hasAnyData = row.some(c => c !== null && c !== undefined && String(c).trim().length > 0);
            if (!hasAnyData) return;

            let reportId = '';
            if (headerMap && headerMap.hasOwnProperty('Report_ID')) {
              reportId = String(row[headerMap['Report_ID']] || '').trim();
            }

            let kodeKegiatan = String(
              this.findRowValueByField_(row, headerMap, 'kodeKegiatan', 'Kode_Kegiatan') || 
              ''
            ).trim();

            let rawTime = this.findRowValueByField_(row, headerMap, 'timestamp', 'Timestamp') || this.findRowValueByField_(row, headerMap, 'waktu', 'Waktu');
            let timestamp = formatDate(rawTime || new Date());
            
            let namaPic = String(
              this.findRowValueByField_(row, headerMap, 'namaPic', 'Nama_PIC') || 
              this.findRowValueByField_(row, headerMap, 'empId', 'Emp_ID') || 
              ''
            ).trim();

            let divisi = String(
              this.findRowValueByField_(row, headerMap, 'bidangDivisi', 'Bidang_Divisi') || 
              this.findRowValueByField_(row, headerMap, 'divisi', 'Divisi') || 
              ''
            ).trim();

            let nomorTelepon = typeof normalizePhoneNumber === 'function' ? normalizePhoneNumber(
              this.findRowValueByField_(row, headerMap, 'nomorTelepon', 'Nomor_Telepon') || 
              ''
            ) : String(
              this.findRowValueByField_(row, headerMap, 'nomorTelepon', 'Nomor_Telepon') || 
              ''
            ).trim();

            let lokasi = String(
              this.findRowValueByField_(row, headerMap, 'lokasiKegiatan', 'Lokasi_Kegiatan') || 
              this.findRowValueByField_(row, headerMap, 'lokasi', 'Lokasi') || 
              ''
            ).trim();

            let jenis = String(
              this.findRowValueByField_(row, headerMap, 'jenisKegiatan', 'Jenis_Kegiatan') || 
              ''
            ).trim();

            let jumlahPanen = parseFloat(this.findRowValueByField_(row, headerMap, 'jumlahPanen', 'Jumlah_Panen_Kg') || 0) || 0;
            let totalHargaAgro = parseFloat(this.findRowValueByField_(row, headerMap, 'totalHargaRp', 'Total_Harga_Rp') || 0) || 0;
            let totalHargaTernak = parseFloat(this.findRowValueByField_(row, headerMap, 'totalHargaTernakRp', 'Total_Harga_Ternak_Rp') || 0) || 0;
            let nilaiPenjualan = totalHargaAgro + totalHargaTernak;
            let rawKendala = this.findRowValueByField_(row, headerMap, 'kendala', 'Kendala');
            let kendalaVal = typeof normalizeKendalaText === 'function' ? normalizeKendalaText(rawKendala) : String(rawKendala || '').trim();
            let upayaVal = kendalaVal ? String(this.findRowValueByField_(row, headerMap, 'upaya', 'Upaya') || '').trim() : '';
            let anggotaTerlaporVal = this.findRowValueByField_(row, headerMap, 'anggotaTerlapor', 'Anggota_Terlapor') || this.findRowValueByField_(row, headerMap, 'tim', 'Tim') || '';
            let ringkasan = jenis || `Laporan ${sheetName}`;

            // Multi-criteria robust deduplication across synced/response sheets
            const primaryKey = (kodeKegiatan && kodeKegiatan !== '-') 
              ? `KODE:${kodeKegiatan.toLowerCase()}`
              : (reportId && !reportId.startsWith('ROW_'))
                ? `ID:${reportId.toLowerCase()}`
                : `COMP:${timestamp}|${namaPic.toLowerCase()}|${lokasi.toLowerCase()}|${ringkasan.toLowerCase()}`;

            if (seenFingerprints.has(primaryKey)) return;
            seenFingerprints.add(primaryKey);

            if (!reportId || reportId === '-') {
              reportId = (kodeKegiatan && kodeKegiatan !== '-') ? kodeKegiatan : `ROW_${sheetName}_${rowIndex + 2}`;
            }

            function normalizePhotoLink(val) {
              if (!val) return '';
              let s = String(val).trim();
              if (!s || s === '-' || s === '[object Object]') return '';
              if (!s.startsWith('http')) {
                const fileIdMatch = s.match(/[-\w]{25,}/);
                if (fileIdMatch) {
                  return `https://drive.google.com/uc?export=view&id=${fileIdMatch[0]}`;
                }
              }
              return s;
            }

            let p1 = normalizePhotoLink(this.getCellValue_(row, headerMap, 'Foto_URL') || this.getCellValue_(row, headerMap, 'Foto_Lampiran'));
            let p2 = normalizePhotoLink(this.getCellValue_(row, headerMap, 'Foto_URL_2'));
            let p3 = normalizePhotoLink(this.getCellValue_(row, headerMap, 'Foto_URL_3'));
            const photosList = [p1, p2, p3].filter(Boolean);

            let severityVal = (kendalaVal && kendalaVal !== '-') ? ReportSeverity.URGENT : ReportSeverity.NORMAL;

            // Check all known header variations for status
            let rawReviewStatus = 
              this.getCellValue_(row, headerMap, 'Status Verifikasi') || 
              this.getCellValue_(row, headerMap, 'Status_Verifikasi') || 
              this.getCellValue_(row, headerMap, 'Status Peninjauan') || 
              this.getCellValue_(row, headerMap, 'Status_Peninjauan') || 
              this.getCellValue_(row, headerMap, 'Reviewed') || 
              this.getCellValue_(row, headerMap, 'Review_Status') || 
              this.getCellValue_(row, headerMap, 'Status');
            
            let reviewStatusVal = normalizeReviewStatus(rawReviewStatus);

            // Convert row cells to RPC-safe primitive values (convert Date objects to formatted strings)
            const safeRaw = row.map(cell => {
              if (cell instanceof Date) {
                const h = cell.getHours();
                const m = cell.getMinutes();
                const s = cell.getSeconds();
                if (h === 0 && m === 0 && s === 0) {
                  return Utilities.formatDate(cell, 'Asia/Jakarta', 'yyyy-MM-dd');
                }
                return formatDate(cell);
              }
              if (cell === null || cell === undefined) return '';
              if (typeof cell === 'object') return String(cell);
              return cell;
            });

            // Build full key-value question field details for modal inspector
            const fields = [];
            for (let c = 0; c < headerNames.length; c++) {
              const h = String(headerNames[c] || '').trim();
              let v = safeRaw[c];
              if (h && v !== undefined && v !== null && String(v).trim() !== '') {
                if (typeof v === 'string' && /tidak ada/i.test(v)) {
                  v = v.replace(/\s*\(\d+\s*ekor\)/gi, '').trim() || 'Tidak Ada';
                }
                if (/telepon|telp|phone|whatsapp/i.test(h) && typeof normalizePhoneNumber === 'function') {
                  v = normalizePhoneNumber(v);
                }
                fields.push({ label: h, value: v });
              }
            }

            mergedQueue.push(QueueItem({
              source: sheetName,
              reportId: reportId,
              kodeKegiatan: kodeKegiatan || '-',
              timestamp: timestamp,
              namaPic: namaPic || 'Tanpa Nama',
              empId: namaPic || 'Tanpa Nama',
              divisi: divisi || '-',
              nomorTelepon: nomorTelepon,
              lokasi: lokasi || '-',
              ringkasan: ringkasan,
              photoUrl: p1,
              photoUrl2: p2,
              photoUrl3: p3,
              photos: photosList,
              severity: severityVal,
              rank: severityVal === ReportSeverity.URGENT ? 1 : 2,
              reviewStatus: reviewStatusVal,
              jumlahPanen: jumlahPanen,
              nilaiPenjualanRp: nilaiPenjualan,
              kendala: kendalaVal,
              upaya: upayaVal,
              anggotaTerlapor: anggotaTerlaporVal,
              anggotaTerlaporText: anggotaTerlaporVal,
              fields: fields,
              raw: safeRaw
            }));
          });
        }
      } catch (err) {
        Logger.log(`SpreadsheetRepository Notice: Could not read sheet tab ${sheetName}: ${err.toString()}`);
      }
    });

    mergedQueue.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    return mergedQueue;
  },

  /**
   * Updates Review_Status of a report by matching Report_ID or Kode_Kegiatan or synthetic row index
   * across registered canonical form tabs.
   * Auto-provisions 'Status Verifikasi' column if not yet present in target tab.
   * @param {string} reportId 
   * @param {string} newStatus 
   * @returns {{ success: boolean, reportId: string, sheet?: string, updatedStatus?: string, error?: string }}
   */
  updateReviewStatus: function(reportId, newStatus) {
    const normalized = normalizeReviewStatus(newStatus);
    try {
      const ss = this.getSpreadsheet();
      if (!ss) throw new Error('Spreadsheet database tidak tersedia.');
      
      // Check if reportId is in synthetic format ROW_SheetName_RowNum
      let directSheetName = null;
      let directRowNum = null;
      if (String(reportId).startsWith('ROW_')) {
        const parts = String(reportId).split('_');
        if (parts.length >= 3) {
          directRowNum = parseInt(parts[parts.length - 1], 10);
          directSheetName = parts.slice(1, parts.length - 1).join('_');
        }
      }

      // Collect target sheets (both dynamic daily tabs, Master_Laporan, and canonical form tabs)
      const targetSheets = this.getAllReportSheets_(ss);
      if (directSheetName && !targetSheets.some(s => s.getName() === directSheetName)) {
        const directSheet = ss.getSheetByName(directSheetName);
        if (directSheet) targetSheets.unshift(directSheet);
      }

      const updatedSheets = [];
      let resolvedReportId = reportId;
      let resolvedKodeKegiatan = '';

      for (let s = 0; s < targetSheets.length; s++) {
        const sheet = targetSheets[s];
        const sheetName = sheet.getName();
        if (sheet.getLastRow() <= 1) continue;

        const data = sheet.getDataRange().getValues();
        const headerRow = data[0];
        const headers = headerRow.map(h => String(h || '').trim().toLowerCase());

        // Find or provision Status Verifikasi column (checking exact same header variants as getAdminQueueData)
        let reviewColIdx = headers.indexOf('status verifikasi');
        if (reviewColIdx === -1) reviewColIdx = headers.indexOf('status_verifikasi');
        if (reviewColIdx === -1) reviewColIdx = headers.indexOf('status peninjauan');
        if (reviewColIdx === -1) reviewColIdx = headers.indexOf('status_peninjauan');
        if (reviewColIdx === -1) reviewColIdx = headers.indexOf('reviewed');
        if (reviewColIdx === -1) reviewColIdx = headers.indexOf('review_status');
        if (reviewColIdx === -1) reviewColIdx = headers.indexOf('status');

        if (reviewColIdx === -1) {
          const newCol = sheet.getLastColumn() + 1;
          sheet.getRange(1, newCol).setValue('Status Verifikasi').setFontWeight('bold').setBackground('#f1f5f9');
          reviewColIdx = newCol - 1;
        }

        const reportIdCol = headers.indexOf('report_id') !== -1 ? headers.indexOf('report_id') : headers.indexOf('report id');
        const kodeCol = headers.indexOf('kode_kegiatan') !== -1 ? headers.indexOf('kode_kegiatan') : headers.indexOf('kode kegiatan');

        // 1. Direct row match if synthetic row ID matches this sheet
        if (directSheetName && directSheetName === sheetName && directRowNum && directRowNum <= sheet.getLastRow()) {
          sheet.getRange(directRowNum, reviewColIdx + 1).setValue(normalized);
          updatedSheets.push(sheetName);
          Logger.log(`SpreadsheetRepository: Updated direct row ${directRowNum} status to ${normalized} in ${sheetName}`);
          
          // Extract actual reportId or kodeKegiatan from direct row to propagate to mirrored sheets
          const directRow = data[directRowNum - 1];
          if (directRow) {
            if (reportIdCol !== -1 && directRow[reportIdCol]) resolvedReportId = String(directRow[reportIdCol]).trim();
            if (kodeCol !== -1 && directRow[kodeCol]) resolvedKodeKegiatan = String(directRow[kodeCol]).trim();
          }
          continue;
        }

        // 2. Scan rows by Report_ID, Kode_Kegiatan, or resolved IDs
        for (let r = 1; r < data.length; r++) {
          const row = data[r];
          let isMatch = false;

          const rowReportId = reportIdCol !== -1 ? String(row[reportIdCol] || '').trim() : '';
          const rowKode = kodeCol !== -1 ? String(row[kodeCol] || '').trim() : '';

          if (rowReportId && (rowReportId === String(reportId).trim() || (resolvedReportId && rowReportId === resolvedReportId))) {
            isMatch = true;
          } else if (rowKode && (rowKode === String(reportId).trim() || (resolvedKodeKegiatan && rowKode === resolvedKodeKegiatan))) {
            isMatch = true;
          }

          if (isMatch) {
            sheet.getRange(r + 1, reviewColIdx + 1).setValue(normalized);
            updatedSheets.push(sheetName);
            Logger.log(`SpreadsheetRepository: Updated row ${r + 1} (${reportId}) status to ${normalized} in ${sheetName}`);
            break; // Move to next sheet once updated in this sheet
          }
        }
      }

      if (updatedSheets.length > 0) {
        return {
          success: true,
          reportId: reportId,
          sheet: updatedSheets.join(', '),
          updatedSheets: updatedSheets,
          updatedStatus: normalized
        };
      }
    } catch (err) {
      Logger.log(`SpreadsheetRepository Error updating review status: ${err.toString()}`);
      return { success: false, reportId: reportId, error: err.toString() };
    }

    return { success: false, reportId: reportId, error: 'Laporan tidak ditemukan di sheet.' };
  },

  /**
   * Calculates dashboard summary statistics across all form tabs inside integrated spreadsheet.
   * Scoped to current calendar month with distinct activity grouping, per-division separation,
   * tiered overdue harvest detection, open obstacle tracking, and quiet site coverage.
   * @returns {Object} Comprehensive dashboard stats payload.
   */
  getDashboardStatsData: function(options = {}) {
    let ss;
    try {
      ss = this.getSpreadsheet();
    } catch (e) {
      Logger.log('SpreadsheetRepository.getDashboardStatsData: ' + e.toString());
      return {};
    }
    if (!ss) return {};
    const forms = FormManagementService.getRegisteredFormsRaw_ ? FormManagementService.getRegisteredFormsRaw_() : FormManagementService.getFormList({ lightweight: true });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const INDO_MONTHS = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    let startDate = null;
    let endDate = null;
    let currentPeriodLabel = '';
    const periodMode = (options && options.period) ? options.period : 'this_month';

    if (periodMode === 'this_week') {
      const dayOfWeek = now.getDay();
      const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMon);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      startDate = monday;
      endDate = sunday;
      currentPeriodLabel = 'Minggu Ini';
    } else if (periodMode === 'last_week') {
      const dayOfWeek = now.getDay();
      const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek) - 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMon);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      startDate = monday;
      endDate = sunday;
      currentPeriodLabel = 'Minggu Lalu';
    } else if (periodMode === 'custom' && options.startDate && options.endDate) {
      startDate = new Date(options.startDate + 'T00:00:00');
      endDate = new Date(options.endDate + 'T23:59:59');
      currentPeriodLabel = `${options.startDate} s/d ${options.endDate}`;
    } else {
      startDate = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
      endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
      currentPeriodLabel = `${INDO_MONTHS[currentMonth]} ${currentYear}`;
    }

    const curMonthStart = startDate;
    const curMonthEnd = endDate;

    const priorMonthStart = new Date(startDate.getTime() - (30 * 24 * 60 * 60 * 1000));
    const priorMonthEnd = new Date(startDate.getTime() - 1);

    const DIV_KEYS = {
      MANAJEMEN: 'Manajemen',
      BKO: 'BKO 28',
      PEKERJA_HARIAN: 'Pekerja Harian',
      ALPROF: 'Alprof',
      SGA: 'SGA',
      AGRO: 'Agro (Pertanian/Perkebunan)',
      TERNAK: 'Ternak (Peternakan)',
      IKAN: 'Ikan (Perikanan)'
    };

    function normalizeDivisi(divisiStr) {
      const s = String(divisiStr || '').toLowerCase();
      if (s.includes('manajemen') || s === 'mnj') {
        return DIV_KEYS.MANAJEMEN;
      }
      if (s.includes('bko')) {
        return DIV_KEYS.BKO;
      }
      if (s.includes('pekerja') || s.includes('harian') || s === 'pkh') {
        return DIV_KEYS.PEKERJA_HARIAN;
      }
      if (s.includes('alprof') || s === 'alp') {
        return DIV_KEYS.ALPROF;
      }
      if (s.includes('sga')) {
        return DIV_KEYS.SGA;
      }
      if (s.includes('agro') || s.includes('tani') || s.includes('kebun') || s.includes('pertanian') || s.includes('perkebunan')) {
        return DIV_KEYS.AGRO;
      }
      if (s.includes('ternak') || s.includes('kandang') || s.includes('peternakan')) {
        return DIV_KEYS.TERNAK;
      }
      if (s.includes('ikan') || s.includes('kolam') || s.includes('tambak') || s.includes('perikanan')) {
        return DIV_KEYS.IKAN;
      }
      return divisiStr || DIV_KEYS.ALPROF;
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

    const divisiBreakdown = {
      [DIV_KEYS.ALPROF]: { activityCount: 0, rawReportCount: 0, panenVolume: 0, nilaiPenjualanRp: 0, unit: 'Kg' },
      [DIV_KEYS.SGA]: { activityCount: 0, rawReportCount: 0, panenVolume: 0, nilaiPenjualanRp: 0, unit: 'Kg' },
      [DIV_KEYS.PEKERJA_HARIAN]: { activityCount: 0, rawReportCount: 0, panenVolume: 0, nilaiPenjualanRp: 0, unit: 'Kg' },
      [DIV_KEYS.BKO]: { activityCount: 0, rawReportCount: 0, panenVolume: 0, nilaiPenjualanRp: 0, unit: 'Kg' },
      [DIV_KEYS.MANAJEMEN]: { activityCount: 0, rawReportCount: 0, panenVolume: 0, nilaiPenjualanRp: 0, unit: 'Kg' },
      [DIV_KEYS.AGRO]: { activityCount: 0, rawReportCount: 0, panenVolume: 0, nilaiPenjualanRp: 0, unit: 'Kg' },
      [DIV_KEYS.TERNAK]: { activityCount: 0, rawReportCount: 0, panenVolume: 0, nilaiPenjualanRp: 0, unit: 'Ekor / Unit' },
      [DIV_KEYS.IKAN]: { activityCount: 0, rawReportCount: 0, panenVolume: 0, nilaiPenjualanRp: 0, unit: 'Kg' }
    };

    const severityDist = { normal: 0, warning: 0, urgent: 0 };

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

    // 1. First Pass: Read rows across all sheets (dynamic daily tabs & canonical tabs)
    const targetSheets = this.getAllReportSheets_(ss);
    targetSheets.forEach(rawSheet => {
      try {
        if (rawSheet && rawSheet.getLastRow() > 1) {
          const headerMap = this.getHeaderMap_(rawSheet);
          const values = rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, rawSheet.getLastColumn()).getValues();

          values.forEach(row => {
            const reportId = String(this.findRowValueByField_(row, headerMap, 'reportId', 'Report_ID') || '').trim();
            const kodeKegiatan = String(this.findRowValueByField_(row, headerMap, 'kodeKegiatan', 'Kode_Kegiatan') || '').trim();
            const kodeKegiatanRef = String(this.findRowValueByField_(row, headerMap, 'kodeKegiatanRef', 'Kode_Kegiatan_Ref') || '').trim();
            const rawTimestamp = this.findRowValueByField_(row, headerMap, 'timestamp', 'Timestamp') || this.findRowValueByField_(row, headerMap, 'waktu', 'Waktu');
            const namaPic = String(this.findRowValueByField_(row, headerMap, 'namaPic', 'Nama_PIC') || this.findRowValueByField_(row, headerMap, 'empId', 'Emp_ID') || '').trim();
            const divisiRaw = String(this.findRowValueByField_(row, headerMap, 'bidangDivisi', 'Bidang_Divisi') || this.findRowValueByField_(row, headerMap, 'divisi', 'Divisi') || '').trim();
            const lokasi = String(this.findRowValueByField_(row, headerMap, 'lokasiKegiatan', 'Lokasi_Kegiatan') || this.findRowValueByField_(row, headerMap, 'lokasi', 'Lokasi') || '').trim();
            const jenis = String(this.findRowValueByField_(row, headerMap, 'jenisKegiatan', 'Jenis_Kegiatan') || '').trim();

            const tglPerkiraanPanen = this.findRowValueByField_(row, headerMap, 'estimasiPanenHst', 'Estimasi_Panen_HST') || this.findRowValueByField_(row, headerMap, 'tglPerkiraanPanen', 'Tgl_Perkiraan_Panen');
            const tglPanen = this.findRowValueByField_(row, headerMap, 'tglPanen', 'Tgl_Panen');
            const jumlahPanen = parseFloat(this.findRowValueByField_(row, headerMap, 'jumlahPanen', 'Jumlah_Panen_Kg') || 0) || 0;
            const totalHargaAgro = parseFloat(this.findRowValueByField_(row, headerMap, 'totalHargaRp', 'Total_Harga_Rp') || 0) || 0;
            const totalHargaTernak = parseFloat(this.findRowValueByField_(row, headerMap, 'totalHargaTernakRp', 'Total_Harga_Ternak_Rp') || 0) || 0;
            const nilaiPenjualan = totalHargaAgro + totalHargaTernak;
            const rawKendala = this.findRowValueByField_(row, headerMap, 'kendala', 'Kendala');
            const kendala = typeof normalizeKendalaText === 'function' ? normalizeKendalaText(rawKendala) : String(rawKendala || '').trim();
            const upaya = kendala ? String(this.findRowValueByField_(row, headerMap, 'upaya', 'Upaya') || '').trim() : '';
            const severity = String(this.findRowValueByField_(row, headerMap, 'severity', 'Severity') || (kendala ? 'urgent' : 'normal')).toLowerCase();
            const rawReviewStatus = 
              this.getCellValue_(row, headerMap, 'Status Verifikasi') || 
              this.getCellValue_(row, headerMap, 'Status_Verifikasi') || 
              this.getCellValue_(row, headerMap, 'Status Peninjauan') || 
              this.getCellValue_(row, headerMap, 'Status_Peninjauan') || 
              this.getCellValue_(row, headerMap, 'Reviewed') || 
              this.getCellValue_(row, headerMap, 'Review_Status') || 
              this.getCellValue_(row, headerMap, 'Status');
            const reviewStatus = normalizeReviewStatus(rawReviewStatus);

            if (!reportId && !kodeKegiatan && !namaPic) return;

            const rowDate = parseDateSafe(rawTimestamp) || parseDateSafe(tglPanen) || new Date();
            const normDivisi = normalizeDivisi(divisiRaw);

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
                severity: severity,
                reviewStatus: reviewStatus
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
      [DIV_KEYS.ALPROF]: new Set(),
      [DIV_KEYS.SGA]: new Set(),
      [DIV_KEYS.PEKERJA_HARIAN]: new Set(),
      [DIV_KEYS.BKO]: new Set(),
      [DIV_KEYS.MANAJEMEN]: new Set(),
      [DIV_KEYS.AGRO]: new Set(),
      [DIV_KEYS.TERNAK]: new Set(),
      [DIV_KEYS.IKAN]: new Set()
    };

    let verifiedCount = 0;
    let unverifiedCount = 0;

    // 3. Process current month aggregation metrics
    currentMonthItems.forEach(item => {
      totalReports++;

      if (item.reviewStatus === ReviewStatus.VERIFIED) {
        verifiedCount++;
      } else {
        unverifiedCount++;
      }

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

    // Month-over-month trend calculation
    const salesTrendPercent = priorMonthNilaiPenjualanRp > 0 
      ? Math.round(((totalNilaiPenjualanRp - priorMonthNilaiPenjualanRp) / priorMonthNilaiPenjualanRp) * 100)
      : null;

    return {
      currentPeriodLabel: currentPeriodLabel,
      totalReports: totalReports,
      verifiedCount: verifiedCount,
      unverifiedCount: unverifiedCount,
      verificationRate: totalReports > 0 ? Math.round((verifiedCount / totalReports) * 100) : 0,
      distinctActivityCount: distinctActivitiesSet.size,
      totalActiveKegiatan: totalActiveKegiatan,
      totalNilaiPenjualanRp: totalNilaiPenjualanRp,
      priorMonthNilaiPenjualanRp: priorMonthNilaiPenjualanRp,
      salesTrendPercent: salesTrendPercent,
      divisiBreakdown: divisiBreakdown,
      urgentCount: urgentCount,
      warningCount: warningCount,
      normalCount: normalCount,
      severityDist: severityDist,
      weeklyTrend: weeklyTrend
    };
  },

  /**
   * Retrieves operational report by UUID across all daily and registered tabs.
   * @param {string} reportId 
   * @returns {Object|null}
   */
  getOperationalReportById: function(reportId) {
    if (!reportId) return null;
    const queue = this.getAdminQueueData();
    const cleanId = String(reportId).trim().toLowerCase();
    return queue.find(item => 
      String(item.reportId || '').trim().toLowerCase() === cleanId || 
      String(item.kodeKegiatan || '').trim().toLowerCase() === cleanId
    ) || null;
  },

  /**
   * Deletes daily report tabs (Laporan_YYYY-MM-DD) older than retention threshold (default: 90 days).
   * Note: Pure time-based deletion regardless of review status, as per client specification.
   * Strictly protects fixed infrastructure tabs (Employee_Registry, Photo_Log, Admin_Queue, Sensitive_Restricted, etc.).
   * @param {number} [retentionDays=90] 
   * @returns {{ success: boolean, deletedCount: number }}
   */
  deleteExpiredDailyTabs: function(retentionDays) {
    const thresholdDays = retentionDays || ConfigRepository.getRetentionDays() || 90;
    Logger.log(`SpreadsheetRepository: Starting deleteExpiredDailyTabs with threshold: ${thresholdDays} days.`);
    const ss = this.getSpreadsheet();
    const allSheets = ss.getSheets();
    const protectedTabs = new Set([
      'employee_registry', 'photo_log', 'admin_queue', 'sensitive_restricted',
      'dashboard_config', 'sensitive', 'settings', 'config', 'users', 'roles',
      'laporan operasional', 'master_laporan', 'analytics_history'
    ]);

    let deletedCount = 0;
    const now = new Date();

    allSheets.forEach(sheet => {
      const sheetName = sheet.getName();
      const lowerName = sheetName.toLowerCase();
      if (protectedTabs.has(lowerName)) return;

      const match = sheetName.match(/^Laporan_(\d{4}-\d{2}-\d{2})$/);
      if (match) {
        const dateStr = match[1];
        const tabDate = new Date(dateStr + 'T00:00:00');
        if (!isNaN(tabDate.getTime())) {
          const diffMs = now.getTime() - tabDate.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

          if (diffDays >= thresholdDays) {
            try {
              // 1. Record permanent aggregate rollup before deletion
              this.recordAnalyticsHistoryRollup(sheet);

              // 2. Delete raw sheet
              if (ss.getSheets().length > 1) {
                ss.deleteSheet(sheet);
                deletedCount++;
                Logger.log(`SpreadsheetRepository: Deleted expired daily sheet ${sheetName} (age: ${diffDays} days).`);
              }
            } catch (err) {
              Logger.log(`SpreadsheetRepository Error deleting sheet ${sheetName}: ${err.toString()}`);
            }
          }
        }
      }
    });

    Logger.log(`SpreadsheetRepository: Finished deleteExpiredDailyTabs. Deleted ${deletedCount} tab(s).`);
    return { success: true, deletedCount: deletedCount };
  },

  /**
   * Scans for daily tabs approaching the 90-day deletion threshold (within 5 days).
   * Used for safety warning banners in the Admin Queue.
   * @returns {Array<{ tabName: string, dateStr: string, daysRemaining: number, rowCount: number, retentionDays: number }>}
   */
  getExpiringDailyTabs: function() {
    const retentionDays = ConfigRepository.getRetentionDays() || 90;
    const warningWindowDays = 5;
    const ss = this.getSpreadsheet();
    const allSheets = ss.getSheets();
    const expiring = [];
    const now = new Date();

    allSheets.forEach(sheet => {
      const sheetName = sheet.getName();
      const match = sheetName.match(/^Laporan_(\d{4}-\d{2}-\d{2})$/);
      if (match) {
        const dateStr = match[1];
        const tabDate = new Date(dateStr + 'T00:00:00');
        if (!isNaN(tabDate.getTime())) {
          const diffMs = now.getTime() - tabDate.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const daysRemaining = retentionDays - diffDays;

          if (daysRemaining <= warningWindowDays && daysRemaining > 0) {
            const rowCount = Math.max(0, sheet.getLastRow() - 1);
            expiring.push({
              tabName: sheetName,
              dateStr: dateStr,
              daysRemaining: daysRemaining,
              rowCount: rowCount,
              retentionDays: retentionDays
            });
          }
        }
      }
    });

    expiring.sort((a, b) => a.daysRemaining - b.daysRemaining);
    return expiring;
  },

  /**
   * Generates a CSV data string for a specified daily sheet tab for 1-click download.
   * @param {string} tabName 
   * @returns {string} CSV formatted data.
   */
  getDailyTabCsvData: function(tabName) {
    if (!tabName) throw new Error('Nama tab wajib disertakan.');
    const ss = this.getSpreadsheet();
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) throw new Error(`Tab ${tabName} tidak ditemukan.`);

    const data = sheet.getDataRange().getValues();
    if (!data || data.length === 0) return '';

    const csvRows = data.map(row => {
      return row.map(cell => {
        let val = (cell === null || cell === undefined) ? '' : String(cell);
        if (cell instanceof Date) {
          val = formatDate(cell);
        }
        if (val.includes('"') || val.includes(',') || val.includes('\n') || val.includes('\r')) {
          val = '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      }).join(',');
    });

    return csvRows.join('\r\n');
  },

  /**
   * Reads all operational rows across daily tabs (Laporan_YYYY-MM-DD) and Master_Laporan.
   * Maps each row to standard field keys, parses dates/numbers, and deduplicates.
   * @param {string|Date} [dateFrom] Optional start date
   * @param {string|Date} [dateTo] Optional end date
   * @returns {Array<Object>}
   */
  getAllOperationalRows: function(dateFrom, dateTo) {
    let ss;
    try {
      ss = this.getSpreadsheet();
    } catch (e) {
      Logger.log('SpreadsheetRepository.getAllOperationalRows: ' + e.toString());
      return [];
    }
    if (!ss) return [];
    const sheets = this.getAllReportSheets_(ss);
    const allRows = [];
    const seenFingerprints = new Set();

    const dFrom = dateFrom ? new Date(dateFrom) : null;
    const dTo = dateTo ? new Date(dateTo) : null;
    if (dFrom) dFrom.setHours(0, 0, 0, 0);
    if (dTo) dTo.setHours(23, 59, 59, 999);

    sheets.forEach(sheet => {
      if (!sheet || sheet.getLastRow() <= 1) return;
      try {
        const headerMap = this.getHeaderMap_(sheet);
        const rawValues = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

        rawValues.forEach((row) => {
          const hasData = row.some(c => c !== null && c !== undefined && String(c).trim().length > 0);
          if (!hasData) return;

          // Extract standard fields
          const item = {};
          OPERATIONAL_REPORT_FIELDS.forEach(f => {
            let rawVal = this.findRowValueByField_(row, headerMap, f.key, f.header);

            if (rawVal === null || rawVal === undefined) rawVal = '';

            // Type parsing
            if (f.type === 'number') {
              if (typeof rawVal === 'number') {
                item[f.key] = isNaN(rawVal) ? 0 : rawVal;
              } else {
                const cleaned = String(rawVal).replace(/[^0-9.-]/g, '');
                item[f.key] = cleaned ? parseFloat(cleaned) : 0;
              }
            } else if (f.type === 'date') {
              if (rawVal instanceof Date) {
                item[f.key] = formatDate(rawVal);
                item[f.key + '_raw'] = rawVal;
              } else {
                const s = String(rawVal).trim();
                item[f.key] = s;
                item[f.key + '_raw'] = s ? new Date(s) : null;
              }
            } else {
              let s = String(rawVal).trim();
              if ((f.key === 'ternakMasuk' || f.key === 'ternakKeluar' || f.key === 'ternakMasukJenis' || f.key === 'ternakKeluarJenis') && /tidak ada/i.test(s)) {
                s = s.replace(/\s*\(\d+\s*ekor\)/gi, '').trim() || 'Tidak Ada';
              }
              if ((f.key === 'nomorTelepon' || f.key === 'pembeliTelp' || f.key === 'pembeliTernakTelp') && typeof normalizePhoneNumber === 'function') {
                s = normalizePhoneNumber(s);
              }
              item[f.key] = s;
            }
          });

          // Separate clean Tanam vs Panen commodities using resolveSeparatedCommodities
          const sep = resolveSeparatedCommodities(item.komoditas, item.komoditasPanen, item.jenisKegiatan);
          item.komoditasTanam = sep.komoditasTanam;
          item.komoditasPanen = sep.komoditasPanen;
          item.komoditas = sep.komoditasTanam || sep.komoditasPanen || item.komoditas || '';

          // Reconcile livestock numeric totals
          if (!item.ternakMasukQty && (item.ternakMasukKelahiranQty || item.ternakMasukPembelianQty)) {
            item.ternakMasukQty = (item.ternakMasukKelahiranQty || 0) + (item.ternakMasukPembelianQty || 0);
          }
          if (!item.ternakKeluarQty && (item.ternakKeluarKematianQty || item.ternakKeluarPenjualanQty)) {
            item.ternakKeluarQty = (item.ternakKeluarKematianQty || 0) + (item.ternakKeluarPenjualanQty || 0);
          }

          // Date range filter check must happen before deduplication. Master
          // and mirror tabs can carry the same report ID with different
          // timestamps; an out-of-scope Master row must not suppress an
          // in-scope operational row.
          if (dFrom || dTo) {
            let rowDate = null;
            if (item.timestamp_raw instanceof Date && !isNaN(item.timestamp_raw.getTime())) {
              rowDate = item.timestamp_raw;
            } else if (item.timestamp) {
              rowDate = new Date(item.timestamp);
            } else if (item.tglPanen_raw instanceof Date) {
              rowDate = item.tglPanen_raw;
            } else if (item.tglTanam_raw instanceof Date) {
              rowDate = item.tglTanam_raw;
            }

            // A bounded analytical query must not silently include rows with
            // no valid scope date; surface them through unbounded/admin data
            // quality views instead.
            if (!rowDate || isNaN(rowDate.getTime())) return;
            if (dFrom && rowDate < dFrom) return;
            if (dTo && rowDate > dTo) return;
          }

          // Generate unique fingerprint after scope filtering.
          const fp = item.reportId || `${item.kodeKegiatan || ''}_${item.idKaryawan || ''}_${item.timestamp || ''}_${item.komoditas || ''}_${item.totalHargaRp || 0}`;
          if (seenFingerprints.has(fp)) return;
          seenFingerprints.add(fp);

          allRows.push(item);
        });
      } catch (err) {
        Logger.log(`SpreadsheetRepository Error reading rows from ${sheet.getName()}: ${err.toString()}`);
      }
    });

    return allRows;
  },

  /**
   * Ensures the permanent Analytics_History sheet exists with appropriate headers.
   * @param {Spreadsheet} ss 
   * @returns {Sheet}
   */
  ensureAnalyticsHistorySheet_: function(ss) {
    const sheetName = 'Analytics_History';
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      const headers = [
        'Date',
        'Komoditas',
        'Arah',
        'Jumlah_Laporan',
        'Jumlah_Benih',
        'Jumlah_Panen_Kg',
        'Total_Penjualan_Rp',
        'Total_Luas_M2'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      this.applyHeaderStyle(sheet, headers.length);
    }
    return sheet;
  },

  /**
   * Rolls up daily tab records into Analytics_History before tab pruning.
   * Separates tanam vs panen components into distinct clean rows.
   * @param {Sheet} dailySheet 
   * @returns {boolean}
   */
  recordAnalyticsHistoryRollup: function(dailySheet) {
    if (!dailySheet || dailySheet.getLastRow() <= 1) return true;
    try {
      const ss = this.getSpreadsheet();
      const historySheet = this.ensureAnalyticsHistorySheet_(ss);
      const headerMap = this.getHeaderMap_(dailySheet);
      const values = dailySheet.getRange(2, 1, dailySheet.getLastRow() - 1, dailySheet.getLastColumn()).getValues();

      const tabName = dailySheet.getName();
      let tabDate = tabName.replace('Laporan_', '').trim();
      if (!tabDate || tabDate.length < 8) {
        tabDate = formatDate(new Date()).split(' ')[0];
      }

      // Rollup by [komoditas, arah]
      const map = {};

      const addEntry = (cropName, arah, count, benih, panen, penjualan, luas) => {
        const cleanCrop = String(cropName || 'Lainnya').trim() || 'Lainnya';
        const groupKey = `${cleanCrop}|${arah}`;
        if (!map[groupKey]) {
          map[groupKey] = {
            komoditas: cleanCrop,
            arah: arah,
            count: 0,
            benih: 0,
            panen: 0,
            penjualan: 0,
            luas: 0
          };
        }
        map[groupKey].count += count;
        map[groupKey].benih += benih;
        map[groupKey].panen += panen;
        map[groupKey].penjualan += penjualan;
        map[groupKey].luas += luas;
      };

      values.forEach(row => {
        const rawKomoditas = String(this.getCellValue_(row, headerMap, 'Komoditas') || '').trim();
        const rawKomoditasPanen = String(this.getCellValue_(row, headerMap, 'Komoditas_Panen') || '').trim();
        const jenisKegiatan = String(this.getCellValue_(row, headerMap, 'Jenis_Kegiatan') || '').toLowerCase();
        const jumlahBenih = parseFloat(this.getCellValue_(row, headerMap, 'Jumlah_Benih') || 0) || 0;
        const jumlahPanen = parseFloat(this.getCellValue_(row, headerMap, 'Jumlah_Panen_Kg') || 0) || 0;
        const totalHarga = parseFloat(this.getCellValue_(row, headerMap, 'Total_Harga_Rp') || 0) || 0;
        const luas = parseFloat(this.getCellValue_(row, headerMap, 'Luas_Lahan_M2') || 0) || 0;

        const sep = resolveSeparatedCommodities(rawKomoditas, rawKomoditasPanen, jenisKegiatan);

        if (jenisKegiatan.includes('tanam') && sep.komoditasTanam) {
          addEntry(sep.komoditasTanam, 'Tanam', 1, jumlahBenih, 0, 0, luas);
        }
        if (jenisKegiatan.includes('panen') && sep.komoditasPanen) {
          addEntry(sep.komoditasPanen, 'Panen', 1, 0, jumlahPanen, totalHarga, 0);
        }
        if (!jenisKegiatan.includes('tanam') && !jenisKegiatan.includes('panen')) {
          let arah = 'Pengawasan';
          if (jenisKegiatan.includes('administrasi')) arah = 'Administrasi';
          addEntry(sep.komoditasTanam || sep.komoditasPanen || 'Umum', arah, 1, 0, 0, 0, 0);
        }
      });

      const rollupRows = Object.values(map).map(m => [
        tabDate,
        m.komoditas,
        m.arah,
        m.count,
        m.benih,
        m.panen,
        m.penjualan,
        m.luas
      ]);

      if (rollupRows.length > 0) {
        historySheet.getRange(historySheet.getLastRow() + 1, 1, rollupRows.length, 8).setValues(rollupRows);
      }
      return true;
    } catch (e) {
      Logger.log('SpreadsheetRepository Error in recordAnalyticsHistoryRollup: ' + e.toString());
      return false;
    }
  },

  /**
   * Finds or creates the User_Roles sheet for multi-user RBAC.
   * @param {Spreadsheet} [ss] 
   * @returns {Sheet}
   */
  getUserRolesSheet_: function(ss) {
    if (!ss) ss = this.getSpreadsheet();
    let sheet = ss.getSheetByName('User_Roles');
    const headers = ['Email', 'Role', 'Terakhir_Aktif', 'Ditambahkan_Oleh', 'Tanggal_Daftar'];

    if (!sheet) {
      sheet = ss.insertSheet('User_Roles');
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#15803D')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold');
      sheet.setFrozenRows(1);
      
      // Default Initial Accounts Seed (Single superadmin placeholder)
      const primaryAdminEmail = ConfigRepository.getAdminEmail() || 'admin@domain.local';
      const initialRows = [
        [primaryAdminEmail, 'both', '', 'System Initializer', formatDate(new Date()).split(' ')[0]]
      ];
      sheet.getRange(2, 1, initialRows.length, headers.length).setValues(initialRows);
      try { sheet.autoResizeColumns(1, headers.length); } catch (e) {}
    } else {
      // Ensure header has 5 columns
      try {
        const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 5)).getValues()[0];
        if (currentHeaders.length < 5 || currentHeaders[2] !== 'Terakhir_Aktif') {
          sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
          sheet.getRange(1, 1, 1, headers.length)
            .setBackground('#15803D')
            .setFontColor('#FFFFFF')
            .setFontWeight('bold');
        }
      } catch (eH) {}
    }
    return sheet;
  },

  /**
   * Reads all registered user roles from User_Roles spreadsheet tab.
   * Auto-purges any legacy dummy emails on the fly.
   * @returns {Array<Object>}
   */
  getUserRolesFromSheet: function() {
    try {
      const sheet = this.getUserRolesSheet_();
      if (!sheet || sheet.getLastRow() <= 1) return [];

      const lastRow = sheet.getLastRow();
      const raw = sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), 5)).getValues();
      const list = [];
      const rowsToDelete = [];

      raw.forEach((row, idx) => {
        const email = String(row[0] || '').trim().toLowerCase();
        if (!email || !email.includes('@')) return;

        // Auto-purge any legacy dummy emails from live spreadsheet
        if (email.includes('@agri.co.id') || email.includes('staf.operasional') || email.includes('local.dev')) {
          rowsToDelete.push(idx + 2);
          return;
        }

        let role = String(row[1] || 'admin').trim().toLowerCase();
        let primaryAdmin = '';
        try {
          primaryAdmin = (ConfigRepository.getAdminEmail ? ConfigRepository.getAdminEmail() : '').toLowerCase();
        } catch (e) {}
        if (primaryAdmin && email === primaryAdmin) {
          role = 'both';
        }

        let terakhirAktif = '';
        let addedBy = 'Admin';
        let addedAt = '';

        if (row.length >= 5) {
          terakhirAktif = row[2] ? formatDate(row[2]) : '';
          addedBy = String(row[3] || 'Admin').trim();
          addedAt = row[4] ? formatDate(row[4]).split(' ')[0] : '';
        } else if (row.length === 4) {
          addedBy = String(row[2] || 'Admin').trim();
          addedAt = row[3] ? formatDate(row[3]).split(' ')[0] : '';
        }

        if (terakhirAktif.includes('1970-01-01')) {
          terakhirAktif = '';
        }

        list.push(UserRoleItem({
          email: email,
          role: role,
          terakhirAktif: terakhirAktif,
          addedBy: addedBy,
          addedAt: addedAt
        }));
      });

      // Purge dummy rows from sheet in reverse order so row indices stay stable
      if (rowsToDelete.length > 0) {
        for (let i = rowsToDelete.length - 1; i >= 0; i--) {
          try { sheet.deleteRow(rowsToDelete[i]); } catch (eDel) {}
        }
      }

      // If sheet becomes empty after purging, ensure default superadmin row exists
      if (list.length === 0) {
        const primaryAdminEmail = ConfigRepository.getAdminEmail() || 'admin@domain.local';
        const defaultSuperadmin = UserRoleItem({
          email: primaryAdminEmail,
          role: 'both',
          terakhirAktif: '',
          addedBy: 'System Initializer',
          addedAt: formatDate(new Date()).split(' ')[0]
        });
        this.saveUserRoleToSheet(defaultSuperadmin);
        list.push(defaultSuperadmin);
      }

      return list;
    } catch (err) {
      Logger.log('SpreadsheetRepository Error in getUserRolesFromSheet: ' + err.toString());
      return [];
    }
  },

  /**
   * Saves or updates a user role account in User_Roles sheet.
   * @param {Object} item - { email, role, terakhirAktif, addedBy }
   * @returns {{ success: boolean, item: Object }}
   */
  saveUserRoleToSheet: function(item) {
    if (!item || !item.email || !item.email.includes('@')) {
      throw new Error('Alamat email Google yang valid wajib diisi.');
    }

    const sheet = this.getUserRolesSheet_();
    const emailToSave = item.email.trim().toLowerCase();
    const roleItem = UserRoleItem(item);
    const dateStr = formatDate(new Date()).split(' ')[0];

    const lastRow = sheet.getLastRow();
    let existingRowIndex = -1;
    let existingLastActive = '';

    if (lastRow > 1) {
      const existingData = sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), 3)).getValues();
      for (let i = 0; i < existingData.length; i++) {
        if (String(existingData[i][0] || '').trim().toLowerCase() === emailToSave) {
          existingRowIndex = i + 2;
          existingLastActive = existingData[i][2] ? formatDate(existingData[i][2]) : '';
          break;
        }
      }
    }

    const rowData = [
      roleItem.email,
      roleItem.role,
      roleItem.terakhirAktif || existingLastActive || '',
      roleItem.addedBy || 'Admin',
      roleItem.addedAt || dateStr
    ];

    if (existingRowIndex > 0) {
      sheet.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    return { success: true, item: roleItem };
  },

  /**
   * Updates last active / logout timestamp for a user.
   * @param {string} email 
   * @param {string} [timestamp] 
   */
  updateUserLastActive: function(email, timestamp) {
    if (!email) return;
    const cleanEmail = email.trim().toLowerCase();
    const timeStr = timestamp || formatDate(new Date());

    try {
      const sheet = this.getUserRolesSheet_();
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const emails = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (let i = 0; i < emails.length; i++) {
          if (String(emails[i][0] || '').trim().toLowerCase() === cleanEmail) {
            sheet.getRange(i + 2, 3).setValue(timeStr);
            break;
          }
        }
      }
    } catch (e) {
      Logger.log('SpreadsheetRepository Error in updateUserLastActive: ' + e.toString());
    }
  },

  /**
   * Deletes a user role account from User_Roles sheet.
   * @param {string} email 
   * @returns {{ success: boolean }}
   */
  deleteUserRoleFromSheet: function(email) {
    if (!email) throw new Error('Email wajib disertakan.');
    const sheet = this.getUserRolesSheet_();
    const emailToDelete = email.trim().toLowerCase();

    let primaryAdmin = '';
    try {
      primaryAdmin = (ConfigRepository.getAdminEmail ? ConfigRepository.getAdminEmail() : '').toLowerCase();
    } catch (e) {}
    if (primaryAdmin && emailToDelete === primaryAdmin) {
      throw new Error('Akun Superadmin Utama (' + primaryAdmin + ') tidak dapat dihapus.');
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true };

    const emails = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < emails.length; i++) {
      if (String(emails[i][0] || '').trim().toLowerCase() === emailToDelete) {
        sheet.deleteRow(i + 2);
        return { success: true };
      }
    }

    return { success: true };
  }
};

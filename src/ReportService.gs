/**
 * ReportService.gs — Application Service for Operational Report Submissions
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: APPLICATION / SERVICE
 * Responsibility: Coordinates validation, Kode Kegiatan generation, triage evaluation, persistence, photo attachment handling, and notifications.
 */

const ReportService = {

  /**
   * Generates formatted Kode Kegiatan reference string.
   * Format: {DIVISI_KODE}-{LOKASI_SLUG}-{YYYYMMDD}-{2DIGIT_INDEX}
   * Example: AGR-KEBUNA-20260807-01
   * @param {string} divisi 
   * @param {string} lokasi 
   * @returns {string} Kode Kegiatan
   */
  generateKodeKegiatan: function(divisi, lokasi) {
    let divCode = 'AGR';
    const divLower = String(divisi || '').toLowerCase();
    if (divLower.includes('ternak') || divLower.includes('peternakan')) divCode = 'TRN';
    else if (divLower.includes('ikan') || divLower.includes('perikanan')) divCode = 'IKN';

    const locSlug = String(lokasi || 'SIT')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 6) || 'SITEA';

    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const seq = String(Math.floor(Math.random() * 89) + 10);
    return `${divCode}-${locSlug}-${dateStr}-${seq}`;
  },

  /**
   * Submits a new Operational Report from Web App.
   * Enforces REQUIRED photo upload. Panen & Penjualan fields are optional.
   * @param {Object} payload 
   * @returns {{ success: boolean, reportId: string, kodeKegiatan: string }}
   */
  submitOperationalReport: function(payload) {
    if (!payload || !payload.namaPic || !payload.bidangDivisi || !payload.lokasiKegiatan || !payload.jenisKegiatan) {
      throw new Error('Mohon lengkapi semua kolom wajib (Nama PIC, Divisi, Lokasi, Jenis Kegiatan).');
    }

    if (!payload.reportId) {
      payload.reportId = SpreadsheetRepository.generateUUID();
    }

    if (!payload.kodeKegiatan) {
      payload.kodeKegiatan = this.generateKodeKegiatan(payload.bidangDivisi, payload.lokasiKegiatan);
    }
    // Require photo attachment for Web App submissions
    const photoUrl = typeof extractStringUrl === 'function' ? extractStringUrl(payload.fotoUrl || payload.photoUrl) : (payload.fotoUrl || payload.photoUrl || '');
    
    if (payload.photoBase64) {
      const uploadRes = this.uploadReportAttachment(payload.photoBase64, payload.photoMimeType || 'image/jpeg', 'OPERATIONAL', payload.reportId, payload.kodeKegiatan);
      if (uploadRes && uploadRes.url) {
        payload.fotoUrl = uploadRes.url;
      } else {
        Logger.log('ReportService Notice: Drive upload fallback marker saved: ' + (uploadRes ? uploadRes.error : 'Unknown'));
        payload.fotoUrl = '[Foto Terlampir - Menunggu Otorisasi Drive]';
      }
    } else if (photoUrl) {
      payload.fotoUrl = photoUrl;
    } else {
      throw new Error('Foto bukti kegiatan wajib dilampirkan.');
    }

    payload.timestamp = formatDate(new Date());

    const report = OperationalReport(payload);
    
    // Evaluate triage
    const flagText = [
      report.namaPic, report.bidangDivisi, report.lokasiKegiatan, 
      report.jenisKegiatan, report.capaianKegiatan, report.kendala, report.upaya
    ];
    const flag = TriageEngine.evaluate(flagText.join(' '));

    // Save into central spreadsheet (auto-handles triage highlighting & sensitive routing)
    const result = SpreadsheetRepository.saveOperationalReport(report, flag);

    // Send notifications if high severity
    if (flag && (flag.severity === ReportSeverity.WARNING || flag.severity === ReportSeverity.URGENT)) {
      try {
        NotificationAdapter.sendIncidentNotification(report, flag);
      } catch (e) {
        Logger.log('ReportService Notice: Incident notification dispatch failed: ' + e.toString());
      }
    }

    return result;
  },

  /**
   * Retrieves operational report by UUID across all tabs.
   * @param {string} reportId 
   * @returns {Object} Operational report data.
   */
  getOperationalReportById: function(reportId) {
    if (!reportId) return null;
    return SpreadsheetRepository.getOperationalReportById(reportId);
  },

  /**
   * Searches for autocomplete suggestion matches for activity codes based on keyword query.
   * @param {string} query 
   * @returns {Array<string>} Matching activity codes list.
   */
  searchKodeKegiatanSuggestions: function(query) {
    if (!query || query.trim().length < 2) return [];
    const reports = SpreadsheetRepository.getAdminQueueData();
    const q = query.trim().toLowerCase();
    const codesSet = new Set();
    reports.forEach(r => {
      if (r.kodeKegiatan && r.kodeKegiatan.toLowerCase().includes(q)) {
        codesSet.add(r.kodeKegiatan);
      }
    });
    return Array.from(codesSet).slice(0, 50);
  },

  /**
   * Uploads base64 encoded photo attachment into form's Drive folder.
   * @param {string} base64Data 
   * @param {string} mimeType 
   * @param {string} formId 
   * @returns {{ url: string, fileId: string, error: string|null }} Structured upload result.
   */
  uploadReportAttachment: function(base64Data, mimeType, formId, reportId, kodeKegiatan) {
    if (!base64Data) return { url: '', fileId: '', error: 'Tidak ada data foto yang dikirim.' };
    
    // 1. Primary path: Native DriveApp API
    try {
      if (typeof DriveApp !== 'undefined') {
        const forms = FormManagementService.getFormList();
        const form = forms.find(f => f.id === formId) || { title: 'Form Laporan Operasional', id: formId || 'OPERATIONAL' };
        const targetFolder = FormManagementService.provisionPhotoFolder_(form.title, form.id);
        
        let cleanBase64 = String(base64Data);
        if (cleanBase64.indexOf(',') !== -1) {
          cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(',') + 1);
        }
        cleanBase64 = cleanBase64.replace(/\s/g, '');

        const blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), mimeType || 'image/jpeg', `Photo_${Date.now()}.jpg`);
        let file = null;
        if (targetFolder) {
          try { file = targetFolder.createFile(blob); } catch (e) {}
        }
        if (!file) {
          file = DriveApp.createFile(blob);
        }

        if (file) {
          try {
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          } catch (err) {}
          const fileUrl = file.getUrl();
          const fileId = file.getId();
          SpreadsheetRepository.logPhotoUpload(reportId || '', kodeKegiatan || '', fileUrl, fileId);
          return { url: fileUrl, fileId: fileId, error: null };
        }
      }
    } catch (eDriveApp) {
      Logger.log('ReportService Notice: Native DriveApp permission fallback triggered: ' + eDriveApp.toString());
    }

    // 2. Secondary Fallback path: Direct Google Drive REST API v3 via UrlFetchApp & ScriptApp.getOAuthToken()
    try {
      const restRes = this.uploadReportAttachmentViaRestApi_(base64Data, mimeType, `Photo_${Date.now()}.jpg`);
      if (restRes && restRes.url) {
        SpreadsheetRepository.logPhotoUpload(reportId || '', kodeKegiatan || '', restRes.url, restRes.fileId || '');
        return restRes;
      }
    } catch (eRest) {
      Logger.log('ReportService Error: Both DriveApp and REST API photo upload failed: ' + eRest.toString());
      return { url: '', fileId: '', error: 'Drive API: ' + (eRest.message || eRest.toString()) };
    }

    return { url: '', fileId: '', error: 'Gagal membuat file foto di Google Drive.' };
  },

  /**
   * Directly uploads base64 photo via Google Drive API v3 REST endpoint using OAuth Token.
   * @private
   */
  uploadReportAttachmentViaRestApi_: function(base64Data, mimeType, filename) {
    let cleanBase64 = String(base64Data);
    if (cleanBase64.indexOf(',') !== -1) {
      cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(',') + 1);
    }
    cleanBase64 = cleanBase64.replace(/\s/g, '');

    const token = ScriptApp.getOAuthToken();
    const metadata = {
      name: filename || `Photo_${Date.now()}.jpg`,
      mimeType: mimeType || 'image/jpeg'
    };

    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + (mimeType || 'image/jpeg') + '\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      cleanBase64 +
      close_delim;

    const response = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'multipart/related; boundary="' + boundary + '"'
      },
      payload: multipartRequestBody,
      muteHttpExceptions: true
    });

    const resJson = JSON.parse(response.getContentText());
    if (resJson && resJson.id) {
      const fileId = resJson.id;
      const fileUrl = `https://drive.google.com/file/d/${fileId}/view`;

      // Set public view permissions via Drive API v3
      try {
        UrlFetchApp.fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
          method: 'post',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          payload: JSON.stringify({ role: 'reader', type: 'anyone' }),
          muteHttpExceptions: true
        });
      } catch (ePerm) {}

      return { url: fileUrl, fileId: fileId, error: null };
    } else {
      throw new Error((resJson && resJson.error && resJson.error.message) || 'Drive REST API response error');
    }
  },

  /**
   * Submits a dynamic custom form response into form's tab inside integrated spreadsheet.
   */
  submitDynamicFormResponse: function(formId, payload) {
    if (!formId || !payload) throw new Error('Form ID dan payload data wajib diisi.');

    const forms = FormManagementService.getFormList();
    const form = forms.find(f => f.id === formId);
    if (!form) throw new Error('Form tidak ditemukan.');

    const reportId = Utilities.getUuid();
    const nowStr = formatDate(new Date());
    const empId = payload.empId || payload.kode_karyawan || 'EMP-DYNAMIC';
    const site = payload.site || payload.lokasi || 'Site A';
    const date = payload.date || payload.tanggal || formatDate(new Date());

    let photoUrl = '';
    const photoKey = Object.keys(payload).find(k => ['foto', 'photo', 'foto_lampiran', 'attachment'].includes(k.toLowerCase()));
    if (photoKey) {
      photoUrl = String(payload[photoKey] || '');
    }

    const textPieces = [];
    Object.keys(payload).forEach(k => {
      const lowerKey = k.toLowerCase();
      if (!['empId', 'site', 'date', 'kode_karyawan', 'lokasi', 'tanggal', 'foto', 'photo', 'foto_lampiran', 'attachment'].includes(lowerKey)) {
        textPieces.push(`${k}: ${payload[k]}`);
      }
    });
    const details = textPieces.join(' | ');

    const flag = TriageEngine.evaluate([empId, site, date, details]);
    const targetSsId = ConfigRepository.getSpreadsheetId();
    if (!targetSsId) throw new Error('Sheet data form belum terkonfigurasi.');

    const ss = SpreadsheetApp.openById(targetSsId);
    const targetSheet = FormManagementService.resolveFormTab_(ss, form);

    const rowData = [
      reportId, '', '', nowStr, empId, site, site, details, 'Target', 0, 0,
      '', '', date, '', 0, '', 0, 0, 0, details, '', photoUrl,
      flag.severity, flag.keywords.join(', '), ReviewStatus.UNREVIEWED
    ];

    targetSheet.appendRow(rowData);
    if (flag.severity === ReportSeverity.URGENT) {
      NotificationAdapter.sendUrgentAlert(form.title || 'Form Kustom', targetSheet.getLastRow(), rowData, flag);
    }

    return { success: true, reportId: reportId };
  },

  /**
   * Processes native Google Form submit event for Operational Form.
   * @param {Object} e - Event object.
   */
  processFormSubmit: function(e) {
    try {
      if (!e || !e.range) return;
      const range = e.range;
      const sheet = range.getSheet();
      const row = range.getRow();
      const lastCol = sheet.getLastColumn();
      let rowData = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

      Logger.log('ReportService: Processing Native Form Submit at row: ' + row);

      const reportId = SpreadsheetRepository.ensureReportId(sheet, row, rowData);
      rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

      // Native Google Form submit evaluate
      const flagText = rowData.slice(1, 10).join(' ');
      const flag = TriageEngine.evaluate(flagText);

      SpreadsheetRepository.applyRowHighlighting(sheet, row, flag.severity);

      if (flag.severity === ReportSeverity.URGENT) {
        NotificationAdapter.sendUrgentAlert('Laporan Operasional (Native Form)', row, rowData, flag);
      }
    } catch (err) {
      Logger.log('ReportService Error in processFormSubmit: ' + err.toString());
    }
  }
};

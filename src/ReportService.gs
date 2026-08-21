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
    if (!photoUrl && !payload.photoBase64) {
      throw new Error('Foto bukti kegiatan wajib dilampirkan.');
    }

    if (payload.photoBase64) {
      const uploadRes = this.uploadReportAttachment(payload.photoBase64, payload.photoMimeType || 'image/jpeg', 'OPERATIONAL', payload.reportId, payload.kodeKegiatan);
      payload.fotoUrl = (typeof uploadRes === 'object' && uploadRes && uploadRes.url) ? uploadRes.url : String(uploadRes || '');
    } else {
      payload.fotoUrl = photoUrl;
    }

    payload.timestamp = formatDate(new Date());

    const report = OperationalReport(payload);
    
    // Evaluate triage
    const flagText = [
      report.namaPic, report.bidangDivisi, report.lokasiKegiatan, 
      report.jenisKegiatan, report.capaianKegiatan, report.kendala, report.upaya
    ];
    const flag = TriageEngine.evaluate(flagText);

    const result = SpreadsheetRepository.saveOperationalReport(report, flag);

    if (flag.severity === ReportSeverity.URGENT) {
      NotificationAdapter.sendUrgentAlert('Laporan Operasional', 1, [
        result.reportId, result.kodeKegiatan, report.timestamp, report.namaPic, 
        report.bidangDivisi, report.lokasiKegiatan, report.jenisKegiatan, report.kendala, flag.severity
      ], flag);
    }

    return { 
      success: true, 
      reportId: result.reportId, 
      kodeKegiatan: result.kodeKegiatan || report.kodeKegiatan 
    };
  },

  /**
   * Retrieves recent Activity Codes (Kode Kegiatan) for autocomplete lookups.
   * @returns {Array<string>} Array of recent Kode Kegiatan strings.
   */
  getRecentActivityCodes: function() {
    const queueData = SpreadsheetRepository.getAdminQueueData();
    const codesSet = new Set();
    queueData.forEach(item => {
      if (item.kodeKegiatan && item.kodeKegiatan !== '-' && item.kodeKegiatan.length > 5) {
        codesSet.add(item.kodeKegiatan);
      }
    });
    return Array.from(codesSet).slice(0, 50);
  },

  /**
   * Uploads base64 encoded photo attachment into form's Drive folder.
   * @param {string} base64Data 
   * @param {string} mimeType 
   * @param {string} formId 
   * @returns {string} File public view URL.
   */
  uploadReportAttachment: function(base64Data, mimeType, formId, reportId, kodeKegiatan) {
    if (!base64Data) return { url: '', fileId: '' };
    
    try {
      if (typeof DriveApp === 'undefined') return { url: '', fileId: '' };

      const forms = FormManagementService.getFormList();
      const form = forms.find(f => f.id === formId) || { title: 'Form Laporan Operasional', id: formId || 'OPERATIONAL' };
      const targetFolder = FormManagementService.provisionPhotoFolder_(form.title, form.id);
      if (!targetFolder) return { url: '', fileId: '' };

      let cleanBase64 = String(base64Data);
      if (cleanBase64.indexOf(',') !== -1) {
        cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(',') + 1);
      }
      cleanBase64 = cleanBase64.replace(/\s/g, '');

      const blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), mimeType || 'image/jpeg', `Photo_${Date.now()}.jpg`);
      const file = targetFolder.createFile(blob);

      if (file) {
        try {
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (err) {
          Logger.log('Drive permission notice: ' + err.toString());
        }
        const fileUrl = file.getUrl();
        const fileId = file.getId();
        SpreadsheetRepository.logPhotoUpload(reportId || '', kodeKegiatan || '', fileUrl, fileId);
        return { url: fileUrl, fileId: fileId };
      }

      return { url: '', fileId: '' };
    } catch (e) {
      Logger.log('ReportService Notice: Drive photo upload unavailable: ' + e.toString());
      return { url: '', fileId: '' };
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

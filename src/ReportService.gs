/**
 * ReportService.gs — Application Service for Operational Report Submissions
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: APPLICATION / SERVICE
 * Responsibility: Coordinates validation, triage evaluation, persistence, photo attachment handling, and notifications.
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

    const forms = FormManagementService.getFormList();
    const dForm = forms.find(f => (f.type || '').toLowerCase() === 'harian' || f.isDefaultDaily);
    const targetSheetId = dForm ? dForm.sheetId : null;

    const report = DailyReport(payload);
    const flag = TriageEngine.evaluate([report.empId, report.site, report.date, report.taskStatus, report.yieldKg, report.issues]);
    
    const result = SpreadsheetRepository.saveDailyReport(report, flag, targetSheetId);

    if (flag.severity === ReportSeverity.URGENT) {
      NotificationAdapter.sendUrgentAlert('Laporan Harian', 1, [result.reportId, formatDate(new Date()), report.empId, report.site, report.date, report.taskStatus, report.yieldKg, report.issues, flag.severity], flag);
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

    const forms = FormManagementService.getFormList();
    const gForm = forms.find(f => (f.type || '').toLowerCase() === 'umum' || f.isDefaultGeneral);
    const targetSheetId = gForm ? gForm.sheetId : null;

    const report = GeneralReport(payload);
    const flag = TriageEngine.evaluate([report.empId, report.site, report.date, report.details]);

    if (payload.isSensitive || TriageEngine.isSensitiveRow([report.details, report.sensitiveText])) {
      report.isSensitive = true;
      const result = SpreadsheetRepository.saveGeneralReport(report, flag, targetSheetId);
      
      NotificationAdapter.sendSensitiveAlert({
        reportId: result.reportId,
        site: report.site,
        empId: report.empId,
        date: report.date
      });

      return { success: true, reportId: result.reportId, isSensitive: true };
    }

    const result = SpreadsheetRepository.saveGeneralReport(report, flag, targetSheetId);

    if (flag.severity === ReportSeverity.URGENT) {
      NotificationAdapter.sendUrgentAlert('Laporan Umum', 1, [result.reportId, formatDate(new Date()), report.empId, report.site, report.date, report.details, 'NO', flag.severity], flag);
    }

    return { success: true, reportId: result.reportId, isSensitive: false };
  },

  /**
   * Uploads base64 encoded photo attachment into form's per-form Drive folder (Approach 5a).
   * @param {string} base64Data 
   * @param {string} mimeType 
   * @param {string} formId 
   * @returns {string} File public view URL.
   */
  uploadReportAttachment: function(base64Data, mimeType, formId) {
    if (!base64Data) throw new Error('Blob data foto tidak boleh kosong.');
    
    const forms = FormManagementService.getFormList();
    const form = forms.find(f => f.id === formId);
    let targetFolder;

    if (form) {
      targetFolder = FormManagementService.provisionPhotoFolder_(form.title, form.id);
    } else {
      targetFolder = FormManagementService.provisionPhotoFolder_('Form Laporan', formId || 'GENERAL');
    }

    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), mimeType || 'image/jpeg', `Photo_${Date.now()}.jpg`);
    const file = targetFolder.createFile(blob);
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e) {}

    return file.getUrl();
  },

  /**
   * Submits a dynamic custom form response into form's tab inside integrated spreadsheet.
   * Recognizes photo key specifically and places Drive link in dedicated Foto_Lampiran column (Col 9).
   * @param {string} formId 
   * @param {Object} payload 
   * @returns {{ success: boolean, reportId: string }}
   */
  submitDynamicFormResponse: function(formId, payload) {
    if (!formId || !payload) throw new Error('Form ID dan payload data wajib diisi.');

    const forms = FormManagementService.getFormList();
    const form = forms.find(f => f.id === formId);
    if (!form) throw new Error('Form tidak ditemukan.');

    const reportId = Utilities.getUuid();
    const nowStr = formatDate(new Date());
    const empId = payload.empId || payload.kode_karyawan || 'EMP-DYNAMIC';
    const site = payload.site || payload.lokasi || 'Site A — Kebun & Lahan Pertanian';
    const date = payload.date || payload.tanggal || formatDate(new Date());

    // Extract photo attachment URL if present
    let photoUrl = '';
    const photoKey = Object.keys(payload).find(k => ['foto', 'photo', 'foto_lampiran', 'attachment'].includes(k.toLowerCase()));
    if (photoKey) {
      photoUrl = String(payload[photoKey] || '');
    }

    // Combine remaining custom fields into structured details text (excluding empId, site, date, photo keys)
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
      reportId,
      nowStr,
      empId,
      site,
      date,
      details,
      'NO',        // Task_Status_Or_Details / Yield_Kg / Sensitive
      'None',      // Issues
      photoUrl,    // Col 9: Foto_Lampiran
      flag.severity,
      flag.keywords.join(', '),
      ReviewStatus.UNREVIEWED
    ];

    targetSheet.appendRow(rowData);

    if (flag.severity === ReportSeverity.URGENT) {
      NotificationAdapter.sendUrgentAlert(form.title || 'Form Kustom', targetSheet.getLastRow(), rowData, flag);
    }

    return { success: true, reportId: reportId };
  },

  /**
   * Processes native Google Form submit event for Daily Operational Form.
   * @param {Object} e - Event object.
   */
  processDailyFormSubmit: function(e) {
    try {
      if (!e || !e.range) return;
      const range = e.range;
      const sheet = range.getSheet();
      const row = range.getRow();
      const lastCol = sheet.getLastColumn();
      let rowData = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

      Logger.log('ReportService: Processing Daily Form Submit at row: ' + row);

      const reportId = SpreadsheetRepository.ensureReportId(sheet, row, rowData);
      rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

      const empId = rowData[2] || '';
      const site = rowData[3] || '';
      const date = rowData[4] || '';
      const taskStatus = rowData[5] || '';
      const yieldKg = rowData[6] || '';
      const issues = rowData[7] || '';

      const flag = TriageEngine.evaluate([empId, site, date, taskStatus, yieldKg, issues]);

      if (sheet.getLastColumn() >= 12) {
        sheet.getRange(row, 9, 1, 4).setValues([[
          flag.severity,
          flag.keywords.join(', '),
          flag.isUrgent ? 'YES' : 'NO',
          ReviewStatus.UNREVIEWED
        ]]);
      }

      SpreadsheetRepository.applyRowHighlighting(sheet, row, flag.severity);

      if (flag.severity === ReportSeverity.URGENT) {
        NotificationAdapter.sendUrgentAlert('Laporan Harian (Native Form)', row, rowData, flag);
      }
    } catch (err) {
      Logger.log('ReportService Error in processDailyFormSubmit: ' + err.toString());
    }
  },

  /**
   * Processes native Google Form submit event for General Report Form.
   * @param {Object} e - Event object.
   */
  processGeneralFormSubmit: function(e) {
    try {
      if (!e || !e.range) return;
      const range = e.range;
      const sheet = range.getSheet();
      const row = range.getRow();
      const lastCol = sheet.getLastColumn();
      let rowData = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

      Logger.log('ReportService: Processing General Form Submit at row: ' + row);

      const reportId = SpreadsheetRepository.ensureReportId(sheet, row, rowData);
      rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

      const empId = rowData[2] || '';
      const site = rowData[3] || '';
      const date = rowData[4] || '';
      const details = rowData[5] || '';
      const sensitiveText = rowData[6] || '';

      const flag = TriageEngine.evaluate([empId, site, date, details]);
      const isSensitive = TriageEngine.isSensitiveRow([details, sensitiveText]);

      if (isSensitive) {
        const info = SpreadsheetRepository.moveRowToSensitiveTab(sheet, row, rowData);
        NotificationAdapter.sendSensitiveAlert(info);
        return;
      }

      if (sheet.getLastColumn() >= 11) {
        sheet.getRange(row, 8, 1, 4).setValues([[
          flag.severity,
          flag.keywords.join(', '),
          flag.isUrgent ? 'YES' : 'NO',
          ReviewStatus.UNREVIEWED
        ]]);
      }

      SpreadsheetRepository.applyRowHighlighting(sheet, row, flag.severity);

      if (flag.severity === ReportSeverity.URGENT) {
        NotificationAdapter.sendUrgentAlert('Laporan Umum (Native Form)', row, rowData, flag);
      }
    } catch (err) {
      Logger.log('ReportService Error in processGeneralFormSubmit: ' + err.toString());
    }
  }
};

/**
 * ReportService.gs — Application Service for Operational Report Submissions
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: APPLICATION / SERVICE
 * Responsibility: Coordinates validation, triage evaluation, persistence, and notifications.
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
   * Uploads base64 encoded photo attachment into form's dedicated Drive folder.
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

    if (form && form.driveFolderId) {
      try {
        targetFolder = DriveApp.getFolderById(form.driveFolderId);
      } catch (e) {}
    }
    if (!targetFolder) {
      const parentFolderName = 'Reporting System Data';
      const folderIter = DriveApp.getFoldersByName(parentFolderName);
      targetFolder = folderIter.hasNext() ? folderIter.next() : DriveApp.getRootFolder();
    }

    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), mimeType || 'image/jpeg', `Photo_${Date.now()}.jpg`);
    const file = targetFolder.createFile(blob);
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e) {}

    return file.getUrl();
  },

  /**
   * Submits a dynamic custom form response into form's dedicated sheet.
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

    // Combine custom fields into structured details text
    const textPieces = [];
    Object.keys(payload).forEach(k => {
      if (!['empId', 'site', 'date', 'kode_karyawan', 'lokasi', 'tanggal'].includes(k)) {
        textPieces.push(`${k}: ${payload[k]}`);
      }
    });
    const details = textPieces.join(' | ');

    const flag = TriageEngine.evaluate([empId, site, date, details]);

    const targetSsId = form.sheetId;
    if (!targetSsId) throw new Error('Sheet data form belum terkonfigurasi.');

    const ss = SpreadsheetApp.openById(targetSsId);
    const rawSheet = ss.getSheetByName('Raw') || ss.getSheets()[0];

    const rowData = [
      reportId,
      nowStr,
      empId,
      site,
      date,
      details,
      'NO',
      flag.severity,
      flag.keywords.join(', '),
      flag.isUrgent ? 'YES' : 'NO',
      ReviewStatus.UNREVIEWED
    ];

    rawSheet.appendRow(rowData);

    if (flag.severity === ReportSeverity.URGENT) {
      NotificationAdapter.sendUrgentAlert(form.title || 'Form Kustom', rawSheet.getLastRow(), rowData, flag);
    }

    return { success: true, reportId: reportId };
  }
};

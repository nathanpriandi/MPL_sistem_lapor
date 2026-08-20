/**
 * ClientAPI.gs — Server RPC Controller Functions called by Client (google.script.run)
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: DELIVERY / API CONTROLLER
 * Responsibility: Entry points for client RPC requests.
 * Validates top-level signatures and delegates execution to Application Services.
 */

/**
 * Submits a new Operational Report (Kegiatan, Panen & Penjualan) from Web App.
 * @param {Object} payload 
 * @returns {{ success: boolean, reportId: string, kodeKegiatan: string }}
 */
function submitOperationalReport(payload) {
  return ReportService.submitOperationalReport(payload);
}

/**
 * Returns recent activity codes (Kode Kegiatan) for reference autocomplete.
 * @returns {Array<string>}
 */
function getRecentActivityCodes() {
  return ReportService.getRecentActivityCodes();
}

/**
 * Backward compatibility alias for submitDailyReport.
 * Decision: Retained as permanent backward-compatibility wrapper for legacy form integration harnesses.
 */
function submitDailyReport(payload) {
  return submitOperationalReport(payload);
}

/**
 * Backward compatibility alias for submitGeneralReport.
 * Decision: Retained as permanent backward-compatibility wrapper for legacy form integration harnesses.
 */
function submitGeneralReport(payload) {
  return submitOperationalReport(payload);
}

/**
 * Uploads a base64 photo attachment into form's dedicated Drive folder.
 * @param {string} base64Data 
 * @param {string} mimeType 
 * @param {string} formId 
 * @returns {string} File view URL.
 */
function uploadReportAttachment(base64Data, mimeType, formId) {
  return ReportService.uploadReportAttachment(base64Data, mimeType, formId);
}

/**
 * Returns schema definition for a custom form.
 * @param {string} formId 
 * @returns {Object} { id, title, description, fields }
 */
function getFormSchema(formId) {
  const forms = FormManagementService.getFormList();
  let formRecord = forms.find(f => f.id === formId);

  if (!formRecord && (formId === 'DEFAULT_MAIN_FORM' || !formId)) {
    const mainId = ConfigRepository.getMainFormId();
    if (mainId) formRecord = forms.find(f => f.id === mainId);
  }

  const targetFormId = formRecord ? formRecord.id : formId;

  // Try parsing live Google Form if formId is a valid Google Form ID (not a FORM_KUSTOM_ string)
  if (targetFormId && typeof targetFormId === 'string' && !targetFormId.startsWith('FORM_KUSTOM_')) {
    try {
      const gForm = FormApp.openById(targetFormId);
      const parsedSchema = FormManagementService.parseGoogleFormToSchema(gForm);
      if (parsedSchema) return parsedSchema;
    } catch (e) {
      Logger.log('getFormSchema live FormApp parsing notice: ' + e.toString());
    }
  }

  if (!formRecord) throw new Error('Form tidak ditemukan.');
  return JSON.parse(JSON.stringify({
    id: formRecord.id,
    title: formRecord.title || 'Form Laporan Kustom',
    description: formRecord.description || '',
    type: formRecord.type || 'kustom',
    fields: formRecord.fields || []
  }));
}

/**
 * Submits a dynamic custom form response.
 * @param {string} formId 
 * @param {Object} payload 
 * @returns {{ success: boolean, reportId: string }}
 */
function submitDynamicFormResponse(formId, payload) {
  return ReportService.submitDynamicFormResponse(formId, payload);
}

/**
 * Returns Admin_Queue rows for admin display.
 * @returns {Array} Array of QueueItem objects.
 */
function getAdminQueueData() {
  return AdminService.getAdminQueueData();
}

/**
 * Updates Review_Status of a report by matching Report_ID.
 * @param {string} reportId - Unique UUID of report.
 * @param {string} newStatus - Target status ('Unreviewed', 'In Review', 'Action Needed', 'Closed').
 * @returns {{ success: boolean, reportId: string, sheet?: string, updatedStatus?: string }}
 */
function updateReviewStatus(reportId, newStatus) {
  return AdminService.updateReviewStatus(reportId, newStatus);
}

/**
 * Returns aggregated stats for Executive Manager Dashboard.
 * @returns {Object|null} JSON stats object for dashboard rendering.
 */
function getDashboardStats() {
  return AdminService.getDashboardStats();
}

/**
 * Returns direct quick links for Admin/Manager workspace resources.
 * @returns {{ publicWebAppUrl: string }}
 */
function getAdminQuickLinks() {
  return AdminService.getAdminQuickLinks();
}

/**
 * Returns list of all registered reporting forms.
 * @returns {Array<Object>}
 */
function getRegisteredForms() {
  try {
    const res = FormManagementService.getFormList();
    return JSON.parse(JSON.stringify(res || []));
  } catch (e) {
    Logger.log('ClientAPI Error in getRegisteredForms: ' + e.toString());
    return [];
  }
}

/**
 * Creates and provisions a new Google Form or Custom Dynamic Form.
 * @param {Object} params - { title, description, formType, sites, fields }
 * @returns {Object}
 */
function createNewReportingForm(params) {
  const res = FormManagementService.createForm(params);
  return JSON.parse(JSON.stringify(res || {}));
}

/**
 * Updates form configuration settings and Google Form properties.
 * @param {string} formId 
 * @param {Object} updates - { title, description, status, fields }
 * @returns {Object}
 */
function updateReportingForm(formId, updates) {
  const res = FormManagementService.updateFormConfig(formId, updates);
  return JSON.parse(JSON.stringify(res || {}));
}

/**
 * Deletes a form registration.
 * @param {string} formId 
 * @param {boolean} deleteDriveFile 
 * @returns {boolean}
 */
function deleteReportingForm(formId, deleteDriveFile = false) {
  return FormManagementService.deleteForm(formId, deleteDriveFile);
}

/**
 * Executes historical data migration script from central spreadsheet to per-form dedicated spreadsheets.
 * @returns {Object}
 */
function runHistoricalMigration() {
  return FormManagementService.migrateHistoricalDataToPerFormSheets();
}

/**
 * Retrieves or provisions dedicated spreadsheet URL for a specific form.
 * @param {string} formId 
 * @returns {string} Spreadsheet edit URL.
 */
function getFormSheetUrl(formId) {
  return FormManagementService.getFormSheetUrl(formId);
}

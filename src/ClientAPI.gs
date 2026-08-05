/**
 * ClientAPI.gs — Server RPC Controller Functions called by Client (google.script.run)
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: DELIVERY / API CONTROLLER
 * Responsibility: Entry points for client RPC requests.
 * Validates top-level signatures and delegates execution to Application Services.
 */

/**
 * Submits a new Daily Operational Report from Web App.
 * @param {Object} payload - { empId, site, date, taskStatus, yieldKg, issues }
 * @returns {{ success: boolean, reportId: string }}
 */
function submitDailyReport(payload) {
  return ReportService.submitDailyReport(payload);
}

/**
 * Submits a new General Narrative & Incident Report from Web App.
 * @param {Object} payload - { empId, site, date, details, isSensitive }
 * @returns {{ success: boolean, reportId: string, isSensitive: boolean }}
 */
function submitGeneralReport(payload) {
  return ReportService.submitGeneralReport(payload);
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
  const form = forms.find(f => f.id === formId);
  if (!form) throw new Error('Form tidak ditemukan.');
  return JSON.parse(JSON.stringify({
    id: form.id,
    title: form.title || 'Form Laporan Kustom',
    description: form.description || '',
    type: form.type || 'kustom',
    fields: form.fields || []
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
 * @returns {{ spreadsheetUrl: string, dailyFormEditUrl: string, generalFormEditUrl: string, publicWebAppUrl: string }}
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

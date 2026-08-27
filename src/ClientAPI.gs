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
 * Returns full employee registry (38 default employees + custom additions).
 * @param {boolean} [includeInactive=false]
 * @returns {Array<{ id: string, name: string, division: string, status?: string }>}
 */
function getEmployeeRegistry(includeInactive) {
  return AdminService.getEmployeeRegistry(includeInactive);
}

/**
 * Creates or updates employee record in custom registry.
 * @param {{ id: string, name: string, division: string, status?: string, oldId?: string }} empData 
 * @returns {{ success: boolean, message: string, employee: Object }}
 */
function saveEmployee(empData) {
  return AdminService.saveEmployee(empData);
}

/**
 * Deletes employee from registry.
 * @param {string} empId 
 * @returns {{ success: boolean, message: string }}
 */
function deleteEmployee(empId) {
  return AdminService.deleteEmployee(empId);
}

/**
 * Resets employee registry back to 38 default records.
 * @returns {{ success: boolean, message: string }}
 */
function resetEmployeeRegistry() {
  return AdminService.resetEmployeeRegistry();
}

/**
 * Retrieves reporting form schema.
 * @returns {Object}
 */
function getReportingFormSchema() {
  return AdminService.getReportingFormSchema();
}

/**
 * Saves reporting form schema.
 * @param {Object} schema 
 * @returns {{ success: boolean, message: string, schema: Object }}
 */
function saveReportingFormSchema(schema) {
  return AdminService.saveReportingFormSchema(schema);
}

/**
 * Resets reporting form schema to default.
 * @returns {{ success: boolean, message: string, schema: Object }}
 */
function resetReportingFormSchema() {
  return AdminService.resetReportingFormSchema();
}

/**
 * Explicitly synchronizes custom fields with Google Spreadsheet headers.
 * @returns {{ success: boolean, message: string }}
 */
function syncFormSchemaWithSpreadsheet() {
  return AdminService.syncFormSchemaWithSpreadsheet();
}

/**
 * Synchronizes active Google Form with latest schema.
 * @returns {{ success: boolean, message: string }}
 */
function syncGoogleFormWithLatestDesign() {
  return AdminService.syncGoogleFormWithLatestDesign();
}

/**
 * Searches employee by ID or Name.
 * @param {string} query 
 * @returns {{ id: string, name: string, division: string }|null}
 */
function lookupEmployeeRPC(query) {
  const emp = lookupEmployee(query);
  return emp ? JSON.parse(JSON.stringify(emp)) : null;
}

/**
 * Returns recent activity codes (Kode Kegiatan) for reference autocomplete.
 * @returns {Array<string>}
 */
function getRecentActivityCodes() {
  return ReportService.getRecentActivityCodes();
}


/**
 * Uploads a base64 photo attachment into employee/daily structured Drive folder.
 * @param {string} base64Data 
 * @param {string} mimeType 
 * @param {string} formId 
 * @param {string} [reportId]
 * @param {string} [kodeKegiatan]
 * @param {string} [empId]
 * @param {string} [namaPic]
 * @param {string} [dateStr]
 * @returns {string|Object} File view URL or object.
 */
function uploadReportAttachment(base64Data, mimeType, formId, reportId, kodeKegiatan, empId, namaPic, dateStr) {
  const res = ReportService.uploadReportAttachment(base64Data, mimeType, formId, reportId, kodeKegiatan, empId, namaPic, dateStr);
  return (res && res.url) ? res.url : (res || '');
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
function getDashboardStats(options) {
  return AdminService.getDashboardStats(options);
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

/**
 * Returns list of daily tabs approaching expiration (<= 5 days left) for safety warnings.
 * @returns {Array}
 */
function getExpiringDailyTabs() {
  return AdminService.getExpiringDailyTabs();
}

/**
 * Exports CSV data for a specific daily report tab.
 * @param {string} tabName 
 * @returns {string}
 */
function getDailyTabCsvData(tabName) {
  return AdminService.getDailyTabCsvData(tabName);
}

/**
 * Omits irrelevant and duplicate tabs from the central spreadsheet.
 * @returns {Object}
 */
function cleanupIrrelevantSpreadsheetTabs() {
  return AdminService.cleanupIrrelevantSpreadsheetTabs();
}

/**
 * Returns Google Drive photo storage status, root URL, and expiring folder warnings.
 * @returns {Object}
 */
function getPhotoStorageStatus() {
  const res = AdminService.getPhotoStorageStatus();
  return JSON.parse(JSON.stringify(res || {}));
}

/**
 * Triggers manual cleanup of Google Drive daily photo folders older than 90 days.
 * @param {number} [retentionDays=90]
 * @returns {Object}
 */
function triggerPhotoStorageCleanup(retentionDays) {
  const res = AdminService.cleanupExpiredDailyPhotoFolders(retentionDays);
  return JSON.parse(JSON.stringify(res || {}));
}

/**
 * Triggers purge of legacy 'Reporting System Photos' folder.
 * @returns {Object}
 */
function purgeLegacyPhotoFolders() {
  const res = AdminService.purgeLegacyPhotoFolders();
  return JSON.parse(JSON.stringify(res || {}));
}

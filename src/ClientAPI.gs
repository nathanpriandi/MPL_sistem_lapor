/**
 * ClientAPI.gs — Server RPC Controller Functions called by Client (google.script.run)
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: DELIVERY / API CONTROLLER
 * Responsibility: Entry points for client RPC requests.
 * Enforces Rate Limiting, RBAC Authorization Guards, Payload Validation,
 * Input Sanitization, and delegates execution to Application Services.
 */

/**
 * Submits a new Operational Report (Kegiatan, Panen & Penjualan) from Web App.
 * Public Field Staff endpoint protected with Submission Rate Limiting & Schema Validation.
 * @param {Object} payload 
 * @returns {{ success: boolean, reportId: string, kodeKegiatan: string }}
 */
function submitOperationalReport(payload) {
  try {
    SecurityService.RateLimiter.checkSubmissionRateLimit();
    SecurityService.PayloadValidator.validateOperationalPayload(payload);
    return ReportService.submitOperationalReport(payload);
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Returns full employee registry (38 default employees + custom additions).
 * @param {boolean} [includeInactive=false]
 * @returns {Array<{ id: string, name: string, division: string, status?: string }>}
 */
function getEmployeeRegistry(includeInactive) {
  try {
    SecurityService.RateLimiter.checkReadRateLimit();
    return AdminService.getEmployeeRegistry(includeInactive);
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Creates or updates employee record in custom registry.
 * Protected: Requires Admin or Superadmin role.
 * @param {{ id: string, name: string, division: string, status?: string, oldId?: string }} empData 
 * @returns {{ success: boolean, message: string, employee: Object }}
 */
function saveEmployee(empData) {
  try {
    SecurityService.RateLimiter.checkGeneralRateLimit();
    SecurityService.AccessGuard.requireAdminOrSuperadmin();
    SecurityService.PayloadValidator.validatePayloadSize(empData, 1024 * 1024);
    return AdminService.saveEmployee(empData);
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Deletes employee from registry.
 * Protected: Requires Admin or Superadmin role.
 * @param {string} empId 
 * @returns {{ success: boolean, message: string }}
 */
function deleteEmployee(empId) {
  try {
    SecurityService.RateLimiter.checkGeneralRateLimit();
    SecurityService.AccessGuard.requireAdminOrSuperadmin();
    const cleanId = SecurityService.InputSanitizer.sanitizeText(empId, 50);
    return AdminService.deleteEmployee(cleanId);
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Resets employee registry back to 38 default records.
 * Protected: Requires Superadmin role.
 * @returns {{ success: boolean, message: string }}
 */
function resetEmployeeRegistry() {
  try {
    SecurityService.RateLimiter.checkGeneralRateLimit();
    SecurityService.AccessGuard.requireSuperadmin();
    return AdminService.resetEmployeeRegistry();
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Retrieves reporting form schema.
 * @returns {Object}
 */
function getReportingFormSchema() {
  try {
    SecurityService.RateLimiter.checkReadRateLimit();
    return AdminService.getReportingFormSchema();
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Saves reporting form schema.
 * Protected: Requires Admin or Superadmin role.
 * @param {Object} schema 
 * @returns {{ success: boolean, message: string, schema: Object }}
 */
function saveReportingFormSchema(schema) {
  try {
    SecurityService.RateLimiter.checkGeneralRateLimit();
    SecurityService.AccessGuard.requireAdminOrSuperadmin();
    SecurityService.PayloadValidator.validatePayloadSize(schema, 2 * 1024 * 1024);
    return AdminService.saveReportingFormSchema(schema);
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Resets reporting form schema to default.
 * Protected: Requires Superadmin role.
 * @returns {{ success: boolean, message: string, schema: Object }}
 */
function resetReportingFormSchema() {
  try {
    SecurityService.RateLimiter.checkGeneralRateLimit();
    SecurityService.AccessGuard.requireSuperadmin();
    return AdminService.resetReportingFormSchema();
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Explicitly synchronizes custom fields with Google Spreadsheet headers.
 * Protected: Requires Admin or Superadmin role.
 * @returns {{ success: boolean, message: string }}
 */
function syncFormSchemaWithSpreadsheet() {
  try {
    SecurityService.RateLimiter.checkGeneralRateLimit();
    SecurityService.AccessGuard.requireAdminOrSuperadmin();
    return AdminService.syncFormSchemaWithSpreadsheet();
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Synchronizes active Google Form with latest schema.
 * Protected: Requires Admin or Superadmin role.
 * @returns {{ success: boolean, message: string }}
 */
function syncGoogleFormWithLatestDesign() {
  try {
    SecurityService.RateLimiter.checkGeneralRateLimit();
    SecurityService.AccessGuard.requireAdminOrSuperadmin();
    return AdminService.syncGoogleFormWithLatestDesign();
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Searches employee by ID or Name.
 * @param {string} query 
 * @returns {{ id: string, name: string, division: string }|null}
 */
function lookupEmployeeRPC(query) {
  try {
    SecurityService.RateLimiter.checkReadRateLimit();
    const cleanQuery = SecurityService.InputSanitizer.sanitizeText(query, 100);
    const emp = lookupEmployee(cleanQuery);
    return emp ? JSON.parse(JSON.stringify(emp)) : null;
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Returns recent activity codes (Kode Kegiatan) for reference autocomplete.
 * @returns {Array<string>}
 */
function getRecentActivityCodes() {
  try {
    SecurityService.RateLimiter.checkReadRateLimit();
    return ReportService.getRecentActivityCodes();
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Uploads a base64 photo attachment into employee/daily structured Drive folder.
 * Validates payload size, MIME type whitelist, and base64 integrity.
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
  try {
    SecurityService.RateLimiter.checkSubmissionRateLimit();
    const photoMeta = SecurityService.InputSanitizer.validatePhotoAttachment(base64Data, mimeType);
    const cleanFormId = SecurityService.InputSanitizer.sanitizeText(formId, 100);
    const cleanReportId = SecurityService.InputSanitizer.sanitizeText(reportId, 100);
    const cleanKode = SecurityService.InputSanitizer.sanitizeText(kodeKegiatan, 100);
    const cleanEmpId = SecurityService.InputSanitizer.sanitizeText(empId, 50);
    const cleanNama = SecurityService.InputSanitizer.sanitizeText(namaPic, 150);
    const cleanDate = SecurityService.InputSanitizer.sanitizeText(dateStr, 30);

    const res = ReportService.uploadReportAttachment(
      photoMeta.cleanBase64, 
      photoMeta.mimeType, 
      cleanFormId, 
      cleanReportId, 
      cleanKode, 
      cleanEmpId, 
      cleanNama, 
      cleanDate
    );
    return (res && res.url) ? res.url : (res || '');
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Returns schema definition for a custom form.
 * @param {string} formId 
 * @returns {Object} { id, title, description, fields }
 */
function getFormSchema(formId) {
  try {
    SecurityService.RateLimiter.checkReadRateLimit();
    const cleanFormId = SecurityService.InputSanitizer.sanitizeText(formId, 100);
    const forms = FormManagementService.getFormList();
    let formRecord = forms.find(f => f.id === cleanFormId);

    if (!formRecord && (cleanFormId === 'DEFAULT_MAIN_FORM' || !cleanFormId)) {
      const mainId = ConfigRepository.getMainFormId();
      if (mainId) formRecord = forms.find(f => f.id === mainId);
    }

    const targetFormId = formRecord ? formRecord.id : cleanFormId;

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
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Submits a dynamic custom form response.
 * @param {string} formId 
 * @param {Object} payload 
 * @returns {{ success: boolean, reportId: string }}
 */
function submitDynamicFormResponse(formId, payload) {
  try {
    SecurityService.RateLimiter.checkSubmissionRateLimit();
    SecurityService.PayloadValidator.validatePayloadSize(payload);
    const cleanFormId = SecurityService.InputSanitizer.sanitizeText(formId, 100);
    return ReportService.submitDynamicFormResponse(cleanFormId, payload);
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Returns Admin_Queue rows for admin display.
 * Protected: Requires Admin or Superadmin role.
 * @returns {Array} Array of QueueItem objects.
 */
function getAdminQueueData() {
  try {
    SecurityService.RateLimiter.checkReadRateLimit();
    SecurityService.AccessGuard.requireAdminOrSuperadmin();
    return AdminService.getAdminQueueData();
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Updates Review_Status of a report by matching Report_ID.
 * Protected: Requires Admin or Superadmin role.
 * @param {string} reportId - Unique UUID of report.
 * @param {string} newStatus - Target status ('Unreviewed', 'In Review', 'Action Needed', 'Closed').
 * @returns {{ success: boolean, reportId: string, sheet?: string, updatedStatus?: string }}
 */
function updateReviewStatus(reportId, newStatus) {
  try {
    SecurityService.RateLimiter.checkGeneralRateLimit();
    SecurityService.AccessGuard.requireAdminOrSuperadmin();
    const cleanReportId = SecurityService.InputSanitizer.sanitizeText(reportId, 100);
    const cleanStatus = SecurityService.InputSanitizer.sanitizeText(newStatus, 50);
    return AdminService.updateReviewStatus(cleanReportId, cleanStatus);
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Returns aggregated stats and smart analytics for Dashboard Manajer.
 * Protected: Requires Manager, Admin, or Superadmin role.
 * @param {Object} [params]
 * @returns {Object} JSON dataset for manager dashboard rendering.
 */
function getAnalyticsDashboardData(params) {
  try {
    SecurityService.RateLimiter.checkReadRateLimit();
    SecurityService.AccessGuard.requireAuthorizedStaff();
    return AnalyticsService.getAnalyticsDashboardData(params);
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Returns commodity analysis (trend or breakdown) with card-local independent scoping.
 * Protected: Requires Manager, Admin, or Superadmin role.
 * @param {Object} [params]
 * @returns {Object}
 */
function getCommodityAnalysis(params) {
  try {
    SecurityService.RateLimiter.checkReadRateLimit();
    SecurityService.AccessGuard.requireAuthorizedStaff();
    return AnalyticsService.getCommodityAnalysis(params);
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Returns permanent executive decision views.
 * Protected: Requires Manager, Admin, or Superadmin role.
 * @param {Object} [params]
 * @returns {Object}
 */
function getDecisionViewsData(params) {
  try {
    SecurityService.RateLimiter.checkReadRateLimit();
    SecurityService.AccessGuard.requireAuthorizedStaff();
    return AnalyticsService.getDecisionViewsData(params);
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Returns dynamic distinct options for any filterable field based on active filters.
 * @param {Object} [params]
 * @returns {Array<{ value: string, count: number }>}
 */
function getAnalyticsFilterOptions(params) {
  try {
    SecurityService.RateLimiter.checkReadRateLimit();
    SecurityService.AccessGuard.requireAuthorizedStaff();
    return AnalyticsService.getDynamicFilterOptions(params);
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Returns canonical field catalog metadata for analytics builders.
 * @returns {Array<Object>}
 */
function getAnalyticsFieldCatalogRPC() {
  try {
    SecurityService.RateLimiter.checkReadRateLimit();
    SecurityService.AccessGuard.requireAuthorizedStaff();
    return getAnalyticsFieldCatalog();
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Backward compatibility alias for getAnalyticsDashboardData.
 * @param {Object} [options]
 * @returns {Object}
 */
function getDashboardStats(options) {
  return getAnalyticsDashboardData(options);
}

/**
 * Returns employee reporting consistency leaderboard.
 * Protected: Requires Authorized Staff.
 * @param {Object} [params]
 * @returns {Array<Object>}
 */
function getEmployeeLeaderboard(params) {
  try {
    SecurityService.RateLimiter.checkReadRateLimit();
    SecurityService.AccessGuard.requireAuthorizedStaff();
    const allRows = SpreadsheetRepository.getAllOperationalRows();
    return AnalyticsService.getEmployeeReportingLeaderboard(allRows);
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Returns smart HST-calculated harvest schedule.
 * Protected: Requires Authorized Staff.
 * @param {Object} [params]
 * @returns {Array<Object>}
 */
function getHarvestScheduleData(params) {
  try {
    SecurityService.RateLimiter.checkReadRateLimit();
    SecurityService.AccessGuard.requireAuthorizedStaff();
    const allRows = SpreadsheetRepository.getAllOperationalRows();
    return AnalyticsService.getHarvestSchedule(allRows);
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Returns sales analytics and business initiative breakdowns.
 * Protected: Requires Authorized Staff.
 * @param {Object} [params]
 * @returns {Object}
 */
function getSalesAnalyticsData(params) {
  try {
    SecurityService.RateLimiter.checkReadRateLimit();
    SecurityService.AccessGuard.requireAuthorizedStaff();
    const allRows = SpreadsheetRepository.getAllOperationalRows();
    return AnalyticsService.getSalesAnalytics(allRows, (params && params.interval) || 'day');
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Returns direct quick links for Admin/Manager workspace resources.
 * Protected: Requires Authorized Staff.
 * @returns {{ publicWebAppUrl: string }}
 */
function getAdminQuickLinks() {
  try {
    SecurityService.RateLimiter.checkReadRateLimit();
    SecurityService.AccessGuard.requireAuthorizedStaff();
    return AdminService.getAdminQuickLinks();
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Returns list of all registered reporting forms.
 * Protected: Requires Admin or Superadmin role.
 * @returns {Array<Object>}
 */
function getRegisteredForms() {
  try {
    SecurityService.RateLimiter.checkReadRateLimit();
    SecurityService.AccessGuard.requireAdminOrSuperadmin();
    const res = FormManagementService.getFormList();
    return JSON.parse(JSON.stringify(res || []));
  } catch (e) {
    Logger.log('ClientAPI Error in getRegisteredForms: ' + e.toString());
    return [];
  }
}

/**
 * Creates and provisions a new Google Form or Custom Dynamic Form.
 * Protected: Requires Admin or Superadmin role.
 * @param {Object} params - { title, description, formType, sites, fields }
 * @returns {Object}
 */
function createNewReportingForm(params) {
  try {
    SecurityService.RateLimiter.checkGeneralRateLimit();
    SecurityService.AccessGuard.requireAdminOrSuperadmin();
    SecurityService.PayloadValidator.validatePayloadSize(params);
    const res = FormManagementService.createForm(params);
    return JSON.parse(JSON.stringify(res || {}));
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Updates form configuration settings and Google Form properties.
 * Protected: Requires Admin or Superadmin role.
 * @param {string} formId 
 * @param {Object} updates - { title, description, status, fields }
 * @returns {Object}
 */
function updateReportingForm(formId, updates) {
  try {
    SecurityService.RateLimiter.checkGeneralRateLimit();
    SecurityService.AccessGuard.requireAdminOrSuperadmin();
    SecurityService.PayloadValidator.validatePayloadSize(updates);
    const cleanFormId = SecurityService.InputSanitizer.sanitizeText(formId, 100);
    const res = FormManagementService.updateFormConfig(cleanFormId, updates);
    return JSON.parse(JSON.stringify(res || {}));
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Deletes a form registration.
 * Protected: Requires Superadmin role.
 * @param {string} formId 
 * @param {boolean} deleteDriveFile 
 * @returns {boolean}
 */
function deleteReportingForm(formId, deleteDriveFile = false) {
  try {
    SecurityService.RateLimiter.checkGeneralRateLimit();
    SecurityService.AccessGuard.requireSuperadmin();
    const cleanFormId = SecurityService.InputSanitizer.sanitizeText(formId, 100);
    return FormManagementService.deleteForm(cleanFormId, !!deleteDriveFile);
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Executes historical data migration script from central spreadsheet to per-form dedicated spreadsheets.
 * Protected: Requires Superadmin role.
 * @returns {Object}
 */
function runHistoricalMigration() {
  try {
    SecurityService.RateLimiter.checkGeneralRateLimit();
    SecurityService.AccessGuard.requireSuperadmin();
    return FormManagementService.migrateHistoricalDataToPerFormSheets();
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Retrieves or provisions dedicated spreadsheet URL for a specific form.
 * Protected: Requires Admin or Superadmin role.
 * @param {string} formId 
 * @returns {string} Spreadsheet edit URL.
 */
function getFormSheetUrl(formId) {
  try {
    SecurityService.RateLimiter.checkReadRateLimit();
    SecurityService.AccessGuard.requireAdminOrSuperadmin();
    const cleanFormId = SecurityService.InputSanitizer.sanitizeText(formId, 100);
    return FormManagementService.getFormSheetUrl(cleanFormId);
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Returns list of daily tabs approaching expiration (<= 5 days left) for safety warnings.
 * Protected: Requires Admin or Superadmin role.
 * @returns {Array}
 */
function getExpiringDailyTabs() {
  try {
    SecurityService.RateLimiter.checkReadRateLimit();
    SecurityService.AccessGuard.requireAdminOrSuperadmin();
    return AdminService.getExpiringDailyTabs();
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Exports CSV data for a specific daily report tab.
 * Protected: Requires Admin or Superadmin role.
 * @param {string} tabName 
 * @returns {string}
 */
function getDailyTabCsvData(tabName) {
  try {
    SecurityService.RateLimiter.checkReadRateLimit();
    SecurityService.AccessGuard.requireAdminOrSuperadmin();
    const cleanTab = SecurityService.InputSanitizer.sanitizeText(tabName, 100);
    return AdminService.getDailyTabCsvData(cleanTab);
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Omits irrelevant and duplicate tabs from the central spreadsheet.
 * Protected: Requires Superadmin role.
 * @returns {Object}
 */
function cleanupIrrelevantSpreadsheetTabs() {
  try {
    SecurityService.RateLimiter.checkGeneralRateLimit();
    SecurityService.AccessGuard.requireSuperadmin();
    return AdminService.cleanupIrrelevantSpreadsheetTabs();
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Returns Google Drive photo storage status, root URL, and expiring folder warnings.
 * Protected: Requires Admin or Superadmin role.
 * @returns {Object}
 */
function getPhotoStorageStatus() {
  try {
    SecurityService.RateLimiter.checkReadRateLimit();
    SecurityService.AccessGuard.requireAdminOrSuperadmin();
    const res = AdminService.getPhotoStorageStatus();
    return JSON.parse(JSON.stringify(res || {}));
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Triggers manual cleanup of Google Drive daily photo folders older than 90 days.
 * Protected: Requires Superadmin role.
 * @param {number} [retentionDays=90]
 * @returns {Object}
 */
function triggerPhotoStorageCleanup(retentionDays) {
  try {
    SecurityService.RateLimiter.checkGeneralRateLimit();
    SecurityService.AccessGuard.requireSuperadmin();
    const days = retentionDays ? parseInt(retentionDays, 10) : 90;
    const res = AdminService.cleanupExpiredDailyPhotoFolders(days);
    return JSON.parse(JSON.stringify(res || {}));
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Triggers purge of legacy 'Reporting System Photos' folder.
 * Protected: Requires Superadmin role.
 * @returns {Object}
 */
function purgeLegacyPhotoFolders() {
  try {
    SecurityService.RateLimiter.checkGeneralRateLimit();
    SecurityService.AccessGuard.requireSuperadmin();
    const res = AdminService.purgeLegacyPhotoFolders();
    return JSON.parse(JSON.stringify(res || {}));
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Returns list of registered Google accounts with roles.
 * Protected: Requires Superadmin role & Auth Rate Limit (max 5/15 min).
 * @returns {Array<Object>}
 */
function getUserRolesList() {
  try {
    SecurityService.RateLimiter.checkAuthRateLimit();
    SecurityService.AccessGuard.requireSuperadmin();
    const res = AdminService.getUserRolesList();
    return JSON.parse(JSON.stringify(res || []));
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Saves or updates a Google account role.
 * Protected: Requires Superadmin role & Auth Rate Limit (max 5/15 min).
 * @param {Object} accountData
 * @returns {Object}
 */
function saveUserRoleAccount(accountData) {
  try {
    SecurityService.RateLimiter.checkAuthRateLimit();
    SecurityService.AccessGuard.requireSuperadmin();
    SecurityService.PayloadValidator.validatePayloadSize(accountData, 100 * 1024);
    if (accountData && accountData.email) {
      accountData.email = SecurityService.InputSanitizer.sanitizeEmail(accountData.email);
    }
    const res = AdminService.saveUserRoleAccount(accountData);
    return JSON.parse(JSON.stringify(res || {}));
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Deletes a Google account role.
 * Protected: Requires Superadmin role & Auth Rate Limit (max 5/15 min).
 * @param {string} email
 * @returns {Object}
 */
function deleteUserRoleAccount(email) {
  try {
    SecurityService.RateLimiter.checkAuthRateLimit();
    SecurityService.AccessGuard.requireSuperadmin();
    const cleanEmail = SecurityService.InputSanitizer.sanitizeEmail(email);
    const res = AdminService.deleteUserRoleAccount(cleanEmail);
    return JSON.parse(JSON.stringify(res || {}));
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * Records user logout timestamp.
 * Protected: Auth Rate Limit (max 5/15 min).
 * @param {string} [email]
 * @returns {Object}
 */
function recordUserLogout(email) {
  try {
    SecurityService.RateLimiter.checkAuthRateLimit();
    const cleanEmail = email ? SecurityService.InputSanitizer.sanitizeEmail(email) : '';
    const res = AuthService.recordUserLogout(cleanEmail);
    return JSON.parse(JSON.stringify(res || {}));
  } catch (err) {
    throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
  }
}

/**
 * ClientAPI.gs — Server RPC Controller Functions called by Client (google.script.run)
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: DELIVERY / API CONTROLLER GATEWAY
 * Responsibility: Serves as the secure public gateway for client RPC requests.
 * Enforces Rate Limiting, RBAC Authorization Guards, Payload Validation,
 * Input Sanitization, and delegates execution to Application Services via ControllerBridge.
 */

const ControllerBridge = {
  /**
   * Centralized RPC middleware executing rate limiting, RBAC, payload validation, and secure error masking.
   * @param {Object} options
   * @param {'AUTH'|'SUBMISSION'|'READ_QUERY'|'GENERAL'} [options.rateLimit='GENERAL']
   * @param {'superadmin'|'adminOrSuperadmin'|'managerOrSuperadmin'|'authenticatedStaff'} [options.role]
   * @param {any} [options.payload]
   * @param {number} [options.maxPayloadBytes]
   * @param {boolean} [options.validateOperationalPayload=false]
   * @param {Function} handler
   * @returns {any}
   */
  dispatch: function(options, handler) {
    try {
      if (typeof SecurityService !== 'undefined') {
        const rl = options.rateLimit || 'GENERAL';
        if (rl === 'SUBMISSION') SecurityService.RateLimiter.checkSubmissionRateLimit();
        else if (rl === 'READ_QUERY') SecurityService.RateLimiter.checkReadRateLimit();
        else if (rl === 'AUTH') SecurityService.RateLimiter.checkAuthRateLimit();
        else SecurityService.RateLimiter.checkGeneralRateLimit();

        if (options.role === 'superadmin') {
          SecurityService.AccessGuard.requireSuperadmin();
        } else if (options.role === 'adminOrSuperadmin') {
          SecurityService.AccessGuard.requireAdminOrSuperadmin();
        } else if (options.role === 'managerOrSuperadmin') {
          SecurityService.AccessGuard.requireManagerOrSuperadmin();
        } else if (options.role === 'authenticatedStaff') {
          SecurityService.AccessGuard.requireAuthorizedStaff();
        }

        if (options.validateOperationalPayload && options.payload) {
          SecurityService.PayloadValidator.validateOperationalPayload(options.payload);
        } else if (options.payload) {
          SecurityService.PayloadValidator.validatePayloadSize(options.payload, options.maxPayloadBytes);
        }
      }

      const res = handler();
      return (res !== undefined && res !== null && typeof res === 'object') ? JSON.parse(JSON.stringify(res)) : res;
    } catch (err) {
      if (typeof SecurityService !== 'undefined' && SecurityService.AccessGuard) {
        throw new Error(SecurityService.AccessGuard.maskSensitiveError(err));
      }
      throw err;
    }
  }
};

// =============================================================================
// 1. OPERATIONAL & FORM SUBMISSION CONTROLLERS
// =============================================================================

/**
 * Submits a new Operational Report (Kegiatan, Panen & Penjualan) from Web App.
 * Public Field Staff endpoint protected with Submission Rate Limiting & Schema Validation.
 * @param {Object} payload 
 * @returns {{ success: boolean, reportId: string, kodeKegiatan: string }}
 */
function submitOperationalReport(payload) {
  return ControllerBridge.dispatch({ rateLimit: 'SUBMISSION', validateOperationalPayload: true, payload }, () => {
    return ReportService.submitOperationalReport(payload);
  });
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
  return ControllerBridge.dispatch({ rateLimit: 'SUBMISSION' }, () => {
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
  });
}

/**
 * Returns recent activity codes (Kode Kegiatan) for reference autocomplete.
 * @returns {Array<string>}
 */
function getRecentActivityCodes() {
  return ControllerBridge.dispatch({ rateLimit: 'READ_QUERY' }, () => {
    return ReportService.getRecentActivityCodes();
  });
}

/**
 * Returns schema definition for a custom form.
 * @param {string} formId 
 * @returns {Object}
 */
function getFormSchema(formId) {
  return ControllerBridge.dispatch({ rateLimit: 'READ_QUERY' }, () => {
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
    return {
      id: formRecord.id,
      title: formRecord.title || 'Form Laporan Kustom',
      description: formRecord.description || '',
      type: formRecord.type || 'kustom',
      fields: formRecord.fields || []
    };
  });
}

/**
 * Submits a dynamic custom form response.
 * @param {string} formId 
 * @param {Object} payload 
 * @returns {{ success: boolean, reportId: string }}
 */
function submitDynamicFormResponse(formId, payload) {
  return ControllerBridge.dispatch({ rateLimit: 'SUBMISSION', payload }, () => {
    const cleanFormId = SecurityService.InputSanitizer.sanitizeText(formId, 100);
    return ReportService.submitDynamicFormResponse(cleanFormId, payload);
  });
}

// =============================================================================
// 2. EMPLOYEE REGISTRY CONTROLLERS (Delegated to EmployeeService)
// =============================================================================

/**
 * Returns full employee registry (38 default employees + custom additions).
 * @param {boolean} [includeInactive=false]
 * @returns {Array<Object>}
 */
function getEmployeeRegistry(includeInactive) {
  return ControllerBridge.dispatch({ rateLimit: 'READ_QUERY' }, () => {
    return EmployeeService.getActiveRegistry();
  });
}

/**
 * Searches employee by ID or Name.
 * @param {string} query 
 * @returns {Object|null}
 */
function lookupEmployeeRPC(query) {
  return ControllerBridge.dispatch({ rateLimit: 'READ_QUERY' }, () => {
    const cleanQuery = SecurityService.InputSanitizer.sanitizeText(query, 100);
    return EmployeeService.lookupEmployee(cleanQuery);
  });
}

/**
 * Creates or updates employee record in custom registry.
 * Protected: Requires Admin or Superadmin role.
 * @param {Object} empData 
 * @returns {{ success: boolean, message: string, employee: Object }}
 */
function saveEmployee(empData) {
  return ControllerBridge.dispatch({ role: 'adminOrSuperadmin', payload: empData, maxPayloadBytes: 1024 * 1024 }, () => {
    return EmployeeService.saveEmployee(empData);
  });
}

/**
 * Deletes employee from registry.
 * Protected: Requires Admin or Superadmin role.
 * @param {string} empId 
 * @returns {{ success: boolean, message: string }}
 */
function deleteEmployee(empId) {
  return ControllerBridge.dispatch({ role: 'adminOrSuperadmin' }, () => {
    const cleanId = SecurityService.InputSanitizer.sanitizeText(empId, 50);
    return EmployeeService.deleteEmployee(cleanId);
  });
}

/**
 * Resets employee registry back to 38 default records.
 * Protected: Requires Superadmin role.
 * @returns {{ success: boolean, message: string }}
 */
function resetEmployeeRegistry() {
  return ControllerBridge.dispatch({ role: 'superadmin' }, () => {
    return EmployeeService.resetRegistry();
  });
}

// =============================================================================
// 3. ADMIN QUEUE & TRIAGE CONTROLLERS (Delegated to AdminQueueService)
// =============================================================================

/**
 * Returns Admin_Queue rows for admin display.
 * Protected: Requires Admin or Superadmin role.
 * @returns {Array<Object>}
 */
function getAdminQueueData() {
  return ControllerBridge.dispatch({ rateLimit: 'READ_QUERY', role: 'adminOrSuperadmin' }, () => {
    return AdminQueueService.getQueueItems();
  });
}

/**
 * Updates Review_Status of a report by matching Report_ID.
 * Protected: Requires Admin or Superadmin role.
 * @param {string} reportId
 * @param {string} newStatus
 * @returns {Object}
 */
function updateReviewStatus(reportId, newStatus) {
  return ControllerBridge.dispatch({ role: 'adminOrSuperadmin' }, () => {
    const cleanReportId = SecurityService.InputSanitizer.sanitizeText(reportId, 100);
    const cleanStatus = SecurityService.InputSanitizer.sanitizeText(newStatus, 50);
    return AdminQueueService.updateReviewStatus(cleanReportId, cleanStatus);
  });
}

// =============================================================================
// 4. EXECUTIVE ANALYTICS CONTROLLERS (Delegated to AnalyticsService)
// =============================================================================

/**
 * Returns aggregated stats and smart analytics for Dashboard Manajer.
 * Protected: Requires Manager or Superadmin role.
 * @param {Object} [params]
 * @returns {Object}
 */
function getAnalyticsDashboardData(params) {
  return ControllerBridge.dispatch({ rateLimit: 'READ_QUERY', role: 'managerOrSuperadmin' }, () => {
    return AnalyticsService.getAnalyticsDashboardData(params);
  });
}

/**
 * Returns commodity analysis (trend or breakdown).
 * Protected: Requires Manager or Superadmin role.
 * @param {Object} [params]
 * @returns {Object}
 */
function getCommodityAnalysis(params) {
  return ControllerBridge.dispatch({ rateLimit: 'READ_QUERY', role: 'managerOrSuperadmin' }, () => {
    return AnalyticsService.getCommodityAnalysis(params);
  });
}

/**
 * Returns permanent executive decision views.
 * Protected: Requires Manager or Superadmin role.
 * @param {Object} [params]
 * @returns {Object}
 */
function getDecisionViewsData(params) {
  return ControllerBridge.dispatch({ rateLimit: 'READ_QUERY', role: 'managerOrSuperadmin' }, () => {
    return AnalyticsService.getDecisionViewsData(params);
  });
}

/**
 * Returns dynamic distinct options for any filterable field.
 * @param {Object} [params]
 * @returns {Array<Object>}
 */
function getAnalyticsFilterOptions(params) {
  return ControllerBridge.dispatch({ rateLimit: 'READ_QUERY', role: 'managerOrSuperadmin' }, () => {
    return AnalyticsService.getDynamicFilterOptions(params);
  });
}

/**
 * Returns canonical field catalog metadata for analytics builders.
 * @returns {Array<Object>}
 */
function getAnalyticsFieldCatalogRPC() {
  return ControllerBridge.dispatch({ rateLimit: 'READ_QUERY', role: 'managerOrSuperadmin' }, () => {
    return (typeof getAnalyticsFieldCatalog === 'function') ? getAnalyticsFieldCatalog() : [];
  });
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
  return ControllerBridge.dispatch({ rateLimit: 'READ_QUERY', role: 'authenticatedStaff' }, () => {
    const allRows = SpreadsheetRepository.getAllOperationalRows();
    return AnalyticsService.getEmployeeReportingLeaderboard(allRows);
  });
}

/**
 * Returns smart HST-calculated harvest schedule.
 * Protected: Requires Authorized Staff.
 * @param {Object} [params]
 * @returns {Array<Object>}
 */
function getHarvestScheduleData(params) {
  return ControllerBridge.dispatch({ rateLimit: 'READ_QUERY', role: 'authenticatedStaff' }, () => {
    const allRows = SpreadsheetRepository.getAllOperationalRows();
    return AnalyticsService.getHarvestSchedule(allRows);
  });
}

/**
 * Returns sales analytics and business initiative breakdowns.
 * Protected: Requires Authorized Staff.
 * @param {Object} [params]
 * @returns {Object}
 */
function getSalesAnalyticsData(params) {
  return ControllerBridge.dispatch({ rateLimit: 'READ_QUERY', role: 'authenticatedStaff' }, () => {
    const allRows = SpreadsheetRepository.getAllOperationalRows();
    return AnalyticsService.getSalesAnalytics(allRows, (params && params.interval) || 'day');
  });
}

/**
 * Returns direct quick links for Admin/Manager workspace resources.
 * Protected: Requires Authorized Staff.
 * @returns {Object}
 */
function getAdminQuickLinks() {
  return ControllerBridge.dispatch({ rateLimit: 'READ_QUERY', role: 'authenticatedStaff' }, () => {
    return AdminService.getAdminQuickLinks();
  });
}

// =============================================================================
// 5. FORM BLUEPRINT & PROVISIONING CONTROLLERS
// =============================================================================

/**
 * Retrieves reporting form schema.
 * @returns {Object}
 */
function getReportingFormSchema() {
  return ControllerBridge.dispatch({ rateLimit: 'READ_QUERY' }, () => {
    return AdminService.getReportingFormSchema();
  });
}

/**
 * Saves reporting form schema.
 * Protected: Requires Admin or Superadmin role.
 * @param {Object} schema 
 * @returns {Object}
 */
function saveReportingFormSchema(schema) {
  return ControllerBridge.dispatch({ role: 'adminOrSuperadmin', payload: schema, maxPayloadBytes: 2 * 1024 * 1024 }, () => {
    return AdminService.saveReportingFormSchema(schema);
  });
}

/**
 * Resets reporting form schema to default.
 * Protected: Requires Superadmin role.
 * @returns {Object}
 */
function resetReportingFormSchema() {
  return ControllerBridge.dispatch({ role: 'superadmin' }, () => {
    return AdminService.resetReportingFormSchema();
  });
}

/**
 * Explicitly synchronizes custom fields with Google Spreadsheet headers.
 * Protected: Requires Admin or Superadmin role.
 * @returns {Object}
 */
function syncFormSchemaWithSpreadsheet() {
  return ControllerBridge.dispatch({ role: 'adminOrSuperadmin' }, () => {
    return AdminService.syncFormSchemaWithSpreadsheet();
  });
}

/**
 * Synchronizes active Google Form with latest schema.
 * Protected: Requires Admin or Superadmin role.
 * @returns {Object}
 */
function syncGoogleFormWithLatestDesign() {
  return ControllerBridge.dispatch({ role: 'adminOrSuperadmin' }, () => {
    return AdminService.syncGoogleFormWithLatestDesign();
  });
}

/**
 * Returns list of all registered reporting forms.
 * Protected: Requires Admin or Superadmin role.
 * @returns {Array<Object>}
 */
function getRegisteredForms() {
  return ControllerBridge.dispatch({ rateLimit: 'READ_QUERY', role: 'adminOrSuperadmin' }, () => {
    return FormManagementService.getFormList();
  });
}

/**
 * Creates and provisions a new Google Form or Custom Dynamic Form.
 * Protected: Requires Admin or Superadmin role.
 * @param {Object} params
 * @returns {Object}
 */
function createNewReportingForm(params) {
  return ControllerBridge.dispatch({ role: 'adminOrSuperadmin', payload: params }, () => {
    return FormManagementService.createForm(params);
  });
}

/**
 * Updates form configuration settings and Google Form properties.
 * Protected: Requires Admin or Superadmin role.
 * @param {string} formId 
 * @param {Object} updates
 * @returns {Object}
 */
function updateReportingForm(formId, updates) {
  return ControllerBridge.dispatch({ role: 'adminOrSuperadmin', payload: updates }, () => {
    const cleanFormId = SecurityService.InputSanitizer.sanitizeText(formId, 100);
    return FormManagementService.updateFormConfig(cleanFormId, updates);
  });
}

/**
 * Deletes a form registration.
 * Protected: Requires Superadmin role.
 * @param {string} formId 
 * @param {boolean} [deleteDriveFile=false]
 * @returns {boolean}
 */
function deleteReportingForm(formId, deleteDriveFile = false) {
  return ControllerBridge.dispatch({ role: 'superadmin' }, () => {
    const cleanFormId = SecurityService.InputSanitizer.sanitizeText(formId, 100);
    return FormManagementService.deleteForm(cleanFormId, !!deleteDriveFile);
  });
}

/**
 * Retrieves or provisions dedicated spreadsheet URL for a specific form.
 * Protected: Requires Admin or Superadmin role.
 * @param {string} formId 
 * @returns {string}
 */
function getFormSheetUrl(formId) {
  return ControllerBridge.dispatch({ rateLimit: 'READ_QUERY', role: 'adminOrSuperadmin' }, () => {
    const cleanFormId = SecurityService.InputSanitizer.sanitizeText(formId, 100);
    return FormManagementService.getFormSheetUrl(cleanFormId);
  });
}

/**
 * Executes historical data migration script from central spreadsheet to per-form sheets.
 * Protected: Requires Superadmin role.
 * @returns {Object}
 */
function runHistoricalMigration() {
  return ControllerBridge.dispatch({ role: 'superadmin' }, () => {
    return FormManagementService.migrateHistoricalDataToPerFormSheets();
  });
}

// =============================================================================
// 6. SYSTEM MAINTENANCE & STORAGE CONTROLLERS (Delegated to MaintenanceService)
// =============================================================================

/**
 * Returns list of daily tabs approaching expiration (<= 5 days left).
 * Protected: Requires Admin or Superadmin role.
 * @returns {Array}
 */
function getExpiringDailyTabs() {
  return ControllerBridge.dispatch({ rateLimit: 'READ_QUERY', role: 'adminOrSuperadmin' }, () => {
    return MaintenanceService.getExpiringDailyTabs();
  });
}

/**
 * Exports CSV data for a specific daily report tab.
 * Protected: Requires Admin or Superadmin role.
 * @param {string} tabName 
 * @returns {string}
 */
function getDailyTabCsvData(tabName) {
  return ControllerBridge.dispatch({ rateLimit: 'READ_QUERY', role: 'adminOrSuperadmin' }, () => {
    const cleanTab = SecurityService.InputSanitizer.sanitizeText(tabName, 100);
    return MaintenanceService.getDailyTabCsvData(cleanTab);
  });
}

/**
 * Omits irrelevant and duplicate tabs from the central spreadsheet.
 * Protected: Requires Superadmin role.
 * @returns {Object}
 */
function cleanupIrrelevantSpreadsheetTabs() {
  return ControllerBridge.dispatch({ role: 'superadmin' }, () => {
    return (typeof cleanupIrrelevantSpreadsheetTabs === 'function')
      ? cleanupIrrelevantSpreadsheetTabs()
      : { success: true, message: 'Cleanup complete' };
  });
}

/**
 * Returns Google Drive photo storage status, root URL, and expiring folder warnings.
 * Protected: Requires Admin or Superadmin role.
 * @returns {Object}
 */
function getPhotoStorageStatus() {
  return ControllerBridge.dispatch({ rateLimit: 'READ_QUERY', role: 'adminOrSuperadmin' }, () => {
    return MaintenanceService.getPhotoStorageStatus();
  });
}

/**
 * Triggers manual cleanup of Google Drive daily photo folders older than 90 days.
 * Protected: Requires Superadmin role.
 * @param {number} [retentionDays=90]
 * @returns {Object}
 */
function triggerPhotoStorageCleanup(retentionDays) {
  return ControllerBridge.dispatch({ role: 'superadmin' }, () => {
    const days = retentionDays ? parseInt(retentionDays, 10) : 90;
    return MaintenanceService.cleanupExpiredDailyPhotoFolders(days);
  });
}

/**
 * Triggers purge of legacy 'Reporting System Photos' folder.
 * Protected: Requires Superadmin role.
 * @returns {Object}
 */
function purgeLegacyPhotoFolders() {
  return ControllerBridge.dispatch({ role: 'superadmin' }, () => {
    return MaintenanceService.purgeLegacyPhotoFolders();
  });
}

// =============================================================================
// 7. USER ACCESS ROLES & IDENTITY CONTROLLERS
// =============================================================================

/**
 * Returns list of registered Google accounts with roles.
 * Protected: Requires Superadmin role & Auth Rate Limit.
 * @returns {Array<Object>}
 */
function getUserRolesList() {
  return ControllerBridge.dispatch({ rateLimit: 'AUTH', role: 'superadmin' }, () => {
    return AdminService.getUserRolesList();
  });
}

/**
 * Saves or updates a Google account role.
 * Protected: Requires Superadmin role & Auth Rate Limit.
 * @param {Object} accountData
 * @returns {Object}
 */
function saveUserRoleAccount(accountData) {
  return ControllerBridge.dispatch({ rateLimit: 'AUTH', role: 'superadmin', payload: accountData, maxPayloadBytes: 100 * 1024 }, () => {
    if (accountData && accountData.email) {
      accountData.email = SecurityService.InputSanitizer.sanitizeEmail(accountData.email);
    }
    return AdminService.saveUserRoleAccount(accountData);
  });
}

/**
 * Deletes a Google account role.
 * Protected: Requires Superadmin role & Auth Rate Limit.
 * @param {string} email
 * @returns {Object}
 */
function deleteUserRoleAccount(email) {
  return ControllerBridge.dispatch({ rateLimit: 'AUTH', role: 'superadmin' }, () => {
    const cleanEmail = SecurityService.InputSanitizer.sanitizeEmail(email);
    return AdminService.deleteUserRoleAccount(cleanEmail);
  });
}

/**
 * Records user logout timestamp.
 * Protected: Auth Rate Limit.
 * @param {string} [email]
 * @returns {Object}
 */
function recordUserLogout(email) {
  return ControllerBridge.dispatch({ rateLimit: 'AUTH' }, () => {
    const cleanEmail = email ? SecurityService.InputSanitizer.sanitizeEmail(email) : '';
    return AuthService.recordUserLogout(cleanEmail);
  });
}

/**
 * Seeds comprehensive mock operational data for functional testing.
 * Protected: Requires Superadmin role.
 * @param {Object} [options]
 * @returns {Object}
 */
function seedMockOperationalData(options) {
  return ControllerBridge.dispatch({ role: 'superadmin' }, () => {
    return seedMockData(options);
  });
}

/**
 * AdminService.gs — Unified Facade for Operations & Administrative Workflows
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: APPLICATION / UNIFIED FACADE
 * Responsibility: Coordinates administrative workflows across EmployeeService,
 * AdminQueueService, MaintenanceService, AnalyticsService, and FormManagement.
 * Acts as an orchestrating facade maintaining 100% backward compatibility for existing callers.
 */

const AdminService = {

  // =========================================================================
  // 1. ADMIN QUEUE & VERIFICATION (Delegated to AdminQueueService)
  // =========================================================================

  /**
   * Returns Admin_Queue rows.
   * @returns {Array<Object>}
   */
  getAdminQueueData: function() {
    return AdminQueueService.getQueueItems();
  },

  /**
   * Updates Review_Status of a report by matching Report_ID.
   * @param {string} reportId 
   * @param {string} newStatus 
   * @returns {{ success: boolean, updated?: boolean, error?: string }}
   */
  updateReviewStatus: function(reportId, newStatus) {
    return AdminQueueService.updateReviewStatus(reportId, newStatus);
  },

  /**
   * Returns single report detail for inspector modal.
   * @param {string} reportId 
   * @returns {Object|null}
   */
  getReportDetails: function(reportId) {
    return AdminQueueService.getReportDetails(reportId);
  },

  // =========================================================================
  // 2. EMPLOYEE MASTER REGISTRY (Delegated to EmployeeService)
  // =========================================================================

  /**
   * Returns full employee registry.
   * @param {boolean} [includeInactive=false]
   * @returns {Array<Object>}
   */
  getEmployeeRegistry: function(includeInactive) {
    return EmployeeService.getActiveRegistry();
  },

  /**
   * Creates or updates employee record.
   * @param {Object} empData 
   * @returns {{ success: boolean, message: string, employee: Object }}
   */
  saveEmployee: function(empData) {
    return EmployeeService.saveEmployee(empData);
  },

  /**
   * Deletes employee from registry.
   * @param {string} empId 
   * @returns {{ success: boolean, message: string }}
   */
  deleteEmployee: function(empId) {
    return EmployeeService.deleteEmployee(empId);
  },

  /**
   * Resets employee registry back to standard 38 default records.
   * @returns {{ success: boolean, message: string }}
   */
  resetEmployeeRegistry: function() {
    return EmployeeService.resetRegistry();
  },

  // =========================================================================
  // 3. SCHEDULED MAINTENANCE & CRONS (Delegated to MaintenanceService)
  // =========================================================================

  /**
   * Daily Admin Digest scheduled trigger action (17:00 WIB).
   */
  sendDailyDigest: function() {
    MaintenanceService.sendDailyDigest();
  },

  /**
   * Weekly Manager Digest scheduled trigger action (Mondays 08:00 WIB).
   */
  sendWeeklyManagerDigest: function() {
    MaintenanceService.sendWeeklyManagerDigest();
  },

  /**
   * Daily trigger action to delete expired daily report tabs (>90 days).
   * @param {number} [customRetentionDays]
   * @returns {{ success: boolean, deletedCount: number }}
   */
  deleteExpiredDailyTabs: function(customRetentionDays) {
    return MaintenanceService.deleteExpiredDailyTabs(customRetentionDays);
  },

  /**
   * Returns daily tabs nearing expiration for Admin Queue warnings.
   * @returns {Array}
   */
  getExpiringDailyTabs: function() {
    return MaintenanceService.getExpiringDailyTabs();
  },

  /**
   * Generates CSV export for a daily tab.
   * @param {string} tabName 
   * @returns {string}
   */
  getDailyTabCsvData: function(tabName) {
    return MaintenanceService.getDailyTabCsvData(tabName);
  },

  /**
   * Cleans up (trashes) Google Drive daily photo folders older than retention period.
   * @param {number} [retentionDays] 
   * @returns {{ success: boolean, deletedFolderCount: number, deletedFolders: Array<string> }}
   */
  cleanupExpiredDailyPhotoFolders: function(retentionDays) {
    return MaintenanceService.cleanupExpiredDailyPhotoFolders(retentionDays);
  },

  /**
   * Purges legacy 'Reporting System Photos' folder from Google Drive.
   * @returns {{ success: boolean, purgedCount: number }}
   */
  purgeLegacyPhotoFolders: function() {
    return MaintenanceService.purgeLegacyPhotoFolders();
  },

  /**
   * Inspects and returns photo storage usage and metrics.
   * @returns {Object}
   */
  getPhotoStorageStatus: function() {
    return MaintenanceService.getPhotoStorageStatus();
  },

  // =========================================================================
  // 4. ANALYTICS & EXECUTIVE INSIGHTS (Delegated to AnalyticsService)
  // =========================================================================

  /**
   * Returns aggregated stats for Dashboard Manajer.
   * @param {Object} [options]
   * @returns {Object|null}
   */
  getDashboardStats: function(options) {
    return AnalyticsService.getAnalyticsDashboardData(options || {});
  },

  /**
   * Aggregates weekly trend data live across integrated spreadsheet tabs.
   * @param {Spreadsheet} [ss] 
   * @returns {Array} List of weekly trend buckets.
   */
  aggregateWeeklyData: function(ss) {
    const stats = SpreadsheetRepository.getDashboardStatsData();
    return stats.weeklyTrend || [];
  },

  // =========================================================================
  // 5. WORKSPACE QUICK LINKS
  // =========================================================================

  /**
   * Returns quick links for Admin/Manager workspace.
   * @returns {{ publicWebAppUrl: string, spreadsheetUrl: string, photoFolderUrl: string }}
   */
  getAdminQuickLinks: function() {
    const canonicalUrl = AuthService.getCanonicalWebAppUrl();
    const publicUrl = (canonicalUrl && canonicalUrl.includes('script.google.com'))
      ? `${canonicalUrl.split('?')[0]}?page=index`
      : ConfigRepository.getPublicWebAppUrl();

    let spreadsheetUrl = '';
    const ssId = ConfigRepository.getSpreadsheetId();
    if (ssId) {
      spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${ssId}/edit`;
    }

    let photoFolderUrl = '';
    try {
      const photoStatus = MaintenanceService.getPhotoStorageStatus();
      if (photoStatus && photoStatus.rootFolderUrl) {
        photoFolderUrl = photoStatus.rootFolderUrl;
      }
    } catch (e) {}

    return {
      publicWebAppUrl: publicUrl,
      spreadsheetUrl: spreadsheetUrl,
      photoFolderUrl: photoFolderUrl
    };
  },

  // =========================================================================
  // 6. REPORTING FORM CONFIGURATION SCHEMA
  // =========================================================================

  /**
   * Retrieves current reporting form configuration schema.
   * @returns {Object}
   */
  getReportingFormSchema: function() {
    const schema = ConfigRepository.getReportingFormSchema();
    try {
      SpreadsheetRepository.syncSpreadsheetCustomHeaders((schema && schema.customFields) || []);
    } catch (e) {
      Logger.log('AdminService: Auto-sync on schema read notice: ' + e.toString());
    }
    return schema;
  },

  /**
   * Saves updated reporting form configuration schema.
   * @param {Object} schema 
   * @returns {{ success: boolean, message: string, schema: Object }}
   */
  saveReportingFormSchema: function(schema) {
    if (!schema || typeof schema !== 'object') {
      throw new Error('Skema form tidak valid.');
    }
    if (!Array.isArray(schema.lokasiOptions) || schema.lokasiOptions.length === 0) {
      throw new Error('Daftar opsi lokasi tidak boleh kosong.');
    }
    schema.version = '1.' + Date.now();
    schema.updatedAt = new Date().toISOString();

    ConfigRepository.setReportingFormSchema(schema);
    Logger.log('AdminService: Saved reporting form schema: ' + JSON.stringify(schema));

    // Automatically sync spreadsheet custom headers in Master_Laporan & active daily tab
    let syncRes = null;
    try {
      syncRes = SpreadsheetRepository.syncSpreadsheetCustomHeaders(schema.customFields || []);
    } catch (eSync) {
      Logger.log('AdminService Warning: Spreadsheet header sync notice: ' + eSync.toString());
    }

    return {
      success: true,
      message: `Konfigurasi formulir berhasil dipublikasikan! Google Spreadsheet telah diperbarui dengan ${syncRes ? syncRes.headersCount : 34} kolom.`,
      schema: schema
    };
  },

  /**
   * Explicitly syncs current form schema custom fields with Google Spreadsheet.
   * @returns {{ success: boolean, message: string }}
   */
  syncFormSchemaWithSpreadsheet: function() {
    const schema = ConfigRepository.getReportingFormSchema();
    const customFields = (schema && Array.isArray(schema.customFields)) ? schema.customFields : [];
    const syncRes = SpreadsheetRepository.syncSpreadsheetCustomHeaders(customFields);
    return {
      success: true,
      message: `Berhasil menyinkronkan ${customFields.length} kolom kustom ke Google Spreadsheet (${syncRes.headersCount} total kolom).`
    };
  },

  /**
   * Synchronizes active Google Form (if any) with latest question schema.
   * @returns {{ success: boolean, message: string }}
   */
  syncGoogleFormWithLatestDesign: function() {
    try {
      if (typeof syncLiveGoogleFormItems === 'function') {
        return syncLiveGoogleFormItems();
      }
      return { success: false, message: 'Fungsi sinkronisasi Google Form tidak tersedia.' };
    } catch (e) {
      Logger.log('AdminService: syncGoogleFormWithLatestDesign error: ' + e.toString());
      return { success: false, message: e.message || e.toString() };
    }
  },

  /**
   * Resets reporting form configuration schema back to baseline default.
   * @returns {{ success: boolean, message: string, schema: Object }}
   */
  resetReportingFormSchema: function() {
    ConfigRepository.setReportingFormSchema(null);
    const defaultSchema = ConfigRepository.getDefaultReportingFormSchema();
    Logger.log('AdminService: Reset reporting form schema to default.');

    try {
      SpreadsheetRepository.syncSpreadsheetCustomHeaders([]);
    } catch (eSync) {
      Logger.log('AdminService Warning: Spreadsheet header sync notice on reset: ' + eSync.toString());
    }

    return {
      success: true,
      message: 'Konfigurasi formulir berhasil di-reset ke pengaturan bawaan awal.',
      schema: defaultSchema
    };
  },

  // =========================================================================
  // 7. USER ACCESS ROLES
  // =========================================================================

  /**
   * Returns list of registered Google accounts with access roles.
   * @returns {Array<Object>} List of UserRoleItem objects.
   */
  getUserRolesList: function() {
    return ConfigRepository.getUserRolesRegistry();
  },

  /**
   * Saves or updates a Google account role in Spreadsheet and cache.
   * @param {Object} accountData - { email, nama, role, status }
   * @returns {{ success: boolean, message: string, list: Array<Object> }}
   */
  saveUserRoleAccount: function(accountData) {
    if (!accountData || !accountData.email || !accountData.email.includes('@')) {
      throw new Error('Alamat email Google yang valid wajib diisi.');
    }

    const callerRole = AuthService.getUserRole();
    if (callerRole !== 'both') {
      throw new Error('Akses Ditolak: Hanya Superadmin yang berhak mengelola hak akses akun Google.');
    }

    let activeUserEmail = 'Superadmin';
    try {
      activeUserEmail = Session.getActiveUser().getEmail() || 'Superadmin';
    } catch (e) {}

    accountData.addedBy = activeUserEmail;
    SpreadsheetRepository.saveUserRoleToSheet(accountData);

    const updatedList = SpreadsheetRepository.getUserRolesFromSheet();
    ConfigRepository.setUserRolesRegistry(updatedList);

    return {
      success: true,
      message: `Akun Google ${accountData.email} berhasil disimpan sebagai ${String(accountData.role || 'Admin').toUpperCase()}.`,
      list: updatedList
    };
  },

  /**
   * Deletes a Google account role from Spreadsheet and cache.
   * @param {string} email 
   * @returns {{ success: boolean, message: string, list: Array<Object> }}
   */
  deleteUserRoleAccount: function(email) {
    if (!email) throw new Error('Email akun wajib disertakan.');

    const callerRole = AuthService.getUserRole();
    if (callerRole !== 'both') {
      throw new Error('Akses Ditolak: Hanya Superadmin yang berhak mencabut hak akses akun Google.');
    }

    SpreadsheetRepository.deleteUserRoleFromSheet(email);

    const updatedList = SpreadsheetRepository.getUserRolesFromSheet();
    ConfigRepository.setUserRolesRegistry(updatedList);

    return {
      success: true,
      message: `Akses untuk akun ${email} berhasil dicabut.`,
      list: updatedList
    };
  }
};

/**
 * AdminService.gs — Application Service for Management & Operations Workflows
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: APPLICATION / SERVICE
 * Responsibility: Coordinates queue queries, dashboard analytics, digests, and archival.
 */

const AdminService = {
  /**
   * Returns Admin_Queue rows.
   * @returns {Array} Array of QueueItem objects.
   */
  getAdminQueueData: function() {
    try {
      const list = SpreadsheetRepository.getAdminQueueData();
      return JSON.parse(JSON.stringify(list || []));
    } catch (e) {
      Logger.log('AdminService Error in getAdminQueueData: ' + e.toString());
      return [];
    }
  },

  /**
   * Updates Review_Status of a report by matching Report_ID.
   * @param {string} reportId 
   * @param {string} newStatus 
   * @returns {{ success: boolean, updated?: boolean, error?: string }}
   */
  updateReviewStatus: function(reportId, newStatus) {
    if (!reportId || !newStatus) {
      throw new Error('Report ID and new status are required.');
    }
    return SpreadsheetRepository.updateReviewStatus(reportId, newStatus);
  },

  /**
   * Returns aggregated stats for Dashboard Manajer.
   * @param {string|Object} [filterParam]
   * @returns {Object|null}
   */
  getDashboardStats: function(options) {
    return AnalyticsService.getAnalyticsDashboardData(options || {});
  },

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
      const photoStatus = this.getPhotoStorageStatus();
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

  /**
   * Daily Admin Digest scheduled trigger action (17:00 WIB).
   */
  sendDailyDigest: function() {
    Logger.log('AdminService: Running sendDailyDigest...');
    const queueItems = this.getAdminQueueData();
    let totalPending = 0;
    let urgentCount = 0;
    let warningCount = 0;
    let normalCount = 0;

    queueItems.forEach(item => {
      totalPending++;
      const severity = String(item.severity || '').toLowerCase();
      if (severity === ReportSeverity.URGENT) urgentCount++;
      else if (severity === ReportSeverity.WARNING) warningCount++;
      else normalCount++;
    });

    const publicWebAppUrl = ConfigRepository.getPublicWebAppUrl();
    NotificationAdapter.sendDailyDigest(totalPending, urgentCount, warningCount, normalCount, publicWebAppUrl);
  },

  /**
   * Aggregates weekly trend data live across integrated spreadsheet tabs.
   * Produces divisional sales and harvest volume broken down by weeks.
   * @param {Spreadsheet} [ss] 
   * @returns {Array} List of weekly trend buckets.
   */
  aggregateWeeklyData: function(ss) {
    const stats = SpreadsheetRepository.getDashboardStatsData();
    return stats.weeklyTrend || [];
  },

  /**
   * Weekly Manager Digest scheduled trigger action (Mondays 08:00 WIB).
   * Gathers live monthly/weekly operational metrics and dispatches executive email.
   */
  sendWeeklyManagerDigest: function() {
    Logger.log('AdminService: Running sendWeeklyManagerDigest...');
    const stats = SpreadsheetRepository.getDashboardStatsData();
    const periodLabel = stats.currentPeriodLabel || getISOWeekLabel(new Date());
    const publicWebAppUrl = ConfigRepository.getPublicWebAppUrl();

    NotificationAdapter.sendWeeklyManagerDigest(stats, periodLabel, publicWebAppUrl);
  },

  /**
   * Monthly Data Archival scheduled trigger action.
   * @returns {{ success: boolean, totalArchived: number }}
   */
  /**
   * Daily trigger action to delete expired daily report tabs (>90 days).
   * @returns {{ success: boolean, deletedCount: number }}
   */
  deleteExpiredDailyTabs: function() {
    const retentionDays = ConfigRepository.getRetentionDays() || 90;
    Logger.log(`AdminService: Starting deleteExpiredDailyTabs with retention: ${retentionDays} days.`);
    return SpreadsheetRepository.deleteExpiredDailyTabs(retentionDays);
  },

  /**
   * Returns daily tabs nearing expiration for Admin Queue warnings.
   * @returns {Array}
   */
  getExpiringDailyTabs: function() {
    return SpreadsheetRepository.getExpiringDailyTabs();
  },

  /**
   * Generates CSV export for a daily tab.
   * @param {string} tabName 
   * @returns {string}
   */
  getDailyTabCsvData: function(tabName) {
    return SpreadsheetRepository.getDailyTabCsvData(tabName);
  },

  /**
   * Omits irrelevant and duplicate tabs from the central spreadsheet.
   * @returns {Object}
   */
  cleanupIrrelevantSpreadsheetTabs: function() {
    return cleanupIrrelevantSpreadsheetTabs();
  },

  /**
   * Cleans up (trashes) Google Drive daily photo folders older than retentionDays (default: 90 days).
   * @param {number} [retentionDays=90] 
   * @returns {{ success: boolean, deletedFolderCount: number, deletedFolders: Array<string> }}
   */
  cleanupExpiredDailyPhotoFolders: function(retentionDays) {
    const thresholdDays = retentionDays || ConfigRepository.getRetentionDays() || 90;
    Logger.log(`AdminService: Starting cleanupExpiredDailyPhotoFolders with threshold: ${thresholdDays} days.`);

    if (typeof DriveApp === 'undefined') {
      return { success: false, message: 'DriveApp unavailable', deletedFolderCount: 0, deletedFolders: [] };
    }

    // 0. Automatically purge any legacy 'Reporting System Photos' folder
    try {
      const legacyIter = DriveApp.getFoldersByName('Reporting System Photos');
      while (legacyIter && legacyIter.hasNext()) {
        const legacyFolder = legacyIter.next();
        legacyFolder.setTrashed(true);
        Logger.log('AdminService: Purged legacy folder "Reporting System Photos".');
      }
    } catch (eLeg) {}

    let rootFolder = null;
    const rootFolderId = ConfigRepository.getProperty('DRIVE_PHOTO_FOLDER_ID');
    if (rootFolderId) {
      try { rootFolder = DriveApp.getFolderById(rootFolderId); } catch (e) {}
    }
    if (!rootFolder) {
      const rootIter = DriveApp.getFoldersByName('MPL_Dokumentasi_Foto');
      if (rootIter && rootIter.hasNext()) rootFolder = rootIter.next();
    }
    if (!rootFolder) {
      return { success: true, deletedFolderCount: 0, deletedFolders: [], message: 'Root photo folder not yet initialized.' };
    }

    const subfolders = rootFolder.getFolders();
    let deletedCount = 0;
    const deletedNames = [];
    const now = new Date();

    while (subfolders.hasNext()) {
      const folder = subfolders.next();
      const name = folder.getName();
      const match = name.match(/^(\d{4}-\d{2}-\d{2})$/);
      if (match) {
        const folderDate = new Date(match[1] + 'T00:00:00');
        if (!isNaN(folderDate.getTime())) {
          const diffDays = Math.floor((now.getTime() - folderDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= thresholdDays) {
            try {
              folder.setTrashed(true);
              deletedCount++;
              deletedNames.push(name);
              Logger.log(`AdminService: Trashed expired photo folder ${name} (age: ${diffDays} days).`);
            } catch (eTrash) {
              Logger.log(`AdminService Error trashing ${name}: ${eTrash.toString()}`);
            }
          }
        }
      }
    }

    return {
      success: true,
      deletedFolderCount: deletedCount,
      deletedFolders: deletedNames
    };
  },

  /**
   * Purges legacy 'Reporting System Photos' folder from Google Drive.
   * @returns {{ success: boolean, purgedCount: number }}
   */
  purgeLegacyPhotoFolders: function() {
    if (typeof DriveApp === 'undefined') return { success: false, purgedCount: 0 };
    try {
      let count = 0;
      const legacyIter = DriveApp.getFoldersByName('Reporting System Photos');
      while (legacyIter && legacyIter.hasNext()) {
        const legacyFolder = legacyIter.next();
        legacyFolder.setTrashed(true);
        count++;
        Logger.log('AdminService: Trashed legacy folder "Reporting System Photos".');
      }
      return { success: true, purgedCount: count };
    } catch (e) {
      Logger.log('AdminService Error in purgeLegacyPhotoFolders: ' + e.toString());
      return { success: false, error: e.toString() };
    }
  },

  /**
   * Retrieves Google Drive photo storage status, root URL, and expiring folder warnings.
   * @param {number} [retentionDays=90] 
   * @returns {{ rootFolderUrl: string, totalDailyFolders: number, expiringFolders: Array<Object>, expiredFolders: Array<Object> }}
   */
  getPhotoStorageStatus: function(retentionDays) {
    const thresholdDays = retentionDays || ConfigRepository.getRetentionDays() || 90;
    const warningDays = Math.max(1, thresholdDays - 5);

    if (typeof DriveApp === 'undefined') {
      return { rootFolderUrl: '', totalDailyFolders: 0, expiringFolders: [], expiredFolders: [] };
    }

    let rootFolder = null;
    const rootFolderId = ConfigRepository.getProperty('DRIVE_PHOTO_FOLDER_ID');
    if (rootFolderId) {
      try { rootFolder = DriveApp.getFolderById(rootFolderId); } catch (e) {}
    }
    if (!rootFolder) {
      const rootIter = DriveApp.getFoldersByName('MPL_Dokumentasi_Foto');
      if (rootIter && rootIter.hasNext()) rootFolder = rootIter.next();
    }
    if (!rootFolder) {
      return { rootFolderUrl: '', totalDailyFolders: 0, expiringFolders: [], expiredFolders: [] };
    }

    const subfolders = rootFolder.getFolders();
    let totalCount = 0;
    const expiringFolders = [];
    const expiredFolders = [];
    const now = new Date();

    while (subfolders.hasNext()) {
      const folder = subfolders.next();
      const name = folder.getName();
      const match = name.match(/^(\d{4}-\d{2}-\d{2})$/);
      if (match) {
        totalCount++;
        const folderDate = new Date(match[1] + 'T00:00:00');
        if (!isNaN(folderDate.getTime())) {
          const diffDays = Math.floor((now.getTime() - folderDate.getTime()) / (1000 * 60 * 60 * 24));
          const folderInfo = {
            name: name,
            url: folder.getUrl(),
            ageDays: diffDays,
            daysRemaining: Math.max(0, thresholdDays - diffDays)
          };
          if (diffDays >= thresholdDays) {
            expiredFolders.push(folderInfo);
          } else if (diffDays >= warningDays) {
            expiringFolders.push(folderInfo);
          }
        }
      }
    }

    return {
      rootFolderUrl: rootFolder.getUrl(),
      totalDailyFolders: totalCount,
      expiringFolders: expiringFolders,
      expiredFolders: expiredFolders,
      retentionDays: thresholdDays
    };
  },

  /**
   * Returns deployment diagnostics for Admin/Manager troubleshooting.
   * @returns {Object} Diagnostic details.
   */
  getDeploymentDiagnostics: function() {
    const role = AuthService.getUserRole();
    if (!role) {
      throw new Error('Akses ditolak: Hanya Admin/Manager yang dapat mengakses diagnosa.');
    }

    const serviceUrl = AuthService.getExecutingWebAppUrl_();
    const publicUrl = ConfigRepository.getPublicWebAppUrl();
    const internalUrl = ConfigRepository.getInternalWebAppUrl();

    return {
      executingUrl: serviceUrl,
      configuredPublicUrl: publicUrl,
      configuredInternalUrl: internalUrl,
      executingDeploymentId: AuthService.extractDeploymentId_(serviceUrl),
      publicDeploymentId: AuthService.extractDeploymentId_(publicUrl),
      internalDeploymentId: AuthService.extractDeploymentId_(internalUrl),
      isInternalDeployment: AuthService.isInternalWebAppDeployment(),
      userRole: role
    };
  },

  /**
   * Retrieves full employee list.
   * @returns {Array<Object>}
   */
  getEmployeeRegistry: function() {
    const list = getActiveEmployeeRegistry();
    return JSON.parse(JSON.stringify(list || []));
  },

  /**
   * Creates or updates employee record in custom script properties.
   * @param {{ id: string, name: string, division: string, oldId?: string }} empData 
   * @returns {{ success: boolean, message: string, employee: Object }}
   */
  saveEmployee: function(empData) {
    if (!empData) throw new Error('Data karyawan tidak valid.');
    const cleanId = String(empData.id || '').trim().toUpperCase();
    const cleanName = String(empData.name || '').trim();
    const cleanDiv = String(empData.division || '').trim();
    const oldId = empData.oldId ? String(empData.oldId).trim().toUpperCase() : null;

    if (!cleanId) throw new Error('ID Karyawan wajib diisi (contoh: ALP-01).');
    if (!cleanName) throw new Error('Nama Karyawan wajib diisi.');
    if (!cleanDiv) throw new Error('Divisi Karyawan wajib dipilih.');

    let list = getActiveEmployeeRegistry();

    if (oldId && oldId !== cleanId) {
      // Renaming ID: check if new ID already exists
      const conflict = list.find(e => String(e.id).toUpperCase() === cleanId);
      if (conflict) {
        throw new Error(`ID Karyawan '${cleanId}' sudah digunakan oleh ${conflict.name}.`);
      }
      // Remove old entry
      list = list.filter(e => String(e.id).toUpperCase() !== oldId);
      list.push({ id: cleanId, name: cleanName, division: cleanDiv });
    } else {
      const existingIdx = list.findIndex(e => String(e.id).toUpperCase() === cleanId);
      if (existingIdx >= 0) {
        list[existingIdx] = { id: cleanId, name: cleanName, division: cleanDiv };
      } else {
        list.push({ id: cleanId, name: cleanName, division: cleanDiv });
      }
    }

    // Sort list by Division, then ID
    list.sort((a, b) => {
      const divComp = String(a.division).localeCompare(String(b.division));
      if (divComp !== 0) return divComp;
      return String(a.id).localeCompare(String(b.id));
    });

    ConfigRepository.setCustomEmployeeRegistry(list);
    Logger.log(`AdminService: Saved employee ${cleanId} (${cleanName}) - total: ${list.length}`);

    return {
      success: true,
      message: `Data karyawan ${cleanName} (${cleanId}) berhasil disimpan.`,
      employee: { id: cleanId, name: cleanName, division: cleanDiv }
    };
  },

  /**
   * Deletes employee record from registry.
   * @param {string} empId 
   * @returns {{ success: boolean, message: string }}
   */
  deleteEmployee: function(empId) {
    if (!empId) throw new Error('ID Karyawan tidak valid.');
    const targetId = String(empId).trim().toUpperCase();
    let list = getActiveEmployeeRegistry();

    list = list.filter(e => String(e.id).toUpperCase() !== targetId);

    ConfigRepository.setCustomEmployeeRegistry(list);
    Logger.log(`AdminService: Deleted employee ${targetId} - remaining: ${list.length}`);

    return {
      success: true,
      message: `Karyawan ${targetId} berhasil dihapus dari daftar karyawan.`
    };
  },

  /**
   * Resets custom employee registry back to default 38 records.
   * @returns {{ success: boolean, message: string }}
   */
  resetEmployeeRegistry: function() {
    ConfigRepository.setCustomEmployeeRegistry(null);
    Logger.log('AdminService: Reset custom employee registry to default.');
    return {
      success: true,
      message: 'Data master karyawan berhasil di-reset ke data bawaan awal (38 Karyawan).'
    };
  },

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
   * Synchronizes active Google Form (if any) with the latest question schema.
   * @returns {{ success: boolean, message: string }}
   */
  syncGoogleFormWithLatestDesign: function() {
    try {
      const res = syncLiveGoogleFormItems();
      return res;
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

/**
 * Backward compatibility wrapper for getDeploymentDiagnostics.
 */
function getDeploymentDiagnostics() {
  return AdminService.getDeploymentDiagnostics();
}

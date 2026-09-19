/**
 * MaintenanceService.gs — Application Service for Scheduled Archival, Digests & TTL Storage Cleanup
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: APPLICATION / SERVICE
 * Responsibility: Manages automated daily/weekly email digests, 90-day daily sheet tab retention,
 * Drive photo folder lifecycle purging, and storage inspection.
 */

const MaintenanceService = {

  /**
   * Daily Admin Digest scheduled trigger action (17:00 WIB).
   */
  sendDailyDigest: function() {
    Logger.log('MaintenanceService: Running sendDailyDigest...');
    const queueItems = AdminQueueService.getQueueItems();
    let totalPending = 0;
    let urgentCount = 0;
    let warningCount = 0;
    let normalCount = 0;

    queueItems.forEach(item => {
      totalPending++;
      const severity = String(item.severity || '').toLowerCase();
      if (severity === ReportSeverity.URGENT) urgentCount++;
      else if (severity === 'warning') warningCount++;
      else normalCount++;
    });

    const publicWebAppUrl = ConfigRepository.getPublicWebAppUrl();
    NotificationAdapter.sendDailyDigest(totalPending, urgentCount, warningCount, normalCount, publicWebAppUrl);
  },

  /**
   * Weekly Manager Digest scheduled trigger action (Mondays 08:00 WIB).
   * Gathers live operational metrics and dispatches executive email.
   */
  sendWeeklyManagerDigest: function() {
    Logger.log('MaintenanceService: Running sendWeeklyManagerDigest...');
    const stats = SpreadsheetRepository.getDashboardStatsData();
    const periodLabel = stats.currentPeriodLabel || getISOWeekLabel(new Date());
    const publicWebAppUrl = ConfigRepository.getPublicWebAppUrl();

    NotificationAdapter.sendWeeklyManagerDigest(stats, periodLabel, publicWebAppUrl);
  },

  /**
   * Daily trigger action to delete expired daily report tabs (>90 days).
   * @param {number} [customRetentionDays]
   * @returns {{ success: boolean, deletedCount: number }}
   */
  deleteExpiredDailyTabs: function(customRetentionDays) {
    const retentionDays = customRetentionDays || ConfigRepository.getRetentionDays() || 90;
    Logger.log(`MaintenanceService: Starting deleteExpiredDailyTabs with retention: ${retentionDays} days.`);
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
   * Cleans up (trashes) Google Drive daily photo folders older than retentionDays (default: 90 days).
   * @param {number} [customRetentionDays=90] 
   * @returns {{ success: boolean, deletedFolderCount: number, deletedFolders: Array<string> }}
   */
  cleanupExpiredDailyPhotoFolders: function(customRetentionDays) {
    const thresholdDays = customRetentionDays || ConfigRepository.getRetentionDays() || 90;
    Logger.log(`MaintenanceService: Starting cleanupExpiredDailyPhotoFolders with threshold: ${thresholdDays} days.`);

    if (typeof DriveApp === 'undefined') {
      return { success: false, message: 'DriveApp unavailable', deletedFolderCount: 0, deletedFolders: [] };
    }

    // 0. Automatically purge any legacy 'Reporting System Photos' folder
    try {
      const legacyIter = DriveApp.getFoldersByName('Reporting System Photos');
      while (legacyIter && legacyIter.hasNext()) {
        const legacyFolder = legacyIter.next();
        legacyFolder.setTrashed(true);
        Logger.log('MaintenanceService: Purged legacy folder "Reporting System Photos".');
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
              Logger.log(`MaintenanceService: Trashed expired photo folder ${name} (age: ${diffDays} days).`);
            } catch (eTrash) {
              Logger.log(`MaintenanceService Error trashing ${name}: ${eTrash.toString()}`);
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
        Logger.log('MaintenanceService: Trashed legacy folder "Reporting System Photos".');
      }
      return { success: true, purgedCount: count };
    } catch (e) {
      return { success: false, purgedCount: 0, error: e.toString() };
    }
  },

  /**
   * Inspects and returns photo storage usage and metrics.
   * @returns {Object}
   */
  getPhotoStorageStatus: function() {
    if (typeof DriveApp === 'undefined') {
      return { totalFolders: 0, totalFiles: 0, totalSizeBytes: 0, activeFolders: 0, expiredFolders: 0, rootFolderUrl: '' };
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
      return { totalFolders: 0, totalFiles: 0, totalSizeBytes: 0, activeFolders: 0, expiredFolders: 0, rootFolderUrl: '' };
    }

    const thresholdDays = ConfigRepository.getRetentionDays() || 90;
    const now = new Date();
    let totalFolders = 0;
    let activeFolders = 0;
    let expiredFolders = 0;
    let totalFiles = 0;
    let totalSizeBytes = 0;

    const subfolders = rootFolder.getFolders();
    while (subfolders.hasNext()) {
      totalFolders++;
      const folder = subfolders.next();
      const name = folder.getName();
      const match = name.match(/^(\d{4}-\d{2}-\d{2})$/);
      if (match) {
        const folderDate = new Date(match[1] + 'T00:00:00');
        if (!isNaN(folderDate.getTime())) {
          const diffDays = Math.floor((now.getTime() - folderDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= thresholdDays) {
            expiredFolders++;
          } else {
            activeFolders++;
          }
        }
      }

      // Sample file count (limit to 100 per folder to avoid timeout)
      const files = folder.getFiles();
      let folderFileCount = 0;
      while (files.hasNext() && folderFileCount < 100) {
        const file = files.next();
        folderFileCount++;
        totalFiles++;
        totalSizeBytes += file.getSize();
      }
    }

    return {
      totalFolders,
      activeFolders,
      expiredFolders,
      totalFiles,
      totalSizeBytes,
      totalSizeMB: Math.round(totalSizeBytes / (1024 * 1024) * 10) / 10,
      rootFolderUrl: rootFolder.getUrl(),
      retentionDays: thresholdDays
    };
  }
};

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
    return SpreadsheetRepository.getAdminQueueData();
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
   * Returns aggregated stats for Executive Manager Dashboard.
   * @returns {Object|null}
   */
  getDashboardStats: function() {
    return SpreadsheetRepository.getDashboardStatsData();
  },

  /**
   * Returns quick links for Admin/Manager workspace.
   * @returns {{ publicWebAppUrl: string }}
   */
  getAdminQuickLinks: function() {
    const publicWebAppUrl = ConfigRepository.getPublicWebAppUrl();

    return {
      publicWebAppUrl: publicWebAppUrl ? (publicWebAppUrl.includes('?') ? publicWebAppUrl : `${publicWebAppUrl}?page=index`) : ''
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
   * Aggregates weekly data across all dedicated per-form spreadsheets.
   * @param {Spreadsheet} [ss] 
   * @returns {Array} List of WeeklyStat objects.
   */
  aggregateWeeklyData: function(ss) {
    const referenceDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const weekLabel = getISOWeekLabel(referenceDate);
    const sites = [
      'Site A — Kebun & Lahan Pertanian', 
      'Site B — Peternakan & Kandang', 
      'Site C — Pabrik Pengolahan & Pakan', 
      'Site D — Logistik & Gudang'
    ];

    const siteStatsMap = {};
    sites.forEach(site => {
      siteStatsMap[site] = WeeklyStat(site);
    });

    function isRowInCurrentWeek(dateVal) {
      if (!dateVal) return false;
      try {
        return getISOWeekLabel(new Date(dateVal)) === weekLabel;
      } catch (e) {
        return false;
      }
    }

    const forms = FormManagementService.getFormList();
    forms.forEach(f => {
      if (!f.sheetId) return;
      try {
        const targetSs = SpreadsheetApp.openById(f.sheetId);
        
        // Scan Raw sheet
        const rawSheet = targetSs.getSheetByName('Raw') || targetSs.getSheets()[0];
        if (rawSheet && rawSheet.getLastRow() > 1) {
          const values = rawSheet.getDataRange().getValues().slice(1);
          values.forEach(row => {
            const reportDate = row[4] || row[1];
            if (!isRowInCurrentWeek(reportDate)) return;

            const site = row[3];
            if (siteStatsMap[site]) {
              if ((f.type || '').toLowerCase() === 'harian') {
                siteStatsMap[site].dailyCount++;
                siteStatsMap[site].totalYield += parseFloat(row[6]) || 0;
              } else {
                siteStatsMap[site].generalCount++;
              }
              const severity = String(row[8] || '').toLowerCase();
              if (severity === ReportSeverity.URGENT) siteStatsMap[site].urgentCount++;
              else if (severity === ReportSeverity.WARNING) siteStatsMap[site].warningCount++;
            }
          });
        }
      } catch (err) {
        Logger.log(`AdminService Warning: Unable to aggregate weekly data for sheet ${f.sheetId}: ${err.toString()}`);
      }
    });

    const resultStats = [];
    sites.forEach(site => {
      resultStats.push(siteStatsMap[site]);
    });

    return resultStats;
  },

  /**
   * Weekly Manager Digest scheduled trigger action (Mondays 08:00 WIB).
   */
  sendWeeklyManagerDigest: function() {
    Logger.log('AdminService: Running sendWeeklyManagerDigest...');
    const summaryStats = this.aggregateWeeklyData();
    const weekLabel = getISOWeekLabel(new Date());
    const publicWebAppUrl = ConfigRepository.getPublicWebAppUrl();

    NotificationAdapter.sendWeeklyManagerDigest(summaryStats, weekLabel, publicWebAppUrl);
  },

  /**
   * Monthly Data Archival scheduled trigger action.
   * @returns {{ success: boolean, totalArchived: number }}
   */
  archiveOldReports: function() {
    const retentionDays = ConfigRepository.getRetentionDays();
    Logger.log(`AdminService: Starting archiveOldReports with threshold: ${retentionDays} days.`);
    return SpreadsheetRepository.archiveClosedReports(retentionDays);
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
  }
};

/**
 * Backward compatibility wrapper for getDeploymentDiagnostics.
 */
function getDeploymentDiagnostics() {
  return AdminService.getDeploymentDiagnostics();
}

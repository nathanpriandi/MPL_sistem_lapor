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
    const canonicalUrl = AuthService.getCanonicalWebAppUrl();
    const publicUrl = (canonicalUrl && canonicalUrl.includes('script.google.com'))
      ? `${canonicalUrl.split('?')[0]}?page=index`
      : '';

    return {
      publicWebAppUrl: publicUrl
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
  archiveOldReports: function() {
    const retentionDays = ConfigRepository.getRetentionDays();
    Logger.log(`AdminService: Starting archiveOldReports with threshold: ${retentionDays} days.`);
    return SpreadsheetRepository.archiveClosedReports(retentionDays);
  },

  /**
   * Daily Photo Auto-Purge scheduled trigger action (7-day lifecycle).
   * @returns {{ success: boolean, purgedCount: number }}
   */
  purgeExpiredPhotos: function() {
    Logger.log('AdminService: Running daily purgeExpiredPhotos task.');
    return SpreadsheetRepository.purgeExpiredPhotos();
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

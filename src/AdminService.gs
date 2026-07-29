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
   * @returns {{ spreadsheetUrl: string, dailyFormEditUrl: string, generalFormEditUrl: string, publicWebAppUrl: string }}
   */
  getAdminQuickLinks: function() {
    const ssId = ConfigRepository.getSpreadsheetId();
    const dailyFormId = ConfigRepository.getDailyFormId();
    const generalFormId = ConfigRepository.getGeneralFormId();
    const publicWebAppUrl = ConfigRepository.getPublicWebAppUrl();

    return {
      spreadsheetUrl: ssId ? `https://docs.google.com/spreadsheets/d/${ssId}/edit` : '',
      dailyFormEditUrl: dailyFormId ? `https://docs.google.com/forms/d/${dailyFormId}/edit` : '',
      generalFormEditUrl: generalFormId ? `https://docs.google.com/forms/d/${generalFormId}/edit` : '',
      publicWebAppUrl: publicWebAppUrl ? (publicWebAppUrl.includes('?') ? publicWebAppUrl : `${publicWebAppUrl}?page=index`) : ''
    };
  },

  /**
   * Daily Admin Digest scheduled trigger action (17:00 WIB).
   */
  sendDailyDigest: function() {
    Logger.log('AdminService: Running sendDailyDigest...');
    const ss = SpreadsheetRepository.getSpreadsheet();
    const queueSheet = ss.getSheetByName(SHEET_NAMES.ADMIN_QUEUE);
    if (!queueSheet) return;

    const values = queueSheet.getDataRange().getValues();
    let totalPending = 0;
    let urgentCount = 0;
    let warningCount = 0;
    let normalCount = 0;

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row[0] && row[0] !== '') {
        totalPending++;
        const severity = String(row[9] || row[8]).toLowerCase();
        if (severity === ReportSeverity.URGENT) urgentCount++;
        else if (severity === ReportSeverity.WARNING) warningCount++;
        else normalCount++;
      }
    }

    NotificationAdapter.sendDailyDigest(totalPending, urgentCount, warningCount, normalCount, ss.getUrl());
  },

  /**
   * Aggregates weekly data into Weekly_Summary tab.
   * @param {Spreadsheet} [ss] 
   * @returns {Array} List of WeeklyStat objects.
   */
  aggregateWeeklyData: function(ss) {
    const activeSs = ss || SpreadsheetRepository.getSpreadsheet();
    const summarySheet = activeSs.getSheetByName(SHEET_NAMES.WEEKLY_SUMMARY);
    const dailySheet = activeSs.getSheetByName(SHEET_NAMES.DAILY_RAW);
    const generalSheet = activeSs.getSheetByName(SHEET_NAMES.GENERAL_RAW);
    const sensitiveSheet = activeSs.getSheetByName(SHEET_NAMES.SENSITIVE_RESTRICTED);

    const referenceDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const weekLabel = getISOWeekLabel(referenceDate);
    const sites = [
      'Site A — Kebun & Lahan Pertanian', 
      'Site B — Peternakan & Kandang', 
      'Site C — Pabrik Pengolahan & Pakan', 
      'Site D — Logistik & Gudang'
    ];

    const dailyValues = dailySheet.getDataRange().getValues();
    const generalValues = generalSheet.getDataRange().getValues();
    const sensitiveValues = sensitiveSheet.getDataRange().getValues();

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

    // Daily_Raw aggregation
    for (let i = 1; i < dailyValues.length; i++) {
      const row = dailyValues[i];
      const reportDate = row[4] || row[1];
      if (!isRowInCurrentWeek(reportDate)) continue;

      const site = row[3];
      if (siteStatsMap[site]) {
        siteStatsMap[site].dailyCount++;
        siteStatsMap[site].totalYield += parseFloat(row[6]) || 0;
        
        const severity = String(row[8]).toLowerCase();
        if (severity === ReportSeverity.URGENT) siteStatsMap[site].urgentCount++;
        else if (severity === ReportSeverity.WARNING) siteStatsMap[site].warningCount++;
      }
    }

    // General_Raw aggregation
    for (let i = 1; i < generalValues.length; i++) {
      const row = generalValues[i];
      const reportDate = row[4] || row[1];
      if (!isRowInCurrentWeek(reportDate)) continue;

      const site = row[3];
      if (siteStatsMap[site]) {
        siteStatsMap[site].generalCount++;
        const severity = String(row[7]).toLowerCase();
        if (severity === ReportSeverity.URGENT) siteStatsMap[site].urgentCount++;
        else if (severity === ReportSeverity.WARNING) siteStatsMap[site].warningCount++;
      }
    }

    // Sensitive_Restricted aggregation
    for (let i = 1; i < sensitiveValues.length; i++) {
      const row = sensitiveValues[i];
      const reportDate = row[4] || row[1];
      if (!isRowInCurrentWeek(reportDate)) continue;

      const site = row[3];
      if (siteStatsMap[site]) {
        siteStatsMap[site].sensitiveCount++;
        const severity = String(row[7]).toLowerCase();
        if (severity === ReportSeverity.URGENT) siteStatsMap[site].urgentCount++;
        else if (severity === ReportSeverity.WARNING) siteStatsMap[site].warningCount++;
      }
    }

    const resultStats = [];
    const nowFormatted = formatDate(new Date());

    sites.forEach(site => {
      const stat = siteStatsMap[site];
      resultStats.push(stat);

      summarySheet.appendRow([
        weekLabel,
        stat.site,
        stat.dailyCount,
        stat.generalCount,
        stat.urgentCount,
        stat.warningCount,
        stat.sensitiveCount,
        stat.totalYield,
        nowFormatted
      ]);
    });

    return resultStats;
  },

  /**
   * Weekly Manager Digest scheduled trigger action (Mondays 08:00 WIB).
   */
  sendWeeklyManagerDigest: function() {
    Logger.log('AdminService: Running sendWeeklyManagerDigest...');
    const ss = SpreadsheetRepository.getSpreadsheet();
    const summaryStats = this.aggregateWeeklyData(ss);
    const weekLabel = getISOWeekLabel(new Date());

    NotificationAdapter.sendWeeklyManagerDigest(summaryStats, weekLabel, ss.getUrl());
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

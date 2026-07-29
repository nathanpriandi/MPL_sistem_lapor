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

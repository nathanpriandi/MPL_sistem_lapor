/**
 * Automation.gs — Time-Driven Cron Trigger Delivery Controller
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: DELIVERY / CRON CONTROLLER
 * Responsibility: Delivery entry points for scheduled triggers.
 * Delegates background tasks to AdminService.
 */

/**
 * Daily Admin Digest — Scheduled every day at 17:00 WIB.
 */
function sendDailyDigest() {
  AdminService.sendDailyDigest();
}

/**
 * Weekly Manager Digest — Scheduled every Monday at 08:00 WIB.
 * Gathers live operational metrics and sends weekly executive email digest to Manager.
 */
function sendWeeklyManagerDigest() {
  AdminService.sendWeeklyManagerDigest();
}

/**
 * Monthly time-driven trigger function to archive closed reports older than retention threshold.
 * Default retention threshold is 90 days (configurable via Script Property RETENTION_DAYS).
 * @returns {{ success: boolean, totalArchived: number }}
 */
function archiveOldReports() {
  return AdminService.archiveOldReports();
}

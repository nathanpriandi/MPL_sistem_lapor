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
 * Daily time-driven trigger function to delete daily report tabs (Laporan_YYYY-MM-DD) older than 90 days.
 * @returns {{ success: boolean, deletedCount: number }}
 */
function deleteExpiredDailyTabs() {
  return AdminService.deleteExpiredDailyTabs();
}


/**
 * Daily time-driven trigger function to purge (trash) Google Drive daily photo folders older than 90 days.
 * @returns {{ success: boolean, deletedFolderCount: number, deletedFolders: Array<string> }}
 */
function cleanupExpiredDailyPhotoFolders() {
  return AdminService.cleanupExpiredDailyPhotoFolders();
}

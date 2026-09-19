/**
 * AdminQueueService.gs — Application Service for Operational Review Queue & Verification
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: APPLICATION / SERVICE
 * Responsibility: Manages admin queue retrieval, triage prioritization, report inspector lookups,
 * and review verification workflows.
 */

const AdminQueueService = {

  /**
   * Retrieves all items in the Admin Triage Queue.
   * Prioritizes urgent unverified reports and formats item DTOs.
   * @returns {Array<Object>}
   */
  getQueueItems: function() {
    return SpreadsheetRepository.getAdminQueueData();
  },

  /**
   * Updates Review_Status of an operational report by matching Report_ID.
   * @param {string} reportId 
   * @param {string} newStatus 
   * @returns {{ success: boolean, updated?: boolean, error?: string }}
   */
  updateReviewStatus: function(reportId, newStatus) {
    if (!reportId || !newStatus) {
      throw new Error('Report ID and new status are required.');
    }
    const normalized = normalizeReviewStatus(newStatus);
    return SpreadsheetRepository.updateReviewStatus(reportId, normalized);
  },

  /**
   * Retrieves single operational report record for inspector detail modal.
   * @param {string} reportId 
   * @returns {Object|null}
   */
  getReportDetails: function(reportId) {
    if (!reportId) return null;
    return SpreadsheetRepository.getOperationalReportById(reportId);
  }
};

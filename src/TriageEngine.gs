/**
 * TriageEngine.gs — Severity Flagging Engine
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: DOMAIN
 * Responsibility: Single literal rule for report triage:
 * A report is flagged (URGENT) only if Kendala Kegiatan has non-empty content.
 * Zero keyword scanning, zero inferred sub-categorization.
 */

const TriageEngine = {
  /**
   * Determines whether a report needs attention based solely on whether
   * Kendala Kegiatan has non-empty content.
   * @param {string} kendalaText - The report's Kendala field text only.
   * @returns {{ severity: string, rank: number }} TriageResult object.
   */
  evaluate: function(kendalaText) {
    const hasKendala = !!(kendalaText && String(kendalaText).trim().length > 0 && String(kendalaText).trim() !== '-');
    return hasKendala
      ? TriageResult(ReportSeverity.URGENT, SeverityRank.URGENT)
      : TriageResult(ReportSeverity.NORMAL, SeverityRank.NORMAL);
  },

  evaluateReport: function(report, text) {
    const kText = (typeof report === 'string') ? report : (report ? (report.kendala || text) : text);
    return this.evaluate(kText);
  }
};

/**
 * Backward compatibility wrapper for evaluateFlags.
 * @param {string} kendalaText 
 * @returns {Object}
 */
function evaluateFlags(kendalaText) {
  return TriageEngine.evaluate(kendalaText);
}

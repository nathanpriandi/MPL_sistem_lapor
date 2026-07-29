/**
 * Utils.gs — Pure Utility Helpers & Unit Test Suite
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: UTILITIES / SHARED HELPERS
 * Responsibility: Provides timezone-aware date formatting, ISO week calculations, and test execution.
 */

/**
 * Formats a JavaScript Date object to YYYY-MM-DD HH:mm format (Asia/Jakarta timezone).
 * @param {Date|string|number} date 
 * @returns {string} Formatted date string or empty string.
 */
function formatDate(date) {
  if (!date) return '';
  try {
    return Utilities.formatDate(new Date(date), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm');
  } catch (e) {
    return String(date);
  }
}

/**
 * Returns ISO week label in format YYYY-Www (e.g., "2026-W30")
 * @param {Date|string|number} date 
 * @returns {string}
 */
function getISOWeekLabel(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const padWeek = weekNo < 10 ? '0' + weekNo : weekNo;
  return d.getFullYear() + '-W' + padWeek;
}

/**
 * Aggregates data from Daily_Raw, General_Raw, and Sensitive_Restricted into Weekly_Summary tab.
 * Backward compatibility wrapper delegating to AdminService.
 * @param {Spreadsheet} [ss] - Active Spreadsheet object.
 * @returns {Array} List of aggregated site statistics objects.
 */
function aggregateWeeklyData(ss) {
  return AdminService.aggregateWeeklyData(ss);
}

/**
 * Unit Test Helper: Evaluates keyword rules locally against TriageEngine.
 * Can be run from Apps Script editor to verify behavior without sending forms.
 */
function testKeywordMatcher() {
  const testCases = [
    { input: ['EMP-01', 'Site A', '2026-07-23', 'Completed', 500, 'Equipment'], expectedSev: 'warning', expectedRank: 2 },
    { input: ['EMP-02', 'Site B', '2026-07-23', 'Ada kecelakaan kerja di kandang 3'], expectedSev: 'urgent', expectedRank: 1 },
    { input: ['EMP-03', 'Site C', '2026-07-23', 'Stok pakan ayam habis total'], expectedSev: 'warning', expectedRank: 2 },
    { input: ['EMP-04', 'Site A', '2026-07-23', 'Semua kegiatan lancar dan aman'], expectedSev: 'normal', expectedRank: 3 }
  ];

  Logger.log('=== RUNNING KEYWORD MATCHER UNIT TESTS (TRIAGE ENGINE) ===');
  testCases.forEach((tc, idx) => {
    const result = TriageEngine.evaluate(tc.input);
    const pass = (result.severity === tc.expectedSev) && (result.rank === tc.expectedRank);
    Logger.log(`Test #${idx + 1}: ${pass ? 'PASSED' : 'FAILED'} (Expected: ${tc.expectedSev} [rank ${tc.expectedRank}], Got: ${result.severity} [rank ${result.rank}])`);
  });
}

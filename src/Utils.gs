/**
 * Utils.gs — Pure Utility Helpers & Formatters
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: UTILITIES / SHARED HELPERS
 * Responsibility: Provides timezone-aware date formatting, phone number normalization,
 * currency formatting, ISO week calculations, and string escaping.
 * Pure utility functions with zero database or business-logic coupling.
 */

/**
 * Formats a JavaScript Date object to YYYY-MM-DD HH:mm format (Asia/Jakarta timezone).
 * @param {Date|string|number} date 
 * @returns {string} Formatted date string or empty string.
 */
function formatDate(date) {
  if (!date) return '';
  if (typeof date === 'string') {
    const trimmed = date.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === '-') return '';
  }
  try {
    const d = new Date(date);
    if (isNaN(d.getTime()) || d.getTime() <= 86400000) return '';
    return Utilities.formatDate(d, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm');
  } catch (e) {
    return '';
  }
}

/**
 * Normalizes phone numbers, ensuring the leading '0' is preserved.
 * Handles numbers read from Google Sheets where leading zeros were stripped (e.g. 81234567890 -> '081234567890').
 * Handles scientific notation (e.g. 8.123456789E10), country code prefixes (+62 / 62), and formatting dashes/spaces.
 * @param {string|number} val 
 * @returns {string}
 */
function normalizePhoneNumber(val) {
  if (val === null || val === undefined) return '';
  let s = String(val).trim();
  if (!s || s === '-' || s === 'null' || s === 'undefined') return '';

  // Handle exponential notation from Google Sheets raw numeric reading
  if (/^[0-9.]+[eE]\+?[0-9]+$/.test(s)) {
    try {
      const num = Number(s);
      if (!isNaN(num)) {
        s = num.toLocaleString('fullwide', { useGrouping: false });
      }
    } catch (e) {}
  }

  // Extract all digits
  const digits = s.replace(/\D/g, '');
  if (!digits) return s;

  // Convert international 628... to Indonesian local 08...
  if (digits.startsWith('628') && digits.length >= 10) {
    return '0' + digits.substring(2);
  }

  // If leading 0 was stripped by spreadsheet (e.g. 812..., 857..., 896... with 9 to 13 digits)
  if (digits.startsWith('8') && digits.length >= 9 && digits.length <= 13) {
    return '0' + digits;
  }

  // If already starts with 0 (e.g. 0812..., 021...)
  if (digits.startsWith('0')) {
    return digits;
  }

  // If starts with + (international non-ID)
  if (s.startsWith('+')) {
    return '+' + digits;
  }

  return digits;
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
 * Formats a number to Indonesian Rupiah (IDR).
 * @param {number|string} amount 
 * @returns {string} e.g. "Rp 1.500.000"
 */
function formatRupiah(amount) {
  const num = Number(amount) || 0;
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

/**
 * Escapes HTML entities to prevent XSS injection.
 * @param {string} str 
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Aggregates live operational summary statistics.
 * Backward compatibility wrapper delegating to SpreadsheetRepository.
 * @param {Spreadsheet} [ss] - Active Spreadsheet object.
 * @returns {Array} List of aggregated weekly trend statistics objects.
 */
function aggregateWeeklyData(ss) {
  if (typeof SpreadsheetRepository !== 'undefined' && SpreadsheetRepository.getDashboardStatsData) {
    const stats = SpreadsheetRepository.getDashboardStatsData();
    return (stats && stats.weeklyTrend) ? stats.weeklyTrend : [];
  }
  return [];
}

/**
 * Unit Test Helper: Evaluates literal triage rules against TriageEngine.
 */
function testKeywordMatcher() {
  const testCases = [
    { input: 'Ada kecelakaan kerja di kandang 3', expectedSev: 'urgent', expectedRank: 1 },
    { input: 'Stok pakan ayam habis total', expectedSev: 'urgent', expectedRank: 1 },
    { input: 'Semua kegiatan lancar dan aman', expectedSev: 'normal', expectedRank: 2 },
    { input: 'tidak ada kendala', expectedSev: 'normal', expectedRank: 2 },
    { input: '-', expectedSev: 'normal', expectedRank: 2 }
  ];

  Logger.log('=== RUNNING TRIAGE ENGINE UNIT TESTS ===');
  testCases.forEach((tc, idx) => {
    const result = TriageEngine.evaluate(tc.input);
    const pass = (result.severity === tc.expectedSev) && (result.rank === tc.expectedRank);
    Logger.log(`Test #${idx + 1}: ${pass ? 'PASSED' : 'FAILED'} (Expected: ${tc.expectedSev} [rank ${tc.expectedRank}], Got: ${result.severity} [rank ${result.rank}])`);
  });
}

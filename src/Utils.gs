/**
 * Utils.gs — Helper Utilities & Data Aggregation Functions
 * Digital Reporting System for Integrated Agriculture Company
 */

/**
 * Formats a JavaScript Date object to YYYY-MM-DD HH:mm format (Asia/Jakarta timezone).
 */
function formatDate(date) {
  if (!date) return '';
  return Utilities.formatDate(new Date(date), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm');
}

/**
 * Returns ISO week label in format YYYY-Www (e.g., "2026-W30")
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
 * @param {Spreadsheet} ss - Active Spreadsheet object.
 * @returns {Array} List of aggregated site statistics objects.
 */
function aggregateWeeklyData(ss) {
  const summarySheet = ss.getSheetByName('Weekly_Summary');
  const dailySheet = ss.getSheetByName('Daily_Raw');
  const generalSheet = ss.getSheetByName('General_Raw');
  const sensitiveSheet = ss.getSheetByName('Sensitive_Restricted');

  const weekLabel = getISOWeekLabel(new Date());
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
    siteStatsMap[site] = {
      site: site,
      dailyCount: 0,
      generalCount: 0,
      urgentCount: 0,
      warningCount: 0,
      sensitiveCount: 0,
      totalYield: 0
    };
  });

  // Aggregate Daily_Raw (skip header)
  for (let i = 1; i < dailyValues.length; i++) {
    const row = dailyValues[i];
    const site = row[2];
    if (siteStatsMap[site]) {
      siteStatsMap[site].dailyCount++;
      const yieldKg = parseFloat(row[5]) || 0;
      siteStatsMap[site].totalYield += yieldKg;
      
      const severity = String(row[7]).toLowerCase();
      if (severity === 'urgent') siteStatsMap[site].urgentCount++;
      else if (severity === 'warning') siteStatsMap[site].warningCount++;
    }
  }

  // Aggregate General_Raw (skip header)
  for (let i = 1; i < generalValues.length; i++) {
    const row = generalValues[i];
    const site = row[2];
    if (siteStatsMap[site]) {
      siteStatsMap[site].generalCount++;
      const severity = String(row[6]).toLowerCase();
      if (severity === 'urgent') siteStatsMap[site].urgentCount++;
      else if (severity === 'warning') siteStatsMap[site].warningCount++;
    }
  }

  // Aggregate Sensitive_Restricted (skip header)
  for (let i = 1; i < sensitiveValues.length; i++) {
    const row = sensitiveValues[i];
    const site = row[2];
    if (siteStatsMap[site]) {
      siteStatsMap[site].sensitiveCount++;
      const severity = String(row[6]).toLowerCase();
      if (severity === 'urgent') siteStatsMap[site].urgentCount++;
      else if (severity === 'warning') siteStatsMap[site].warningCount++;
    }
  }

  const resultStats = [];
  const nowFormatted = formatDate(new Date());

  // Append new rows to Weekly_Summary
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
}

/**
 * Unit Test Helper: Evaluates keyword rules locally to ensure criteria matching works properly.
 * Can be run from Apps Script editor to verify behavior without sending forms.
 */
function testKeywordMatcher() {
  const testCases = [
    { input: ['EMP-01', 'Site A', '2026-07-23', 'Completed', 500, 'Equipment'], expectedSev: 'warning' },
    { input: ['EMP-02', 'Site B', '2026-07-23', 'Ada kecelakaan kerja di kandang 3'], expectedSev: 'urgent' },
    { input: ['EMP-03', 'Site C', '2026-07-23', 'Stok pakan ayam habis total'], expectedSev: 'warning' },
    { input: ['EMP-04', 'Site A', '2026-07-23', 'Semua kegiatan lancar dan aman'], expectedSev: 'normal' }
  ];

  Logger.log('=== RUNNING KEYWORD MATCHER UNIT TESTS ===');
  testCases.forEach((tc, idx) => {
    const result = evaluateFlags(tc.input);
    const pass = result.severity === tc.expectedSev;
    Logger.log(`Test #${idx + 1}: ${pass ? 'PASSED' : 'FAILED'} (Expected: ${tc.expectedSev}, Got: ${result.severity})`);
  });
}

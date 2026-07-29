/**
 * MockSimulator.gs — Test & Seed Data Generator Controller
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: UTILITIES / TESTING SEEDER
 * Responsibility: Seeds sample realistic Indonesian agriculture daily and general reports into Spreadsheet tabs.
 */

/**
 * Seeds sample realistic Indonesian agriculture daily and general reports into Spreadsheet tabs.
 * Useful for reviewing system behavior, triggers, and Looker Studio views without manual entry.
 */
function seedMockData() {
  Logger.log('Seeding mock operational data...');
  const ss = SpreadsheetRepository.getSpreadsheet();

  const dailySheet = ss.getSheetByName(SHEET_NAMES.DAILY_RAW);
  const generalSheet = ss.getSheetByName(SHEET_NAMES.GENERAL_RAW);
  const sensitiveSheet = ss.getSheetByName(SHEET_NAMES.SENSITIVE_RESTRICTED);

  const now = new Date();
  const todayStr = formatDate(now);

  // 1. Seed Daily Operational Reports
  const dailySamples = [
    [todayStr, 'EMP-101', 'Site A — Kebun & Lahan Pertanian', todayStr, 'Completed', 1450, 'None', ReportSeverity.NORMAL, SeverityRank.NORMAL, ReportCategory.ROUTINE, ReviewStatus.UNREVIEWED],
    [todayStr, 'EMP-102', 'Site A — Kebun & Lahan Pertanian', todayStr, 'Delayed', 800, 'Weather', ReportSeverity.WARNING, SeverityRank.WARNING, ReportCategory.WEATHER_IMPACT, ReviewStatus.UNREVIEWED],
    [todayStr, 'EMP-201', 'Site B — Peternakan & Kandang', todayStr, 'Completed', 0, 'None', ReportSeverity.NORMAL, SeverityRank.NORMAL, ReportCategory.ROUTINE, ReviewStatus.UNREVIEWED],
    [todayStr, 'EMP-202', 'Site B — Peternakan & Kandang', todayStr, 'Delayed', 0, 'Equipment', ReportSeverity.WARNING, SeverityRank.WARNING, ReportCategory.MINOR_EQUIPMENT, ReviewStatus.UNREVIEWED],
    [todayStr, 'EMP-301', 'Site C — Pabrik Pengolahan & Pakan', todayStr, 'Completed', 3200, 'None', ReportSeverity.NORMAL, SeverityRank.NORMAL, ReportCategory.ROUTINE, ReviewStatus.UNREVIEWED],
    [todayStr, 'EMP-302', 'Site C — Pabrik Pengolahan & Pakan', todayStr, 'Delayed', 1100, 'Equipment', ReportSeverity.URGENT, SeverityRank.URGENT, ReportCategory.EQUIPMENT_BREAKDOWN, ReviewStatus.UNREVIEWED]
  ];

  dailySamples.forEach(row => {
    const reportId = Utilities.getUuid();
    dailySheet.appendRow([reportId].concat(row));
  });
  Logger.log(`Appended ${dailySamples.length} rows to Daily_Raw.`);

  // 2. Seed General Reports
  const generalSamples = [
    [todayStr, 'EMP-103', 'Site A — Kebun & Lahan Pertanian', todayStr, 'Ditemukan indikasi awal pestisida berkurang di gudang kebun A. Pemantauan dilanjutkan.', 'Tidak', ReportSeverity.NORMAL, SeverityRank.NORMAL, ReportCategory.ROUTINE, ReviewStatus.UNREVIEWED],
    [todayStr, 'EMP-203', 'Site B — Peternakan & Kandang', todayStr, 'Ada kecelakaan kerja ringan saat pembersihan kandang 2. Korban sudah ditangani tim P3K.', 'Tidak', ReportSeverity.URGENT, SeverityRank.URGENT, ReportCategory.INCIDENT, ReviewStatus.UNREVIEWED]
  ];

  generalSamples.forEach(row => {
    const reportId = Utilities.getUuid();
    generalSheet.appendRow([reportId].concat(row));
  });

  // 3. Seed Sensitive Report directly to Sensitive_Restricted
  const sensitiveReportId = Utilities.getUuid();
  const sensitiveSample = [sensitiveReportId, todayStr, 'EMP-401', 'Site D — Logistik & Gudang', todayStr, 'Laporan audit internal biaya operasional dan efisiensi bahan bakar armada.', 'Ya / Yes (Laporan ini berisi data sensitif/privat)', ReportSeverity.NORMAL, SeverityRank.NORMAL, ReportCategory.ROUTINE, ReviewStatus.UNREVIEWED_SENSITIVE];
  sensitiveSheet.appendRow(sensitiveSample);

  Logger.log(`Appended ${generalSamples.length} rows to General_Raw and 1 row to Sensitive_Restricted.`);
  Logger.log('=== MOCK DATA SEEDING COMPLETE ===');
}

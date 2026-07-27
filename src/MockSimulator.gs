/**
 * MockSimulator.gs — Test & Seed Data Generator
 * Digital Reporting System for Integrated Agriculture Company
 */

/**
 * Seeds sample realistic Indonesian agriculture daily and general reports into Spreadsheet tabs.
 * Useful for reviewing system behavior, triggers, and Looker Studio views without manual entry.
 */
function seedMockData() {
  Logger.log('Seeding mock operational data...');
  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty('SPREADSHEET_ID');

  if (!ssId) {
    throw new Error('SPREADSHEET_ID not set. Run setupReportingSystem() first.');
  }

  const ss = SpreadsheetApp.openById(ssId);
  const dailySheet = ss.getSheetByName('Daily_Raw');
  const generalSheet = ss.getSheetByName('General_Raw');
  const sensitiveSheet = ss.getSheetByName('Sensitive_Restricted');

  const now = new Date();
  const todayStr = formatDate(now);

  // 1. Seed Daily Operational Reports (Cols: Timestamp, EmpID, Site, Date, Status, Yield, Issues, Severity, Rank, Category, ReviewStatus)
  const dailySamples = [
    [todayStr, 'EMP-101', 'Site A — Kebun & Lahan Pertanian', todayStr, 'Completed', 1450, 'None', 'normal', 3, 'routine', 'Unreviewed'],
    [todayStr, 'EMP-102', 'Site A — Kebun & Lahan Pertanian', todayStr, 'Delayed', 800, 'Weather', 'warning', 2, 'weather_impact', 'Unreviewed'],
    [todayStr, 'EMP-201', 'Site B — Peternakan & Kandang', todayStr, 'Completed', 0, 'None', 'normal', 3, 'routine', 'Unreviewed'],
    [todayStr, 'EMP-202', 'Site B — Peternakan & Kandang', todayStr, 'Delayed', 0, 'Equipment', 'warning', 2, 'minor_equipment', 'Unreviewed'],
    [todayStr, 'EMP-301', 'Site C — Pabrik Pengolahan & Pakan', todayStr, 'Completed', 3200, 'None', 'normal', 3, 'routine', 'Unreviewed'],
    [todayStr, 'EMP-302', 'Site C — Pabrik Pengolahan & Pakan', todayStr, 'Delayed', 1100, 'Equipment', 'urgent', 1, 'equipment_breakdown', 'Unreviewed']
  ];

  dailySamples.forEach(row => {
    dailySheet.appendRow(row);
  });
  Logger.log(`Appended ${dailySamples.length} rows to Daily_Raw.`);

  // 2. Seed General Reports (Cols: Timestamp, EmpID, Site, Date, Details, Sensitive, Severity, Rank, Category, ReviewStatus)
  const generalSamples = [
    [todayStr, 'EMP-103', 'Site A — Kebun & Lahan Pertanian', todayStr, 'Ditemukan indikasi awal pestisida berkurang di gudang kebun A. Pemantauan dilanjutkan.', 'Tidak', 'normal', 3, 'routine', 'Unreviewed'],
    [todayStr, 'EMP-203', 'Site B — Peternakan & Kandang', todayStr, 'Ada kecelakaan kerja ringan saat pembersihan kandang 2. Korban sudah ditangani tim P3K.', 'Tidak', 'urgent', 1, 'incident', 'Unreviewed']
  ];

  generalSamples.forEach(row => {
    generalSheet.appendRow(row);
  });

  // 3. Seed Sensitive Report directly to Sensitive_Restricted
  const sensitiveSample = [todayStr, 'EMP-401', 'Site D — Logistik & Gudang', todayStr, 'Laporan audit internal biaya operasional dan efisiensi bahan bakar armada.', 'Ya / Yes (Laporan ini berisi data sensitif/privat)', 'normal', 3, 'routine', 'Unreviewed (Sensitive)'];
  sensitiveSheet.appendRow(sensitiveSample);

  Logger.log(`Appended ${generalSamples.length} rows to General_Raw and 1 row to Sensitive_Restricted.`);
  Logger.log('=== MOCK DATA SEEDING COMPLETE ===');
}

/**
 * MockSimulator.gs — Test & Seed Data Generator Controller
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: UTILITIES / TESTING SEEDER
 * Responsibility: Seeds sample realistic Indonesian agriculture operational reports into Spreadsheet tabs.
 */

/**
 * Seeds sample realistic Indonesian agriculture operational reports into Spreadsheet tabs.
 * Useful for reviewing system behavior, triggers, and Looker Studio views without manual entry.
 */
function seedMockData() {
  if (typeof SecurityService !== 'undefined') {
    SecurityService.AccessGuard.requireSuperadmin();
  }
  Logger.log('Seeding mock operational data...');
  const ss = SpreadsheetRepository.getSpreadsheet();

  const forms = FormManagementService.getFormList();
  const opForm = forms.find(f => (f.type || '').toLowerCase() === 'operasional' || f.isDefaultMain || f.isDefault) || { title: 'Laporan Operasional' };
  const mainSheet = FormManagementService.resolveFormTab_(ss, opForm);
  const sensitiveSheet = ss.getSheetByName('Sensitive') || ss.getSheetByName(SHEET_NAMES.SENSITIVE_RESTRICTED);

  const now = new Date();
  const todayStr = formatDate(now);
  const dateOnly = todayStr.split(' ')[0];

  // Seed Realistic Multi-Scenario Operational Reports (26 columns schema)
  const past18Days = new Date(Date.now() - 18 * 24 * 60 * 60 * 1000);
  const past10Days = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const past5Days = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

  const mockRows = [
    // 1. Root Activity: Agro Kebun A
    [
      Utilities.getUuid(), 'AGR-KEBUNA-202608-01', '', formatDate(past5Days), 'Budi Santoso', 
      'Agro (Pertanian/Perkebunan)', 'Kebun A - Blok 3', 'Penanaman Bibit Sawit', 'Target 500 bibit', 
      12.5, 500, formatDate(past5Days).split(' ')[0], '', '2026-11-15', '', 0, '', 0, 0, 0, 
      'Pompa irigasi tersumbat', 'Pembersihan filter irigasi secara manual', '', 
      ReportSeverity.WARNING, 'irigasi, tersumbat', ReviewStatus.UNVERIFIED
    ],
    // 2. Continuation Report of Activity 1 (Matches Kode_Kegiatan_Ref -> folds into AGR-KEBUNA-202608-01)
    [
      Utilities.getUuid(), 'AGR-KEBUNA-202608-01-C1', 'AGR-KEBUNA-202608-01', todayStr, 'Budi Santoso', 
      'Agro (Pertanian/Perkebunan)', 'Kebun A - Blok 3', 'Pemupukan Lanjutan Sawit', 'Aplikasi 200 kg NPK', 
      12.5, 500, '', '', '2026-11-15', dateOnly, 1200, dateOnly, 15000, 80, 1200000, 
      '', '', '', 
      ReportSeverity.NORMAL, '', ReviewStatus.UNVERIFIED
    ],
    // 3. Urgent Overdue Harvest (>15 days late, no Tgl_Panen)
    [
      Utilities.getUuid(), 'TRN-KANDB-202608-02', '', formatDate(past18Days), 'Siti Rahma', 
      'Ternak (Peternakan)', 'Kandang Ayam B-2', 'Pembesaran Broiler Periode 4', 'Target 2500 ekor', 
      0, 2500, '', formatDate(past18Days).split(' ')[0], formatDate(past18Days).split(' ')[0], '', 0, '', 0, 0, 0, 
      'Pakan formula lambat datang', 'Pemberian pakan alternatif darurat', '', 
      ReportSeverity.WARNING, 'pakan, lambat', ReviewStatus.UNVERIFIED
    ],
    // 4. Open Obstacle with NO Upaya (Urgent attention item)
    [
      Utilities.getUuid(), 'IKN-KOLAMC-202608-03', '', todayStr, 'Ahmad Hidayat', 
      'Ikan (Perikanan)', 'Kolam Lele C-1', 'Pemeliharaan Benih Lele', 'Tebar 10.000 benih', 
      2.0, 10000, '', dateOnly, '2026-10-01', '', 0, '', 0, 0, 0, 
      'Kualitas air kolam keruh & pH drop drastis', '', '', 
      ReportSeverity.URGENT, 'mati masal, terkontaminasi', ReviewStatus.UNVERIFIED
    ],
    // 5. Warning Overdue Harvest (8-14 days late, no Tgl_Panen)
    [
      Utilities.getUuid(), 'AGR-SITEC-202608-04', '', formatDate(past10Days), 'Dedi Kurniawan', 
      'Agro (Pertanian/Perkebunan)', 'Lahan Jagung C-4', 'Budidaya Jagung Hibrida', 'Panen 5 Ton', 
      4.0, 15000, formatDate(past10Days).split(' ')[0], '', formatDate(past10Days).split(' ')[0], '', 0, '', 0, 0, 0, 
      '', '', '', 
      ReportSeverity.NORMAL, '', ReviewStatus.UNVERIFIED
    ],
    // 6. Completed Harvest & High Sales (Perikanan)
    [
      Utilities.getUuid(), 'IKN-TAMBAKD-202608-05', '', todayStr, 'Eko Prasetyo', 
      'Ikan (Perikanan)', 'Tambak Udang D-1', 'Panen Total & Penjualan', 'Panen 850 kg Vaname', 
      1.5, 50000, '', dateOnly, dateOnly, dateOnly, 850, dateOnly, 85000, 850, 72250000, 
      '', '', '', 
      ReportSeverity.NORMAL, '', ReviewStatus.VERIFIED
    ]
  ];

  mockRows.forEach(row => {
    mainSheet.appendRow(row);
    SpreadsheetRepository.applyRowHighlighting(mainSheet, mainSheet.getLastRow(), row[23]);
  });
  Logger.log(`Appended ${mockRows.length} sample operational rows to ${mainSheet.getName()}.`);

  Logger.log('=== MOCK DATA SEEDING COMPLETE ===');
}

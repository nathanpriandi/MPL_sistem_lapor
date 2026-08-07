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
  Logger.log('Seeding mock operational data...');
  const ss = SpreadsheetRepository.getSpreadsheet();

  const forms = FormManagementService.getFormList();
  const opForm = forms.find(f => (f.type || '').toLowerCase() === 'operasional' || f.isDefaultMain || f.isDefault) || { title: 'Laporan Operasional' };
  const mainSheet = FormManagementService.resolveFormTab_(ss, opForm);
  const sensitiveSheet = ss.getSheetByName('Sensitive') || ss.getSheetByName(SHEET_NAMES.SENSITIVE_RESTRICTED);

  const now = new Date();
  const todayStr = formatDate(now);
  const dateOnly = todayStr.split(' ')[0];

  // Seed Operational Reports (26 columns schema)
  const mockRows = [
    [
      Utilities.getUuid(), 'AGR-KEBUNA-20260807-01', '', todayStr, 'Budi Santoso', 
      'Agro (Pertanian/Perkebunan)', 'Kebun A - Blok 3', 'Penanaman Bibit Sawit', 'Target 500 bibit', 
      12.5, 500, dateOnly, '', '2026-11-15', '2026-08-07', 1500, '2026-08-07', 15000, 100, 1500000, 
      'Pompa irigasi tersumbat', 'Pembersihan filter irigasi secara manual', '', 
      ReportSeverity.WARNING, 'layu, terkontaminasi', ReviewStatus.UNREVIEWED
    ],
    [
      Utilities.getUuid(), 'TRN-KANDB-20260807-02', '', todayStr, 'Siti Rahma', 
      'Ternak (Peternakan)', 'Kandang Ayam B-2', 'Pemberian Pakan & Cek Kesehatan', 'Pakan 1.2 Ton', 
      0, 2500, '', dateOnly, '2026-09-01', '', 0, '', 0, 0, 0, 
      'Suhu kandang naik 3 derajat', 'Penambahan kipas blower cadangan', '', 
      ReportSeverity.NORMAL, '', ReviewStatus.UNREVIEWED
    ],
    [
      Utilities.getUuid(), 'IKN-KOLAMC-20260807-03', '', todayStr, 'Ahmad Hidayat', 
      'Ikan (Perikanan)', 'Kolam Lele C-1', 'Panen Parsial & Penjualan', 'Panen 800 kg', 
      2.0, 10000, '', dateOnly, '2026-08-07', '2026-08-07', 800, '2026-08-07', 22000, 800, 17600000, 
      'Permintaan tengkulak tinggi', 'Koordinasi armada penjemputan', '', 
      ReportSeverity.NORMAL, '', ReviewStatus.CLOSED
    ]
  ];

  mockRows.forEach(row => {
    mainSheet.appendRow(row);
    SpreadsheetRepository.applyRowHighlighting(mainSheet, mainSheet.getLastRow(), row[23]);
  });
  Logger.log(`Appended ${mockRows.length} rows to ${mainSheet.getName()}.`);

  Logger.log('=== MOCK DATA SEEDING COMPLETE ===');
}

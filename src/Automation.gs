/**
 * Automation.gs — Flagging Rules & Severity Categorization Engine
 * Digital Reporting System for Integrated Agriculture Company
 */

// Keyword dictionaries in Bahasa Indonesia tailored for Agriculture, Farming & Processing Operations
const URGENT_KEYWORDS = [
  'kecelakaan', 'kebakaran', 'banjir', 'darurat', 'cedera', 'korban',
  'rusak berat', 'bocor', 'meledak', 'mati total', 'patah', 'tumbang',
  'hama', 'wabah', 'penyakit', 'mati masal', 'terkontaminasi', 'keracunan', 'pestisida'
];

const WARNING_KEYWORDS = [
  'kurang', 'terlambat', 'lambat', 'habis', 'tertunda', 'stok tipis',
  'mogok', 'rusak ringan', 'bising', 'bocor halus', 'baterai lemah',
  'hujan deras', 'angin kencang', 'becek', 'akses tertutup', 'equipment'
];

/**
 * Evaluates row text content and determines Flag_Severity and Flag_Category.
 * @param {Array} rowData - Array of cell values from the submitted form row.
 * @returns {Object} { severity: 'urgent'|'warning'|'normal', category: string }
 */
function evaluateFlags(rowData) {
  if (!rowData || rowData.length === 0) {
    return { severity: 'normal', category: 'routine' };
  }

  const fullText = rowData.join(' ').toLowerCase();

  // 1. Check for URGENT conditions
  for (let i = 0; i < URGENT_KEYWORDS.length; i++) {
    const keyword = URGENT_KEYWORDS[i];
    if (fullText.includes(keyword)) {
      let category = 'incident';
      if (['hama', 'wabah', 'penyakit', 'mati masal'].includes(keyword)) {
        category = 'biological/outbreak';
      } else if (['rusak berat', 'meledak', 'mati total'].includes(keyword)) {
        category = 'equipment_breakdown';
      }
      return { severity: 'urgent', category: category, rank: 1 };
    }
  }

  // 2. Check for WARNING conditions
  for (let i = 0; i < WARNING_KEYWORDS.length; i++) {
    const keyword = WARNING_KEYWORDS[i];
    if (fullText.includes(keyword)) {
      let category = 'operational_delay';
      if (['hujan deras', 'angin kencang', 'becek'].includes(keyword)) {
        category = 'weather_impact';
      } else if (['mogok', 'rusak ringan', 'equipment'].includes(keyword)) {
        category = 'minor_equipment';
      }
      return { severity: 'warning', category: category, rank: 2 };
    }
  }

  // 3. Default to NORMAL / Routine
  return { severity: 'normal', category: 'routine', rank: 3 };
}

/**
 * Checks whether a row in General_Raw is marked as sensitive.
 * @param {Array} rowData - Array of cell values from General_Raw.
 * @returns {boolean} True if marked sensitive.
 */
function isSensitiveRow(rowData) {
  if (!rowData || rowData.length === 0) return false;
  // Check index 6 (with Report_ID in Col 1) or index 5 (without Report_ID)
  const val = String(rowData[6] || rowData[5] || '').toLowerCase();
  return val.includes('ya') || val.includes('yes') || val === 'true' || val === '1';
}

/**
 * Monthly time-driven trigger function to archive closed reports older than retention threshold.
 * Default retention threshold is 90 days (configurable via Script Property RETENTION_DAYS).
 * Moves closed rows from Daily_Raw, General_Raw, and Sensitive_Restricted into Archive_Reports.
 * @returns {Object} Summary of archived row counts.
 */
function archiveOldReports() {
  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty('SPREADSHEET_ID');
  if (!ssId) {
    Logger.log('SPREADSHEET_ID missing. Archival skipped.');
    return { success: false, reason: 'SPREADSHEET_ID missing' };
  }

  const retentionDays = parseInt(props.getProperty('RETENTION_DAYS'), 10) || 90;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  cutoffDate.setHours(0, 0, 0, 0);

  Logger.log(`Starting archiveOldReports... Cutoff date: ${cutoffDate.toISOString()} (${retentionDays} days threshold)`);

  const ss = SpreadsheetApp.openById(ssId);
  
  // Ensure Archive_Reports sheet exists with combined header
  let archiveSheet = ss.getSheetByName('Archive_Reports');
  if (!archiveSheet) {
    archiveSheet = ss.insertSheet('Archive_Reports');
    const archiveHeaders = [
      'Original_Sheet',
      'Report_ID',
      'Timestamp',
      'EmpID',
      'Site',
      'ReportDate',
      'Details_Or_Status',
      'Yield_Or_Sensitive',
      'Issues',
      'Flag_Severity',
      'Severity_Rank',
      'Flag_Category',
      'Review_Status',
      'Archived_At'
    ];
    archiveSheet.getRange(1, 1, 1, archiveHeaders.length).setValues([archiveHeaders]).setFontWeight('bold').setBackground('#e2e8f0');
  }

  const rawSheets = [
    { name: 'Daily_Raw', statusCol: 12, dateCol: 5 },       // Col E (Date) or Col B (Timestamp)
    { name: 'General_Raw', statusCol: 11, dateCol: 5 },     // Col E (Date) or Col B (Timestamp)
    { name: 'Sensitive_Restricted', statusCol: 11, dateCol: 5 }
  ];

  let totalArchived = 0;
  const nowStr = formatDate(new Date());

  rawSheets.forEach(sheetInfo => {
    const sheet = ss.getSheetByName(sheetInfo.name);
    if (!sheet) return;

    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return;

    // Iterate backwards so deleting rows does not disrupt row index order
    for (let r = values.length - 1; r >= 1; r--) {
      const row = values[r];
      const status = String(row[sheetInfo.statusCol - 1] || '').trim().toLowerCase();
      
      if (status.includes('closed')) {
        // Parse date from report date or timestamp
        const dateVal = row[sheetInfo.dateCol - 1] || row[1];
        let rowDate = null;

        if (dateVal instanceof Date) {
          rowDate = dateVal;
        } else if (typeof dateVal === 'string' && dateVal.trim() !== '') {
          rowDate = new Date(dateVal);
        }

        if (rowDate && !isNaN(rowDate.getTime()) && rowDate < cutoffDate) {
          let archiveRow = [];
          if (sheetInfo.name === 'Daily_Raw') {
            archiveRow = [
              sheetInfo.name,
              row[0], // Report_ID
              row[1], // Timestamp
              row[2], // EmpID
              row[3], // Site
              row[4], // Date
              `Status: ${row[5]}`, // Task Status
              row[6], // Yield (kg)
              row[7], // Issues
              row[8], // Severity
              row[9], // Rank
              row[10], // Category
              row[11], // Review_Status
              nowStr
            ];
          } else {
            archiveRow = [
              sheetInfo.name,
              row[0], // Report_ID
              row[1], // Timestamp
              row[2], // EmpID
              row[3], // Site
              row[4], // Date
              row[5], // Details
              row[6], // Sensitive Flag
              '-',    // Issues N/A
              row[7], // Severity
              row[8], // Rank
              row[9], // Category
              row[10], // Review_Status
              nowStr
            ];
          }

          archiveSheet.appendRow(archiveRow);
          sheet.deleteRow(r + 1);
          totalArchived++;
          Logger.log(`Archived row ${r + 1} from ${sheetInfo.name} (Report ID: ${row[0]})`);
        }
      }
    }
  });

  Logger.log(`=== ARCHIVAL COMPLETE. Total rows archived: ${totalArchived} ===`);
  return { success: true, totalArchived: totalArchived };
}


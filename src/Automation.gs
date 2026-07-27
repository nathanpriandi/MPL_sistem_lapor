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

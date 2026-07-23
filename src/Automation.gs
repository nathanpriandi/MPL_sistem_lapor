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
      return { severity: 'urgent', category: category };
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
      return { severity: 'warning', category: category };
    }
  }

  // 3. Default to NORMAL / Routine
  return { severity: 'normal', category: 'routine' };
}

/**
 * Checks whether a row in General_Raw is marked as sensitive.
 * @param {Array} rowData - Array of cell values from General_Raw.
 * @returns {boolean} True if marked sensitive.
 */
function isSensitiveRow(rowData) {
  // Column 6 (Index 5 in 0-indexed array) is "Informasi Sensitif?"
  if (rowData && rowData.length > 5) {
    const val = String(rowData[5]).toLowerCase();
    return val.includes('ya') || val.includes('yes') || val === 'true' || val === '1';
  }
  return false;
}

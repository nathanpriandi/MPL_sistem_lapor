/**
 * TriageEngine.gs — Automated Categorization & Severity Flagging Engine
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: DOMAIN
 * Responsibility: Pure domain rules for analyzing report content keywords.
 * Zero dependencies on Google Apps Script services (SpreadsheetApp, MailApp, etc.).
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

const TriageEngine = {
  /**
   * Evaluates row text content and determines Flag_Severity, Severity_Rank, and Flag_Category.
   * Maintains 100% backward compatibility with legacy global call: evaluateFlags(rowData).
   * @param {Array|string} rowData - Array of cell values or raw text string.
   * @returns {{ severity: string, rank: number, category: string }} TriageResult object.
   */
  evaluate: function(rowData) {
    if (!rowData || (Array.isArray(rowData) && rowData.length === 0)) {
      return TriageResult(ReportSeverity.NORMAL, SeverityRank.NORMAL, ReportCategory.ROUTINE);
    }

    const fullText = Array.isArray(rowData) ? rowData.join(' ').toLowerCase() : String(rowData).toLowerCase();

    // 1. Check for URGENT conditions
    for (let i = 0; i < URGENT_KEYWORDS.length; i++) {
      const keyword = URGENT_KEYWORDS[i];
      if (fullText.includes(keyword)) {
        let category = ReportCategory.INCIDENT;
        if (['hama', 'wabah', 'penyakit', 'mati masal'].includes(keyword)) {
          category = ReportCategory.BIOLOGICAL_OUTBREAK;
        } else if (['rusak berat', 'meledak', 'mati total'].includes(keyword)) {
          category = ReportCategory.EQUIPMENT_BREAKDOWN;
        }
        return TriageResult(ReportSeverity.URGENT, SeverityRank.URGENT, category);
      }
    }

    // 2. Check for WARNING conditions
    for (let i = 0; i < WARNING_KEYWORDS.length; i++) {
      const keyword = WARNING_KEYWORDS[i];
      if (fullText.includes(keyword)) {
        let category = ReportCategory.OPERATIONAL_DELAY;
        if (['hujan deras', 'angin kencang', 'becek'].includes(keyword)) {
          category = ReportCategory.WEATHER_IMPACT;
        } else if (['mogok', 'rusak ringan', 'equipment'].includes(keyword)) {
          category = ReportCategory.MINOR_EQUIPMENT;
        }
        return TriageResult(ReportSeverity.WARNING, SeverityRank.WARNING, category);
      }
    }

    // 3. Default to NORMAL / Routine
    return TriageResult(ReportSeverity.NORMAL, SeverityRank.NORMAL, ReportCategory.ROUTINE);
  },

  /**
   * Checks whether a row or payload in General_Raw is marked as sensitive.
   * Handles raw row data arrays, payload objects, or cell values.
   * @param {Array|string|Object} rowData 
   * @returns {boolean} True if marked sensitive.
   */
  isSensitiveRow: function(rowData) {
    if (!rowData) return false;
    
    if (Array.isArray(rowData)) {
      // Spreadsheet row array (length >= 6)
      if (rowData.length >= 6) {
        const val = String(rowData[6] || rowData[5] || '').toLowerCase();
        return val.includes('ya') || val.includes('yes') || val === 'true' || val === '1';
      }
      // Smaller array passed explicitly e.g. [details, sensitiveText]
      const fullText = rowData.join(' ').toLowerCase();
      return fullText.includes('ya / yes') || fullText.includes('sensitif') || fullText.includes('yes') || fullText === 'true';
    }
    
    const str = String(rowData).toLowerCase();
    return str.includes('ya') || str.includes('yes') || str === 'true' || str === '1';
  }
};

/**
 * Backward compatibility wrapper for existing calls to evaluateFlags.
 * @param {Array} rowData 
 * @returns {Object}
 */
function evaluateFlags(rowData) {
  return TriageEngine.evaluate(rowData);
}

/**
 * Backward compatibility wrapper for existing calls to isSensitiveRow.
 * @param {Array} rowData 
 * @returns {boolean}
 */
function isSensitiveRow(rowData) {
  return TriageEngine.isSensitiveRow(rowData);
}

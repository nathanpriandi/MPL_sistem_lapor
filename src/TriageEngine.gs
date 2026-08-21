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
  'hama', 'wabah', 'penyakit', 'mati masal', 'terkontaminasi', 'keracunan', 'pestisida',
  'gagal panen', 'busuk', 'serangan hama masal', 'mortalitas tinggi', 'rugi besar', 'pencurian', 'bencana alam'
];

const WARNING_KEYWORDS = [
  'kurang', 'terlambat', 'lambat', 'habis', 'tertunda', 'stok tipis',
  'mogok', 'rusak ringan', 'bising', 'bocor halus', 'baterai lemah',
  'hujan deras', 'angin kencang', 'becek', 'akses tertutup', 'equipment',
  'layu', 'harga anjlok', 'penurunan hasil', 'terlambat panen', 'stok menumpuk', 'kendala cuaca', 'kerusakan alat'
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

  evaluateReport: function(report, text) {
    return this.evaluate(text || report);
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

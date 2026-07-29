/**
 * DomainEntities.gs — Core Domain Models, Enums & Value Objects
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: DOMAIN
 * Responsibility: Enforces domain types, schema definitions, and model constructors.
 * Pure business concepts with zero infrastructure dependencies.
 */

/**
 * Domain Enum for Report Severity Levels
 */
const ReportSeverity = Object.freeze({
  URGENT: 'urgent',
  WARNING: 'warning',
  NORMAL: 'normal'
});

/**
 * Domain Enum for Report Severity Ranks (Numeric order for sorting)
 */
const SeverityRank = Object.freeze({
  URGENT: 1,
  WARNING: 2,
  NORMAL: 3
});

/**
 * Domain Enum for Report Review Statuses
 */
const ReviewStatus = Object.freeze({
  UNREVIEWED: 'Unreviewed',
  IN_REVIEW: 'In Review',
  ACTION_NEEDED: 'Action Needed',
  CLOSED: 'Closed',
  UNREVIEWED_SENSITIVE: 'Unreviewed (Sensitive)'
});

/**
 * Domain Enum for Triage Categories
 */
const ReportCategory = Object.freeze({
  ROUTINE: 'routine',
  INCIDENT: 'incident',
  BIOLOGICAL_OUTBREAK: 'biological/outbreak',
  EQUIPMENT_BREAKDOWN: 'equipment_breakdown',
  OPERATIONAL_DELAY: 'operational_delay',
  WEATHER_IMPACT: 'weather_impact',
  MINOR_EQUIPMENT: 'minor_equipment'
});

/**
 * Domain Value Object: Triage Result
 * @param {'urgent'|'warning'|'normal'} severity 
 * @param {number} rank 
 * @param {string} category 
 */
function TriageResult(severity, rank, category) {
  return {
    severity: severity || ReportSeverity.NORMAL,
    rank: rank || SeverityRank.NORMAL,
    category: category || ReportCategory.ROUTINE
  };
}

/**
 * Domain Entity: Daily Operational Report
 */
function DailyReport(data) {
  return {
    reportId: data.reportId || '',
    timestamp: data.timestamp || '',
    empId: data.empId || '',
    site: data.site || '',
    date: data.date || '',
    taskStatus: data.taskStatus || '',
    yieldKg: parseFloat(data.yieldKg) || 0,
    issues: Array.isArray(data.issues) ? data.issues.join(', ') : (data.issues || 'None')
  };
}

/**
 * Domain Entity: General Narrative & Incident Report
 */
function GeneralReport(data) {
  return {
    reportId: data.reportId || '',
    timestamp: data.timestamp || '',
    empId: data.empId || '',
    site: data.site || '',
    date: data.date || '',
    details: data.details || '',
    isSensitive: Boolean(data.isSensitive),
    sensitiveText: data.isSensitive 
      ? 'Ya / Yes (Laporan ini berisi data sensitif/privat)' 
      : 'Tidak'
  };
}

/**
 * Domain Entity: Admin Queue Row Item
 */
function QueueItem(data) {
  return {
    source: data.source || '',
    reportId: data.reportId || '',
    timestamp: data.timestamp || '',
    empId: data.empId || '',
    site: data.site || '',
    date: data.date || '',
    detail: data.detail || '',
    yieldOrSensitive: data.yieldOrSensitive || '',
    issues: data.issues || '',
    severity: data.severity || ReportSeverity.NORMAL,
    rank: data.rank || SeverityRank.NORMAL,
    category: data.category || ReportCategory.ROUTINE,
    reviewStatus: data.reviewStatus || ReviewStatus.UNREVIEWED
  };
}

/**
 * Domain Entity: Weekly Aggregated Site Statistics
 */
function WeeklyStat(siteName) {
  return {
    site: siteName,
    dailyCount: 0,
    generalCount: 0,
    urgentCount: 0,
    warningCount: 0,
    sensitiveCount: 0,
    totalYield: 0
  };
}

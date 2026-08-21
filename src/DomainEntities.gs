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
  CLOSED: 'Closed'
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
 * Domain Entity: Unified Operational Report (Kegiatan, Panen & Penjualan)
 */
function OperationalReport(data) {
  return {
    reportId: data.reportId || '',
    kodeKegiatan: data.kodeKegiatan || '',
    kodeKegiatanRef: data.kodeKegiatanRef || '',
    timestamp: data.timestamp || '',
    namaPic: data.namaPic || data.empId || '',
    bidangDivisi: data.bidangDivisi || data.site || '',
    lokasiKegiatan: data.lokasiKegiatan || '',
    jenisKegiatan: data.jenisKegiatan || '',
    kegiatanTambahan: data.kegiatanTambahan || '',
    pengawasan: data.pengawasan || '',
    targetKegiatan: data.targetKegiatan || '',
    luasAreaHa: parseFloat(data.luasAreaHa) || 0,
    jumlahPopulasi: parseFloat(data.jumlahPopulasi) || 0,
    tglTanam: data.tglTanam || '',
    tglCheckInTebar: data.tglCheckInTebar || '',
    tglPerkiraanPanen: data.tglPerkiraanPanen || '',
    statusPengelolaan: data.statusPengelolaan || '',
    komoditas: data.komoditas || '',
    luasLahanM2: parseFloat(data.luasLahanM2) || 0,
    jumlahBenih: parseFloat(data.jumlahBenih) || 0,
    estimasiPanenHst: parseFloat(data.estimasiPanenHst) || 0,
    tglPanen: data.tglPanen || '',
    jumlahPanen: parseFloat(data.jumlahPanen) || 0,
    tglPenjualan: data.tglPenjualan || '',
    hargaJual: parseFloat(data.hargaJual) || 0,
    jumlahPenjualanUnit: parseFloat(data.jumlahPenjualanUnit) || 0,
    nilaiPenjualanRp: parseFloat(data.nilaiPenjualanRp) || parseFloat(data.totalHargaRp) || 0,
    tujuanDistribusi: data.tujuanDistribusi || '',
    hargaSatuanRp: parseFloat(data.hargaSatuanRp) || 0,
    totalHargaRp: parseFloat(data.totalHargaRp) || 0,
    jumlahUnitPenggunaan: parseFloat(data.jumlahUnitPenggunaan) || 0,
    tujuanPenggunaan: Array.isArray(data.tujuanPenggunaan) ? data.tujuanPenggunaan.join(', ') : (data.tujuanPenggunaan || ''),
    capaianKegiatan: data.capaianKegiatan || '',
    kendala: data.kendala || '',
    upaya: data.upaya || '',
    fotoUrl: data.fotoUrl || data.photoUrl || ''
  };
}

/**
 * Domain Entity: Admin Queue Row Item
 */
function QueueItem(data) {
  return {
    source: data.source || 'Laporan Operasional',
    reportId: data.reportId || '',
    kodeKegiatan: data.kodeKegiatan || '',
    timestamp: data.timestamp || '',
    namaPic: data.namaPic || data.empId || '',
    divisi: data.divisi || data.site || '',
    lokasi: data.lokasi || '',
    ringkasan: data.ringkasan || data.detail || '',
    severity: data.severity || ReportSeverity.NORMAL,
    rank: data.rank || SeverityRank.NORMAL,
    category: data.category || ReportCategory.ROUTINE,
    reviewStatus: data.reviewStatus || ReviewStatus.UNREVIEWED,
    photoUrl: data.photoUrl || '',
    jumlahPanen: parseFloat(data.jumlahPanen) || 0,
    nilaiPenjualanRp: parseFloat(data.nilaiPenjualanRp) || 0,
    kendala: data.kendala || '',
    upaya: data.upaya || '',
    raw: data.raw || null
  };
}

/**
 * Domain Entity: Weekly Aggregated Division Statistics
 */
function WeeklyStat(divisiName) {
  return {
    site: divisiName,
    kegiatanCount: 0,
    activeKegiatanCount: 0,
    totalPanen: 0,
    totalPenjualanRp: 0,
    urgentCount: 0,
    warningCount: 0
  };
}

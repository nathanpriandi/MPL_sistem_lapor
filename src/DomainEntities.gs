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
  NORMAL: 'normal'
});

/**
 * Domain Enum for Report Severity Ranks (Numeric order for sorting)
 */
const SeverityRank = Object.freeze({
  URGENT: 1,
  NORMAL: 2
});

/**
 * Domain Enum for Report Review/Verification Statuses
 */
const ReviewStatus = Object.freeze({
  UNVERIFIED: 'Belum Terverifikasi',
  VERIFIED: 'Terverifikasi',
  // Backward-compatibility aliases
  UNREVIEWED: 'Belum Terverifikasi',
  IN_REVIEW: 'Belum Terverifikasi',
  ACTION_NEEDED: 'Belum Terverifikasi',
  CLOSED: 'Terverifikasi'
});

/**
 * Normalizes any legacy or custom status string to standard binary ReviewStatus.
 * @param {string|any} val
 * @returns {'Belum Terverifikasi'|'Terverifikasi'}
 */
function normalizeReviewStatus(val) {
  if (!val) return ReviewStatus.UNVERIFIED;
  const s = String(val).trim().toLowerCase();
  if (s === 'terverifikasi' || s === 'verified' || s === 'closed' || s === 'selesai' || s === 'reviewed') {
    return ReviewStatus.VERIFIED;
  }
  return ReviewStatus.UNVERIFIED;
}

/**
 * Domain Value Object: Triage Result
 * @param {'urgent'|'normal'} severity 
 * @param {number} rank 
 */
function TriageResult(severity, rank) {
  return {
    severity: severity || ReportSeverity.NORMAL,
    rank: rank || SeverityRank.NORMAL
  };
}

/**
 * Unwraps any string or object format into a clean URL string.
 * Prevents [object Object] serialization in Google Sheets.
 * @param {any} val 
 * @returns {string}
 */
function extractStringUrl(val) {
  if (!val) return '';
  if (typeof val === 'string') {
    return (val === '[object Object]') ? '' : val.trim();
  }
  if (typeof val === 'object' && val !== null) {
    if (val.url && typeof val.url === 'string') return val.url.trim();
    if (val.fotoUrl && typeof val.fotoUrl === 'string') return val.fotoUrl.trim();
    if (val.photoUrl && typeof val.photoUrl === 'string') return val.photoUrl.trim();
  }
  return '';
}

/**
 * Domain Entity: Unified Operational Report (Kegiatan, Panen & Penjualan)
 */
const OPERATIONAL_REPORT_FIELDS = Object.freeze([
  { key: 'reportId', header: 'Report_ID', getValue: (r) => r.reportId || '' },
  { key: 'kodeKegiatan', header: 'Kode_Kegiatan', getValue: (r) => r.kodeKegiatan || '' },
  { key: 'kodeKegiatanRef', header: 'Kode_Kegiatan_Ref', getValue: (r) => r.kodeKegiatanRef || '' },
  { key: 'timestamp', header: 'Timestamp', getValue: (r) => r.timestamp || '' },
  { key: 'namaPic', header: 'Nama_PIC', getValue: (r) => r.namaPic || '' },
  { key: 'bidangDivisi', header: 'Bidang_Divisi', getValue: (r) => r.bidangDivisi || '' },
  { key: 'lokasiKegiatan', header: 'Lokasi_Kegiatan', getValue: (r) => r.lokasiKegiatan || '' },
  { key: 'jenisKegiatan', header: 'Jenis_Kegiatan', getValue: (r) => r.jenisKegiatan || '' },
  { key: 'kegiatanTambahan', header: 'Kegiatan_Tambahan', getValue: (r) => r.kegiatanTambahan || '' },
  { key: 'pengawasan', header: 'Pengawasan', getValue: (r) => r.pengawasan || '' },
  { key: 'statusPengelolaan', header: 'Status_Pengelolaan', getValue: (r) => r.statusPengelolaan || '' },
  { key: 'komoditas', header: 'Komoditas', getValue: (r) => r.komoditas || '' },
  { key: 'luasLahanM2', header: 'Luas_Lahan_M2', getValue: (r) => r.luasLahanM2 || r.luasAreaHa || '' },
  { key: 'jumlahBenih', header: 'Jumlah_Benih', getValue: (r) => r.jumlahBenih || '' },
  { key: 'tglTanam', header: 'Tgl_Tanam', getValue: (r) => r.tglTanam || '' },
  { key: 'estimasiPanenHst', header: 'Estimasi_Panen_HST', getValue: (r) => r.estimasiPanenHst || r.tglPerkiraanPanen || '' },
  { key: 'tglPanen', header: 'Tgl_Panen', getValue: (r) => r.tglPanen || '' },
  { key: 'jumlahPanen', header: 'Jumlah_Panen_Kg', getValue: (r) => r.jumlahPanen || '' },
  { key: 'tglPenjualan', header: 'Tgl_Penjualan', getValue: (r) => r.tglPenjualan || '' },
  { key: 'tujuanDistribusi', header: 'Tujuan_Distribusi', getValue: (r) => r.tujuanDistribusi || '' },
  { key: 'jumlahPenjualanUnit', header: 'Jumlah_Penjualan_Unit', getValue: (r) => r.jumlahPenjualanUnit || '' },
  { key: 'hargaSatuanRp', header: 'Harga_Satuan_Rp', getValue: (r) => r.hargaSatuanRp || r.hargaJual || '' },
  { key: 'totalHargaRp', header: 'Total_Harga_Rp', getValue: (r) => r.totalHargaRp || r.nilaiPenjualanRp || '' },
  { key: 'jumlahUnitPenggunaan', header: 'Jumlah_Unit_Penggunaan', getValue: (r) => r.jumlahUnitPenggunaan || '' },
  { key: 'tujuanPenggunaan', header: 'Tujuan_Penggunaan', getValue: (r) => r.tujuanPenggunaan || '' },
  { key: 'capaianKegiatan', header: 'Capaian_Kegiatan', getValue: (r) => r.capaianKegiatan || '' },
  { key: 'kendala', header: 'Kendala', getValue: (r) => r.kendala || '' },
  { key: 'upaya', header: 'Upaya', getValue: (r) => r.upaya || '' },
  { key: 'fotoUrl', header: 'Foto_URL', getValue: (r) => extractStringUrl(r.fotoUrl || r.photoUrl) },
  { key: 'severity', header: 'Severity', getValue: (r, f) => (f && f.severity) ? f.severity : ReportSeverity.NORMAL },
  { key: 'reviewed', header: 'Reviewed', getValue: () => ReviewStatus.UNREVIEWED }
]);

function OperationalReport(data) {
  const resolvedPhotoUrl = extractStringUrl(data.fotoUrl || data.photoUrl);
  return {
    reportId: data.reportId || '',
    kodeKegiatan: data.kodeKegiatan || '',
    kodeKegiatanRef: data.kodeKegiatanRef || '',
    timestamp: data.timestamp || '',
    namaPic: data.namaPic || data.empId || '',
    bidangDivisi: data.bidangDivisi || data.site || '',
    lokasiKegiatan: data.lokasiKegiatan || '',
    jenisKegiatan: data.jenisKegiatan || '',
    kegiatanTambahan: Array.isArray(data.kegiatanTambahan) ? data.kegiatanTambahan.join(', ') : (data.kegiatanTambahan || ''),
    pengawasan: data.pengawasan || '',
    statusPengelolaan: data.statusPengelolaan || '',
    komoditas: data.komoditas || '',
    luasLahanM2: parseFloat(data.luasLahanM2) || 0,
    jumlahBenih: parseFloat(data.jumlahBenih) || 0,
    tglTanam: data.tglTanam || '',
    estimasiPanenHst: parseFloat(data.estimasiPanenHst) || 0,
    tglPanen: data.tglPanen || '',
    jumlahPanen: parseFloat(data.jumlahPanen) || 0,
    tglPenjualan: data.tglPenjualan || '',
    hargaJual: parseFloat(data.hargaJual) || 0,
    jumlahPenjualanUnit: parseFloat(data.jumlahPenjualanUnit) || 0,
    nilaiPenjualanRp: parseFloat(data.nilaiPenjualanRp) || parseFloat(data.totalHargaRp) || 0,
    tujuanDistribusi: Array.isArray(data.tujuanDistribusi) ? data.tujuanDistribusi.join(', ') : (data.tujuanDistribusi || ''),
    hargaSatuanRp: parseFloat(data.hargaSatuanRp) || 0,
    totalHargaRp: parseFloat(data.totalHargaRp) || 0,
    jumlahUnitPenggunaan: parseFloat(data.jumlahUnitPenggunaan) || 0,
    tujuanPenggunaan: Array.isArray(data.tujuanPenggunaan) ? data.tujuanPenggunaan.join(', ') : (data.tujuanPenggunaan || ''),
    capaianKegiatan: data.capaianKegiatan || '',
    kendala: data.kendala || '',
    upaya: data.upaya || '',
    fotoUrl: resolvedPhotoUrl
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
    empId: data.empId || data.namaPic || '',
    divisi: data.divisi || data.site || '',
    lokasi: data.lokasi || '',
    ringkasan: data.ringkasan || data.detail || '',
    severity: data.severity || ReportSeverity.NORMAL,
    rank: data.rank || SeverityRank.NORMAL,
    reviewStatus: normalizeReviewStatus(data.reviewStatus),
    photoUrl: data.photoUrl || '',
    jumlahPanen: parseFloat(data.jumlahPanen) || 0,
    nilaiPenjualanRp: parseFloat(data.nilaiPenjualanRp) || 0,
    kendala: data.kendala || '',
    upaya: data.upaya || '',
    fields: Array.isArray(data.fields) ? data.fields : [],
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

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
 * Normalizes Kendala text, stripping out negative/empty phrases like 'tidak ada', 'nihil', 'aman', '-', etc.
 * Returns clean obstacle description string, or empty string '' if no actual obstacle is reported.
 * @param {string|any} text
 * @returns {string} Clean obstacle text or empty string ''.
 */
function normalizeKendalaText(text) {
  if (!text) return '';
  const s = String(text).trim();
  if (!s || s === '-' || s === '--' || s === '.' || s === '/' || s === '0') return '';

  // Remove surrounding punctuation/brackets e.g. "(tidak ada kendala)", "- tidak ada -"
  const clean = s.toLowerCase()
    .replace(/^[\s\-_()[\]{}.,:;]+|[\s\-_()[\]{}.,:;]+$/g, '')
    .trim();

  const noKendalaPhrases = [
    '',
    '-',
    '--',
    'tidak ada',
    'tidak ada kendala',
    'tidak ada kendala sama sekali',
    'tidak ada kendala apapun',
    'tidak ada masalah',
    'tidak ada masalah sama sekali',
    'tdk ada',
    'tdk ada kendala',
    'tdk ada masalah',
    'tidak ada kendala yang berarti',
    'ga ada',
    'ga ada kendala',
    'gak ada',
    'gak ada kendala',
    'gak ada masalah',
    'belum ada',
    'belum ada kendala',
    'belom ada',
    'belom ada kendala',
    'nihil',
    'nil',
    'none',
    'na',
    'n/a',
    'null',
    'kosong',
    'no',
    'aman',
    'aman terkendali',
    'semua aman',
    'kondisi aman',
    'lancar',
    'lancar jaya',
    'semua lancar',
    'berjalan lancar',
    'kondusif',
    'normal',
    'baik',
    'baik-baik saja',
    'terkendali',
    'ok',
    'oke',
    'siap',
    'selesai'
  ];

  if (noKendalaPhrases.includes(clean)) {
    return '';
  }

  // Check if starts with negative phrase like "tidak ada kendala ..."
  if (/^(tidak ada|tdk ada|ga ada|gak ada|belum ada|nihil|aman|lancar)\s*(kendala|masalah|hambatan|gangguan)?$/i.test(clean)) {
    return '';
  }

  return s;
}

/**
 * Checks if a Kendala value represents an actual operational obstacle/incident.
 * @param {string|any} text
 * @returns {boolean}
 */
function isActualKendala(text) {
  return normalizeKendalaText(text).length > 0;
}

/**
 * Master Employee Registry (38 Karyawan, 5 Divisi)
 * Mudah diingat untuk kelompok usia lanjut (Prefix Divisi + 2 Digit)
 */
const EMPLOYEE_REGISTRY = Object.freeze([
  // Manajemen (9 Orang)
  { id: 'MNJ-01', name: 'Sadmoko', division: 'Manajemen' },
  { id: 'MNJ-02', name: 'Ariyana', division: 'Manajemen' },
  { id: 'MNJ-03', name: 'Pupu F Fauzi', division: 'Manajemen' },
  { id: 'MNJ-04', name: 'Martati', division: 'Manajemen' },
  { id: 'MNJ-05', name: 'Riska F', division: 'Manajemen' },
  { id: 'MNJ-06', name: 'M Fauzan', division: 'Manajemen' },
  { id: 'MNJ-07', name: 'Rasinta', division: 'Manajemen' },
  { id: 'MNJ-08', name: 'Alamsyah', division: 'Manajemen' },
  { id: 'MNJ-09', name: 'Devi Rosdiana', division: 'Manajemen' },

  // BKO 28 (2 Orang)
  { id: 'BKO-01', name: 'Didi', division: 'BKO 28' },
  { id: 'BKO-02', name: 'Gultom', division: 'BKO 28' },

  // Pekerja Harian (8 Orang)
  { id: 'PKH-01', name: 'Atang', division: 'Pekerja Harian' },
  { id: 'PKH-02', name: 'Adim', division: 'Pekerja Harian' },
  { id: 'PKH-03', name: 'Heru', division: 'Pekerja Harian' },
  { id: 'PKH-04', name: 'Alok', division: 'Pekerja Harian' },
  { id: 'PKH-05', name: 'Samid', division: 'Pekerja Harian' },
  { id: 'PKH-06', name: 'Komarudin', division: 'Pekerja Harian' },
  { id: 'PKH-07', name: 'Sanih', division: 'Pekerja Harian' },
  { id: 'PKH-08', name: 'Ira', division: 'Pekerja Harian' },

  // Alprof (7 Orang)
  { id: 'ALP-01', name: 'Pasrep N', division: 'Alprof' },
  { id: 'ALP-02', name: 'Andi Willy', division: 'Alprof' },
  { id: 'ALP-03', name: 'Sugiyo', division: 'Alprof' },
  { id: 'ALP-04', name: 'M Aris', division: 'Alprof' },
  { id: 'ALP-05', name: 'Mursito', division: 'Alprof' },
  { id: 'ALP-06', name: 'Jatniko', division: 'Alprof' },
  { id: 'ALP-07', name: 'Mislan', division: 'Alprof' },

  // SGA (12 Orang)
  { id: 'SGA-01', name: 'Ketut', division: 'SGA' },
  { id: 'SGA-02', name: 'Amas S', division: 'SGA' },
  { id: 'SGA-03', name: 'M Yusuf', division: 'SGA' },
  { id: 'SGA-04', name: 'Hasanudin', division: 'SGA' },
  { id: 'SGA-05', name: 'Roby Sandi', division: 'SGA' },
  { id: 'SGA-06', name: 'Rukman', division: 'SGA' },
  { id: 'SGA-07', name: 'Subandi', division: 'SGA' },
  { id: 'SGA-08', name: 'Suganda', division: 'SGA' },
  { id: 'SGA-09', name: 'Dede', division: 'SGA' },
  { id: 'SGA-10', name: 'Wafa', division: 'SGA' },
  { id: 'SGA-11', name: 'Rafi', division: 'SGA' },
  { id: 'SGA-12', name: 'Nur Iman', division: 'SGA' }
]);

/**
 * Searches employee by ID or Name with flexible forgiving match
 * (case-insensitive, trims, ignores hyphens/spaces for IDs).
 * @param {string} query
 * @returns {{ id: string, name: string, division: string }|null}
 */
function lookupEmployee(query) {
  if (!query) return null;
  const rawQ = String(query).trim();
  if (!rawQ) return null;

  const cleanQ = rawQ.toLowerCase().replace(/[\s\-_]/g, '');
  const lowerQ = rawQ.toLowerCase();

  // 1. Exact ID match or normalized ID match (e.g. "alp01" -> "ALP-01", "mnj-02" -> "MNJ-02")
  const idMatch = EMPLOYEE_REGISTRY.find(e => {
    const cleanId = e.id.toLowerCase().replace(/[\s\-_]/g, '');
    return cleanId === cleanQ || e.id.toLowerCase() === lowerQ;
  });
  if (idMatch) return Object.assign({}, idMatch);

  // 2. Exact Name match (case-insensitive full name)
  const exactNameMatch = EMPLOYEE_REGISTRY.find(e => e.name.toLowerCase() === lowerQ);
  if (exactNameMatch) return Object.assign({}, exactNameMatch);

  return null;
}

/**
 * Domain Entity: Unified Operational Report (Kegiatan, Panen & Penjualan)
 */
const OPERATIONAL_REPORT_FIELDS = Object.freeze([
  { key: 'reportId', header: 'Report_ID', getValue: (r) => r.reportId || '' },
  { key: 'idKaryawan', header: 'ID_Karyawan', getValue: (r) => r.idKaryawan || r.empId || '' },
  { key: 'kodeKegiatan', header: 'Kode_Kegiatan', getValue: (r) => r.kodeKegiatan || '' },
  { key: 'kodeKegiatanRef', header: 'Kode_Kegiatan_Ref', getValue: (r) => r.kodeKegiatanRef || '' },
  { key: 'timestamp', header: 'Timestamp', getValue: (r) => r.timestamp || '' },
  { key: 'namaPic', header: 'Nama_PIC', getValue: (r) => r.namaPic || '' },
  { key: 'bidangDivisi', header: 'Bidang_Divisi', getValue: (r) => r.bidangDivisi || '' },
  { key: 'lokasiKegiatan', header: 'Lokasi_Kegiatan', getValue: (r) => r.lokasiKegiatan || '' },
  { key: 'jenisKegiatan', header: 'Jenis_Kegiatan', getValue: (r) => r.jenisKegiatan || '' },
  { key: 'kegiatanTambahan', header: 'Kegiatan_Tambahan', getValue: (r) => r.kegiatanTambahan || '' },
  { key: 'pengawasan', header: 'Pengawasan', getValue: (r) => r.pengawasan ? (r.pengawasan + (r.detailPengawasan ? ` — ${r.detailPengawasan}` : '')) : '' },
  { key: 'administrasi', header: 'Administrasi', getValue: (r) => r.detailAdministrasi || r.administrasi || '' },
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
  let idKaryawan = data.idKaryawan || data.empId || '';
  let namaPic = data.namaPic || '';
  let bidangDivisi = data.bidangDivisi || data.site || '';

  // Auto-resolve from registry if ID or name is provided
  if (idKaryawan && (!namaPic || !bidangDivisi)) {
    const emp = lookupEmployee(idKaryawan);
    if (emp) {
      idKaryawan = emp.id;
      namaPic = namaPic || emp.name;
      bidangDivisi = bidangDivisi || emp.division;
    }
  } else if (!idKaryawan && namaPic) {
    const emp = lookupEmployee(namaPic);
    if (emp) {
      idKaryawan = emp.id;
      namaPic = emp.name;
      bidangDivisi = bidangDivisi || emp.division;
    }
  }

  return {
    reportId: data.reportId || '',
    idKaryawan: idKaryawan,
    empId: idKaryawan,
    kodeKegiatan: data.kodeKegiatan || '',
    kodeKegiatanRef: data.kodeKegiatanRef || '',
    timestamp: data.timestamp || '',
    namaPic: namaPic || idKaryawan || '',
    bidangDivisi: bidangDivisi || '',
    lokasiKegiatan: data.lokasiKegiatan || '',
    jenisKegiatan: data.jenisKegiatan || '',
    kegiatanTambahan: Array.isArray(data.kegiatanTambahan) ? data.kegiatanTambahan.join(', ') : (data.kegiatanTambahan || ''),
    pengawasan: data.pengawasan || '',
    detailPengawasan: data.detailPengawasan || '',
    administrasi: data.administrasi || data.detailAdministrasi || '',
    detailAdministrasi: data.detailAdministrasi || data.administrasi || '',
    statusPengelolaan: data.statusPengelolaan || '',
    statusPengelolaanPanen: data.statusPengelolaanPanen || '',
    komoditas: (() => {
      const kTanam = String(data.komoditas || '').trim();
      const kPanen = String(data.komoditasPanen || '').trim();
      if (kTanam && kPanen) {
        return (kTanam === kPanen) ? kTanam : `${kTanam} (Tanam), ${kPanen} (Panen)`;
      }
      return kTanam || kPanen || '';
    })(),
    komoditasPanen: data.komoditasPanen || '',
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
    kendala: normalizeKendalaText(data.kendala),
    upaya: normalizeKendalaText(data.kendala) ? (data.upaya || '') : '',
    fotoUrl: resolvedPhotoUrl
  };
}

/**
 * Domain Entity: Admin Queue Row Item
 */
function QueueItem(data) {
  const normKendala = normalizeKendalaText(data.kendala);
  return {
    source: data.source || 'Laporan Operasional',
    reportId: data.reportId || '',
    kodeKegiatan: data.kodeKegiatan || '',
    timestamp: data.timestamp || '',
    namaPic: data.namaPic || data.empId || '',
    empId: data.empId || data.namaPic || '',
    divisi: data.divisi || data.site || '',
    lokasi: data.lokasi || '',
    jenisKegiatan: data.jenisKegiatan || data.jenis || '',
    ringkasan: data.ringkasan || data.detail || '',
    severity: data.severity || (normKendala ? ReportSeverity.URGENT : ReportSeverity.NORMAL),
    rank: data.rank || (normKendala ? SeverityRank.URGENT : SeverityRank.NORMAL),
    reviewStatus: normalizeReviewStatus(data.reviewStatus),
    photoUrl: data.photoUrl || '',
    jumlahPanen: parseFloat(data.jumlahPanen) || 0,
    nilaiPenjualanRp: parseFloat(data.nilaiPenjualanRp) || 0,
    kendala: normKendala,
    upaya: normKendala ? (data.upaya || '') : '',
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

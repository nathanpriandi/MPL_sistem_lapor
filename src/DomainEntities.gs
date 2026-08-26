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
 * Returns active employee registry, preferring customized script property if present,
 * falling back to default EMPLOYEE_REGISTRY.
 * @returns {Array<{ id: string, name: string, division: string }>}
 */
function getActiveEmployeeRegistry() {
  let list = [];
  if (typeof ConfigRepository !== 'undefined' && ConfigRepository.getCustomEmployeeRegistry) {
    const custom = ConfigRepository.getCustomEmployeeRegistry();
    if (custom && Array.isArray(custom) && custom.length > 0) {
      list = custom;
    }
  }
  if (!list || list.length === 0) {
    list = EMPLOYEE_REGISTRY.map(e => ({ id: e.id, name: e.name, division: e.division }));
  }

  return JSON.parse(JSON.stringify(list));
}

/**
 * Searches employee by ID or Name with flexible forgiving match
 * (case-insensitive, trims, ignores hyphens/spaces for IDs).
 * @param {string} query
 * @returns {{ id: string, name: string, division: string, status?: string }|null}
 */
function lookupEmployee(query) {
  if (!query) return null;
  const rawQ = String(query).trim();
  if (!rawQ) return null;

  const cleanQ = rawQ.toLowerCase().replace(/[\s\-_]/g, '');
  const lowerQ = rawQ.toLowerCase();
  const currentRegistry = getActiveEmployeeRegistry(false);

  // 1. Exact ID match or normalized ID match (e.g. "alp01" -> "ALP-01", "mnj-02" -> "MNJ-02")
  const idMatch = currentRegistry.find(e => {
    const cleanId = String(e.id || '').toLowerCase().replace(/[\s\-_]/g, '');
    return cleanId === cleanQ || String(e.id || '').toLowerCase() === lowerQ;
  });
  if (idMatch) return Object.assign({}, idMatch);

  // 2. Exact Name match (case-insensitive full name)
  const exactNameMatch = currentRegistry.find(e => String(e.name || '').toLowerCase() === lowerQ);
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
  { key: 'timestamp', header: 'Timestamp', getValue: (r) => r.timestamp || '' },
  { key: 'namaPic', header: 'Nama_PIC', getValue: (r) => r.namaPic || '' },
  { key: 'bidangDivisi', header: 'Bidang_Divisi', getValue: (r) => r.bidangDivisi || '' },
  { key: 'nomorTelepon', header: 'Nomor_Telepon', getValue: (r) => r.nomorTelepon || r.noTelepon || r.telepon || '' },
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
  { key: 'fotoUrl', header: 'Foto_URL', getValue: (r) => extractStringUrl(r.fotoUrl || r.photoUrl || (Array.isArray(r.photos) && r.photos[0])) },
  { key: 'fotoUrl2', header: 'Foto_URL_2', getValue: (r) => extractStringUrl(r.fotoUrl2 || r.photoUrl2 || (Array.isArray(r.photos) && r.photos[1])) },
  { key: 'fotoUrl3', header: 'Foto_URL_3', getValue: (r) => extractStringUrl(r.fotoUrl3 || r.photoUrl3 || (Array.isArray(r.photos) && r.photos[2])) },
  { key: 'severity', header: 'Severity', getValue: (r, f) => (f && f.severity) ? f.severity : ReportSeverity.NORMAL },
  { key: 'reviewed', header: 'Reviewed', getValue: () => ReviewStatus.UNREVIEWED }
]);

function OperationalReport(data) {
  const resolvedPhotoUrl = extractStringUrl(data.fotoUrl || data.photoUrl || (Array.isArray(data.photos) && data.photos[0]));
  const resolvedPhotoUrl2 = extractStringUrl(data.fotoUrl2 || data.photoUrl2 || (Array.isArray(data.photos) && data.photos[1]));
  const resolvedPhotoUrl3 = extractStringUrl(data.fotoUrl3 || data.photoUrl3 || (Array.isArray(data.photos) && data.photos[2]));
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
    timestamp: data.timestamp || '',
    namaPic: namaPic || idKaryawan || '',
    bidangDivisi: bidangDivisi || '',
    nomorTelepon: data.nomorTelepon || data.noTelepon || data.telepon || '',
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
    fotoUrl: resolvedPhotoUrl,
    fotoUrl2: resolvedPhotoUrl2,
    fotoUrl3: resolvedPhotoUrl3,
    photos: [resolvedPhotoUrl, resolvedPhotoUrl2, resolvedPhotoUrl3].filter(Boolean),
    customResponses: data.customResponses || {}
  };
}

/**
 * Formats a clean, readable column header for dynamic custom fields.
 * E.g. "Nomor Telepon" -> "Nomor_Telepon"
 * @param {string} label 
 * @returns {string}
 */
function formatCustomFieldHeader(label) {
  if (!label) return 'Custom_Field';
  const clean = String(label).trim().replace(/[\s\-_/\\,]+/g, '_');
  return clean || 'Custom_Field';
}

/**
 * Returns the effective header list for operational reports:
 * 34 standard headers + any dynamic custom field headers.
 * @param {Array<Object>} customFields 
 * @returns {Array<string>}
 */
function getEffectiveOperationalHeaders(customFields) {
  const baseHeaders = OPERATIONAL_REPORT_FIELDS.map(f => f.header);
  if (!Array.isArray(customFields) || customFields.length === 0) {
    return baseHeaders;
  }
  const customHeaders = customFields.map(f => formatCustomFieldHeader(f.label));
  return baseHeaders.concat(customHeaders);
}

/**
 * Domain Entity: Admin Queue Row Item
 */
function QueueItem(data) {
  const normKendala = normalizeKendalaText(data.kendala);
  const p1 = extractStringUrl(data.photoUrl || data.fotoUrl);
  const p2 = extractStringUrl(data.photoUrl2 || data.fotoUrl2);
  const p3 = extractStringUrl(data.photoUrl3 || data.fotoUrl3);
  const photosList = Array.isArray(data.photos) && data.photos.length > 0
    ? data.photos.map(p => extractStringUrl(p)).filter(Boolean)
    : [p1, p2, p3].filter(Boolean);

  return {
    source: data.source || 'Laporan Operasional',
    reportId: data.reportId || '',
    kodeKegiatan: data.kodeKegiatan || '',
    timestamp: data.timestamp || '',
    namaPic: data.namaPic || data.empId || '',
    empId: data.empId || data.namaPic || '',
    divisi: data.divisi || data.site || '',
    nomorTelepon: data.nomorTelepon || '',
    lokasi: data.lokasi || '',
    jenisKegiatan: data.jenisKegiatan || data.jenis || '',
    ringkasan: data.ringkasan || data.detail || '',
    severity: data.severity || (normKendala ? ReportSeverity.URGENT : ReportSeverity.NORMAL),
    rank: data.rank || (normKendala ? SeverityRank.URGENT : SeverityRank.NORMAL),
    reviewStatus: normalizeReviewStatus(data.reviewStatus),
    photoUrl: p1,
    photoUrl2: p2,
    photoUrl3: p3,
    photos: photosList,
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

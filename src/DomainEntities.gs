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
 * - Manajemen (9 Orang) & Alprof (7 Orang): Bebas mengisi form langsung & dapat mewakili staf/rekan
 * - BKO 28 (2 Orang) & Pekerja Harian (8 Orang): Diwakili & dilaporkan melalui tim Manajemen
 * - SGA (12 Orang): Laporan wajib diisi oleh PIC resmi Ketut (SGA-01) atau Amas S (SGA-02)
 */
const EMPLOYEE_REGISTRY = Object.freeze([
  // Manajemen (9 Orang) — Bebas mengisi form langsung
  { id: 'MNJ-01', name: 'Sadmoko', division: 'Manajemen', isPic: true },
  { id: 'MNJ-02', name: 'Ariyana', division: 'Manajemen', isPic: true },
  { id: 'MNJ-03', name: 'Pupu F Fauzi', division: 'Manajemen', isPic: true },
  { id: 'MNJ-04', name: 'Martaty', division: 'Manajemen', isPic: true },
  { id: 'MNJ-05', name: 'Riska F', division: 'Manajemen', isPic: true },
  { id: 'MNJ-06', name: 'M Fauzan', division: 'Manajemen', isPic: true },
  { id: 'MNJ-07', name: 'Rasinta', division: 'Manajemen', isPic: true },
  { id: 'MNJ-08', name: 'Alamsyah', division: 'Manajemen', isPic: true },
  { id: 'MNJ-09', name: 'Devi Rosdiana', division: 'Manajemen', isPic: true },

  // BKO 28 (2 Orang) — Pelaporan via Alprof
  { id: 'BKO-01', name: 'Didi', division: 'BKO 28', isPic: false, delegatedTo: 'Alprof' },
  { id: 'BKO-02', name: 'Gultom', division: 'BKO 28', isPic: false, delegatedTo: 'Alprof' },

  // Pekerja Harian (8 Orang) — Pelaporan via Manajemen
  { id: 'PKH-01', name: 'Atang', division: 'Pekerja Harian', isPic: false, delegatedTo: 'Manajemen' },
  { id: 'PKH-02', name: 'Adim', division: 'Pekerja Harian', isPic: false, delegatedTo: 'Manajemen' },
  { id: 'PKH-03', name: 'Heru', division: 'Pekerja Harian', isPic: false, delegatedTo: 'Manajemen' },
  { id: 'PKH-04', name: 'Alok', division: 'Pekerja Harian', isPic: false, delegatedTo: 'Manajemen' },
  { id: 'PKH-05', name: 'Samid', division: 'Pekerja Harian', isPic: false, delegatedTo: 'Manajemen' },
  { id: 'PKH-06', name: 'Komarudin', division: 'Pekerja Harian', isPic: false, delegatedTo: 'Manajemen' },
  { id: 'PKH-07', name: 'Sanih', division: 'Pekerja Harian', isPic: false, delegatedTo: 'Manajemen' },
  { id: 'PKH-08', name: 'Ira', division: 'Pekerja Harian', isPic: false, delegatedTo: 'Manajemen' },

  // Alprof (7 Orang) — Bebas mengisi form langsung
  { id: 'ALP-01', name: 'Pasrep N', division: 'Alprof', isPic: true },
  { id: 'ALP-02', name: 'Andi Willy', division: 'Alprof', isPic: true },
  { id: 'ALP-03', name: 'Sugiyo', division: 'Alprof', isPic: true },
  { id: 'ALP-04', name: 'M Aris', division: 'Alprof', isPic: true },
  { id: 'ALP-05', name: 'Mursito', division: 'Alprof', isPic: true },
  { id: 'ALP-06', name: 'Jatniko', division: 'Alprof', isPic: true },
  { id: 'ALP-07', name: 'Mislan', division: 'Alprof', isPic: true },

  // SGA (12 Orang) — Pengisian form KHUSUS melalui PIC Ketut (SGA-01) & Amas S (SGA-02)
  { id: 'SGA-01', name: 'Ketut', division: 'SGA', isPic: true },
  { id: 'SGA-02', name: 'Amas S', division: 'SGA', isPic: true },
  { id: 'SGA-03', name: 'M Yusuf', division: 'SGA', isPic: false, delegatedTo: 'SGA PIC' },
  { id: 'SGA-04', name: 'Hasanudin', division: 'SGA', isPic: false, delegatedTo: 'SGA PIC' },
  { id: 'SGA-05', name: 'Roby Sandi', division: 'SGA', isPic: false, delegatedTo: 'SGA PIC' },
  { id: 'SGA-06', name: 'Rukman', division: 'SGA', isPic: false, delegatedTo: 'SGA PIC' },
  { id: 'SGA-07', name: 'Subandi', division: 'SGA', isPic: false, delegatedTo: 'SGA PIC' },
  { id: 'SGA-08', name: 'Suganda', division: 'SGA', isPic: false, delegatedTo: 'SGA PIC' },
  { id: 'SGA-09', name: 'Dede', division: 'SGA', isPic: false, delegatedTo: 'SGA PIC' },
  { id: 'SGA-10', name: 'Wafa', division: 'SGA', isPic: false, delegatedTo: 'SGA PIC' },
  { id: 'SGA-11', name: 'Rafi', division: 'SGA', isPic: false, delegatedTo: 'SGA PIC' },
  { id: 'SGA-12', name: 'Nur Iman', division: 'SGA', isPic: false, delegatedTo: 'SGA PIC' }
]);

/**
 * Checks if an employee ID is an authorized primary form submitter.
 * @param {string} empId 
 * @returns {boolean}
 */
function isAuthorizedFiller(empId) {
  if (!empId) return false;
  const clean = String(empId).trim().toUpperCase().replace(/[\s\-_]/g, '');
  if (clean.startsWith('MNJ') || clean.startsWith('ALP')) return true;
  return clean === 'SGA01' || clean === 'SGA02';
}

/**
 * Checks if an employee ID is an authorized SGA PIC.
 * @param {string} empId 
 * @returns {boolean}
 */
function isSgaPic(empId) {
  if (!empId) return false;
  const clean = String(empId).trim().toUpperCase().replace(/[\s\-_]/g, '');
  return clean === 'SGA01' || clean === 'SGA02';
}

/**
 * Checks if an employee ID is an SGA junior member (non-PIC).
 * @param {string} empId 
 * @returns {boolean}
 */
function isSgaJunior(empId) {
  if (!empId) return false;
  const clean = String(empId).trim().toUpperCase().replace(/[\s\-_]/g, '');
  return clean.startsWith('SGA') && clean !== 'SGA01' && clean !== 'SGA02';
}

/**
 * Checks if an employee ID is BKO 28 worker (delegated to Alprof).
 * @param {string} empId 
 * @returns {boolean}
 */
function isBkoSubordinate(empId) {
  if (!empId) return false;
  const clean = String(empId).trim().toUpperCase().replace(/[\s\-_]/g, '');
  return clean.startsWith('BKO');
}

/**
 * Checks if an employee ID is Pekerja Harian worker (delegated to Management).
 * @param {string} empId 
 * @returns {boolean}
 */
function isPkhSubordinate(empId) {
  if (!empId) return false;
  const clean = String(empId).trim().toUpperCase().replace(/[\s\-_]/g, '');
  return clean.startsWith('PKH');
}

/**
 * Checks if an employee ID is a subordinate/worker represented by Management (PKH) or legacy check.
 * @param {string} empId 
 * @returns {boolean}
 */
function isManagementSubordinate(empId) {
  return isPkhSubordinate(empId);
}

/**
 * Checks if an employee ID is a subordinate/worker represented by Alprof (BKO 28).
 * @param {string} empId 
 * @returns {boolean}
 */
function isAlprofSubordinate(empId) {
  return isBkoSubordinate(empId);
}

/**
 * Returns active employee registry, preferring customized script property if present,
 * falling back to default EMPLOYEE_REGISTRY.
 * @returns {Array<{ id: string, name: string, division: string, isPic?: boolean }>}
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
    list = EMPLOYEE_REGISTRY.map(e => ({ id: e.id, name: e.name, division: e.division, isPic: !!e.isPic }));
  }

  // Ensure isPic is always properly normalized based on ID rules:
  list = list.map(e => {
    const cleanId = String(e.id || '').toUpperCase().replace(/[\s\-_]/g, '');
    let isPic = true;
    if (cleanId.startsWith('SGA')) {
      isPic = (cleanId === 'SGA01' || cleanId === 'SGA02');
    } else if (cleanId.startsWith('BKO') || cleanId.startsWith('PKH')) {
      isPic = false;
    }
    return {
      id: e.id,
      name: e.name,
      division: e.division,
      isPic: isPic
    };
  });

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
 * Resolves composite or raw commodity strings into separated pure Tanam and Panen commodity names.
 * Handles strings like "Pisang (Tanam), Edamame (Panen)" -> { komoditasTanam: "Pisang", komoditasPanen: "Edamame" }
 * @param {string|any} rawKomoditas 
 * @param {string|any} [rawKomoditasPanen] 
 * @param {string|any} [jenisKegiatan] 
 * @returns {{ komoditasTanam: string, komoditasPanen: string }}
 */
function resolveSeparatedCommodities(rawKomoditas, rawKomoditasPanen, jenisKegiatan) {
  let tanam = '';
  let panen = '';

  const str = String(rawKomoditas || '').trim();
  const panenStr = String(rawKomoditasPanen || '').trim();
  const jk = String(jenisKegiatan || '').toLowerCase();

  // 1. Check for explicit (Tanam) and (Panen) markers in string
  const matchTanam = str.match(/([^(,]+?)\s*\(Tanam\)/i);
  const matchPanen = str.match(/([^(,]+?)\s*\(Panen\)/i);

  if (matchTanam) tanam = matchTanam[1].trim();
  if (matchPanen) panen = matchPanen[1].trim();

  // 2. If separate panenStr was provided
  if (panenStr && !panen) {
    panen = panenStr.replace(/\s*\(Panen\)/i, '').trim();
  }

  // 3. Resolve tanam if panen was populated but tanam is still empty and distinct str exists
  if (!tanam && str && str !== panen && !matchPanen) {
    tanam = str.replace(/\s*\(Tanam\)/i, '').trim();
  }

  // 4. If str is a single plain crop name without markers and no separate panenStr
  if (!tanam && !panen && str) {
    if ((jk.includes('tanam') || jk.includes('tebar')) && !jk.includes('panen')) {
      tanam = str;
      panen = '';
    } else if (jk.includes('panen') && !jk.includes('tanam') && !jk.includes('tebar')) {
      panen = str;
      tanam = '';
    } else {
      tanam = str;
      panen = str;
    }
  }

  return {
    komoditasTanam: tanam,
    komoditasPanen: panen
  };
}

/**
 * Domain Entity: Unified Operational Report (Kegiatan, Panen & Penjualan)
 */
const OPERATIONAL_REPORT_FIELDS = Object.freeze([
  { key: 'reportId', header: 'Report_ID', type: 'text', getValue: (r) => r.reportId || '' },
  { key: 'idKaryawan', header: 'ID_Karyawan', type: 'select', groupable: true, getValue: (r) => r.idKaryawan || r.empId || '' },
  { key: 'kodeKegiatan', header: 'Kode_Kegiatan', type: 'text', getValue: (r) => r.kodeKegiatan || '' },
  { key: 'timestamp', header: 'Timestamp', type: 'date', getValue: (r) => r.timestamp || '' },
  { key: 'namaPic', header: 'Nama_PIC', type: 'text', getValue: (r) => r.namaPic || '' },
  { key: 'bidangDivisi', header: 'Bidang_Divisi', type: 'select', groupable: true, getValue: (r) => r.bidangDivisi || '' },
  { key: 'nomorTelepon', header: 'Nomor_Telepon', type: 'text', getValue: (r) => typeof normalizePhoneNumber === 'function' ? normalizePhoneNumber(r.nomorTelepon || r.noTelepon || r.telepon || '') : String(r.nomorTelepon || r.noTelepon || r.telepon || '') },
  { key: 'lokasiKegiatan', header: 'Lokasi_Kegiatan', type: 'select', groupable: true, getValue: (r) => r.lokasiKegiatan || '' },
  { key: 'jenisKegiatan', header: 'Jenis_Kegiatan', type: 'select', groupable: true, getValue: (r) => r.jenisKegiatan || '' },
  { key: 'kegiatanTambahan', header: 'Kegiatan_Tambahan', type: 'text', getValue: (r) => r.kegiatanTambahan || '' },
  { key: 'pengawasan', header: 'Pengawasan', type: 'select', groupable: true, getValue: (r) => r.pengawasan ? (r.pengawasan + (r.detailPengawasan ? ` — ${r.detailPengawasan}` : '')) : '' },
  { key: 'pengawasanRincian', header: 'Pengawasan_Rincian', type: 'text', getValue: (r) => r.pengawasanRincian || r.detailPengawasan || '' },
  { key: 'administrasi', header: 'Administrasi', type: 'text', getValue: (r) => r.detailAdministrasi || r.administrasi || '' },
  { key: 'officeJenis', header: 'Office_Jenis', type: 'select', groupable: true, getValue: (r) => r.officeJenis || '' },
  { key: 'officeRincian', header: 'Office_Rincian', type: 'text', getValue: (r) => r.officeRincian || r.detailAdministrasi || '' },
  { key: 'statusPengelolaan', header: 'Status_Pengelolaan', type: 'select', groupable: true, getValue: (r) => r.statusPengelolaan || '' },
  { key: 'komoditas', header: 'Komoditas', type: 'select', groupable: true, getValue: (r) => r.komoditas || '' },
  { key: 'lokasiBlok', header: 'Lokasi_Blok_Tanam', type: 'text', getValue: (r) => r.lokasiBlok || r.lokasiBlokTanam || '' },
  { key: 'luasLahanM2', header: 'Luas_Lahan_M2', type: 'number', summable: true, getValue: (r) => r.luasLahanM2 || r.luasAreaHa || '' },
  { key: 'jumlahBenih', header: 'Jumlah_Benih', type: 'number', summable: true, getValue: (r) => r.jumlahBenih || '' },
  { key: 'tglTanam', header: 'Tgl_Tanam', type: 'date', getValue: (r) => r.tglTanam || '' },
  { key: 'estimasiPanenHst', header: 'Estimasi_Panen_HST', type: 'number', summable: true, getValue: (r) => r.estimasiPanenHst || r.tglPerkiraanPanen || '' },
  { key: 'populasiAgro', header: 'Populasi_Agro', type: 'number', summable: true, getValue: (r) => r.populasiAgro || 0 },
  { key: 'lokasiBlokPanen', header: 'Lokasi_Blok_Panen', type: 'text', getValue: (r) => r.lokasiBlokPanen || '' },
  { key: 'luasLahanPanenM2', header: 'Luas_Lahan_Panen_M2', type: 'number', summable: true, getValue: (r) => r.luasLahanPanenM2 || r.luasLahanPanen || '' },
  { key: 'tglPanen', header: 'Tgl_Panen', type: 'date', getValue: (r) => r.tglPanen || '' },
  { key: 'jumlahPanen', header: 'Jumlah_Panen_Kg', type: 'number', summable: true, getValue: (r) => r.jumlahPanen || '' },
  { key: 'tglPenjualan', header: 'Tgl_Penjualan', type: 'date', getValue: (r) => r.tglPenjualan || '' },
  { key: 'tujuanDistribusi', header: 'Tujuan_Distribusi', type: 'select', groupable: true, getValue: (r) => r.tujuanDistribusi || '' },
  { key: 'jumlahPenjualanUnit', header: 'Jumlah_Penjualan_Unit', type: 'number', summable: true, getValue: (r) => r.jumlahPenjualanUnit || '' },
  { key: 'hargaSatuanRp', header: 'Harga_Satuan_Rp', type: 'number', summable: true, getValue: (r) => r.hargaSatuanRp || r.hargaJual || '' },
  { key: 'totalHargaRp', header: 'Total_Harga_Rp', type: 'number', summable: true, getValue: (r) => r.totalHargaRp || r.nilaiPenjualanRp || '' },
  { key: 'pembeliNama', header: 'Pembeli_Nama', type: 'text', getValue: (r) => r.pembeliNama || '' },
  { key: 'pembeliAlamat', header: 'Pembeli_Alamat', type: 'text', getValue: (r) => r.pembeliAlamat || '' },
  { key: 'pembeliTelp', header: 'Pembeli_NoTelp', type: 'text', getValue: (r) => typeof normalizePhoneNumber === 'function' ? normalizePhoneNumber(r.pembeliTelp || '') : String(r.pembeliTelp || '') },
  { key: 'jenisTernak', header: 'Jenis_Ternak', type: 'select', groupable: true, getValue: (r) => r.jenisTernak || '' },
  { 
    key: 'ternakMasuk', 
    header: 'Ternak_Masuk', 
    type: 'select', 
    groupable: true, 
    getValue: (r) => {
      const qty = parseInt(r.ternakMasukQty, 10) || 0;
      let txt = String(r.ternakMasuk || '').trim();
      txt = txt.replace(/\s*\(\d+\s*ekor\)/gi, '').trim();
      const isNone = !txt || txt === '-' || txt.toLowerCase().startsWith('tidak ada') || txt.toLowerCase() === 'none' || txt.toLowerCase() === 'nihil';
      if (qty <= 0 && isNone) return 'Tidak Ada';
      if (qty > 0 && isNone) return `${qty} ekor`;
      if (qty > 0) return `${txt} (${qty} ekor)`;
      return txt || 'Tidak Ada';
    } 
  },
  { 
    key: 'ternakMasukJenis', 
    header: 'Ternak_Masuk_Jenis', 
    type: 'select', 
    getValue: (r) => {
      let txt = String(r.ternakMasukJenis || r.ternakMasuk || '').trim();
      txt = txt.replace(/\s*\(\d+\s*ekor\)/gi, '').trim();
      return txt || 'Tidak Ada';
    } 
  },
  { key: 'ternakMasukQty', header: 'Ternak_Masuk_Qty', type: 'number', summable: true, getValue: (r) => parseInt(r.ternakMasukQty, 10) || 0 },
  { 
    key: 'ternakKeluar', 
    header: 'Ternak_Keluar', 
    type: 'select', 
    groupable: true, 
    getValue: (r) => {
      const qty = parseInt(r.ternakKeluarQty, 10) || 0;
      let txt = String(r.ternakKeluar || '').trim();
      txt = txt.replace(/\s*\(\d+\s*ekor\)/gi, '').trim();
      const isNone = !txt || txt === '-' || txt.toLowerCase().startsWith('tidak ada') || txt.toLowerCase() === 'none' || txt.toLowerCase() === 'nihil';
      if (qty <= 0 && isNone) return 'Tidak Ada';
      if (qty > 0 && isNone) return `${qty} ekor`;
      if (qty > 0) return `${txt} (${qty} ekor)`;
      return txt || 'Tidak Ada';
    } 
  },
  { 
    key: 'ternakKeluarJenis', 
    header: 'Ternak_Keluar_Jenis', 
    type: 'select', 
    getValue: (r) => {
      let txt = String(r.ternakKeluarJenis || r.ternakKeluar || '').trim();
      txt = txt.replace(/\s*\(\d+\s*ekor\)/gi, '').trim();
      return txt || 'Tidak Ada';
    } 
  },
  { key: 'ternakKeluarQty', header: 'Ternak_Keluar_Qty', type: 'number', summable: true, getValue: (r) => parseInt(r.ternakKeluarQty, 10) || 0 },
  { key: 'populasiTernak', header: 'Populasi_Ternak', type: 'number', summable: true, getValue: (r) => r.populasiTernak || 0 },
  { key: 'pakanMasukKg', header: 'Pakan_Masuk_Kg', type: 'number', summable: true, getValue: (r) => r.pakanMasukKg || 0 },
  { key: 'pakanKeluarKg', header: 'Pakan_Keluar_Kg', type: 'number', summable: true, getValue: (r) => r.pakanKeluarKg || 0 },
  { key: 'jenisKomoditasTernak', header: 'Jenis_Komoditas_Ternak', type: 'select', groupable: true, getValue: (r) => r.jenisKomoditasTernak || '' },
  { key: 'jumlahPenjualanTernak', header: 'Jumlah_Penjualan_Ternak', type: 'number', summable: true, getValue: (r) => r.jumlahPenjualanTernak || 0 },
  { key: 'hargaSatuanTernakRp', header: 'Harga_Satuan_Ternak_Rp', type: 'number', summable: true, getValue: (r) => r.hargaSatuanTernakRp || 0 },
  { key: 'totalHargaTernakRp', header: 'Total_Harga_Ternak_Rp', type: 'number', summable: true, getValue: (r) => r.totalHargaTernakRp || 0 },
  { key: 'pembeliTernakNama', header: 'Pembeli_Ternak_Nama', type: 'text', getValue: (r) => r.pembeliTernakNama || r.pembeliNama || '' },
  { key: 'pembeliTernakAlamat', header: 'Pembeli_Ternak_Alamat', type: 'text', getValue: (r) => r.pembeliTernakAlamat || r.pembeliAlamat || '' },
  { key: 'pembeliTernakTelp', header: 'Pembeli_Ternak_NoTelp', type: 'text', getValue: (r) => typeof normalizePhoneNumber === 'function' ? normalizePhoneNumber(r.pembeliTernakTelp || r.pembeliTelp || '') : String(r.pembeliTernakTelp || r.pembeliTelp || '') },
  { key: 'jumlahUnitPenggunaan', header: 'Jumlah_Unit_Penggunaan', type: 'number', summable: true, getValue: (r) => r.jumlahUnitPenggunaan || '' },
  { key: 'tujuanPenggunaan', header: 'Tujuan_Penggunaan', type: 'select', groupable: true, getValue: (r) => r.tujuanPenggunaan || '' },
  { key: 'capaianKegiatan', header: 'Capaian_Kegiatan', type: 'text', getValue: (r) => r.capaianKegiatan || '' },
  { key: 'anggotaTerlapor', header: 'Anggota_Terlapor', type: 'text', getValue: (r) => r.anggotaTerlaporText || (Array.isArray(r.anggotaTerlapor) ? r.anggotaTerlapor.map(a => `${a.name || a.id} (${a.id}): ${a.deskripsi || '-'}`).join('; ') : (r.anggotaTerlapor || '')) },
  { key: 'kendala', header: 'Kendala', type: 'text', getValue: (r) => r.kendala || '' },
  { key: 'upaya', header: 'Upaya', type: 'text', getValue: (r) => r.upaya || '' },
  { key: 'fotoUrl', header: 'Foto_URL', type: 'url', getValue: (r) => extractStringUrl(r.fotoUrl || r.photoUrl || (Array.isArray(r.photos) && r.photos[0])) },
  { key: 'fotoUrl2', header: 'Foto_URL_2', type: 'url', getValue: (r) => extractStringUrl(r.fotoUrl2 || r.photoUrl2 || (Array.isArray(r.photos) && r.photos[1])) },
  { key: 'fotoUrl3', header: 'Foto_URL_3', type: 'url', getValue: (r) => extractStringUrl(r.fotoUrl3 || r.photoUrl3 || (Array.isArray(r.photos) && r.photos[2])) },
  { key: 'severity', header: 'Severity', type: 'select', groupable: true, getValue: (r, f) => (f && f.severity) ? f.severity : ReportSeverity.NORMAL },
  { key: 'reviewed', header: 'Reviewed', type: 'select', groupable: true, getValue: () => ReviewStatus.UNREVIEWED }
]);

function OperationalReport(data) {
  const resolvedPhotoUrl = extractStringUrl(data.fotoUrl || data.photoUrl || (Array.isArray(data.photos) && data.photos[0]));
  const resolvedPhotoUrl2 = extractStringUrl(data.fotoUrl2 || data.photoUrl2 || (Array.isArray(data.photos) && data.photos[1]));
  const resolvedPhotoUrl3 = extractStringUrl(data.fotoUrl3 || data.photoUrl3 || (Array.isArray(data.photos) && data.photos[2]));
  let idKaryawan = data.idKaryawan || data.empId || '';
  let namaPic = data.namaPic || '';
  let bidangDivisi = data.bidangDivisi || data.site || '';

  // Auto-resolve from registry if ID or name is provided
  if (typeof ConfigRepository !== 'undefined' && ConfigRepository.getEmployee) {
    const emp = ConfigRepository.getEmployee(idKaryawan || namaPic);
    if (emp) {
      idKaryawan = emp.id;
      namaPic = emp.name;
      bidangDivisi = bidangDivisi || emp.division;
    }
  } else if (idKaryawan && (!namaPic || !bidangDivisi)) {
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

  let anggotaTerlapor = [];
  if (Array.isArray(data.anggotaTerlapor)) {
    anggotaTerlapor = data.anggotaTerlapor;
  } else if (typeof data.anggotaTerlapor === 'string' && data.anggotaTerlapor.trim()) {
    try {
      const parsed = JSON.parse(data.anggotaTerlapor);
      if (Array.isArray(parsed)) anggotaTerlapor = parsed;
    } catch(e) {
      anggotaTerlapor = data.anggotaTerlapor;
    }
  }

  const anggotaTerlaporText = Array.isArray(anggotaTerlapor)
    ? anggotaTerlapor.map(a => `${a.name || a.id} (${a.id}): ${a.deskripsi || '-'}`).join('; ')
    : String(anggotaTerlapor || data.anggotaTerlaporText || '');

  return {
    reportId: data.reportId || '',
    idKaryawan: idKaryawan,
    empId: idKaryawan,
    kodeKegiatan: data.kodeKegiatan || '',
    timestamp: data.timestamp || '',
    namaPic: namaPic || idKaryawan || '',
    bidangDivisi: bidangDivisi || '',
    nomorTelepon: typeof normalizePhoneNumber === 'function' ? normalizePhoneNumber(data.nomorTelepon || data.noTelepon || data.telepon || '') : (data.nomorTelepon || data.noTelepon || data.telepon || ''),
    lokasiKegiatan: data.lokasiKegiatan || '',
    jenisKegiatan: data.jenisKegiatan || '',
    kegiatanTambahan: Array.isArray(data.kegiatanTambahan) ? data.kegiatanTambahan.join(', ') : (data.kegiatanTambahan || ''),
    pengawasan: data.pengawasan || '',
    detailPengawasan: data.detailPengawasan || data.pengawasanRincian || '',
    pengawasanRincian: data.pengawasanRincian || data.detailPengawasan || '',
    administrasi: data.administrasi || data.detailAdministrasi || data.officeRincian || '',
    detailAdministrasi: data.detailAdministrasi || data.administrasi || data.officeRincian || '',
    officeJenis: data.officeJenis || '',
    officeRincian: data.officeRincian || data.detailAdministrasi || '',
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
    lokasiBlok: data.lokasiBlok || data.lokasiBlokTanam || '',
    lokasiBlokPanen: data.lokasiBlokPanen || '',
    luasLahanM2: parseFloat(data.luasLahanM2) || 0,
    luasLahanPanenM2: parseFloat(data.luasLahanPanenM2) || 0,
    jumlahBenih: parseFloat(data.jumlahBenih) || 0,
    tglTanam: data.tglTanam || '',
    estimasiPanenHst: parseFloat(data.estimasiPanenHst) || 0,
    populasiAgro: parseFloat(data.populasiAgro) || parseFloat(data.populasi) || 0,
    tglPanen: data.tglPanen || '',
    jumlahPanen: parseFloat(data.jumlahPanen) || 0,
    tglPenjualan: data.tglPenjualan || '',
    hargaJual: parseFloat(data.hargaJual) || 0,
    jumlahPenjualanUnit: parseFloat(data.jumlahPenjualanUnit) || 0,
    nilaiPenjualanRp: parseFloat(data.nilaiPenjualanRp) || parseFloat(data.totalHargaRp) || 0,
    tujuanDistribusi: Array.isArray(data.tujuanDistribusi) ? data.tujuanDistribusi.join(', ') : (data.tujuanDistribusi || ''),
    hargaSatuanRp: parseFloat(data.hargaSatuanRp) || 0,
    totalHargaRp: parseFloat(data.totalHargaRp) || 0,
    pembeliNama: data.pembeliNama || '',
    pembeliAlamat: data.pembeliAlamat || '',
    pembeliTelp: typeof normalizePhoneNumber === 'function' ? normalizePhoneNumber(data.pembeliTelp || '') : (data.pembeliTelp || ''),
    jenisTernak: data.jenisTernak || '',
    ternakMasuk: data.ternakMasuk || '',
    ternakMasukJenis: data.ternakMasukJenis || data.ternakMasuk || '',
    ternakMasukQty: parseFloat(data.ternakMasukQty) || 0,
    ternakKeluar: data.ternakKeluar || '',
    ternakKeluarJenis: data.ternakKeluarJenis || data.ternakKeluar || '',
    ternakKeluarQty: parseFloat(data.ternakKeluarQty) || 0,
    populasiTernak: parseFloat(data.populasiTernak) || 0,
    pakanMasukKg: parseFloat(data.pakanMasukKg) || 0,
    pakanKeluarKg: parseFloat(data.pakanKeluarKg) || 0,
    jenisKomoditasTernak: data.jenisKomoditasTernak || '',
    jumlahPenjualanTernak: parseFloat(data.jumlahPenjualanTernak) || 0,
    hargaSatuanTernakRp: parseFloat(data.hargaSatuanTernakRp) || 0,
    totalHargaTernakRp: parseFloat(data.totalHargaTernakRp) || 0,
    pembeliTernakNama: data.pembeliTernakNama || data.pembeliNama || '',
    pembeliTernakAlamat: data.pembeliTernakAlamat || data.pembeliAlamat || '',
    pembeliTernakTelp: typeof normalizePhoneNumber === 'function' ? normalizePhoneNumber(data.pembeliTernakTelp || data.pembeliTelp || '') : (data.pembeliTernakTelp || data.pembeliTelp || ''),
    jumlahUnitPenggunaan: parseFloat(data.jumlahUnitPenggunaan) || 0,
    tujuanPenggunaan: Array.isArray(data.tujuanPenggunaan) ? data.tujuanPenggunaan.join(', ') : (data.tujuanPenggunaan || ''),
    capaianKegiatan: data.capaianKegiatan || '',
    anggotaTerlapor: anggotaTerlapor,
    anggotaTerlaporText: anggotaTerlaporText,
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
 * standard headers + any dynamic custom field headers.
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

  let anggotaTerlapor = [];
  if (Array.isArray(data.anggotaTerlapor)) {
    anggotaTerlapor = data.anggotaTerlapor;
  } else if (typeof data.anggotaTerlapor === 'string' && data.anggotaTerlapor.trim()) {
    try {
      const parsed = JSON.parse(data.anggotaTerlapor);
      if (Array.isArray(parsed)) anggotaTerlapor = parsed;
    } catch(e) {
      anggotaTerlapor = data.anggotaTerlapor;
    }
  }

  const anggotaTerlaporText = Array.isArray(anggotaTerlapor)
    ? anggotaTerlapor.map(a => `${a.name || a.id} (${a.id}): ${a.deskripsi || '-'}`).join('; ')
    : String(anggotaTerlapor || data.anggotaTerlaporText || '');

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
    anggotaTerlapor: anggotaTerlapor,
    anggotaTerlaporText: anggotaTerlaporText,
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

/**
 * Domain Entity: User Roles & Access Management
 */
const USER_ROLES = Object.freeze({
  ADMIN: 'admin',
  MANAGER: 'manager',
  SUPERADMIN: 'both'
});

function UserRoleItem(data) {
  const rawRole = String(data.role || USER_ROLES.ADMIN).trim().toLowerCase();
  let role = USER_ROLES.ADMIN;
  if (rawRole === 'manager') role = USER_ROLES.MANAGER;
  else if (rawRole === 'both' || rawRole === 'superadmin' || rawRole === 'admin & manager') role = USER_ROLES.SUPERADMIN;

  return {
    email: String(data.email || '').trim().toLowerCase(),
    role: role,
    terakhirAktif: data.terakhirAktif ? String(data.terakhirAktif).trim() : '',
    addedBy: String(data.addedBy || 'Admin').trim(),
    addedAt: data.addedAt ? String(data.addedAt) : (new Date()).toISOString().split('T')[0]
  };
}

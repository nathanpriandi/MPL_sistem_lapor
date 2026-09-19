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
 * - BKO 28 (2 Orang) & Pekerja Harian (8 Orang): Diwakili & dilaporkan melalui tim Manajemen / Alprof
 * - SGA (12 Orang): Laporan wajib diisi oleh PIC resmi Wayan Darmawan (SGA-01) atau Made Suardika (SGA-02)
 */
const EMPLOYEE_REGISTRY = Object.freeze([
  // Manajemen Operasional (9 Orang) — Bebas mengisi form langsung
  { id: 'MNJ-01', name: 'Hendra Gunawan', division: 'Manajemen', isPic: true },
  { id: 'MNJ-02', name: 'Budi Pratama', division: 'Manajemen', isPic: true },
  { id: 'MNJ-03', name: 'Siti Rahmawati', division: 'Manajemen', isPic: true },
  { id: 'MNJ-04', name: 'Eko Wahyudi', division: 'Manajemen', isPic: true },
  { id: 'MNJ-05', name: 'Dewi Lestari', division: 'Manajemen', isPic: true },
  { id: 'MNJ-06', name: 'Agus Setiawan', division: 'Manajemen', isPic: true },
  { id: 'MNJ-07', name: 'Maya Anggraini', division: 'Manajemen', isPic: true },
  { id: 'MNJ-08', name: 'Rizky Hidayat', division: 'Manajemen', isPic: true },
  { id: 'MNJ-09', name: 'Anita Kusuma', division: 'Manajemen', isPic: true },

  // Keamanan Lapangan / BKO 28 (2 Orang) — Pelaporan via Alprof
  { id: 'BKO-01', name: 'Bambang Wijaya', division: 'BKO 28', isPic: false, delegatedTo: 'Alprof' },
  { id: 'BKO-02', name: 'Surya Saputra', division: 'BKO 28', isPic: false, delegatedTo: 'Alprof' },

  // Tenaga Kerja Harian (8 Orang) — Pelaporan via Manajemen
  { id: 'PKH-01', name: 'Joko Susilo', division: 'Pekerja Harian', isPic: false, delegatedTo: 'Manajemen' },
  { id: 'PKH-02', name: 'Wahyu Utomo', division: 'Pekerja Harian', isPic: false, delegatedTo: 'Manajemen' },
  { id: 'PKH-03', name: 'Tono Darsono', division: 'Pekerja Harian', isPic: false, delegatedTo: 'Manajemen' },
  { id: 'PKH-04', name: 'Asep Saepudin', division: 'Pekerja Harian', isPic: false, delegatedTo: 'Manajemen' },
  { id: 'PKH-05', name: 'Ujang Suherman', division: 'Pekerja Harian', isPic: false, delegatedTo: 'Manajemen' },
  { id: 'PKH-06', name: 'Rohman Hakim', division: 'Pekerja Harian', isPic: false, delegatedTo: 'Manajemen' },
  { id: 'PKH-07', name: 'Slamet Riyadi', division: 'Pekerja Harian', isPic: false, delegatedTo: 'Manajemen' },
  { id: 'PKH-08', name: 'Yanto Wardoyo', division: 'Pekerja Harian', isPic: false, delegatedTo: 'Manajemen' },

  // Staf Teknis / Alprof (7 Orang) — Bebas mengisi form langsung
  { id: 'ALP-01', name: 'Fajar Nugraha', division: 'Alprof', isPic: true },
  { id: 'ALP-02', name: 'Dian Permana', division: 'Alprof', isPic: true },
  { id: 'ALP-03', name: 'Tri Cahyono', division: 'Alprof', isPic: true },
  { id: 'ALP-04', name: 'Bayu Firmansyah', division: 'Alprof', isPic: true },
  { id: 'ALP-05', name: 'Ilham Maulana', division: 'Alprof', isPic: true },
  { id: 'ALP-06', name: 'Danang Prasetyo', division: 'Alprof', isPic: true },
  { id: 'ALP-07', name: 'Rahmat Hidayatullah', division: 'Alprof', isPic: true },

  // Tim Budidaya Lapangan / SGA (12 Orang) — Pengisian form KHUSUS melalui PIC Wayan Darmawan (SGA-01) & Made Suardika (SGA-02)
  { id: 'SGA-01', name: 'Wayan Darmawan', division: 'SGA', role: 'PIC SGA', isPic: true },
  { id: 'SGA-02', name: 'Made Suardika', division: 'SGA', role: 'PIC SGA', isPic: true },
  { id: 'SGA-03', name: 'Agung Wicaksono', division: 'SGA', role: 'SGA', isPic: false, delegatedTo: 'SGA PIC' },
  { id: 'SGA-04', name: 'Galih Pramono', division: 'SGA', role: 'SGA', isPic: false, delegatedTo: 'SGA PIC' },
  { id: 'SGA-05', name: 'Dimas Kurniawan', division: 'SGA', role: 'SGA', isPic: false, delegatedTo: 'SGA PIC' },
  { id: 'SGA-06', name: 'Bagus Pangestu', division: 'SGA', role: 'SGA', isPic: false, delegatedTo: 'SGA PIC' },
  { id: 'SGA-07', name: 'Arif Budiman', division: 'SGA', role: 'SGA', isPic: false, delegatedTo: 'SGA PIC' },
  { id: 'SGA-08', name: 'Indra Lesmana', division: 'SGA', role: 'SGA', isPic: false, delegatedTo: 'SGA PIC' },
  { id: 'SGA-09', name: 'Yoga Pratama', division: 'SGA', role: 'SGA', isPic: false, delegatedTo: 'SGA PIC' },
  { id: 'SGA-10', name: 'Faisal Rahman', division: 'SGA', role: 'SGA', isPic: false, delegatedTo: 'SGA PIC' },
  { id: 'SGA-11', name: 'Gilang Ramadhan', division: 'SGA', role: 'SGA', isPic: false, delegatedTo: 'SGA PIC' },
  { id: 'SGA-12', name: 'Doni Hendrawan', division: 'SGA', role: 'SGA', isPic: false, delegatedTo: 'SGA PIC' }
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
 * Pure Domain facade: Returns active employee registry.
 * Delegates to EmployeeService if available, or defaults to static EMPLOYEE_REGISTRY.
 * @returns {Array<{ id: string, name: string, division: string, role?: string, isPic?: boolean }>}
 */
function getActiveEmployeeRegistry() {
  if (typeof EmployeeService !== 'undefined' && EmployeeService.getActiveRegistry) {
    return EmployeeService.getActiveRegistry();
  }
  return EMPLOYEE_REGISTRY.map(e => ({
    id: e.id,
    name: e.name,
    division: e.division,
    role: e.role || e.division,
    isPic: !!e.isPic,
    delegatedTo: e.delegatedTo || ''
  }));
}

/**
 * Searches employee by ID or Name.
 * Delegates to EmployeeService if available, or performs pure in-memory lookup.
 * @param {string} query
 * @returns {{ id: string, name: string, division: string, status?: string }|null}
 */
function lookupEmployee(query) {
  if (typeof EmployeeService !== 'undefined' && EmployeeService.lookupEmployee) {
    return EmployeeService.lookupEmployee(query);
  }
  if (!query) return null;
  const rawQ = String(query).trim().toLowerCase();
  const cleanQ = rawQ.replace(/[\s\-_]/g, '');
  const idMatch = EMPLOYEE_REGISTRY.find(e => {
    const c = String(e.id || '').toLowerCase().replace(/[\s\-_]/g, '');
    return c === cleanQ || String(e.id || '').toLowerCase() === rawQ;
  });
  if (idMatch) return Object.assign({}, idMatch);
  const nameMatch = EMPLOYEE_REGISTRY.find(e => String(e.name || '').toLowerCase() === rawQ);
  if (nameMatch) return Object.assign({}, nameMatch);
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
  { key: 'komoditas', header: 'Komoditas', type: 'select', groupable: true, getValue: (r) => r.komoditas || r.komoditasPanen || '' },
  { key: 'lokasiBlok', header: 'Lokasi_Blok_Tanam', type: 'text', getValue: (r) => r.lokasiBlok || r.lokasiBlokTanam || '' },
  { key: 'luasLahanM2', header: 'Luas_Lahan_M2', type: 'number', summable: true, getValue: (r) => r.luasLahanM2 || r.luasAreaHa || '' },
  { key: 'jumlahBenih', header: 'Jumlah_Benih', type: 'number', summable: true, getValue: (r) => r.jumlahBenih || '' },
  { key: 'tglTanam', header: 'Tgl_Tanam', type: 'date', getValue: (r) => r.tglTanam || '' },
  { key: 'estimasiPanenHst', header: 'Estimasi_Panen_HST', type: 'number', summable: true, getValue: (r) => r.estimasiPanenHst || r.tglPerkiraanPanen || '' },
  { key: 'populasiAgro', header: 'Populasi_Agro', type: 'number', summable: true, getValue: (r) => r.populasiAgro || 0 },
  { key: 'rincianPerawatanAgro', header: 'Rincian_Perawatan_Agro', type: 'text', getValue: (r) => r.rincianPerawatanAgro || '' },
  { key: 'lokasiBlokPanen', header: 'Lokasi_Blok_Panen', type: 'text', getValue: (r) => r.lokasiBlokPanen || '' },
  { key: 'luasLahanPanenM2', header: 'Luas_Lahan_Panen_M2', type: 'number', summable: true, getValue: (r) => r.luasLahanPanenM2 || r.luasLahanPanen || '' },
  { key: 'tglPanen', header: 'Tgl_Panen', type: 'date', getValue: (r) => r.tglPanen || '' },
  { key: 'jumlahPanen', header: 'Jumlah_Panen_Kg', type: 'number', summable: true, getValue: (r) => (r.jumlahPanen !== undefined && r.jumlahPanen !== '') ? r.jumlahPanen : (r.jumlahPanenKg !== undefined ? r.jumlahPanenKg : '') },
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
  { key: 'ternakMasukKelahiranQty', header: 'Ternak_Masuk_Kelahiran_Qty', type: 'number', summable: true, getValue: (r) => parseFloat(r.ternakMasukKelahiranQty) || 0 },
  { key: 'ternakMasukPembelianQty', header: 'Ternak_Masuk_Pembelian_Qty', type: 'number', summable: true, getValue: (r) => parseFloat(r.ternakMasukPembelianQty) || 0 },
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
  { key: 'ternakKeluarKematianQty', header: 'Ternak_Keluar_Kematian_Qty', type: 'number', summable: true, getValue: (r) => parseFloat(r.ternakKeluarKematianQty) || 0 },
  { key: 'ternakKeluarPenjualanQty', header: 'Ternak_Keluar_Penjualan_Qty', type: 'number', summable: true, getValue: (r) => parseFloat(r.ternakKeluarPenjualanQty) || 0 },
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
  if (typeof lookupEmployee === 'function') {
    const emp = lookupEmployee(idKaryawan || namaPic);
    if (emp) {
      idKaryawan = emp.id;
      namaPic = namaPic || emp.name;
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
    rincianPerawatanAgro: data.rincianPerawatanAgro || '',
    tglPanen: data.tglPanen || '',
    jumlahPanen: parseFloat(data.jumlahPanen) || parseFloat(data.jumlahPanenKg) || 0,
    tglPenjualan: data.tglPenjualan || '',
    hargaJual: parseFloat(data.hargaJual) || 0,
    jumlahPenjualanUnit: parseFloat(data.jumlahPenjualanUnit) || 0,
    nilaiPenjualanRp: parseFloat(data.nilaiPenjualanRp) || parseFloat(data.totalHargaRp) || 0,
    tujuanDistribusi: Array.isArray(data.tujuanDistribusi) ? data.tujuanDistribusi.join(', ') : (data.tujuanDistribusi || ''),
    hargaSatuanRp: parseFloat(data.hargaSatuanRp) || 0,
    totalHargaRp: parseFloat(data.totalHargaRp) || 0,
    pembeliNama: data.pembeliNama || '',
    pembeliAlamat: data.pembeliAlamat || '',
    pembeliTelp: typeof normalizePhoneNumber === 'function' ? normalizePhoneNumber(data.pembeliTelp || data.pembeliNoTelp || '') : (data.pembeliTelp || data.pembeliNoTelp || ''),
    jenisTernak: data.jenisTernak || '',
    ternakMasuk: data.ternakMasuk || '',
    ternakMasukJenis: data.ternakMasukJenis || data.ternakMasuk || '',
    ternakMasukKelahiranQty: parseFloat(data.ternakMasukKelahiranQty) || 0,
    ternakMasukPembelianQty: parseFloat(data.ternakMasukPembelianQty) || 0,
    ternakMasukQty: (() => {
      const explicit = parseFloat(data.ternakMasukQty);
      if (!isNaN(explicit) && explicit > 0) return explicit;
      const k = parseFloat(data.ternakMasukKelahiranQty) || 0;
      const p = parseFloat(data.ternakMasukPembelianQty) || 0;
      return (k + p) || (isNaN(explicit) ? 0 : explicit);
    })(),
    ternakKeluar: data.ternakKeluar || '',
    ternakKeluarJenis: data.ternakKeluarJenis || data.ternakKeluar || '',
    ternakKeluarKematianQty: parseFloat(data.ternakKeluarKematianQty) || 0,
    ternakKeluarPenjualanQty: parseFloat(data.ternakKeluarPenjualanQty) || 0,
    ternakKeluarQty: (() => {
      const explicit = parseFloat(data.ternakKeluarQty);
      if (!isNaN(explicit) && explicit > 0) return explicit;
      const d = parseFloat(data.ternakKeluarKematianQty) || 0;
      const s = parseFloat(data.ternakKeluarPenjualanQty) || 0;
      return (d + s) || (isNaN(explicit) ? 0 : explicit);
    })(),
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

/**
 * =========================================================================
 * CANONICAL ANALYTICS FIELD CATALOG
 * Defines all searchable dimensions, filterable attributes, aggregatable
 * measures, units, operators, and metadata across Agro, Ternak, Office, etc.
 * =========================================================================
 */
const ANALYTICS_FIELD_CATALOG = Object.freeze([
  // --- KONTEKS & IDENTITAS UMUM ---
  {
    key: 'idKaryawan',
    label: 'ID Karyawan',
    type: 'select',
    unit: '',
    module: 'Umum',
    roles: ['dimension', 'filter', 'sort'],
    operators: ['eq', 'neq', 'in', 'contains'],
    format: 'text'
  },
  {
    key: 'namaPic',
    label: 'Nama PIC / Karyawan',
    type: 'select',
    unit: '',
    module: 'Umum',
    roles: ['dimension', 'filter', 'sort'],
    operators: ['eq', 'neq', 'in', 'contains'],
    format: 'text'
  },
  {
    key: 'bidangDivisi',
    label: 'Bidang / Divisi',
    type: 'select',
    unit: '',
    module: 'Umum',
    roles: ['dimension', 'filter', 'sort'],
    options: ['Manajemen', 'Agro', 'Peternakan', 'Alprof', 'BKO 28', 'Pekerja Harian'],
    operators: ['eq', 'neq', 'in'],
    format: 'text'
  },
  {
    key: 'lokasiKegiatan',
    label: 'Lokasi / Sektor',
    type: 'select',
    unit: '',
    module: 'Umum',
    roles: ['dimension', 'filter', 'sort'],
    options: ['Jonggol', 'Cikalong', 'Quilling', 'Jakarta'],
    operators: ['eq', 'neq', 'in'],
    format: 'text'
  },
  {
    key: 'jenisKegiatan',
    label: 'Jenis Kegiatan Utama',
    type: 'select',
    unit: '',
    module: 'Umum',
    roles: ['dimension', 'filter', 'sort'],
    options: ['Agro', 'Ternak', 'Office', 'Pengawasan'],
    operators: ['eq', 'neq', 'in'],
    format: 'text'
  },
  {
    key: 'timestamp',
    label: 'Waktu Laporan',
    type: 'date',
    unit: '',
    module: 'Umum',
    roles: ['filter', 'sort'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'date'
  },
  {
    key: 'kodeKegiatan',
    label: 'Kode Kegiatan',
    type: 'string',
    unit: '',
    module: 'Umum',
    roles: ['filter', 'sort'],
    operators: ['eq', 'contains'],
    format: 'text'
  },
  {
    key: 'severity',
    label: 'Status Urgensi (Triage)',
    type: 'select',
    unit: '',
    module: 'Umum',
    roles: ['dimension', 'filter', 'sort'],
    options: ['urgent', 'normal'],
    operators: ['eq', 'neq', 'in'],
    format: 'text'
  },
  {
    key: 'reviewed',
    label: 'Status Verifikasi',
    type: 'select',
    unit: '',
    module: 'Umum',
    roles: ['dimension', 'filter', 'sort'],
    options: ['Belum Terverifikasi', 'Terverifikasi'],
    operators: ['eq', 'neq', 'in'],
    format: 'text'
  },

  // --- MODUL AGRO: TANAM, PERAWATAN, PANEN & DISTRIBUSI ---
  {
    key: 'komoditas',
    label: 'Komoditas Agro',
    type: 'select',
    unit: '',
    module: 'Agro',
    roles: ['dimension', 'filter', 'sort'],
    options: ['Alpukat', 'Pisang', 'Jagung Manis', 'Terong', 'Cabe', 'Jagung Tebon', 'Jagung Hibrida', 'Edamame', 'Pembibitan Kopi', 'Pembibitan Pala'],
    operators: ['eq', 'neq', 'in', 'contains'],
    format: 'text'
  },
  {
    key: 'statusPengelolaan',
    label: 'Status Pengelolaan Agro',
    type: 'select',
    unit: '',
    module: 'Agro',
    roles: ['dimension', 'filter', 'sort'],
    options: ['Swakelola', 'Petani binaan', 'Kemitraan'],
    operators: ['eq', 'neq', 'in'],
    format: 'text'
  },
  {
    key: 'lokasiBlok',
    label: 'Blok Lahan Tanam',
    type: 'string',
    unit: '',
    module: 'Agro',
    roles: ['dimension', 'filter', 'sort'],
    operators: ['eq', 'neq', 'in', 'contains'],
    format: 'text'
  },
  {
    key: 'luasLahanM2',
    label: 'Luas Lahan Tanam',
    type: 'number',
    unit: 'm²',
    module: 'Agro',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['sum', 'avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'decimal'
  },
  {
    key: 'jumlahBenih',
    label: 'Populasi Benih Tanam',
    type: 'number',
    unit: 'benih',
    module: 'Agro',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['sum', 'avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'integer'
  },
  {
    key: 'tglTanam',
    label: 'Tanggal Tanam',
    type: 'date',
    unit: '',
    module: 'Agro',
    roles: ['filter', 'sort'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'date'
  },
  {
    key: 'estimasiPanenHst',
    label: 'Estimasi Panen HST',
    type: 'number',
    unit: 'HST',
    module: 'Agro',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'integer'
  },
  {
    key: 'populasiAgro',
    label: 'Populasi Tanaman Aktif',
    type: 'number',
    unit: 'tanaman',
    module: 'Agro',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['sum', 'avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'integer'
  },
  {
    key: 'rincianPerawatanAgro',
    label: 'Rincian Perawatan Agro',
    type: 'string',
    unit: '',
    module: 'Agro',
    roles: ['filter', 'sort'],
    operators: ['eq', 'neq', 'contains'],
    format: 'text'
  },
  {
    key: 'lokasiBlokPanen',
    label: 'Blok Panen',
    type: 'string',
    unit: '',
    module: 'Agro',
    roles: ['dimension', 'filter', 'sort'],
    operators: ['eq', 'neq', 'in', 'contains'],
    format: 'text'
  },
  {
    key: 'luasLahanPanenM2',
    label: 'Luas Lahan Panen',
    type: 'number',
    unit: 'm²',
    module: 'Agro',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['sum', 'avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'decimal'
  },
  {
    key: 'tglPanen',
    label: 'Tanggal Panen',
    type: 'date',
    unit: '',
    module: 'Agro',
    roles: ['filter', 'sort'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'date'
  },
  {
    key: 'jumlahPanen',
    label: 'Hasil Panen Agro',
    type: 'number',
    unit: 'kg',
    module: 'Agro',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['sum', 'avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'decimal'
  },
  {
    key: 'tglPenjualan',
    label: 'Tanggal Penjualan Agro',
    type: 'date',
    unit: '',
    module: 'Agro',
    roles: ['filter', 'sort'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'date'
  },
  {
    key: 'tujuanDistribusi',
    label: 'Tujuan Distribusi Agro',
    type: 'multiselect',
    unit: '',
    module: 'Agro',
    roles: ['dimension', 'filter', 'sort'],
    options: ['Penjualan', 'Penggunaan Internal'],
    operators: ['eq', 'neq', 'in', 'contains'],
    format: 'text'
  },
  {
    key: 'jumlahPenjualanUnit',
    label: 'Volume Penjualan Agro',
    type: 'number',
    unit: 'unit',
    module: 'Agro',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['sum', 'avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'decimal'
  },
  {
    key: 'hargaSatuanRp',
    label: 'Harga Satuan Agro',
    type: 'number',
    unit: 'Rp/unit',
    module: 'Agro',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'currency'
  },
  {
    key: 'totalHargaRp',
    label: 'Nilai Penjualan Agro',
    type: 'number',
    unit: 'Rp',
    module: 'Agro',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['sum', 'avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'currency'
  },
  {
    key: 'jumlahUnitPenggunaan',
    label: 'Volume Penggunaan Internal Agro',
    type: 'number',
    unit: 'unit',
    module: 'Agro',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['sum', 'avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'decimal'
  },
  {
    key: 'tujuanPenggunaan',
    label: 'Lokasi Penggunaan Internal',
    type: 'multiselect',
    unit: '',
    module: 'Agro',
    roles: ['dimension', 'filter', 'sort'],
    options: ['MPL Jonggol', 'MPL Cikalong', 'Villa Quiling', 'Pasir Putih'],
    operators: ['eq', 'neq', 'in', 'contains'],
    format: 'text'
  },

  // --- MODUL PETERNAKAN (TERNAK) ---
  {
    key: 'jenisTernak',
    label: 'Jenis Ternak',
    type: 'select',
    unit: '',
    module: 'Ternak',
    roles: ['dimension', 'filter', 'sort'],
    options: ['Sapi', 'Kambing', 'Domba', 'Ayam Broiler', 'Ayam KUB', 'Ayam KUB Petelur'],
    operators: ['eq', 'neq', 'in'],
    format: 'text'
  },
  {
    key: 'ternakMasukJenis',
    label: 'Jenis Mutasi Masuk',
    type: 'select',
    unit: '',
    module: 'Ternak',
    roles: ['dimension', 'filter', 'sort'],
    options: ['Kelahiran', 'Pembelian'],
    operators: ['eq', 'neq', 'in', 'contains'],
    format: 'text'
  },
  {
    key: 'ternakMasukKelahiranQty',
    label: 'Ternak Lahir',
    type: 'number',
    unit: 'ekor',
    module: 'Ternak',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['sum', 'avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'integer'
  },
  {
    key: 'ternakMasukPembelianQty',
    label: 'Ternak Beli',
    type: 'number',
    unit: 'ekor',
    module: 'Ternak',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['sum', 'avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'integer'
  },
  {
    key: 'ternakMasukQty',
    label: 'Total Ternak Masuk',
    type: 'number',
    unit: 'ekor',
    module: 'Ternak',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['sum', 'avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'integer'
  },
  {
    key: 'ternakKeluarJenis',
    label: 'Jenis Mutasi Keluar',
    type: 'select',
    unit: '',
    module: 'Ternak',
    roles: ['dimension', 'filter', 'sort'],
    options: ['Kematian', 'Penjualan'],
    operators: ['eq', 'neq', 'in', 'contains'],
    format: 'text'
  },
  {
    key: 'ternakKeluarKematianQty',
    label: 'Ternak Mati',
    type: 'number',
    unit: 'ekor',
    module: 'Ternak',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['sum', 'avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'integer'
  },
  {
    key: 'ternakKeluarPenjualanQty',
    label: 'Ternak Terjual',
    type: 'number',
    unit: 'ekor',
    module: 'Ternak',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['sum', 'avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'integer'
  },
  {
    key: 'ternakKeluarQty',
    label: 'Total Ternak Keluar',
    type: 'number',
    unit: 'ekor',
    module: 'Ternak',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['sum', 'avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'integer'
  },
  {
    key: 'populasiTernak',
    label: 'Populasi Ternak',
    type: 'number',
    unit: 'ekor',
    module: 'Ternak',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['sum', 'avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'integer'
  },
  {
    key: 'pakanMasukKg',
    label: 'Pakan Masuk',
    type: 'number',
    unit: 'kg',
    module: 'Ternak',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['sum', 'avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'decimal'
  },
  {
    key: 'pakanKeluarKg',
    label: 'Pakan Keluar (Konsumsi)',
    type: 'number',
    unit: 'kg',
    module: 'Ternak',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['sum', 'avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'decimal'
  },
  {
    key: 'jenisKomoditasTernak',
    label: 'Komoditas Ternak',
    type: 'select',
    unit: '',
    module: 'Ternak',
    roles: ['dimension', 'filter', 'sort'],
    options: ['Daging Sapi', 'Susu Sapi', 'Kambing Hidup', 'Domba Hidup', 'Ayam Hidup', 'Telur Ayam', 'Karkas Ayam', 'Pupuk Kandang / Kohe', 'Lainnya'],
    operators: ['eq', 'neq', 'in', 'contains'],
    format: 'text'
  },
  {
    key: 'jumlahPenjualanTernak',
    label: 'Volume Penjualan Ternak',
    type: 'number',
    unit: 'ekor/kg/unit',
    module: 'Ternak',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['sum', 'avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'decimal'
  },
  {
    key: 'hargaSatuanTernakRp',
    label: 'Harga Satuan Ternak',
    type: 'number',
    unit: 'Rp/unit',
    module: 'Ternak',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'currency'
  },
  {
    key: 'totalHargaTernakRp',
    label: 'Nilai Penjualan Ternak',
    type: 'number',
    unit: 'Rp',
    module: 'Ternak',
    roles: ['measure', 'filter', 'sort'],
    aggregations: ['sum', 'avg', 'min', 'max'],
    operators: ['between', 'gt', 'gte', 'lt', 'lte'],
    format: 'currency'
  },

  // --- MODUL OFFICE & PENGAWASAN ---
  {
    key: 'officeJenis',
    label: 'Kategori Office',
    type: 'select',
    unit: '',
    module: 'Office',
    roles: ['dimension', 'filter', 'sort'],
    options: ['Administrasi Umum', 'Keuangan & Pembukuan', 'SDM / HRD', 'Pengadaan / Logistik'],
    operators: ['eq', 'neq', 'in'],
    format: 'text'
  },
  {
    key: 'pengawasan',
    label: 'Tindakan Pengawasan',
    type: 'select',
    unit: '',
    module: 'Pengawasan',
    roles: ['dimension', 'filter', 'sort'],
    options: ['Komoditas pertanian / perkebunan', 'Komoditas peternakan', 'Petani binaan'],
    operators: ['eq', 'neq', 'in', 'contains'],
    format: 'text'
  },

  // --- METRIK DERIVATIF & AGREGASI UNIVERSAL ---
  {
    key: 'count',
    label: 'Frekuensi Laporan',
    type: 'number',
    unit: 'laporan',
    module: 'Umum',
    roles: ['measure', 'sort'],
    aggregations: ['count'],
    format: 'integer',
    isDerived: true
  },
  {
    key: 'distinctEmployees',
    label: 'Jumlah Karyawan Unik',
    type: 'number',
    unit: 'orang',
    module: 'Umum',
    roles: ['measure', 'sort'],
    aggregations: ['count_distinct'],
    format: 'integer',
    isDerived: true
  },
  {
    key: 'produktivitasPanen',
    label: 'Produktivitas Panen',
    type: 'number',
    unit: 'kg/m²',
    module: 'Agro',
    roles: ['measure', 'sort'],
    aggregations: ['avg'],
    format: 'decimal',
    isDerived: true
  },
  {
    key: 'kerapatanTanam',
    label: 'Kerapatan Tanam',
    type: 'number',
    unit: 'benih/m²',
    module: 'Agro',
    roles: ['measure', 'sort'],
    aggregations: ['avg'],
    format: 'decimal',
    isDerived: true
  },
  {
    key: 'hargaRataRata',
    label: 'Harga Rata-Rata Penjualan',
    type: 'number',
    unit: 'Rp/unit',
    module: 'Agro',
    roles: ['measure', 'sort'],
    aggregations: ['avg'],
    format: 'currency',
    isDerived: true
  }
]);

/**
 * Retrieves the canonical analytics field catalog.
 * @returns {Array<Object>}
 */
function getAnalyticsFieldCatalog() {
  return ANALYTICS_FIELD_CATALOG;
}

/**
 * Looks up a single field descriptor from the catalog by key.
 * @param {string} key
 * @returns {Object|null}
 */
function getFieldDescriptor(key) {
  if (!key) return null;
  const cleanKey = String(key).trim();
  return ANALYTICS_FIELD_CATALOG.find(f => f.key === cleanKey) || null;
}


/**
 * app.js — Standalone Client Logic & Triage Engine
 * Digital Reporting System Prototype
 */

// Triage Keyword Engine matching Automation.gs
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

function evaluateFlags(text) {
  const fullText = (text || '').toLowerCase();
  for (let k of URGENT_KEYWORDS) {
    if (fullText.includes(k)) {
      return { severity: 'urgent', category: k.includes('hama') || k.includes('wabah') ? 'biological/outbreak' : 'incident' };
    }
  }
  for (let k of WARNING_KEYWORDS) {
    if (fullText.includes(k)) {
      return { severity: 'warning', category: k.includes('hujan') ? 'weather_impact' : 'operational_delay' };
    }
  }
  return { severity: 'normal', category: 'routine' };
}

// Local Database Initialization
function getDB() {
  let db = localStorage.getItem('MPL_REPORTING_DB');
  if (!db) {
    const defaultData = {
      dailyReports: [
        { id: 1, timestamp: '2026-07-23 08:30', empId: 'EMP-101', site: 'Site A — Kebun & Lahan Pertanian', date: '2026-07-23', status: 'Completed', yield: 1450, issues: ['None'], severity: 'normal', category: 'routine', reviewStatus: 'Unreviewed' },
        { id: 2, timestamp: '2026-07-23 09:15', empId: 'EMP-102', site: 'Site A — Kebun & Lahan Pertanian', date: '2026-07-23', status: 'Delayed', yield: 800, issues: ['Weather'], severity: 'warning', category: 'weather_impact', reviewStatus: 'Unreviewed' },
        { id: 3, timestamp: '2026-07-23 10:00', empId: 'EMP-201', site: 'Site B — Peternakan & Kandang', date: '2026-07-23', status: 'Completed', yield: 0, issues: ['None'], severity: 'normal', category: 'routine', reviewStatus: 'Closed' },
        { id: 4, timestamp: '2026-07-23 11:20', empId: 'EMP-302', site: 'Site C — Pabrik Pengolahan & Pakan', date: '2026-07-23', status: 'Delayed', yield: 1100, issues: ['Equipment'], severity: 'urgent', category: 'equipment_breakdown', reviewStatus: 'Unreviewed' }
      ],
      generalReports: [
        { id: 1, timestamp: '2026-07-23 09:45', empId: 'EMP-203', site: 'Site B — Peternakan & Kandang', date: '2026-07-23', details: 'Ada kecelakaan kerja ringan saat pembersihan kandang 2. Korban sudah ditangani tim P3K.', isSensitive: false, severity: 'urgent', category: 'incident', reviewStatus: 'Unreviewed' },
        { id: 2, timestamp: '2026-07-23 13:00', empId: 'EMP-401', site: 'Site D — Logistik & Gudang', date: '2026-07-23', details: 'Laporan audit internal biaya operasional dan efisiensi bahan bakar armada.', isSensitive: true, severity: 'normal', category: 'routine', reviewStatus: 'Unreviewed (Sensitive)' }
      ]
    };
    localStorage.setItem('MPL_REPORTING_DB', JSON.stringify(defaultData));
    return defaultData;
  }
  return JSON.parse(db);
}

function saveDB(db) {
  localStorage.setItem('MPL_REPORTING_DB', JSON.stringify(db));
}

// Formatters
function formatDateNow() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

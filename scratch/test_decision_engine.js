/**
 * scratch/test_decision_engine.js
 * Comprehensive unit testing suite for the Permanent Decision Layer and Livestock Data Integrity.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('=== RUNNING DECISION ENGINE & LIVESTOCK DATA INTEGRITY TESTS ===');

// Mock GAS environment
const sandbox = {
  console: console,
  Logger: { log: console.log },
  formatDate: (d) => {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
  normalizePhoneNumber: (p) => p || '',
  isActualKendala: (k) => {
    if (!k) return false;
    const s = String(k).trim().toLowerCase();
    return s.length > 0 && !s.includes('tidak ada') && !s.includes('aman') && !s.includes('lancar') && !s.includes('nihil') && s !== '-';
  },
  resolveSeparatedCommodities: (com, comPanen, jenis) => {
    return {
      komoditasTanam: jenis && String(jenis).toLowerCase().includes('tanam') ? com : '',
      komoditasPanen: comPanen || (jenis && String(jenis).toLowerCase().includes('panen') ? com : '')
    };
  },
  getFieldDescriptor: (key) => {
    const cat = sandbox.ANALYTICS_FIELD_CATALOG || [];
    return cat.find(f => f.key === key) || null;
  },
  SpreadsheetApp: {},
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: () => 'mock_spreadsheet_id'
    })
  }
};

vm.createContext(sandbox);

// Load GS files in one execution block so top-level const/vars share scope
const gsFiles = [
  'DomainEntities.gs',
  'SpreadsheetRepository.gs',
  'AnalyticsService.gs',
  'ClientAPI.gs'
];

let combinedCode = '';
gsFiles.forEach(f => {
  combinedCode += fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8') + '\n';
});

// Append assignments to sandbox exports
combinedCode += `
this.OPERATIONAL_REPORT_FIELDS = OPERATIONAL_REPORT_FIELDS;
this.ANALYTICS_FIELD_CATALOG = ANALYTICS_FIELD_CATALOG;
this.OperationalReport = OperationalReport;
this.AnalyticsService = AnalyticsService;
this.SpreadsheetRepository = SpreadsheetRepository;
`;

vm.runInContext(combinedCode, sandbox);

console.log('✅ GS files loaded successfully into VM sandbox.');

// TEST 1: OPERATIONAL_REPORT_FIELDS includes all new fields
const fields = sandbox.OPERATIONAL_REPORT_FIELDS;
assert(Array.isArray(fields), 'OPERATIONAL_REPORT_FIELDS must be an array');
const fieldKeys = fields.map(f => f.key);
const expectedKeys = [
  'rincianPerawatanAgro',
  'ternakMasukKelahiranQty',
  'ternakMasukPembelianQty',
  'ternakKeluarKematianQty',
  'ternakKeluarPenjualanQty'
];

expectedKeys.forEach(k => {
  assert(fieldKeys.includes(k), `Missing expected field in OPERATIONAL_REPORT_FIELDS: ${k}`);
});
console.log('✅ TEST 1 PASSED: All 5 new operational fields are registered in OPERATIONAL_REPORT_FIELDS.');

// TEST 2: Domain Entity OperationalReport Constructor & Total Calculation
const sampleReportData = {
  namaPic: 'Budi Santoso',
  idKaryawan: 'TRN-01',
  bidangDivisi: 'Peternakan',
  jenisTernak: 'Sapi',
  ternakMasukKelahiranQty: 3,
  ternakMasukPembelianQty: 2,
  ternakKeluarKematianQty: 1,
  ternakKeluarPenjualanQty: 4,
  populasiTernak: 25,
  pakanMasukKg: 500,
  pakanKeluarKg: 450,
  totalHargaTernakRp: 40000000
};

const report = new sandbox.OperationalReport(sampleReportData);
assert.strictEqual(report.ternakMasukQty, 5, 'ternakMasukQty should be birth (3) + purchase (2) = 5');
assert.strictEqual(report.ternakKeluarQty, 5, 'ternakKeluarQty should be death (1) + sale (4) = 5');
assert.strictEqual(report.ternakMasukKelahiranQty, 3, 'ternakMasukKelahiranQty preserved');
assert.strictEqual(report.ternakMasukPembelianQty, 2, 'ternakMasukPembelianQty preserved');
assert.strictEqual(report.ternakKeluarKematianQty, 1, 'ternakKeluarKematianQty preserved');
assert.strictEqual(report.ternakKeluarPenjualanQty, 4, 'ternakKeluarPenjualanQty preserved');
console.log('✅ TEST 2 PASSED: OperationalReport constructor correctly computes total livestock mutations from granular components.');

// TEST 3: ANALYTICS_FIELD_CATALOG includes descriptors
const catalog = sandbox.ANALYTICS_FIELD_CATALOG;
assert(Array.isArray(catalog), 'ANALYTICS_FIELD_CATALOG must be an array');
const catalogKeys = catalog.map(c => c.key);
expectedKeys.forEach(k => {
  assert(catalogKeys.includes(k), `Missing descriptor in ANALYTICS_FIELD_CATALOG for: ${k}`);
});
console.log('✅ TEST 3 PASSED: ANALYTICS_FIELD_CATALOG contains valid descriptors for all new fields.');

// TEST 4: Decision Layer Price Trend Engine (Weighted Average Price Math)
const mockRows = [
  {
    komoditasPanen: 'Edamame',
    totalHargaRp: 3000000,
    jumlahPenjualanUnit: 200,
    tglPenjualan: '2026-08-05'
  },
  {
    komoditasPanen: 'Edamame',
    totalHargaRp: 4500000,
    jumlahPenjualanUnit: 300,
    tglPenjualan: '2026-08-15'
  },
  {
    komoditasPanen: 'Pisang',
    totalHargaRp: 500000,
    jumlahPenjualanUnit: 50,
    tglPenjualan: '2026-08-20'
  }
];

const priceTrend = sandbox.AnalyticsService.getPriceTrendWidgetData(mockRows, { commodity: 'Edamame' }, { interval: 'day' });
assert.strictEqual(priceTrend.commodity.key, 'Edamame', 'Commodity should be Edamame');
assert.strictEqual(priceTrend.summary.totalRevenue, 7500000, 'Total revenue for Edamame should be 7.5M');
assert.strictEqual(priceTrend.summary.totalQuantity, 500, 'Total quantity for Edamame should be 500');
assert.strictEqual(priceTrend.summary.overallWeightedPrice, 15000, 'Weighted average price should be 7.5M / 500 = 15000');
assert.strictEqual(priceTrend.summary.transactionCount, 2, 'Transaction count should be 2');
console.log('✅ TEST 4 PASSED: Price Trend engine correctly computes weighted average price: Rp 15.000 / unit.');

// TEST 5: Harvest Yield by Commodity Engine
const mockHarvestRows = [
  { komoditasPanen: 'Pisang', jumlahPanen: 600, luasLahanPanenM2: 1000 },
  { komoditasPanen: 'Pisang', jumlahPanen: 400, luasLahanPanenM2: 1000 },
  { komoditasPanen: 'Edamame', jumlahPanen: 500, luasLahanPanenM2: 500 }
];

const harvestByCom = sandbox.AnalyticsService.getHarvestByCommodityWidgetData(mockHarvestRows);
assert.strictEqual(harvestByCom.totalHarvestKg, 1500, 'Total harvest kg should be 1500');
assert.strictEqual(harvestByCom.points.length, 2, 'Should have 2 commodities');
assert.strictEqual(harvestByCom.points[0].commodity, 'Pisang', 'Top commodity should be Pisang');
assert.strictEqual(harvestByCom.points[0].harvestKg, 1000, 'Pisang harvest should be 1000 Kg');
assert.strictEqual(harvestByCom.points[0].share, 66.7, 'Pisang share should be 66.7%');
assert.strictEqual(harvestByCom.points[0].yieldPerM2, 0.5, 'Pisang yield should be 1000 / 2000 = 0.5 Kg/m²');
console.log('✅ TEST 5 PASSED: Harvest by Commodity engine computes correct yield and exact share percentages.');

// TEST 6: Sales Commercial vs Internal Use Engine
const mockSalesRows = [
  { komoditasPanen: 'Edamame', totalHargaRp: 5000000, jumlahPenjualanUnit: 250 },
  { jenisKomoditasTernak: 'Sapi', totalHargaTernakRp: 25000000, jumlahPenjualanTernak: 1 },
  { jumlahUnitPenggunaan: 40, tujuanPenggunaan: 'MPL Jonggol' },
  { jumlahUnitPenggunaan: 10, tujuanPenggunaan: 'MPL Cikalong' }
];

const salesByCom = sandbox.AnalyticsService.getSalesByCommodityWidgetData(mockSalesRows);
assert.strictEqual(salesByCom.totalCommercialRevenueRp, 30000000, 'Total commercial revenue should be 30M');
assert.strictEqual(salesByCom.totalCommercialAgroRevenueRp, 5000000, 'Agro commercial revenue should be 5M');
assert.strictEqual(salesByCom.totalCommercialTernakRevenueRp, 25000000, 'Ternak commercial revenue should be 25M');
assert.strictEqual(salesByCom.totalInternalUseUnits, 50, 'Internal use units should be 50');
assert.strictEqual(salesByCom.internalUsagePoints.length, 2, 'Should have 2 internal destinations');
assert.strictEqual(salesByCom.internalUsagePoints[0].destination, 'MPL Jonggol', 'First destination should be MPL Jonggol');
assert.strictEqual(salesByCom.internalUsagePoints[0].quantity, 40, 'MPL Jonggol quantity should be 40');
console.log('✅ TEST 6 PASSED: Sales engine separates commercial revenue and internal usage distributions without unit contamination.');

// TEST 7: Livestock Movement Engine
const mockLivestockRows = [
  {
    populasiTernak: 20,
    ternakMasukKelahiranQty: 2,
    ternakMasukPembelianQty: 3,
    ternakKeluarKematianQty: 1,
    ternakKeluarPenjualanQty: 2,
    pakanMasukKg: 300,
    pakanKeluarKg: 250,
    totalHargaTernakRp: 15000000,
    timestamp: '2026-08-10'
  }
];

const lsMove = sandbox.AnalyticsService.getLivestockMovementWidgetData(mockLivestockRows, 'day');
assert.strictEqual(lsMove.hasData, true, 'Livestock hasData should be true');
assert.strictEqual(lsMove.summary.reportedPopulation, 20, 'Reported population should be 20');
assert.strictEqual(lsMove.summary.totalEntry, 5, 'Total entry should be 2+3 = 5');
assert.strictEqual(lsMove.summary.totalExit, 3, 'Total exit should be 1+2 = 3');
assert.strictEqual(lsMove.summary.totalFeedOutKg, 250, 'Feed out should be 250 Kg');
assert.strictEqual(lsMove.summary.totalRevenueRp, 15000000, 'Ternak revenue should be 15M');
console.log('✅ TEST 7 PASSED: Livestock Movement engine correctly aggregates population and mutation vectors.');

// TEST 8: Full Decision Views Contract
sandbox.SpreadsheetRepository.getAllOperationalRows = () => [
  ...mockRows,
  ...mockHarvestRows,
  ...mockSalesRows,
  ...mockLivestockRows
];

const decisionViews = sandbox.AnalyticsService.getDecisionViewsData({ period: 'this_month' });
assert(decisionViews.decisionViews.priceTrend, 'priceTrend present');
assert(decisionViews.decisionViews.harvestByCommodity, 'harvestByCommodity present');
assert(decisionViews.decisionViews.salesByCommodity, 'salesByCommodity present');
assert(decisionViews.decisionViews.harvestPipeline, 'harvestPipeline present');
assert(decisionViews.decisionViews.livestockMovement, 'livestockMovement present');
assert(decisionViews.decisionViews.operationalRisk, 'operationalRisk present');
console.log('✅ TEST 8 PASSED: Full getDecisionViewsData contract returns all 6 visual decision view models.');

console.log('\n🌟 ALL UNIT TESTS PASSED SUCCESSFULLY! 🌟');

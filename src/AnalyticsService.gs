/**
 * AnalyticsService.gs — Enterprise Analytics Query & Aggregation Engine
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: DOMAIN & APPLICATION SERVICE
 * Responsibility: Provides generic query engine, time-series analysis,
 * multi-dimensional breakdowns, employee frequency leaderboard, smart HST harvest
 * predictions, and sales analytics.
 */

const AnalyticsService = {

  /**
   * Helper: Parses date safely into Date object.
   * @param {string|Date} val 
   * @returns {Date|null}
   */
  parseDate_: function(val) {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  },

  /**
   * Helper: Formats a Date object to YYYY-MM-DD string.
   * @param {Date} d 
   * @returns {string}
   */
  formatDateKey_: function(d) {
    if (!d || !(d instanceof Date)) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  /**
   * Helper: Gets the start of week (Monday) for a given date.
   * @param {Date} d 
   * @returns {Date}
   */
  getStartOfWeek_: function(d) {
    const res = new Date(d);
    const day = res.getDay();
    const diff = res.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    res.setDate(diff);
    res.setHours(0, 0, 0, 0);
    return res;
  },

  /**
   * Helper: Gets the start of month for a given date.
   * @param {Date} d 
   * @returns {Date}
   */
  getStartOfMonth_: function(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  },

  /**
   * Applies an array of filter specifications onto an array of row objects.
   * @param {Array<Object>} rows 
   * @param {Array<{ fieldKey: string, operator: string, value: any }>} [filters]
   * @returns {Array<Object>}
   */
  applyFilters: function(rows, filters) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    if (!Array.isArray(filters) || filters.length === 0) return rows;

    return rows.filter(row => {
      return filters.every(f => {
        if (!f || !f.fieldKey) return true;
        const rowVal = row[f.fieldKey];
        const targetVal = f.value;
        const op = (f.operator || 'eq').toLowerCase();

        if (op === 'eq') {
          if (typeof rowVal === 'string' && typeof targetVal === 'string') {
            return rowVal.toLowerCase() === targetVal.toLowerCase();
          }
          return rowVal == targetVal;
        }

        if (op === 'neq') {
          if (typeof rowVal === 'string' && typeof targetVal === 'string') {
            return rowVal.toLowerCase() !== targetVal.toLowerCase();
          }
          return rowVal != targetVal;
        }

        if (op === 'in') {
          if (!Array.isArray(targetVal)) return true;
          const lowerTargets = targetVal.map(v => String(v).toLowerCase());
          return lowerTargets.includes(String(rowVal || '').toLowerCase());
        }

        if (op === 'contains') {
          return String(rowVal || '').toLowerCase().includes(String(targetVal || '').toLowerCase());
        }

        if (op === 'gte') {
          return Number(rowVal || 0) >= Number(targetVal || 0);
        }

        if (op === 'lte') {
          return Number(rowVal || 0) <= Number(targetVal || 0);
        }

        if (op === 'gt') {
          return Number(rowVal || 0) > Number(targetVal || 0);
        }

        if (op === 'lt') {
          return Number(rowVal || 0) < Number(targetVal || 0);
        }

        if (op === 'between') {
          if (!Array.isArray(targetVal) || targetVal.length < 2) return true;
          const num = Number(rowVal || 0);
          return num >= Number(targetVal[0]) && num <= Number(targetVal[1]);
        }

        return true;
      });
    });
  },

  /**
   * Generic grouping and aggregation helper.
   * Computes sum, avg, count, count_distinct, min, max across grouped partitions.
   * @param {Array<Object>} rows 
   * @param {Function} groupByFn Takes row, returns string group key
   * @param {string} measureFieldKey Field to measure/aggregate
   * @param {'sum'|'avg'|'count'|'count_distinct'|'min'|'max'} [aggregation='sum']
   * @returns {Object.<string, { key: string, value: number, count: number, distinctValues: Set }>}
   */
  groupAndAggregate: function(rows, groupByFn, measureFieldKey, aggregation = 'sum') {
    const groups = {};
    if (!Array.isArray(rows)) return groups;

    rows.forEach(row => {
      const key = String(groupByFn(row) || 'Lainnya').trim() || 'Lainnya';
      if (!groups[key]) {
        groups[key] = {
          key: key,
          sum: 0,
          count: 0,
          min: Infinity,
          max: -Infinity,
          distinctValues: new Set()
        };
      }

      const g = groups[key];
      g.count += 1;

      const rawVal = row[measureFieldKey];
      if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
        g.distinctValues.add(String(rawVal).trim());
        const num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal).replace(/[^0-9.-]/g, ''));
        if (!isNaN(num)) {
          g.sum += num;
          if (num < g.min) g.min = num;
          if (num > g.max) g.max = num;
        }
      }
    });

    // Compute final aggregate value per group
    const result = {};
    Object.keys(groups).forEach(k => {
      const g = groups[k];
      let finalVal = 0;

      switch (aggregation) {
        case 'sum':
          finalVal = g.sum;
          break;
        case 'avg':
          finalVal = g.count > 0 ? (g.sum / g.count) : 0;
          break;
        case 'count':
          finalVal = g.count;
          break;
        case 'count_distinct':
          finalVal = g.distinctValues.size;
          break;
        case 'min':
          finalVal = g.min === Infinity ? 0 : g.min;
          break;
        case 'max':
          finalVal = g.max === -Infinity ? 0 : g.max;
          break;
        default:
          finalVal = g.sum;
      }

      result[k] = {
        key: k,
        value: Math.round(finalVal * 100) / 100,
        count: g.count,
        distinctCount: g.distinctValues.size
      };
    });

    return result;
  },

  /**
   * Generates a time-series series of data points aggregated by interval.
   * @param {Array<Object>} rows 
   * @param {string} measureFieldKey 
   * @param {'day'|'week'|'month'} interval 
   * @param {'sum'|'avg'|'count'|'count_distinct'} aggregation 
   * @param {string} [dateFieldKey='timestamp'] 
   * @returns {{ labels: Array<string>, values: Array<number>, total: number }}
   */
  getTimeseries: function(rows, measureFieldKey, interval = 'day', aggregation = 'sum', dateFieldKey = 'timestamp') {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { labels: [], values: [], total: 0 };
    }

    const groupByFn = (row) => {
      let d = null;
      if (row[dateFieldKey + '_raw'] instanceof Date) {
        d = row[dateFieldKey + '_raw'];
      } else if (row[dateFieldKey]) {
        d = new Date(row[dateFieldKey]);
      } else if (row.timestamp_raw instanceof Date) {
        d = row.timestamp_raw;
      } else if (row.timestamp) {
        d = new Date(row.timestamp);
      }

      if (!d || isNaN(d.getTime())) return 'Tidak Diketahui';

      if (interval === 'month') {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
      } else if (interval === 'week') {
        const startW = AnalyticsService.getStartOfWeek_(d);
        return 'Mg ' + AnalyticsService.formatDateKey_(startW);
      } else {
        return AnalyticsService.formatDateKey_(d);
      }
    };

    const aggregated = this.groupAndAggregate(rows, groupByFn, measureFieldKey, aggregation);
    const sortedKeys = Object.keys(aggregated).filter(k => k !== 'Tidak Diketahui').sort();

    const labels = [];
    const values = [];
    let total = 0;

    sortedKeys.forEach(k => {
      labels.push(k);
      const val = aggregated[k].value;
      values.push(val);
      total += val;
    });

    return {
      labels: labels,
      values: values,
      total: Math.round(total * 100) / 100
    };
  },

  /**
   * Generates a ranked dimensional breakdown list with percentage shares.
   * @param {Array<Object>} rows 
   * @param {string} measureFieldKey 
   * @param {'sum'|'avg'|'count'|'count_distinct'} aggregation 
   * @param {string} groupByFieldKey 
   * @returns {Array<{ key: string, label: string, value: number, count: number, percentage: number }>}
   */
  getBreakdown: function(rows, measureFieldKey, aggregation = 'sum', groupByFieldKey = 'komoditas') {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const groupByFn = (row) => {
      const v = row[groupByFieldKey];
      return (v === undefined || v === null || String(v).trim() === '') ? 'Tidak Ditentukan' : String(v).trim();
    };

    const aggregated = this.groupAndAggregate(rows, groupByFn, measureFieldKey, aggregation);
    const items = Object.values(aggregated);

    // Compute grand total for percentage
    const grandTotal = items.reduce((acc, it) => acc + (it.value > 0 ? it.value : 0), 0);

    items.sort((a, b) => b.value - a.value);

    return items.map(it => {
      const pct = grandTotal > 0 ? Math.round((it.value / grandTotal) * 1000) / 10 : 0;
      return {
        key: it.key,
        label: it.key,
        value: it.value,
        count: it.count,
        percentage: pct
      };
    });
  },

  /**
   * Smart Panen Harvest Prediction: Calculates Estimated Harvest Date = Tgl Tanam + HST.
   * @param {string|Date} tglTanam 
   * @param {number} estimasiPanenHst 
   * @returns {{ estimatedDate: string, daysRemaining: number, isOverdue: boolean, isReady: boolean, status: 'ready'|'growing'|'overdue' }}
   */
  calculateEstimatedHarvestDate: function(tglTanam, estimasiPanenHst) {
    const dPlant = this.parseDate_(tglTanam);
    const hst = Number(estimasiPanenHst || 0);

    if (!dPlant || hst <= 0) {
      return {
        estimatedDate: '',
        daysRemaining: 0,
        isOverdue: false,
        isReady: false,
        status: 'growing'
      };
    }

    const estDate = new Date(dPlant);
    estDate.setDate(estDate.getDate() + hst);
    estDate.setHours(0, 0, 0, 0);

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const diffTime = estDate.getTime() - now.getTime();
    const daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));

    let status = 'growing';
    if (daysRemaining < 0) {
      status = 'overdue';
    } else if (daysRemaining <= 7) {
      status = 'ready';
    }

    return {
      estimatedDate: this.formatDateKey_(estDate),
      daysRemaining: daysRemaining,
      isOverdue: daysRemaining < 0,
      isReady: daysRemaining >= 0 && daysRemaining <= 7,
      status: status
    };
  },

  /**
   * Generates active planting harvest schedules sorted soonest-first.
   * Calculates smart countdown = Tgl Tanam + HST (required input from field report).
   * @param {Array<Object>} rows 
   * @returns {Array<Object>}
   */
  getHarvestSchedule: function(rows) {
    if (!Array.isArray(rows)) return [];

    const schedule = [];

    rows.forEach(r => {
      // Resolve clean separated commodity name for planting
      const sep = resolveSeparatedCommodities(r.komoditas, r.komoditasPanen, r.jenisKegiatan);
      const cropName = sep.komoditasTanam || r.komoditasTanam || r.komoditas || 'Tanaman';
      const cleanCropLower = String(cropName).toLowerCase().trim();

      const isTanam = (r.jenisKegiatan && r.jenisKegiatan.toLowerCase().includes('tanam')) || 
                      Boolean(r.tglTanam) || 
                      Boolean(r.estimasiPanenHst && r.estimasiPanenHst > 0) || 
                      Boolean(r.jumlahBenih && r.jumlahBenih > 0) ||
                      Boolean(sep.komoditasTanam && sep.komoditasTanam.length > 0 && sep.komoditasTanam !== 'Lainnya');
      
      if (!isTanam) return;

      const tglTanam = r.tglTanam || r.timestamp;
      const hst = Number(r.estimasiPanenHst || 0);
      if (!tglTanam || hst <= 0) return;

      const calc = this.calculateEstimatedHarvestDate(tglTanam, hst);

      // A planting is only already harvested if a harvest of the SAME crop was explicitly logged with volume
      const isAlreadyHarvested = Boolean(
        r.tglPanen && 
        String(r.tglPanen).trim().length > 0 && 
        Number(r.jumlahPanen || 0) > 0 &&
        sep.komoditasPanen && 
        sep.komoditasPanen.toLowerCase() === cleanCropLower
      );

      schedule.push({
        reportId: r.reportId || '',
        kodeKegiatan: r.kodeKegiatan || '',
        namaPic: r.namaPic || '',
        idKaryawan: r.idKaryawan || '',
        bidangDivisi: r.bidangDivisi || '',
        lokasiKegiatan: r.lokasiKegiatan || '',
        lokasiBlok: r.lokasiBlok || r.lokasiBlokTanam || '',
        komoditas: cropName,
        luasLahanM2: Number(r.luasLahanM2 || 0),
        jumlahBenih: Number(r.jumlahBenih || 0),
        tglTanam: String(tglTanam).split(' ')[0],
        estimasiPanenHst: hst,
        tglEstimasiPanen: calc.estimatedDate,
        daysRemaining: calc.daysRemaining,
        status: isAlreadyHarvested ? 'harvested' : calc.status,
        isOverdue: !isAlreadyHarvested && calc.isOverdue,
        isReady: !isAlreadyHarvested && calc.isReady,
        isAlreadyHarvested: isAlreadyHarvested
      });
    });

    // Sort: Active non-harvested first, then by daysRemaining ascending (soonest harvest first)
    schedule.sort((a, b) => {
      if (a.isAlreadyHarvested !== b.isAlreadyHarvested) {
        return a.isAlreadyHarvested ? 1 : -1;
      }
      return a.daysRemaining - b.daysRemaining;
    });

    return schedule;
  },

  /**
   * Generates employee reporting frequency leaderboard ranked from most active to least.
   * Joined with Master Employee Registry for complete profile data.
   * @param {Array<Object>} rows 
   * @returns {Array<Object>}
   */
  getEmployeeReportingLeaderboard: function(rows) {
    const registry = getActiveEmployeeRegistry();
    const countMap = {};
    const lastReportMap = {};
    const divisionMap = {};

    // Count reports per ID from rows
    (rows || []).forEach(r => {
      const empId = String(r.idKaryawan || '').trim();
      if (!empId) return;

      countMap[empId] = (countMap[empId] || 0) + 1;

      const rTime = r.timestamp_raw instanceof Date ? r.timestamp_raw : (r.timestamp ? new Date(r.timestamp) : null);
      if (rTime && !isNaN(rTime.getTime())) {
        if (!lastReportMap[empId] || rTime > lastReportMap[empId]) {
          lastReportMap[empId] = rTime;
        }
      }

      if (r.bidangDivisi && !divisionMap[empId]) {
        divisionMap[empId] = r.bidangDivisi;
      }
    });

    const totalReports = (rows || []).length;

    // Build full list of registered employees + any ad-hoc reporting IDs
    const empIdsSet = new Set([...registry.map(e => e.id), ...Object.keys(countMap)]);

    const leaderboard = Array.from(empIdsSet).map(empId => {
      const reg = registry.find(e => e.id.toLowerCase() === empId.toLowerCase());
      const name = reg ? reg.name : empId;
      const division = (reg ? reg.division : divisionMap[empId]) || 'Umum';
      const count = countMap[empId] || 0;
      const lastDate = lastReportMap[empId] ? AnalyticsService.formatDateKey_(lastReportMap[empId]) : '-';
      const pct = totalReports > 0 ? Math.round((count / totalReports) * 1000) / 10 : 0;

      let tier = 'Rendah';
      let tierBadge = 'badge-neutral';
      if (count >= 10) {
        tier = 'Sangat Aktif';
        tierBadge = 'badge-primary';
      } else if (count >= 4) {
        tier = 'Konsisten';
        tierBadge = 'badge-normal';
      } else if (count >= 1) {
        tier = 'Cukup';
        tierBadge = 'badge-neutral';
      } else {
        tier = 'Belum Ada Laporan';
        tierBadge = 'badge-urgent';
      }

      return {
        idKaryawan: empId,
        namaPic: name,
        bidangDivisi: division,
        totalLaporan: count,
        percentage: pct,
        terakhirMelapor: lastDate,
        konsistensi: tier,
        badgeClass: tierBadge
      };
    });

    // Sort descending by totalLaporan, then alphabetical by name
    leaderboard.sort((a, b) => {
      if (b.totalLaporan !== a.totalLaporan) return b.totalLaporan - a.totalLaporan;
      return a.namaPic.localeCompare(b.namaPic);
    });

    // Assign rank
    leaderboard.forEach((item, index) => {
      item.rank = index + 1;
    });

    return leaderboard;
  },

  /**
   * Generates comprehensive sales analytics with multi-dimensional breakdowns.
   * @param {Array<Object>} rows 
   * @param {'day'|'week'|'month'} [interval='day'] 
   * @returns {Object}
   */
  /**
   * Generates comprehensive sales analytics with multi-dimensional breakdowns.
   * @param {Array<Object>} rows 
   * @param {'day'|'week'|'month'} [interval='day'] 
   * @returns {Object}
   */
  getSalesAnalytics: function(rows, interval = 'day') {
    const salesRows = (rows || []).filter(r => {
      return (r.totalHargaRp && r.totalHargaRp > 0) || 
             (r.hargaSatuanRp && r.hargaSatuanRp > 0) || 
             (r.tglPenjualan && r.tglPenjualan.length > 0) ||
             (r.jenisKegiatan && r.jenisKegiatan.toLowerCase().includes('penjualan'));
    });

    let grandTotalRp = 0;
    let grandTotalUnits = 0;

    salesRows.forEach(r => {
      grandTotalRp += Number(r.totalHargaRp || 0);
      grandTotalUnits += Number(r.jumlahPenjualanUnit || r.jumlahPanen || 0);
      
      // Ensure clean single crop name for panen sales
      if (!r.komoditasPanenClean) {
        const sep = resolveSeparatedCommodities(r.komoditas, r.komoditasPanen, r.jenisKegiatan);
        r.komoditasPanenClean = sep.komoditasPanen || sep.komoditasTanam || r.komoditas || 'Lainnya';
      }
    });

    const avgPricePerUnit = grandTotalUnits > 0 ? Math.round(grandTotalRp / grandTotalUnits) : 0;

    // 1. Revenue over time
    const revenueTimeseries = this.getTimeseries(salesRows, 'totalHargaRp', interval, 'sum', 'tglPenjualan');

    // 2. Breakdown by Commodity (Pure Panen Crop)
    const byCommodity = this.getBreakdown(salesRows, 'totalHargaRp', 'sum', 'komoditasPanenClean');

    // 3. Breakdown by Division
    const byDivision = this.getBreakdown(salesRows, 'totalHargaRp', 'sum', 'bidangDivisi');

    // 4. Breakdown by Distribution Destination
    const byDistribution = this.getBreakdown(salesRows, 'totalHargaRp', 'sum', 'tujuanDistribusi');

    return {
      grandTotalRp: grandTotalRp,
      grandTotalUnits: grandTotalUnits,
      avgPricePerUnit: avgPricePerUnit,
      salesCount: salesRows.length,
      revenueTimeseries: revenueTimeseries,
      byCommodity: byCommodity,
      byDivision: byDivision,
      byDistribution: byDistribution
    };
  },

  /**
   * Main Orchestrator: Assembles complete executive analytics dataset.
   * @param {Object} [params] 
   * @param {string} [params.period='this_month'] 'this_week'|'last_week'|'this_month'|'this_quarter'|'this_year'|'custom'
   * @param {string} [params.startDate]
   * @param {string} [params.endDate]
   * @param {string} [params.cropFilter]
   * @param {Array} [params.filters]
   * @returns {Object}
   */
  getAnalyticsDashboardData: function(params = {}) {
    const period = params.period || 'this_month';
    const now = new Date();
    let dFrom = new Date();
    let dTo = new Date();
    let interval = 'day';
    let periodLabel = 'Bulan Ini';

    if (period === 'this_week') {
      dFrom = this.getStartOfWeek_(now);
      dTo = new Date(dFrom);
      dTo.setDate(dTo.getDate() + 6);
      interval = 'day';
      periodLabel = 'Minggu Ini';
    } else if (period === 'last_week') {
      const thisMonday = this.getStartOfWeek_(now);
      dFrom = new Date(thisMonday);
      dFrom.setDate(dFrom.getDate() - 7);
      dTo = new Date(dFrom);
      dTo.setDate(dTo.getDate() + 6);
      interval = 'day';
      periodLabel = 'Minggu Lalu';
    } else if (period === 'this_month') {
      dFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      dTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      interval = 'day';
      periodLabel = 'Bulan Ini';
    } else if (period === 'this_quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      dFrom = new Date(now.getFullYear(), qMonth, 1);
      dTo = new Date(now.getFullYear(), qMonth + 3, 0);
      interval = 'week';
      periodLabel = 'Kuartal Ini';
    } else if (period === 'this_year') {
      dFrom = new Date(now.getFullYear(), 0, 1);
      dTo = new Date(now.getFullYear(), 11, 31);
      interval = 'month';
      periodLabel = 'Tahun Ini';
    } else if (period === 'custom') {
      if (params.startDate) dFrom = new Date(params.startDate);
      if (params.endDate) dTo = new Date(params.endDate);
      const diffDays = Math.round((dTo - dFrom) / (1000 * 60 * 60 * 24));
      if (diffDays > 120) interval = 'month';
      else if (diffDays > 30) interval = 'week';
      else interval = 'day';
      periodLabel = `${this.formatDateKey_(dFrom)} s/d ${this.formatDateKey_(dTo)}`;
    }

    // 1. Fetch raw operational rows from data layer
    const allRows = SpreadsheetRepository.getAllOperationalRows(dFrom, dTo);

    // Ensure clean separated commodities on all rows
    allRows.forEach(r => {
      const sep = resolveSeparatedCommodities(r.komoditas, r.komoditasPanen, r.jenisKegiatan);
      r.komoditasTanam = sep.komoditasTanam;
      r.komoditasPanen = sep.komoditasPanen;
      r.komoditasClean = sep.komoditasTanam || sep.komoditasPanen || r.komoditas || '';
    });

    // 2. Apply any secondary filters
    const filteredRows = this.applyFilters(allRows, params.filters);

    // 3. Compute Executive KPIs
    let totalSalesRp = 0;
    let totalPanenKg = 0;
    let totalBenih = 0;

    filteredRows.forEach(r => {
      totalSalesRp += Number(r.totalHargaRp || 0);
      totalPanenKg += Number(r.jumlahPanen || 0);
      totalBenih += Number(r.jumlahBenih || 0);
    });

    // 4. Employee Leaderboard (Requirement 1)
    const employeeLeaderboard = this.getEmployeeReportingLeaderboard(filteredRows);

    // 5. Commodity Analysis — Separated Tanam vs Panen (Requirement 2)
    // Master clean list of crops
    const defaultCrops = [
      'Pisang', 'Jagung Manis', 'Terong', 'Cabe', 'Jagung Tebon',
      'Jagung Hibrida', 'Edamame', 'Pembibitan Kopi', 'Pembibitan Pala'
    ];
    const presentCrops = new Set(defaultCrops);
    filteredRows.forEach(r => {
      if (r.komoditasTanam && r.komoditasTanam !== 'Lainnya') presentCrops.add(r.komoditasTanam);
      if (r.komoditasPanen && r.komoditasPanen !== 'Lainnya') presentCrops.add(r.komoditasPanen);
    });
    const cropList = Array.from(presentCrops).filter(c => c && !c.includes('(Tanam)') && !c.includes('(Panen)'));

    const selectedCrop = params.cropFilter || cropList[0] || 'Pisang';

    // Filter rows specifically for selected crop
    const cropTanamRows = filteredRows.filter(r => (r.komoditasTanam || r.komoditas || '').toLowerCase() === selectedCrop.toLowerCase());
    const cropPanenRows = filteredRows.filter(r => (r.komoditasPanen || '').toLowerCase() === selectedCrop.toLowerCase());

    const cropTanamTrend = this.getTimeseries(cropTanamRows, 'jumlahBenih', interval, 'sum', 'tglTanam');
    const cropPanenTrend = this.getTimeseries(cropPanenRows, 'jumlahPanen', interval, 'sum', 'tglPanen');

    // Participation view: Count distinct employees per single clean crop
    const participationMap = {};
    filteredRows.forEach(r => {
      const empId = r.idKaryawan;
      if (!empId) return;

      const crops = new Set();
      if (r.komoditasTanam && r.komoditasTanam !== 'Lainnya' && !r.komoditasTanam.includes('(')) crops.add(r.komoditasTanam);
      if (r.komoditasPanen && r.komoditasPanen !== 'Lainnya' && !r.komoditasPanen.includes('(')) crops.add(r.komoditasPanen);
      if (crops.size === 0 && r.komoditasClean && !r.komoditasClean.includes('(')) crops.add(r.komoditasClean);

      crops.forEach(c => {
        if (!participationMap[c]) participationMap[c] = new Set();
        participationMap[c].add(empId);
      });
    });

    const cropParticipation = Object.keys(participationMap).map(cropName => ({
      key: cropName,
      label: cropName,
      value: participationMap[cropName].size
    })).sort((a, b) => b.value - a.value);

    // 6. Smart Panen Harvest Schedule via HST (Requirement 3)
    const fullYearRows = SpreadsheetRepository.getAllOperationalRows(
      new Date(now.getFullYear() - 1, 0, 1),
      new Date(now.getFullYear() + 1, 11, 31)
    );
    const harvestSchedule = this.getHarvestSchedule(fullYearRows);
    const activeHarvests = harvestSchedule.filter(s => !s.isAlreadyHarvested);
    const readyHarvestsCount = activeHarvests.filter(s => s.isReady).length;
    const overdueHarvestsCount = activeHarvests.filter(s => s.isOverdue).length;

    // 7. Sales Analytics & Commercial Breakdowns (Requirement 4)
    const salesAnalytics = this.getSalesAnalytics(filteredRows, interval);

    return {
      period: {
        code: period,
        label: periodLabel,
        startDate: this.formatDateKey_(dFrom),
        endDate: this.formatDateKey_(dTo),
        interval: interval
      },
      kpis: {
        totalReports: filteredRows.length,
        totalSalesRp: totalSalesRp,
        totalPanenKg: Math.round(totalPanenKg * 10) / 10,
        totalBenih: totalBenih,
        activePlantingsCount: activeHarvests.length,
        readyHarvestsCount: readyHarvestsCount,
        overdueHarvestsCount: overdueHarvestsCount
      },
      employeeLeaderboard: employeeLeaderboard,
      commodityAnalysis: {
        cropList: cropList,
        selectedCrop: selectedCrop,
        tanamTrend: cropTanamTrend,
        panenTrend: cropPanenTrend,
        participation: cropParticipation
      },
      harvestSchedule: {
        activeList: activeHarvests.slice(0, 30),
        totalActive: activeHarvests.length,
        readyCount: readyHarvestsCount,
        overdueCount: overdueHarvestsCount
      },
      salesAnalytics: salesAnalytics
    };
  }
};

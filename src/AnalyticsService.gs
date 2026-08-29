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
   * Helper: Gets the start of quarter for a given date.
   * @param {Date} d 
   * @returns {Date}
   */
  getStartOfQuarter_: function(d) {
    const qMonth = Math.floor(d.getMonth() / 3) * 3;
    return new Date(d.getFullYear(), qMonth, 1);
  },

  /**
   * Helper: Gets the start of year for a given date.
   * @param {Date} d 
   * @returns {Date}
   */
  getStartOfYear_: function(d) {
    return new Date(d.getFullYear(), 0, 1);
  },

  /**
   * Helper: Resolves start and end Date objects and interval from period parameters.
   * @param {Object} [params]
   * @returns {{ dFrom: Date, dTo: Date, interval: string, periodCode: string, periodLabel: string }}
   */
  resolvePeriodBounds_: function(params = {}) {
    const period = params.period || 'this_month';
    const now = new Date();
    let dFrom = new Date();
    let dTo = new Date();
    let interval = params.interval || 'day';
    let periodLabel = 'Bulan Ini';

    if (period === 'this_week') {
      dFrom = this.getStartOfWeek_(now);
      dTo = new Date(dFrom);
      dTo.setDate(dTo.getDate() + 6);
      if (!params.interval) interval = 'day';
      periodLabel = 'Minggu Ini';
    } else if (period === 'last_week') {
      const thisMonday = this.getStartOfWeek_(now);
      dFrom = new Date(thisMonday);
      dFrom.setDate(dFrom.getDate() - 7);
      dTo = new Date(dFrom);
      dTo.setDate(dTo.getDate() + 6);
      if (!params.interval) interval = 'day';
      periodLabel = 'Minggu Lalu';
    } else if (period === 'this_month') {
      dFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      dTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      if (!params.interval) interval = 'day';
      periodLabel = 'Bulan Ini';
    } else if (period === 'this_quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      dFrom = new Date(now.getFullYear(), qMonth, 1);
      dTo = new Date(now.getFullYear(), qMonth + 3, 0);
      if (!params.interval) interval = 'week';
      periodLabel = 'Kuartal Ini';
    } else if (period === 'this_year') {
      dFrom = new Date(now.getFullYear(), 0, 1);
      dTo = new Date(now.getFullYear(), 11, 31);
      if (!params.interval) interval = 'month';
      periodLabel = 'Tahun Ini';
    } else if (period === 'all') {
      dFrom = new Date(now.getFullYear() - 3, 0, 1);
      dTo = new Date(now.getFullYear() + 1, 11, 31);
      if (!params.interval) interval = 'month';
      periodLabel = 'Semua Data';
    } else if (period === 'custom') {
      if (params.startDate) dFrom = this.parseDate_(params.startDate) || new Date(params.startDate);
      if (params.endDate) dTo = this.parseDate_(params.endDate) || new Date(params.endDate);
      const diffDays = Math.round((dTo - dFrom) / (1000 * 60 * 60 * 24));
      if (!params.interval) {
        if (diffDays > 365) interval = 'quarter';
        else if (diffDays > 90) interval = 'month';
        else if (diffDays > 30) interval = 'week';
        else interval = 'day';
      }
      periodLabel = `${this.formatDateKey_(dFrom)} s/d ${this.formatDateKey_(dTo)}`;
    }

    return {
      dFrom: dFrom,
      dTo: dTo,
      interval: interval,
      periodCode: period,
      periodLabel: periodLabel
    };
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

      let rawVal = row[measureFieldKey];
      if (measureFieldKey === 'luasLahanM2' && (!rawVal || Number(rawVal) === 0)) {
        rawVal = row.luasLahanPanenM2 || row.luasLahanM2;
      }
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

      if (interval === 'year') {
        return String(d.getFullYear());
      } else if (interval === 'quarter') {
        const q = Math.floor(d.getMonth() / 3) + 1;
        return `${d.getFullYear()}-Q${q}`;
      } else if (interval === 'month') {
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

    if (measureFieldKey === 'produktivitasPanen' || measureFieldKey === 'kerapatanTanam' || measureFieldKey === 'hargaRataRata') {
      // Derived Ratio Timeseries
      const numField = measureFieldKey === 'produktivitasPanen' ? 'jumlahPanen' : (measureFieldKey === 'kerapatanTanam' ? 'jumlahBenih' : 'totalHargaRp');
      const denField = measureFieldKey === 'produktivitasPanen' ? 'luasLahanM2' : (measureFieldKey === 'kerapatanTanam' ? 'luasLahanM2' : 'jumlahPenjualanUnit');

      const numAgg = this.groupAndAggregate(rows, groupByFn, numField, 'sum');
      const denAgg = this.groupAndAggregate(rows, groupByFn, denField, 'sum');
      const sortedKeys = Object.keys(numAgg).filter(k => k !== 'Tidak Diketahui').sort();

      const labels = [];
      const values = [];
      let totalNum = 0;
      let totalDen = 0;

      sortedKeys.forEach(k => {
        labels.push(k);
        const n = numAgg[k] ? numAgg[k].value : 0;
        const d = denAgg[k] ? denAgg[k].value : 0;
        let val = 0;
        if (measureFieldKey === 'produktivitasPanen') {
          val = d > 0 ? Math.round((n / d) * 100) / 100 : (n > 0 ? n : 0);
        } else if (measureFieldKey === 'kerapatanTanam') {
          val = d > 0 ? Math.round((n / d) * 10) / 10 : 0;
        } else {
          val = d > 0 ? Math.round(n / d) : 0;
        }
        values.push(val);
        totalNum += n;
        totalDen += d;
      });

      const grandVal = totalDen > 0 ? (totalNum / totalDen) : 0;
      return {
        labels: labels,
        values: values,
        total: Math.round(grandVal * 100) / 100
      };
    }

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
   * Supports standard aggregations and derived ratio measures (produktivitasPanen, kerapatanTanam, hargaRataRata).
   * @param {Array<Object>} rows 
   * @param {string} measureFieldKey 
   * @param {'sum'|'avg'|'count'|'count_distinct'} aggregation 
   * @param {string|Function} groupByFieldKey 
   * @returns {Array<{ key: string, label: string, value: number, count: number, percentage: number }>}
   */
  getBreakdown: function(rows, measureFieldKey, aggregation = 'sum', groupByFieldKey = 'komoditas') {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const groupByFn = (row) => {
      let v = '';
      if (typeof groupByFieldKey === 'function') {
        v = groupByFieldKey(row);
      } else {
        v = row[groupByFieldKey];
      }
      return (v === undefined || v === null || String(v).trim() === '') ? 'Tidak Ditentukan' : String(v).trim();
    };

    // Derived Agronomic & Commercial Measures Handling
    if (measureFieldKey === 'produktivitasPanen' || measureFieldKey === 'kerapatanTanam' || measureFieldKey === 'hargaRataRata') {
      const numField = measureFieldKey === 'produktivitasPanen' ? 'jumlahPanen' : (measureFieldKey === 'kerapatanTanam' ? 'jumlahBenih' : 'totalHargaRp');
      const denField = measureFieldKey === 'produktivitasPanen' ? 'luasLahanM2' : (measureFieldKey === 'kerapatanTanam' ? 'luasLahanM2' : 'jumlahPenjualanUnit');

      const numAgg = this.groupAndAggregate(rows, groupByFn, numField, 'sum');
      const denAgg = this.groupAndAggregate(rows, groupByFn, denField, 'sum');
      const keys = Object.keys(numAgg);

      const items = keys.map(k => {
        const n = numAgg[k] ? numAgg[k].value : 0;
        const d = denAgg[k] ? denAgg[k].value : 0;
        let val = 0;
        if (measureFieldKey === 'produktivitasPanen') {
          val = d > 0 ? Math.round((n / d) * 100) / 100 : (n > 0 ? n : 0);
        } else if (measureFieldKey === 'kerapatanTanam') {
          val = d > 0 ? Math.round((n / d) * 10) / 10 : 0;
        } else {
          val = d > 0 ? Math.round(n / d) : 0;
        }
        return {
          key: k,
          label: k,
          value: val,
          count: numAgg[k].count
        };
      });

      const grandTotal = items.reduce((acc, it) => acc + (it.value > 0 ? it.value : 0), 0);
      items.sort((a, b) => b.value - a.value);

      return items.map(it => ({
        key: it.key,
        label: it.key,
        value: it.value,
        count: it.count,
        percentage: grandTotal > 0 ? Math.round((it.value / grandTotal) * 1000) / 10 : 0
      }));
    }

    const aggType = (measureFieldKey === 'count') ? 'count' : aggregation;
    const aggField = (measureFieldKey === 'count') ? 'id' : measureFieldKey;

    const aggregated = this.groupAndAggregate(rows, groupByFn, aggField, aggType);
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
        Number(r.jumlahPanen || 0) > 0 &&
        sep.komoditasPanen && 
        sep.komoditasPanen.toLowerCase().trim() === cleanCropLower
      );

      schedule.push({
        id: r.reportId || r.id || r.kodeKegiatan || '',
        reportId: r.reportId || r.id || r.kodeKegiatan || '',
        kodeKegiatan: r.kodeKegiatan || '',
        komoditas: cropName,
        lokasiKegiatan: r.lokasiKegiatan || '-',
        lokasiBlok: r.lokasiBlok || '',
        namaPic: r.namaPic || r.idKaryawan || '-',
        idKaryawan: r.idKaryawan || '',
        jumlahBenih: Number(r.jumlahBenih || 0),
        luasLahanM2: Number(r.luasLahanM2 || 0),
        tglTanam: typeof tglTanam === 'string' ? tglTanam : AnalyticsService.formatDateKey_(tglTanam),
        estimasiPanenHst: hst,
        tglEstimasiPanen: calc.estimatedDate,
        daysRemaining: calc.daysRemaining,
        isOverdue: calc.isOverdue,
        isReady: calc.isReady,
        status: calc.status,
        isAlreadyHarvested: isAlreadyHarvested
      });
    });

    // Sort soonest countdown first
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
   * Generates high-level strategic distribution insights focusing on Commercial Sales vs Internal Utilization.
   * Relates key variables: totalHargaRp, jumlahPenjualanUnit, jumlahPanen, tujuanDistribusi, and komoditas.
   * @param {Array<Object>} rows 
   * @param {'day'|'week'|'month'} [interval='day'] 
   * @returns {Object}
   */
  getSalesAnalytics: function(rows, interval = 'day') {
    let totalEksternalRp = 0;
    let totalEksternalUnits = 0;
    let countEksternal = 0;

    let totalInternalSaleRp = 0;
    let totalInternalSaleUnits = 0;
    let countInternalSale = 0;

    let totalPenggunaanUnits = 0;
    let countPenggunaan = 0;

    const commoditySalesMap = {};
    const commodityUsageMap = {};

    (rows || []).forEach(r => {
      const dist = String(r.tujuanDistribusi || '').toLowerCase();
      const revenue = Number(r.totalHargaRp || 0);
      const commercialUnits = Number(r.jumlahPenjualanUnit || (revenue > 0 ? r.jumlahPanen : 0) || 0);
      const usageUnits = Number(r.jumlahUnitPenggunaan || 0);

      // Clean commodity name
      const sep = resolveSeparatedCommodities(r.komoditas, r.komoditasPanen, r.jenisKegiatan);
      const cropName = sep.komoditasPanen || sep.komoditasTanam || r.komoditas || 'Lainnya';

      const isEksternal = dist.includes('eksternal') || (dist === '' && revenue > 0);
      const isInternalSale = dist.includes('internal') && revenue > 0;

      // 1. Accounting for Commercial Sales (External & Internal)
      if (isEksternal) {
        totalEksternalRp += revenue;
        totalEksternalUnits += commercialUnits;
        countEksternal += 1;

        if (!commoditySalesMap[cropName]) commoditySalesMap[cropName] = { revenue: 0, units: 0 };
        commoditySalesMap[cropName].revenue += revenue;
        commoditySalesMap[cropName].units += commercialUnits;
      } else if (isInternalSale) {
        totalInternalSaleRp += revenue;
        totalInternalSaleUnits += commercialUnits;
        countInternalSale += 1;

        if (!commoditySalesMap[cropName]) commoditySalesMap[cropName] = { revenue: 0, units: 0 };
        commoditySalesMap[cropName].revenue += revenue;
        commoditySalesMap[cropName].units += commercialUnits;
      }

      // 2. Accounting for Operational Internal Usage (Using dedicated jumlahUnitPenggunaan)
      let resolvedUsageAmt = 0;
      if (usageUnits > 0) {
        resolvedUsageAmt = usageUnits;
      } else if (dist.includes('penggunaan')) {
        resolvedUsageAmt = Number(r.jumlahPanen || 0);
      } else if (!isEksternal && !isInternalSale && Number(r.jumlahPanen || 0) > 0 && r.jenisKegiatan && r.jenisKegiatan.toLowerCase().includes('panen')) {
        resolvedUsageAmt = Number(r.jumlahPanen || 0);
      }

      if (resolvedUsageAmt > 0) {
        totalPenggunaanUnits += resolvedUsageAmt;
        countPenggunaan += 1;

        if (!commodityUsageMap[cropName]) commodityUsageMap[cropName] = { units: 0 };
        commodityUsageMap[cropName].units += resolvedUsageAmt;
      }
    });

    const grandTotalRp = totalEksternalRp + totalInternalSaleRp;
    const totalCommercialUnits = totalEksternalUnits + totalInternalSaleUnits;
    const grandTotalUnits = totalCommercialUnits + totalPenggunaanUnits;

    const commercialRate = grandTotalUnits > 0 ? Number(((totalCommercialUnits / grandTotalUnits) * 100).toFixed(1)) : 0;
    const internalUsageRate = grandTotalUnits > 0 ? Number(((totalPenggunaanUnits / grandTotalUnits) * 100).toFixed(1)) : 0;
    const avgPricePerUnit = totalCommercialUnits > 0 ? Math.round(grandTotalRp / totalCommercialUnits) : 0;

    // Top Selling Crop
    let topSellingCrop = '-';
    let topSellingRp = 0;
    Object.keys(commoditySalesMap).forEach(crop => {
      if (commoditySalesMap[crop].revenue > topSellingRp) {
        topSellingRp = commoditySalesMap[crop].revenue;
        topSellingCrop = crop;
      }
    });
    const topSellingPercentage = grandTotalRp > 0 ? Math.round((topSellingRp / grandTotalRp) * 100) : 0;

    // Top Internal Usage Crop
    let topUsageCrop = '-';
    let topUsageUnits = 0;
    Object.keys(commodityUsageMap).forEach(crop => {
      if (commodityUsageMap[crop].units > topUsageUnits) {
        topUsageUnits = commodityUsageMap[crop].units;
        topUsageCrop = crop;
      }
    });

    // Breakdown for Charts:
    // 1. By Monetary Value (Rp)
    const valueBreakdown = [
      {
        channel: 'Penjualan Eksternal',
        value: totalEksternalRp,
        units: totalEksternalUnits,
        count: countEksternal,
        percentage: grandTotalRp > 0 ? Number(((totalEksternalRp / grandTotalRp) * 100).toFixed(1)) : 0,
        color: '#2563EB'
      },
      {
        channel: 'Penjualan Internal',
        value: totalInternalSaleRp,
        units: totalInternalSaleUnits,
        count: countInternalSale,
        percentage: grandTotalRp > 0 ? Number(((totalInternalSaleRp / grandTotalRp) * 100).toFixed(1)) : 0,
        color: '#10B981'
      }
    ];

    // 2. By Volume Allocation (Units / Kg)
    const volumeBreakdown = [
      {
        channel: 'Penjualan Eksternal',
        units: totalEksternalUnits,
        percentage: grandTotalUnits > 0 ? Number(((totalEksternalUnits / grandTotalUnits) * 100).toFixed(1)) : 0,
        color: '#2563EB'
      },
      {
        channel: 'Penjualan Internal',
        units: totalInternalSaleUnits,
        percentage: grandTotalUnits > 0 ? Number(((totalInternalSaleUnits / grandTotalUnits) * 100).toFixed(1)) : 0,
        color: '#10B981'
      },
      {
        channel: 'Penggunaan Operasional',
        units: totalPenggunaanUnits,
        percentage: grandTotalUnits > 0 ? Number(((totalPenggunaanUnits / grandTotalUnits) * 100).toFixed(1)) : 0,
        color: '#F59E0B'
      }
    ];

    // 3. Automated Executive Strategic Insights
    const insights = [
      {
        tag: 'Komersialisasi',
        title: `Tingkat Komersialisasi ${commercialRate}%`,
        description: grandTotalUnits > 0 
          ? `Sebanyak ${commercialRate}% (${totalCommercialUnits.toLocaleString('id-ID')} unit/Kg) dari total hasil panen dialokasikan untuk penjualan komersial, menghasilkan pendapatan Rp ${grandTotalRp.toLocaleString('id-ID')}.`
          : 'Belum ada catatan alokasi komersial pada periode ini.',
        variant: 'primary'
      },
      {
        tag: 'Pemanfaatan Mandiri',
        title: `Penggunaan Internal ${internalUsageRate}%`,
        description: grandTotalUnits > 0 
          ? `Sebanyak ${internalUsageRate}% (${totalPenggunaanUnits.toLocaleString('id-ID')} unit/Kg) dialokasikan untuk kebutuhan operasional mandiri seperti pembibitan, pakan ternak, dan konsumsi perkebunan.`
          : 'Tidak ada alokasi penggunaan internal pada periode ini.',
        variant: 'warning'
      },
      {
        tag: 'Komoditas Unggulan',
        title: `${topSellingCrop} Penggerak Pendapatan`,
        description: topSellingRp > 0 
          ? `Komoditas ${topSellingCrop} menyumbang porsi terbesar yaitu Rp ${topSellingRp.toLocaleString('id-ID')} (${topSellingPercentage}% dari total penjualan komersial).`
          : 'Belum ada komoditas dengan pendapatan komersial tercatat.',
        variant: 'success'
      },
      {
        tag: 'Efisiensi Nilai',
        title: `Realisasi Rata-rata Rp ${avgPricePerUnit.toLocaleString('id-ID')}/Unit`,
        description: avgPricePerUnit > 0 
          ? `Rata-rata nilai realisasi yang diperoleh adalah Rp ${avgPricePerUnit.toLocaleString('id-ID')} per unit/Kg komoditas komersial.`
          : 'Belum tersedia kalkulasi harga rata-rata.',
        variant: 'neutral'
      }
    ];

    return {
      grandTotalRp: grandTotalRp,
      totalEksternalRp: totalEksternalRp,
      totalInternalSaleRp: totalInternalSaleRp,
      totalCommercialUnits: totalCommercialUnits,
      totalPenggunaanUnits: totalPenggunaanUnits,
      grandTotalUnits: grandTotalUnits,
      commercialRate: commercialRate,
      internalUsageRate: internalUsageRate,
      avgPricePerUnit: avgPricePerUnit,
      salesCount: countEksternal + countInternalSale,
      usageCount: countPenggunaan,
      topSellingCrop: topSellingCrop,
      topSellingRp: topSellingRp,
      topUsageCrop: topUsageCrop,
      topUsageUnits: topUsageUnits,
      valueBreakdown: valueBreakdown,
      volumeBreakdown: volumeBreakdown,
      insights: insights
    };
  },

  /**
   * Generates comprehensive Risk & Obstacle (Kendala & Upaya) Intelligence for Managers.
   * Analyzes operational bottlenecks, severity levels, risk categories, and mitigation efforts.
   * @param {Array<Object>} rows
   * @returns {Object}
   */
  getRiskAndObstacleAnalytics: function(rows) {
    const totalReports = (rows || []).length;

    /**
     * ROBUST OBSTACLE CLASSIFIER
     * Strategy: Score-based multi-signal matching (no LLM required).
     * Each category has a keyword dictionary with weights:
     *   - High weight (3): Highly specific, unambiguous root words
     *   - Medium weight (2): Common words that strongly suggest the category
     *   - Low weight (1): Contextual clues, might appear in other categories
     *
     * Tokenization normalizes typos through prefix-matching and common
     * Indonesian morphological affixes (me-, ber-, ke-, di-, -kan, -an, -i).
     *
     * The category accumulating the highest score wins.
     */
    const CATEGORY_RULES = [
      {
        name: 'Hama & Penyakit',
        color: '#ef4444',
        signals: [
          // High specificity — unambiguous
          { words: ['hama','ulat','wereng','belalang','tikus','tungau','kutu','lalat','ngengat','nematoda'], weight: 3 },
          { words: ['jamur','cendawan','oomycete','antraknosa','layu fusarium','layu bakteri','embun tepung','bercak daun','hawar','karat daun'], weight: 3 },
          { words: ['busuk','busukan','membusuk','kebusukan'], weight: 3 },
          { words: ['serangan','menyerang','diserang','terinvasi'], weight: 2 },
          { words: ['penyakit','sakit','layu','menguning','kerdil','mati pucuk'], weight: 2 },
          { words: ['semprot','disemprot','menyemprot','penyemprotan'], weight: 1 },
          { words: ['pestisida','insektisida','fungisida','herbisida','akarisida','nematisida'], weight: 1 },
        ]
      },
      {
        name: 'Cuaca & Iklim',
        color: '#f59e0b',
        signals: [
          { words: ['cuaca','iklim','musim','anomali cuaca'], weight: 3 },
          { words: ['hujan','kehujanan','banjir','tergenang','meluap','longsor','erosi'], weight: 3 },
          { words: ['panas','terik','kemarau','kekeringan','kering','tidak ada hujan'], weight: 3 },
          { words: ['angin','badai','topan','petir','mendung','kabut'], weight: 3 },
          { words: ['becek','lumpur','berlumpur','tergenang','genangan'], weight: 2 },
          { words: ['suhu','temperatur','lembab','kelembaban'], weight: 2 },
        ]
      },
      {
        name: 'Irigasi & Air',
        color: '#06b6d4',
        signals: [
          { words: ['irigasi','drainase','saluran air','saluran irigasi'], weight: 3 },
          { words: ['pipa','selang','kran','katup','valve','sambungan pipa'], weight: 3 },
          { words: ['pompa','pompa air','pompa celup','genset air'], weight: 3 },
          { words: ['sumur','embung','kolam tampung','reservoir'], weight: 3 },
          { words: ['air mati','tidak ada air','kekurangan air','pasokan air'], weight: 3 },
          { words: ['bocor','kebocoran','merembes','pecah'], weight: 2 },
          // 'air' alone is low weight — too ambiguous
          { words: ['air'], weight: 1 },
        ]
      },
      {
        name: 'Peralatan & Mesin',
        color: '#8b5cf6',
        signals: [
          { words: ['traktor','cultivator','bajak','rotary','ridger'], weight: 3 },
          { words: ['mesin babat','mesin rumput','chainsaw','gergaji mesin','alat berat'], weight: 3 },
          { words: ['genset','generator','mesin diesel'], weight: 3 },
          { words: ['rusak','kerusakan','macet','mati','tidak berfungsi','tidak nyala'], weight: 2 },
          { words: ['busi','onderdil','suku cadang','sparepart','karburator','oli','bahan bakar'], weight: 2 },
          { words: ['solar','bensin','bbm'], weight: 2 },
          { words: ['alat','mesin','peralatan'], weight: 1 },
          { words: ['cangkul','garpu','sekop','sabit'], weight: 1 },
        ]
      },
      {
        name: 'Bibit & Pupuk',
        color: '#10b981',
        signals: [
          { words: ['pupuk','urea','npk','dolomit','kapur pertanian','sp-36','kcl','phonska'], weight: 3 },
          { words: ['bibit','benih','seedling','persemaian','pembibitan'], weight: 3 },
          { words: ['pestisida','fungisida','herbisida','insektisida','rodentisida'], weight: 2 },
          { words: ['stok habis','kehabisan','tidak ada stok','kekurangan bahan'], weight: 2 },
          { words: ['nutrisi','unsur hara','mikronutrien','defisiensi','klorotik'], weight: 2 },
          { words: ['obat','racun','kimia pertanian'], weight: 1 },
        ]
      },
      {
        name: 'Tenaga Kerja & Logistik',
        color: '#ec4899',
        signals: [
          { words: ['kurang orang','kekurangan tenaga','tidak ada pekerja','tidak ada tenaga'], weight: 3 },
          { words: ['absen','tidak masuk','bolos','sakit','izin tidak masuk'], weight: 3 },
          { words: ['terlambat','telat','tidak tepat waktu'], weight: 2 },
          { words: ['transport','angkutan','kendaraan','mobil','truk'], weight: 2 },
          { words: ['pekerja','buruh','tenaga harian','pemetik','operator'], weight: 1 },
          { words: ['orang','personil','sdm','staf'], weight: 1 },
        ]
      },
    ];

    // Normalize text: lowercase, remove punctuation, normalize whitespace
    const normalize = (text) => {
      return String(text || '').toLowerCase()
        .replace(/[^\w\s]/g, ' ')     // punctuation → space
        .replace(/\s+/g, ' ')         // multiple spaces → single
        .trim();
    };

    // Strip common Indonesian affixes to get an approximate stem for matching
    const stemTokens = (normalized) => {
      const tokens = normalized.split(' ');
      const allForms = new Set(tokens);
      tokens.forEach(tok => {
        // Prefixes: me-, ber-, ter-, ke-, di-, pe-, se-
        allForms.add(tok.replace(/^(me|ber|ter|ke|di|pe|se|menge|memper|me)/, ''));
        // Suffixes: -kan, -an, -i, -nya, -lah, -kah
        allForms.add(tok.replace(/(kan|an|nya|lah|kah|i)$/, ''));
        // Both
        allForms.add(tok.replace(/^(me|ber|ter|ke|di|pe|se)/, '').replace(/(kan|an|nya|i)$/, ''));
      });
      return Array.from(allForms).filter(s => s.length > 2);
    };

    const classifyObstacleCategory = (text) => {
      if (!text || !text.trim()) return 'Operasional Umum';

      const normalized = normalize(text);
      const tokens = stemTokens(normalized);
      const tokenSet = new Set(tokens);

      const scores = {};
      CATEGORY_RULES.forEach(rule => {
        let score = 0;
        rule.signals.forEach(sig => {
          sig.words.forEach(keyword => {
            // Check full phrase match first (higher confidence)
            if (normalized.includes(keyword)) {
              score += sig.weight * 2;
            } else {
              // Check if any stemmed token starts with or equals the keyword stem
              const kwNorm = normalize(keyword);
              tokens.forEach(tok => {
                if (tok === kwNorm || (kwNorm.length >= 4 && tok.startsWith(kwNorm.substring(0, Math.ceil(kwNorm.length * 0.75))))) {
                  score += sig.weight;
                }
              });
            }
          });
        });
        if (score > 0) scores[rule.name] = (scores[rule.name] || 0) + score;
      });

      // Return highest-scoring category, or fallback
      const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      return entries.length > 0 ? entries[0][0] : 'Operasional Umum';
    };

    const CATEGORY_COLORS = {};
    CATEGORY_RULES.forEach(r => { CATEGORY_COLORS[r.name] = r.color; });
    CATEGORY_COLORS['Operasional Umum'] = '#64748b';
    CATEGORY_COLORS['Isu Kritis Lapangan'] = '#dc2626';

    // Validation set: what "clean" empty/ok answers look like
    const EMPTY_KENDALA_PATTERNS = /^(\s*|-|nihil|tidak ada|tidak ada kendala|aman|baik|ok|lancar|tidak ada hambatan|tidak ada masalah|normal|selesai)$/i;
    const EMPTY_UPAYA_PATTERNS = /^(\s*|-|nihil|tidak ada|tidak ada upaya|sudah|-)$/i;

    let reportsWithObstacleCount = 0;
    let mitigatedCount = 0;
    const categoryMap = {};
    const obstacleList = [];
    // Per-employee obstacle count
    const employeeObstacleMap = {};

    (rows || []).forEach(r => {
      const rawKendala = String(r.kendala || '').trim();
      const rawUpaya = String(r.upaya || '').trim();
      const severity = String(r.severity || 'NORMAL').toUpperCase();

      const hasKendala = rawKendala.length >= 3 && !EMPTY_KENDALA_PATTERNS.test(rawKendala);
      const hasUpaya = rawUpaya.length >= 3 && !EMPTY_UPAYA_PATTERNS.test(rawUpaya);
      const isElevated = (severity === 'URGENT' || severity === 'WARNING') && hasKendala;

      if (hasKendala || isElevated) {
        reportsWithObstacleCount++;
        if (hasUpaya) mitigatedCount++;

        const category = classifyObstacleCategory(rawKendala);
        categoryMap[category] = (categoryMap[category] || 0) + 1;

        const loc = r.lokasiKegiatan || 'Lokasi Umum';
        const sep = resolveSeparatedCommodities(r.komoditas, r.komoditasPanen, r.jenisKegiatan);
        const cropName = sep.komoditasTanam || sep.komoditasPanen || r.komoditas || 'Umum';
        const pic = r.namaPic || r.idKaryawan || 'Staf Lapangan';

        // Track per-employee obstacle counts
        if (!employeeObstacleMap[pic]) employeeObstacleMap[pic] = { count: 0, categories: {} };
        employeeObstacleMap[pic].count++;
        employeeObstacleMap[pic].categories[category] = (employeeObstacleMap[pic].categories[category] || 0) + 1;

        obstacleList.push({
          reportId: r.reportId || r.kodeKegiatan || '',
          date: r.timestamp || r.date || '',
          pic: pic,
          division: r.bidangDivisi || '-',
          sector: loc,
          commodity: cropName,
          category: category,
          severity: severity,
          kendala: rawKendala,
          upaya: hasUpaya ? rawUpaya : null,
          hasUpaya: hasUpaya
        });
      }
    });

    // Sort by severity priority then date
    obstacleList.sort((a, b) => {
      const score = s => (s === 'URGENT' ? 3 : s === 'WARNING' ? 2 : 1);
      return score(b.severity) - score(a.severity);
    });

    const categoryBreakdown = Object.keys(categoryMap).map(cat => ({
      category: cat,
      count: categoryMap[cat],
      color: CATEGORY_COLORS[cat] || '#64748b'
    })).sort((a, b) => b.count - a.count);

    return {
      totalReports: totalReports,
      reportsWithObstacleCount: reportsWithObstacleCount,
      mitigatedCount: mitigatedCount,
      mitigationRate: reportsWithObstacleCount > 0
        ? Number(((mitigatedCount / reportsWithObstacleCount) * 100).toFixed(1))
        : 100,
      categoryBreakdown: categoryBreakdown,
      employeeObstacleMap: employeeObstacleMap,
      activeObstacles: obstacleList
    };
  },

  /**
   * Generates multi-dimensional commodity and operational analytics with card-local independent scoping.
   * Supports:
   * 1. Tren Mode (time-series single crop or dual tanam vs panen)
   * 2. Multi-Dimensional Breakdown Mode:
   *    - Dimension: 'komoditas' | 'namaPic' (Karyawan) | 'lokasiKegiatan' (Sektor) | 'bidangDivisi'
   *    - Multi-Filter: cropFilter ('all' or specific crop like 'Jagung Tebon'), Division, Location chips, and date bounds
   *    - Measure: 'jumlahBenih', 'jumlahPanen', 'luasLahanM2', 'totalHargaRp', 'jumlahPenjualanUnit', 'count'
   * @param {Object} [params]
   * @returns {Object}
   */
  getCommodityAnalysis: function(params = {}) {
    const bounds = this.resolvePeriodBounds_(params);
    const dFrom = bounds.dFrom;
    const dTo = bounds.dTo;
    const interval = bounds.interval;
    const periodLabel = bounds.periodLabel;
    const mode = params.mode || 'tren'; // 'tren' | 'breakdown'
    const dimension = params.dimension || 'komoditas'; // 'komoditas' | 'namaPic' | 'lokasiKegiatan'
    const measure = params.measure || (mode === 'breakdown' ? 'jumlahPanen' : 'jumlahBenih');
    const sort = params.sort || 'val_desc'; // 'val_desc' | 'val_asc' | 'alpha_asc' | 'alpha_desc'

    // 1. Fetch raw operational rows within the decoupled date bounds
    const rawRows = SpreadsheetRepository.getAllOperationalRows(dFrom, dTo);

    // Ensure clean separated commodities on all rows
    rawRows.forEach(r => {
      const sep = resolveSeparatedCommodities(r.komoditas, r.komoditasPanen, r.jenisKegiatan);
      r.komoditasTanam = sep.komoditasTanam;
      r.komoditasPanen = sep.komoditasPanen;
      r.komoditasClean = sep.komoditasTanam || sep.komoditasPanen || r.komoditas || '';
    });

    // 2. Apply any secondary card-local filter chips
    const filteredRows = this.applyFilters(rawRows, params.filters);

    // 3. Build Master clean list of crops
    const defaultCrops = [
      'Alpukat', 'Pisang', 'Jagung Manis', 'Terong', 'Cabe', 'Jagung Tebon',
      'Jagung Hibrida', 'Edamame', 'Pembibitan Kopi', 'Pembibitan Pala'
    ];
    const presentCrops = new Set(defaultCrops);
    filteredRows.forEach(r => {
      if (r.komoditasTanam && r.komoditasTanam !== 'Lainnya' && !r.komoditasTanam.includes('(')) presentCrops.add(r.komoditasTanam);
      if (r.komoditasPanen && r.komoditasPanen !== 'Lainnya' && !r.komoditasPanen.includes('(')) presentCrops.add(r.komoditasPanen);
      if (r.komoditasClean && r.komoditasClean !== 'Lainnya' && !r.komoditasClean.includes('(')) presentCrops.add(r.komoditasClean);
    });
    const cropList = Array.from(presentCrops).filter(c => c && !c.includes('(Tanam)') && !c.includes('(Panen)'));

    const rawCropFilter = params.cropFilter || '';
    const selectedCrop = (rawCropFilter && rawCropFilter !== 'all') ? rawCropFilter : (cropList.includes('Pisang') ? 'Pisang' : cropList[0] || 'Pisang');

    let tanamTrend = null;
    let panenTrend = null;
    let singleTrend = null;
    let breakdownList = [];
    let cropParticipation = [];
    let dataPointCount = 0;

    if (mode === 'tren') {
      // ==========================================
      // TREN MODE: Time-series of selected single crop
      // ==========================================
      const cropRows = filteredRows.filter(r => {
        const cT = (r.komoditasTanam || '').toLowerCase();
        const cP = (r.komoditasPanen || '').toLowerCase();
        const cC = (r.komoditasClean || r.komoditas || '').toLowerCase();
        const target = selectedCrop.toLowerCase();
        return cT === target || cP === target || cC === target;
      });

      let dateField = 'timestamp';
      if (measure === 'jumlahBenih' || measure === 'luasLahanM2') dateField = 'tglTanam';
      else if (measure === 'jumlahPanen') dateField = 'tglPanen';
      else if (measure === 'totalHargaRp' || measure === 'jumlahPenjualanUnit') dateField = 'tglPenjualan';

      singleTrend = this.getTimeseries(cropRows, measure, interval, 'sum', dateField);
      dataPointCount = singleTrend?.labels?.length || 0;

      // Participation panel in Tren mode: Scoped to selectedCrop
      const empParticipationMap = {};
      filteredRows.forEach(r => {
        const cT = (r.komoditasTanam || '').toLowerCase();
        const cP = (r.komoditasPanen || '').toLowerCase();
        const cC = (r.komoditasClean || r.komoditas || '').toLowerCase();
        const target = selectedCrop.toLowerCase();
        if (cT !== target && cP !== target && cC !== target) return;

        const empId = r.idKaryawan;
        if (!empId) return;

        if (!empParticipationMap[empId]) {
          empParticipationMap[empId] = {
            idKaryawan: empId,
            namaPic: r.namaPic || empId,
            bidangDivisi: r.bidangDivisi || 'Umum',
            count: 0
          };
        }
        empParticipationMap[empId].count += 1;
      });

      cropParticipation = Object.values(empParticipationMap).map(p => ({
        key: p.idKaryawan,
        label: p.namaPic,
        sublabel: `${p.idKaryawan} • ${p.bidangDivisi}`,
        value: p.count,
        unit: 'Laporan'
      })).sort((a, b) => b.value - a.value);

    } else {
      // ==========================================
      // BREAKDOWN MODE: Multi-Dimensional Aggregation
      // ==========================================
      // Apply crop filter if a specific crop is selected (e.g. 'Jagung Tebon')
      let rowsToBreakdown = filteredRows;
      if (rawCropFilter && rawCropFilter !== 'all') {
        const targetCrop = rawCropFilter.toLowerCase().trim();
        rowsToBreakdown = filteredRows.filter(r => {
          const cT = (r.komoditasTanam || '').toLowerCase().trim();
          const cP = (r.komoditasPanen || '').toLowerCase().trim();
          const cC = (r.komoditasClean || r.komoditas || '').toLowerCase().trim();
          return cT === targetCrop || cP === targetCrop || cC === targetCrop;
        });
      }

      const measureKey = (measure === 'tanam_vs_panen' || !measure) ? 'jumlahPanen' : measure;

      // Group by active dimension
      if (dimension === 'namaPic') {
        // Group by Employee Name & ID
        const empGroupByFn = (r) => {
          const name = r.namaPic || r.idKaryawan || 'Staf Tanpa Nama';
          return name.trim();
        };
        breakdownList = this.getBreakdown(rowsToBreakdown, measureKey, 'sum', empGroupByFn);

      } else if (dimension === 'lokasiKegiatan') {
        // Group by Location / Sector
        const locGroupByFn = (r) => {
          return (r.lokasiKegiatan && String(r.lokasiKegiatan).trim().length > 0) ? String(r.lokasiKegiatan).trim() : 'Lokasi Umum';
        };
        breakdownList = this.getBreakdown(rowsToBreakdown, measureKey, 'sum', locGroupByFn);

      } else if (dimension === 'lokasiBlok') {
        // Group by Specific Sub-Block
        const blokGroupByFn = (r) => {
          const b = r.lokasiBlok || r.lokasiBlokPanen || r.lokasiBlokTanam;
          return (b && String(b).trim().length > 0) ? String(b).trim() : 'Blok Umum';
        };
        breakdownList = this.getBreakdown(rowsToBreakdown, measureKey, 'sum', blokGroupByFn);

      } else if (dimension === 'jenisKegiatan') {
        // Group by Activity Type
        const jkGroupByFn = (r) => {
          return (r.jenisKegiatan && String(r.jenisKegiatan).trim().length > 0) ? String(r.jenisKegiatan).trim() : 'Aktivitas Umum';
        };
        breakdownList = this.getBreakdown(rowsToBreakdown, measureKey, 'sum', jkGroupByFn);

      } else if (dimension === 'bidangDivisi') {
        // Group by Division
        const divGroupByFn = (r) => {
          return (r.bidangDivisi && String(r.bidangDivisi).trim().length > 0) ? String(r.bidangDivisi).trim() : 'Divisi Umum';
        };
        breakdownList = this.getBreakdown(rowsToBreakdown, measureKey, 'sum', divGroupByFn);

      } else {
        // Default dimension: 'komoditas'
        const isTanamMeasure = ['jumlahBenih', 'kerapatanTanam'].includes(measureKey);
        const isPanenSalesMeasure = ['jumlahPanen', 'totalHargaRp', 'jumlahPenjualanUnit', 'produktivitasPanen', 'hargaRataRata'].includes(measureKey);

        const cropGroupByFn = (r) => {
          if (isTanamMeasure) {
            return (r.komoditasTanam && r.komoditasTanam !== 'Lainnya') ? r.komoditasTanam : (r.komoditasClean || r.komoditas || 'Tanaman');
          }
          if (isPanenSalesMeasure) {
            return (r.komoditasPanen && r.komoditasPanen !== 'Lainnya') ? r.komoditasPanen : (r.komoditasClean || r.komoditas || 'Hasil Panen');
          }
          if (measureKey === 'luasLahanM2') {
            if (Number(r.luasLahanPanenM2 || 0) > 0 && r.komoditasPanen) return r.komoditasPanen;
            if (Number(r.luasLahanM2 || 0) > 0 && r.komoditasTanam) return r.komoditasTanam;
          }
          return r.komoditasClean || r.komoditas || 'Komoditas Umum';
        };

        breakdownList = this.getBreakdown(rowsToBreakdown, measureKey, 'sum', cropGroupByFn);
      }

      // User-controlled sort
      if (sort === 'val_asc') {
        breakdownList.sort((a, b) => a.value - b.value);
      } else if (sort === 'alpha_asc') {
        breakdownList.sort((a, b) => a.label.localeCompare(b.label));
      } else if (sort === 'alpha_desc') {
        breakdownList.sort((a, b) => b.label.localeCompare(a.label));
      } else {
        // default 'val_desc'
        breakdownList.sort((a, b) => b.value - a.value);
      }

      dataPointCount = breakdownList.length;

      // Dynamic Participation Panel for Breakdown Mode
      if (dimension === 'namaPic') {
        // List staff with their division and report count
        const empSummaryMap = {};
        rowsToBreakdown.forEach(r => {
          const empId = r.idKaryawan || r.namaPic;
          if (!empId) return;
          if (!empSummaryMap[empId]) {
            empSummaryMap[empId] = {
              key: empId,
              label: r.namaPic || empId,
              sublabel: `${r.idKaryawan || '-'} • ${r.bidangDivisi || 'Umum'}`,
              value: 0,
              unit: 'Laporan'
            };
          }
          empSummaryMap[empId].value += 1;
        });
        cropParticipation = Object.values(empSummaryMap).sort((a, b) => b.value - a.value);

      } else if (dimension === 'lokasiKegiatan') {
        // List sectors with employee headcount
        const sectorMap = {};
        rowsToBreakdown.forEach(r => {
          const loc = r.lokasiKegiatan || 'Lokasi Umum';
          const empId = r.idKaryawan || r.namaPic;
          if (!sectorMap[loc]) sectorMap[loc] = new Set();
          if (empId) sectorMap[loc].add(empId);
        });
        cropParticipation = Object.keys(sectorMap).map(loc => ({
          key: loc,
          label: loc,
          sublabel: '',
          value: sectorMap[loc].size,
          unit: 'Staf'
        })).sort((a, b) => b.value - a.value);

      } else if (dimension === 'lokasiBlok') {
        // List blocks with report frequency
        const blockMap = {};
        rowsToBreakdown.forEach(r => {
          const b = r.lokasiBlok || r.lokasiBlokPanen || r.lokasiBlokTanam || 'Blok Umum';
          const loc = r.lokasiKegiatan || 'Sektor';
          if (!blockMap[b]) {
            blockMap[b] = { key: b, label: b, sublabel: loc, value: 0, unit: 'Laporan' };
          }
          blockMap[b].value += 1;
        });
        cropParticipation = Object.values(blockMap).sort((a, b) => b.value - a.value);

      } else if (dimension === 'jenisKegiatan') {
        // List activity types with report count
        const jkMap = {};
        rowsToBreakdown.forEach(r => {
          const jk = r.jenisKegiatan || 'Aktivitas Umum';
          if (!jkMap[jk]) {
            jkMap[jk] = { key: jk, label: jk, sublabel: '', value: 0, unit: 'Laporan' };
          }
          jkMap[jk].value += 1;
        });
        cropParticipation = Object.values(jkMap).sort((a, b) => b.value - a.value);

      } else if (dimension === 'bidangDivisi') {
        // List divisions with employee headcount
        const divMap = {};
        rowsToBreakdown.forEach(r => {
          const div = r.bidangDivisi || 'Umum';
          const empId = r.idKaryawan || r.namaPic;
          if (!divMap[div]) divMap[div] = new Set();
          if (empId) divMap[div].add(empId);
        });
        cropParticipation = Object.keys(divMap).map(div => ({
          key: div,
          label: div,
          sublabel: '',
          value: divMap[div].size,
          unit: 'Staf'
        })).sort((a, b) => b.value - a.value);

      } else {
        // Default: Cross-crop staff comparison
        const cropParticipationMap = {};
        rowsToBreakdown.forEach(r => {
          const empId = r.idKaryawan;
          if (!empId) return;

          const crops = new Set();
          if (r.komoditasTanam && r.komoditasTanam !== 'Lainnya' && !r.komoditasTanam.includes('(')) crops.add(r.komoditasTanam);
          if (r.komoditasPanen && r.komoditasPanen !== 'Lainnya' && !r.komoditasPanen.includes('(')) crops.add(r.komoditasPanen);
          if (crops.size === 0 && r.komoditasClean && !r.komoditasClean.includes('(')) crops.add(r.komoditasClean);

          crops.forEach(c => {
            if (!cropParticipationMap[c]) cropParticipationMap[c] = new Set();
            cropParticipationMap[c].add(empId);
          });
        });

        cropParticipation = Object.keys(cropParticipationMap).map(cropName => ({
          key: cropName,
          label: cropName,
          sublabel: '',
          value: cropParticipationMap[cropName].size,
          unit: 'Staf'
        })).sort((a, b) => b.value - a.value);
      }
    }

    return {
      period: {
        code: bounds.periodCode,
        label: periodLabel,
        startDate: this.formatDateKey_(dFrom),
        endDate: this.formatDateKey_(dTo),
        interval: interval
      },
      mode: mode,
      dimension: dimension,
      measure: measure,
      sort: sort,
      cropList: cropList,
      selectedCrop: (rawCropFilter && rawCropFilter !== 'all') ? rawCropFilter : 'all',
      rawCropFilter: rawCropFilter,
      tanamTrend: tanamTrend,
      panenTrend: panenTrend,
      singleTrend: singleTrend,
      breakdown: breakdownList,
      participation: cropParticipation,
      scopeMode: mode === 'tren' ? 'crop_specific' : 'multi_dimension',
      dataPointCount: dataPointCount,
      totalRows: filteredRows.length
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
    const bounds = this.resolvePeriodBounds_(params);
    const dFrom = bounds.dFrom;
    const dTo = bounds.dTo;
    const interval = bounds.interval;
    const periodLabel = bounds.periodLabel;
    const now = new Date();

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

    // 5. Commodity Analysis — Decoupled & Scoped Module (Phase 24)
    const commodityAnalysis = this.getCommodityAnalysis(params);

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

    // 8. Risk & Field Obstacle Intelligence (Requirement 5)
    const riskAnalytics = this.getRiskAndObstacleAnalytics(filteredRows);

    // 9. Inactive Sectors Early Warning (Config-Driven & Canonical Locations)
    let MASTER_SECTORS = ['Jonggol', 'Cikalong', 'Quilling', 'Jakarta'];
    if (typeof ConfigRepository !== 'undefined' && ConfigRepository.getLokasiOptions) {
      try {
        const configuredLocs = ConfigRepository.getLokasiOptions();
        if (Array.isArray(configuredLocs) && configuredLocs.length > 0) {
          MASTER_SECTORS = configuredLocs;
        }
      } catch (e) {
        Logger.log('AnalyticsService: could not fetch getLokasiOptions: ' + e);
      }
    }

    const sectorLastReportMap = {};
    (allRows || []).forEach(r => {
      const sec = String(r.lokasiKegiatan || '').trim();
      if (!sec) return;
      const rTime = r.timestamp_raw instanceof Date ? r.timestamp_raw : (r.timestamp ? new Date(r.timestamp) : null);
      if (rTime && !isNaN(rTime.getTime())) {
        const key = sec.toLowerCase();
        if (!sectorLastReportMap[key] || rTime > sectorLastReportMap[key]) {
          sectorLastReportMap[key] = rTime;
        }
      }
    });

    const inactiveSectors = [];
    const nowTime = now.getTime();
    MASTER_SECTORS.forEach(secName => {
      const lowerSec = secName.toLowerCase();
      let lastDate = sectorLastReportMap[lowerSec];
      if (!lastDate) {
        const matchingKey = Object.keys(sectorLastReportMap).find(k => k === lowerSec || k.includes(lowerSec) || lowerSec.includes(k));
        if (matchingKey) lastDate = sectorLastReportMap[matchingKey];
      }

      if (!lastDate) {
        inactiveSectors.push({ sector: secName, daysInactive: 99, lastReportDate: 'Belum Ada Laporan' });
      } else {
        const daysDiff = Math.floor((nowTime - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff >= 3) {
          inactiveSectors.push({
            sector: secName,
            daysInactive: daysDiff,
            lastReportDate: AnalyticsService.formatDateKey_(lastDate)
          });
        }
      }
    });

    return {
      period: {
        code: bounds.periodCode,
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
      commodityAnalysis: commodityAnalysis,
      harvestSchedule: {
        activeList: activeHarvests.slice(0, 30),
        totalActive: activeHarvests.length,
        readyCount: readyHarvestsCount,
        overdueCount: overdueHarvestsCount
      },
      salesAnalytics: salesAnalytics,
      riskAnalytics: riskAnalytics,
      inactiveSectors: inactiveSectors
    };
  }
};

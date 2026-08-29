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
   * Normalizes and validates incoming analytics query parameters against canonical catalog.
   * Enforces max 5 filters, max 5 sorts, deduplication, and legacy compatibility.
   * @param {Object} rawQuery
   * @returns {Object}
   */
  normalizeAnalyticsQuery: function(rawQuery = {}) {
    const mode = (rawQuery.mode === 'breakdown') ? 'breakdown' : 'tren';
    let measureKey = rawQuery.measureKey || rawQuery.measure || (mode === 'breakdown' ? 'jumlahPanen' : 'jumlahBenih');
    let groupByKey = rawQuery.groupByKey || rawQuery.dimension || 'komoditas';
    const interval = rawQuery.interval || 'day';
    const aggregation = rawQuery.aggregation || 'sum';

    // 1. Validate / sanitize measureKey
    const measureDesc = (typeof getFieldDescriptor === 'function') ? getFieldDescriptor(measureKey) : null;
    if (!measureDesc && measureKey !== 'count' && measureKey !== 'distinctEmployees') {
      measureKey = 'jumlahPanen';
    }

    // 2. Validate / sanitize groupByKey
    const groupDesc = (typeof getFieldDescriptor === 'function') ? getFieldDescriptor(groupByKey) : null;
    if (!groupDesc && groupByKey !== 'komoditas') {
      groupByKey = 'komoditas';
    }

    // 3. Normalize filters (max 5 active conjunctive filters)
    let rawFilters = [];
    if (Array.isArray(rawQuery.filters)) {
      rawFilters = rawQuery.filters;
    } else if (rawQuery.filters && typeof rawQuery.filters === 'object') {
      rawFilters = Object.values(rawQuery.filters);
    }

    // Map legacy cropFilter if provided and not already present
    if (rawQuery.cropFilter && rawQuery.cropFilter !== 'all' && !rawFilters.some(f => f && f.fieldKey === 'komoditas')) {
      rawFilters.push({
        fieldKey: 'komoditas',
        operator: 'eq',
        value: rawQuery.cropFilter
      });
    }

    const cleanFilters = [];
    rawFilters.slice(0, 5).forEach(f => {
      if (!f || !f.fieldKey) return;
      const fieldKey = String(f.fieldKey).trim();
      const op = String(f.operator || 'eq').trim().toLowerCase();
      const val = f.value;

      // Skip empty string or undefined values for operators that require values
      if (op !== 'empty' && op !== 'not_empty') {
        if (val === undefined || val === null || val === '') return;
        if (Array.isArray(val) && val.length === 0) return;
        if (typeof val === 'object' && !Array.isArray(val) && op === 'between') {
          if ((val.min === '' || val.min === undefined || val.min === null) &&
              (val.max === '' || val.max === undefined || val.max === null)) {
            return;
          }
        }
      }

      cleanFilters.push({
        fieldKey: fieldKey,
        operator: op,
        value: val
      });
    });

    // 4. Normalize sorts (max 5 levels, no duplicate fields)
    let cleanSorts = [];
    if (Array.isArray(rawQuery.sorts) && rawQuery.sorts.length > 0) {
      const seenFields = new Set();
      rawQuery.sorts.slice(0, 5).forEach(s => {
        if (!s || !s.fieldKey) return;
        const fk = String(s.fieldKey).trim();
        if (seenFields.has(fk)) return;
        seenFields.add(fk);
        const dir = String(s.direction || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
        cleanSorts.push({ fieldKey: fk, direction: dir });
      });
    }

    // Fallback to legacy sort parameter if sorts array empty
    if (cleanSorts.length === 0) {
      const legacySort = String(rawQuery.sort || 'val_desc').trim();
      if (legacySort === 'val_asc') {
        cleanSorts.push({ fieldKey: 'value', direction: 'asc' });
      } else if (legacySort === 'alpha_asc') {
        cleanSorts.push({ fieldKey: 'label', direction: 'asc' });
      } else if (legacySort === 'alpha_desc') {
        cleanSorts.push({ fieldKey: 'label', direction: 'desc' });
      } else {
        cleanSorts.push({ fieldKey: 'value', direction: 'desc' });
      }
    }

    return {
      period: rawQuery.period || 'this_month',
      startDate: rawQuery.startDate || rawQuery.dateFrom || null,
      endDate: rawQuery.endDate || rawQuery.dateTo || null,
      mode: mode,
      measureKey: measureKey,
      aggregation: aggregation,
      interval: interval,
      groupByKey: groupByKey,
      filters: cleanFilters,
      sorts: cleanSorts,
      cropFilter: rawQuery.cropFilter || 'all'
    };
  },

  /**
   * Applies an array of filter specifications onto an array of row objects.
   * Handles typed string, numeric, date, array/multiselect, and between ranges.
   * @param {Array<Object>} rows 
   * @param {Array<{ fieldKey: string, operator: string, value: any }>} [filters]
   * @returns {Array<Object>}
   */
  applyFieldFilters: function(rows, filters) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    if (!Array.isArray(filters) || filters.length === 0) return rows;

    return rows.filter(row => {
      return filters.every(f => {
        if (!f || !f.fieldKey) return true;
        const fieldKey = f.fieldKey;
        const targetVal = f.value;
        const op = (f.operator || 'eq').toLowerCase();

        // Resolve row value from field or fallbacks
        let rowVal = row[fieldKey];
        if (rowVal === undefined || rowVal === null) {
          if (fieldKey === 'komoditas') {
            rowVal = row.komoditasClean || row.komoditasTanam || row.komoditasPanen || row.komoditas || '';
          } else if (fieldKey === 'lokasiBlok') {
            rowVal = row.lokasiBlok || row.lokasiBlokPanen || row.lokasiBlokTanam || '';
          } else {
            rowVal = '';
          }
        }

        if (op === 'empty') {
          return rowVal === '' || rowVal === null || rowVal === undefined;
        }

        if (op === 'not_empty') {
          return rowVal !== '' && rowVal !== null && rowVal !== undefined;
        }

        if (op === 'eq') {
          if (typeof targetVal === 'number' || (!isNaN(Number(targetVal)) && typeof rowVal === 'number')) {
            return Number(rowVal) === Number(targetVal);
          }
          return String(rowVal || '').toLowerCase().trim() === String(targetVal || '').toLowerCase().trim();
        }

        if (op === 'neq') {
          if (typeof targetVal === 'number' || (!isNaN(Number(targetVal)) && typeof rowVal === 'number')) {
            return Number(rowVal) !== Number(targetVal);
          }
          return String(rowVal || '').toLowerCase().trim() !== String(targetVal || '').toLowerCase().trim();
        }

        if (op === 'in') {
          let targets = [];
          if (Array.isArray(targetVal)) {
            targets = targetVal.map(v => String(v).toLowerCase().trim());
          } else if (typeof targetVal === 'string') {
            targets = targetVal.split(',').map(v => v.toLowerCase().trim()).filter(Boolean);
          } else {
            targets = [String(targetVal).toLowerCase().trim()];
          }
          if (targets.length === 0) return true;

          // If rowVal itself is multi-select comma separated (e.g. 'Penjualan, Penggunaan Internal')
          const rowParts = String(rowVal || '').split(',').map(p => p.toLowerCase().trim()).filter(Boolean);
          if (rowParts.length > 1) {
            return rowParts.some(p => targets.includes(p));
          }
          return targets.includes(String(rowVal || '').toLowerCase().trim());
        }

        if (op === 'contains') {
          return String(rowVal || '').toLowerCase().includes(String(targetVal || '').toLowerCase().trim());
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
          let minVal = null;
          let maxVal = null;

          if (Array.isArray(targetVal)) {
            minVal = targetVal[0];
            maxVal = targetVal[1];
          } else if (typeof targetVal === 'object' && targetVal !== null) {
            minVal = targetVal.min;
            maxVal = targetVal.max;
          }

          // Check if date comparison
          if (fieldKey.toLowerCase().includes('tgl') || fieldKey.toLowerCase().includes('timestamp') || fieldKey.toLowerCase().includes('date')) {
            const rowDate = this.parseDate_(rowVal);
            if (!rowDate) return false;
            const rTime = rowDate.getTime();
            if (minVal) {
              const dMin = this.parseDate_(minVal);
              if (dMin && rTime < dMin.getTime()) return false;
            }
            if (maxVal) {
              const dMax = this.parseDate_(maxVal);
              if (dMax && rTime > dMax.getTime()) return false;
            }
            return true;
          }

          // Numeric comparison
          const num = Number(rowVal || 0);
          if (minVal !== '' && minVal !== null && minVal !== undefined && !isNaN(Number(minVal))) {
            if (num < Number(minVal)) return false;
          }
          if (maxVal !== '' && maxVal !== null && maxVal !== undefined && !isNaN(Number(maxVal))) {
            if (num > Number(maxVal)) return false;
          }
          return true;
        }

        return true;
      });
    });
  },

  /**
   * Alias for applyFieldFilters for backwards compatibility.
   */
  applyFilters: function(rows, filters) {
    return this.applyFieldFilters(rows, filters);
  },

  /**
   * Computes distinct selectable options and record counts for a given target field
   * after applying all other active filters.
   * @param {Object} params { targetFieldKey: string, period: string, filters: Array }
   * @returns {Array<{ value: string, count: number }>}
   */
  getDynamicFilterOptions: function(params = {}) {
    const targetFieldKey = params.targetFieldKey || 'komoditas';
    const bounds = this.resolvePeriodBounds_(params);
    const rawRows = SpreadsheetRepository.getAllOperationalRows(bounds.dFrom, bounds.dTo);

    // Normalize rows
    rawRows.forEach(r => {
      const sep = resolveSeparatedCommodities(r.komoditas, r.komoditasPanen, r.jenisKegiatan);
      r.komoditasTanam = sep.komoditasTanam;
      r.komoditasPanen = sep.komoditasPanen;
      r.komoditasClean = sep.komoditasTanam || sep.komoditasPanen || r.komoditas || '';
    });

    // Filter by all other filters except targetFieldKey
    const otherFilters = (Array.isArray(params.filters) ? params.filters : []).filter(f => f && f.fieldKey !== targetFieldKey);
    const filteredRows = this.applyFieldFilters(rawRows, otherFilters);

    const counts = {};
    filteredRows.forEach(row => {
      let val = row[targetFieldKey];
      if (val === undefined || val === null || val === '') {
        if (targetFieldKey === 'komoditas') val = row.komoditasClean || row.komoditas || '';
      }
      if (val !== undefined && val !== null && val !== '') {
        const parts = String(val).split(',').map(p => p.trim()).filter(Boolean);
        parts.forEach(p => {
          counts[p] = (counts[p] || 0) + 1;
        });
      }
    });

    return Object.keys(counts).map(k => ({
      value: k,
      count: counts[k]
    })).sort((a, b) => b.count - a.count);
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
    const query = this.normalizeAnalyticsQuery(params);
    const bounds = this.resolvePeriodBounds_({
      period: query.period,
      startDate: query.startDate,
      endDate: query.endDate,
      interval: query.interval
    });
    const dFrom = bounds.dFrom;
    const dTo = bounds.dTo;
    const interval = bounds.interval;
    const periodLabel = bounds.periodLabel;
    const mode = query.mode; // 'tren' | 'breakdown'
    const groupByKey = query.groupByKey; // dimension key
    const measureKey = query.measureKey; // measure key
    const aggregation = query.aggregation; // 'sum' | 'avg' | 'min' | 'max' | 'count' | 'count_distinct'

    const measureDesc = (typeof getFieldDescriptor === 'function') ? getFieldDescriptor(measureKey) : null;
    const groupDesc = (typeof getFieldDescriptor === 'function') ? getFieldDescriptor(groupByKey) : null;

    // 1. Fetch raw operational rows within the decoupled date bounds
    const rawRows = SpreadsheetRepository.getAllOperationalRows(dFrom, dTo);

    // Normalize rows: separate commodities and ensure typed numbers
    rawRows.forEach(r => {
      const sep = resolveSeparatedCommodities(r.komoditas, r.komoditasPanen, r.jenisKegiatan);
      r.komoditasTanam = sep.komoditasTanam;
      r.komoditasPanen = sep.komoditasPanen;
      r.komoditasClean = sep.komoditasTanam || sep.komoditasPanen || r.komoditas || '';

      // Ensure livestock numbers are parsed as numbers
      r.ternakMasukQty = Number(r.ternakMasukQty || 0);
      r.ternakKeluarQty = Number(r.ternakKeluarQty || 0);
      r.populasiTernak = Number(r.populasiTernak || 0);
      r.pakanMasukKg = Number(r.pakanMasukKg || 0);
      r.pakanKeluarKg = Number(r.pakanKeluarKg || 0);
      r.jumlahPenjualanTernak = Number(r.jumlahPenjualanTernak || 0);
      r.hargaSatuanTernakRp = Number(r.hargaSatuanTernakRp || 0);
      r.totalHargaTernakRp = Number(r.totalHargaTernakRp || 0);

      // Ensure agro numbers are parsed as numbers
      r.jumlahBenih = Number(r.jumlahBenih || 0);
      r.luasLahanM2 = Number(r.luasLahanM2 || r.luasLahanPanenM2 || 0);
      r.jumlahPanen = Number(r.jumlahPanen || 0);
      r.luasLahanPanenM2 = Number(r.luasLahanPanenM2 || 0);
      r.jumlahPenjualanUnit = Number(r.jumlahPenjualanUnit || 0);
      r.hargaSatuanRp = Number(r.hargaSatuanRp || 0);
      r.totalHargaRp = Number(r.totalHargaRp || 0);
      r.jumlahUnitPenggunaan = Number(r.jumlahUnitPenggunaan || 0);
      r.populasiAgro = Number(r.populasiAgro || 0);
      r.estimasiPanenHst = Number(r.estimasiPanenHst || 0);
    });

    // 2. Apply active filters
    const filteredRows = this.applyFieldFilters(rawRows, query.filters);

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

    let trend = null;
    let breakdownList = [];
    let cropParticipation = [];
    let dataPointCount = 0;

    if (mode === 'tren') {
      // ==========================================
      // TREN MODE: Time-series Chronological Aggregation
      // ==========================================
      let dateField = 'timestamp';
      if (measureKey === 'jumlahBenih' || measureKey === 'luasLahanM2' || measureKey === 'populasiAgro' || measureKey === 'estimasiPanenHst' || measureKey === 'kerapatanTanam') {
        dateField = 'tglTanam';
      } else if (measureKey === 'jumlahPanen' || measureKey === 'luasLahanPanenM2' || measureKey === 'produktivitasPanen') {
        dateField = 'tglPanen';
      } else if (measureKey === 'totalHargaRp' || measureKey === 'jumlahPenjualanUnit' || measureKey === 'hargaSatuanRp' || measureKey === 'hargaRataRata') {
        dateField = 'tglPenjualan';
      }

      trend = this.getTimeseries(filteredRows, measureKey, interval, aggregation, dateField);
      dataPointCount = trend?.labels?.length || 0;

      // Participation panel in Tren mode: Scoped to matching rows
      const empParticipationMap = {};
      filteredRows.forEach(r => {
        const empId = r.idKaryawan || r.namaPic;
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
      // BREAKDOWN MODE: Multi-Dimensional Aggregation & Multi-Sort
      // ==========================================
      const groupByFn = (r) => {
        let val = r[groupByKey];
        if (groupByKey === 'komoditas') {
          if (['jumlahBenih', 'kerapatanTanam'].includes(measureKey)) {
            val = (r.komoditasTanam && r.komoditasTanam !== 'Lainnya') ? r.komoditasTanam : (r.komoditasClean || r.komoditas);
          } else if (['jumlahPanen', 'totalHargaRp', 'jumlahPenjualanUnit', 'produktivitasPanen', 'hargaRataRata'].includes(measureKey)) {
            val = (r.komoditasPanen && r.komoditasPanen !== 'Lainnya') ? r.komoditasPanen : (r.komoditasClean || r.komoditas);
          } else {
            val = r.komoditasClean || r.komoditas;
          }
        } else if (groupByKey === 'lokasiBlok') {
          val = r.lokasiBlok || r.lokasiBlokPanen || r.lokasiBlokTanam;
        } else if (groupByKey === 'namaPic') {
          val = r.namaPic || r.idKaryawan;
        }
        return (val && String(val).trim().length > 0) ? String(val).trim() : 'Lainnya';
      };

      // Aggregate rows by group
      const aggregatedGroups = this.groupAndAggregate(filteredRows, groupByFn, measureKey, aggregation);
      const totalOverall = Object.values(aggregatedGroups).reduce((acc, g) => acc + (g.value || 0), 0);

      breakdownList = Object.values(aggregatedGroups).map(g => {
        const pct = totalOverall > 0 ? ((g.value / totalOverall) * 100) : 0;
        return {
          key: g.key,
          label: g.key,
          sublabel: `${g.count} Laporan (${pct.toFixed(1)}%)`,
          value: g.value,
          count: g.count,
          percentage: pct
        };
      });

      // Apply Multi-Sort levels
      const sorts = query.sorts || [{ fieldKey: 'value', direction: 'desc' }];
      breakdownList.sort((a, b) => {
        for (let i = 0; i < sorts.length; i++) {
          const s = sorts[i];
          const fk = s.fieldKey;
          const isAsc = (s.direction === 'asc');
          let cmp = 0;

          if (fk === 'value') {
            cmp = a.value - b.value;
          } else if (fk === 'count') {
            cmp = a.count - b.count;
          } else if (fk === 'label') {
            cmp = a.label.localeCompare(b.label, 'id');
          } else {
            cmp = (a[fk] || 0) - (b[fk] || 0);
          }

          if (cmp !== 0) {
            return isAsc ? cmp : -cmp;
          }
        }
        // Stable deterministic tie-breaker by label
        return a.label.localeCompare(b.label, 'id');
      });

      dataPointCount = breakdownList.length;

      // Participation panel in Breakdown mode
      const empSummaryMap = {};
      filteredRows.forEach(r => {
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
    }

    return {
      period: {
        code: bounds.periodCode,
        label: periodLabel,
        startDate: this.formatDateKey_(dFrom),
        endDate: this.formatDateKey_(dTo),
        interval: interval
      },
      query: query,
      field: measureDesc || { key: measureKey, label: measureKey, unit: '', format: 'decimal', module: 'Agro' },
      groupBy: groupDesc || { key: groupByKey, label: groupByKey, module: 'Umum' },
      mode: mode,
      dimension: groupByKey, // backwards compatibility
      measure: measureKey, // backwards compatibility
      sort: ((query.sorts && query.sorts[0] && query.sorts[0].fieldKey) ? query.sorts[0].fieldKey : 'val') + '_' + ((query.sorts && query.sorts[0] && query.sorts[0].direction) ? query.sorts[0].direction : 'desc'), // backwards compatibility
      cropList: cropList,
      selectedCrop: query.cropFilter,
      rawCropFilter: query.cropFilter,
      trend: trend,
      singleTrend: trend, // backwards compatibility
      tanamTrend: null,
      panenTrend: null,
      breakdown: breakdownList,
      participation: cropParticipation,
      scopeMode: mode === 'tren' ? 'crop_specific' : 'multi_dimension',
      dataPointCount: dataPointCount,
      totalRows: filteredRows.length,
      matchedReportCount: filteredRows.length,
      dataQuality: {
        totalRowsScanned: rawRows.length,
        matchedRows: filteredRows.length,
        ignoredRows: rawRows.length - filteredRows.length,
        warnings: []
      }
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

    // 3. Compute Executive KPIs (Agro, Ternak, and Combined)
    let totalSalesAgroRp = 0;
    let totalSalesTernakRp = 0;
    let totalPanenKg = 0;
    let totalBenih = 0;
    let latestReportedLivestockPopulation = 0;

    filteredRows.forEach(r => {
      totalSalesAgroRp += Number(r.totalHargaRp || 0);
      totalSalesTernakRp += Number(r.totalHargaTernakRp || 0);
      totalPanenKg += Number(r.jumlahPanen || 0);
      totalBenih += Number(r.jumlahBenih || 0);
      if (Number(r.populasiTernak || 0) > 0) {
        latestReportedLivestockPopulation = Number(r.populasiTernak);
      }
    });

    const totalSalesRp = totalSalesAgroRp + totalSalesTernakRp;

    // 4. Employee Leaderboard (Operations Owner)
    const employeeLeaderboard = this.getEmployeeReportingLeaderboard(filteredRows);

    // 5. Smart Panen Harvest Schedule via HST (Full Year Rowset)
    const fullYearRows = SpreadsheetRepository.getAllOperationalRows(
      new Date(now.getFullYear() - 1, 0, 1),
      new Date(now.getFullYear() + 1, 11, 31)
    );
    const harvestSchedule = this.getHarvestSchedule(fullYearRows);
    const activeHarvests = harvestSchedule.filter(s => !s.isAlreadyHarvested);
    const readyHarvestsCount = activeHarvests.filter(s => s.isReady).length;
    const overdueHarvestsCount = activeHarvests.filter(s => s.isOverdue).length;

    // 6. Feature-Level Canonical Decision Engines (Using single normalized rowset)
    const priceTrend = this.getPriceTrendWidgetData(filteredRows, params, bounds);
    const harvestByCommodity = this.getHarvestByCommodityWidgetData(filteredRows);
    const salesByCommodity = this.getSalesByCommodityWidgetData(filteredRows);
    const livestockMovement = this.getLivestockMovementWidgetData(filteredRows, interval);
    const operationalRisk = this.getOperationalRiskWidgetData(filteredRows);

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
        totalSalesAgroRp: totalSalesAgroRp,
        totalSalesTernakRp: totalSalesTernakRp,
        totalPanenKg: Math.round(totalPanenKg * 10) / 10,
        totalBenih: totalBenih,
        reportedLivestockPopulation: latestReportedLivestockPopulation,
        activePlantingsCount: activeHarvests.length,
        readyHarvestsCount: readyHarvestsCount,
        overdueHarvestsCount: overdueHarvestsCount
      },
      harvest: {
        performanceByCommodity: harvestByCommodity,
        scheduleSummary: {
          totalActive: activeHarvests.length,
          readyCount: readyHarvestsCount,
          overdueCount: overdueHarvestsCount
        }
      },
      commerce: {
        salesByCommodity: salesByCommodity,
        priceTrend: priceTrend
      },
      livestock: livestockMovement,
      operations: {
        employeeLeaderboard: employeeLeaderboard,
        risk: operationalRisk
      },
      harvestSchedule: {
        activeList: activeHarvests.slice(0, 50),
        totalActive: activeHarvests.length,
        readyCount: readyHarvestsCount,
        overdueCount: overdueHarvestsCount
      },
      // Backward-compatibility references for older callers
      employeeLeaderboard: employeeLeaderboard,
      salesAnalytics: salesByCommodity,
      riskAnalytics: operationalRisk,
      decisionViews: {
        priceTrend: priceTrend,
        harvestByCommodity: harvestByCommodity,
        salesByCommodity: salesByCommodity,
        harvestPipeline: {
          status: 'ok',
          totalActivePlantings: activeHarvests.length,
          ready7DaysCount: readyHarvestsCount,
          overdueCount: overdueHarvestsCount
        },
        livestockMovement: livestockMovement,
        operationalRisk: operationalRisk
      }
    };
  },

  /**
   * Generates comprehensive permanent decision snapshot views across widgets.
   * @param {Object} [params]
   * @param {Array<Object>} [preloadedRows]
   * @param {Array<Object>} [preloadedFullYearRows]
   * @returns {Object}
   */
  getDecisionViewsData: function(params = {}, preloadedRows = null, preloadedFullYearRows = null) {
    const bounds = this.resolvePeriodBounds_(params);
    const dFrom = bounds.dFrom;
    const dTo = bounds.dTo;
    const interval = bounds.interval;

    const rows = preloadedRows || SpreadsheetRepository.getAllOperationalRows(dFrom, dTo);
    const now = new Date();

    let fullYearRows = preloadedFullYearRows;
    if (!fullYearRows) {
      fullYearRows = SpreadsheetRepository.getAllOperationalRows(
        new Date(now.getFullYear() - 1, 0, 1),
        new Date(now.getFullYear() + 1, 11, 31)
      );
    }

    const priceTrend = this.getPriceTrendWidgetData(rows, params, bounds);
    const harvestByCommodity = this.getHarvestByCommodityWidgetData(rows);
    const salesByCommodity = this.getSalesByCommodityWidgetData(rows);
    const harvestPipeline = this.getHarvestPipelineWidgetData(fullYearRows, now);
    const livestockMovement = this.getLivestockMovementWidgetData(rows, interval);
    const operationalRisk = this.getOperationalRiskWidgetData(rows);

    return {
      period: {
        code: bounds.periodCode,
        label: bounds.periodLabel,
        startDate: this.formatDateKey_(dFrom),
        endDate: this.formatDateKey_(dTo),
        interval: interval
      },
      decisionViews: {
        priceTrend: priceTrend,
        harvestByCommodity: harvestByCommodity,
        salesByCommodity: salesByCommodity,
        harvestPipeline: harvestPipeline,
        livestockMovement: livestockMovement,
        operationalRisk: operationalRisk
      }
    };
  },

  /**
   * Widget A: Realized Selling Price Trend Engine (Tren Harga Realisasi Penjualan)
   * Computes weighted realized price: Total Revenue / Valid Sold Quantity.
   * @param {Array<Object>} rows
   * @param {Object} params
   * @param {Object} bounds
   * @returns {Object}
   */
  getPriceTrendWidgetData: function(rows, params = {}, bounds = {}) {
    const interval = bounds.interval || 'day';

    // 1. Discover all candidate commodities with sales transactions in rows
    const agroSalesMap = {};
    const ternakSalesMap = {};

    (rows || []).forEach(r => {
      // Agro sales check
      const agroRev = Number(r.totalHargaRp || 0);
      const agroQty = Number(r.jumlahPenjualanUnit || r.jumlahPanen || 0);
      const agroCom = r.komoditasPanen || r.komoditasClean || r.komoditas || '';
      if (agroRev > 0 && agroCom && agroCom !== 'Lainnya') {
        if (!agroSalesMap[agroCom]) agroSalesMap[agroCom] = { key: agroCom, label: agroCom, module: 'Agro', count: 0, totalRev: 0, totalQty: 0 };
        agroSalesMap[agroCom].count++;
        agroSalesMap[agroCom].totalRev += agroRev;
        agroSalesMap[agroCom].totalQty += agroQty;
      }

      // Ternak sales check
      const ternakRev = Number(r.totalHargaTernakRp || 0);
      const ternakQty = Number(r.jumlahPenjualanTernak || 0);
      const ternakCom = r.jenisKomoditasTernak || r.jenisTernak || '';
      if (ternakRev > 0 && ternakCom && ternakCom !== 'Lainnya') {
        if (!ternakSalesMap[ternakCom]) ternakSalesMap[ternakCom] = { key: ternakCom, label: ternakCom, module: 'Ternak', count: 0, totalRev: 0, totalQty: 0 };
        ternakSalesMap[ternakCom].count++;
        ternakSalesMap[ternakCom].totalRev += ternakRev;
        ternakSalesMap[ternakCom].totalQty += ternakQty;
      }
    });

    const availableCommodities = [
      ...Object.values(agroSalesMap).sort((a, b) => b.count - a.count),
      ...Object.values(ternakSalesMap).sort((a, b) => b.count - a.count)
    ];

    // Selected commodity resolution
    let selCommodity = params.commodity || '';
    if (!selCommodity && availableCommodities.length > 0) {
      selCommodity = availableCommodities[0].key;
    }

    const matchedCom = availableCommodities.find(c => c.key.toLowerCase() === selCommodity.toLowerCase()) || (availableCommodities[0] || null);
    const isTernak = matchedCom ? matchedCom.module === 'Ternak' : false;
    const moduleScope = isTernak ? 'Ternak' : 'Agro';
    const effectiveCommodityKey = matchedCom ? matchedCom.key : selCommodity;

    // Determine unit & price basis
    let validBases = isTernak ? ['Rp/ekor', 'Rp/kg', 'Rp/unit'] : ['Rp/unit', 'Rp/kg'];
    let defaultBasis = isTernak ? 'Rp/ekor' : 'Rp/unit';
    let selBasis = params.priceBasis && validBases.includes(params.priceBasis) ? params.priceBasis : defaultBasis;

    // Filter relevant transaction rows
    const matchingRows = (rows || []).filter(r => {
      if (isTernak) {
        const com = r.jenisKomoditasTernak || r.jenisTernak || '';
        return com.toLowerCase() === effectiveCommodityKey.toLowerCase() && Number(r.totalHargaTernakRp || 0) > 0;
      } else {
        const com = r.komoditasPanen || r.komoditasClean || r.komoditas || '';
        return com.toLowerCase() === effectiveCommodityKey.toLowerCase() && Number(r.totalHargaRp || 0) > 0;
      }
    });

    // Grouping by interval
    const intervalMap = {};
    let totalValidRevenue = 0;
    let totalValidQuantity = 0;
    let totalTransactions = matchingRows.length;
    let missingQuantityRowsCount = 0;

    matchingRows.forEach(r => {
      let d = null;
      if (!isTernak && r.tglPenjualan_raw instanceof Date) d = r.tglPenjualan_raw;
      else if (!isTernak && r.tglPenjualan) d = new Date(r.tglPenjualan);
      else if (r.timestamp_raw instanceof Date) d = r.timestamp_raw;
      else if (r.timestamp) d = new Date(r.timestamp);

      if (!d || isNaN(d.getTime())) d = bounds.dFrom || new Date();

      let intervalKey = '';
      let intervalLabel = '';
      if (interval === 'month') {
        intervalKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        intervalLabel = intervalKey;
      } else if (interval === 'week') {
        const startW = AnalyticsService.getStartOfWeek_(d);
        intervalKey = AnalyticsService.formatDateKey_(startW);
        intervalLabel = 'Mg ' + intervalKey;
      } else {
        intervalKey = AnalyticsService.formatDateKey_(d);
        intervalLabel = intervalKey;
      }

      const rev = isTernak ? Number(r.totalHargaTernakRp || 0) : Number(r.totalHargaRp || 0);
      let qty = isTernak ? Number(r.jumlahPenjualanTernak || 0) : Number(r.jumlahPenjualanUnit || 0);
      let rowEstimated = false;

      if (qty <= 0 && !isTernak && Number(r.jumlahPanen || 0) > 0 && selBasis === 'Rp/kg') {
        qty = Number(r.jumlahPanen);
        rowEstimated = true;
      }

      if (qty <= 0) {
        missingQuantityRowsCount++;
        qty = 1; // Fallback unit observation
        rowEstimated = true;
      }

      if (!intervalMap[intervalKey]) {
        intervalMap[intervalKey] = {
          key: intervalKey,
          label: intervalLabel,
          revenue: 0,
          quantity: 0,
          transactionCount: 0,
          hasEstimatedRows: false
        };
      }

      intervalMap[intervalKey].revenue += rev;
      intervalMap[intervalKey].quantity += qty;
      intervalMap[intervalKey].transactionCount += 1;
      if (rowEstimated) intervalMap[intervalKey].hasEstimatedRows = true;

      totalValidRevenue += rev;
      totalValidQuantity += qty;
    });

    const sortedIntervalKeys = Object.keys(intervalMap).sort();
    const points = sortedIntervalKeys.map(k => {
      const it = intervalMap[k];
      const realizedPrice = it.quantity > 0 ? Math.round(it.revenue / it.quantity) : 0;
      return {
        key: it.key,
        label: it.label,
        realizedPrice: realizedPrice,
        revenue: it.revenue,
        quantity: it.quantity,
        quantityUnit: selBasis.replace('Rp/', ''),
        transactionCount: it.transactionCount,
        sourceCompleteness: it.hasEstimatedRows ? 'estimated' : 'complete'
      };
    });

    // Compute delta comparison
    let latestPrice = 0;
    let previousPrice = 0;
    let priceChangePct = 0;

    if (points.length > 0) {
      latestPrice = points[points.length - 1].realizedPrice;
      if (points.length > 1) {
        previousPrice = points[points.length - 2].realizedPrice;
        if (previousPrice > 0) {
          priceChangePct = Math.round(((latestPrice - previousPrice) / previousPrice) * 1000) / 10;
        }
      }
    }

    const overallWeightedPrice = totalValidQuantity > 0 ? Math.round(totalValidRevenue / totalValidQuantity) : 0;
    const warnings = [];
    if (missingQuantityRowsCount > 0) {
      warnings.push(`${missingQuantityRowsCount} transaksi tidak mencantumkan kuantitas riil sehingga menggunakan estimasi.`);
    }

    return {
      status: points.length > 0 ? 'ok' : 'empty',
      commodity: { key: effectiveCommodityKey, label: effectiveCommodityKey, module: moduleScope },
      metric: { key: 'hargaRealisasi', label: 'Harga Realisasi Penjualan', unit: selBasis, priceBasis: selBasis },
      quantityField: isTernak ? 'jumlahPenjualanTernak' : 'jumlahPenjualanUnit',
      availableCommodities: availableCommodities,
      validBases: validBases,
      selectedBasis: selBasis,
      isEstimated: missingQuantityRowsCount > 0,
      sourceCompleteness: missingQuantityRowsCount === 0 ? 'complete' : 'partial',
      points: points,
      summary: {
        latestPrice: latestPrice,
        previousPrice: previousPrice,
        priceChangePct: priceChangePct,
        overallWeightedPrice: overallWeightedPrice,
        totalRevenue: totalValidRevenue,
        totalQuantity: totalValidQuantity,
        transactionCount: totalTransactions
      },
      warnings: warnings
    };
  },

  /**
   * Widget B: Harvest Yield by Commodity (Hasil Panen per Komoditas)
   * Answers which commodities produced the most harvest output with exact shares.
   * @param {Array<Object>} rows
   * @returns {Object}
   */
  getHarvestByCommodityWidgetData: function(rows) {
    const harvestMap = {};
    let totalHarvestKg = 0;

    (rows || []).forEach(r => {
      const kg = Number(r.jumlahPanen || 0);
      const area = Number(r.luasLahanPanenM2 || r.luasLahanM2 || 0);
      const com = r.komoditasPanen || r.komoditasClean || r.komoditas || '';
      if (!com || com === 'Lainnya' || kg <= 0) return;

      if (!harvestMap[com]) {
        harvestMap[com] = {
          commodity: com,
          harvestKg: 0,
          harvestedAreaM2: 0,
          reportCount: 0
        };
      }

      harvestMap[com].harvestKg += kg;
      harvestMap[com].harvestedAreaM2 += area;
      harvestMap[com].reportCount += 1;
      totalHarvestKg += kg;
    });

    const points = Object.values(harvestMap)
      .map(it => {
        const share = totalHarvestKg > 0 ? Math.round((it.harvestKg / totalHarvestKg) * 1000) / 10 : 0;
        const yieldPerM2 = it.harvestedAreaM2 > 0 ? Math.round((it.harvestKg / it.harvestedAreaM2) * 100) / 100 : null;
        return {
          commodity: it.commodity,
          harvestKg: Math.round(it.harvestKg * 10) / 10,
          harvestedAreaM2: it.harvestedAreaM2,
          yieldPerM2: yieldPerM2,
          reportCount: it.reportCount,
          share: share
        };
      })
      .sort((a, b) => b.harvestKg - a.harvestKg);

    const topContributor = points.length > 0 ? points[0] : null;

    return {
      status: points.length > 0 ? 'ok' : 'empty',
      totalHarvestKg: Math.round(totalHarvestKg * 10) / 10,
      points: points,
      topContributor: topContributor,
      warnings: []
    };
  },

  /**
   * Widget C: Revenue & Sales Volume by Commodity with Internal Distribution
   * Connects production to commercial outcomes without mixing units.
   * @param {Array<Object>} rows
   * @returns {Object}
   */
  getSalesByCommodityWidgetData: function(rows) {
    const agroSalesMap = {};
    const ternakSalesMap = {};
    const internalDistMap = {};

    let totalCommercialRevenueRp = 0;
    let totalCommercialAgroRevenueRp = 0;
    let totalCommercialTernakRevenueRp = 0;
    let totalInternalUseUnits = 0;

    (rows || []).forEach(r => {
      // 1. Agro Commercial Sales
      const agroRev = Number(r.totalHargaRp || 0);
      const agroQty = Number(r.jumlahPenjualanUnit || 0);
      const agroCom = r.komoditasPanen || r.komoditasClean || r.komoditas || '';
      if (agroRev > 0 && agroCom && agroCom !== 'Lainnya') {
        if (!agroSalesMap[agroCom]) {
          agroSalesMap[agroCom] = { commodity: agroCom, module: 'Agro', revenueRp: 0, quantity: 0, quantityUnit: 'unit', reportCount: 0 };
        }
        agroSalesMap[agroCom].revenueRp += agroRev;
        agroSalesMap[agroCom].quantity += agroQty;
        agroSalesMap[agroCom].reportCount += 1;
        totalCommercialRevenueRp += agroRev;
        totalCommercialAgroRevenueRp += agroRev;
      }

      // 2. Ternak Commercial Sales
      const ternakRev = Number(r.totalHargaTernakRp || 0);
      const ternakQty = Number(r.jumlahPenjualanTernak || 0);
      const ternakCom = r.jenisKomoditasTernak || r.jenisTernak || '';
      if (ternakRev > 0 && ternakCom && ternakCom !== 'Lainnya') {
        if (!ternakSalesMap[ternakCom]) {
          ternakSalesMap[ternakCom] = { commodity: ternakCom, module: 'Ternak', revenueRp: 0, quantity: 0, quantityUnit: 'ekor/unit', reportCount: 0 };
        }
        ternakSalesMap[ternakCom].revenueRp += ternakRev;
        ternakSalesMap[ternakCom].quantity += ternakQty;
        ternakSalesMap[ternakCom].reportCount += 1;
        totalCommercialRevenueRp += ternakRev;
        totalCommercialTernakRevenueRp += ternakRev;
      }

      // 3. Internal Usage Distribution
      const internalQty = Number(r.jumlahUnitPenggunaan || 0);
      const internalDest = r.tujuanPenggunaan || '';
      if (internalQty > 0 || (internalDest && internalDest !== '-')) {
        const destKey = internalDest || 'Penggunaan Internal MPL';
        if (!internalDistMap[destKey]) {
          internalDistMap[destKey] = { destination: destKey, quantity: 0, reportCount: 0 };
        }
        internalDistMap[destKey].quantity += internalQty;
        internalDistMap[destKey].reportCount += 1;
        totalInternalUseUnits += internalQty;
      }
    });

    const commercialPoints = [
      ...Object.values(agroSalesMap),
      ...Object.values(ternakSalesMap)
    ].map(it => {
      const realizedPrice = it.quantity > 0 ? Math.round(it.revenueRp / it.quantity) : 0;
      return {
        commodity: it.commodity,
        module: it.module,
        revenueRp: it.revenueRp,
        quantity: it.quantity,
        quantityUnit: it.quantityUnit,
        realizedPrice: realizedPrice,
        reportCount: it.reportCount
      };
    }).sort((a, b) => b.revenueRp - a.revenueRp);

    const internalUsagePoints = Object.values(internalDistMap)
      .map(it => ({
        destination: it.destination,
        quantity: it.quantity,
        reportCount: it.reportCount,
        share: totalInternalUseUnits > 0 ? Math.round((it.quantity / totalInternalUseUnits) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.quantity - a.quantity);

    return {
      status: commercialPoints.length > 0 ? 'ok' : 'empty',
      totalCommercialRevenueRp: totalCommercialRevenueRp,
      totalCommercialAgroRevenueRp: totalCommercialAgroRevenueRp,
      totalCommercialTernakRevenueRp: totalCommercialTernakRevenueRp,
      totalInternalUseUnits: totalInternalUseUnits,
      commercialPoints: commercialPoints,
      internalUsagePoints: internalUsagePoints,
      warnings: []
    };
  },

  /**
   * Widget D: Harvest Pipeline & Exceptions (Pipeline & Status Panen)
   * High-priority pipeline summary with active, ready, overdue, and incomplete plantings.
   * @param {Array<Object>} fullYearRows
   * @param {Date} now
   * @returns {Object}
   */
  getHarvestPipelineWidgetData: function(fullYearRows, now) {
    const harvestSchedule = this.getHarvestSchedule(fullYearRows);
    const activeList = harvestSchedule.filter(s => !s.isAlreadyHarvested);

    const ready7DaysList = activeList.filter(s => s.daysRemaining >= -7 && s.daysRemaining <= 7 && !s.isOverdue);
    const overdueList = activeList.filter(s => s.isOverdue);
    const incompleteList = (fullYearRows || []).filter(r => {
      const isTanam = String(r.jenisKegiatan || '').toLowerCase().includes('tanam');
      const hasPlanting = isTanam || Number(r.jumlahBenih || 0) > 0;
      if (!hasPlanting) return false;
      return !r.tglTanam || !r.estimasiPanenHst;
    });

    return {
      status: 'ok',
      totalActivePlantings: activeList.length,
      ready7DaysCount: ready7DaysList.length,
      overdueCount: overdueList.length,
      incompleteCount: incompleteList.length,
      topReadyList: ready7DaysList.slice(0, 5),
      topOverdueList: overdueList.slice(0, 5),
      warnings: []
    };
  },

  /**
   * Widget E: Livestock Movement & Reported Population (Pergerakan & Populasi Ternak)
   * Small-multiple layout for population, births, purchases, deaths, sales, feed, and revenue.
   * @param {Array<Object>} rows
   * @param {string} interval
   * @returns {Object}
   */
  getLivestockMovementWidgetData: function(rows, interval = 'day') {
    const hasTernakData = (rows || []).some(r => {
      return Number(r.populasiTernak || 0) > 0 ||
        Number(r.ternakMasukQty || 0) > 0 ||
        Number(r.ternakKeluarQty || 0) > 0 ||
        Number(r.totalHargaTernakRp || 0) > 0 ||
        Number(r.pakanMasukKg || 0) > 0 ||
        Number(r.pakanKeluarKg || 0) > 0 ||
        String(r.jenisTernak || '').trim().length > 0;
    });

    if (!hasTernakData) {
      return {
        status: 'empty',
        hasData: false,
        summary: { totalPopulation: 0, totalEntry: 0, totalExit: 0, totalBirth: 0, totalPurchase: 0, totalDeath: 0, totalSale: 0, totalFeedInKg: 0, totalFeedOutKg: 0, totalRevenueRp: 0 },
        points: [],
        warnings: []
      };
    }

    let totalBirth = 0;
    let totalPurchase = 0;
    let totalEntry = 0;
    let totalDeath = 0;
    let totalSale = 0;
    let totalExit = 0;
    let totalFeedIn = 0;
    let totalFeedOut = 0;
    let totalRevenue = 0;
    let latestPopulation = 0;

    const intervalMap = {};

    (rows || []).forEach(r => {
      const birth = Number(r.ternakMasukKelahiranQty || 0);
      const buy = Number(r.ternakMasukPembelianQty || 0);
      const entry = Number(r.ternakMasukQty || 0) || (birth + buy);

      const death = Number(r.ternakKeluarKematianQty || 0);
      const sale = Number(r.ternakKeluarPenjualanQty || 0);
      const exit = Number(r.ternakKeluarQty || 0) || (death + sale);

      const pop = Number(r.populasiTernak || 0);
      const feedIn = Number(r.pakanMasukKg || 0);
      const feedOut = Number(r.pakanKeluarKg || 0);
      const rev = Number(r.totalHargaTernakRp || 0);

      totalBirth += birth;
      totalPurchase += buy;
      totalEntry += entry;
      totalDeath += death;
      totalSale += sale;
      totalExit += exit;
      totalFeedIn += feedIn;
      totalFeedOut += feedOut;
      totalRevenue += rev;
      if (pop > 0) latestPopulation = pop;

      let d = r.timestamp_raw instanceof Date ? r.timestamp_raw : (r.timestamp ? new Date(r.timestamp) : new Date());
      if (isNaN(d.getTime())) d = new Date();

      let k = AnalyticsService.formatDateKey_(d);
      if (interval === 'month') k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      else if (interval === 'week') k = 'Mg ' + AnalyticsService.formatDateKey_(AnalyticsService.getStartOfWeek_(d));

      if (!intervalMap[k]) {
        intervalMap[k] = {
          label: k,
          population: pop,
          entryQty: 0,
          birthQty: 0,
          purchaseQty: 0,
          exitQty: 0,
          deathQty: 0,
          saleQty: 0,
          feedInKg: 0,
          feedOutKg: 0,
          revenueRp: 0
        };
      }

      if (pop > 0) intervalMap[k].population = pop;
      intervalMap[k].entryQty += entry;
      intervalMap[k].birthQty += birth;
      intervalMap[k].purchaseQty += buy;
      intervalMap[k].exitQty += exit;
      intervalMap[k].deathQty += death;
      intervalMap[k].saleQty += sale;
      intervalMap[k].feedInKg += feedIn;
      intervalMap[k].feedOutKg += feedOut;
      intervalMap[k].revenueRp += rev;
    });

    const points = Object.keys(intervalMap).sort().map(k => intervalMap[k]);

    return {
      status: 'ok',
      hasData: true,
      summary: {
        reportedPopulation: latestPopulation,
        totalEntry: totalEntry,
        totalBirth: totalBirth,
        totalPurchase: totalPurchase,
        totalExit: totalExit,
        totalDeath: totalDeath,
        totalSale: totalSale,
        totalFeedInKg: Math.round(totalFeedIn * 10) / 10,
        totalFeedOutKg: Math.round(totalFeedOut * 10) / 10,
        totalRevenueRp: totalRevenue
      },
      points: points,
      warnings: []
    };
  },

  /**
   * Widget F: Operational Risk & Intervention Status (Risiko Operasional & Kendala)
   * High-level exception radar and urgent intervention tracking.
   * @param {Array<Object>} rows
   * @returns {Object}
   */
  getOperationalRiskWidgetData: function(rows) {
    const rawRisk = this.getRiskAndObstacleAnalytics(rows);

    let urgentCount = 0;
    let normalCount = 0;
    let unresolvedCount = 0;
    const locationMap = {};

    (rows || []).forEach(r => {
      if (!isActualKendala(r.kendala)) return;
      const isUrgent = String(r.severity || '').toLowerCase() === 'urgent';
      if (isUrgent) urgentCount++;
      else normalCount++;

      if (!r.upaya || String(r.upaya).trim().length === 0) {
        unresolvedCount++;
      }

      const loc = r.lokasiKegiatan || 'Lokasi Lain';
      locationMap[loc] = (locationMap[loc] || 0) + 1;
    });

    const topLocations = Object.keys(locationMap)
      .map(k => ({ location: k, count: locationMap[k] }))
      .sort((a, b) => b.count - a.count);

    return {
      status: rawRisk.totalReports > 0 ? 'ok' : 'empty',
      totalObstacles: rawRisk.reportsWithObstacleCount,
      urgentCount: urgentCount,
      normalCount: normalCount,
      unresolvedCount: unresolvedCount,
      mitigationRate: rawRisk.mitigationRate,
      categoryBreakdown: rawRisk.categoryBreakdown,
      topLocations: topLocations,
      recentObstacles: rawRisk.activeObstacles.slice(0, 5),
      warnings: []
    };
  }
};

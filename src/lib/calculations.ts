
import { StoreMonthRecord, AggregatedMetrics, PeriodBasis } from './types';

export function filterByPeriod(
  data: StoreMonthRecord[],
  basis: PeriodBasis,
  year: number,
  month: number
): StoreMonthRecord[] {
  if (basis === 'monthly') {
    return data.filter(d => d.year === year && d.month === month);
  }

  if (basis === 'ytd') {
    return data.filter(d => d.year === year && d.month <= month);
  }

  if (basis === 'ltm') {
    const thresholdMonth = month === 12 ? 1 : month + 1;
    const thresholdYear = month === 12 ? year : year - 1;
    
    return data.filter(d => {
      if (d.year === year) return d.month <= month;
      if (d.year === thresholdYear) return d.month >= thresholdMonth;
      return false;
    });
  }

  return data;
}

export function aggregate(data: StoreMonthRecord[]): AggregatedMetrics {
  const storeSet = new Set(data.map(d => d.store));
  const count = storeSet.size;

  const totals = data.reduce(
    (acc, d) => ({
      sales: acc.sales + (d.sales || 0),
      tickets: acc.tickets + (d.tickets || 0),
      ebitda: acc.ebitda + (d.ebitda || 0),
      capex: acc.capex + (d.capex || 0),
      cit: acc.cit + (d.cit || 0),
      fcff: acc.fcff + (d.fcff || 0),
      staff: acc.staff + (d.staff || 0),
      raw_materials: acc.raw_materials + (d.raw_materials || 0),
      rent: acc.rent + (d.rent || 0),
    }),
    { sales: 0, tickets: 0, ebitda: 0, capex: 0, cit: 0, fcff: 0, staff: 0, raw_materials: 0, rent: 0 }
  );

  const totalSales = totals.sales;
  const storeContribution = totals.ebitda + totals.rent;

  return {
    totalSales,
    totalTickets: totals.tickets,
    avgTicket: totals.tickets > 0 ? totalSales / totals.tickets : 0,
    totalEbitda: totals.ebitda,
    ebitdaPct: totalSales !== 0 ? totals.ebitda / totalSales : null,
    totalCapex: totals.capex,
    totalFcff: totals.fcff,
    totalCit: totals.cit,
    staff: totals.staff,
    staffPct: totalSales !== 0 ? totals.staff / totalSales : null,
    rawMaterials: totals.raw_materials,
    rawMaterialsPct: totalSales !== 0 ? totals.raw_materials / totalSales : null,
    storeContribution,
    storeContributionPct: totalSales !== 0 ? storeContribution / totalSales : null,
    storeCount: count,
    salesPerStore: count > 0 ? totalSales / count : 0,
    ebitdaPerStore: count > 0 ? totals.ebitda / count : 0,
  };
}

export function aggregatePerStore(data: StoreMonthRecord[]): Map<string, AggregatedMetrics & { store: string; concept: string; region: string }> {
  const groups = new Map<string, StoreMonthRecord[]>();
  data.forEach(d => {
    const list = groups.get(d.store) || [];
    list.push(d);
    groups.set(d.store, list);
  });

  const result = new Map();
  groups.forEach((records, store) => {
    const agg = aggregate(records);
    result.set(store, {
      ...agg,
      store,
      concept: records[0].concept,
      region: records[0].region,
    });
  });

  return result;
}

export function aggregateByDimension(data: StoreMonthRecord[], dim: keyof StoreMonthRecord): Map<string, AggregatedMetrics> {
  const groups = new Map<string, StoreMonthRecord[]>();
  data.forEach(d => {
    const val = String(d[dim]);
    const list = groups.get(val) || [];
    list.push(d);
    groups.set(val, list);
  });

  const result = new Map();
  groups.forEach((recs, val) => {
    result.set(val, aggregate(recs));
  });

  return result;
}

export function getMonthlyTrend(data: StoreMonthRecord[], metric: string) {
  const months = new Map<string, StoreMonthRecord[]>();
  data.forEach(d => {
    const key = `${d.year}-${String(d.month).padStart(2, '0')}`;
    const list = months.get(key) || [];
    list.push(d);
    months.set(key, list);
  });

  return Array.from(months.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, recs]) => {
      const agg = aggregate(recs);
      let value = 0;
      if (metric === 'sales') value = agg.totalSales;
      if (metric === 'ebitda') value = agg.totalEbitda;
      if (metric === 'fcff') value = agg.totalFcff;
      if (metric === 'capex') value = agg.totalCapex;
      if (metric === 'tickets') value = agg.totalTickets;
      if (metric === 'store_contribution') value = agg.totalSales > 0 ? agg.storeContribution / agg.totalSales : 0;
      return { period, value };
    });
}

export function getRatioTrend(data: StoreMonthRecord[], ratio: string) {
  const months = new Map<string, StoreMonthRecord[]>();
  data.forEach(d => {
    const key = `${d.year}-${String(d.month).padStart(2, '0')}`;
    const list = months.get(key) || [];
    list.push(d);
    months.set(key, list);
  });

  return Array.from(months.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, recs]) => {
      const agg = aggregate(recs);
      let value = 0;
      if (ratio === 'ebitda') value = agg.ebitdaPct || 0;
      if (ratio === 'staff') value = agg.staffPct || 0;
      if (ratio === 'raw_materials') value = agg.rawMaterialsPct || 0;
      if (ratio === 'fcff') value = agg.totalSales > 0 ? agg.totalFcff / agg.totalSales : 0;
      return { period, value };
    });
}

export function getYearlyComparison(data: StoreMonthRecord[], basis: PeriodBasis, month: number, years: number[]) {
  return years
    .sort((a, b) => b - a)
    .map(year => {
      const periodData = filterByPeriod(data, basis, year, month);
      return {
        year,
        metrics: aggregate(periodData)
      };
    })
    .filter(y => y.metrics.storeCount > 0);
}

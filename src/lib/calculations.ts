/* ────────────────────────────────────────────────────────
 * Calculation Engine — YTD, LTM, weighted aggregation
 * ──────────────────────────────────────────────────────── */

import type {
  StoreMonthRecord,
  AggregatedMetrics,
  PeriodBasis,
} from './types';

export type TrendBasis = 'monthly' | 'ltm';
export type ProfitMetric = 'store_ebitdar' | 'store_ebitda' | 'ebitda';
export type TrendMetric = ProfitMetric | 'sales' | 'turnover' | 'tickets' | 'avg_ticket' | 'fcff' | 'raw_materials' | 'staff' | 'rents' | 'store_contribution' | 'capex';

export const PROFIT_METRICS = {
  store_ebitdar: { label: 'Store EBITDAR', amount: 'totalStoreEbitdar', ratio: 'storeEbitdarPct' },
  store_ebitda: { label: 'Store EBITDA', amount: 'totalStoreEbitda', ratio: 'storeEbitdaPct' },
  ebitda: { label: 'EBITDA', amount: 'totalEbitda', ratio: 'ebitdaPct' },
} as const;

// Keep the legacy database column: it is the store profit AFTER leases, BEFORE HQ.
export function recordMetric(record: StoreMonthRecord, metric: Exclude<TrendMetric, 'avg_ticket'>): number {
  if (metric === 'store_ebitdar') return recordMetric(record, 'store_ebitda') + recordMetric(record, 'rents');
  if (metric === 'store_ebitda') return recordMetric(record, 'store_contribution');
  if (metric === 'turnover') return record.turnover ?? (record.sales != null && record.vat != null ? record.sales - record.vat : NaN);
  return record[metric] ?? NaN;
}

export function comparisonChange(current: number | null, previous: number | null, ratio = false): number | null {
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (ratio) return current - previous;
  return previous === 0 ? null : (current - previous) / Math.abs(previous);
}

export function pnlReconciliationIssues(record: StoreMonthRecord): string[] {
  const subtract = (amount: number, ...deductions: number[]) =>
    [amount, ...deductions].every(Number.isFinite)
      ? amount - deductions.reduce((sum, value) => sum + value, 0)
      : NaN;
  const expectedStore = subtract(recordMetric(record, 'turnover'), record.raw_materials, record.staff,
    record.utilities, record.maintenance, record.banking_costs, record.others, record.rents);
  const checks = [
    ['Turnover', record.turnover, subtract(record.sales, record.vat)],
    ['Store EBITDA', record.store_contribution, expectedStore],
    ['EBITDA', record.ebitda, subtract(record.store_contribution, record.admin_costs)],
    ['FCFF', record.fcff, subtract(record.ebitda, record.capex, record.cit)],
  ] as const;
  return checks.flatMap(([label, actual, expected]) => Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) > 1
    ? [`${record.store} (${record.year}-${String(record.month).padStart(2, '0')}): ${label} differs by ${(actual - expected).toFixed(2)} EUR`]
    : []);
}

/** Safe division: returns null if denominator is 0 */
function safeDivide(num: number, den: number): number | null {
  return den !== 0 && Number.isFinite(num) && Number.isFinite(den) ? num / den : null;
}

function monthIndex(year: number, month: number): number {
  return year * 12 + month;
}

export function hasCompleteLtmWindow(records: StoreMonthRecord[], year: number, month: number): boolean {
  const endDate = monthIndex(year, month);
  const startDate = endDate - 11;
  const months = new Set<number>();
  for (const r of records) {
    const d = monthIndex(r.year, r.month);
    if (d >= startDate && d <= endDate) months.add(d);
  }
  return months.size === 12;
}

/**
 * Filter records for a given period basis
 */
export function filterByPeriod(
  records: StoreMonthRecord[],
  basis: PeriodBasis,
  year: number,
  month: number,
): StoreMonthRecord[] {
  switch (basis) {
    case 'monthly':
      return records.filter(r => r.year === year && r.month === month);

    case 'ytd':
      return records.filter(r => r.year === year && r.month <= month);

    case 'ltm': {
      // Trailing 12 months ending in year/month
      const endDate = year * 12 + month;
      const startDate = endDate - 11; // 12 months inclusive
      return records.filter(r => {
        const d = r.year * 12 + r.month;
        return d >= startDate && d <= endDate;
      });
    }
  }
}

/**
 * Aggregate records using weighted logic (§11.3)
 * Critical: ratio metrics use SUM(metric) / SUM(turnover), NOT average of store-level %
 */
export function aggregate(records: StoreMonthRecord[]): AggregatedMetrics {
  const uniqueStores = new Set(records.map(r => r.store));

  const totalSales = records.reduce((s, r) => s + (r.sales ?? NaN), 0);
  const totalTurnover = records.reduce((s, r) => s + recordMetric(r, 'turnover'), 0);
  const totalTickets = records.reduce((s, r) => s + (r.tickets ?? NaN), 0);
  const totalRawMaterials = records.reduce((s, r) => s + (r.raw_materials ?? NaN), 0);
  const totalStaff = records.reduce((s, r) => s + (r.staff ?? NaN), 0);
  const totalRents = records.reduce((s, r) => s + (r.rents ?? NaN), 0);
  const totalUtilities = records.reduce((s, r) => s + (r.utilities ?? NaN), 0);
  const totalMaintenance = records.reduce((s, r) => s + (r.maintenance ?? NaN), 0);
  const totalBankingCosts = records.reduce((s, r) => s + (r.banking_costs ?? NaN), 0);
  const totalVat = records.reduce((s, r) => s + (r.vat ?? NaN), 0);
  const totalOthers = records.reduce((s, r) => s + (r.others ?? NaN), 0);
  const totalSC = records.reduce((s, r) => s + recordMetric(r, 'store_ebitda'), 0);
  const totalStoreEbitdar = records.reduce((s, r) => s + recordMetric(r, 'store_ebitdar'), 0);
  const totalAdminCosts = records.reduce((s, r) => s + (r.admin_costs ?? NaN), 0);
  const totalEbitda = records.reduce((s, r) => s + (r.ebitda ?? NaN), 0);
  const totalCapex = records.reduce((s, r) => s + (r.capex ?? NaN), 0);
  const totalCit = records.reduce((s, r) => s + (r.cit ?? NaN), 0);
  const totalFcff = records.reduce((s, r) => s + (r.fcff ?? NaN), 0);

  // Count stores with negative EBITDA / FCFF (for monthly view, use the latest month per store)
  const ebitdaNegativeCount = countNegativeStores(records, 'ebitda');
  const fcffNegativeCount = countNegativeStores(records, 'fcff');

  const storeCount = uniqueStores.size;

  return {
    storeCount,
    totalSales,
    totalTurnover,
    totalTickets,
    avgTicket: safeDivide(totalSales, totalTickets) ?? 0,
    totalRawMaterials,
    totalStaff,
    totalRents,
    totalUtilities,
    totalMaintenance,
    totalBankingCosts,
    totalVat,
    totalOthers,
    totalStoreEbitdar,
    totalStoreEbitda: totalSC,
    totalAdminCosts,
    totalEbitda,
    totalCapex,
    totalCit,
    totalFcff,
    // Weighted ratios
    rawMaterialsPct: safeDivide(totalRawMaterials, totalTurnover),
    staffPct: safeDivide(totalStaff, totalTurnover),
    primeCostPct: safeDivide(totalRawMaterials + totalStaff, totalTurnover),
    rentsPct: safeDivide(totalRents, totalTurnover),
    utilitiesPct: safeDivide(totalUtilities, totalTurnover),
    maintenancePct: safeDivide(totalMaintenance, totalTurnover),
    bankingCostsPct: safeDivide(totalBankingCosts, totalTurnover),
    othersPct: safeDivide(totalOthers, totalTurnover),
    storeEbitdarPct: safeDivide(totalStoreEbitdar, totalTurnover),
    storeEbitdaPct: safeDivide(totalSC, totalTurnover),
    adminCostsPct: safeDivide(totalAdminCosts, totalTurnover),
    ebitdaPct: safeDivide(totalEbitda, totalTurnover),
    fcffPct: safeDivide(totalFcff, totalTurnover),
    // Derived
    storeEbitdarNegativeCount: countNegativeStores(records, 'store_ebitdar'),
    storeEbitdaNegativeCount: countNegativeStores(records, 'store_ebitda'),
    ebitdaNegativeCount,
    fcffNegativeCount,
    salesPerStore: safeDivide(totalSales, storeCount) ?? 0,
    turnoverPerStore: safeDivide(totalTurnover, storeCount) ?? 0,
    ebitdaPerStore: safeDivide(totalEbitda, storeCount) ?? 0,
    fcffPerStore: safeDivide(totalFcff, storeCount) ?? 0,
  };
}

/**
 * Aggregate records per store (sum across months, then compute per-store weighted ratios)
 */
export function aggregatePerStore(
  records: StoreMonthRecord[],
): Map<string, AggregatedMetrics & { store: string; code: string; concept: string; region: string; store_type: string; location: string; legal_entity: string }> {
  const grouped = new Map<string, StoreMonthRecord[]>();
  for (const r of records) {
    const list = grouped.get(r.store) || [];
    list.push(r);
    grouped.set(r.store, list);
  }

  const result = new Map<string, AggregatedMetrics & { store: string; code: string; concept: string; region: string; store_type: string; location: string; legal_entity: string }>();
  for (const [store, storeRecords] of grouped) {
    const agg = aggregate(storeRecords);
    const first = storeRecords[0];
    result.set(store, {
      ...agg,
      store,
      code: first.code ?? '',
      concept: first.concept,
      region: first.region,
      store_type: first.store_type,
      location: first.location,
      legal_entity: first.legal_entity,
    });
  }
  return result;
}

/**
 * Aggregate records per segment dimension
 */
export function aggregateByDimension(
  records: StoreMonthRecord[],
  dimension: 'concept' | 'region' | 'store_type' | 'location' | 'legal_entity',
): Map<string, AggregatedMetrics> {
  const grouped = new Map<string, StoreMonthRecord[]>();
  for (const r of records) {
    const key = r[dimension];
    const list = grouped.get(key) || [];
    list.push(r);
    grouped.set(key, list);
  }

  const result = new Map<string, AggregatedMetrics>();
  for (const [key, recs] of grouped) {
    result.set(key, aggregate(recs));
  }
  return result;
}

/**
 * Count stores with negative metric value (aggregate per store first)
 */
function countNegativeStores(records: StoreMonthRecord[], metric: ProfitMetric | 'fcff'): number {
  const storeAggs = new Map<string, number>();
  for (const r of records) {
    storeAggs.set(r.store, (storeAggs.get(r.store) ?? 0) + recordMetric(r, metric));
  }
  let count = 0;
  for (const val of storeAggs.values()) {
    if (val < 0) count++;
  }
  return count;
}

/**
 * Get monthly trend data: one data point per year-month combination
 */
export function getMonthlyTrend(
  records: StoreMonthRecord[],
  metric: TrendMetric,
  basis: TrendBasis = 'monthly',
): Array<{ period: string; year: number; month: number; value: number; sales: number; turnover: number }> {
  const grouped = new Map<string, StoreMonthRecord[]>();
  for (const r of records) {
    const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
    const list = grouped.get(key) || [];
    list.push(r);
    grouped.set(key, list);
  }

  return Array.from(grouped.entries())
    .map(([period, periodRecs]) => {
      const end = periodRecs[0];
      if (basis === 'ltm' && !hasCompleteLtmWindow(records, end.year, end.month)) return null;
      const recs = basis === 'ltm' ? filterByPeriod(records, 'ltm', end.year, end.month) : periodRecs;
      const totalSales = recs.reduce((s, r) => s + (r.sales ?? NaN), 0);
      const totalTurnover = recs.reduce((s, r) => s + recordMetric(r, 'turnover'), 0);
      const totalTickets = recs.reduce((s, r) => s + (r.tickets ?? NaN), 0);
      let value: number;
      if (metric === 'avg_ticket') {
        value = totalTickets !== 0 ? totalSales / totalTickets : 0;
      } else if (metric === 'turnover') {
        value = totalTurnover;
      } else {
        value = recs.reduce((s, r) => s + recordMetric(r, metric), 0);
      }
      return {
        period,
        year: end.year,
        month: end.month,
        value,
        sales: totalSales,
        turnover: totalTurnover,
      };
    })
    .filter((o): o is { period: string; year: number; month: number; value: number; sales: number; turnover: number } => o !== null)
    .sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Get ratio trend data (weighted aggregation per period)
 */
export function getRatioTrend(
  records: StoreMonthRecord[],
  numeratorField: ProfitMetric | 'raw_materials' | 'staff' | 'rents' | 'fcff' | 'store_contribution',
  denominatorField: keyof Pick<StoreMonthRecord, 'sales' | 'turnover' | 'tickets'> = 'turnover',
  basis: TrendBasis = 'monthly',
): Array<{ period: string; year: number; month: number; value: number | null }> {
  const grouped = new Map<string, StoreMonthRecord[]>();
  for (const r of records) {
    const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
    const list = grouped.get(key) || [];
    list.push(r);
    grouped.set(key, list);
  }

  return Array.from(grouped.entries())
    .map(([period, periodRecs]) => {
      const end = periodRecs[0];
      if (basis === 'ltm' && !hasCompleteLtmWindow(records, end.year, end.month)) return null;
      const recs = basis === 'ltm' ? filterByPeriod(records, 'ltm', end.year, end.month) : periodRecs;
      const totalNum = recs.reduce((s, r) => s + recordMetric(r, numeratorField), 0);
      const totalDen = recs.reduce((s, r) => (
        s + recordMetric(r, denominatorField)
      ), 0);
      return {
        period,
        year: end.year,
        month: end.month,
        value: safeDivide(totalNum, totalDen),
      };
    })
    .filter((o): o is { period: string; year: number; month: number; value: number | null } => o !== null)
    .sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Get yearly comparison data (weighted aggregation per year)
 * Respects periodBasis and month from filters for apples-to-apples comparison
 */
export function getYearlyComparison(
  records: StoreMonthRecord[],
  basis: PeriodBasis,
  month: number,
  availableYears: number[],
): Array<{ year: number; metrics: AggregatedMetrics }> {
  return availableYears
    .map(year => {
      if (basis === 'ltm' && !hasCompleteLtmWindow(records, year, month)) return null;
      const subset = filterByPeriod(records, basis, year, month);
      if (subset.length === 0) return null;
      return {
        year,
        metrics: aggregate(subset),
      };
    })
    .filter((o): o is { year: number; metrics: AggregatedMetrics } => o !== null)
    .sort((a, b) => b.year - a.year); // Newest first
}

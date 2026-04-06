/* ────────────────────────────────────────────────────────
 * Calculation Engine — YTD, LTM, weighted aggregation
 * ──────────────────────────────────────────────────────── */

import type {
  StoreMonthRecord,
  AggregatedMetrics,
  PeriodBasis,
} from './types';

/** Safe division: returns null if denominator is 0 */
function safeDivide(num: number, den: number): number | null {
  return den !== 0 ? num / den : null;
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
 * Critical: ratio metrics use SUM(metric) / SUM(sales), NOT average of store-level %
 */
export function aggregate(records: StoreMonthRecord[]): AggregatedMetrics {
  const uniqueStores = new Set(records.map(r => r.store));

  const totalSales = records.reduce((s, r) => s + r.sales, 0);
  const totalTickets = records.reduce((s, r) => s + r.tickets, 0);
  const totalRawMaterials = records.reduce((s, r) => s + r.raw_materials, 0);
  const totalStaff = records.reduce((s, r) => s + r.staff, 0);
  const totalRents = records.reduce((s, r) => s + r.rents, 0);
  const totalUtilities = records.reduce((s, r) => s + r.utilities, 0);
  const totalMaintenance = records.reduce((s, r) => s + r.maintenance, 0);
  const totalBankingCosts = records.reduce((s, r) => s + r.banking_costs, 0);
  const totalVat = records.reduce((s, r) => s + r.vat, 0);
  const totalOthers = records.reduce((s, r) => s + r.others, 0);
  const totalSC = records.reduce((s, r) => s + r.store_contribution, 0);
  const totalAdminCosts = records.reduce((s, r) => s + r.admin_costs, 0);
  const totalEbitda = records.reduce((s, r) => s + r.ebitda, 0);
  const totalCapex = records.reduce((s, r) => s + r.capex, 0);
  const totalCit = records.reduce((s, r) => s + r.cit, 0);
  const totalFcff = records.reduce((s, r) => s + r.fcff, 0);

  // Count stores with negative EBITDA / FCFF (for monthly view, use the latest month per store)
  const ebitdaNegativeCount = countNegativeStores(records, 'ebitda');
  const fcffNegativeCount = countNegativeStores(records, 'fcff');

  const storeCount = uniqueStores.size;

  return {
    storeCount,
    totalSales,
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
    totalStoreContribution: totalSC,
    totalAdminCosts,
    totalEbitda,
    totalCapex,
    totalCit,
    totalFcff,
    // Weighted ratios
    rawMaterialsPct: safeDivide(totalRawMaterials, totalSales),
    staffPct: safeDivide(totalStaff, totalSales),
    rentsPct: safeDivide(totalRents, totalSales),
    utilitiesPct: safeDivide(totalUtilities, totalSales),
    maintenancePct: safeDivide(totalBankingCosts, totalSales), // Fixed mapping if needed, or keeping consistent
    bankingCostsPct: safeDivide(totalBankingCosts, totalSales),
    vatPct: safeDivide(totalVat, totalSales),
    othersPct: safeDivide(totalOthers, totalSales),
    storeContributionPct: safeDivide(totalSC, totalSales),
    adminCostsPct: safeDivide(totalAdminCosts, totalSales),
    ebitdaPct: safeDivide(totalEbitda, totalSales),
    fcffPct: safeDivide(totalFcff, totalSales),
    // Derived
    ebitdaNegativeCount,
    fcffNegativeCount,
    salesPerStore: safeDivide(totalSales, storeCount) ?? 0,
    ebitdaPerStore: safeDivide(totalEbitda, storeCount) ?? 0,
    fcffPerStore: safeDivide(totalFcff, storeCount) ?? 0,
  };
}

/**
 * Aggregate records per store (sum across months, then compute per-store weighted ratios)
 */
export function aggregatePerStore(
  records: StoreMonthRecord[],
): Map<string, AggregatedMetrics & { store: string; concept: string; region: string; store_type: string; location: string; legal_entity: string }> {
  const grouped = new Map<string, StoreMonthRecord[]>();
  for (const r of records) {
    const list = grouped.get(r.store) || [];
    list.push(r);
    grouped.set(r.store, list);
  }

  const result = new Map<string, AggregatedMetrics & { store: string; concept: string; region: string; store_type: string; location: string; legal_entity: string }>();
  for (const [store, storeRecords] of grouped) {
    const agg = aggregate(storeRecords);
    const first = storeRecords[0];
    result.set(store, {
      ...agg,
      store,
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
function countNegativeStores(records: StoreMonthRecord[], metric: 'ebitda' | 'fcff'): number {
  const storeAggs = new Map<string, number>();
  for (const r of records) {
    storeAggs.set(r.store, (storeAggs.get(r.store) || 0) + r[metric]);
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
  metric: keyof Pick<StoreMonthRecord, 'sales' | 'tickets' | 'avg_ticket' | 'ebitda' | 'fcff' | 'raw_materials' | 'staff' | 'store_contribution' | 'capex'>,
): Array<{ period: string; year: number; month: number; value: number; sales: number }> {
  const grouped = new Map<string, StoreMonthRecord[]>();
  for (const r of records) {
    const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
    const list = grouped.get(key) || [];
    list.push(r);
    grouped.set(key, list);
  }

  return Array.from(grouped.entries())
    .map(([period, recs]) => {
      const totalSales = recs.reduce((s, r) => s + r.sales, 0);
      const totalTickets = recs.reduce((s, r) => s + r.tickets, 0);
      let value: number;
      if (metric === 'avg_ticket') {
        value = totalTickets !== 0 ? totalSales / totalTickets : 0;
      } else {
        value = recs.reduce((s, r) => s + (r[metric] as number), 0);
      }
      return {
        period,
        year: recs[0].year,
        month: recs[0].month,
        value,
        sales: totalSales,
      };
    })
    .sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Get ratio trend data (weighted aggregation per period)
 */
export function getRatioTrend(
  records: StoreMonthRecord[],
  numeratorField: keyof Pick<StoreMonthRecord, 'raw_materials' | 'staff' | 'rents' | 'ebitda' | 'fcff' | 'store_contribution'>,
  denominatorField: keyof Pick<StoreMonthRecord, 'sales' | 'tickets'> = 'sales',
): Array<{ period: string; year: number; month: number; value: number | null }> {
  const grouped = new Map<string, StoreMonthRecord[]>();
  for (const r of records) {
    const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
    const list = grouped.get(key) || [];
    list.push(r);
    grouped.set(key, list);
  }

  return Array.from(grouped.entries())
    .map(([period, recs]) => {
      const totalNum = recs.reduce((s, r) => s + (r[numeratorField] as number), 0);
      const totalDen = recs.reduce((s, r) => s + (r[denominatorField] as number), 0);
      return {
        period,
        year: recs[0].year,
        month: recs[0].month,
        value: safeDivide(totalNum, totalDen),
      };
    })
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

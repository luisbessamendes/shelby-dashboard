/* ────────────────────────────────────────────────────────
 * Calculation Engine — YTD, LTM, weighted aggregation
 * ──────────────────────────────────────────────────────── */

import type {
  StoreMonthRecord,
  AggregatedMetrics,
  PeriodBasis,
} from './types';

function safeDivide(num: number, den: number): number | null {
  return den !== 0 ? num / den : null;
}

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
      const endDate = year * 12 + month;
      const startDate = endDate - 11;
      return records.filter(r => {
        const d = r.year * 12 + r.month;
        return d >= startDate && d <= endDate;
      });
    }
  }
}

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

  const storeCount = uniqueStores.size;

  return {
    storeCount, totalSales, totalTickets, avgTicket: safeDivide(totalSales, totalTickets) ?? 0,
    totalRawMaterials, totalStaff, totalRents, totalUtilities, totalMaintenance, totalBankingCosts, totalVat, totalOthers, totalStoreContribution: totalSC, totalAdminCosts, totalEbitda, totalCapex, totalCit, totalFcff,
    rawMaterialsPct: safeDivide(totalRawMaterials, totalSales), staffPct: safeDivide(totalStaff, totalSales), rentsPct: safeDivide(totalRents, totalSales), utilitiesPct: safeDivide(totalUtilities, totalSales), maintenancePct: safeDivide(totalMaintenance, totalSales), bankingCostsPct: safeDivide(totalBankingCosts, totalSales), vatPct: safeDivide(totalVat, totalSales), othersPct: safeDivide(totalOthers, totalSales), storeContributionPct: safeDivide(totalSC, totalSales), adminCostsPct: safeDivide(totalAdminCosts, totalSales), ebitdaPct: safeDivide(totalEbitda, totalSales), fcffPct: safeDivide(totalFcff, totalSales),
    ebitdaNegativeCount: 0, fcffNegativeCount: 0, salesPerStore: safeDivide(totalSales, storeCount) ?? 0, ebitdaPerStore: safeDivide(totalEbitda, storeCount) ?? 0, fcffPerStore: safeDivide(totalFcff, storeCount) ?? 0,
  };
}

export function aggregatePerStore(records: StoreMonthRecord[]): Map<string, any> {
  const grouped = new Map<string, StoreMonthRecord[]>();
  for (const r of records) {
    const list = grouped.get(r.store) || [];
    list.push(r);
    grouped.set(r.store, list);
  }
  const result = new Map<string, any>();
  for (const [store, storeRecords] of grouped) {
    const agg = aggregate(storeRecords);
    result.set(store, { ...agg, store, concept: storeRecords[0].concept, region: storeRecords[0].region });
  }
  return result;
}

export function aggregateByDimension(records: StoreMonthRecord[], dimension: keyof StoreMonthRecord): Map<string, AggregatedMetrics> {
  const grouped = new Map<string, StoreMonthRecord[]>();
  for (const r of records) {
    const key = r[dimension] as string;
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

export function getMonthlyTrend(records: StoreMonthRecord[], metric: keyof StoreMonthRecord): any[] {
  const grouped = new Map<string, StoreMonthRecord[]>();
  for (const r of records) {
    const key = \`\${r.year}-\${String(r.month).padStart(2, '0')}\`;
    const list = grouped.get(key) || [];
    list.push(r);
    grouped.set(key, list);
  }
  return Array.from(grouped.entries()).map(([period, recs]) => ({
    period, value: recs.reduce((s, r) => s + (r[metric] as number), 0),
  })).sort((a, b) => a.period.localeCompare(b.period));
}

export function getRatioTrend(records: StoreMonthRecord[], numerator: keyof StoreMonthRecord): any[] {
  const grouped = new Map<string, StoreMonthRecord[]>();
  for (const r of records) {
    const key = \`\${r.year}-\${String(r.month).padStart(2, '0')}\`;
    const list = grouped.get(key) || [];
    list.push(r);
    grouped.set(key, list);
  }
  return Array.from(grouped.entries()).map(([period, recs]) => ({
    period, value: safeDivide(recs.reduce((s, r) => s + (r[numerator] as number), 0), recs.reduce((s, r) => s + r.sales, 0)),
  })).sort((a, b) => a.period.localeCompare(b.period));
}

export function getYearlyComparison(records: StoreMonthRecord[], basis: PeriodBasis, month: number, years: number[]): any[] {
  return years.map(y => {
    const sub = filterByPeriod(records, basis, y, month);
    return sub.length ? { year: y, metrics: aggregate(sub) } : null;
  }).filter(o => o !== null);
}

import { aggregate, filterByPeriod, hasCompleteLtmWindow, pnlReconciliationIssues } from './calculations';
import { applyDimensionFilters } from './analytics-queries';
import { expectsPerimeterReport, indexPerimeterRegistry, PERIMETER_REGISTRY } from './perimeter-registry';
import { identityResolver } from './perimeter';
import type { BiArgs, ReportContext } from './bi-contract';
import type { FilterState, StoreMonthRecord } from './types';

export const monthIndex = (r: Pick<StoreMonthRecord, 'year' | 'month'>) => r.year * 12 + r.month - 1;
export const monthName = (m: number) => `${Math.floor(m / 12)}-${String(m % 12 + 1).padStart(2, '0')}`;
export const dimensionKeys = ['stores', 'concepts', 'regions', 'locations', 'legalEntities', 'storeTypes'] as const;

export function biFilters(header: FilterState, args: BiArgs): FilterState {
  const scope = { ...header };
  if (args.year != null) scope.year = args.year;
  if (args.month != null) scope.month = args.month;
  if (args.periodBasis != null) scope.periodBasis = args.periodBasis;
  for (const key of dimensionKeys) if (args[key]?.length) {
    if (header[key].length && args[key]!.some(v => !header[key].includes(v))) throw new Error(`${key} is outside the header selection. Ask the user to change the header before expanding the scope.`);
    scope[key] = args[key]!;
  }
  return scope;
}

export function selectedRecords(records: StoreMonthRecord[], filters: FilterState, report?: ReportContext) {
  const scoped = applyDimensionFilters(records, filters);
  if (report?.path === '/performance' && report.search) {
    const q = report.search.toLowerCase();
    const matches = new Set(scoped.filter(r => [r.store, r.concept, r.region].some(s => s.toLowerCase().includes(q))).map(r => r.store));
    return scoped.filter(r => matches.has(r.store));
  }
  return scoped;
}

export function periodRows(records: StoreMonthRecord[], filters: FilterState) {
  // Most report pages intentionally show all history when either endpoint selector is All.
  return filters.year && filters.month ? filterByPeriod(records, filters.periodBasis, filters.year, filters.month) : records;
}

export function periodInfo(filters: FilterState) {
  if (!filters.year || !filters.month) return { label: 'All available history (Year or Month is All)', start: null, end: null, months: [] as number[] };
  const end = monthIndex({ year: filters.year, month: filters.month });
  const start = filters.periodBasis === 'monthly' ? end : filters.periodBasis === 'ytd' ? filters.year * 12 : end - 11;
  return { label: `${filters.periodBasis.toUpperCase()} ${monthName(end)}`, start: monthName(start), end: monthName(end), months: Array.from({ length: end - start + 1 }, (_, i) => start + i) };
}

export function reportingQuality(records: StoreMonthRecord[], filters: FilterState) {
  const rows = periodRows(records, filters);
  const period = periodInfo(filters);
  const months = new Set(rows.map(monthIndex));
  const missingCalendarMonths = period.months.filter(m => !months.has(m)).map(monthName);
  const identity = identityResolver(records);
  const registry = indexPerimeterRegistry(PERIMETER_REGISTRY);
  const stores = new Map<string, StoreMonthRecord[]>();
  for (const r of records) stores.set(identity(r), [...(stores.get(identity(r)) ?? []), r]);
  const missingStoreMonths = [...stores].flatMap(([id, history]) => {
    const known = registry.get(id.replace(/^code:/, ''));
    const observed = new Set(history.map(monthIndex));
    const missing = period.months.filter(m => expectsPerimeterReport(known, m) && !observed.has(m));
    return missing.length ? [{ store: history[0].store, code: history[0].code, months: missing.map(monthName), registered: !!known }] : [];
  });
  const seen = new Set<string>();
  const duplicates = rows.flatMap(r => {
    const key = `${identity(r)}:${monthIndex(r)}`;
    const duplicate = seen.has(key); seen.add(key);
    return duplicate ? [{ store: r.store, code: r.code, month: monthName(monthIndex(r)), id: r.id }] : [];
  });
  const reconciliation = rows.flatMap(pnlReconciliationIssues);
  const now = new Date();
  const futureRows = rows.filter(r => monthIndex(r) > monthIndex({ year: now.getFullYear(), month: now.getMonth() + 1 }));
  return { records: rows.length, distinctMonths: months.size, missingCalendarMonths,
    missingStoreMonths: missingStoreMonths.slice(0, 30), missingStoreCount: missingStoreMonths.length,
    duplicateCount: duplicates.length, duplicates: duplicates.slice(0, 15),
    reconciliationCount: reconciliation.length, reconciliation: reconciliation.slice(0, 15),
    zeroTicketRows: rows.filter(r => r.tickets === 0).length, futureDatedRows: futureRows.length,
    warning: 'Missing rows are not verified zero trading, openings or closures. Future-dated uploaded figures are not confirmed actuals. Reconciliation uses uploaded totals without silently correcting them.',
  };
}

export function periodSnapshot(records: StoreMonthRecord[], filters: FilterState) {
  const rows = periodRows(records, filters);
  const completeLtm = !filters.year || !filters.month || filters.periodBasis !== 'ltm' || hasCompleteLtmWindow(records, filters.year, filters.month);
  return { period: periodInfo(filters), rows, metrics: rows.length ? aggregate(rows) : null, completeLtm };
}

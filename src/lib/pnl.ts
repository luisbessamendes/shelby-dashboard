import { aggregate, filterByPeriod, hasCompleteLtmWindow, pnlReconciliationIssues } from './calculations';
import { MONTH_SHORT_NAMES } from './constants';
import type { AggregatedMetrics, PeriodBasis, StoreMonthRecord } from './types';

export type PnlValuePeriodKey = 'fyOlder' | 'fyRecent' | 'currentPrior' | 'current';

export interface PnlColumnDefinition {
  key: 'fyOlder' | 'fyRecent' | 'fyYoy' | 'current' | 'currentYoy';
  label: string;
  title?: string;
  valueKey: PnlValuePeriodKey;
  compareKey?: PnlValuePeriodKey;
}

export interface PnlGroupComparison {
  id: string;
  label: string;
  kind: 'store' | 'concept-total' | 'portfolio-total';
  values: Record<PnlValuePeriodKey, AggregatedMetrics | null>;
}

export interface PnlComparisonModel {
  columns: PnlColumnDefinition[];
  groups: PnlGroupComparison[];
  notice: string | null;
  reconciliationIssues: string[];
}

interface PnlGroupSource {
  id: string;
  label: string;
  kind: PnlGroupComparison['kind'];
  records: StoreMonthRecord[];
}

function currentPeriodLabel(basis: PeriodBasis, year: number, month: number): string {
  const monthName = MONTH_SHORT_NAMES[month];
  if (basis === 'ytd') return `YTD ${monthName} ${year}`;
  if (basis === 'ltm') return `LTM ${monthName} ${year}`;
  return `${monthName} ${year}`;
}

function periodRecords(
  records: StoreMonthRecord[],
  key: PnlValuePeriodKey,
  basis: PeriodBasis,
  year: number,
  month: number,
): StoreMonthRecord[] {
  if (key === 'fyOlder') return filterByPeriod(records, basis, year - 2, month);
  if (key === 'fyRecent') return filterByPeriod(records, basis, year - 1, month);
  if (key === 'currentPrior') return filterByPeriod(records, basis, year - 1, month);
  return filterByPeriod(records, basis, year, month);
}

function buildGroupSources(records: StoreMonthRecord[]): PnlGroupSource[] {
  const byConcept = new Map<string, Map<string, StoreMonthRecord[]>>();

  for (const record of records) {
    const conceptStores = byConcept.get(record.concept) ?? new Map<string, StoreMonthRecord[]>();
    const storeRecords = conceptStores.get(record.store) ?? [];
    storeRecords.push(record);
    conceptStores.set(record.store, storeRecords);
    byConcept.set(record.concept, conceptStores);
  }

  const collator = new Intl.Collator('en', { sensitivity: 'base' });
  const groups: PnlGroupSource[] = [];

  for (const concept of [...byConcept.keys()].sort(collator.compare)) {
    const stores = byConcept.get(concept)!;
    const conceptRecords: StoreMonthRecord[] = [];

    for (const store of [...stores.keys()].sort(collator.compare)) {
      const storeRecords = stores.get(store)!;
      conceptRecords.push(...storeRecords);
      groups.push({
        id: `store:${concept}:${store}`,
        label: `${concept} \u00b7 ${store}`,
        kind: 'store',
        records: storeRecords,
      });
    }

    groups.push({
      id: `concept:${concept}`,
      label: `${concept} \u00b7 Total`,
      kind: 'concept-total',
      records: conceptRecords,
    });
  }

  groups.push({
    id: 'portfolio-total',
    label: 'Portfolio \u00b7 Total',
    kind: 'portfolio-total',
    records,
  });

  return groups;
}

export function buildPnlComparison(
  records: StoreMonthRecord[],
  basis: PeriodBasis,
  year: number,
  month: number,
): PnlComparisonModel {
  const currentLtmComplete = basis !== 'ltm' || hasCompleteLtmWindow(records, year, month);
  const priorLtmComplete = basis !== 'ltm' || hasCompleteLtmWindow(records, year - 1, month);
  const olderLtmComplete = basis !== 'ltm' || hasCompleteLtmWindow(records, year - 2, month);
  const periodAvailability: Record<PnlValuePeriodKey, boolean> = {
    fyOlder: olderLtmComplete,
    fyRecent: priorLtmComplete,
    currentPrior: priorLtmComplete,
    current: currentLtmComplete,
  };

  const columns: PnlColumnDefinition[] = [
    { key: 'fyOlder', label: currentPeriodLabel(basis, year - 2, month), valueKey: 'fyOlder' },
    { key: 'fyRecent', label: currentPeriodLabel(basis, year - 1, month), valueKey: 'fyRecent' },
    { key: 'fyYoy', label: 'YoY / pp', title: `${currentPeriodLabel(basis, year - 1, month)} vs ${currentPeriodLabel(basis, year - 2, month)}: amount growth in %, margin change in percentage points`, valueKey: 'fyRecent', compareKey: 'fyOlder' },
    { key: 'current', label: currentPeriodLabel(basis, year, month), valueKey: 'current' },
    { key: 'currentYoy', label: 'YoY / pp', title: `${currentPeriodLabel(basis, year, month)} vs ${currentPeriodLabel(basis, year - 1, month)}: amount growth in %, margin change in percentage points`, valueKey: 'current', compareKey: 'currentPrior' },
  ];

  const groups = buildGroupSources(records).map(group => {
    const values = {} as Record<PnlValuePeriodKey, AggregatedMetrics | null>;
    const keys: PnlValuePeriodKey[] = ['fyOlder', 'fyRecent', 'currentPrior', 'current'];

    for (const key of keys) {
      if (!periodAvailability[key]) {
        values[key] = null;
        continue;
      }

      const subset = periodRecords(group.records, key, basis, year, month);
      values[key] = subset.length > 0 ? aggregate(subset) : null;
    }

    return {
      id: group.id,
      label: group.label,
      kind: group.kind,
      values,
    };
  });

  let notice: string | null = null;
  if (basis === 'ltm' && !currentLtmComplete) {
    notice = `${currentPeriodLabel(basis, year, month)} is unavailable because the filtered data does not contain 12 calendar months.`;
  } else if (basis === 'ltm' && !priorLtmComplete) {
    notice = `${currentPeriodLabel(basis, year - 1, month)} is unavailable because the filtered data does not contain 12 calendar months. Comparisons using this period are also unavailable.`;
  } else if (basis === 'ltm' && !olderLtmComplete) {
    notice = `${currentPeriodLabel(basis, year - 2, month)} is unavailable because the filtered data does not contain 12 calendar months. Comparisons using this period are also unavailable.`;
  }

  const comparedRecords = new Set(['fyOlder', 'fyRecent', 'currentPrior', 'current'].flatMap(key =>
    periodRecords(records, key as PnlValuePeriodKey, basis, year, month)));
  const reconciliationIssues = [...comparedRecords].flatMap(pnlReconciliationIssues);
  return { columns, groups, notice, reconciliationIssues };
}

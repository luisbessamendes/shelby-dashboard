import { aggregate, comparisonChange, pnlReconciliationIssues } from './calculations';
import { MONTH_SHORT_NAMES } from './constants';
import type { PnlRowDefinition } from './pnl-rows';
import type { AggregatedMetrics, FilterState, StoreMonthRecord } from './types';

export const COHORTS = [
  { key: 'l4l', label: 'L4L', column: 'L4L Change' },
  { key: 'new', label: 'New Stores', column: 'New Impact' },
  { key: 'closed', label: 'Closed Stores (inferred)', column: 'Closed Impact' },
  { key: 'other', label: 'Other / Not Comparable', column: 'Other Impact' },
] as const;
export type Cohort = typeof COHORTS[number]['key'];
export type PerimeterStageKey = 'fy25' | 'ltm';
export type PerimeterColumn = 'baseline' | 'fy25' | 'current' | 'change' | `${PerimeterStageKey}:${Cohort}`;
type PerimeterFilters = Pick<FilterState, 'stores' | 'concepts' | 'regions' | 'locations' | 'legalEntities' | 'storeTypes'>;
export interface PerimeterStore {
  id: string;
  name: string;
  concept: string;
  cohort: Cohort;
  reason: string;
}
interface PeriodPair {
  baseline: AggregatedMetrics | null;
  current: AggregatedMetrics | null;
}
export interface PerimeterGroup extends PeriodPair {
  id: string;
  label: string;
  fy25: AggregatedMetrics | null;
  stages: Record<PerimeterStageKey, Record<Cohort, PeriodPair>>;
}
export interface PerimeterStage {
  key: PerimeterStageKey;
  label: string;
  baselineYear: number;
  end: number;
  stores: PerimeterStore[];
}
export interface PerimeterModel {
  endpoint: string;
  groups: PerimeterGroup[];
  stores: Pick<PerimeterStore, 'id' | 'name' | 'concept'>[];
  stages: PerimeterStage[];
  notices: string[];
  reconciliationIssues: string[];
  blocked: string | null;
  provisional: boolean;
}

const BASE_START = 2024 * 12;
const BASE_END = BASE_START + 11;
const MIDDLE_START = 2025 * 12;
const MIDDLE_END = MIDDLE_START + 11;
const index = (r: Pick<StoreMonthRecord, 'year' | 'month'>) => r.year * 12 + r.month - 1;
const sequence = (start: number, end: number) => Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
const monthLabel = (value: number) => `${Math.floor(value / 12)}-${String(value % 12 + 1).padStart(2, '0')}`;

function identityResolver(records: StoreMonthRecord[]) {
  const codes = new Map<string, Set<string>>();
  for (const r of records) {
    if (r.code?.trim()) codes.set(r.store, (codes.get(r.store) ?? new Set()).add(r.code.trim()));
  }
  return (r: StoreMonthRecord) => {
    const known = codes.get(r.store);
    const code = r.code?.trim() || (known?.size === 1 ? [...known][0] : '');
    return code ? `code:${code}` : `store:${r.store}`;
  };
}

function coverage(records: StoreMonthRecord[], end: number, identity: (r: StoreMonthRecord) => string) {
  const months = new Map<number, Set<string>>();
  for (const r of records) months.set(index(r), (months.get(index(r)) ?? new Set()).add(identity(r)));
  const suspect = new Set<number>();
  for (const m of sequence(BASE_START, end)) {
    const previous = [1, 2, 3].map(offset => months.get(m - offset)?.size ?? 0).sort((a, b) => a - b);
    const count = months.get(m)?.size ?? 0;
    if (!count || (previous[1] > 0 && count < previous[1] * 0.8)) suspect.add(m);
  }
  return { months, suspect };
}

function classify(id: string, allHistory: StoreMonthRecord[], stage: PerimeterStage, suspect: Set<number>): PerimeterStore {
  const { end, baselineYear } = stage;
  const start = baselineYear * 12;
  const baselineEnd = start + 11;
  const history = allHistory.filter(r => index(r) <= end);
  const latest = history.reduce((a, b) => index(a) > index(b) ? a : b);
  const result = (cohort: Cohort, reason: string): PerimeterStore => ({ id, name: latest.store, concept: latest.concept, cohort, reason });
  const scopedHistory = history.filter(r => index(r) >= start);
  const months = new Map(scopedHistory.map(r => [index(r), r]));
  if (months.size !== scopedHistory.length) return result('other', 'Duplicate store/month records or an ambiguous store code.');
  if (id.startsWith('store:')) return result('other', 'No reliable store code; name matching only.');
  const dimensions = ['concept', 'region', 'location', 'legal_entity', 'store_type'] as const;
  if (dimensions.some(key => new Set(scopedHistory.map(r => r[key])).size > 1)) {
    return result('other', 'Business classification changed during this comparison.');
  }
  if (scopedHistory.some(r => !Number.isFinite(r.sales) || r.sales < 0)) return result('other', 'Missing or negative sales require review.');
  const trading = history.filter(r => r.sales > 0).map(index).sort((a, b) => a - b);
  if (!trading.length) return result('other', 'Cost-only records; no observed trading.');
  const first = trading[0];
  const last = trading[trading.length - 1];
  const positive = (m: number) => (months.get(m)?.sales ?? 0) > 0;
  if (sequence(start, end).every(positive)) return result('l4l', 'Positive sales in both full annual windows and every intervening month.');
  const firstInScope = trading.find(m => m >= start);
  if (firstInScope !== undefined && !sequence(firstInScope, last).every(positive)) {
    return result('other', 'Trading interruption or missing reports followed by resumed trading. Cause unconfirmed; may include temporary closure.');
  }
  const resumesLater = allHistory.some(r => index(r) > end && r.sales > 0);
  if (last < end && resumesLater) return result('other', 'Trading stopped during this comparison and resumed later in the available reported history. Temporary interruption; cause unconfirmed.');
  if (first > baselineEnd && !sequence(start, baselineEnd).some(m => suspect.has(m))) {
    return result('new', `First observed trading ${monthLabel(first)}; includes pre-opening costs${last < end ? ' and any subsequent cessation of trading' : ''}. Entry is inferred, not a verified opening date.`);
  }
  // Absence of reports is not evidence of closure. Require a reported zero-sales tail.
  const tail = sequence(last + 1, end);
  if (last >= baselineEnd && sequence(start, last).every(positive) && tail.length >= 3
    && tail.every(m => months.get(m)?.sales === 0 && !suspect.has(m))) {
    return result('closed', `Inferred cessation after ${monthLabel(last)}: at least three consecutive reported zero-sales months through the endpoint. Not a confirmed closure; residual costs retained.`);
  }
  if (!sequence(start, baselineEnd).every(positive)) return result('other', `Partial FY ${baselineYear} trading, annualisation, reopening, or incomplete baseline history.`);
  if (last < end) return result('other', `Last observed trading ${monthLabel(last)}; missing reports or insufficient evidence to infer closure.`);
  return result('other', 'Interrupted trading or missing months; not continuously comparable.');
}

function periodPair(records: StoreMonthRecord[], stage: PerimeterStage, available: { baseline: boolean; current: boolean }): PeriodPair {
  const start = stage.baselineYear * 12;
  return {
    baseline: available.baseline ? aggregate(records.filter(r => index(r) >= start && index(r) <= start + 11)) : null,
    current: available.current ? aggregate(records.filter(r => index(r) >= stage.end - 11 && index(r) <= stage.end)) : null,
  };
}

export function buildPerimeterComparison(
  allRecords: StoreMonthRecord[], filters: PerimeterFilters, year: number, month: number, now = new Date(),
): PerimeterModel {
  const end = year * 12 + month - 1;
  const model: PerimeterModel = {
    endpoint: `LTM ${MONTH_SHORT_NAMES[month]} ${year}`, groups: [], stores: [], stages: [], notices: [],
    reconciliationIssues: [], blocked: null, provisional: false,
  };
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || end <= MIDDLE_END) {
    return { ...model, blocked: 'Select an endpoint in 2026 or later to compare FY 2024, FY 2025 and LTM.' };
  }
  if (end > now.getFullYear() * 12 + now.getMonth()) return { ...model, blocked: 'The selected endpoint is in the future. Select a reported Year and Month.' };

  const history = allRecords.filter(r => index(r) <= end);
  const identity = identityResolver(allRecords);
  const { months, suspect } = coverage(history, end, identity);
  const available = {
    baseline: sequence(BASE_START, BASE_END).every(m => months.has(m)),
    fy25: sequence(MIDDLE_START, MIDDLE_END).every(m => months.has(m)),
    current: sequence(end - 11, end).every(m => months.has(m)),
  };
  if (!available.baseline) model.notices.push('FY 2024 has missing calendar months. Its totals and bridge movements are unavailable.');
  if (!available.fy25) model.notices.push('FY 2025 has missing calendar months. Its totals and both bridge stages are unavailable.');
  if (!available.current) model.notices.push(`${model.endpoint} has missing calendar months. Its totals and bridge movements are unavailable.`);
  const lowCoverage = [...suspect].filter(m => months.has(m));
  if (lowCoverage.length) model.notices.push(`Potentially incomplete reporting: ${lowCoverage.map(monthLabel).join(', ')}. Store count fell more than 20% below the preceding three-month median. Figures are provisional; closures are not inferred across these gaps.`);
  model.provisional = suspect.size > 0 || end === now.getFullYear() * 12 + now.getMonth();
  if (end === now.getFullYear() * 12 + now.getMonth()) model.notices.push('The endpoint month is still in progress. Reported figures are provisional.');

  const histories = new Map<string, StoreMonthRecord[]>();
  for (const r of history) {
    const id = identity(r);
    const rows = histories.get(id) ?? [];
    rows.push(r);
    histories.set(id, rows);
  }
  // Reopening evidence must not disappear when the user selects an earlier endpoint.
  const knownHistories = new Map<string, StoreMonthRecord[]>();
  const reportedEnd = now.getFullYear() * 12 + now.getMonth();
  for (const r of allRecords.filter(r => index(r) <= reportedEnd)) {
    const id = identity(r);
    const rows = knownHistories.get(id) ?? [];
    rows.push(r);
    knownHistories.set(id, rows);
  }
  model.stages = [
    { key: 'fy25', label: 'FY 2024 to FY 2025', baselineYear: 2024, end: MIDDLE_END, stores: [] },
    { key: 'ltm', label: `FY 2025 to ${model.endpoint}`, baselineYear: 2025, end, stores: [] },
  ];
  const identitiesByName = new Map<string, Set<string>>();
  for (const r of history) identitiesByName.set(r.store, (identitiesByName.get(r.store) ?? new Set()).add(identity(r)));
  const ambiguous = new Set([...identitiesByName.values()].filter(ids => ids.size > 1).flatMap(ids => [...ids]));
  // Resolve store names to codes before applying only the active business filters.
  const selectedIdsByName = new Set(allRecords.filter(r => filters.stores.includes(r.store)).map(identity));
  const activeDimensions = [
    ['concept', filters.concepts], ['region', filters.regions], ['location', filters.locations],
    ['legal_entity', filters.legalEntities], ['store_type', filters.storeTypes],
  ] as const;
  const selected = history.filter(r => (filters.stores.length === 0 || selectedIdsByName.has(identity(r)))
    && activeDimensions.every(([field, values]) => values.length === 0 || values.includes(r[field]))
    && ((index(r) >= BASE_START && index(r) <= MIDDLE_END) || (index(r) >= end - 11 && index(r) <= end)));
  const selectedIds = new Set(selected.map(identity));
  model.stores = [...histories].filter(([id]) => selectedIds.has(id)).map(([id, rows]) => {
    const latest = rows.reduce((a, b) => index(a) > index(b) ? a : b);
    return { id, name: latest.store, concept: latest.concept };
  })
    .sort((a, b) => a.concept.localeCompare(b.concept) || a.name.localeCompare(b.name));
  if (!selected.length) return { ...model, blocked: 'No records match these filters in FY 2024, FY 2025 or the selected LTM window.' };
  const reportingGaps = [...histories].filter(([id, rows]) => {
    if (!selectedIds.has(id)) return false;
    const tradingMonths = rows.filter(r => r.sales > 0).map(index);
    if (!tradingMonths.length) return false;
    const reportedMonths = new Set(rows.map(index));
    return sequence(Math.max(BASE_START, Math.min(...tradingMonths)), end).some(m => !reportedMonths.has(m));
  });
  if (reportingGaps.length) {
    model.provisional = true;
    model.notices.push(`Reporting gaps affect ${reportingGaps.length} selected store(s) after first observed trading. Totals include only reported records and may be incomplete; missing months are not confirmed closures.`);
  }
  const stageClassifications = new Map<PerimeterStageKey, Map<string, PerimeterStore>>();
  for (const stage of model.stages) {
    const relevant = new Set(selected.filter(r => (index(r) >= stage.baselineYear * 12 && index(r) <= stage.baselineYear * 12 + 11)
      || (index(r) >= stage.end - 11 && index(r) <= stage.end)).map(identity));
    const classified = [...histories].filter(([id]) => relevant.has(id)).map(([id, rows]) => {
      const store = classify(id, knownHistories.get(id) ?? rows, stage, suspect);
      if (ambiguous.has(id)) {
        store.cohort = 'other';
        store.reason = 'Multiple codes for the same store name; identity needs review.';
      }
      return store;
    });
    stage.stores = classified.sort((a, b) => a.concept.localeCompare(b.concept) || a.name.localeCompare(b.name));
    stageClassifications.set(stage.key, new Map(classified.map(store => [store.id, store])));
  }
  const concepts = new Map<string, StoreMonthRecord[]>();
  for (const r of selected) {
    const rows = concepts.get(r.concept) ?? [];
    rows.push(r);
    concepts.set(r.concept, rows);
  }
  const sources = [...concepts].sort(([a], [b]) => a.localeCompare(b))
    .map(([label, records]) => ({ id: `concept:${label}`, label, records }));
  sources.push({ id: 'portfolio', label: 'Portfolio Total', records: selected });
  model.groups = sources.map(({ id, label, records }) => ({
    id, label,
    baseline: available.baseline ? aggregate(records.filter(r => index(r) >= BASE_START && index(r) <= BASE_END)) : null,
    fy25: available.fy25 ? aggregate(records.filter(r => index(r) >= MIDDLE_START && index(r) <= MIDDLE_END)) : null,
    current: available.current ? aggregate(records.filter(r => index(r) >= end - 11 && index(r) <= end)) : null,
    stages: Object.fromEntries(model.stages.map(stage => [stage.key, Object.fromEntries(COHORTS.map(({ key }) => [key,
      periodPair(records.filter(r => stageClassifications.get(stage.key)?.get(identity(r))?.cohort === key), stage, {
        baseline: stage.key === 'fy25' ? available.baseline : available.fy25,
        current: stage.key === 'fy25' ? available.fy25 : available.current,
      }),
    ]))])) as PerimeterGroup['stages'],
  }));
  model.reconciliationIssues = selected.flatMap(pnlReconciliationIssues);
  return model;
}

function rowValue(row: PnlRowDefinition, metrics: AggregatedMetrics | null): number | null {
  if (!metrics) return null;
  if (row.id === 'avgTicket' && (!Number.isFinite(metrics.totalTickets) || metrics.totalTickets === 0 || !Number.isFinite(metrics.totalSales))) return null;
  const value = row.value(metrics);
  return value != null && Number.isFinite(value) ? value : null;
}

export function perimeterValue(row: PnlRowDefinition, group: PerimeterGroup, column: PerimeterColumn): number | null {
  if (column === 'baseline' || column === 'fy25' || column === 'current') return rowValue(row, group[column]);
  if (column !== 'change' && (row.format === 'percent' || row.id === 'avgTicket')) return null;
  const [stageKey, cohort] = column.split(':') as [PerimeterStageKey, Cohort];
  const pair = column === 'change' ? group : group.stages[stageKey][cohort];
  const before = rowValue(row, pair.baseline);
  const after = rowValue(row, pair.current);
  return before === null || after === null ? null : after - before;
}

export interface PerimeterStep {
  id: string;
  concept: string;
  label: string;
  value: number;
  start: number;
  end: number;
  range: [number, number];
  total: boolean;
  stageLabel: string;
  cohort?: Cohort;
  changePct: number | null;
}

export function buildPerimeterWaterfall(model: PerimeterModel, row: PnlRowDefinition): PerimeterStep[] {
  const portfolio = model.groups.find(group => group.id === 'portfolio');
  if (!portfolio) return [];
  const start = perimeterValue(row, portfolio, 'baseline');
  const end = perimeterValue(row, portfolio, 'current');
  const middle = perimeterValue(row, portfolio, 'fy25');
  if (start === null || middle === null || end === null) return [];
  const steps: PerimeterStep[] = [];
  const add = (id: string, concept: string, label: string, value: number, from: number, to: number, total: boolean, stageLabel = '', cohort?: Cohort, changePct: number | null = null) => {
    steps.push({ id, concept, label, value, start: from, end: to, range: [Math.min(from, to), Math.max(from, to)], total, stageLabel, cohort, changePct });
  };
  add('baseline', '', 'FY 2024', start, 0, start, true);
  let running = start;
  for (const stage of model.stages) {
    for (const group of model.groups.filter(g => g.id !== 'portfolio')) {
      for (const cohort of COHORTS) {
        const change = perimeterValue(row, group, `${stage.key}:${cohort.key}`);
        if (change === null) return [];
        const pair = group.stages[stage.key][cohort.key];
        const changePct = comparisonChange(rowValue(row, pair.current), rowValue(row, pair.baseline));
        add(`${stage.key}:${group.id}:${cohort.key}`, group.label, cohort.label, change, running, running + change, false, stage.label, cohort.key, changePct);
        running += change;
      }
    }
    if (stage.key === 'fy25') {
      add('fy25', '', 'FY 2025', middle, 0, middle, true);
      running = middle;
    }
  }
  add('current', '', model.endpoint, end, 0, end, true);
  return steps;
}

export function perimeterAxisDomain(steps: PerimeterStep[], includeZero = false): [number, number] {
  if (!steps.length) return [0, 1];
  // Totals originate at zero, but zoom fits their balances and every movement endpoint.
  const values = steps.flatMap(step => step.total ? [step.value] : [step.start, step.end]);
  if (includeZero) values.push(0);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const padding = Math.max(high - low, Math.abs(high) * 0.01, Math.abs(low) * 0.01, 1) * 0.12;
  return [includeZero && low === 0 ? 0 : low - padding, includeZero && high === 0 ? 0 : high + padding];
}

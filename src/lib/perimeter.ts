import { aggregate, comparisonChange, pnlReconciliationIssues } from './calculations';
import { MONTH_SHORT_NAMES } from './constants';
import { expectsPerimeterReport, indexPerimeterRegistry, normalizePerimeterCode, PERIMETER_REGISTRY, PERIMETER_REGISTRY_SOURCE, registryMonth } from './perimeter-registry';
import type { PerimeterRegistryEntry } from './perimeter-registry';
import type { PnlRowDefinition } from './pnl-rows';
import type { AggregatedMetrics, FilterState, StoreMonthRecord } from './types';

export const COHORTS = [
  { key: 'l4l', label: 'L4L', shortLabel: 'L4L', column: 'L4L Change' },
  { key: 'new', label: 'Openings / Annualisation', shortLabel: 'Opening', column: 'Opening Impact' },
  { key: 'closed', label: 'Closed Stores', shortLabel: 'Closed', column: 'Closed Impact' },
  { key: 'renovation', label: 'Renovation', shortLabel: 'Renov.', column: 'Renovation Impact' },
  { key: 'other', label: 'Other / Review', shortLabel: 'Other', column: 'Other Impact' },
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
  warnings: string[];
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
const amountFields = ['tickets', 'sales', 'vat', 'turnover', 'raw_materials', 'staff', 'rents', 'utilities', 'maintenance', 'banking_costs', 'others', 'store_contribution', 'admin_costs', 'ebitda', 'capex', 'cit', 'fcff'] as const;

function identityResolver(records: StoreMonthRecord[]) {
  const codes = new Map<string, Set<string>>();
  for (const r of records) {
    if (r.code?.trim()) codes.set(r.store, (codes.get(r.store) ?? new Set()).add(normalizePerimeterCode(r.code)));
  }
  return (r: StoreMonthRecord) => {
    const known = codes.get(r.store);
    const code = r.code?.trim() ? normalizePerimeterCode(r.code) : (known?.size === 1 ? [...known][0] : '');
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

function classify(id: string, allHistory: StoreMonthRecord[], stage: PerimeterStage, entry: PerimeterRegistryEntry | null | undefined): PerimeterStore {
  const { end, baselineYear } = stage;
  const start = baselineYear * 12;
  const history = allHistory.filter(r => index(r) <= end);
  const latest = history.reduce((a, b) => index(a) > index(b) ? a : b);
  const warnings: string[] = [];
  const source = entry ? `Workbook ${stage.key === 'fy25' ? 'I' : 'J'}${entry.sourceRow}. ` : '';
  const result = (cohort: Cohort, reason: string): PerimeterStore => ({ id, name: latest.store, concept: latest.concept, cohort, reason: source + reason, warnings });
  const scopedHistory = history.filter(r => index(r) >= start);
  const months = new Map(scopedHistory.map(r => [index(r), r]));
  if (months.size !== scopedHistory.length) return result('other', 'Duplicate store/month records or an ambiguous store code.');
  if (id.startsWith('store:')) return result('other', 'No reliable store code; name matching only.');
  if (!entry) return result('other', 'No unique matching classification in the store register. Review required; no lifecycle event inferred.');
  if (stage.key === 'ltm' && Math.floor(end / 12) !== PERIMETER_REGISTRY_SOURCE.reviewedThroughYear) {
    return result('other', 'The register covers 2026 endpoints only. Review classifications for this endpoint year.');
  }
  const dimensions = ['concept', 'region', 'location', 'legal_entity', 'store_type'] as const;
  const changedDimensions = dimensions.some(key => new Set(scopedHistory.map(r => r[key])).size > 1);
  const invalidSales = scopedHistory.some(r => !Number.isFinite(r.sales) || r.sales < 0);
  if (changedDimensions) warnings.push('Business classification changed during this comparison; uploaded dimensions and source amounts retained.');
  if (invalidSales) warnings.push('Missing or negative sales require data review; lifecycle classification retained from the register.');
  const missingReports = sequence(start, end).filter(m => expectsPerimeterReport(entry, m) && !months.has(m));
  if (missingReports.length) warnings.push(`Missing expected reports: ${missingReports.map(monthLabel).join(', ')}. Totals may be incomplete.`);
  const opened = registryMonth(entry.opened);
  const closed = registryMonth(entry.closed);
  const renovationStart = registryMonth(entry.renovation?.from);
  const renovationEnd = registryMonth(entry.renovation?.through);
  const registered = entry[stage.key];
  const entryLabel = entry.entryKind === 'acquisition' ? 'Acquisition' : 'Opening';
  if (opened !== null && entry.entryKind !== 'acquisition' && scopedHistory.some(r => index(r) < opened && r.sales > 0)) {
    warnings.push(`Sales reported before the registered opening ${entry.opened}; source figures retained.`);
  }
  if (closed !== null && scopedHistory.some(r => index(r) > closed && r.sales > 0)) {
    warnings.push(`Sales reported after the registered closure ${entry.closed}; source figures retained.`);
  }
  if (opened !== null && opened > end) {
    return result('new', `${entryLabel} ${entry.opened} is after this endpoint. Only actual pre-opening records are included; not an operating L4L store.`);
  }
  // A partial baseline stays Opening, even when the later LTM already has 12 months.
  if (opened !== null && opened > Math.min(start, end - 11)) {
    return result('new', `${entryLabel} ${entry.opened}; at least one comparison period is not a full year in the perimeter. Opening and annualisation changes stay outside L4L, including any exit costs.`);
  }
  if (closed !== null && closed <= end) {
    return result('closed', `Confirmed closure ${entry.closed}. Actual trading and residual costs retained; missing post-closure rows do not imply continued trading.`);
  }
  if (renovationStart !== null && renovationEnd !== null && renovationStart <= end && renovationEnd >= start) {
    return result('renovation', `Confirmed renovation ${entry.renovation!.from} to ${entry.renovation!.through} affects the comparison. Recorded revenue and costs retained.`);
  }
  // Future closure/renovation labels must not affect an earlier comparison endpoint.
  const futureEvent = (registered === 'closed' && closed !== null && closed > end)
    || (registered === 'renovation' && renovationStart !== null && renovationStart > end);
  if (registered === 'new') return result('new', 'Registered opening / annualisation for this bridge. Actual period difference remains outside L4L.');
  if (registered === 'renovation' && !futureEvent) return result('renovation', 'Registered renovation for this bridge; recorded revenue and costs retained.');
  if (registered === 'closed' && !futureEvent) return result('other', 'Closure classification has no usable event month. Review the endpoint before assigning the impact.');
  if (registered !== 'l4l' && !(futureEvent && entry.fy25 === 'l4l')) return result('other', 'No approved L4L classification before this event or for this bridge. Source figures retained for review.');
  if (changedDimensions || invalidSales) return result('other', 'Registered L4L, but business classification or sales data require review before treating the periods as comparable.');
  if (!sequence(start, end).every(m => months.has(m))) return result('other', 'Registered L4L, but monthly reports are missing in the comparable history. Excluded from L4L pending data review.');
  return result('l4l', `${futureEvent ? 'Registered L4L in the preceding bridge; the confirmed later event is after this endpoint.' : 'Registered L4L.'} Complete monthly reporting and no opening, closure or renovation affecting either full-year period.`);
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
  registry: readonly PerimeterRegistryEntry[] = PERIMETER_REGISTRY,
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
  const register = indexPerimeterRegistry(registry);
  const registration = (id: string) => register.get(id.replace(/^code:/, ''));
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
  if (lowCoverage.length) model.notices.push(`Potentially incomplete reporting: ${lowCoverage.map(monthLabel).join(', ')}. Store count fell more than 20% below the preceding three-month median. Figures are provisional; lifecycle classifications come from the store register, not reporting gaps.`);
  model.provisional = suspect.size > 0 || end === now.getFullYear() * 12 + now.getMonth();
  if (end === now.getFullYear() * 12 + now.getMonth()) model.notices.push('The endpoint month is still in progress. Reported figures are provisional.');

  const histories = new Map<string, StoreMonthRecord[]>();
  for (const r of history) {
    const id = identity(r);
    const rows = histories.get(id) ?? [];
    rows.push(r);
    histories.set(id, rows);
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
  // Missing stores have no uploaded dimensions to filter by. Report them only for
  // portfolio scope (or an explicit store selection), without inventing amounts.
  if (activeDimensions.every(([, values]) => values.length === 0)) {
    const unreported = registry.filter(entry => {
      if (filters.stores.length && !filters.stores.includes(entry.store)) return false;
      const inWindows = (m: number) => (m >= BASE_START && m <= MIDDLE_END) || (m >= end - 11 && m <= end);
      const expected = sequence(BASE_START, end).some(m => inWindows(m) && expectsPerimeterReport(entry, m));
      const reported = histories.get(`code:${normalizePerimeterCode(entry.code)}`)?.some(r => inWindows(index(r)));
      return expected && !reported;
    });
    if (unreported.length) {
      model.provisional = true;
      model.notices.push(`${unreported.length} registered store(s) expected by this endpoint have no financial records: ${unreported.map(entry => entry.store).join('; ')}. No amounts have been invented for these stores.`);
    }
  }
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
    const entry = registration(id);
    const first = registryMonth(entry?.opened) ?? BASE_START;
    const reportedMonths = new Set(rows.map(index));
    return sequence(Math.max(BASE_START, first), end).some(m => expectsPerimeterReport(entry, m) && !reportedMonths.has(m));
  });
  if (reportingGaps.length) {
    model.provisional = true;
    model.notices.push(`Reporting gaps affect ${reportingGaps.length} selected store(s) outside registered non-operating periods. Totals include only reported records and may be incomplete; missing months are not treated as closures.`);
  }
  const stageClassifications = new Map<PerimeterStageKey, Map<string, PerimeterStore>>();
  for (const stage of model.stages) {
    const relevant = new Set(selected.filter(r => (index(r) >= stage.baselineYear * 12 && index(r) <= stage.baselineYear * 12 + 11)
      || (index(r) >= stage.end - 11 && index(r) <= stage.end)).map(identity));
    const classified = [...histories].filter(([id, rows]) => {
      if (!relevant.has(id)) return false;
      const opened = registryMonth(registration(id)?.opened);
      // Zero placeholders for future stores must not inflate operating-store counts.
      return opened === null || opened <= stage.end || rows.some(r => index(r) >= stage.baselineYear * 12 && index(r) <= stage.end
        && amountFields.some(field => r[field] !== 0));
    }).map(([id, rows]) => {
      const store = classify(id, rows, stage, registration(id));
      if (ambiguous.has(id)) {
        store.cohort = 'other';
        store.reason = 'Multiple codes for the same store name; identity needs review.';
      }
      return store;
    });
    stage.stores = classified.sort((a, b) => a.concept.localeCompare(b.concept) || a.name.localeCompare(b.name));
    const review = classified.filter(store => store.cohort === 'other');
    if (review.length) {
      model.provisional = true;
      model.notices.push(`${stage.label}: ${review.length} store(s) in Other / Review. See Store classification for the source and reason.`);
    }
    for (const store of classified) for (const warning of store.warnings) {
      model.provisional = true;
      model.notices.push(`${stage.label} / ${store.name}: ${warning}`);
    }
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

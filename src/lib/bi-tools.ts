import type { FunctionTool } from 'openai/resources/responses/responses';
import { aggregate, comparisonChange, getYearlyComparison, hasCompleteLtmWindow } from './calculations';
import { BI_METRICS, metricDefinition, metricEvidence, metricValue } from './bi-metrics';
import { biFilters, dimensionKeys, monthIndex, monthName, periodSnapshot, reportingQuality, selectedRecords } from './bi-periods';
import { buildPnlComparison } from './pnl';
import { PNL_ROWS } from './pnl-rows';
import { buildPerimeterComparison, buildPerimeterWaterfall, COHORTS, identityResolver, perimeterValue, selectPerimeterRecords } from './perimeter';
import { PERIMETER_REGISTRY, PERIMETER_REGISTRY_SOURCE, normalizePerimeterCode } from './perimeter-registry';
import { buildProfitBridge } from './profit-bridge';
import { objectValue, type BiArgs, type BiDimension, type ReportContext } from './bi-contract';
import type { AggregatedMetrics, FilterState, StoreMonthRecord, UploadRecord } from './types';

const choice = (values: readonly string[], description = '') => ({ type: ['string', 'null'], enum: [...values, null], description });
const integer = (minimum: number, maximum: number, description = '') => ({ type: ['integer', 'null'], minimum, maximum, description });
const selection = { type: ['array', 'null'], items: { type: 'string', maxLength: 250 }, maxItems: 200 };
const fields = {
  metrics: { type: ['array', 'null'], items: { type: 'string', enum: BI_METRICS.map(m => m.id) }, maxItems: 45, description: 'Canonical metric IDs. Null returns the default metrics for this tool.' },
  year: integer(2000, 2100, 'Null inherits header year. For get_time_series with fullHistory true, ignored.'),
  month: integer(1, 12, 'Null inherits header month.'), periodBasis: choice(['monthly', 'ytd', 'ltm'], 'Null inherits header basis, except time series use the local chart basis.'),
  stores: selection, concepts: selection, regions: selection, locations: selection, legalEntities: selection, storeTypes: selection,
  groupBy: choice(['portfolio', 'store', 'concept', 'region', 'location', 'legal_entity', 'store_type']),
  compareYear: integer(2000, 2100, 'Year of comparison endpoint. Null means no extra comparison.'),
  compareMonth: integer(1, 12, 'Null uses current endpoint month.'), compareBasis: choice(['monthly', 'ytd', 'ltm']),
  stage: choice(['previous', 'current'], 'Previous bridges Y-2 to Y-1; current bridges Y-1 to Y. Null defaults current.'),
  cohort: choice(['l4l', 'new', 'closed', 'renovation', 'other'], 'Null includes all cohorts.'),
  order: choice(['asc', 'desc'], 'Sort by first requested metric, or its absolute change if a comparison year is provided.'),
  limit: integer(1, 100, 'Default 20. Totals are never limited; result lists are paginated.'), offset: integer(0, 100000, 'Default 0.'),
  fullHistory: { type: ['boolean', 'null'], description: 'True returns all available monthly/chart endpoints, ignoring header year/month (but not business filters).' },
  bridgeMode: choice(['operating', 'full', 'cash']),
};
type Field = keyof typeof fields;
const scope: Field[] = ['year', 'month', 'periodBasis', ...dimensionKeys];
const page: Field[] = ['limit', 'offset'];
const definitions: { name: string; description: string; keys: Field[] }[] = [
  { name: 'get_metric_definitions', description: 'Explain formulas, units, signs and interpretation for every dashboard KPI/P&L metric. Others cost is not the Other Impact cohort. Definitions alone do not establish a numerical answer.', keys: ['metrics'] },
  { name: 'query_metrics', description: 'Exact dashboard figures, all P&L costs/margins, counts, rankings, segment mix and store scatter values. Group by any dimension. Optional comparison calculates changes on the server. Rankings page margin rankings exclude stores with Turnover <=1000, matching the page. For historical P&L YoY use get_pnl_report; for L4L use get_perimeter_report.', keys: [...scope, 'metrics', 'groupBy', 'compareYear', 'compareMonth', 'compareBasis', 'order', ...page] },
  { name: 'get_time_series', description: 'Exact trend points and yearly comparison table. Local chart basis takes precedence over the header for charts; fullHistory true matches all-history charts. The yearly comparison table still uses the global header basis. Missing LTM windows are excluded, not treated as zeros.', keys: [...scope, 'metrics', 'fullHistory', ...page] },
  { name: 'get_pnl_report', description: 'Exact historical P&L table for Y-2, Y-1 and Y, all using the selected Monthly/YTD/LTM basis and month. Returns server-calculated amount growth and margin changes in percentage points. groupBy portfolio/concept/store.', keys: [...scope, 'metrics', 'groupBy', ...page] },
  { name: 'get_perimeter_report', description: 'Explain L4L/perimeter table columns and both bridges: Y-2 to Y-1 and Y-1 to Y, using the selected Monthly/YTD/LTM windows. Returns exact totals, cohort changes, waterfall running totals/percentages, store contributors with before/after amounts, classification reasons, register row references and missing data. REQUIRED for Other Impact, opening, closure, renovation and L4L questions.', keys: [...scope, 'metrics', 'stage', 'cohort', ...page] },
  { name: 'get_store_evidence', description: 'Read original monthly financial records, record/upload IDs, metadata and approved store-register entries. Narrow by store first. Includes missing-report/reconciliation warnings. No database changes.', keys: [...scope, 'fullHistory', ...page] },
  { name: 'get_profit_bridge', description: 'Exact Sales/VAT/Turnover/Store EBITDAR/leases/Store EBITDA/HQ/EBITDA/FCFF waterfall, including subtotal reconciliation differences. Not the L4L waterfall.', keys: [...scope, 'bridgeMode'] },
  { name: 'get_store_benchmarks', description: 'Store Detail benchmark figures and diagnostic flags versus selected portfolio, concept, region and format. Supply exactly one store, or use the current Store Detail page. Store Detail own-store values ignore header dimensions, like that page; peers retain header dimensions.', keys: [...scope, 'metrics'] },
  { name: 'get_data_quality', description: 'Check missing monthly reports, duplicates, zero tickets, future-dated records and P&L reconciliation. A missing row is not a verified zero or proof of closure. Includes scoped register coverage. Use before asserting missing data or reliable growth.', keys: [...scope] },
  { name: 'get_upload_history', description: 'Latest 20 upload records shown in Data Upload: filename, date, status and row counts. Upload history is global, not filtered by store or period. Cannot access unsaved local file previews.', keys: [] },
];

export const BI_TOOLS: FunctionTool[] = definitions.map(d => ({ type: 'function', name: d.name, description: d.description,
  strict: true, parameters: { type: 'object', properties: Object.fromEntries(d.keys.map(k => [k, fields[k]])), required: d.keys, additionalProperties: false },
}));

export function validateBiArgs(name: string, value: unknown): BiArgs {
  const definition = definitions.find(d => d.name === name);
  if (!definition) throw new Error('Unknown read-only analysis tool.');
  const args = objectValue(value);
  for (const [key, v] of Object.entries(args)) {
    if (!definition.keys.includes(key as Field)) throw new Error(`Unexpected argument ${key}.`);
    if (v == null) continue;
    const schema = fields[key as Field] as { type: string[]; enum?: unknown[]; minimum?: number; maximum?: number; maxItems?: number; items?: { enum?: string[]; maxLength?: number } };
    if (schema.enum && !schema.enum.includes(v)) throw new Error(`Invalid ${key}.`);
    if (schema.type.includes('integer') && (!Number.isInteger(v) || Number(v) < schema.minimum! || Number(v) > schema.maximum!)) throw new Error(`Invalid ${key}.`);
    if (schema.type.includes('boolean') && typeof v !== 'boolean') throw new Error(`Invalid ${key}.`);
    if (schema.type.includes('array') && (!Array.isArray(v) || v.length > schema.maxItems! || v.some(s => typeof s !== 'string' || s.length > (schema.items?.maxLength ?? 100) || (schema.items?.enum && !schema.items.enum.includes(s))))) throw new Error(`Invalid ${key}.`);
  }
  return args as BiArgs;
}

function paginate<T>(values: T[], args: BiArgs) {
  const offset = args.offset ?? 0, limit = args.limit ?? 20;
  return { items: values.slice(offset, offset + limit), total: values.length, offset, nextOffset: offset + limit < values.length ? offset + limit : null };
}

function grouped(records: StoreMonthRecord[], by: BiDimension) {
  if (by === 'portfolio') return new Map([['Portfolio Total', records]]);
  const groups = new Map<string, StoreMonthRecord[]>();
  for (const r of records) {
    const key = r[by];
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return groups;
}

function comparison(id: string, current: AggregatedMetrics | null, prior: AggregatedMetrics | null) {
  const row = BI_METRICS.find(r => r.id === id)!;
  const getter = row.growthValue ?? row.value;
  const before = prior ? getter(prior) : null, after = current ? getter(current) : null;
  const growth = comparisonChange(after, before, row.format === 'percent');
  const previous = metricValue(id, prior), value = metricValue(id, current);
  return { previous, current: value, absoluteChange: value != null && previous != null ? value - previous : null,
    growthPercent: row.format === 'percent' || growth == null ? null : growth * 100,
    percentagePointChange: row.format === 'percent' && growth != null ? growth * 100 : null,
    growthBasis: row.format === 'percent' ? 'current ratio - previous ratio, multiplied by 100' : '(current - prior) / abs(prior), using cost magnitude for deductions',
  };
}

export function createBiSession(records: StoreMonthRecord[], header: FilterState, report: ReportContext, uploads: UploadRecord[] | null = null) {
  const retrievedAt = new Date().toISOString();
  const metricIds = (args: BiArgs, fallback = ['grossSales', 'turnover', 'storeEbitdar', 'storeEbitda', 'ebitda', 'fcff']) => args.metrics?.length ? args.metrics : fallback;
  const evidence = (metrics: AggregatedMetrics | null, ids: string[]) => ids.map(id => metricEvidence(id, metrics));
  const base = selectedRecords(records, header, report);
  const context = {
    retrievedAt, source: 'fact_store_month', totalDatasetRows: records.length, filters: header, report,
    availableMonths: [...new Set(base.map(r => monthName(monthIndex(r))))].sort(),
    metricIds: BI_METRICS.map(m => ({ id: m.id, label: m.label })),
    rules: [
      'The page context is a description, not evidence of a figure. Always query a tool before quoting numbers.',
      'Year or Month All shows all history on most pages; historical P&L/perimeter require both endpoints.',
      'Trend charts use their local basis and full history; yearly comparison uses the global header basis.',
      'Reported amounts can contain future-dated data and incomplete reporting. Never call them actuals or verified growth without qualification.',
      'Store Detail own-store figures ignore dimension filters; its benchmark portfolio respects them.',
    ],
  };

  async function execute(name: string, raw: unknown) {
    const args = validateBiArgs(name, raw);
    const pageStore = report.path.startsWith('/store/') ? decodeURIComponent(report.path.slice(7)) : null;
    const ownStore = pageStore && ['query_metrics', 'get_time_series', 'get_store_evidence', 'get_profit_bridge', 'get_data_quality'].includes(name)
      && (!args.stores?.length || (args.stores.length === 1 && args.stores[0] === pageStore));
    const scopeHeader = ownStore ? { ...header, ...Object.fromEntries(dimensionKeys.map(k => [k, []])), stores: [pageStore] } : header;
    const scopeArgs = pageStore && name === 'get_store_benchmarks' ? { ...args, stores: null } : args;
    const filters = biFilters(scopeHeader, scopeArgs);
    const scoped = name === 'get_perimeter_report' ? selectPerimeterRecords(records, filters) : selectedRecords(records, filters, report);
    const current = periodSnapshot(scoped, filters);
    const ids = metricIds(args);
    const envelope = { source: 'fact_store_month', retrievedAt, filters, report, period: current.period,
      completeLtm: current.completeLtm, quality: reportingQuality(scoped, filters),
      ownStoreScope: ownStore ? 'Store Detail own-store figures ignore header business dimensions; the selected period still applies.' : null };
    if (name === 'get_metric_definitions') return { definitions: (args.metrics?.length ? args.metrics : BI_METRICS.map(m => m.id)).map(metricDefinition) };
    if (name === 'get_upload_history') {
      if (uploads === null) throw new Error('Upload history is temporarily unavailable. Do not interpret this as no uploads.');
      return { source: 'uploads', scope: 'Global latest 20 uploads; header filters do not apply', retrievedAt, items: uploads };
    }
    if (name === 'get_data_quality') {
      const model = filters.year && filters.month ? buildPerimeterComparison(records, filters, filters.periodBasis, filters.year, filters.month) : null;
      return { ...envelope, registerNotices: model?.notices ?? [], registerSource: PERIMETER_REGISTRY_SOURCE };
    }
    if (name === 'query_metrics') {
      if (args.compareYear && !(args.compareMonth ?? filters.month)) throw new Error('Select a comparison month; Month All is not a yearly comparison. For FY use YTD with month 12.');
      const priorFilters = args.compareYear ? { ...filters, year: args.compareYear, month: args.compareMonth ?? filters.month, periodBasis: args.compareBasis ?? filters.periodBasis } : null;
      const prior = priorFilters ? periodSnapshot(scoped, priorFilters) : null;
      const by = args.groupBy ?? 'portfolio';
      const all = grouped([...new Set([...current.rows, ...(prior?.rows ?? [])])], by);
      let rows = [...all].map(([label, data]) => {
        const now = periodSnapshot(data, filters), before = priorFilters ? periodSnapshot(data, priorFilters) : null;
        return { label, recordCount: now.rows.length, metrics: evidence(now.metrics, ids), comparisons: before ? ids.map(id => ({ metric: id, ...comparison(id, now.metrics, before.metrics) })) : [],
          completeLtm: now.completeLtm, previousCompleteLtm: before?.completeLtm ?? null,
          _turnover: now.metrics?.totalTurnover ?? 0 };
      });
      const rankingThreshold = report.path === '/rankings' && by === 'store' && ['storeEbitdarPct', 'storeEbitdaPct', 'ebitdaPct'].includes(ids[0]);
      if (rankingThreshold) rows = rows.filter(r => r._turnover > 1000 && r.metrics[0].value != null);
      rows.sort((a, b) => {
        const x = prior ? a.comparisons[0].absoluteChange : a.metrics[0].value;
        const y = prior ? b.comparisons[0].absoluteChange : b.metrics[0].value;
        if (x == null) return y == null ? a.label.localeCompare(b.label) : 1;
        if (y == null) return -1;
        return (args.order === 'asc' ? x - y : y - x) || a.label.localeCompare(b.label);
      });
      return { ...envelope, groupBy: by, rankingRule: rankingThreshold ? 'Turnover > EUR 1,000 and defined margin, matching Rankings page' : null,
        totals: evidence(current.metrics, ids), previousPeriod: prior?.period ?? null,
        previousQuality: priorFilters ? reportingQuality(scoped, priorFilters) : null,
        totalComparisons: prior ? ids.map(id => ({ metric: id, ...comparison(id, current.metrics, prior.metrics) })) : [],
        rows: paginate(rows.map(r => ({ label: r.label, recordCount: r.recordCount, metrics: r.metrics, comparisons: r.comparisons, completeLtm: r.completeLtm, previousCompleteLtm: r.previousCompleteLtm })), args),
        warning: !current.completeLtm || (prior && !prior.completeLtm) ? 'Some dashboard KPI pages display partial LTM totals. Values above reproduce those displayed figures, but are not complete LTM; do not describe them as comparable annual performance.' : null };
    }
    if (name === 'get_time_series') {
      const basis = args.periodBasis ?? report.trendBasis ?? 'monthly';
      const endpoints = [...new Set(scoped.map(monthIndex))].sort((a, b) => a - b).filter(i => args.fullHistory || ((!filters.year || Math.floor(i / 12) === filters.year) && (!filters.month || i % 12 + 1 <= filters.month)));
      const points = endpoints.flatMap(i => {
        const f = { ...filters, year: Math.floor(i / 12), month: i % 12 + 1, periodBasis: basis };
        if (basis === 'ltm' && !hasCompleteLtmWindow(scoped, f.year, f.month)) return [];
        const snap = periodSnapshot(scoped, f);
        return [{ period: snap.period, metrics: evidence(snap.metrics, ids), records: snap.rows.length }];
      });
      const years = [...new Set(records.map(r => r.year))];
      const yearly = filters.year && filters.month ? getYearlyComparison(scoped, filters.periodBasis, filters.month, years) : [];
      const latest = yearly[0], prior = yearly.find(y => y.year === latest?.year - 1);
      return { ...envelope, chartBasis: basis, points: paginate(points, args), yearlyTable: yearly.map(y => ({ year: y.year, metrics: evidence(y.metrics, ids) })),
        yearlyTableYoy: latest && prior ? { currentYear: latest.year, priorYear: prior.year, comparisons: ids.map(id => ({ id, ...comparison(id, latest.metrics, prior.metrics) })) } : null,
        warning: 'Charts include all uploaded dates when fullHistory is true, including any future-dated or placeholder rows. Yearly table follows header basis, not local chart basis.' };
    }
    if (name === 'get_pnl_report') {
      if (args.groupBy && !['portfolio', 'concept', 'store'].includes(args.groupBy)) throw new Error('P&L groups are portfolio, concept or store. Use query_metrics for other dimensions.');
      if (!filters.year || !filters.month) return { unavailable: true, reason: 'Select Year and Month for the historical P&L.' };
      const model = buildPnlComparison(scoped, filters.periodBasis, filters.year, filters.month);
      const kind = args.groupBy === 'store' ? 'store' : args.groupBy === 'concept' ? 'concept-total' : 'portfolio-total';
      const groups = model.groups.filter(g => g.kind === kind).map(g => ({ id: g.id, label: g.label,
        metrics: ids.map(id => ({ metric: metricDefinition(id), values: Object.fromEntries(Object.entries(g.values).map(([k, v]) => [k, metricValue(id, v)])),
          fyYoy: comparison(id, g.values.fyRecent, g.values.fyOlder), currentYoy: comparison(id, g.values.current, g.values.currentPrior) })),
      }));
      return { ...envelope, columns: model.columns, groups: paginate(groups, args), notice: model.notice,
        reconciliationCount: model.reconciliationIssues.length, reconciliation: model.reconciliationIssues.slice(0, 15),
        methodology: 'All three value columns use the same selected month and Monthly/YTD/LTM basis for Y-2, Y-1 and Y. Internal keys fyOlder/fyRecent are legacy names, not full-year periods. Follow returned column labels. Cost growth uses magnitude; positive cost growth is unfavorable. Ratios change in percentage points.' };
    }
    if (name === 'get_perimeter_report') {
      if (!filters.year || !filters.month) return { unavailable: true, reason: 'Select Year and Month for the perimeter bridge.' };
      const model = buildPerimeterComparison(records, filters, filters.periodBasis, filters.year, filters.month);
      if (model.blocked) return { unavailable: true, reason: model.blocked };
      const stage = model.stages.find(s => s.key === (args.stage ?? 'current'))!;
      const selectedIds = metricIds(args, ['grossSales', 'storeEbitdar']);
      if (selectedIds.some(id => !PNL_ROWS.some(r => r.id === id))) throw new Error('Perimeter report supports P&L rows only. Use query_metrics for other metrics.');
      const portfolioGroup = model.groups.find(g => g.id === 'portfolio')!;
      const stageAvailable = portfolioGroup.stages[stage.key].other.baseline !== null && portfolioGroup.stages[stage.key].other.current !== null;
      const identity = identityResolver(records);
      const inWindow = (r: StoreMonthRecord, p: { start: number; end: number }) => monthIndex(r) >= p.start && monthIndex(r) <= p.end;
      const contributors = stage.stores.filter(s => !args.cohort || s.cohort === args.cohort).map(s => {
        const data = scoped.filter(r => identity(r) === s.id);
        const before = data.filter(r => inWindow(r, stage.baseline)), after = data.filter(r => inWindow(r, stage.current));
        const a = aggregate(before), b = aggregate(after);
        const entry = PERIMETER_REGISTRY.find(r => `code:${normalizePerimeterCode(r.code)}` === s.id);
        return { ...s, register: entry ?? null, baselineRecords: before.length, currentRecords: after.length,
          metrics: selectedIds.map(id => {
            const row = BI_METRICS.find(r => r.id === id)!;
            const available = stageAvailable && row.format !== 'percent' && id !== 'avgTicket';
            return { id, reportedBaseline: before.length ? metricValue(id, a) : null, reportedCurrent: after.length ? metricValue(id, b) : null,
              bridgeBaseline: metricValue(id, a), bridgeCurrent: metricValue(id, b),
              impact: available && metricValue(id, a) != null && metricValue(id, b) != null ? metricValue(id, b)! - metricValue(id, a)! : null };
          }) };
      });
      const groups = model.groups.map(g => ({ label: g.label, metrics: selectedIds.map(id => {
        const row = BI_METRICS.find(r => r.id === id)!;
        return { id, baseline: perimeterValue(row, g, 'baseline'), middle: perimeterValue(row, g, 'middle'), current: perimeterValue(row, g, 'current'),
          totalChange: perimeterValue(row, g, 'change'),
          stages: model.stages.map(s => ({ label: s.label, impacts: Object.fromEntries(COHORTS.map(c => [c.key, perimeterValue(row, g, `${s.key}:${c.key}`)])) })) };
      }) }));
      const totals = groups.find(g => g.label === 'Portfolio Total')!;
      return { ...envelope, periods: model.periods, stage: stage.label, provisional: model.provisional, registerSource: PERIMETER_REGISTRY_SOURCE,
        notices: model.notices, totals, concepts: groups.filter(g => g !== totals), contributors: paginate(contributors, args),
        waterfalls: selectedIds.filter(id => ['grossSales', 'storeEbitdar'].includes(id)).map(id => ({ metric: id, steps: paginate(buildPerimeterWaterfall(model, BI_METRICS.find(r => r.id === id)!).filter(s => s.total || (s.stageLabel === stage.label && (!args.cohort || s.cohort === args.cohort))), args) })),
        methodology: 'Impact = same cohort current amount - baseline amount, NOT growth percentage. Missing store records contribute zero to bridge arithmetic but reported values are null, never verified zero trading. Percentage and Average Ticket impacts are not additive and are unavailable. Other / Review is unverified comparability, not an operating cost. Opening annualisation remains outside L4L in both affected bridges. Tooltip percentage uses concept/cohort baseline, not whole portfolio.' };
    }
    if (name === 'get_store_evidence') {
      const data = args.fullHistory ? scoped : current.rows;
      const codes = new Set(data.map(r => normalizePerimeterCode(r.code ?? '')));
      return { ...envelope, historyScope: args.fullHistory ? 'All available history within business filters' : 'Selected period',
        registry: PERIMETER_REGISTRY.filter(r => codes.has(normalizePerimeterCode(r.code))), registerSource: PERIMETER_REGISTRY_SOURCE,
        rows: paginate([...data].sort((a, b) => a.store.localeCompare(b.store) || monthIndex(a) - monthIndex(b)), args) };
    }
    if (name === 'get_profit_bridge') return { ...envelope, steps: current.metrics ? buildProfitBridge(current.metrics, args.bridgeMode ?? (report.path === '/investment' ? 'cash' : 'full')) : [],
      warning: 'Uploaded subtotal reconciliation differences are retained, not repaired. Prime Cost is a subtotal and is never deducted again.' };
    if (name === 'get_store_benchmarks') {
      const storeNames = args.stores?.length ? args.stores : report.path.startsWith('/store/') ? [decodeURIComponent(report.path.slice(7))] : header.stores;
      if (storeNames.length !== 1) return { unavailable: true, reason: 'Specify exactly one store.' };
      const own = records.filter(r => r.store === storeNames[0]);
      const meta = own[0];
      if (!meta) return { unavailable: true, reason: 'No uploaded records for this exact store name.' };
      const peers = selectedRecords(records, { ...filters, stores: header.stores }, { path: '/overview' });
      const store = periodSnapshot(own, filters).metrics;
      const portfolio = periodSnapshot(peers, filters).metrics;
      const values = { store, portfolio, concept: periodSnapshot(peers.filter(r => r.concept === meta.concept), filters).metrics,
        region: periodSnapshot(peers.filter(r => r.region === meta.region), filters).metrics, format: periodSnapshot(peers.filter(r => r.store_type === meta.store_type), filters).metrics };
      const flags = store ? [
        [store.totalStoreEbitdar < 0, 'Loss Before Leases'], [store.totalStoreEbitdar >= 0 && store.totalStoreEbitda < 0, 'Loss After Leases'],
        [store.totalStoreEbitda >= 0 && store.totalEbitda < 0, 'Loss After Headquarters'], [(store.staffPct ?? 0) > .30, 'High Labor Burden (>30%)'],
        [(store.rawMaterialsPct ?? 0) > .35, 'High Food Cost (>35%)'], [(store.rentsPct ?? 0) > .15, 'High Rent Burden (>15%)'],
        [store.totalEbitda > 0 && store.totalFcff < 0, 'Weak Cash Conversion'], [store.totalEbitda < 0, 'EBITDA-Negative'],
        [store.avgTicket < (portfolio?.avgTicket ?? 0) * .7, 'Low Ticket Monetization (<70% of portfolio)'], [(store.adminCostsPct ?? 0) > .05, 'Overhead Drag (>5%)'],
      ].filter(([active]) => active).map(([, label]) => label) : [];
      return { ...envelope, store: meta.store, ownStoreScope: 'All records for this store with selected period, matching Store Detail; header dimensions apply to peers only.',
        values: Object.fromEntries(Object.entries(values).map(([key, agg]) => [key, evidence(agg, ids)])),
        benchmarkVariances: ids.map(id => ({ id, peers: Object.fromEntries(Object.entries(values).filter(([k]) => k !== 'store').map(([k, agg]) => [k, comparison(id, store, agg)])) })), flags,
        ownStoreQuality: reportingQuality(own, filters) };
    }
    throw new Error('Unknown analysis tool.');
  }
  return { context, execute };
}

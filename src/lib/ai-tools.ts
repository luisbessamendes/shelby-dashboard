
import { getFilteredData } from './analytics-queries';
import { aggregate, aggregatePerStore, filterByPeriod, hasCompleteLtmWindow } from './calculations';
import type { FilterState, PeriodBasis } from './types';

export type AiToolArgs = {
  year?: number;
  month?: number | null;
  periodBasis?: PeriodBasis;
  concept?: string;
  region?: string;
  metric?: 'turnover' | 'sales' | 'store_ebitdar' | 'store_ebitdar_pct' | 'store_ebitda' | 'store_ebitda_pct' | 'ebitda' | 'ebitda_pct' | 'fcff' | 'capex';
  limit?: number;
  order?: 'asc' | 'desc';
};

type StoreAggregate = ReturnType<typeof aggregatePerStore> extends Map<string, infer T> ? T : never;

/**
 * TOOL DEFINITIONS for OpenAI
 */
export const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_aggregated_metrics',
      description: 'Get turnover, gross sales, Store EBITDAR (before leases), Store EBITDA (after leases, before headquarters), EBITDA (after headquarters), ratios, and other metrics for a specific time period and filters (Concept, Region, etc.). Use this for Year-over-Year (YoY) comparisons or general portfolio performance queries.',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'number', description: 'The year to filter (e.g., 2024, 2025)' },
          month: { type: ['number', 'null'], description: 'The month to filter (1-12). If omitted, inherits the header month; null explicitly selects the full year.' },
          periodBasis: { type: 'string', enum: ['monthly', 'ytd', 'ltm'], description: 'Inherits the dashboard period basis unless explicitly specified.' },
          concept: { type: 'string', description: 'Filter by concept name (e.g., "Italian Republic")' },
          region: { type: 'string', description: 'Filter by region (e.g., "North", "South")' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_monthly_metrics_feed',
      description: 'Get a month-by-month breakdown of metrics for a specific year and filters. Use this to analyze trends or find when exactly things improved or declined within a year.',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'number', description: 'The year to analyze; otherwise inherits the dashboard year' },
          periodBasis: { type: 'string', enum: ['monthly', 'ytd', 'ltm'] },
          month: { type: ['number', 'null'], description: 'Last endpoint month to include; inherits the header month. Null requests the full year.' },
          concept: { type: 'string', description: 'Filter by concept name' },
          region: { type: 'string', description: 'Filter by region' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_store_rankings',
      description: 'Get the top or bottom performing stores based on a specific metric (turnover, sales, store_ebitdar, store_ebitda, ebitda, their margins, fcff, capex) for a given period.',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'number' },
          month: { type: ['number', 'null'] },
          periodBasis: { type: 'string', enum: ['monthly', 'ytd', 'ltm'] },
          region: { type: 'string' },
          metric: { type: 'string', enum: ['turnover', 'sales', 'store_ebitdar', 'store_ebitdar_pct', 'store_ebitda', 'store_ebitda_pct', 'ebitda', 'ebitda_pct', 'fcff', 'capex'] },
          limit: { type: 'number' },
          order: { type: 'string', enum: ['asc', 'desc'] },
          concept: { type: 'string' }
        },
        required: ['metric']
      }
    }
  }
];

/**
 * TOOL EXECUTION HANDLERS
 */
export function buildAiToolFilters(args: AiToolArgs, dashboardFilters?: FilterState): FilterState {
  // Construct a base filter state from tool arguments
  const filters: FilterState = {
    periodBasis: (args.periodBasis as PeriodBasis) || 'monthly',
    year: args.year || null,
    month: args.month || null,
    stores: [],
    concepts: args.concept ? [args.concept] : [],
    regions: args.region ? [args.region] : [],
    storeTypes: [],
    locations: [],
    legalEntities: [],
    ebitdaSign: 'all',
    fcffSign: 'all',
    quartile: 'all',
    salesRange: null,
    ebitdaPctRange: null,
    staffPctRange: null,
    rawMaterialsPctRange: null,
    ticketsRange: null,
    avgTicketRange: null
  };

  const scoped = { ...filters, ...dashboardFilters };
  if (args.year !== undefined) scoped.year = args.year;
  if (args.month !== undefined) scoped.month = args.month;
  if (args.periodBasis !== undefined) scoped.periodBasis = args.periodBasis;
  for (const [argument, field] of [['concept', 'concepts'], ['region', 'regions']] as const) {
    const value = args[argument];
    if (!value) continue;
    if (scoped[field].length && !scoped[field].includes(value)) {
      throw new Error(`Requested ${argument} is outside the selected dashboard filters. Change the header filters to expand the scope.`);
    }
    scoped[field] = [value];
  }
  return scoped;
}

export async function executeAiTool(name: string, args: AiToolArgs, dashboardFilters?: FilterState) {
  const filters = buildAiToolFilters(args, dashboardFilters);
  const { periodData, allFilteredData } = await getFilteredData(filters);

  if (name !== 'get_monthly_metrics_feed' && periodData.length === 0) {
    return { unavailable: true, reason: 'No records for the selected filters and period', filters };
  }

  if (name !== 'get_monthly_metrics_feed' && filters.periodBasis === 'ltm' && filters.year && filters.month
    && !hasCompleteLtmWindow(allFilteredData, filters.year, filters.month)) {
    return { unavailable: true, reason: 'LTM requires 12 calendar months in the filtered data', filters };
  }

  switch (name) {
    case 'get_aggregated_metrics': {
      const agg = aggregate(periodData);
      return {
        label: `${filters.concepts.join(', ') || 'Selected portfolio'} - ${filters.year ?? 'All years'}${filters.month ? '/' + filters.month : ''}`,
        filters,
        available: periodData.length > 0,
        turnover: agg.totalTurnover,
        grossSales: agg.totalSales,
        storeEbitdar: agg.totalStoreEbitdar,
        storeEbitdarPct: agg.storeEbitdarPct,
        leases: agg.totalRents,
        storeEbitda: agg.totalStoreEbitda,
        storeEbitdaPct: agg.storeEbitdaPct,
        headquartersCosts: agg.totalAdminCosts,
        ebitda: agg.totalEbitda,
        ebitdaPct: agg.ebitdaPct,
        capex: agg.totalCapex,
        fcff: agg.totalFcff,
        storeCount: agg.storeCount,
        staffPct: agg.staffPct,
        rawMaterialsPct: agg.rawMaterialsPct,
        periodBasis: filters.periodBasis
      };
    }

    case 'get_monthly_metrics_feed': {
      const year = filters.year;
      if (!year) return { unavailable: true, reason: 'Select a year for the trend feed' };
      return Array.from({ length: 12 }, (_, index) => index + 1).flatMap(month => {
        if (filters.month && month > filters.month) return [];
        if (!allFilteredData.some(record => record.year === year && record.month === month)) return [];
        if (filters.periodBasis === 'ltm' && !hasCompleteLtmWindow(allFilteredData, year, month)) return [];
        const records = filterByPeriod(allFilteredData, filters.periodBasis, year, month);
        if (!records.length) return [];
        return [{ year, month, periodBasis: filters.periodBasis, metrics: aggregate(records) }];
      });
    }

    case 'get_store_rankings': {
      const storeMap = aggregatePerStore(periodData);
      const list = Array.from(storeMap.values());
      const metricMap: Record<NonNullable<AiToolArgs['metric']>, keyof StoreAggregate> = {
        turnover: 'totalTurnover',
        sales: 'totalSales',
        store_ebitdar: 'totalStoreEbitdar',
        store_ebitdar_pct: 'storeEbitdarPct',
        store_ebitda: 'totalStoreEbitda',
        store_ebitda_pct: 'storeEbitdaPct',
        ebitda_pct: 'ebitdaPct',
        ebitda: 'totalEbitda',
        fcff: 'totalFcff',
        capex: 'totalCapex'
      };
      
      const key = metricMap[args.metric ?? 'store_ebitdar'];
      const limit = args.limit || 10;
      const sorted = list.filter(row => row[key] != null && Number.isFinite(Number(row[key]))).sort((a, b) => {
        const valA = Number(a[key] ?? 0);
        const valB = Number(b[key] ?? 0);
        return args.order === 'asc' ? valA - valB : valB - valA;
      });

      return sorted.slice(0, limit).map(s => ({
        store: s.store,
        value: s[key],
        metric: args.metric ?? 'store_ebitdar',
        storeEbitdarPct: s.storeEbitdarPct,
        storeEbitdaPct: s.storeEbitdaPct,
        ebitdaPct: s.ebitdaPct,
        concept: s.concept,
        region: s.region
      }));
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

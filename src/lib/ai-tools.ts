import { getFilteredData } from './analytics-queries';
import { aggregate, aggregatePerStore } from './calculations';
import type { FilterState, PeriodBasis, StoreMonthRecord } from './types';

export const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_aggregated_metrics',
      description: 'Get total sales, EBITDA, ratios, and other metrics for a specific time period and filters (Concept, Region, etc.). Use this for Year-over-Year (YoY) comparisons or general portfolio performance queries.',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'number', description: 'The year to filter (e.g., 2024, 2025)' },
          month: { type: 'number', description: 'The month to filter (1-12). If omitted, returns data for the entire year.' },
          periodBasis: { type: 'string', enum: ['monthly', 'ytd', 'ltm'], description: 'Default is monthly.' },
          concept: { type: 'string', description: 'Filter by concept name (e.g., "Italian Republic")' },
          region: { type: 'string', description: 'Filter by region (e.g., "North", "South")' }
        },
        required: ['year']
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
          year: { type: 'number', description: 'The year to analyze' },
          concept: { type: 'string', description: 'Filter by concept name' },
          region: { type: 'string', description: 'Filter by region' }
        },
        required: ['year']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_store_rankings',
      description: 'Get the top or bottom performing stores based on a specific metric (sales, ebitda, fcff, capex) for a given period.',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'number' },
          month: { type: 'number' },
          metric: { type: 'string', enum: ['sales', 'ebitda', 'fcff', 'capex'] },
          limit: { type: 'number' },
          order: { type: 'string', enum: ['asc', 'desc'] },
          concept: { type: 'string' }
        },
        required: ['year', 'metric']
      }
    }
  }
];

export async function executeAiTool(name: string, args: any) {
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

  const { periodData, allFilteredData } = await getFilteredData(filters);

  switch (name) {
    case 'get_aggregated_metrics': {
      const agg = aggregate(periodData);
      return {
        label: \`\${args.concept || 'Portfolio'} - \${args.year}\${args.month ? '/' + args.month : ''}\`,
        sales: agg.totalSales,
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
      const yearRecords = allFilteredData.filter((r: StoreMonthRecord) => r.year === args.year);
      const months = Array.from({ length: 12 }, (_, i) => i + 1);
      
      return months.map(m => {
        const monthRecords = yearRecords.filter((r: StoreMonthRecord) => r.month === m);
        const agg = aggregate(monthRecords);
        return {
          month: m,
          year: args.year,
          sales: agg.totalSales,
          ebitda: agg.totalEbitda,
          ebitdaPct: agg.ebitdaPct,
          capex: agg.totalCapex,
          storeCount: agg.storeCount
        };
      }).filter(m => m.storeCount > 0);
    }

    case 'get_store_rankings': {
      const storeMap = aggregatePerStore(periodData);
      const list = Array.from(storeMap.values());
      const metricMap: Record<string, string> = {
        sales: 'totalSales',
        ebitda: 'totalEbitda',
        fcff: 'totalFcff',
        capex: 'totalCapex'
      };
      
      const key = metricMap[args.metric] as keyof typeof list[0];
      const limit = args.limit || 10;
      const sorted = list.sort((a, b) => {
        const valA = (a[key] as any) || 0;
        const valB = (b[key] as any) || 0;
        return args.order === 'asc' ? valA - valB : valB - valA;
      });

      return sorted.slice(0, limit).map(s => ({
        store: s.store,
        value: s[key],
        ebitdaPct: s.ebitdaPct,
        concept: s.concept,
        region: s.region
      }));
    }

    default:
      throw new Error(\`Unknown tool: \${name}\`);
  }
}

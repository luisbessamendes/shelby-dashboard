
import { createClient } from '@supabase/supabase-js';
import type { StoreMonthRecord, FilterState, AggregatedMetrics } from './types';
import { filterByPeriod, aggregate, aggregatePerStore, aggregateByDimension, getMonthlyTrend } from './calculations';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

async function fetchAllRecords(): Promise<StoreMonthRecord[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('fact_store_month')
    .select('*')
    .order('year', { ascending: true })
    .order('month', { ascending: true })
    .limit(100000);

  if (error) throw new Error(`Supabase query failed: ${error.message}`);
  return (data as StoreMonthRecord[]) || [];
}

function applyDimensionFilters(records: StoreMonthRecord[], filters: FilterState): StoreMonthRecord[] {
  let result = records;
  if (filters.stores?.length > 0) result = result.filter(d => filters.stores.includes(d.store));
  if (filters.concepts?.length > 0) result = result.filter(d => filters.concepts.includes(d.concept));
  if (filters.regions?.length > 0) result = result.filter(d => filters.regions.includes(d.region));
  if (filters.storeTypes?.length > 0) result = result.filter(d => filters.storeTypes.includes(d.store_type));
  if (filters.locations?.length > 0) result = result.filter(d => filters.locations.includes(d.location));
  if (filters.legalEntities?.length > 0) result = result.filter(d => filters.legalEntities.includes(d.legal_entity));
  return result;
}

export async function getFilteredData(filters: FilterState): Promise<{
  periodData: StoreMonthRecord[];
  allFilteredData: StoreMonthRecord[];
}> {
  const all = await fetchAllRecords();
  const allFilteredData = applyDimensionFilters(all, filters);

  let periodData = allFilteredData;
  if (filters.year) {
    if (filters.month) {
      periodData = filterByPeriod(allFilteredData, filters.periodBasis, filters.year, filters.month);
    } else {
      periodData = allFilteredData.filter(r => r.year === filters.year);
    }
  }

  return { periodData, allFilteredData };
}

export interface AnalyticsContext {
  portfolio: AggregatedMetrics;
  periodLabel: string;
  filterDescription: string;
  topStores: Array<{ store: string; concept: string; region: string; ebitda: number; ebitdaPct: number | null; sales: number; capex: number; cit: number; fcff: number }>;
  bottomStores: Array<{ store: string; concept: string; region: string; ebitda: number; ebitdaPct: number | null; sales: number; capex: number; cit: number; fcff: number }>;
  topStoresByCapex: Array<{ store: string; concept: string; region: string; capex: number; sales: number; ebitda: number; fcff: number }>;
  conceptSummary: Array<{ name: string; sales: number; ebitda: number; ebitdaPct: number | null; capex: number; cit: number; fcff: number; storeCount: number }>;
  regionSummary: Array<{ name: string; sales: number; ebitda: number; ebitdaPct: number | null; capex: number; cit: number; fcff: number; storeCount: number }>;
  ebitdaNegativeStores: Array<{ store: string; concept: string; region: string; ebitda: number; sales: number }>;
  trendSales: Array<{ period: string; value: number }>;
  trendEbitda: Array<{ period: string; value: number }>;
  trendCapex: Array<{ period: string; value: number }>;
  topCapexStoreHistories: Array<{
    store: string;
    history: Array<{ period: string; capex: number; ebitda: number }>;
  }>;
  allStoresMetricsCsv: string;
  availablePeriods: string;
}

export async function buildAnalyticsContext(filters: FilterState): Promise<AnalyticsContext> {
  const { periodData, allFilteredData } = await getFilteredData(filters);
  const portfolio = aggregate(periodData);
  const storeMap = aggregatePerStore(periodData);
  const storeList = Array.from(storeMap.values()).sort((a, b) => b.totalEbitda - a.totalEbitda);

  const mapStore = (s: typeof storeList[0]) => ({
    store: s.store,
    concept: s.concept,
    region: s.region,
    ebitda: s.totalEbitda,
    ebitdaPct: s.ebitdaPct,
    sales: s.totalSales,
    capex: s.totalCapex,
    cit: s.totalCit,
    fcff: s.totalFcff,
  });

  const topStores = storeList.slice(0, 10).map(mapStore);
  const bottomStores = storeList.slice(-10).reverse().map(mapStore);
  const ebitdaNegativeStores = storeList.filter(s => s.totalEbitda < 0).reverse().map(mapStore);

  const csvHeader = "Year,Month,Store,Concept,Region,Sales_EUR,EBITDA_EUR,CAPEX_EUR,FCFF_EUR,Staff_Cost%,Raw_Mat%\n";
  const csvRows = allFilteredData
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month))
    .map(s => {
      const rPct = (num: number, den: number) => den !== 0 ? `${((num / den) * 100).toFixed(1)}%` : '0%';
      return `${s.year},${s.month},"${s.store}","${s.concept}","${s.region}",${s.sales.toFixed(0)},${s.ebitda.toFixed(0)},${s.capex.toFixed(0)},${s.fcff.toFixed(0)},${rPct(s.staff, s.sales)},${rPct(s.raw_materials, s.sales)}`;
    }).join("\n");
  const allStoresMetricsCsv = csvHeader + csvRows;

  const topStoresByCapex = Array.from(storeMap.values()).sort((a, b) => b.totalCapex - a.totalCapex).slice(0, 10).map(s => ({
    store: s.store,
    concept: s.concept,
    region: s.region,
    capex: s.totalCapex,
    sales: s.totalSales,
    ebitda: s.totalEbitda,
    fcff: s.totalFcff,
  }));

  const conceptMap = aggregateByDimension(periodData, 'concept');
  const conceptSummary = Array.from(conceptMap.entries()).map(([name, agg]) => ({
    name, sales: agg.totalSales, ebitda: agg.totalEbitda, ebitdaPct: agg.ebitdaPct, capex: agg.totalCapex, cit: agg.totalCit, fcff: agg.totalFcff, storeCount: agg.storeCount,
  })).sort((a, b) => b.sales - a.sales);

  const regionMap = aggregateByDimension(periodData, 'region');
  const regionSummary = Array.from(regionMap.entries()).map(([name, agg]) => ({
    name, sales: agg.totalSales, ebitda: agg.totalEbitda, ebitdaPct: agg.ebitdaPct, capex: agg.totalCapex, cit: agg.totalCit, fcff: agg.totalFcff, storeCount: agg.storeCount,
  })).sort((a, b) => b.sales - a.sales);

  const trendSales = getMonthlyTrend(allFilteredData, 'sales').map(t => ({ period: t.period, value: t.value }));
  const trendEbitda = getMonthlyTrend(allFilteredData, 'ebitda').map(t => ({ period: t.period, value: t.value }));
  const trendCapex = getMonthlyTrend(allFilteredData, 'capex').map(t => ({ period: t.period, value: t.value }));

  const storeGroups = new Map<string, typeof periodData>();
  for (const r of allFilteredData) {
    const list = storeGroups.get(r.store) || [];
    list.push(r);
    storeGroups.set(r.store, list);
  }
  
  const topCapexStoreHistories = Array.from(storeGroups.entries()).map(([store, recs]) => {
    const history = recs.map(r => ({ period: `${r.year}-${String(r.month).padStart(2, '0')}`, capex: r.capex, ebitda: r.ebitda })).sort((a, b) => a.period.localeCompare(b.period));
    const totalCapex = recs.reduce((sum, r) => sum + r.capex, 0);
    return { store, history, totalCapex };
  }).filter(x => x.totalCapex > 0).sort((a, b) => b.totalCapex - a.totalCapex).slice(0, 5).map(({ store, history }) => ({ store, history }));

  const basisLabel = filters.periodBasis.toUpperCase();
  const periodLabel = filters.year && filters.month ? `${basisLabel} — ${filters.year}/${String(filters.month).padStart(2, '0')}` : 'All available data';
  const parts: string[] = [];
  if (filters.concepts?.length > 0) parts.push(`Concepts: ${filters.concepts.join(', ')}`);
  if (filters.regions?.length > 0) parts.push(`Regions: ${filters.regions.join(', ')}`);
  if (filters.stores?.length > 0) parts.push(`Stores: ${filters.stores.join(', ')}`);
  if (filters.storeTypes?.length > 0) parts.push(`Types: ${filters.storeTypes.join(', ')}`);
  const filterDescription = parts.length > 0 ? parts.join(' | ') : 'Full portfolio (no dimension filters applied)';

  const years = [...new Set(allFilteredData.map(d => d.year))].sort();
  const availablePeriods = years.length > 0 ? `Data available from ${years[0]} to ${years[years.length - 1]}` : 'No data available';

  return { portfolio, periodLabel, filterDescription, topStores, bottomStores, topStoresByCapex, conceptSummary, regionSummary, ebitdaNegativeStores, trendSales: trendSales.slice(-24), trendEbitda: trendEbitda.slice(-24), trendCapex: trendCapex.slice(-24), topCapexStoreHistories, allStoresMetricsCsv, availablePeriods };
}

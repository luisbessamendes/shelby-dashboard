import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { filters, history, storeMonth } from './fixtures.mjs';
const require = createRequire(import.meta.url);
const { buildAiToolFilters, executeAiTool } = require('../src/lib/ai-tools.ts');
const queries = require('../src/lib/analytics-queries.ts');
const { filterByPeriod } = require('../src/lib/calculations.ts');

test('AI tools inherit every selected dimension, multiple selections and LTM basis', () => {
  const selected = filters({ periodBasis: 'ltm', stores: ['A', 'B'], concepts: ['Alentejo', 'Bifanas'], regions: ['Lisbon'], locations: ['Mall'], storeTypes: ['Shopping Mall'], legalEntities: ['Entity A'] });
  assert.deepEqual(buildAiToolFilters({}, selected), selected);
  const historical = buildAiToolFilters({ year: 2025 }, selected);
  assert.equal(historical.year, 2025);
  assert.equal(historical.month, 4);
  assert.equal(historical.periodBasis, 'ltm');
  assert.deepEqual(historical.legalEntities, ['Entity A']);
  assert.deepEqual(buildAiToolFilters({ concept: 'Bifanas' }, selected).concepts, ['Bifanas']);
  assert.throws(() => buildAiToolFilters({ concept: 'Outside selection' }, selected), /outside/);
  assert.equal(buildAiToolFilters({ month: null }, selected).month, null);
  assert.deepEqual(selected.concepts, ['Alentejo', 'Bifanas']);
});

test('AI context tolerates incomplete historical profit values without crashing', async () => {
  const fetch = globalThis.fetch;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
  globalThis.fetch = async () => new Response(JSON.stringify([storeMonth({ rents: null, store_contribution: null, admin_costs: null })]), { headers: { 'content-type': 'application/json' } });
  try {
    const context = await queries.buildAnalyticsContext(filters());
    assert.ok(context.allStoresMetricsCsv.includes('unavailable'));
    assert.equal(context.portfolio.storeEbitdarPct, null);
    globalThis.fetch = async () => new Response(JSON.stringify(history()), { headers: { 'content-type': 'application/json' } });
    const incomplete = await queries.buildAnalyticsContext(filters({ periodBasis: 'ltm', year: 2024, month: 11 }));
    assert.equal(incomplete.portfolio, null);
    assert.match(incomplete.periodUnavailableReason, /12 calendar months/);
    assert.deepEqual(incomplete.topStores, []);
    assert.deepEqual(incomplete.conceptSummary, []);
    const complete = await queries.buildAnalyticsContext(filters({ periodBasis: 'ltm' }));
    assert.equal(complete.periodUnavailableReason, null);
    assert.equal(complete.portfolio.totalStoreEbitdar, 4560);
  } finally {
    globalThis.fetch = fetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});

test('AI metrics, LTM feed and rankings use the same engine as the dashboard', async () => {
  const original = queries.getFilteredData;
  queries.getFilteredData = async scope => ({
    allFilteredData: history(),
    periodData: filterByPeriod(history(), scope.periodBasis, scope.year, scope.month),
  });
  try {
    const selected = filters({ periodBasis: 'ltm' });
    const result = await executeAiTool('get_aggregated_metrics', {}, selected);
    assert.equal(result.storeEbitdar, 4560);
    assert.equal(result.storeEbitda, 3360);
    assert.equal(result.ebitda, 2760);
    const ranking = await executeAiTool('get_store_rankings', { metric: 'store_ebitdar_pct' }, selected);
    assert.equal(ranking[0].value, 0.38);
    const incomplete = await executeAiTool('get_aggregated_metrics', { year: 2024, month: 11 }, selected);
    assert.equal(incomplete.unavailable, true);
    const feed = await executeAiTool('get_monthly_metrics_feed', { year: 2024, month: null }, selected);
    assert.equal(feed.length, 1);
    assert.equal(feed[0].month, 12);
    assert.equal(feed[0].metrics.totalStoreEbitdar, 4560);
    const ytd = await executeAiTool('get_monthly_metrics_feed', { periodBasis: 'ytd', month: null }, selected);
    assert.equal(ytd.length, 4);
    assert.equal(ytd.at(-1).month, 4);
    const cutoff = await executeAiTool('get_monthly_metrics_feed', { year: 2025 }, selected);
    assert.equal(cutoff.at(-1).month, 4);
  } finally {
    queries.getFilteredData = original;
  }
});

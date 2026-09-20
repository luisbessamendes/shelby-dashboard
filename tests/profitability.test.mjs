import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { storeMonth, history } from './fixtures.mjs';
const require = createRequire(import.meta.url);
const { aggregate, aggregatePerStore, aggregateByDimension, recordMetric, getMonthlyTrend, getRatioTrend, filterByPeriod, getYearlyComparison, comparisonChange, pnlReconciliationIssues } = require('../src/lib/calculations.ts');
const { buildPnlComparison } = require('../src/lib/pnl.ts');
const { PNL_ROWS } = require('../src/lib/pnl-rows.ts');
const { buildProfitBridge } = require('../src/lib/profit-bridge.ts');
const { formatCurrency } = require('../src/lib/formatters.ts');

test('profit levels reconcile without changing the legacy row or FCFF', () => {
  const row = Object.freeze(storeMonth());
  const m = aggregate([row]);
  assert.equal(m.totalStoreEbitdar, 380);
  assert.equal(m.totalStoreEbitda, 280);
  assert.equal(m.totalEbitda, 230);
  assert.equal(m.totalFcff, 200);
  assert.equal(m.storeEbitdarPct, 0.38);
  assert.equal(m.storeEbitdaPct, 0.28);
  assert.equal(m.ebitdaPct, 0.23);
  assert.equal(m.primeCostPct, 0.55);
  assert.equal(m.avgTicket, 12);
});

test('historical inconsistencies are flagged without rewriting imported subtotals', () => {
  const row = Object.freeze(storeMonth({ store_contribution: 300, ebitda: 250, fcff: 220 }));
  assert.equal(pnlReconciliationIssues(row).length, 1);
  const model = buildPnlComparison([row], 'monthly', 2026, 4);
  assert.equal(model.reconciliationIssues.length, 1);
  assert.equal(model.groups.at(-1).values.current.totalStoreEbitda, 300);
});

test('weighted totals use Turnover, not average store margins', () => {
  const rows = [storeMonth(), storeMonth({ store: 'B', turnover: 3000, store_contribution: 800, rents: 100 })];
  const m = aggregate(rows);
  assert.equal(m.storeEbitdarPct, 1280 / 4000);
  assert.equal(m.storeEbitdaPct, 1080 / 4000);
  assert.equal(aggregatePerStore(rows).get('B').totalStoreEbitdar, 900);
  assert.equal(aggregateByDimension(rows, 'concept').get('Alentejo').totalStoreEbitdar, m.totalStoreEbitdar);
});

test('profit layers and loss counts remain signed', () => {
  const m = aggregate([storeMonth({ store_contribution: -140, rents: 100, ebitda: -190 })]);
  assert.equal(m.totalStoreEbitdar, -40);
  assert.equal(m.storeEbitdarNegativeCount, 1);
  assert.equal(m.storeEbitdaNegativeCount, 1);
  assert.equal(m.ebitdaNegativeCount, 1);
});

test('missing values are unavailable; zero margins are genuine zeros', () => {
  assert.equal(aggregate([storeMonth({ turnover: 0 })]).storeEbitdarPct, null);
  assert.equal(recordMetric(storeMonth({ store_contribution: 0, rents: 0 }), 'store_ebitdar'), 0);
  const m = aggregate([storeMonth({ rents: null })]);
  assert.equal(m.storeEbitdarPct, null);
  assert.equal(formatCurrency(m.totalStoreEbitdar), '\u2014');
  assert.equal(aggregate([storeMonth({ staff: null }), storeMonth()]).staffPct, null);
  assert.equal(aggregate([storeMonth({ ebitda: null })]).ebitdaPct, null);
});

test('Monthly and LTM use the same new profit definition and complete calendars', () => {
  for (const metric of ['store_ebitdar', 'store_ebitda', 'ebitda']) {
    const monthly = getMonthlyTrend(history(), metric);
    const ltm = getMonthlyTrend(history(), metric, 'ltm');
    assert.equal(monthly[0].period, '2024-01');
    assert.equal(ltm[0].period, '2024-12');
    assert.equal(ltm.at(-1).value, monthly[0].value * 12);
    assert.equal(getRatioTrend(history(), metric, 'turnover', 'ltm')[0].value, monthly[0].value / 1000);
  }
  const gap = history().filter(row => !(row.year === 2024 && row.month === 6));
  assert.equal(getMonthlyTrend(gap, 'store_ebitdar', 'ltm')[0].period, '2025-06');
});

test('LTM April 2026 covers May 2025 through April 2026, with prior-year comparison', () => {
  const window = filterByPeriod(history(), 'ltm', 2026, 4);
  assert.deepEqual([window[0].year, window[0].month, window.at(-1).year, window.at(-1).month], [2025, 5, 2026, 4]);
  const model = buildPnlComparison(history(), 'ltm', 2026, 4);
  assert.equal(model.groups.at(-1).values.current.totalStoreEbitdar, 4560);
  assert.equal(model.groups.at(-1).values.currentPrior.totalStoreEbitdar, 4560);
  assert.match(model.columns.at(-1).title, /LTM Apr 2026 vs LTM Apr 2025/);
  assert.equal(buildPnlComparison(history(), 'ltm', 2024, 11).groups.at(-1).values.current, null);
});

test('Monthly and YTD preserve group totals and calendar windows across all columns', () => {
  const records = [...history(), ...history().map(r => ({ ...r, store: 'Second store', concept: 'Bifanas' }))];
  const monthly = buildPnlComparison(records, 'monthly', 2026, 4);
  const total = monthly.groups.at(-1).values;
  assert.equal(total.fyOlder.totalStoreEbitdar, 760);
  assert.equal(total.fyRecent.totalStoreEbitdar, 760);
  assert.equal(total.current.totalStoreEbitdar, 760);
  assert.equal(buildPnlComparison(records, 'ytd', 2026, 4).groups.at(-1).values.current.totalStoreEbitdar, 3040);
  assert.equal(monthly.groups.filter(group => group.kind === 'concept-total').reduce((sum, group) => sum + group.values.current.totalStoreEbitdar, 0), total.current.totalStoreEbitdar);
  assert.equal(getYearlyComparison(records, 'ltm', 4, [2024, 2025, 2026]).length, 2);
});

test('P&L July columns follow the selected basis for all three years and YoY comparisons', () => {
  const records = [2023, 2024, 2025, 2026].flatMap(year =>
    Array.from({ length: 12 }, (_, index) => storeMonth({
      year, month: index + 1, tickets: (year - 2022) * 100 + index + 1,
    })));
  for (const [basis, prefix, expected] of [
    ['monthly', '', [207, 307, 407]],
    ['ytd', 'YTD ', [1428, 2128, 2828]],
    ['ltm', 'LTM ', [1978, 3178, 4378]],
  ]) {
    const model = buildPnlComparison(records, basis, 2026, 7);
    const valueColumns = model.columns.filter(column => !column.compareKey);
    assert.deepEqual(valueColumns.map(column => column.label), [2024, 2025, 2026].map(year => `${prefix}Jul ${year}`));
    for (const group of model.groups) {
      assert.deepEqual(valueColumns.map(column => group.values[column.valueKey].totalTickets), expected);
      assert.equal(group.values.currentPrior.totalTickets, expected[1]);
      for (const [index, column] of model.columns.filter(column => column.compareKey).entries()) {
        assert.equal(comparisonChange(group.values[column.valueKey].totalTickets, group.values[column.compareKey].totalTickets),
          (expected[index + 1] - expected[index]) / expected[index]);
        assert.ok(column.title.startsWith(`${prefix}Jul ${2025 + index} vs ${prefix}Jul ${2024 + index}:`));
      }
    }
    assert.equal(model.notice, null);
  }
  const changedSelection = buildPnlComparison(records, 'ytd', 2025, 2);
  assert.deepEqual(changedSelection.columns.filter(column => !column.compareKey).map(column => column.label),
    ['YTD Feb 2023', 'YTD Feb 2024', 'YTD Feb 2025']);
  assert.equal(changedSelection.groups.at(-1).values.fyOlder.totalTickets, 203);
});

test('P&L incomplete historical LTM windows are unavailable rather than partial totals', () => {
  const model = buildPnlComparison(history(), 'ltm', 2026, 4);
  assert.equal(model.groups.at(-1).values.fyOlder, null);
  assert.match(model.notice, /LTM Apr 2024 is unavailable/);
  const gap = history().filter(row => !(row.year === 2024 && row.month === 8));
  const missingPrior = buildPnlComparison(gap, 'ltm', 2026, 4);
  assert.equal(missingPrior.groups.at(-1).values.fyRecent, null);
  assert.equal(missingPrior.groups.at(-1).values.currentPrior, null);
  assert.equal(missingPrior.groups.at(-1).values.current.totalTickets, 1200);
});

test('YoY handles negative baselines, zero denominators and margin changes in pp', () => {
  assert.equal(comparisonChange(110, 100), 0.1);
  assert.equal(comparisonChange(-80, -100), 0.2);
  assert.equal(comparisonChange(10, 0), null);
  assert.equal(comparisonChange(0.1, 0, true), 0.1);
  assert.equal(comparisonChange(null, 1), null);
});

test('P&L follows all 29 workbook labels; deductions stay negative', () => {
  assert.equal(PNL_ROWS.length, 29);
  assert.deepEqual(PNL_ROWS.slice(19).map(row => row.label), ['Store EBITDAR', 'Store EBITDAR %', 'Leases', 'Leases %', 'Store EBITDA', 'Store EBITDA %', 'Headquarter & Admin.', 'Headquarter & Admin. %', 'EBITDA', 'EBITDA %']);
  const m = aggregate([storeMonth()]);
  assert.equal(PNL_ROWS.find(row => row.id === 'leases').value(m), -100);
  assert.equal(PNL_ROWS.find(row => row.id === 'primeCost').value(m), -550);
  assert.equal(PNL_ROWS.find(row => row.id === 'staffCostPct').value(m), 0.25);
});

test('all waterfalls deduct rent and headquarters exactly once, with negative crossing support', () => {
  const m = aggregate([storeMonth()]);
  for (const mode of ['operating', 'full', 'cash']) {
    const steps = buildProfitBridge(m, mode);
    assert.equal(steps.filter(step => step.name === 'Leases').length, 1);
    assert.equal(steps.filter(step => step.name === 'Headquarter & Admin.').length, 1);
    assert.equal(steps.some(step => step.variance !== null), false);
    assert.equal(steps.at(-1).value, mode === 'operating' ? 230 : 200);
  }
  const steps = buildProfitBridge(aggregate([storeMonth({ store_contribution: -100, rents: 300, ebitda: -150, fcff: -180 })]), 'cash');
  assert.deepEqual(steps.find(step => step.name === 'Leases').range, [-100, 200]);
  assert.deepEqual(steps.find(step => step.name === 'Store EBITDA').range, [-100, 0]);
});

test('missing reconciliation inputs are not treated as zero costs', () => {
  for (const field of ['vat', 'raw_materials', 'staff', 'utilities', 'maintenance', 'banking_costs', 'others', 'rents', 'admin_costs', 'capex', 'cit']) {
    assert.deepEqual(pnlReconciliationIssues(storeMonth({ [field]: null })), [], field);
  }
});

test('waterfall credit amounts and ratios keep their accounting signs', () => {
  const metrics = aggregate([storeMonth({ rents: -100, store_contribution: 480, ebitda: 430, fcff: 400 })]);
  const leases = buildProfitBridge(metrics).find(step => step.name === 'Leases');
  assert.equal(leases.value, 100);
  assert.equal(leases.pct, metrics.rentsPct);
  assert.equal(leases.pct, -0.1);
  assert.equal(leases.color, '#10b981');
});

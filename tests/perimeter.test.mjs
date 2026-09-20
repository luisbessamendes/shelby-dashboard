import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { storeMonth, filters } from './fixtures.mjs';

const require = createRequire(import.meta.url);
const { buildPerimeterComparison, buildPerimeterWaterfall, perimeterAxisDomain, perimeterValue, COHORTS } = require('../src/lib/perimeter.ts');
const { PERIMETER_REGISTRY, normalizePerimeterCode, registryMonth, indexPerimeterRegistry } = require('../src/lib/perimeter-registry.ts');
const { PNL_ROWS } = require('../src/lib/pnl-rows.ts');
const { aggregate } = require('../src/lib/calculations.ts');
const now = new Date(2026, 8, 17);
const row = id => PNL_ROWS.find(r => r.id === id);
const portfolio = model => model.groups.find(group => group.id === 'portfolio');
const classified = (model, stage, name) => model.stages.find(s => s.key === stage).stores.find(s => s.name === name);
const idx = r => r.year * 12 + r.month - 1;
const registered = (name, more = {}) => ({ code: name.toUpperCase(), store: name, sourceRow: 2, fy25: 'l4l', ltm: 'l4l', ...more });
// Default synthetic stores are explicitly registered L4L, not inferred from sales.
const registryFor = data => [...new Map(data.map(r => [r.code, registered(r.store, { code: r.code ?? '' })])).values()];
const compare = (data, options = {}) => buildPerimeterComparison(data, filters(options.filters), options.basis ?? 'ytd', options.year ?? 2026, options.month ?? 7, options.now ?? now, options.registry ?? registryFor(data));
function history(name, start = 0, end = 30, overrides = {}) {
  return Array.from({ length: end - start + 1 }, (_, i) => {
    const n = i + start;
    return storeMonth({ store: name, code: name.toUpperCase(), year: 2024 + Math.floor(n / 12), month: ((n % 12) + 12) % 12 + 1, ...overrides });
  });
}
const zeroSales = { sales: 0, vat: 0, turnover: 0, tickets: 0, raw_materials: 0, staff: 0, rents: 20, utilities: 0, maintenance: 0, banking_costs: 0, others: 0, store_contribution: -20, admin_costs: 5, ebitda: -25, capex: 0, cit: 0, fcff: -25 };
const zero = { ...zeroSales, rents: 0, store_contribution: 0, admin_costs: 0, ebitda: 0, fcff: 0 };

test('register preserves all 112 rows, unique codes, stage flags and valid event months', () => {
  assert.equal(PERIMETER_REGISTRY.length, 112);
  assert.equal(indexPerimeterRegistry(PERIMETER_REGISTRY).size, 112);
  for (const r of PERIMETER_REGISTRY) {
    for (const status of [r.fy25, r.ltm]) assert.ok([null, 'l4l', 'new', 'closed', 'renovation'].includes(status));
    for (const date of [r.opened, r.closed, r.renovation?.from, r.renovation?.through].filter(Boolean)) assert.ok(Number.isInteger(registryMonth(date)));
  }
  for (const [stage, expected] of [['fy25', { l4l: 91, new: 15, renovation: 2, null: 4 }], ['ltm', { l4l: 94, new: 11, closed: 6, renovation: 1 }]]) {
    assert.deepEqual(PERIMETER_REGISTRY.reduce((counts, r) => ({ ...counts, [r[stage]]: (counts[r[stage]] ?? 0) + 1 }), {}), expected);
  }
});

test('YTD July checkpoints use January-July in all three years', () => {
  const data = history('A').map(r => ({ ...r, sales: r.year === 2024 ? 100 : r.year === 2025 && r.month < 8 ? 100000 : 200 }));
  const m = compare(data);
  for (const stage of ['previous', 'current']) assert.equal(classified(m, stage, 'A').cohort, 'l4l');
  for (const [col, expected] of [['baseline', 700], ['middle', 700000], ['current', 1400], ['previous:l4l', 699300], ['current:l4l', -698600], ['change', 700]]) {
    assert.equal(perimeterValue(row('grossSales'), portfolio(m), col), expected);
  }
});

test('March25 opening or acquisition stays Opening in BOTH bridges, never L4L annualisation', () => {
  for (const entryKind of ['opening', 'acquisition']) {
    const data = [...history('Good'), ...history('March25', 14)];
    const m = compare(data, { registry: [registered('Good'), registered('March25', { fy25: 'new', ltm: 'new', opened: '2025-03', entryKind })] });
    for (const stage of ['previous', 'current']) assert.equal(classified(m, stage, 'March25').cohort, 'new');
    assert.equal(perimeterValue(row('grossSales'), portfolio(m), 'previous:new'), 5 * 1200);
    assert.equal(perimeterValue(row('grossSales'), portfolio(m), 'current:new'), 2 * 1200);
    assert.equal(perimeterValue(row('grossSales'), portfolio(m), 'current:l4l'), 0);
  }
});

test('partial-baseline entry date prevents an erroneous L4L flag', () => {
  const m = compare([...history('Good'), ...history('March25', 14)], { registry: [registered('Good'), registered('March25', { opened: '2025-03' })] });
  for (const stage of ['previous', 'current']) assert.equal(classified(m, stage, 'March25').cohort, 'new');
});

test('2024 entry annualises in first bridge; full January25 baseline permits second-stage L4L', () => {
  const data = [...history('Good'), ...history('April24', 3), ...history('January25', 12), ...history('March26', 26)];
  const registry = [registered('Good'), registered('April24', { fy25: 'new', opened: '2024-04' }), registered('January25', { fy25: 'new', opened: '2025-01' }), registered('March26', { fy25: null, ltm: 'new', opened: '2026-03' })];
  const m = compare(data, { registry });
  for (const name of ['April24', 'January25']) {
    assert.equal(classified(m, 'previous', name).cohort, 'new');
    assert.equal(classified(m, 'current', name).cohort, 'l4l');
  }
  assert.equal(classified(m, 'previous', 'March26'), undefined);
  assert.equal(classified(m, 'current', 'March26').cohort, 'new');
});

test('opening survives reporting gaps, dimension changes and later exit', () => {
  const rows = history('March25', 14).filter(r => !(r.year === 2025 && r.month === 6)).map(r => ({ ...r, ...(r.year === 2026 ? zeroSales : {}), region: r.year === 2026 ? 'Porto' : 'Lisbon' }));
  const m = compare([...history('Good'), ...rows], { registry: [registered('Good'), registered('March25', { fy25: 'new', ltm: 'new', opened: '2025-03', closed: '2026-01' })] });
  for (const stage of ['previous', 'current']) assert.equal(classified(m, stage, 'March25').cohort, 'new');
  assert.match(m.notices.join(' '), /Missing expected reports/);
  assert.match(classified(m, 'current', 'March25').warnings.join(' '), /Business classification changed/);
  assert.equal(m.provisional, true);
});

test('confirmed renovations have their own stage-specific cohort', () => {
  const data = [...history('Good'), ...history('Colombo').filter(r => !(idx(r) > 2024 * 12 + 3 && idx(r) < 2025 * 12 + 7)), ...history('Igreja')];
  const registry = [registered('Good'), registered('Colombo', { fy25: 'renovation', ltm: 'renovation', renovation: { from: '2024-04', through: '2025-08' } }), registered('Igreja', { fy25: 'renovation', renovation: { from: '2024-03', through: '2024-09' } })];
  const m = compare(data, { registry });
  for (const stage of ['previous', 'current']) assert.equal(classified(m, stage, 'Colombo').cohort, 'renovation');
  assert.equal(classified(m, 'previous', 'Igreja').cohort, 'renovation');
  assert.equal(classified(m, 'current', 'Igreja').cohort, 'l4l');
  assert.equal(m.notices.some(n => n.includes('Reporting gaps')), false);
});

test('confirmed closure needs no zero-sales tail; after-closure costs are retained', () => {
  const data = [...history('Good'), ...history('Closed', 0, 24), ...history('Closed', 29, 30, zeroSales)];
  const m = compare(data, { registry: [registered('Good'), registered('Closed', { ltm: 'closed', closed: '2026-01' })] });
  assert.equal(classified(m, 'previous', 'Closed').cohort, 'l4l');
  assert.equal(classified(m, 'current', 'Closed').cohort, 'closed');
  assert.equal(m.notices.some(n => n.includes('Reporting gaps')), false);
  assert.equal(perimeterValue(row('leases'), portfolio(m), 'current:closed'), 560);
});

test('future closure and renovation do not affect earlier endpoints; conflicts are flagged', () => {
  const data = [...history('Closed'), ...history('Renovation')];
  const registry = [registered('Closed', { ltm: 'closed', closed: '2026-04' }), registered('Renovation', { ltm: 'renovation', renovation: { from: '2026-06', through: '2026-08' } })];
  const before = compare(data, { registry, month: 3 });
  for (const name of ['Closed', 'Renovation']) assert.equal(classified(before, 'current', name).cohort, 'l4l');
  const after = compare(data, { registry });
  assert.equal(classified(after, 'current', 'Closed').cohort, 'closed');
  assert.equal(classified(after, 'current', 'Renovation').cohort, 'renovation');
  assert.match(after.notices.join(' '), /Sales reported after the registered closure/);
});

test('future opening excludes zero placeholders from counts but keeps pre-opening costs', () => {
  const registry = [registered('Good'), registered('Future', { fy25: null, ltm: 'new', opened: '2026-09' })];
  const data = [...history('Good'), ...history('Future', 0, 30, zero)];
  const before = compare(data, { registry });
  for (const stage of ['previous', 'current']) assert.equal(classified(before, stage, 'Future'), undefined);
  const costs = compare(data.map(r => r.store === 'Future' && r.year === 2026 && r.month === 7 ? { ...r, ...zeroSales } : r), { registry });
  assert.equal(classified(costs, 'current', 'Future').cohort, 'new');
  assert.match(classified(costs, 'current', 'Future').reason, /after this endpoint/);
  assert.equal(perimeterValue(row('leases'), portfolio(costs), 'current:new'), -20);
});

test('future lifecycle event cannot invent an unapproved earlier L4L classification', () => {
  for (const event of [{ ltm: 'closed', closed: '2026-04' }, { ltm: 'renovation', renovation: { from: '2026-06', through: '2026-08' } }]) {
    const m = compare(history('A'), { month: 3, registry: [registered('A', { fy25: null, ...event })] });
    assert.equal(classified(m, 'current', 'A').cohort, 'other');
  }
});

test('a confirmed closure takes precedence over an earlier renovation', () => {
  const m = compare(history('A'), { registry: [registered('A', { fy25: 'renovation', ltm: 'closed', closed: '2026-03', renovation: { from: '2025-04', through: '2025-06' } })] });
  assert.equal(classified(m, 'previous', 'A').cohort, 'renovation');
  assert.equal(classified(m, 'current', 'A').cohort, 'closed');
});

test('old records do not hide a registered store missing from all comparison windows', () => {
  const m = compare([...history('Good'), storeMonth({ store: 'Absent', code: 'ABSENT', year: 2023, month: 12 })], { registry: [registered('Good'), registered('Absent')] });
  assert.match(m.notices.join(' '), /no financial records: Absent/);
  assert.equal(m.provisional, true);
  const scoped = compare(history('Good'), { registry: [registered('Good'), registered('Absent')], filters: { concepts: ['Alentejo'] } });
  assert.equal(scoped.notices.some(n => n.includes('Absent')), false);
});

test('every P&L amount, cohort, concept and both bridge stages reconcile to unchanged raw totals', () => {
  const data = [...history('Good'), ...history('Opening', 14), ...history('Opening', 10, 11, zeroSales), ...history('Closed', 0, 24), ...history('Closed', 25, 30, zeroSales), ...history('Renovation', 0, 30, { concept: 'Bifanas' }).filter(r => !(r.year === 2025 && r.month === 6)), ...history('Unknown', 0, 30, { concept: 'Bifanas' })];
  const registry = [registered('Good'), registered('Opening', { fy25: 'new', ltm: 'new', opened: '2025-03' }), registered('Closed', { ltm: 'closed', closed: '2026-01' }), registered('Renovation', { fy25: 'renovation', ltm: 'renovation', renovation: { from: '2025-05', through: '2025-07' } })];
  const m = compare(data, { registry });
  for (const definition of PNL_ROWS.filter(r => r.format !== 'percent' && r.id !== 'avgTicket')) {
    for (const group of m.groups) for (const [stage, from, to] of [['previous', 'baseline', 'middle'], ['current', 'middle', 'current']]) {
      const delta = COHORTS.reduce((sum, c) => sum + perimeterValue(definition, group, `${stage}:${c.key}`), 0);
      assert.ok(Math.abs(perimeterValue(definition, group, from) + delta - perimeterValue(definition, group, to)) < 1e-8, `${group.label} ${stage} ${definition.id}`);
    }
    assert.equal(perimeterValue(definition, portfolio(m), 'middle'), definition.value(aggregate(data.filter(r => r.year === 2025 && r.month <= 7))));
    assert.equal(perimeterValue(definition, portfolio(m), 'current'), definition.value(aggregate(data.filter(r => r.year === 2026 && r.month <= 7))));
  }
  for (const id of ['grossSales', 'storeEbitdar']) {
    const steps = buildPerimeterWaterfall(m, row(id));
    assert.equal(steps.length, 3 + (m.groups.length - 1) * COHORTS.length * 2);
    for (let i = 1; i < steps.length; i++) assert.ok(Math.abs((steps[i].total ? steps[i].value : steps[i].start) - steps[i - 1].end) < 1e-8);
  }
});

test('unknown stores, undated closures and blank flags require review, never sales inference', () => {
  const m = compare([...history('Unknown', 14), ...history('Undated'), ...history('Blank')], { registry: [registered('Undated', { ltm: 'closed' }), registered('Blank', { fy25: null, ltm: null })] });
  for (const name of ['Unknown', 'Undated', 'Blank']) assert.equal(classified(m, 'current', name).cohort, 'other');
  assert.match(classified(m, 'current', 'Unknown').reason, /No unique matching classification/);
  assert.equal(m.provisional, true);
});

test('zero sales do not override registered L4L; missing rows exclude it pending review', () => {
  const data = history('A').map(r => r.year === 2026 && r.month >= 4 ? { ...r, ...zeroSales } : r);
  assert.equal(classified(compare(data), 'current', 'A').cohort, 'l4l');
  const m = compare([...history('Good'), ...data.filter(r => !(r.year === 2025 && r.month === 3))]);
  assert.equal(classified(m, 'current', 'A').cohort, 'other');
  assert.match(classified(m, 'current', 'A').warnings.join(' '), /2025-03/);
});

test('full-code matching handles padding and renames; collisions and duplicates are reviewed', () => {
  assert.equal(normalizePerimeterCode(' abc_store_C002 '), 'ABC_STORE_C2');
  const data = history('A', 0, 30, { code: 'ABC_STORE_C2' }).map(r => r.year === 2024 ? { ...r, code: 'ABC_STORE_C02' } : { ...r, store: 'Renamed' });
  const registry = [registered('Original', { code: 'ABC_STORE_C02' })];
  const m = compare(data, { registry, filters: { stores: ['Renamed'] } });
  assert.equal(m.stores.length, 1);
  assert.equal(classified(m, 'current', 'Renamed').cohort, 'l4l');
  assert.equal(perimeterValue(row('grossSales'), portfolio(m), 'baseline'), 8400);
  for (const entries of [[registered('Original', { code: 'DIFFERENT_STORE_C02' })], [...registry, registered('Duplicate', { code: 'ABC_STORE_C2' })]]) {
    assert.equal(classified(compare(data, { registry: entries }), 'current', 'Renamed').cohort, 'other');
  }
  assert.equal(classified(compare([...data, data[0]], { registry }), 'previous', 'Renamed').cohort, 'other');
});

test('ambiguous names and missing identities are not trusted; unique missing codes are recovered', () => {
  const data = history('A').map(r => r.year === 2024 ? r : { ...r, code: 'CHANGED' });
  assert.ok(compare(data).stages.every(s => s.stores.every(r => r.cohort === 'other')));
  assert.equal(classified(compare(history('A', 0, 30, { code: null })), 'current', 'A').cohort, 'other');
  assert.equal(classified(compare(history('A').map(r => r.year === 2024 ? { ...r, code: null } : r)), 'current', 'A').cohort, 'l4l');
});

test('all business filters and multiple selections preserve registered stage classifications', () => {
  const data = [...history('A'), ...history('B', 14, 30, { concept: 'Bifanas', region: 'Porto', location: 'Street', legal_entity: 'B', store_type: 'High Street' })];
  const registry = [registered('A'), registered('B', { fy25: 'new', ltm: 'new', opened: '2025-03' })];
  for (const [field, key] of [['store', 'stores'], ['concept', 'concepts'], ['region', 'regions'], ['location', 'locations'], ['legal_entity', 'legalEntities'], ['store_type', 'storeTypes']]) {
    const m = compare(data, { registry, filters: { [key]: [data.at(-1)[field]] } });
    assert.equal(m.stores.length, 1);
    for (const stage of ['previous', 'current']) assert.equal(classified(m, stage, 'B').cohort, 'new');
    assert.equal(perimeterValue(row('grossSales'), portfolio(m), 'current'), 8400);
  }
  assert.equal(compare(data, { registry, filters: { stores: ['A', 'B'] } }).stores.length, 2);
  assert.equal(compare(data, { registry }).stores.length, 2);
});

test('dimension changes stay auditable without leaking records across filters', () => {
  for (const [field, key] of [['concept', 'concepts'], ['region', 'regions'], ['location', 'locations'], ['legal_entity', 'legalEntities'], ['store_type', 'storeTypes']]) {
    const data = history('A').map(r => r.year === 2024 ? r : { ...r, store: 'Renamed', [field]: 'New value' });
    const all = compare(data, { filters: { stores: ['Renamed'] } });
    assert.equal(perimeterValue(row('grossSales'), portfolio(all), 'baseline'), 8400);
    assert.equal(classified(all, 'previous', 'Renamed').cohort, 'other');
    const selected = compare(data, { filters: { stores: ['Renamed'], [key]: ['New value'] } });
    assert.equal(perimeterValue(row('grossSales'), portfolio(selected), 'baseline'), 0);
    assert.equal(perimeterValue(row('grossSales'), portfolio(selected), 'previous:other'), 8400);
  }
});

test('moving the year moves both bridges and uses only the applicable register column', () => {
  const m = compare(history('A', 0, 42), { year: 2027, now: new Date(2027, 8, 17) });
  assert.equal(classified(m, 'previous', 'A').cohort, 'l4l');
  assert.equal(classified(m, 'current', 'A').cohort, 'other');
  assert.match(classified(m, 'current', 'A').reason, /2024 to 2025 and 2025 to 2026 only/);
});

test('weighted ratios and average ticket use correct bases and have no additive cohort impacts', () => {
  const group = portfolio(compare([...history('A'), ...history('B', 0, 30, { turnover: 2000, sales: 2400, tickets: 50, staff: 1000 })]));
  assert.equal(perimeterValue(row('staffCostPct'), group, 'current'), 1250 / 3000);
  assert.equal(perimeterValue(row('avgTicket'), group, 'current'), 3600 / 150);
  for (const r of [row('staffCostPct'), row('avgTicket')]) for (const stage of ['previous', 'current']) for (const c of COHORTS) assert.equal(perimeterValue(r, group, `${stage}:${c.key}`), null);
});

test('globally missing months disable affected checkpoints and charts, not silently become zero', () => {
  for (const [year, month, field] of [[2024, 2, 'baseline'], [2025, 2, 'middle'], [2026, 2, 'current']]) {
    const m = compare(history('A').filter(r => !(r.year === year && r.month === month)));
    assert.equal(perimeterValue(row('grossSales'), portfolio(m), field), null);
    assert.deepEqual(buildPerimeterWaterfall(m, row('grossSales')), []);
    assert.match(m.notices.join(' '), /missing calendar months/);
  }
});

test('coverage drop remains provisional independently of confirmed closure', () => {
  const data = [...history('A'), ...history('B'), ...history('C'), ...history('Closed', 0, 26)].filter(r => !(r.year === 2026 && r.month === 7 && ['B', 'C'].includes(r.store)));
  const m = compare(data, { registry: [registered('A'), registered('B'), registered('C'), registered('Closed', { ltm: 'closed', closed: '2026-03' })] });
  assert.equal(m.provisional, true);
  assert.match(m.notices.join(' '), /2026-07/);
  assert.equal(classified(m, 'current', 'Closed').cohort, 'closed');
});

test('null values remain unavailable, genuine zero remains zero, source discrepancies remain visible', () => {
  const group = portfolio(compare(history('A').map(r => ({ ...r, ...zero, staff: r.year === 2026 && r.month === 7 ? null : 0 }))));
  assert.equal(perimeterValue(row('staffCost'), group, 'current'), null);
  assert.equal(perimeterValue(row('grossSales'), group, 'current'), 0);
  assert.equal(perimeterValue(row('staffCostPct'), group, 'current'), null);
  assert.equal(perimeterValue(row('avgTicket'), group, 'current'), null);
  const m = compare(history('A', 0, 30, { store_contribution: -500, ebitda: -550 }));
  assert.ok(m.reconciliationIssues.length > 0);
  assert.equal(buildPerimeterWaterfall(m, row('storeEbitdar'))[0].value, -2800);
});

test('future/invalid endpoints and empty selections are blocked', () => {
  const data = history('A');
  assert.match(compare(data, { month: 12 }).blocked, /future/);
  assert.match(compare(data, { year: NaN }).blocked, /valid Year/);
  assert.match(compare(data, { filters: { stores: ['Missing'] } }).blocked, /No records/);
  assert.equal(compare(data, { month: 9 }).provisional, true);
});

test('tooltip percentages use each concept/cohort baseline independently for both stages', () => {
  const data = [...history('A', 0, 30, { concept: 'A' }).map(r => ({ ...r, sales: r.year === 2024 ? 1000 : r.year === 2025 ? 1100 : 1210, store_contribution: r.year === 2024 ? 100 : r.year === 2025 ? 140 : 188 })), ...history('B', 0, 30, { concept: 'B', sales: 10000 }), ...history('New', 24, 30, { concept: 'A' })];
  const m = compare(data, { registry: [registered('A'), registered('B'), registered('New', { fy25: null, ltm: 'new', opened: '2026-01' })] });
  for (const [id, pct] of [['grossSales', 0.1], ['storeEbitdar', 0.2]]) {
    const steps = buildPerimeterWaterfall(m, row(id));
    assert.ok(Math.abs(steps.find(s => s.id === 'previous:concept:A:l4l').changePct - pct) < 1e-12);
    assert.ok(Math.abs(steps.find(s => s.id === 'current:concept:A:l4l').changePct - pct) < 1e-12);
    assert.equal(steps.find(s => s.id === 'current:concept:A:new').changePct, null);
    assert.ok(steps.filter(s => s.total).every(s => s.changePct === null));
  }
});

test('zoom, zero axis and negative-baseline percentage calculations remain correct', () => {
  const m = compare(history('A').map(r => ({ ...r, sales: r.year === 2024 ? 1200 : 900, store_contribution: r.year === 2024 ? -500 : -300 })));
  const sales = buildPerimeterWaterfall(m, row('grossSales'));
  const profit = buildPerimeterWaterfall(m, row('storeEbitdar'));
  assert.equal(sales.find(s => s.id.endsWith(':l4l')).changePct, -0.25);
  assert.equal(profit.find(s => s.id.endsWith(':l4l')).changePct, 0.5);
  for (const steps of [sales, profit]) {
    const zoom = perimeterAxisDomain(steps);
    for (const s of steps) for (const v of s.total ? [s.value] : [s.start, s.end]) assert.ok(v > zoom[0] && v < zoom[1]);
  }
  assert.equal(perimeterAxisDomain(sales, true)[0], 0);
  assert.equal(perimeterAxisDomain(profit, true)[1], 0);
  assert.deepEqual(perimeterAxisDomain([]), [0, 1]);
});

test('Monthly, YTD and LTM use matching endpoints, raw P&L amounts, weighted ratios and both bridges', () => {
  const data = [...history('A', -5), ...history('B', -5, 30, { concept: 'Bifanas' })].map(r => {
    const factor = (idx(r) - 2023 * 12 + 1) * (r.store === 'B' ? 2 : 1);
    return { ...r, sales: 1200 * factor, turnover: 1000 * factor, vat: 200 * factor, staff: 100 + 15 * factor, tickets: 100 + factor };
  });
  const columns = ['baseline', 'middle', 'current'];
  for (const basis of ['monthly', 'ytd', 'ltm']) {
    const model = compare(data, { basis });
    assert.equal(model.blocked, null);
    assert.equal(model.provisional, false);
    assert.deepEqual(model.periods.map(p => [p.start, p.end]), [2024, 2025, 2026].map(y => [
      basis === 'monthly' ? y * 12 + 6 : basis === 'ytd' ? y * 12 : (y - 1) * 12 + 7, y * 12 + 6,
    ]));
    const prefix = basis === 'monthly' ? '' : `${basis.toUpperCase()} `;
    assert.deepEqual(model.periods.map(p => p.label), [2024, 2025, 2026].map(y => `${prefix}Jul ${y}`));
    for (const group of model.groups) {
      const records = data.filter(r => group.id === 'portfolio' || r.concept === group.label);
      for (let i = 0; i < 3; i++) {
        const year = 2024 + i;
        const selected = records.filter(r => basis === 'monthly' ? r.year === year && r.month === 7
          : basis === 'ytd' ? r.year === year && r.month <= 7
          : idx(r) >= (year - 1) * 12 + 7 && idx(r) <= year * 12 + 6);
        for (const definition of PNL_ROWS) {
          assert.equal(perimeterValue(definition, group, columns[i]), definition.value(aggregate(selected)), `${basis} ${group.label} ${columns[i]} ${definition.id}`);
        }
      }
      for (const definition of PNL_ROWS.filter(r => r.format !== 'percent' && r.id !== 'avgTicket')) {
        for (const [stage, from, to] of [['previous', 'baseline', 'middle'], ['current', 'middle', 'current']]) {
          const delta = COHORTS.reduce((sum, c) => sum + perimeterValue(definition, group, `${stage}:${c.key}`), 0);
          assert.ok(Math.abs(perimeterValue(definition, group, from) + delta - perimeterValue(definition, group, to)) < 1e-8);
        }
      }
    }
    for (const id of ['grossSales', 'storeEbitdar']) {
      const steps = buildPerimeterWaterfall(model, row(id));
      assert.deepEqual(steps.filter(s => s.total).map(s => s.label), model.periods.map(p => p.label));
      for (let i = 1; i < steps.length; i++) assert.ok(Math.abs((steps[i].total ? steps[i].value : steps[i].start) - steps[i - 1].end) < 1e-8);
      for (const s of steps.filter(s => !s.total)) {
        const stage = model.stages.find(stage => s.id.startsWith(`${stage.key}:`));
        assert.equal(s.stageLabel, stage.label);
        assert.equal(s.periodLabel, stage.current.shortLabel);
      }
    }
  }
});

test('LTM July 2024 requires August-December 2023; unavailable periods never fall back to FY', () => {
  const model = compare(history('A'), { basis: 'ltm' });
  assert.equal(perimeterValue(row('grossSales'), portfolio(model), 'baseline'), null);
  assert.equal(perimeterValue(row('grossSales'), portfolio(model), 'middle'), 14400);
  assert.equal(perimeterValue(row('grossSales'), portfolio(model), 'current'), 14400);
  assert.equal(perimeterValue(row('grossSales'), portfolio(model), 'previous:l4l'), null);
  assert.equal(perimeterValue(row('grossSales'), portfolio(model), 'change'), null);
  assert.match(model.notices.join(' '), /LTM Jul 2024 has missing calendar months/);
  assert.deepEqual(buildPerimeterWaterfall(model, row('grossSales')), []);
});

test('reporting gaps, dimension changes and financial activity outside Monthly/YTD windows are excluded', () => {
  for (const basis of ['monthly', 'ytd']) {
    const data = history('A').filter(r => r.month <= 7).map(r => r.month === 1 && basis === 'monthly' ? { ...r, concept: 'Ignored' } : r);
    const m = compare(data, { basis });
    assert.equal(m.provisional, false);
    assert.ok(m.stages.every(s => s.stores.every(store => store.cohort === 'l4l')));
    assert.equal(m.groups.length, 2);
    assert.ok(!m.notices.some(n => n.includes('Reporting gaps')));
  }
  const selected = history('A').filter(r => r.month === 7);
  assert.equal(compare(selected, { basis: 'monthly' }).provisional, false);
  assert.equal(perimeterValue(row('grossSales'), portfolio(compare(selected, { basis: 'ytd' })), 'baseline'), null);
});

test('approved March25 annualisation remains outside L4L even in Monthly July comparisons', () => {
  for (const basis of ['monthly', 'ytd', 'ltm']) {
    const data = [...history('Good', -5), ...history('March25', 14)];
    const m = compare(data, { basis, registry: [registered('Good'), registered('March25', { fy25: 'new', ltm: 'new', opened: '2025-03' })] });
    assert.equal(classified(m, 'previous', 'March25').cohort, 'new');
    assert.equal(classified(m, 'current', 'March25').cohort, 'new');
    assert.equal(perimeterValue(row('grossSales'), portfolio(m), 'current:l4l'), 0);
  }
});

test('approved Opening takes precedence over later closure or renovation in every mode', () => {
  for (const basis of ['monthly', 'ytd', 'ltm']) for (const event of [{ closed: '2026-01' }, { renovation: { from: '2026-06', through: '2026-08' } }]) {
    const data = [...history('Good', -5), ...history('March25', 14).map(r => r.year === 2026 ? { ...r, ...zeroSales } : r)];
    const m = compare(data, { basis, registry: [registered('Good'), registered('March25', { fy25: 'new', ltm: 'new', opened: '2025-03', ...event })] });
    for (const stage of ['previous', 'current']) assert.equal(classified(m, stage, 'March25').cohort, 'new');
    assert.equal(perimeterValue(row('grossSales'), portfolio(m), 'current:closed'), 0);
    assert.equal(perimeterValue(row('grossSales'), portfolio(m), 'current:renovation'), 0);
    const rent = p => data.filter(r => r.store === 'March25' && idx(r) >= p.start && idx(r) <= p.end).reduce((sum, r) => sum + r.rents, 0);
    assert.equal(perimeterValue(row('leases'), portfolio(m), 'current:new'), rent(m.periods[1]) - rent(m.periods[2]));
  }
});

test('Monthly renovation dates in intervening months are not mislabeled as renovation impact', () => {
  const m = compare(history('A'), { basis: 'monthly', registry: [registered('A', { ltm: 'renovation', renovation: { from: '2026-03', through: '2026-04' } })] });
  assert.equal(classified(m, 'current', 'A').cohort, 'other');
  assert.match(classified(m, 'current', 'A').reason, /outside the selected comparison windows/);
});

test('changing month and year changes every checkpoint and chooses the register by comparison year', () => {
  const data = history('A', -12, 42);
  for (const basis of ['monthly', 'ytd', 'ltm']) {
    for (const month of [1, 4, 7]) {
      const m = compare(data, { basis, month, year: 2027, now: new Date(2027, 8, 17), registry: [registered('A', { fy25: 'new', ltm: 'l4l' })] });
      assert.deepEqual(m.periods.map(p => p.end), [2025, 2026, 2027].map(y => y * 12 + month - 1));
      assert.equal(classified(m, 'previous', 'A').cohort, 'l4l');
      assert.match(classified(m, 'previous', 'A').reason, /Workbook J2/);
      assert.equal(classified(m, 'current', 'A').cohort, 'other');
    }
  }
});

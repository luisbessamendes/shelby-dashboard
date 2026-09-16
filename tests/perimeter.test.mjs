import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { storeMonth, filters } from './fixtures.mjs';

const require = createRequire(import.meta.url);
const { buildPerimeterComparison, buildPerimeterWaterfall, perimeterAxisDomain, perimeterValue, COHORTS } = require('../src/lib/perimeter.ts');
const { PNL_ROWS } = require('../src/lib/pnl-rows.ts');
const { aggregate } = require('../src/lib/calculations.ts');
const now = new Date(2026, 8, 16);
const row = id => PNL_ROWS.find(r => r.id === id);
const compare = (all, selection = {}, year = 2026, month = 7) => buildPerimeterComparison(all, filters(selection), year, month, now);
const portfolio = model => model.groups.find(group => group.id === 'portfolio');
const stageStores = (model, key) => model.stages.find(stage => stage.key === key).stores;
const classified = (model, key, name) => stageStores(model, key).find(store => store.name === name);
const idx = r => r.year * 12 + r.month - 1;
function history(name, start = 0, end = 30, overrides = {}) {
  return Array.from({ length: end - start + 1 }, (_, i) => {
    const n = i + start;
    return storeMonth({ store: name, code: name.toUpperCase(), year: 2024 + Math.floor(n / 12), month: n % 12 + 1, ...overrides });
  });
}
const zeroSales = { sales: 0, vat: 0, turnover: 0, tickets: 0, raw_materials: 0, staff: 0, rents: 20, utilities: 0, maintenance: 0, banking_costs: 0, others: 0, store_contribution: -20, admin_costs: 5, ebitda: -25, capex: 0, cit: 0, fcff: -25 };

test('FY 2025 checkpoint separates FY24-FY25 from FY25-LTM August 2025-July 2026', () => {
  const rows = history('A').map(r => ({ ...r, sales: r.year === 2024 ? 100 : r.year === 2025 && r.month < 8 ? 100000 : 200 }));
  const model = compare(rows);
  assert.equal(model.endpoint, 'LTM Jul 2026');
  assert.equal(classified(model, 'fy25', 'A').cohort, 'l4l');
  assert.equal(classified(model, 'ltm', 'A').cohort, 'l4l');
  assert.equal(perimeterValue(row('grossSales'), portfolio(model), 'baseline'), 1200);
  assert.equal(perimeterValue(row('grossSales'), portfolio(model), 'fy25'), 701000);
  assert.equal(perimeterValue(row('grossSales'), portfolio(model), 'current'), 2400);
  assert.equal(perimeterValue(row('grossSales'), portfolio(model), 'fy25:l4l'), 699800);
  assert.equal(perimeterValue(row('grossSales'), portfolio(model), 'ltm:l4l'), -698600);
  assert.equal(perimeterValue(row('grossSales'), portfolio(model), 'change'), 1200);
});

test('cohort amounts and both waterfalls reconcile, retaining opening and closure costs', () => {
  const data = [
    ...history('L4L'),
    ...history('New', 9, 9, { ...zeroSales, utilities: 30, store_contribution: -50, ebitda: -55, fcff: -55 }), ...history('New', 24, 30),
    ...history('Closed', 0, 26), ...history('Closed', 27, 30, zeroSales),
    ...history('Partial', 3, 30, { concept: 'Bifanas' }),
    ...history('Cost only', 24, 30, { ...zeroSales, concept: 'Bifanas' }),
  ];
  const model = compare(data);
  assert.deepEqual(Object.fromEntries(stageStores(model, 'fy25').map(s => [s.name, s.cohort])), { Closed: 'l4l', L4L: 'l4l', New: 'other', Partial: 'other' });
  assert.deepEqual(Object.fromEntries(stageStores(model, 'ltm').map(s => [s.name, s.cohort])), { Closed: 'closed', L4L: 'l4l', New: 'new', 'Cost only': 'other', Partial: 'l4l' });
  const total = portfolio(model);
  for (const definition of PNL_ROWS.filter(r => r.format !== 'percent' && r.id !== 'avgTicket')) {
    for (const group of model.groups) {
      for (const [stage, from, to] of [['fy25', 'baseline', 'fy25'], ['ltm', 'fy25', 'current']]) {
        const changes = COHORTS.reduce((sum, cohort) => sum + perimeterValue(definition, group, `${stage}:${cohort.key}`), 0);
        assert.ok(Math.abs(perimeterValue(definition, group, from) + changes - perimeterValue(definition, group, to)) < 1e-8, `${stage} ${definition.id} ${group.label}`);
      }
    }
    assert.equal(perimeterValue(definition, total, 'fy25'), definition.value(aggregate(data.filter(r => r.year === 2025))));
    assert.equal(perimeterValue(definition, total, 'current'), definition.value(aggregate(data.filter(r => idx(r) >= 2025 * 12 + 7))));
  }
  assert.equal(perimeterValue(row('leases'), total, 'fy25:other'), -280); // Partial-year annualisation and reversed FY24 pre-opening cost.
  assert.equal(perimeterValue(row('leases'), total, 'ltm:new'), -700);
  assert.equal(perimeterValue(row('storeEbitdar'), total, 'ltm:new'), 7 * 380);
  for (const id of ['grossSales', 'storeEbitdar']) {
    const steps = buildPerimeterWaterfall(model, row(id));
    assert.equal(steps.length, 19);
    const checkpoint = steps.findIndex(step => step.id === 'fy25');
    assert.equal(checkpoint, 9);
    assert.equal(steps[checkpoint].value, perimeterValue(row(id), total, 'fy25'));
    assert.equal(steps[0].value + steps.filter(step => !step.total).reduce((sum, step) => sum + step.value, 0), steps.at(-1).value);
    for (let i = 1; i < steps.length; i++) {
      if (steps[i].total) assert.equal(steps[i].value, steps[i - 1].end);
      else assert.equal(steps[i].start, steps[i - 1].end);
    }
  }
});

test('ratios use weighted Turnover, Average Ticket uses gross Sales, neither has cohort impacts', () => {
  const data = [...history('A'), ...history('B', 0, 30, { turnover: 2000, sales: 2400, tickets: 50, staff: 1000 })];
  const group = portfolio(compare(data));
  assert.equal(perimeterValue(row('staffCostPct'), group, 'current'), 1250 / 3000);
  assert.equal(perimeterValue(row('staffCostPct'), group, 'fy25'), 1250 / 3000);
  assert.equal(perimeterValue(row('avgTicket'), group, 'current'), 3600 / 150);
  for (const definition of [row('staffCostPct'), row('avgTicket')]) {
    for (const stage of ['fy25', 'ltm']) for (const cohort of COHORTS) assert.equal(perimeterValue(definition, group, `${stage}:${cohort.key}`), null);
    assert.equal(perimeterValue(definition, group, 'change'), 0);
  }
  const more = compare(data.map(r => ({ ...r, staff: r.year > 2024 ? r.staff * 2 : r.staff })));
  assert.equal(perimeterValue(row('staffCostPct'), portfolio(more), 'change'), 1250 / 3000);
});

test('missing reports never establish closure; reported zero-sales tails are only inferred closures', () => {
  const data = [...history('Complete'), ...history('Missing', 0, 11), ...history('Zero tail', 0, 26), ...history('Zero tail', 27, 30, zeroSales)];
  const model = compare(data);
  assert.equal(classified(model, 'fy25', 'Missing').cohort, 'other');
  assert.equal(classified(model, 'ltm', 'Missing'), undefined);
  assert.equal(classified(model, 'ltm', 'Zero tail').cohort, 'closed');
  assert.match(classified(model, 'ltm', 'Zero tail').reason, /Not a confirmed closure/);
  const interrupted = data.map(r => r.store === 'Zero tail' && r.year === 2025 && r.month === 2 ? { ...r, ...zeroSales } : r);
  assert.equal(classified(compare(interrupted), 'ltm', 'Zero tail').cohort, 'other');
});

test('partial baseline, intermittent trading, reopenings and cost-only histories are Other', () => {
  const data = [...history('Good'), ...history('Partial', 2), ...history('Missing').filter(r => !(r.year === 2025 && r.month === 2)),
    ...history('Restart').map(r => r.year === 2025 && r.month === 2 ? { ...r, ...zeroSales } : r), ...history('Costs', 24, 30, zeroSales)];
  const model = compare(data);
  assert.equal(classified(model, 'fy25', 'Good').cohort, 'l4l');
  for (const name of ['Partial', 'Missing', 'Restart']) assert.equal(classified(model, 'fy25', name).cohort, 'other');
  assert.equal(classified(model, 'ltm', 'Partial').cohort, 'l4l');
  for (const name of ['Missing', 'Restart', 'Costs']) assert.equal(classified(model, 'ltm', name).cohort, 'other');
});

test('new 2025 store is New in first stage, then Other for partial FY25 and later exit', () => {
  const model = compare([...history('Good'), ...history('New', 15, 25), ...history('New', 26, 30, zeroSales)]);
  assert.equal(classified(model, 'fy25', 'New').cohort, 'new');
  assert.equal(classified(model, 'ltm', 'New').cohort, 'other');
  assert.equal(perimeterValue(row('grossSales'), portfolio(model), 'fy25:new'), 9 * 1200);
  assert.equal(perimeterValue(row('leases'), portfolio(model), 'ltm:other'), -(7 * 100 + 5 * 20) + 9 * 100);
});

test('classification uses full history before every dimension filter and multiple selections', () => {
  const data = [...history('A'), ...history('B', 24, 30, { concept: 'Bifanas', region: 'Porto', location: 'Street', legal_entity: 'B', store_type: 'High Street' })];
  for (const [field, key] of [['store', 'stores'], ['concept', 'concepts'], ['region', 'regions'], ['location', 'locations'], ['legal_entity', 'legalEntities'], ['store_type', 'storeTypes']]) {
    const model = compare(data, { [key]: [data.at(-1)[field]] });
    assert.equal(model.stores.length, 1);
    assert.equal(classified(model, 'ltm', 'B').cohort, 'new');
    assert.equal(perimeterValue(row('grossSales'), portfolio(model), 'baseline'), 0);
    assert.equal(perimeterValue(row('grossSales'), portfolio(model), 'current'), 8400);
  }
  assert.equal(compare(data).stores.length, 2);
  const changed = history('Changed').map(r => r.year === 2024 ? r : { ...r, concept: 'Bifanas', region: 'Porto' });
  const all = [...history('Good'), ...changed];
  const filtered = compare(all, { concepts: ['Bifanas'] });
  assert.equal(classified(filtered, 'fy25', 'Changed').cohort, 'other');
  assert.equal(classified(filtered, 'ltm', 'Changed').cohort, 'l4l');
  assert.equal(perimeterValue(row('grossSales'), portfolio(filtered), 'fy25:other'), 14400);
});

test('coverage drop is provisional and suppresses closure across the gap', () => {
  const data = [...history('A'), ...history('B'), ...history('C'), ...history('Closed', 0, 26), ...history('Closed', 27, 30, zeroSales)]
    .filter(r => !(r.year === 2026 && r.month === 7 && ['B', 'C'].includes(r.store)));
  const model = compare(data);
  assert.equal(model.provisional, true);
  assert.match(model.notices.join(' '), /2026-07/);
  assert.equal(classified(model, 'ltm', 'Closed').cohort, 'other');
});

test('missing full calendar months are unavailable, not silently zero or balanced', () => {
  const data = history('A').filter(r => !(r.year === 2026 && r.month === 2));
  const model = compare(data);
  assert.equal(perimeterValue(row('grossSales'), portfolio(model), 'current'), null);
  assert.equal(perimeterValue(row('grossSales'), portfolio(model), 'change'), null);
  assert.deepEqual(buildPerimeterWaterfall(model, row('grossSales')), []);
  assert.equal(perimeterValue(row('grossSales'), portfolio(model), 'baseline'), 14400);
});

test('null amounts and zero-denominator ratios stay unavailable, genuine zero amounts remain zero', () => {
  const data = history('A').map(r => ({ ...r, sales: 0, tickets: 0, turnover: 0, staff: r.year === 2026 && r.month === 7 ? null : 0 }));
  const model = compare(data);
  const group = portfolio(model);
  assert.equal(perimeterValue(row('staffCost'), group, 'current'), null);
  assert.equal(perimeterValue(row('grossSales'), group, 'current'), 0);
  assert.equal(perimeterValue(row('staffCostPct'), group, 'current'), null);
  assert.equal(perimeterValue(row('avgTicket'), group, 'current'), null);
});

test('future endpoints, pre-baseline endpoints and empty selections are blocked without substitution', () => {
  const rows = history('A');
  assert.match(compare(rows, {}, 2026, 12).blocked, /future/);
  assert.match(compare(rows, {}, 2024, 11).blocked, /2026 or later/);
  assert.match(compare(rows, {}, 2025, 12).blocked, /2026 or later/);
  assert.match(compare(rows, { stores: ['Not present'] }).blocked, /No records/);
  assert.equal(compare(rows, {}, 2026, 9).provisional, true);
});

test('code identity permits store renames, ambiguous duplicates remain Other and source warnings persist', () => {
  const renamed = history('A').map(r => r.year === 2024 ? r : { ...r, store: 'Renamed' });
  assert.equal(compare(renamed).stores.length, 1);
  assert.equal(classified(compare(renamed), 'fy25', 'Renamed').cohort, 'l4l');
  const renamedSelection = compare(renamed, { stores: ['Renamed'] });
  assert.equal(perimeterValue(row('grossSales'), portfolio(renamedSelection), 'baseline'), 14400);
  assert.equal(perimeterValue(row('grossSales'), portfolio(renamedSelection), 'fy25:l4l'), 0);
  const duplicate = [...renamed, renamed[0]];
  assert.equal(classified(compare(duplicate), 'fy25', 'Renamed').cohort, 'other');
  const recoded = history('A').map(r => r.year === 2024 ? r : { ...r, code: 'CHANGED' });
  assert.ok(compare(recoded).stages.every(stage => stage.stores.every(s => s.cohort === 'other')));
  const inconsistent = history('A').map(r => ({ ...r, store_contribution: -500, ebitda: -550 }));
  const model = compare(inconsistent);
  assert.ok(model.reconciliationIssues.length > 0);
  const steps = buildPerimeterWaterfall(model, row('storeEbitdar'));
  assert.equal(steps[0].value, -4800);
  assert.deepEqual(steps[0].range, [-4800, 0]);
  assert.equal(steps.at(-1).value, -4800);
});

test('a missing prior month does not disable median coverage checks or permit inferred closures', () => {
  const records = Array.from({ length: 10 }, (_, i) => history(`S${i}`)).flat()
    .filter(r => !(r.year === 2026 && r.month === 4))
    .filter(r => !(r.year === 2026 && r.month === 7 && Number(r.store.slice(1)) >= 5))
    .map(r => r.store === 'S0' && r.year === 2026 && r.month >= 5 ? { ...r, ...zeroSales } : r);
  const model = compare(records);
  assert.match(model.notices.join(' '), /2026-07/);
  assert.equal(classified(model, 'ltm', 'S0').cohort, 'other');
});

test('renamed stores retain history across inactive dimension changes without leaking across active filters', () => {
  for (const [field, key] of [['concept', 'concepts'], ['region', 'regions'], ['location', 'locations'], ['legal_entity', 'legalEntities'], ['store_type', 'storeTypes']]) {
    const renamed = history('A').map(r => r.year === 2024 ? r : { ...r, store: 'Renamed', [field]: 'New value' });
    const currentNameOnly = compare(renamed, { stores: ['Renamed'] });
    assert.equal(perimeterValue(row('grossSales'), portfolio(currentNameOnly), 'baseline'), 14400, field);
    assert.equal(perimeterValue(row('grossSales'), portfolio(currentNameOnly), 'fy25:other'), 0, field);
    const activeNew = compare(renamed, { stores: ['Renamed'], [key]: ['New value'] });
    assert.equal(perimeterValue(row('grossSales'), portfolio(activeNew), 'baseline'), 0, field);
    assert.equal(perimeterValue(row('grossSales'), portfolio(activeNew), 'fy25:other'), 14400, field);
    const activeOld = compare(renamed, { stores: ['Renamed'], [key]: [renamed[0][field]] });
    assert.equal(perimeterValue(row('grossSales'), portfolio(activeOld), 'baseline'), 14400, field);
    assert.equal(perimeterValue(row('grossSales'), portfolio(activeOld), 'current'), 0, field);
  }
});

test('temporary interruptions stay Other, including year-end closures followed by reopening', () => {
  const data = [...history('Good'), ...history('Year end').map(r => r.year === 2025 && r.month >= 10 ? { ...r, ...zeroSales } : r),
    ...history('Renovation unknown').map(r => r.year === 2025 && r.month === 6 ? { ...r, ...zeroSales } : r),
    ...history('Old interruption').map(r => r.year === 2024 && r.month === 6 ? { ...r, ...zeroSales } : r)];
  const model = compare(data);
  for (const name of ['Year end', 'Renovation unknown']) {
    assert.equal(classified(model, 'fy25', name).cohort, 'other');
    assert.equal(classified(model, 'ltm', name).cohort, 'other');
  }
  assert.match(classified(model, 'fy25', 'Year end').reason, /resumed later/);
  assert.equal(classified(model, 'fy25', 'Old interruption').cohort, 'other');
  assert.equal(classified(model, 'ltm', 'Old interruption').cohort, 'l4l');
});

test('known reopening keeps FY25 classification stable when selecting an endpoint before reopening', () => {
  const data = [...history('Good'), ...history('Reopened').map(r => (r.year === 2025 && r.month >= 10) || (r.year === 2026 && r.month <= 3) ? { ...r, ...zeroSales } : r)];
  for (const month of [3, 7]) {
    const model = compare(data, {}, 2026, month);
    assert.equal(classified(model, 'fy25', 'Reopened').cohort, 'other');
    assert.equal(classified(model, 'ltm', 'Reopened').cohort, 'other');
  }
});

test('a selected-store reporting gap is flagged even when portfolio coverage is above 80 percent', () => {
  const data = [...Array.from({ length: 5 }, (_, i) => history(`Good${i}`)).flat(), ...history('Missing', 0, 23)];
  const model = compare(data, { stores: ['Missing'] });
  assert.equal(model.provisional, true);
  assert.match(model.notices.join(' '), /Reporting gaps affect 1 selected store/);
  assert.equal(perimeterValue(row('grossSales'), portfolio(model), 'current'), 5 * 1200);
  assert.equal(classified(model, 'ltm', 'Missing').cohort, 'other');
});

test('each stage reclassifies new stores, including full and partial baseline annualisation', () => {
  const model = compare([...history('Good'), ...history('January25', 12), ...history('April25', 15), ...history('March26', 26)]);
  assert.equal(classified(model, 'fy25', 'January25').cohort, 'new');
  assert.equal(classified(model, 'ltm', 'January25').cohort, 'l4l');
  assert.equal(classified(model, 'fy25', 'April25').cohort, 'new');
  assert.equal(classified(model, 'ltm', 'April25').cohort, 'other');
  assert.equal(classified(model, 'fy25', 'March26'), undefined);
  assert.equal(classified(model, 'ltm', 'March26').cohort, 'new');
});

test('FY25 closure remains first-stage Closed, residual cost changes stay Other in next stage', () => {
  const model = compare([...history('Good'), ...history('Closed25', 0, 18), ...history('Closed25', 19, 30, zeroSales)]);
  assert.equal(classified(model, 'fy25', 'Closed25').cohort, 'closed');
  assert.equal(classified(model, 'ltm', 'Closed25').cohort, 'other');
  assert.equal(perimeterValue(row('grossSales'), portfolio(model), 'fy25:closed'), -5 * 1200);
  assert.equal(perimeterValue(row('grossSales'), portfolio(model), 'ltm:other'), -7 * 1200);
});

test('a missing FY25 month invalidates the checkpoint and both stages, even outside selected LTM', () => {
  const model = compare(history('A').filter(r => !(r.year === 2025 && r.month === 2)));
  const group = portfolio(model);
  assert.equal(perimeterValue(row('grossSales'), group, 'fy25'), null);
  assert.equal(perimeterValue(row('grossSales'), group, 'current'), 14400);
  for (const stage of ['fy25', 'ltm']) for (const cohort of COHORTS) assert.equal(perimeterValue(row('grossSales'), group, `${stage}:${cohort.key}`), null);
  assert.deepEqual(buildPerimeterWaterfall(model, row('grossSales')), []);
  assert.match(model.notices.join(' '), /FY 2025.*missing/);
});

test('zoom fits all running balances, excludes artificial zero, full scale includes zero', () => {
  const model = compare(history('A').map(r => ({ ...r, sales: r.year === 2024 ? 1000 : r.year === 2025 ? 1100 : 1200 })));
  const steps = buildPerimeterWaterfall(model, row('grossSales'));
  const zoom = perimeterAxisDomain(steps);
  assert.ok(zoom[0] > 0);
  for (const step of steps) for (const balance of step.total ? [step.value] : [step.start, step.end]) assert.ok(balance > zoom[0] && balance < zoom[1]);
  assert.equal(perimeterAxisDomain(steps, true)[0], 0);
  assert.deepEqual(steps.filter(step => step.total).map(step => step.label), ['FY 2024', 'FY 2025', 'LTM Jul 2026']);
  assert.deepEqual([...new Set(steps.filter(step => !step.total).map(step => step.stageLabel))], ['FY 2024 to FY 2025', 'FY 2025 to LTM Jul 2026']);
});

test('axis supports negative totals, zero crossing, constant balances and empty series', () => {
  const negative = buildPerimeterWaterfall(compare(history('A', 0, 30, { store_contribution: -500, rents: 100 })), row('storeEbitdar'));
  assert.ok(perimeterAxisDomain(negative)[1] < 0);
  assert.equal(perimeterAxisDomain(negative, true)[1], 0);
  const crossing = buildPerimeterWaterfall(compare(history('A').map(r => ({ ...r, store_contribution: r.year === 2024 ? -500 : 500, rents: 0 }))), row('storeEbitdar'));
  assert.ok(perimeterAxisDomain(crossing)[0] < 0 && perimeterAxisDomain(crossing)[1] > 0);
  const zero = buildPerimeterWaterfall(compare(history('A', 0, 30, zeroSales)), row('grossSales'));
  assert.ok(perimeterAxisDomain(zero)[0] < 0 && perimeterAxisDomain(zero)[1] > 0);
  assert.deepEqual(perimeterAxisDomain([]), [0, 1]);
});

test('waterfall change percentages use each concept/cohort baseline independently for both stages', () => {
  const data = [
    ...history('A', 0, 30, { concept: 'A' }).map(r => ({ ...r,
      sales: r.year === 2024 ? 1000 : r.year === 2025 ? 1100 : 1210,
      store_contribution: r.year === 2024 ? 100 : r.year === 2025 ? 140 : 188,
    })),
    ...history('B', 0, 30, { concept: 'B', sales: 10000 }),
    ...history('New', 24, 30, { concept: 'A' }),
  ];
  const model = compare(data);
  for (const [id, pct] of [['grossSales', 0.1], ['storeEbitdar', 0.2]]) {
    const steps = buildPerimeterWaterfall(model, row(id));
    assert.ok(Math.abs(steps.find(s => s.id === 'fy25:concept:A:l4l').changePct - pct) < 1e-12);
    assert.ok(Math.abs(steps.find(s => s.id === 'ltm:concept:A:l4l').changePct - pct * 7 / 12) < 1e-12);
    assert.equal(steps.find(s => s.id === 'ltm:concept:B:l4l').changePct, 0);
    assert.equal(steps.find(s => s.id === 'ltm:concept:A:new').changePct, null);
    assert.ok(steps.filter(s => s.total).every(s => s.changePct === null));
  }
});

test('waterfall change percentages preserve declines and improvement from negative profit bases', () => {
  const records = history('A').map(r => ({ ...r,
    sales: r.year === 2024 ? 1200 : 900,
    store_contribution: r.year === 2024 ? -500 : -300,
  }));
  const model = compare(records);
  assert.equal(buildPerimeterWaterfall(model, row('grossSales')).find(s => s.id.endsWith(':l4l')).changePct, -0.25);
  assert.equal(buildPerimeterWaterfall(model, row('storeEbitdar')).find(s => s.id.endsWith(':l4l')).changePct, 0.5);
});

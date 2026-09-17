import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { filters } from './fixtures.mjs';

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const { buildPerimeterComparison, buildPerimeterWaterfall, perimeterValue, COHORTS } = require('../src/lib/perimeter.ts');
const { PERIMETER_REGISTRY, PERIMETER_REGISTRY_SOURCE, normalizePerimeterCode } = require('../src/lib/perimeter-registry.ts');
const { PNL_ROWS } = require('../src/lib/pnl-rows.ts');
const { aggregate } = require('../src/lib/calculations.ts');

if (process.env.PERIMETER_WORKBOOK) {
  const XLSX = require('xlsx');
  const bytes = readFileSync(process.env.PERIMETER_WORKBOOK);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), PERIMETER_REGISTRY_SOURCE.sha256, 'Workbook changed since registry extraction');
  const workbook = XLSX.read(bytes, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[PERIMETER_REGISTRY_SOURCE.sheet], { defval: null });
  assert.equal(rows.length, PERIMETER_REGISTRY.length);
  const status = { L4L: 'l4l', Opening: 'new', Closed: 'closed', Renovation: 'renovation' };
  for (const entry of PERIMETER_REGISTRY) {
    const source = rows[entry.sourceRow - 2];
    assert.equal(entry.code, source.CODE);
    assert.equal(entry.store, source.Store);
    assert.equal(entry.fy25, status[source['Status Bridge 2024 > 2025']] ?? null);
    assert.equal(entry.ltm, status[source['Status Bridge 2025 > 2026']] ?? null);
    assert.equal(entry.note ?? null, source['Status 2']);
  }
  console.log('Workbook provenance and all 112 per-store classifications match.');
}

// Deliberately read-only: financial records are never edited by this audit.
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const data = [];
for (let offset = 0; ; offset += 1000) {
  const result = await client.from('fact_store_month').select('*').order('id').range(offset, offset + 999);
  if (result.error) throw result.error;
  data.push(...result.data);
  if (result.data.length < 1000) break;
}
const codes = new Set(data.map(r => normalizePerimeterCode(r.code ?? '')));
const registeredCodes = new Set(PERIMETER_REGISTRY.map(r => normalizePerimeterCode(r.code)));
assert.deepEqual([...codes].filter(code => !registeredCodes.has(code)), [], 'Uploaded codes without registry match');
const idx = r => r.year * 12 + r.month - 1;
const nearly = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, message);
const amountRows = PNL_ROWS.filter(r => r.format !== 'percent' && r.id !== 'avgTicket');
for (const month of [1, 3, 5, 7, 8]) {
  const model = buildPerimeterComparison(data, filters(), 2026, month, new Date(2026, 8, 17));
  assert.equal(model.blocked, null);
  for (const group of model.groups) {
    const records = data.filter(r => group.id === 'portfolio' || r.concept === group.label);
    for (const [column, start, end] of [['baseline', 2024 * 12, 2024 * 12 + 11], ['fy25', 2025 * 12, 2025 * 12 + 11], ['current', 2026 * 12 + month - 12, 2026 * 12 + month - 1]]) {
      const total = aggregate(records.filter(r => idx(r) >= start && idx(r) <= end));
      for (const row of amountRows) nearly(perimeterValue(row, group, column), row.value(total), `${month}: ${group.label} ${column} ${row.id}`);
    }
    for (const row of amountRows) for (const [stage, from, to] of [['fy25', 'baseline', 'fy25'], ['ltm', 'fy25', 'current']]) {
      const movements = COHORTS.reduce((sum, cohort) => sum + perimeterValue(row, group, `${stage}:${cohort.key}`), 0);
      nearly(perimeterValue(row, group, from) + movements, perimeterValue(row, group, to), `${month}: ${group.label} ${stage} ${row.id}`);
    }
  }
  for (const metric of ['grossSales', 'storeEbitdar']) {
    const steps = buildPerimeterWaterfall(model, PNL_ROWS.find(r => r.id === metric));
    for (let i = 1; i < steps.length; i++) nearly(steps[i].total ? steps[i].value : steps[i].start, steps[i - 1].end, `Waterfall ${metric} ${steps[i].id}`);
  }
  if (month === 7) console.log(JSON.stringify({ rows: data.length, matchedCodes: codes.size, endpoint: model.endpoint, stages: model.stages.map(s => ({ label: s.label, counts: s.stores.reduce((counts, r) => ({ ...counts, [r.cohort]: (counts[r.cohort] ?? 0) + 1 }), {}) })), notices: model.notices }, null, 2));
}
console.log('Live-data audit passed for five LTM endpoints: every P&L amount and both waterfalls reconcile, no financial rows changed.');

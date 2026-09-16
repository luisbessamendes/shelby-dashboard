import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { uploadRow } from './fixtures.mjs';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const { parseExcelFile } = require('../src/lib/excel-parser.ts');

function parse(rows) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Shelby');
  return parseExcelFile(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

test('legacy template and removed VAT % remain supported', () => {
  const row = uploadRow();
  delete row.Turnover;
  row['VAT %'] = 12345;
  const result = parse([row]);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.records[0].turnover, 1000);
  assert.equal(result.records[0].store_contribution, 280);
});

test('new names map to existing database columns; derived subtotals are not persisted', () => {
  const row = uploadRow();
  for (const [oldName, newName] of [['Sales', 'Gross Sales'], ['Tickets', '# Tickets'], ['Raw Materials', 'Food Cost'], ['Staff', 'Staff Cost'], ['Rents', 'Leases'], ['Store Contribution', 'Store EBITDA'], ['Admin. Costs', 'Headquarter & Admin.']]) {
    row[newName] = row[oldName];
    delete row[oldName];
  }
  Object.assign(row, { 'Store EBITDAR': 380, 'Prime Cost': 550, 'Store EBITDAR %': 0.38, 'Store EBITDA %': 0.28, 'Headquarter & Admin.2': 0.05 });
  const result = parse([row]);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.records[0].store_contribution, 280);
  assert.equal(result.records[0].admin_costs, 50);
  assert.equal('store_ebitdar' in result.records[0], false);
  assert.equal('prime_cost' in result.records[0], false);
});

test('conflicting old and new aliases reject the row', () => {
  const result = parse([{ ...uploadRow(), 'Store EBITDA': 300 }]);
  assert.equal(result.records.length, 0);
  assert.match(result.errors.join(' '), /Conflicting/);
});

test('supplied inconsistent subtotals and genuine zero Turnover are preserved with warnings', () => {
  const result = parse([{ ...uploadRow(), 'Store Contribution': 0, EBITDA: 100, Turnover: 0, 'Store EBITDAR': 50 }]);
  assert.equal(result.records[0].turnover, 0);
  assert.equal(result.records[0].store_contribution, 0);
  assert.equal(result.records[0].ebitda, 100);
  assert.ok(result.warnings.length >= 3);
});

test('absent store subtotal can be derived from supplied EBITDAR; HQ from EBITDA', () => {
  const row = { ...uploadRow(), 'Store EBITDAR': 380 };
  delete row['Store Contribution'];
  delete row['Admin. Costs'];
  const result = parse([row]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.records[0].store_contribution, 280);
  assert.equal(result.records[0].admin_costs, 50);
});

test('invalid numbers are errors instead of being silently converted to zero', () => {
  const result = parse([{ ...uploadRow(), Staff: 'broken formula' }]);
  assert.equal(result.records.length, 0);
  assert.match(result.errors[0], /Invalid number/);
});

test('negative cost credits are flagged, not silently sign-flipped', () => {
  const result = parse([{ ...uploadRow(), Rents: -10 }]);
  assert.equal(result.records[0].rents, -10);
  assert.ok(result.warnings.some(message => message.includes('credit')));
});

test('numeric month works and the upload key remains store/year/month', () => {
  const result = parse([{ ...uploadRow(), Month: 4 }, { ...uploadRow(), Month: 4, Code: 'NEW_CODE', Sales: 1400 }]);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].code, 'NEW_CODE');
  assert.equal(result.records[0].sales, 1400);
});

test('the labels-only P&L reference is not a flat monthly upload template', () => {
  const result = parse([{ 'P&L': 'Store EBITDAR' }, { 'P&L': 'Leases' }]);
  assert.equal(result.records.length, 0);
  assert.match(result.errors[0], /Missing required columns/);
});

test('a P&L without cash-flow columns cannot overwrite existing investments or FCFF', () => {
  const row = uploadRow();
  delete row.CAPEX;
  delete row.CIT;
  delete row.FCFF;
  const result = parse([row]);
  assert.equal(result.records.length, 0);
  assert.match(result.errors[0], /capex, cit, fcff/);
  const missingFcff = parse([{ ...uploadRow(), FCFF: null }]);
  assert.equal(missingFcff.records.length, 0);
  assert.match(missingFcff.errors.join(' '), /FCFF is missing/);
});

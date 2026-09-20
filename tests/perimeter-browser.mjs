import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import './register-typescript.mjs';
import { filters, storeMonth } from './fixtures.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const { buildPerimeterComparison, buildPerimeterWaterfall } = require('../src/lib/perimeter.ts');
const { PNL_ROWS } = require('../src/lib/pnl-rows.ts');
const output = path.resolve('outputs/perimeter-qa');
await mkdir(output, { recursive: true });
const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3001';
function history(name, code, concept, start = -5, end = 30, more = {}) {
  return Array.from({ length: end - start + 1 }, (_, i) => storeMonth({ store: name, code, concept,
    year: 2024 + Math.floor((start + i) / 12), month: (((start + i) % 12) + 12) % 12 + 1, ...more }));
}
function zeroSales(record) {
  // Retain every cost and reconcile the source subtotals after removing revenue.
  return { ...record, sales: 0, tickets: 0, avg_ticket: 0, turnover: 0, vat: 0,
    store_contribution: record.store_contribution - record.turnover,
    ebitda: record.ebitda - record.turnover, fcff: record.fcff - record.turnover };
}
const data = [
  ...history('Alentejo A', 'ALEN_SM_ALEG_ALFR_C2', 'Alentejo'),
  ...history('Alentejo B', 'ALEN_SM_ALMA_COIM_C48', 'Alentejo', -5, 30, { location: 'Mall B', legal_entity: 'Entity B' }),
  ...history('Bifanas New', 'ITRE_HS_::_BRAG_C25', 'Bifanas', 21, 30, { region: 'Porto', location: 'Street', legal_entity: 'Entity C', store_type: 'High Street' }),
  ...history('Bifanas Closed', 'BIFA_SM_SHOP_LOUR_C6', 'Bifanas').map(r => r.year === 2026 ? zeroSales(r) : r),
  ...history('Coffee Partial', 'KIO1_SM_SHOP_CASC_C27', 'Coffee Shop', 3),
  ...history('Alentejo Renovation', 'ALEN_SM_COLO_LISB_C6', 'Alentejo')
    .map(r => (r.year === 2024 && r.month >= 4) || (r.year === 2025 && r.month <= 8) ? zeroSales(r) : r),
];
const model = buildPerimeterComparison(data, filters(), 'ytd', 2026, 7);
assert.equal(model.blocked, null);
assert.deepEqual(model.reconciliationIssues, []);
const currency = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
let suppliedData = data;
const errors = [];
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
await context.route('**/rest/v1/**', async route => {
  if (route.request().method() !== 'GET') await route.abort();
  assert.equal(route.request().method(), 'GET', 'No database writes allowed in browser tests');
  assert.equal(new URL(route.request().url()).pathname, '/rest/v1/fact_store_month', 'Only monthly financial records are mocked');
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify(suppliedData) });
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(`${baseUrl}/segments`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Segment Analysis' }).waitFor();
  await page.waitForFunction(() => document.querySelector('.filter-bar select')?.value === '2026');
  const dimension = page.getByRole('combobox', { name: 'Dimension' });
  await page.getByRole('button', { name: 'YTD', exact: true }).click();
  await dimension.selectOption('perimeter');
  await page.locator('.pnl-table').waitFor();
  assert.equal(await page.getByRole('combobox', { name: 'Profit Measure' }).count(), 0);
  assert.equal(await page.locator('.pnl-row-label').count(), 29);
  assert.equal(await page.getByRole('heading', { level: 2 }).count(), 2);
  assert.equal(await page.getByRole('heading', { name: 'Gross Sales Bridge' }).count(), 1);
  assert.equal(await page.getByRole('heading', { name: 'Store EBITDAR Bridge' }).count(), 1);
  const groupLabels = ['Alentejo', 'Bifanas', 'Coffee Shop', 'Portfolio Total'];
  const impactLabels = ['L4L Change', 'Opening Impact', 'Closed Impact', 'Renovation Impact', 'Other Impact'];
  const columnLabels = ['YTD Jul 2024', ...impactLabels.map(label => `${label} YTD Jul 25`), 'YTD Jul 2025',
    ...impactLabels.map(label => `${label} YTD Jul 26`), 'YTD Jul 2026', 'Total Change'];
  assert.deepEqual(await page.locator('.pnl-group-header').allTextContents(), groupLabels);
  assert.deepEqual(await page.locator('.pnl-group-header').evaluateAll(headers => headers.map(header => header.colSpan)), [14, 14, 14, 14]);
  assert.deepEqual(await page.locator('.pnl-period-header').allTextContents(), groupLabels.flatMap(() => columnLabels));
  const values = page.locator('tr').filter({ has: page.getByRole('rowheader', { name: 'Gross Sales', exact: true }) }).locator('td');
  assert.equal(await values.count(), 56);
  const portfolioValues = async cells => (await cells.allTextContents()).slice(groupLabels.indexOf('Portfolio Total') * columnLabels.length);
  // EUR 1,200 sales / EUR 380 EBITDAR per trading month; non-trading costs remain EUR 620 before rent.
  const expectedSales = [33600, 0, 3600, 0, -3600, 0, 33600, 0, 8400, -8400, 8400, 0, 42000, 8400].map(currency);
  assert.deepEqual(await portfolioValues(values), expectedSales);
  const ebitdarValues = page.locator('tr').filter({ has: page.getByRole('rowheader', { name: 'Store EBITDAR', exact: true }) }).locator('td');
  assert.deepEqual(await portfolioValues(ebitdarValues), [8160, 0, 1140, 0, -3000, 0, 6300, 0, 2660, -7000, 7000, 0, 8960, 800].map(currency));
  assert.equal(await page.getByRole('columnheader', { name: 'YTD Jul 2025', exact: true }).count(), 4);
  for (const [mode, checkpoints] of [['Monthly', [4800, 4800, 6000]], ['LTM', [57600, 57600, 74400]], ['YTD', [33600, 33600, 42000]]]) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    const prefix = mode === 'Monthly' ? '' : `${mode} `;
    await page.waitForFunction(label => document.querySelector('.pnl-period-header')?.textContent === label, `${prefix}Jul 2024`);
    const actual = await portfolioValues(values);
    assert.deepEqual([actual[0], actual[6], actual[12]], checkpoints.map(currency));
    for (const chart of await page.locator('section[aria-label$="Bridge"]').all()) {
      const labels = await chart.locator('.recharts-xAxis-tick-labels').textContent();
      for (const year of [2024, 2025, 2026]) assert.ok(labels.includes(`${prefix}Jul ${year}`));
    }
  }
  await page.locator('.filter-bar select').nth(1).selectOption('6');
  await page.waitForFunction(() => document.querySelector('.pnl-period-header')?.textContent === 'YTD Jun 2024');
  const june = await portfolioValues(values);
  assert.deepEqual([june[0], june[6], june[12]], [28800, 28800, 36000].map(currency));
  await page.locator('.filter-bar select').nth(1).selectOption('7');
  await page.waitForFunction(() => document.querySelector('.pnl-period-header')?.textContent === 'YTD Jul 2024');
  const cohortLabels = ['L4L', 'Openings / Annualisation', 'Closed Stores', 'Renovation', 'Other / Review'];
  for (const [stage, counts] of [['YTD Jul 2024 to YTD Jul 2025', [3, 1, 0, 1, 0]], ['YTD Jul 2025 to YTD Jul 2026', [3, 1, 1, 1, 0]]]) {
    const summary = page.getByRole('heading', { name: stage, exact: true }).locator('..');
    assert.deepEqual(await summary.locator('span').allTextContents(), cohortLabels.map((label, i) => `${label} ${counts[i]}`));
  }
  await page.getByText('Store classification (6)', { exact: true }).click();
  const audit = page.locator('details[open]').filter({ has: page.getByText('Store classification (6)', { exact: true }) });
  for (const [name, cohorts] of [
    ['Alentejo A', ['L4L', 'L4L']], ['Alentejo B', ['L4L', 'L4L']],
    ['Bifanas New', ['Openings / Annualisation']],
    ['Bifanas Closed', ['L4L', 'Closed Stores']], ['Coffee Partial', ['Openings / Annualisation', 'L4L']],
    ['Alentejo Renovation', ['Renovation', 'Renovation']],
  ]) {
    const row = audit.getByRole('row').filter({ has: page.getByRole('cell', { name, exact: true }) });
    assert.deepEqual(await row.locator('td strong').allTextContents(), cohorts, `${name}: both registry-backed stages`);
  }
  const openingAudit = audit.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Bifanas New', exact: true }) });
  for (const source of ['J60']) assert.match(await openingAudit.innerText(), new RegExp(`Workbook ${source}\\. Opening 2025-10`));
  assert.match(await audit.innerText(), /Confirmed closure 2026-01/);
  assert.match(await audit.innerText(), /Confirmed renovation 2024-04 to 2025-08/);
  assert.doesNotMatch(await audit.innerText(), /inferred|No unique matching classification/);
  await page.getByText('Store classification (6)', { exact: true }).click();

  const wrapper = page.getByRole('region', { name: 'Scrollable L4L P and L comparison table' });
  const metric = page.locator('.pnl-metric-header');
  const before = await metric.boundingBox();
  const title = await page.getByRole('heading', { level: 1 }).boundingBox();
  await wrapper.evaluate(el => { el.scrollLeft = el.scrollWidth; el.scrollTop = 620; });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const after = await metric.boundingBox();
  assert.ok(Math.abs(before.x - after.x) < 2);
  assert.ok(Math.abs(before.y - after.y) < 2);
  assert.equal((await page.getByRole('heading', { level: 1 }).boundingBox()).x, title.x);
  for (const header of [metric, page.locator('.pnl-group-header').last(), page.locator('.pnl-period-header').last()]) {
    assert.ok(await header.evaluate(el => {
      const r = el.getBoundingClientRect();
      const x = Math.min(innerWidth - 20, r.x + r.width / 2);
      return document.elementFromPoint(x, r.y + r.height / 2)?.closest('th') === el;
    }), 'Sticky header must be the visible top layer');
  }
  await page.screenshot({ path: path.join(output, 'table-scrolled-desktop.png') });
  await wrapper.evaluate(el => { el.scrollLeft = 0; el.scrollTop = 0; });
  await page.screenshot({ path: path.join(output, 'table-desktop.png') });

  for (const chart of await page.locator('section[aria-label$="Bridge"]').all()) {
    await chart.scrollIntoViewIfNeeded();
    const chartTitle = await chart.getAttribute('aria-label');
    const row = PNL_ROWS.find(row => `${row.label} Bridge` === chartTitle);
    assert.ok(row, `Known P&L row for ${chartTitle}`);
    const steps = buildPerimeterWaterfall(model, row);
    const showZero = chart.getByRole('checkbox', { name: 'Include zero on axis' });
    assert.equal(await showZero.isChecked(), false);
    const zoomNotice = chart.getByText('Zoomed axis: zero excluded; total bars truncated.', { exact: true });
    await zoomNotice.waitFor();
    const yLabels = chart.locator('.recharts-yAxis-tick-labels');
    const axisBefore = await yLabels.textContent();
    const ticks = chart.locator('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-label');
    assert.equal(await ticks.count(), steps.length);
    await showZero.check();
    await zoomNotice.waitFor({ state: 'hidden' });
    assert.notEqual(await yLabels.textContent(), axisBefore);
    assert.match(await yLabels.textContent(), /\u20ac0/);
    await showZero.uncheck();
    await zoomNotice.waitFor();
    assert.equal(await yLabels.textContent(), axisBefore);
    const bars = chart.locator('.recharts-bar-rectangle');
    assert.ok(await bars.evaluateAll(elements => elements.filter(el => {
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && el.querySelector('path')?.getAttribute('d');
    }).length >= 8), 'Three totals and five nonzero movements must render real shapes');
    // Use model IDs only to locate ticks, then find the painted bar at that X coordinate.
    // Zero movements do not render rectangles; zoom also clips totals at the plot boundary.
    const hoverStep = async id => {
      const index = steps.findIndex(step => step.id === id);
      assert.ok(index >= 0, `${chartTitle}: missing step ${id}`);
      const tick = ticks.nth(index);
      await tick.scrollIntoViewIfNeeded();
      const tickBox = await tick.boundingBox();
      assert.ok(tickBox, `${id}: visible axis label`);
      const bar = await bars.evaluateAll((elements, x) => {
        const box = elements.map(el => el.getBoundingClientRect())
          .find(box => box.width > 0 && box.height > 0 && Math.abs(box.x + box.width / 2 - x) < 2);
        return box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null;
      }, tickBox.x + tickBox.width / 2);
      assert.ok(bar, `${id}: nonblank bar aligned with its tick`);
      const plot = await chart.locator('.recharts-cartesian-grid').boundingBox();
      assert.ok(plot, 'Chart plot must be rendered');
      const top = Math.max(bar.y, plot.y);
      const bottom = Math.min(bar.y + bar.height, plot.y + plot.height);
      assert.ok(bottom > top, 'Bar must have a visible segment inside the plot');
      await page.mouse.move(bar.x + bar.width / 2, (top + bottom) / 2);
    };
    const tooltip = chart.locator('.recharts-tooltip-wrapper');
    const isSales = row.id === 'grossSales';
    const checks = [
      ['middle', 'YTD Jul 2025', isSales ? 33600 : 6300],
      ['previous:concept:Coffee Shop:new', 'Coffee Shop: Openings / Annualisation', isSales ? 3600 : 1140, '+75.0%'],
      ['current:concept:Bifanas:new', 'Bifanas: Openings / Annualisation', isSales ? 8400 : 2660, '\u2014'],
      ['previous:concept:Alentejo:renovation', 'Alentejo: Renovation', isSales ? -3600 : -3000, isSales ? '-100.0%' : '-223.9%'],
      ['current:concept:Alentejo:renovation', 'Alentejo: Renovation', isSales ? 8400 : 7000, isSales ? '\u2014' : '+161.3%'],
      ['current:concept:Bifanas:closed', 'Bifanas: Closed Stores', isSales ? -8400 : -7000, isSales ? '-100.0%' : '-263.2%'],
    ];
    for (const [id, label, amount, changePct] of checks) {
      await hoverStep(id);
      await tooltip.getByText(label, { exact: true }).waitFor({ state: 'visible' });
      const total = id === 'middle';
      await tooltip.getByText(`${total ? 'Total' : 'Change'}: ${currency(amount)}`, { exact: true }).waitFor({ state: 'visible' });
      if (!total) {
        await tooltip.getByText(id.startsWith('previous:') ? 'YTD Jul 2024 to YTD Jul 2025' : 'YTD Jul 2025 to YTD Jul 2026', { exact: true }).waitFor({ state: 'visible' });
        assert.ok((await tooltip.innerText()).includes(`Change %: ${changePct}`));
        assert.match(await tooltip.innerText(), /Running total:.*\u20ac/s);
      }
      await chart.screenshot({ path: path.join(output, `${chartTitle}-${id}`.replaceAll(/[: ]/g, '-') + '.png') });
    }
    await chart.getByRole('region', { name: /^Scrollable/ }).evaluate(el => { el.scrollLeft = 0; });
  }

  for (const [label, option, count] of [['Store', 'Alentejo A', 1], ['Concept', 'Alentejo', 3], ['Region', 'Porto', 1], ['Location', 'Mall B', 1], ['Legal Entity', 'Entity C', 1], ['Type', 'High Street', 1]]) {
    await page.getByRole('button', { name: 'Clear Filters' }).click();
    const group = page.locator('.filter-bar .filter-group').filter({ has: page.locator('.filter-label').getByText(label, { exact: true }) });
    await group.locator('.filter-select').click();
    await group.getByText(option, { exact: true }).click();
    await group.locator('.filter-select').click();
    await page.waitForFunction(n => document.querySelector('.pnl-table-summary')?.textContent.includes(`${n} stores`), count);
    assert.equal(await page.locator('.pnl-group-header').count(), 2);
  }
  await page.getByRole('button', { name: 'Clear Filters' }).click();
  const storeGroup = page.locator('.filter-bar .filter-group').filter({ has: page.locator('.filter-label').getByText('Store', { exact: true }) });
  await storeGroup.locator('.filter-select').click();
  await storeGroup.getByText('Alentejo A', { exact: true }).click();
  await storeGroup.getByText('Alentejo B', { exact: true }).click();
  await storeGroup.locator('.filter-select').click();
  assert.match(await page.locator('.pnl-table-summary').innerText(), /2 stores/);
  await page.getByRole('button', { name: 'Clear Filters' }).click();
  assert.match(await page.locator('.pnl-table-summary').innerText(), /6 stores/);

  await page.locator('.filter-bar select').nth(1).selectOption('');
  await page.getByText('Select a comparison endpoint', { exact: true }).waitFor();
  await page.locator('.filter-bar select').nth(1).selectOption('7');
  await page.locator('.pnl-table').waitFor();
  await page.locator('.filter-bar select').first().selectOption('');
  await page.getByText('Select a comparison endpoint', { exact: true }).waitFor();
  await page.locator('.filter-bar select').first().selectOption('2025');
  await page.waitForFunction(() => document.querySelector('.pnl-period-header')?.textContent === 'Jul 2023');
  assert.equal(await page.getByRole('columnheader', { name: 'Jul 2025', exact: true }).count(), 4);
  await page.locator('.filter-bar select').first().selectOption('2026');
  await page.getByRole('button', { name: 'YTD', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.pnl-period-header')?.textContent === 'YTD Jul 2024');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await wrapper.evaluate(el => {
    const headerBottom = document.querySelector('.filter-bar').getBoundingClientRect().bottom;
    window.scrollBy(0, el.getBoundingClientRect().top - headerBottom - 8);
  });
  const mobileBefore = await metric.boundingBox();
  await wrapper.evaluate(el => { el.scrollLeft = el.scrollWidth; el.scrollTop = 450; });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const mobileAfter = await metric.boundingBox();
  assert.ok(Math.abs(mobileBefore.x - mobileAfter.x) < 2);
  assert.ok(await metric.evaluate(el => {
    const r = el.getBoundingClientRect();
    return document.elementFromPoint(r.x + 12, r.y + 12)?.closest('th') === el;
  }), 'Metric header must be visible above scrolled mobile rows');
  await page.screenshot({ path: path.join(output, 'table-mobile.png') });
  await page.getByRole('heading', { name: 'Gross Sales Bridge' }).scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: path.join(output, 'chart-mobile.png') });
  await dimension.selectOption('concept');
  await page.getByRole('combobox', { name: 'Profit Measure' }).waitFor();
  assert.equal(await page.locator('.segment-table').count(), 1);
  // Missing 2023 history must never become an FY2024 fallback or a zero baseline.
  suppliedData = data.filter(r => r.year >= 2024);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.filter-bar select')?.value === '2026');
  await dimension.selectOption('perimeter');
  await page.getByRole('button', { name: 'LTM', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.pnl-period-header')?.textContent === 'LTM Jul 2024');
  const missing = await portfolioValues(values);
  assert.equal(missing[0], '\u2014');
  assert.equal(missing[1], '\u2014');
  assert.equal(missing[6], currency(57600));
  assert.equal(await page.getByText('Bridge unavailable: one or more comparison values are missing.', { exact: true }).count(), 2);
  assert.equal(await page.locator('.recharts-bar-rectangle').count(), 0);
  await page.getByRole('button', { name: 'Monthly', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.pnl-period-header')?.textContent === 'Jul 2024');
  assert.equal((await portfolioValues(values))[0], currency(4800));
  assert.ok(await page.locator('.recharts-bar-rectangle').count() > 0);
  assert.deepEqual(errors, []);
  console.log('L4L browser checks passed: registry-backed five cohorts, Opening in both stages, Renovation, retained closure costs, 56-cell table, both waterfalls and tooltips, zoom/full axis, filters, Monthly/YTD/LTM checkpoints, sticky headers/column, mobile, existing dimension. No database writes.');
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
  console.error('URL:', page.url(), 'Page errors:', errors);
  throw error;
} finally {
  await browser.close();
}

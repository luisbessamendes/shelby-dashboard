import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { storeMonth } from './fixtures.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const output = path.resolve('outputs/perimeter-qa');
await mkdir(output, { recursive: true });
const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3001';
function history(name, concept, start = 0, end = 30, more = {}) {
  return Array.from({ length: end - start + 1 }, (_, i) => storeMonth({ store: name, code: name.toUpperCase(), concept,
    year: 2024 + Math.floor((start + i) / 12), month: (start + i) % 12 + 1, ...more }));
}
const data = [
  ...history('Alentejo A', 'Alentejo'), ...history('Alentejo B', 'Alentejo', 0, 30, { location: 'Mall B', legal_entity: 'Entity B' }),
  ...history('Bifanas New', 'Bifanas', 24, 30, { region: 'Porto', location: 'Street', legal_entity: 'Entity C', store_type: 'High Street' }),
  ...history('Bifanas Closed', 'Bifanas').map(r => r.year === 2026 && r.month >= 4 ? { ...r, sales: 0, tickets: 0, turnover: 0, vat: 0, store_contribution: -100, ebitda: -150 } : r),
  ...history('Coffee Partial', 'Coffee Shop', 3),
];
const errors = [];
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
await context.route('**/rest/v1/**', route => {
  assert.equal(route.request().method(), 'GET', 'No database writes allowed in browser tests');
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(`${baseUrl}/segments`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Segment Analysis' }).waitFor();
  await page.waitForFunction(() => document.querySelector('.filter-bar select')?.value === '2026');
  const dimension = page.getByRole('combobox', { name: 'Dimension' });
  await dimension.selectOption('perimeter');
  await page.locator('.pnl-table').waitFor();
  assert.equal(await page.getByRole('combobox', { name: 'Profit Measure' }).count(), 0);
  assert.equal(await page.locator('.pnl-row-label').count(), 29);
  assert.equal(await page.getByRole('heading', { level: 2 }).count(), 2);
  assert.equal(await page.getByRole('heading', { name: 'Gross Sales Bridge' }).count(), 1);
  assert.equal(await page.getByRole('heading', { name: 'Store EBITDAR Bridge' }).count(), 1);
  assert.deepEqual(await page.locator('.pnl-group-header').allTextContents(), ['Alentejo', 'Bifanas', 'Coffee Shop', 'Portfolio Total']);
  const values = page.locator('tr').filter({ has: page.getByRole('rowheader', { name: 'Gross Sales', exact: true }) }).locator('td');
  assert.equal(await values.count(), 48);
  assert.equal(await values.nth(36).innerText(), '\u20ac54,000');
  assert.equal(await values.nth(41).innerText(), '\u20ac57,600');
  assert.equal(await values.nth(46).innerText(), '\u20ac61,200');
  assert.equal(await page.getByRole('columnheader', { name: 'FY 2025', exact: true }).count(), 4);
  for (const mode of ['YTD', 'LTM', 'Monthly']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    assert.equal(await values.nth(46).innerText(), '\u20ac61,200');
  }
  await page.getByText('Store classification (5)', { exact: true }).click();
  assert.match(await page.locator('details[open]').innerText(), /Closed Stores \(inferred\)/);
  assert.match(await page.locator('details[open]').innerText(), /Not a confirmed closure/);
  await page.getByText('Store classification (5)', { exact: true }).click();

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
    const showZero = chart.getByRole('checkbox', { name: 'Include zero on axis' });
    assert.equal(await showZero.isChecked(), false);
    await chart.getByText('Zoomed axis: zero excluded; total bars truncated.', { exact: true }).waitFor();
    const yLabels = chart.locator('.recharts-yAxis-tick-labels');
    const axisBefore = await yLabels.textContent();
    const ticks = chart.locator('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-label');
    assert.match(await ticks.nth(13).textContent(), /FY 2025/);
    assert.match(await ticks.nth(14).textContent(), /L4L LTM 26/);
    await showZero.check();
    assert.notEqual(await yLabels.textContent(), axisBefore);
    assert.equal(await chart.getByText('Zoomed axis: zero excluded; total bars truncated.', { exact: true }).count(), 0);
    assert.match(await yLabels.textContent(), /\u20ac0/);
    await showZero.uncheck();
    // Zoom clips total bars at the plot boundary; hover their visible portion.
    const hoverBar = async index => {
      const bar = await chart.locator('.recharts-bar-rectangle').nth(index).boundingBox();
      const plot = await chart.locator('.recharts-cartesian-grid').boundingBox();
      const top = Math.max(bar.y, plot.y);
      const bottom = Math.min(bar.y + bar.height, plot.y + plot.height);
      assert.ok(bottom > top, 'Bar must have a visible segment inside the plot');
      await page.mouse.move(bar.x + bar.width / 2, (top + bottom) / 2);
    };
    await hoverBar(0);
    const tooltip = chart.locator('.recharts-tooltip-wrapper');
    await tooltip.waitFor({ state: 'visible' });
    assert.match(await tooltip.innerText(), /Total:.*\u20ac/s);
    assert.ok(await chart.locator('.recharts-bar-rectangle').count() >= 6, 'Nonzero movements and all three totals must render');
    await chart.screenshot({ path: path.join(output, (await chart.getAttribute('aria-label')).replaceAll(' ', '-') + '.png') });
    const chartScroll = chart.getByRole('region', { name: /^Scrollable/ });
    await chartScroll.evaluate(el => { el.scrollLeft = 1100; });
    await ticks.nth(12).scrollIntoViewIfNeeded();
    await hoverBar(1);
    assert.match(await tooltip.innerText(), /Change %: \+33\.3%/);
    await chart.screenshot({ path: path.join(output, (await chart.getAttribute('aria-label')).replaceAll(' ', '-') + '-change-percent.png') });
    await ticks.nth(13).scrollIntoViewIfNeeded();
    await hoverBar(2); // Zero movements have no rendered rectangle.
    assert.match(await tooltip.innerText(), /FY 2025/);
    await chart.screenshot({ path: path.join(output, (await chart.getAttribute('aria-label')).replaceAll(' ', '-') + '-FY25.png') });
    await ticks.nth(19).scrollIntoViewIfNeeded();
    await hoverBar(3);
    assert.match(await tooltip.innerText(), /FY 2025 to LTM Jul 2026/);
    assert.match(await tooltip.innerText(), /Bifanas: New Stores/);
    assert.match(await tooltip.innerText(), /Change %: \u2014/);
    assert.match(await tooltip.innerText(), /Running total:/);
    await ticks.nth(20).scrollIntoViewIfNeeded();
    await hoverBar(4);
    assert.match(await tooltip.innerText(), /Change %: -33\.3%/);
    await chartScroll.evaluate(el => { el.scrollLeft = 0; });
  }

  for (const [label, option, count] of [['Store', 'Alentejo A', 1], ['Concept', 'Alentejo', 2], ['Region', 'Porto', 1], ['Location', 'Mall B', 1], ['Legal Entity', 'Entity C', 1], ['Type', 'High Street', 1]]) {
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
  assert.match(await page.locator('.pnl-table-summary').innerText(), /5 stores/);

  await page.locator('.filter-bar select').nth(1).selectOption('');
  await page.getByText('Select a comparison endpoint', { exact: true }).waitFor();
  await page.locator('.filter-bar select').nth(1).selectOption('7');
  await page.locator('.pnl-table').waitFor();
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
  assert.deepEqual(errors, []);
  console.log('L4L browser checks passed: FY25 checkpoints, two-stage table and waterfalls, zoom/full axis, tooltips, filters, unchanged global modes, sticky headers/column, mobile, existing dimension. No database writes.');
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
  console.error('URL:', page.url(), 'Page errors:', errors);
  throw error;
} finally {
  await browser.close();
}

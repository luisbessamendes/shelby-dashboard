import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { history, uploadRow } from './fixtures.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const XLSX = require('xlsx');
const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3001';
const output = path.resolve('outputs/ebitdar-qa');
await mkdir(output, { recursive: true });

const records = history().flatMap(row => [row,
  { ...row, store: 'Alentejo - Second', code: 'ALEN_SECOND', location: 'Other Mall', legal_entity: 'Entity B' },
  { ...row, store: 'Bifanas - Test', concept: 'Bifanas', region: 'Porto', location: 'High Street', legal_entity: 'Entity C', store_type: 'High Street', turnover: 2000, sales: 2400, vat: 400, store_contribution: 1280, ebitda: 1230, fcff: 1200 },
  { ...row, store: 'Bifanas - Loss', concept: 'Bifanas', region: 'Porto', location: 'High Street', legal_entity: 'Entity C', store_type: 'High Street', turnover: 2000, sales: 2400, vat: 400, staff: 1850, store_contribution: -320, ebitda: -370, fcff: -400 },
]);
const errors = [];
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
await context.route('**/rest/v1/**', route => {
  assert.equal(route.request().method(), 'GET', 'Browser smoke tests must never upload or modify data');
  const rows = route.request().url().includes('fact_store_month') ? records : [];
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify(rows), headers: { 'content-range': `0-${rows.length - 1}/${rows.length}` } });
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));

async function open(route, heading) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: heading, exact: true }).waitFor();
  await page.locator('.loading-spinner').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.querySelector('.filter-bar select')?.value === '2026');
}

async function frozenColumn(wrapper, firstCell) {
  const before = await firstCell.boundingBox();
  const title = await page.getByRole('heading', { level: 1 }).boundingBox();
  await wrapper.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const after = await firstCell.boundingBox();
  const afterTitle = await page.getByRole('heading', { level: 1 }).boundingBox();
  assert.ok(Math.abs(before.x - after.x) < 2, 'First column must remain frozen');
  assert.equal(title.x, afterTitle.x, 'Page title must not shift');
}

try {
  await open('/performance', 'Portfolio Performance Table');
  const headers = await page.locator('thead th').allTextContents();
  assert.equal(headers.some(value => value === 'Code'), false);
  assert.deepEqual(headers.slice(16, 24).map(value => value.replace(/[↑↓]/g, '').trim()), ['Store EBITDAR', 'Store EBITDAR %', 'Leases', 'Leases %', 'Store EBITDA', 'Store EBITDA %', 'Headquarter & Admin.', 'Headquarter & Admin. %']);
  const firstRow = page.locator('tbody tr').filter({ hasText: 'Alentejo - Test' });
  assert.equal(await firstRow.locator('td').nth(16).innerText(), '€380');
  assert.equal(await firstRow.locator('td').nth(18).innerText(), '-€100');
  assert.equal(await firstRow.locator('td').nth(20).innerText(), '€280');
  assert.equal(await firstRow.locator('td').nth(23).innerText(), '5.0%');
  await frozenColumn(page.locator('.performance-table-wrapper'), firstRow.locator('td').first());
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const csv = await readFile(await (await downloadEvent).path(), 'utf8');
  assert.ok(csv.includes('Store EBITDAR,Store EBITDAR %,Leases,Leases %,Store EBITDA,Store EBITDA %,Headquarter & Admin.,Headquarter & Admin. %'));
  assert.equal(csv.includes('Store Contribution'), false);
  await page.screenshot({ path: path.join(output, 'performance-right.png') });

  await open('/pnl', 'P&L Analysis');
  const labels = await page.locator('.pnl-row-label').allTextContents();
  assert.equal(labels.length, 29);
  assert.deepEqual(labels.slice(19, 26), ['Store EBITDAR', 'Store EBITDAR %', 'Leases', 'Leases %', 'Store EBITDA', 'Store EBITDA %', 'Headquarter & Admin.']);
  await page.getByRole('button', { name: 'LTM', exact: true }).click();
  const ebitdarRow = page.locator('tbody tr').filter({ has: page.getByRole('rowheader', { name: 'Store EBITDAR', exact: true }) });
  await ebitdarRow.waitFor();
  assert.equal(await ebitdarRow.locator('.pnl-current-cell').first().innerText(), '€4,560');
  await frozenColumn(page.locator('.pnl-table-wrapper'), page.locator('.pnl-row-label').first());
  await page.locator('.pnl-table-wrapper').evaluate(element => { element.scrollTop = 650; });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const hit = await page.locator('.pnl-metric-header').evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return document.elementFromPoint(bounds.x + 15, bounds.y + 15)?.closest('th') === element;
  });
  assert.equal(hit, true, 'Sticky header must cover scrolling cells');
  await page.screenshot({ path: path.join(output, 'pnl-scrolled.png') });

  // Each dimension applies to the P&L, including more than one selected store.
  await page.locator('.pnl-table-wrapper').evaluate(element => { element.scrollTop = 0; element.scrollLeft = 0; });
  for (const [label, option, count] of [['Store', 'Alentejo - Test', 1], ['Concept', 'Alentejo', 2], ['Region', 'Lisbon', 2], ['Location', 'Test Mall', 1], ['Legal Entity', 'Entity A', 1], ['Type', 'Shopping Mall', 2]]) {
    await page.getByRole('button', { name: 'Clear Filters' }).click();
    const group = page.locator('.filter-bar .filter-group').filter({ has: page.locator('.filter-label').getByText(label, { exact: true }) });
    await group.locator('.filter-select').click();
    await group.getByText(option, { exact: true }).click();
    await group.locator('.filter-select').click();
    await page.waitForFunction(expected => document.querySelector('.pnl-table-summary')?.textContent.includes(`${expected} stores`), count);
    assert.equal(await page.locator('.pnl-group-header').count(), count + 2);
  }
  await page.getByRole('button', { name: 'Clear Filters' }).click();
  const storeGroup = page.locator('.filter-bar .filter-group').filter({ has: page.locator('.filter-label').getByText('Store', { exact: true }) });
  await storeGroup.locator('.filter-select').click();
  await storeGroup.getByText('Alentejo - Test', { exact: true }).click();
  await storeGroup.getByText('Alentejo - Second', { exact: true }).click();
  await storeGroup.locator('.filter-select').click();
  assert.match(await page.locator('.pnl-table-summary').innerText(), /2 stores/);
  await page.getByRole('button', { name: 'Clear Filters' }).click();
  assert.match(await page.locator('.pnl-table-summary').innerText(), /4 stores/);

  await open('/segments', 'Segment Analysis');
  await page.getByRole('combobox', { name: 'Profit Measure' }).selectOption('ebitda');
  assert.match(await page.locator('.chart-title').first().innerText(), /^EBITDA %/);
  await page.getByRole('combobox', { name: 'Profit Measure' }).selectOption('store_ebitdar');
  await frozenColumn(page.locator('.segment-table-wrapper'), page.locator('tbody tr td').first());
  await page.screenshot({ path: path.join(output, 'segments-right.png') });

  await open('/trends', 'Trend Analysis');
  await page.getByRole('combobox', { name: 'Absolute metric', exact: true }).selectOption('store_ebitdar');
  await page.getByRole('combobox', { name: 'Ratio metric', exact: true }).selectOption('store_ebitda');
  const basis = page.locator('.page-header select');
  await basis.selectOption('ltm');
  await page.waitForFunction(() => {
    const axes = [...document.querySelectorAll('.recharts-wrapper')];
    return axes.length === 4 && axes.every(axis => axis.textContent.includes('2024-12'));
  });
  for (const axis of await page.locator('.recharts-wrapper').all()) assert.ok((await axis.textContent()).includes('2024-12'));
  const plot = await page.locator('.recharts-surface').first().boundingBox();
  await page.mouse.move(plot.x + plot.width * 0.6, plot.y + plot.height * 0.45);
  await page.locator('.recharts-tooltip-wrapper').first().waitFor({ state: 'visible' });
  assert.match(await page.locator('.recharts-tooltip-wrapper').first().innerText(), /Store EBITDAR.*€/s);
  for (const chart of await page.locator('.recharts-wrapper').all()) {
    await chart.scrollIntoViewIfNeeded();
    const bounds = await chart.boundingBox();
    await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.4);
    const tooltip = chart.locator('.recharts-tooltip-wrapper');
    await tooltip.waitFor({ state: 'visible' });
    assert.match(await tooltip.textContent(), /[€%]/);
    assert.equal(await tooltip.locator('.recharts-tooltip-item').first().evaluate(element => getComputedStyle(element).color), 'rgb(0, 0, 0)');
  }
  await page.screenshot({ path: path.join(output, 'trends-ltm.png') });
  await basis.selectOption('monthly');
  await page.waitForFunction(() => [...document.querySelectorAll('.recharts-wrapper')].every(axis => axis.textContent.includes('2024-01')));
  for (const axis of await page.locator('.recharts-wrapper').all()) assert.ok((await axis.textContent()).includes('2024-01'));

  for (const [route, heading] of [['/overview', 'Portfolio Overview'], ['/margins', 'Margin Diagnostics'], ['/rankings', 'Rankings & Outliers'], ['/investment', 'Investment View'], ['/store/Alentejo%20-%20Test', 'Alentejo - Test']]) {
    await open(route, heading);
    assert.ok((await page.locator('main').innerText()).includes('Store EBITDAR'));
    if (await page.getByRole('combobox', { name: 'Profit Measure' }).count()) {
      await page.getByRole('combobox', { name: 'Profit Measure' }).selectOption('store_ebitda');
    }
    if (route === '/rankings') {
      assert.equal(await page.locator('.kpi-card').filter({ hasText: 'Top Store (Store EBITDA %)' }).locator('.kpi-value').innerText(), '64.0%');
    }
    await page.screenshot({ path: path.join(output, route.split('/')[1] + '-desktop.png') });
  }

  await open('/upload', 'Data Upload');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([uploadRow()]), 'Shelby');
  const chooserEvent = page.waitForEvent('filechooser');
  await page.getByText('Drop your Excel file here or click to browse', { exact: true }).click();
  await (await chooserEvent).setFiles({ name: 'test-template.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) });
  await page.getByRole('button', { name: 'Upload 1 Records' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Upload 1 Records' }).isEnabled(), true);
  assert.ok((await page.locator('thead').textContent()).includes('Store EBITDAR'));

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [route, heading] of [['/pnl', 'P&L Analysis'], ['/performance', 'Portfolio Performance Table'], ['/segments', 'Segment Analysis'], ['/trends', 'Trend Analysis'], ['/overview', 'Portfolio Overview']]) {
    await open(route, heading);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(overflow <= 1, `${route}: page overflows by ${overflow}px`);
    await page.screenshot({ path: path.join(output, route.slice(1) + '-mobile.png') });
  }
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: pages, filters, CSV, frozen columns, LTM, upload preview, desktop/mobile. No database writes.');
} catch (error) {
  console.error('At:', page.url(), 'Errors:', errors, 'Chart text:', await page.locator('.recharts-wrapper').allTextContents(), 'Page selectors:', await page.locator('select').evaluateAll(elements => elements.map(element => element.value)));
  await page.screenshot({ path: path.join(output, 'failure.png') });
  throw error;
} finally {
  await browser.close();
}

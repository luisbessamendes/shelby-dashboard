# Profitability Checks

- `npm test`: calculations, historical periods, P&L row order, upload compatibility and AI scope. Uses Node's test runner and the existing TypeScript compiler; no new dependency.
- `npx tsc --noEmit --incremental false`: independent type check (the project's build configuration skips it).
- `npx eslint src tests`: application and regression-test lint.
- `node tests/browser-smoke.mjs`: browser checks against `http://localhost:3001`. Requires an existing Playwright installation and Chrome. Set `PLAYWRIGHT_MODULE_PATH` to its package path when it is outside this project; override `TEST_BASE_URL` or `PLAYWRIGHT_CHANNEL` as needed.

Browser tests use synthetic monthly records and intercept all database requests. They reject writes and never press the upload confirmation or data-deletion buttons. Screenshots are written to `outputs/ebitdar-qa/`.

The reference workbook defines P&L rows, not an upload format. Uploads still require the flat store/month template, including CAPEX, CIT and FCFF to avoid replacing cash-flow records with missing values. Both legacy and new operating-item names are accepted. Differences above EUR 1 between supplied subtotals and their components are reported, not silently corrected.

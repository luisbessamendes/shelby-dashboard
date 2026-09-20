# Profitability Checks

- `npm test`: calculations, historical periods, P&L row order, upload compatibility and AI scope. Uses Node's test runner and the existing TypeScript compiler; no new dependency.
- `npx tsc --noEmit --incremental false`: independent type check (the project's build configuration skips it).
- `npx eslint src tests`: application and regression-test lint.
- `node tests/browser-smoke.mjs`: browser checks against `http://localhost:3001`. Requires an existing Playwright installation and Chrome. Set `PLAYWRIGHT_MODULE_PATH` to its package path when it is outside this project; override `TEST_BASE_URL` or `PLAYWRIGHT_CHANNEL` as needed.

Browser tests use synthetic monthly records and intercept all database requests. They reject writes and never press the upload confirmation or data-deletion buttons. Screenshots are written to `outputs/ebitdar-qa/`.

## L4L Register

`src/lib/data/perimeter-registry.json` is a versioned snapshot of the user's `Shelby - L4L Analysis.xlsx`, sheet `AUX_ENTITIES_PERIMETER`. It retains source row numbers, the separate I/J classifications, original notes, month-level event dates and the workbook SHA-256. It is not live-synced to Excel and does not change financial uploads. Do not infer replacement lifecycle flags from sales when the register needs updating.

- March 2025 openings/acquisitions remain Opening in both bridges, including annualisation and any later exit costs. A full comparable baseline is required before L4L.
- All three checkpoints follow the header's Monthly, YTD or LTM basis, selected month and years Y-2, Y-1, Y. Each checkpoint requires all its calendar months in the uploaded history. Missing history is unavailable, never substituted with FY data. Reporting checks exclude months outside those windows.
- Confirmed renovations and closures are distinct cohorts. Event months qualify the selected comparison windows; all actual financial records within those windows remain included. Approved Opening/Annualisation flags remain authoritative even for Monthly comparisons. A dated renovation outside the selected windows is reviewed rather than assumed L4L.
- Missing L4L reports and unknown/ambiguous identities are Other / Review. Warnings do not silently override confirmed lifecycle events. January openings are month-granularity starts; precise opening days are not supplied.
- Only terminal company-code padding is normalized (`_C02` equals `_C2`). The full store code must match; duplicate register codes are not resolved by choosing a row.
- Register columns I/J apply to comparison years 2024>2025 / 2025>2026 regardless of the checkpoint's position. Other year pairs use Other / Review until classifications are updated. Update the register when statuses or periods change, preserving financial records and retesting each bridge independently.
- `node tests/perimeter-browser.mjs` checks the table, both charts, tooltips, filters and desktop/mobile scrolling with mocked records. Screenshots go to `outputs/perimeter-qa/`.
- `node --env-file=.env.local --import ./tests/register-typescript.mjs tests/perimeter-live.mjs` performs a read-only audit of the uploaded data and 15 comparisons (five endpoints in each basis). Set `PERIMETER_WORKBOOK` to the source workbook path to also verify its hash and every classification. No workbook or database writes.

The reference workbook defines P&L rows, not an upload format. Uploads still require the flat store/month template, including CAPEX, CIT and FCFF to avoid replacing cash-flow records with missing values. Both legacy and new operating-item names are accepted. Differences above EUR 1 between supplied subtotals and their components are reported, not silently corrected.

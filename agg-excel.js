const XLSX = require('xlsx');
const fs = require('fs');

const FILE_1 = 'c:\\\\dev\\\\Antigravity\\\\Shelby Dashboard\\\\docs\\\\Shelby - Data to Dashboard 1.xlsx';
const FILE_5 = 'c:\\\\dev\\\\Antigravity\\\\Shelby Dashboard\\\\docs\\\\Shelby - Data to Dashboard 5.xlsx';

function analyzeFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(ws, { defval: null });
  
  const monthNames = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
  };

  const records = [];
  for (const row of rawData) {
    if (!row.Store || !row.Year || !row.Month) continue;
    const monthNum = monthNames[String(row.Month).toLowerCase().trim()];
    if (!monthNum) continue;

    // Skip empty logic (matching parser)
    let hasData = false;
    const skipCols = new Set(['Year', 'Month', 'Store', 'Concept', 'Region', 'Type of Store', 'Location', 'Legal Entity', 'Raw Materials %', 'Staff %', 'Rents %', 'Utilities %', 'Maintenance %', 'Banking Costs %', 'Banking costs %', 'VAT %', 'Others %', 'Store Contribution %', 'Admin. Costs %', 'EBITDA %', 'FCFF %']);
    for (const key of Object.keys(row)) {
      if (skipCols.has(key)) continue;
      if (Number(row[key]) !== 0 && !isNaN(Number(row[key]))) {
        hasData = true;
        break;
      }
    }
    if (!hasData) continue;

    records.push({
      store: row.Store,
      year: row.Year,
      month: monthNum,
      sales: Number(row.Sales || 0),
      ebitda: Number(row.EBITDA || 0)
    });
  }

  // Deduplicate (last one wins)
  const deduped = new Map();
  for (const r of records) {
    const key = `${r.store}-${r.year}-${r.month}`;
    deduped.set(key, r);
  }

  const aggregates = {};
  for (const r of deduped.values()) {
    const key = `${r.year}-${r.month}`;
    if (!aggregates[key]) aggregates[key] = { sales: 0, ebitda: 0, stores: new Set() };
    aggregates[key].sales += r.sales;
    aggregates[key].ebitda += r.ebitda;
    aggregates[key].stores.add(r.store);
  }

  return aggregates;
}

const f1 = analyzeFile(FILE_1);
const f5 = analyzeFile(FILE_5);

// Merge them
const combined = {};
for (const [key, val] of Object.entries(f1)) {
  combined[key] = { sales: val.sales, ebitda: val.ebitda, storeCount: val.stores.size };
}
for (const [key, val] of Object.entries(f5)) {
  if (!combined[key]) {
    combined[key] = { sales: val.sales, ebitda: val.ebitda, storeCount: val.stores.size };
  } else {
    // There might be overlap if stores are in both files? Usually not for multiple files, 
    // but the app upserts. So we should sum totals if we assume both are uploaded.
    combined[key].sales += val.sales;
    combined[key].ebitda += val.ebitda;
    combined[key].storeCount += val.stores.size; // This is a rough estimate if stores are unique across files
  }
}

console.log(JSON.stringify(combined, null, 2));

const XLSX = require('xlsx');
const fs = require('fs');

const FILE_1 = 'c:\\\\dev\\\\Antigravity\\\\Shelby Dashboard\\\\docs\\\\Shelby - Data to Dashboard 1.xlsx';
const FILE_5 = 'c:\\\\dev\\\\Antigravity\\\\Shelby Dashboard\\\\docs\\\\Shelby - Data to Dashboard 5.xlsx';

function getRecords(filePath) {
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
      ebitda: Number(row.EBITDA || 0),
      tickets: Number(row.Tickets || 0),
      avgTicket: Number(row['Average Ticket'] || 0)
    });
  }
  return records;
}

const r1 = getRecords(FILE_1);
const r5 = getRecords(FILE_5);

// Sample 10 from each
const sample1 = r1.sort(() => 0.5 - Math.random()).slice(0, 10);
const sample5 = r5.sort(() => 0.5 - Math.random()).slice(0, 10);

console.log(JSON.stringify([...sample1, ...sample5], null, 2));

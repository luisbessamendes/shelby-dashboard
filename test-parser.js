const XLSX = require('xlsx');
const fs = require('fs');

const filePath = 'c:\\dev\\Antigravity\\Shelby Dashboard\\docs\\Shelby - Data to Dashboard.xlsx';
try {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  console.log('Sheet names:', workbook.SheetNames);
  
  if (workbook.SheetNames.length === 0) {
    console.log('No sheets found!');
    process.exit(1);
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  console.log('\n--- First 3 Rows ---');
  for (let i = 0; i < Math.min(3, data.length); i++) {
    console.log(`Row ${i}:`, data[i]);
  }
} catch (e) {
  console.error(e);
}

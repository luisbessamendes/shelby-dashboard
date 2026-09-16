/* ────────────────────────────────────────────────────────
 * Excel Parser — converts uploaded .xlsx into StoreMonthRecord[]
 * ──────────────────────────────────────────────────────── */

import * as XLSX from 'xlsx';
import { EXCEL_COLUMN_MAP, SKIP_COLUMNS, MONTH_NAME_TO_NUMBER, NUMERIC_FIELDS } from './constants';
import type { StoreMonthRecord } from './types';

export interface ParseResult {
  records: StoreMonthRecord[];
  errors: string[];
  warnings: string[];
  skippedRows: number;
}

/**
 * Parse an Excel file buffer into StoreMonthRecord[]
 * Expects a flat table with headers in row 1 matching EXCEL_COLUMN_MAP keys.
 */
export function parseExcelFile(buffer: ArrayBuffer): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let skippedRows = 0;

  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { records: [], errors: ['No sheets found in workbook'], warnings, skippedRows: 0 };
  }

  const ws = wb.Sheets[sheetName];
  const rawData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: null });

  if (rawData.length === 0) {
    return { records: [], errors: ['Sheet is empty'], warnings, skippedRows: 0 };
  }

  // Validate headers
  const headers = Object.keys(rawData[0]);
  const mappedHeaders = new Set(headers.map(header => EXCEL_COLUMN_MAP[header.trim()]));
  const requiredHeaders = ['store', 'year', 'month', 'sales', 'vat', 'raw_materials', 'staff', 'rents', 'utilities', 'maintenance', 'banking_costs', 'others', 'capex', 'cit', 'fcff'];
  const missing = requiredHeaders.filter(field => !mappedHeaders.has(field));
  if (missing.length > 0) {
    errors.push(`Missing required columns: ${missing.join(', ')}`);
    return { records: [], errors, warnings, skippedRows: 0 };
  }

  const records: StoreMonthRecord[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const rowNum = i + 2; // 1-indexed, accounting for header

    const record: Record<string, unknown> = {};
    const supplied = new Set<string>();
    let suppliedEbitdar: number | undefined;
    let suppliedPrimeCost: number | undefined;
    let invalid = false;
    let hasData = false;

    for (const [header, value] of Object.entries(row)) {
      const excelCol = header.trim();
      if (SKIP_COLUMNS.has(excelCol) || excelCol.includes('%')) continue;
      const derived = excelCol === 'Store EBITDAR' || excelCol === 'Prime Cost';
      const dbField = EXCEL_COLUMN_MAP[excelCol];
      if (!dbField && !derived) continue;
      const blank = value == null || String(value).trim() === '';
      if (blank) continue;
      let parsed: string | number;
      if (dbField === 'month') {
        const month = MONTH_NAME_TO_NUMBER[String(value).toLowerCase().trim()] ?? Number(value);
        if (!Number.isInteger(month) || month < 1 || month > 12) {
          errors.push(`Row ${rowNum}: Invalid month "${value}"`);
          invalid = true;
          continue;
        }
        parsed = month;
      } else if (['store', 'code', 'concept', 'region', 'store_type', 'location', 'legal_entity'].includes(dbField)) {
        parsed = String(value).trim();
      } else {
        parsed = Number(value);
        if (!Number.isFinite(parsed)) {
          errors.push(`Row ${rowNum}: Invalid number in "${excelCol}"`);
          invalid = true;
          continue;
        }
        if (dbField !== 'year') hasData = true;
      }
      if (derived) {
        if (excelCol === 'Store EBITDAR') suppliedEbitdar = parsed as number;
        else suppliedPrimeCost = parsed as number;
        continue;
      }
      if (supplied.has(dbField) && record[dbField] !== parsed) {
        errors.push(`Row ${rowNum}: Conflicting values for "${excelCol}" and its equivalent column`);
        invalid = true;
      }
      record[dbField] = parsed;
      supplied.add(dbField);
    }

    if (!hasData && !invalid) {
      skippedRows++;
      continue;
    }
    if (!record.store || !Number.isInteger(record.year) || !record.month || !supplied.has('sales')) {
      errors.push(`Row ${rowNum}: Missing or invalid store, year, month, or gross sales`);
      invalid = true;
    }
    if (!supplied.has('fcff')) {
      errors.push(`Row ${rowNum}: FCFF is missing. Supply a value (including zero) to avoid replacing existing cash-flow data.`);
      invalid = true;
    }
    if (invalid) {
      skippedRows++;
      continue;
    }

    // Expense blanks in the flat upload template mean no expense; supplied zeros stay zeros.
    for (const field of NUMERIC_FIELDS) {
      if (record[field] == null) record[field] = 0;
    }
    const num = (field: string) => Number(record[field]);
    if (!supplied.has('turnover')) record.turnover = num('sales') - num('vat');
    const operatingCosts = num('raw_materials') + num('staff') + num('utilities') + num('maintenance') + num('banking_costs') + num('others');
    const calculatedEbitdar = num('turnover') - operatingCosts;
    if (!supplied.has('store_contribution')) record.store_contribution = (suppliedEbitdar ?? calculatedEbitdar) - num('rents');
    if (!supplied.has('admin_costs')) {
      if (!supplied.has('ebitda')) {
        errors.push(`Row ${rowNum}: Supply Headquarter & Admin. or EBITDA to identify headquarters costs`);
        skippedRows++;
        continue;
      }
      record.admin_costs = num('store_contribution') - num('ebitda');
    }
    if (!supplied.has('ebitda')) record.ebitda = num('store_contribution') - num('admin_costs');

    const check = (label: string, actual: number, expected: number) => {
      if (Math.abs(actual - expected) > 1) warnings.push(`Row ${rowNum} (${record.store}): ${label} differs from its components by ${(actual - expected).toFixed(2)} EUR. Supplied values are preserved.`);
    };
    check('Turnover', num('turnover'), num('sales') - num('vat'));
    check('Store EBITDA', num('store_contribution'), calculatedEbitdar - num('rents'));
    check('EBITDA', num('ebitda'), num('store_contribution') - num('admin_costs'));
    check('FCFF', num('fcff'), num('ebitda') - num('capex') - num('cit'));
    if (suppliedEbitdar !== undefined) check('Store EBITDAR', suppliedEbitdar, num('store_contribution') + num('rents'));
    if (suppliedPrimeCost !== undefined) check('Prime Cost', suppliedPrimeCost, num('raw_materials') + num('staff'));
    for (const field of ['raw_materials', 'staff', 'rents', 'utilities', 'maintenance', 'banking_costs', 'others', 'admin_costs']) {
      if (num(field) < 0) warnings.push(`Row ${rowNum} (${record.store}): Negative ${field} is treated as a credit, not an expense deduction.`);
    }

    // Auto-correct corrupted spreadsheet formulas
    // If Tickets > Sales, it implies Avg Ticket < €1, which is practically impossible.
    // This usually means the spreadsheet formula mistakenly did: Tickets = Sales * AvgTicket
    if ((record.tickets as number) > (record.sales as number) && (record.avg_ticket as number) > 0) {
      record.tickets = (record.sales as number) / (record.avg_ticket as number);
    }

    // Skip rows with no actual data
    if (!hasData) {
      skippedRows++;
      continue;
    }

    // Fill defaults for missing optional fields
    record.code = record.code || '';
    record.concept = record.concept || 'Unknown';
    record.region = record.region || 'Unknown';
    record.store_type = record.store_type || 'Unknown';
    record.location = record.location || 'Unknown';
    record.legal_entity = record.legal_entity || 'Unknown';

    records.push(record as unknown as StoreMonthRecord);
  }

  // Deduplicate records by store, year, month (keep the last occurrence)
  const dedupedRecords: StoreMonthRecord[] = [];
  const seenKeys = new Set<string>();
  
  // Go backwards to keep the last occurrence easily
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    const key = `${r.store}-${r.year}-${r.month}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      dedupedRecords.unshift(r);
    }
  }

  return { records: dedupedRecords, errors, warnings, skippedRows };
}

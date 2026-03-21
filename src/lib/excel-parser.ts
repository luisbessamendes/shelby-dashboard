/* ────────────────────────────────────────────────────────
 * Excel Parser — converts uploaded .xlsx into StoreMonthRecord[]
 * ──────────────────────────────────────────────────────── */

import * as XLSX from 'xlsx';
import { EXCEL_COLUMN_MAP, SKIP_COLUMNS, MONTH_NAME_TO_NUMBER } from './constants';
import type { StoreMonthRecord } from './types';

export interface ParseResult {
  records: StoreMonthRecord[];
  errors: string[];
  skippedRows: number;
}

/**
 * Parse an Excel file buffer into StoreMonthRecord[]
 * Expects a flat table with headers in row 1 matching EXCEL_COLUMN_MAP keys.
 */
export function parseExcelFile(buffer: ArrayBuffer): ParseResult {
  const errors: string[] = [];
  let skippedRows = 0;

  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { records: [], errors: ['No sheets found in workbook'], skippedRows: 0 };
  }

  const ws = wb.Sheets[sheetName];
  const rawData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: null });

  if (rawData.length === 0) {
    return { records: [], errors: ['Sheet is empty'], skippedRows: 0 };
  }

  // Validate headers
  const headers = Object.keys(rawData[0]);
  const requiredHeaders = ['Store', 'Year', 'Month', 'Sales'];
  const missing = requiredHeaders.filter(h => !headers.includes(h));
  if (missing.length > 0) {
    errors.push(`Missing required columns: ${missing.join(', ')}`);
    return { records: [], errors, skippedRows: 0 };
  }

  const records: StoreMonthRecord[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const rowNum = i + 2; // 1-indexed, accounting for header

    // Build the record by mapping Excel columns → DB fields
    const record: Record<string, unknown> = {};
    let hasData = false;

    for (const [excelCol, value] of Object.entries(row)) {
      // Skip percentage columns
      if (SKIP_COLUMNS.has(excelCol)) continue;

      const dbField = EXCEL_COLUMN_MAP[excelCol];
      if (!dbField) continue; // Unknown column, skip

      if (dbField === 'month') {
        // Convert month name to number
        const monthStr = String(value ?? '').toLowerCase().trim();
        const monthNum = MONTH_NAME_TO_NUMBER[monthStr];
        if (!monthNum) {
          errors.push(`Row ${rowNum}: Invalid month "${value}"`);
          continue;
        }
        record[dbField] = monthNum;
      } else if (['store', 'concept', 'region', 'store_type', 'location', 'legal_entity'].includes(dbField)) {
        record[dbField] = String(value ?? '').trim();
      } else {
        // Numeric field
        const num = Number(value);
        if (isNaN(num)) {
          record[dbField] = 0;
        } else {
          record[dbField] = num;
          if (dbField !== 'year' && num !== 0) hasData = true;
        }
      }
    }

    // Validate required fields
    if (!record.store || !record.year || !record.month) {
      errors.push(`Row ${rowNum}: Missing store, year, or month`);
      skippedRows++;
      continue;
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

  return { records: dedupedRecords, errors, skippedRows };
}

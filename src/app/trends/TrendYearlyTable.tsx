'use client';

import { comparisonChange } from '@/lib/calculations';
import { formatCurrency, formatNumber, formatPercent, formatPercentPP, formatTrend } from '@/lib/formatters';
import type { AggregatedMetrics } from '@/lib/types';

const columns: { key: keyof AggregatedMetrics; label: string; format: 'currency' | 'number' | 'ratio'; lower?: boolean }[] = [
  { key: 'totalTurnover', label: 'Turnover', format: 'currency' },
  { key: 'totalTickets', label: 'Tickets', format: 'number' },
  { key: 'avgTicket', label: 'Avg Ticket', format: 'currency' },
  { key: 'totalStoreEbitdar', label: 'Store EBITDAR', format: 'currency' },
  { key: 'storeEbitdarPct', label: 'Store EBITDAR %', format: 'ratio' },
  { key: 'totalStoreEbitda', label: 'Store EBITDA', format: 'currency' },
  { key: 'storeEbitdaPct', label: 'Store EBITDA %', format: 'ratio' },
  { key: 'totalEbitda', label: 'EBITDA', format: 'currency' },
  { key: 'ebitdaPct', label: 'EBITDA %', format: 'ratio' },
  { key: 'totalFcff', label: 'FCFF', format: 'currency' },
  { key: 'staffPct', label: 'Staff Cost %', format: 'ratio', lower: true },
  { key: 'rawMaterialsPct', label: 'Food Cost %', format: 'ratio', lower: true },
];

export default function TrendYearlyTable({ data, basis, month }: {
  data: { year: number; metrics: AggregatedMetrics }[];
  basis: string;
  month: number;
}) {
  if (!data.length) return null;
  const latest = data[0];
  const previous = data.find(row => row.year === latest.year - 1);
  return <div className="data-table-container mt-24">
    <div className="data-table-toolbar">
      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Annual Performance Benchmark</h3>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>Comparing {basis.toUpperCase()} {month} across years</span>
    </div>
    <div className="data-table-wrapper">
      <table className="data-table">
        <thead><tr><th>Period</th>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr></thead>
        <tbody>
          {data.map(row => <tr key={row.year}>
            <td style={{ fontWeight: 600 }}>{basis === 'monthly' ? 'Month' : basis.toUpperCase()} {month}/{row.year}</td>
            {columns.map(column => {
              const value = row.metrics[column.key];
              const format = column.format === 'ratio' ? formatPercent : column.format === 'number' ? formatNumber : formatCurrency;
              return <td key={column.key} className={`numeric ${(value ?? 0) < 0 ? 'cell-negative' : ''}`}>{format(value)}</td>;
            })}
          </tr>)}
          {previous && <tr style={{ background: 'var(--accent-primary-dim)' }}>
            <td style={{ fontWeight: 700 }} title={`${latest.year} vs ${previous.year}; amount growth in %, margin change in percentage points`}>YoY / pp</td>
            {columns.map(column => {
              const delta = comparisonChange(latest.metrics[column.key], previous.metrics[column.key], column.format === 'ratio');
              const color = delta == null || delta === 0 ? '' : (column.lower ? delta < 0 : delta > 0) ? 'cell-positive' : 'cell-negative';
              return <td key={column.key} className={`numeric ${color}`}>{column.format === 'ratio' ? formatPercentPP(delta) : formatTrend(delta)}</td>;
            })}
          </tr>}
        </tbody>
      </table>
    </div>
  </div>;
}

'use client';

import { useMemo } from 'react';
import { useFilters } from '@/contexts/FilterContext';
import { formatCurrency, formatNumber, formatPercent, formatPercentPP, formatTrend } from '@/lib/formatters';
import { buildPnlComparison } from '@/lib/pnl';
import { comparisonChange } from '@/lib/calculations';
import type { PnlColumnDefinition, PnlGroupComparison } from '@/lib/pnl';

import { PNL_ROWS, type PnlRowDefinition, type RowFormat } from '@/lib/pnl-rows';

function formatValue(value: number | null, format: RowFormat): string {
  if (format === 'number') return formatNumber(value);
  if (format === 'percent') return formatPercent(value);
  return formatCurrency(value);
}

function comparisonValue(
  row: PnlRowDefinition,
  group: PnlGroupComparison,
  column: PnlColumnDefinition,
): number | null {
  if (!column.compareKey) return null;

  const currentMetrics = group.values[column.valueKey];
  const previousMetrics = group.values[column.compareKey];
  if (!currentMetrics || !previousMetrics) return null;

  const getter = row.growthValue ?? row.value;
  const current = getter(currentMetrics);
  const previous = getter(previousMetrics);
  return comparisonChange(current, previous, row.format === 'percent');
}

function valueClass(row: PnlRowDefinition, value: number | null): string {
  if (value == null) return '';
  if (row.id === 'primeCostPct' && value > 0.6) return 'cell-negative';
  if (
    (['storeEbitdar', 'storeEbitdarPct', 'storeEbitda', 'storeEbitdaPct', 'ebitda', 'ebitdaPct'].includes(row.id))
    && value < 0
  ) return 'cell-negative';
  return '';
}

function comparisonClass(row: PnlRowDefinition, value: number | null): string {
  if (value == null || row.trendPreference === 'neutral' || value === 0) return '';
  const favorable = row.trendPreference === 'higher' ? value > 0 : value < 0;
  return favorable ? 'cell-positive' : 'cell-negative';
}

function groupClass(group: PnlGroupComparison): string {
  if (group.kind === 'portfolio-total') return 'pnl-portfolio-total';
  if (group.kind === 'concept-total') return 'pnl-concept-total';
  return '';
}

export default function PnlPage() {
  const { filteredData, filters, isLoading } = useFilters();

  const model = useMemo(() => {
    if (!filters.year || !filters.month) return null;
    return buildPnlComparison(filteredData, filters.periodBasis, filters.year, filters.month);
  }, [filteredData, filters.periodBasis, filters.year, filters.month]);

  const storeCount = useMemo(() => new Set(filteredData.map(record => record.store)).size, [filteredData]);
  const conceptCount = useMemo(() => new Set(filteredData.map(record => record.concept)).size, [filteredData]);

  if (isLoading) return <div className="loading-spinner"><div className="spinner" /></div>;

  if (filteredData.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">No Data Available</div>
        <div className="empty-state-text">Adjust the header filters or upload data to view the P&amp;L comparison.</div>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Select a comparison period</div>
        <div className="empty-state-text">Choose a Year and Month in the header to build the historical P&amp;L table.</div>
      </div>
    );
  }

  return (
    <div className="pnl-page">
      <div className="page-header">
        <h1 className="page-title">P&amp;L Analysis</h1>
        <p className="page-description">Historical revenue and cost performance by store, concept, and portfolio</p>
      </div>

      {model.notice && <div className="pnl-notice" role="status">{model.notice}</div>}
      {model.reconciliationIssues.length > 0 && (
        <details className="pnl-notice">
          <summary>{model.reconciliationIssues.length} source subtotal differences above EUR 1. Original figures retained.</summary>
          <ul style={{ paddingLeft: 20, maxHeight: 180, overflow: 'auto' }}>
            {model.reconciliationIssues.map((issue, index) => <li key={index}>{issue}</li>)}
          </ul>
        </details>
      )}

      <div className="data-table-container pnl-table-container">
        <div className="pnl-table-summary">
          <span>{storeCount} stores</span>
          <span aria-hidden="true">/</span>
          <span>{conceptCount} concepts</span>
          <span className="pnl-table-summary-period">Comparison through {model.columns[3].label}</span>
        </div>

        <div className="pnl-table-wrapper" tabIndex={0} aria-label="Scrollable historical P and L comparison table">
          <table className="pnl-table">
            <colgroup>
              <col className="pnl-metric-col" />
              {model.groups.flatMap(group => model.columns.map(column => (
                <col
                  key={`${group.id}:${column.key}`}
                  className={column.compareKey ? 'pnl-yoy-col' : 'pnl-value-col'}
                />
              )))}
            </colgroup>
            <thead>
              <tr>
                <th className="pnl-metric-header" rowSpan={2} scope="col">P&amp;L Item</th>
                {model.groups.map(group => (
                  <th
                    key={group.id}
                    className={`pnl-group-header ${groupClass(group)}`}
                    colSpan={model.columns.length}
                    scope="colgroup"
                    title={group.label}
                  >
                    {group.label}
                  </th>
                ))}
              </tr>
              <tr>
                {model.groups.flatMap(group => model.columns.map((column, columnIndex) => (
                  <th
                    key={`${group.id}:${column.key}`}
                    className={`pnl-period-header ${groupClass(group)} ${column.compareKey ? 'pnl-yoy-header' : ''} ${column.key === 'current' ? 'pnl-current-header' : ''} ${columnIndex === 0 ? 'pnl-group-start' : ''}`}
                    scope="col"
                    title={column.title ?? column.label}
                  >
                    {column.label}
                  </th>
                )))}
              </tr>
            </thead>
            <tbody>
              {PNL_ROWS.map(row => (
                <tr
                  key={row.id}
                  className={`${row.sectionStart ? 'pnl-section-start' : ''} ${row.emphasis ? 'pnl-emphasis-row' : ''}`}
                >
                  <th className="pnl-row-label" scope="row">{row.label}</th>
                  {model.groups.flatMap(group => model.columns.map((column, columnIndex) => {
                    const metrics = group.values[column.valueKey];
                    const rawValue = metrics ? row.value(metrics) : null;
                    const delta = column.compareKey ? comparisonValue(row, group, column) : null;
                    const display = column.compareKey
                      ? (row.format === 'percent' ? formatPercentPP(delta) : formatTrend(delta))
                      : formatValue(rawValue, row.format);
                    const semanticClass = column.compareKey
                      ? comparisonClass(row, delta)
                      : valueClass(row, rawValue);

                    return (
                      <td
                        key={`${group.id}:${column.key}:${row.id}`}
                        className={`pnl-value-cell ${groupClass(group)} ${column.compareKey ? 'pnl-yoy-cell' : ''} ${column.key === 'current' ? 'pnl-current-cell' : ''} ${columnIndex === 0 ? 'pnl-group-start' : ''} ${semanticClass}`}
                      >
                        {display}
                      </td>
                    );
                  }))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

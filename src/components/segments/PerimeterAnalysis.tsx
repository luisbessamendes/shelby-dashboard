'use client';

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFilters } from '@/contexts/FilterContext';
import { buildPerimeterComparison, buildPerimeterWaterfall, COHORTS, perimeterAxisDomain, perimeterValue } from '@/lib/perimeter';
import type { PerimeterColumn, PerimeterModel, PerimeterStep } from '@/lib/perimeter';
import { PERIMETER_REGISTRY_SOURCE } from '@/lib/perimeter-registry';
import { PNL_ROWS, type PnlRowDefinition } from '@/lib/pnl-rows';
import { formatCurrency, formatCurrencyDetail, formatNumber, formatPercent, formatPercentPP, formatTrend } from '@/lib/formatters';
import styles from './PerimeterAnalysis.module.css';

function displayValue(row: PnlRowDefinition, value: number | null, column: PerimeterColumn) {
  if (row.format === 'percent') return column === 'change' ? formatPercentPP(value) : formatPercent(value);
  if (row.format === 'number') return formatNumber(value);
  return row.id === 'avgTicket' ? formatCurrencyDetail(value) : formatCurrency(value);
}

function valueClass(row: PnlRowDefinition, value: number | null, column: PerimeterColumn) {
  if (value === null) return '';
  if (column === 'baseline' || column === 'middle' || column === 'current') {
    return (row.id === 'primeCostPct' && value > 0.6)
      || (row.id.startsWith('storeEbitd') || row.id.startsWith('ebitda')) && value < 0 ? 'cell-negative' : '';
  }
  if (value === 0) return '';
  const favorable = row.format === 'percent' && row.trendPreference === 'lower' ? value < 0 : value > 0;
  return favorable ? 'cell-positive' : 'cell-negative';
}

function BridgeChart({ model, row }: { model: PerimeterModel; row: PnlRowDefinition }) {
  const [includeZero, setIncludeZero] = useState(false);
  const steps = useMemo(() => buildPerimeterWaterfall(model, row), [model, row]);
  const domain = perimeterAxisDomain(steps, includeZero);
  const zeroExcluded = domain[0] > 0 || domain[1] < 0;
  const magnitude = Math.max(Math.abs(domain[0]), Math.abs(domain[1]));
  const unit = magnitude >= 1e6 ? 1e6 : magnitude >= 1e3 ? 1e3 : 1;
  const decimals = Math.min(6, Math.max(0, Math.ceil(-Math.log10((domain[1] - domain[0]) / 5 / unit))));
  const axisFormat = (value: number) => `${'\u20ac'}${(value / unit).toLocaleString('en-GB', { maximumFractionDigits: decimals })}${unit === 1e6 ? 'M' : unit === 1e3 ? 'k' : ''}`;
  const title = `${row.label} Bridge`;
  return <section className={styles.chartSection} aria-label={title}>
    <div className={styles.chartHeading}>
      <h2>{title}</h2>
      <span>{model.periods.map(p => p.label).join(' / ')}{model.provisional ? ' (provisional)' : ''}</span>
    </div>
    {!steps.length ? <p className="pnl-notice">Bridge unavailable: one or more comparison values are missing.</p> :
      <>
      <div className={styles.axisControls}>
        <label><input type="checkbox" checked={includeZero} onChange={event => setIncludeZero(event.target.checked)} />Include zero on axis</label>
        {zeroExcluded && <span>Zoomed axis: zero excluded; total bars truncated.</span>}
      </div>
      <div className={styles.chartScroll} role="region" tabIndex={0} aria-label={`Scrollable ${title}`}>
        <div style={{ minWidth: Math.max(900, steps.length * 90) }}>
          <ResponsiveContainer width="100%" height={390}>
            <BarChart data={steps} margin={{ top: 18, right: 20, bottom: 76, left: 10 }} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="id" interval={0} tick={({ x, y, index: tickIndex }) => {
                const step = steps[tickIndex];
                if (!step) return <g />;
                const shortLabel = step.total ? step.label : COHORTS.find(cohort => cohort.key === step.cohort)?.shortLabel;
                return <g transform={`translate(${x},${y})`}>
                  <text y={16} textAnchor="middle" fill="var(--text-secondary)" fontSize={11}>{shortLabel}</text>
                  {!step.total && <text y={32} textAnchor="middle" fill="var(--text-secondary)" fontSize={11}>{step.periodLabel}</text>}
                  {step.cohort === 'closed' && <text y={54} textAnchor="middle" fill="var(--text-primary)" fontSize={11} fontWeight={600}>{step.concept}</text>}
                </g>;
              }} />
              <YAxis domain={domain} allowDataOverflow tickFormatter={axisFormat} width={90} tick={{ fontSize: 11 }} />
              {!zeroExcluded && <ReferenceLine y={0} stroke="var(--text-muted)" />}
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as PerimeterStep;
                return <div className={styles.tooltip}>
                  {point.stageLabel && <div>{point.stageLabel}</div>}
                  <strong>{point.concept ? `${point.concept}: ` : ''}{point.label}</strong>
                  <div>{point.total ? 'Total' : 'Change'}: {formatCurrency(point.value)}</div>
                  {!point.total && <div>Change %: {formatTrend(point.changePct)}</div>}
                  {!point.total && <div>Running total: {formatCurrency(point.end)}</div>}
                </div>;
              }} />
              <Bar dataKey="range" isAnimationActive={false} maxBarSize={52}>
                {steps.map(step => <Cell key={step.id} fill={step.total ? 'var(--accent-primary)' : step.value >= 0 ? '#10b981' : '#ef4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      </>}
  </section>;
}

export default function PerimeterAnalysis() {
  const { allData, filters } = useFilters();
  const { periodBasis, year, month, stores, concepts, regions, locations, legalEntities, storeTypes } = filters;
  const model = useMemo(() => year && month
    ? buildPerimeterComparison(allData, { stores, concepts, regions, locations, legalEntities, storeTypes }, periodBasis, year, month) : null,
  [allData, periodBasis, year, month, stores, concepts, regions, locations, legalEntities, storeTypes]);
  if (!model) return <div className="empty-state"><div className="empty-state-title">Select a comparison endpoint</div><p>Choose a Year and Month in the header.</p></div>;
  if (model.blocked) return <div className="pnl-notice" role="status">{model.blocked}</div>;
  const periodSummary = model.periods.map(p => p.label).join(' / ');
  const columns: { key: PerimeterColumn; label: string; title?: string }[] = [
    { key: 'baseline', label: model.periods[0].label },
    ...model.stages.flatMap(stage => [
      ...COHORTS.map(cohort => ({ key: `${stage.key}:${cohort.key}` as PerimeterColumn, label: `${cohort.column} ${stage.current.shortLabel}`, title: `${cohort.label}: ${stage.current.label} minus ${stage.baseline.label}` })),
      { key: stage.key === 'previous' ? 'middle' as const : 'current' as const, label: stage.current.label },
    ]),
    { key: 'change', label: 'Total Change', title: 'Absolute amount change; margin change in percentage points. Not YoY growth.' },
  ];
  return <div className={styles.analysis}>
    <div className={styles.period}>{periodSummary} {model.provisional && <strong>Provisional</strong>}</div>
    {model.notices.length > 0 && <details className="pnl-notice">
      <summary>{model.notices.length} data-quality notices. Figures are provisional.</summary>
      <ul className={styles.issueList}>{model.notices.map(notice => <li key={notice}>{notice}</li>)}</ul>
    </details>}
    {model.stages.map(stage => <div className={styles.cohorts} key={stage.key}>
      <h3>{stage.label}</h3>
      {COHORTS.map(cohort => <span key={cohort.key}>{cohort.label} <strong>{stage.stores.filter(store => store.cohort === cohort.key).length}</strong></span>)}
    </div>)}
    <details className={styles.details}>
      <summary>Store classification ({model.stores.length})</summary>
      <div className={styles.auditScroll}>
        <table className="data-table">
          <thead><tr><th>Store</th><th>Concept</th>{model.stages.map(stage => <th key={stage.key}>{stage.label}</th>)}</tr></thead>
          <tbody>{model.stores.map(store => <tr key={store.id}>
            <td>{store.name}</td><td>{store.concept}</td>{model.stages.map(stage => {
              const classified = stage.stores.find(item => item.id === store.id);
              return <td key={stage.key} className={styles.auditBasis}>
                {classified ? <><strong>{COHORTS.find(c => c.key === classified.cohort)?.label}</strong><div>{classified.reason}</div>{classified.warnings.map(warning => <div key={warning}>{warning}</div>)}</> : 'No activity in these windows.'}
              </td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>
    </details>
    <details className={styles.details}>
      <summary>Comparison methodology</summary>
      <p>Two comparisons: {model.stages.map(s => s.label).join(', then ')}. All three checkpoints follow the header: Monthly uses the selected month, YTD uses January through that month, and LTM uses the trailing 12 months ending in that month, in each respective year. Sales means Gross Sales.</p>
      <p>Classification source: {PERIMETER_REGISTRY_SOURCE.filename}, {PERIMETER_REGISTRY_SOURCE.sheet}, columns I and J. Stores are matched by Code and classified separately for each bridge. Column I covers 2024 to 2025; column J covers 2025 to 2026. Other comparison years require updated classifications and are shown in Other / Review.</p>
      <p>Openings / Annualisation includes openings and acquisitions affecting either comparison period, plus the register&apos;s approved annualisation classifications. A March 2025 opening stays in Opening for both the 2024 to 2025 and 2025 to 2026 bridges, including Monthly mode, so it cannot inflate L4L. An opening is treated as operating from its recorded month. L4L requires comparable operation and complete reporting in both selected windows.</p>
      <p>Confirmed closures and renovations are separate movements, qualified by the event months in the register. Future events do not create trading in earlier periods; actual pre-opening and post-closure costs are retained. Opening / annualisation takes precedence if a store also exits before becoming comparable. Unknown classifications, missing L4L reports and ambiguous identities go to Other / Review, never inferred openings or closures. Store classification identifies each workbook row and any conflicting reported sales.</p>
      <p>Amount movements equal each cohort&apos;s later period less its baseline, including residual costs. Cost deductions are negative. Percentage rows use total Turnover; Average Ticket uses Gross Sales / Tickets. These non-additive rows have no cohort impacts. Total Change compares {model.periods[2].label} with {model.periods[0].label}: an absolute difference, or percentage points for ratios, not YoY growth. Every selected period needs all its calendar months in the uploaded history. Incomplete periods and their movements appear as {'\u2014'}; unreported periods are not evidence of closure.</p>
      <p>Chart tooltip percentage changes divide the movement by that concept and cohort&apos;s baseline amount, using its absolute value when negative. Zero or missing baseline amounts have no percentage change.</p>
    </details>
    {model.reconciliationIssues.length > 0 && <details className="pnl-notice">
      <summary>{model.reconciliationIssues.length} source subtotal differences above EUR 1. Original figures retained.</summary>
      <ul className={styles.issueList}>{model.reconciliationIssues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>
    </details>}
    <div className={`data-table-container pnl-table-container ${styles.tableContainer}`}>
      <div className={`pnl-table-summary ${styles.summary}`}>
        <span>{model.stores.length} stores / {model.groups.length - 1} concepts</span>
        <span className="pnl-table-summary-period">{periodSummary}{model.provisional ? ' (provisional)' : ''}</span>
      </div>
      <div className="pnl-table-wrapper" role="region" tabIndex={0} aria-label="Scrollable L4L P and L comparison table">
        <table className={`pnl-table ${styles.table}`}>
          <colgroup><col className="pnl-metric-col" />{model.groups.flatMap(group => columns.map(column => <col key={`${group.id}:${column.key}`} className={styles.valueColumn} />))}</colgroup>
          <thead>
            <tr><th className="pnl-metric-header" rowSpan={2} scope="col">P&amp;L Item</th>
              {model.groups.map(group => <th key={group.id} className={`pnl-group-header ${group.id === 'portfolio' ? 'pnl-portfolio-total' : ''}`} colSpan={columns.length} scope="colgroup">{group.label}</th>)}
            </tr>
            <tr>{model.groups.flatMap(group => columns.map((column, i) => <th key={`${group.id}:${column.key}`} scope="col"
              title={column.title ?? column.label}
              className={`pnl-period-header ${i === 0 ? 'pnl-group-start' : ''} ${column.key === 'current' || column.key === 'middle' ? 'pnl-current-header' : ''} ${group.id === 'portfolio' ? 'pnl-portfolio-total' : ''}`}>{column.label}</th>))}</tr>
          </thead>
          <tbody>{PNL_ROWS.map(row => <tr key={row.id} className={`${row.sectionStart ? 'pnl-section-start' : ''} ${row.emphasis ? 'pnl-emphasis-row' : ''}`}>
            <th scope="row" className="pnl-row-label">{row.label}</th>
            {model.groups.flatMap(group => columns.map((column, i) => {
              const value = perimeterValue(row, group, column.key);
              return <td key={`${group.id}:${column.key}`} className={`pnl-value-cell ${i === 0 ? 'pnl-group-start' : ''} ${column.key === 'current' || column.key === 'middle' ? 'pnl-current-cell' : ''} ${group.id === 'portfolio' ? 'pnl-portfolio-total' : ''} ${valueClass(row, value, column.key)}`}>
                {displayValue(row, value, column.key)}
              </td>;
            }))}
          </tr>)}</tbody>
        </table>
      </div>
    </div>
    <BridgeChart model={model} row={PNL_ROWS.find(row => row.id === 'grossSales')!} />
    <BridgeChart model={model} row={PNL_ROWS.find(row => row.id === 'storeEbitdar')!} />
  </div>;
}

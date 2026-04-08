'use client';

import { formatCurrency, formatNumber, formatPercent, formatPercentPP, formatTrend } from '@/lib/formatters';

interface TrendYearlyTableProps {
  data: any[];
  basis: string;
  month: number;
}

export default function TrendYearlyTable({ data, basis, month }: TrendYearlyTableProps) {
  if (data.length === 0) return null;

  const latest = data[0];
  const previous = data[1];

  const getDelta = (curr: number, prev: number | undefined, isRatio = false) => {
    if (prev === undefined || prev === 0) return null;
    if (isRatio) return curr - prev;
    return (curr - prev) / prev;
  };

  return (
    <div className="data-table-container mt-24">
      <div className="data-table-toolbar">
        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Annual Performance Benchmark</h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          Comparing {basis.toUpperCase()} {month} across years
        </span>
      </div>
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Period</th>
              <th className="text-center">Sales</th>
              <th className="text-center">Tickets</th>
              <th className="text-center">Avg Ticket</th>
              <th className="text-center">EBITDA (€)</th>
              <th className="text-center">FCFF (€)</th>
              <th className="text-center">EBITDA %</th>
              <th className="text-center">Staff %</th>
              <th className="text-center">Raw Mat %</th>
              <th className="text-center">SC %</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.year}>
                <td style={{ fontWeight: 600 }}>
                  {basis === 'monthly' ? 'Month ' : basis === 'ytd' ? 'YTD ' : 'LTM '} 
                  {row.year}
                </td>
                <td className="numeric text-center">{formatCurrency(row.metrics.totalSales)}</td>
                <td className="numeric text-center">{formatNumber(row.metrics.totalTickets)}</td>
                <td className="numeric text-center">{formatCurrency(row.metrics.avgTicket)}</td>
                <td className={`numeric text-center ${(row.metrics.totalEbitda ?? 0) < 0 ? 'cell-negative' : 'cell-positive'}`}>
                  {formatCurrency(row.metrics.totalEbitda)}
                </td>
                <td className={`numeric text-center ${(row.metrics.totalFcff ?? 0) < 0 ? 'cell-negative' : ''}`}>
                  {formatCurrency(row.metrics.totalFcff)}
                </td>
                <td className={`numeric text-center ${(row.metrics.ebitdaPct ?? 0) < 0 ? 'cell-negative' : 'cell-positive'}`}>
                  {formatPercent(row.metrics.ebitdaPct)}
                </td>
                <td className={`numeric text-center ${(row.metrics.staffPct ?? 0) > 0.3 ? 'cell-warning' : ''}`}>
                  {formatPercent(row.metrics.staffPct)}
                </td>
                <td className="numeric text-center">{formatPercent(row.metrics.rawMaterialsPct)}</td>
                <td className={`numeric text-center ${(row.metrics.storeContributionPct ?? 0) < 0 ? 'cell-negative' : ''}`}>
                  {formatPercent(row.metrics.storeContributionPct)}
                </td>
              </tr>
            ))}
            {latest && previous && (
              <tr style={{ background: 'var(--accent-primary-dim)', borderTop: '2px solid var(--border-glass)' }}>
                <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>Growth / Δ</td>
                <td className={`numeric text-center ${getDelta(latest.metrics.totalSales, previous.metrics.totalSales)! >= 0 ? 'cell-positive' : 'cell-negative'}`}>
                  {formatTrend(getDelta(latest.metrics.totalSales, previous.metrics.totalSales))}
                </td>
                <td className={`numeric text-center ${getDelta(latest.metrics.totalTickets, previous.metrics.totalTickets)! >= 0 ? 'cell-positive' : 'cell-negative'}`}>
                  {formatTrend(getDelta(latest.metrics.totalTickets, previous.metrics.totalTickets))}
                </td>
                <td className="numeric text-center">—</td>
                <td className={`numeric text-center ${getDelta(latest.metrics.totalEbitda, previous.metrics.totalEbitda)! >= 0 ? 'cell-positive' : 'cell-negative'}`}>
                  {formatTrend(getDelta(latest.metrics.totalEbitda, previous.metrics.totalEbitda))}
                </td>
                <td className={`numeric text-center ${getDelta(latest.metrics.totalFcff, previous.metrics.totalFcff)! >= 0 ? 'cell-positive' : 'cell-negative'}`}>
                  {formatTrend(getDelta(latest.metrics.totalFcff, previous.metrics.totalFcff))}
                </td>
                <td className={`numeric text-center ${getDelta(latest.metrics.ebitdaPct, previous.metrics.ebitdaPct, true)! >= 0 ? 'cell-positive' : 'cell-negative'}`}>
                  {formatPercentPP(getDelta(latest.metrics.ebitdaPct, previous.metrics.ebitdaPct, true))}
                </td>
                <td className={`numeric text-center ${getDelta(latest.metrics.staffPct, previous.metrics.staffPct, true)! <= 0 ? 'cell-positive' : 'cell-negative'}`}>
                  {formatPercentPP(getDelta(latest.metrics.staffPct, previous.metrics.staffPct, true))}
                </td>
                <td className="numeric text-center">—</td>
                <td className={`numeric text-center ${getDelta(latest.metrics.storeContributionPct, previous.metrics.storeContributionPct, true)! >= 0 ? 'cell-positive' : 'cell-negative'}`}>
                  {formatPercentPP(getDelta(latest.metrics.storeContributionPct, previous.metrics.storeContributionPct, true))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

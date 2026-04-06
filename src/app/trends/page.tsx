'use client';

import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';
import { useFilters } from '@/contexts/FilterContext';
import { getMonthlyTrend, getRatioTrend, getYearlyComparison } from '@/lib/calculations';
import { formatCurrency, formatCompact, formatPercent, formatNumber, formatPercentPP, formatTrend } from '@/lib/formatters';

type MetricKey = 'sales' | 'tickets' | 'ebitda' | 'fcff' | 'store_contribution';
type RatioKey = 'ebitda' | 'staff' | 'raw_materials' | 'fcff';

export default function TrendsPage() {
  const { filteredData, filters, availableYears, isLoading } = useFilters();
  const [activeMetric, setActiveMetric] = useState<MetricKey>('sales');
  const [activeRatio, setActiveRatio] = useState<RatioKey>('ebitda');

  const absoluteMetrics: { value: MetricKey; label: string; color: string }[] = [
    { value: 'sales', label: 'Sales', color: '#3b82f6' },
    { value: 'tickets', label: 'Tickets', color: '#8b5cf6' },
    { value: 'ebitda', label: 'EBITDA', color: '#10b981' },
    { value: 'fcff', label: 'FCFF', color: '#f59e0b' },
    { value: 'store_contribution', label: 'Store Contribution', color: '#06b6d4' },
  ];

  const ratioMetrics: { value: RatioKey; label: string; color: string }[] = [
    { value: 'ebitda', label: 'EBITDA %', color: '#10b981' },
    { value: 'staff', label: 'Staff %', color: '#f59e0b' },
    { value: 'raw_materials', label: 'Raw Materials %', color: '#ef4444' },
    { value: 'fcff', label: 'FCFF %', color: '#3b82f6' },
  ];

  const trendData = useMemo(() => getMonthlyTrend(filteredData, activeMetric), [filteredData, activeMetric]);
  const ratioData = useMemo(() => getRatioTrend(filteredData, activeRatio), [filteredData, activeRatio]);

  const allAbsData = useMemo(() => {
    const salesT = getMonthlyTrend(filteredData, 'sales');
    const ebitdaT = getMonthlyTrend(filteredData, 'ebitda');
    const fcffT = getMonthlyTrend(filteredData, 'fcff');
    const periods = salesT.map(s => s.period);
    return periods.map((p, i) => ({
      period: p,
      sales: salesT[i]?.value ?? 0,
      ebitda: ebitdaT[i]?.value ?? 0,
      fcff: fcffT[i]?.value ?? 0,
    }));
  }, [filteredData]);

  const allRatioData = useMemo(() => {
    const ebitdaR = getRatioTrend(filteredData, 'ebitda');
    const staffR = getRatioTrend(filteredData, 'staff');
    const rawMatR = getRatioTrend(filteredData, 'raw_materials');
    const periods = ebitdaR.map(s => s.period);
    return periods.map((p, i) => ({
      period: p,
      ebitda_pct: ((ebitdaR[i]?.value ?? 0) * 100),
      staff_pct: ((staffR[i]?.value ?? 0) * 100),
      raw_mat_pct: ((rawMatR[i]?.value ?? 0) * 100),
    }));
  }, [filteredData]);

  const yearlyComparison = useMemo(() => {
    if (!filters.year || !filters.month) return [];
    return getYearlyComparison(filteredData, filters.periodBasis, filters.month, availableYears);
  }, [filteredData, filters.periodBasis, filters.month, availableYears]);

  const currentColor = absoluteMetrics.find(m => m.value === activeMetric)?.color ?? '#3b82f6';
  const currentRatioColor = ratioMetrics.find(m => m.value === activeRatio)?.color ?? '#10b981';

  if (isLoading) return <div className="loading-spinner"><div className="spinner" /></div>;

  if (filteredData.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📈</div>
        <div className="empty-state-title">No Data Available</div>
        <div className="empty-state-text">Upload data to view trend analysis.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Trend Analysis</h1>
        <p className="page-description">Monthly performance trends across the portfolio</p>
      </div>

      <div className="chart-container mb-24">
        <div className="chart-title">
          <span>Absolute Metrics Trend</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {absoluteMetrics.map(m => (
              <button
                key={m.value}
                className={`btn btn-sm ${activeMetric === m.value ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveMetric(m.value)}
                style={activeMetric === m.value ? { background: m.color } : {}}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={trendData}>
            <defs>
              <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={currentColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={currentColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(v: any) => [formatCurrency(v), absoluteMetrics.find(m => m.value === activeMetric)?.label]}
              contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
              itemStyle={{ color: '#fff' }}
            />
            <Area type="monotone" dataKey="value" stroke={currentColor} fill="url(#trendGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-container mb-24">
        <div className="chart-title">
          <span>Ratio Metrics Trend</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {ratioMetrics.map(m => (
              <button
                key={m.value}
                className={`btn btn-sm ${activeRatio === m.value ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveRatio(m.value)}
                style={activeRatio === m.value ? { background: m.color } : {}}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={ratioData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(v: number) => formatPercent(v)} tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(v: any) => [formatPercent(v as number), ratioMetrics.find(m => m.value === activeRatio)?.label]}
              contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
              itemStyle={{ color: '#fff' }}
            />
            <Line type="monotone" dataKey="value" stroke={currentRatioColor} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-grid">
        <div className="chart-container">
          <div className="chart-title">Sales / EBITDA / FCFF Overlay</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={allAbsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: any, name: any) => [formatCurrency(v), name?.toUpperCase()]}
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                itemStyle={{ color: '#fff' }}
              />
              <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="ebitda" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="fcff" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title">EBITDA % / Staff % / Raw Mat % Overlay</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={allRatioData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: any, name: any) => [`${(v as number).toFixed(1)}%`, name]}
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                itemStyle={{ color: '#fff' }}
              />
              <Line type="monotone" dataKey="ebitda_pct" stroke="#10b981" strokeWidth={2} dot={false} name="EBITDA %" />
              <Line type="monotone" dataKey="staff_pct" stroke="#f59e0b" strokeWidth={2} dot={false} name="Staff %" />
              <Line type="monotone" dataKey="raw_mat_pct" stroke="#ef4444" strokeWidth={2} dot={false} name="Raw Mat %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Yearly Comparison Table */}
      <TrendYearlyTable 
        data={yearlyComparison} 
        basis={filters.periodBasis} 
        month={filters.month ?? 0} 
      />
    </div>
  );
}

function TrendYearlyTable({ data, basis, month }: { data: any[], basis: string, month: number }) {
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

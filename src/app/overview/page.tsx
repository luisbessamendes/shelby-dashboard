'use client';

import { useMemo } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
  AreaChart, Area,
} from 'recharts';
import { useFilters } from '@/contexts/FilterContext';
import ProfitWaterfall from '@/components/ui/ProfitWaterfall';
import KPICard from '@/components/ui/KPICard';
import { filterByPeriod, aggregate, aggregatePerStore, getMonthlyTrend, aggregateByDimension } from '@/lib/calculations';
import { formatCurrency, formatCompact } from '@/lib/formatters';
import { CHART_COLORS } from '@/lib/constants';

export default function OverviewPage() {
  const { filteredData, filters, isLoading } = useFilters();

  // Get data for the selected period
  const periodData = useMemo(() => {
    if (!filters.year || !filters.month) return filteredData;
    return filterByPeriod(filteredData, filters.periodBasis, filters.year, filters.month);
  }, [filteredData, filters]);

  // Portfolio aggregation
  const portfolio = useMemo(() => aggregate(periodData), [periodData]);

  // Per-store aggregation for top/bottom
  const storeAggs = useMemo(() => {
    const map = aggregatePerStore(periodData);
    return Array.from(map.values()).sort((a, b) => b.totalStoreEbitdar - a.totalStoreEbitdar);
  }, [periodData]);

  // Trend data (all time, not filtered by period)
  const turnoverTrend = useMemo(() => getMonthlyTrend(filteredData, 'turnover'), [filteredData]);
  const ebitdaTrend = useMemo(() => getMonthlyTrend(filteredData, 'store_ebitdar'), [filteredData]);

  // Mix by concept
  const conceptMix = useMemo(() => {
    const map = aggregateByDimension(periodData, 'concept');
    return Array.from(map.entries())
      .map(([name, agg]) => ({ name, turnover: agg.totalTurnover, ebitda: agg.totalEbitda }))
      .sort((a, b) => b.turnover - a.turnover);
  }, [periodData]);

  // Top / Bottom stores
  const top5 = storeAggs.slice(0, 5);
  const bottom5 = storeAggs.slice(-5).reverse();

  if (isLoading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  if (filteredData.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <div className="empty-state-title">No Data Available</div>
        <div className="empty-state-text">
          Upload your first monthly management file to start analyzing portfolio performance.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Portfolio Overview</h1>
        <p className="page-description">
          {filters.periodBasis.toUpperCase()} view — {filters.year}/{String(filters.month).padStart(2, '0')} — {portfolio.storeCount} active stores
        </p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard label="Turnover" value={portfolio.totalTurnover} format="compact" />
        <KPICard label="Gross Sales" value={portfolio.totalSales} format="compact" />
        <KPICard label="Total Tickets" value={portfolio.totalTickets} format="number" />
        <KPICard label="Avg Ticket" value={portfolio.avgTicket} format="currency" />
        <KPICard label="Store EBITDAR" value={portfolio.totalStoreEbitdar} format="compact" />
        <KPICard label="Store EBITDAR %" value={portfolio.storeEbitdarPct} format="percent" />
        <KPICard label="Store EBITDA" value={portfolio.totalStoreEbitda} format="compact" />
        <KPICard label="Store EBITDA %" value={portfolio.storeEbitdaPct} format="percent" />
        <KPICard label="EBITDA" value={portfolio.totalEbitda} format="compact" />
        <KPICard label="EBITDA %" value={portfolio.ebitdaPct} format="percent" />
        <KPICard label="FCFF" value={portfolio.totalFcff} format="compact" />
        <KPICard label="FCFF %" value={portfolio.fcffPct} format="percent" />
        <KPICard label="Food Cost %" value={portfolio.rawMaterialsPct} format="percent" />
        <KPICard label="Staff Cost %" value={portfolio.staffPct} format="percent" />
        <KPICard label="Active Stores" value={portfolio.storeCount} format="integer" />
        <KPICard label="Store EBITDAR-Negative" value={portfolio.storeEbitdarNegativeCount} format="integer" />
        <KPICard label="Store EBITDA-Negative" value={portfolio.storeEbitdaNegativeCount} format="integer" />
        <KPICard label="EBITDA-Negative" value={portfolio.ebitdaNegativeCount} format="integer" />
        <KPICard label="FCFF-Negative" value={portfolio.fcffNegativeCount} format="integer" />
      </div>

      {/* Trend Charts */}
      <div className="chart-grid">
        {/* Turnover Trend */}
        <div className="chart-container">
          <div className="chart-title">Turnover Trend</div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={turnoverTrend}>
              <defs>
                <linearGradient id="turnoverGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10 }} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [formatCurrency(v), 'Turnover']}
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                itemStyle={{ color: '#fff' }}
              />
              <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="url(#turnoverGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Store EBITDAR Trend */}
        <div className="chart-container">
          <div className="chart-title">Store EBITDAR Trend</div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={ebitdaTrend}>
              <defs>
                <linearGradient id="ebitdaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: unknown) => [formatCurrency(Number(v ?? 0)), 'Store EBITDAR']}
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                itemStyle={{ color: '#fff' }}
              />
              <Area type="monotone" dataKey="value" stroke="#10b981" fill="url(#ebitdaGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Waterfall + Concept Mix */}
      <div className="chart-grid">
        {/* P&L Waterfall */}
        <div className="chart-container">
          <div className="chart-title">P&L Waterfall: Sales to VAT to Turnover to FCFF</div>
          <ProfitWaterfall metrics={portfolio} mode="full" />
        </div>

        {/* Turnover by Concept */}
        <div className="chart-container">
          <div className="chart-title">Turnover Mix by Concept</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={conceptMix} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [formatCurrency(v)]}
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar dataKey="turnover" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                {conceptMix.map((_, idx) => (
                  <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top / Bottom Stores */}
      <div className="chart-grid">
        <div className="chart-container">
          <div className="chart-title">Top 5 Stores by Store EBITDAR</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={top5} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="store" width={180} tick={{ fontSize: 9 }} />
              <Tooltip
                formatter={(v: unknown) => [formatCurrency(Number(v ?? 0)), 'Store EBITDAR']}
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar dataKey="totalStoreEbitdar" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title">Bottom 5 Stores by Store EBITDAR</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bottom5} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="store" width={180} tick={{ fontSize: 9 }} />
              <Tooltip
                formatter={(v: unknown) => [formatCurrency(Number(v ?? 0)), 'Store EBITDAR']}
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar dataKey="totalStoreEbitdar" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

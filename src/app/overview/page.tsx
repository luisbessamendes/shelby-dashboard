'use client';

import { useMemo } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
  AreaChart, Area,
} from 'recharts';
import { useFilters } from '@/contexts/FilterContext';
import KPICard from '@/components/ui/KPICard';
import { filterByPeriod, aggregate, aggregatePerStore, getMonthlyTrend, aggregateByDimension } from '@/lib/calculations';
import { formatCurrency, formatCompact, formatPercent } from '@/lib/formatters';
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
    return Array.from(map.values()).sort((a, b) => b.totalEbitda - a.totalEbitda);
  }, [periodData]);

  // Trend data (all time, not filtered by period)
  const salesTrend = useMemo(() => getMonthlyTrend(filteredData, 'sales'), [filteredData]);
  const ebitdaTrend = useMemo(() => getMonthlyTrend(filteredData, 'ebitda'), [filteredData]);

  // Mix by concept
  const conceptMix = useMemo(() => {
    const map = aggregateByDimension(periodData, 'concept');
    return Array.from(map.entries())
      .map(([name, agg]) => ({ name, sales: agg.totalSales, ebitda: agg.totalEbitda }))
      .sort((a, b) => b.sales - a.sales);
  }, [periodData]);

  // Waterfall data
  const waterfallData = useMemo(() => {
    const raw = [
      { name: 'Sales', value: portfolio.totalSales, type: 'total' },
      { name: 'Raw Mat.', value: -portfolio.totalRawMaterials, type: 'cost' },
      { name: 'Staff', value: -portfolio.totalStaff, type: 'cost' },
      { name: 'Rents', value: -portfolio.totalRents, type: 'cost' },
      { name: 'Other Costs', value: -(portfolio.totalUtilities + portfolio.totalMaintenance + portfolio.totalBankingCosts + portfolio.totalVat + portfolio.totalOthers), type: 'cost' },
      { name: 'Store Contr.', value: portfolio.totalStoreContribution, type: 'subtotal' },
      { name: 'Admin', value: -portfolio.totalAdminCosts, type: 'cost' },
      { name: 'EBITDA', value: portfolio.totalEbitda, type: 'subtotal' },
      { name: 'CAPEX/CIT', value: -(portfolio.totalCapex + portfolio.totalCit), type: 'cost' },
      { name: 'FCFF', value: portfolio.totalFcff, type: 'subtotal' },
    ];
    let currentBase = 0;
    return raw.map((item) => {
      let base = 0;
      let displayValue = 0;
      let color = '';

      if (item.type === 'total' || item.type === 'subtotal') {
        base = 0;
        displayValue = item.value;
        if (item.name === 'Sales') color = '#3b82f6';
        else if (item.name === 'Store Contr.') color = '#8b5cf6';
        else color = item.value >= 0 ? '#10b981' : '#ef4444';
        currentBase = item.value;
      } else if (item.type === 'cost') {
        base = currentBase + item.value;
        displayValue = Math.abs(item.value);
        color = '#ef4444';
        if (item.name === 'CAPEX/CIT') color = '#f59e0b';
        currentBase += item.value;
      }

      const pct = portfolio.totalSales !== 0 ? Math.abs(item.value) / portfolio.totalSales : 0;

      return {
        ...item,
        base,
        displayValue,
        color,
        pct,
      };
    });
  }, [portfolio]);

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
        <KPICard label="Total Sales" value={portfolio.totalSales} format="compact" icon="💰" />
        <KPICard label="Total Tickets" value={portfolio.totalTickets} format="number" icon="🎫" />
        <KPICard label="Avg Ticket" value={portfolio.avgTicket} format="currency" icon="🧾" />
        <KPICard label="EBITDA" value={portfolio.totalEbitda} format="compact" icon="📈" />
        <KPICard label="FCFF" value={portfolio.totalFcff} format="compact" icon="💵" />
        <KPICard label="Store Contribution" value={portfolio.totalStoreContribution} format="compact" icon="🏪" />
        <KPICard label="Raw Materials %" value={portfolio.rawMaterialsPct} format="percent" icon="🥩" />
        <KPICard label="Staff %" value={portfolio.staffPct} format="percent" icon="👥" />
        <KPICard label="EBITDA %" value={portfolio.ebitdaPct} format="percent" icon="📊" />
        <KPICard label="FCFF %" value={portfolio.fcffPct} format="percent" icon="💸" />
        <KPICard label="Active Stores" value={portfolio.storeCount} format="integer" icon="🏬" />
        <KPICard label="EBITDA-Negative" value={portfolio.ebitdaNegativeCount} format="integer" icon="🔴" />
        <KPICard label="FCFF-Negative" value={portfolio.fcffNegativeCount} format="integer" icon="⚠️" />
        <KPICard label="Store Contr. %" value={portfolio.storeContributionPct} format="percent" icon="🏷️" />
      </div>

      {/* Trend Charts */}
      <div className="chart-grid">
        {/* Sales Trend */}
        <div className="chart-container">
          <div className="chart-title">Sales Trend</div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={salesTrend}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10 }} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [formatCurrency(v), 'Sales']}
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                itemStyle={{ color: '#fff' }}
              />
              <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="url(#salesGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* EBITDA Trend */}
        <div className="chart-container">
          <div className="chart-title">EBITDA Trend</div>
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
                formatter={(v: number) => [formatCurrency(v), 'EBITDA']}
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
          <div className="chart-title">P&L Waterfall: Sales → FCFF</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={waterfallData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10 }} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px' }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{data.name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: data.color }}>
                          <span style={{ fontSize: 13 }}>{formatCurrency(data.value)}</span>
                          <span style={{ fontSize: 11, backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                            {formatPercent(data.pct)}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="base" stackId="a" fill="transparent" fillOpacity={0} />
              <Bar dataKey="displayValue" stackId="a" radius={[4, 4, 4, 4]}>
                {waterfallData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sales by Concept */}
        <div className="chart-container">
          <div className="chart-title">Sales Mix by Concept</div>
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
              <Bar dataKey="sales" fill="#3b82f6" radius={[0, 4, 4, 0]}>
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
          <div className="chart-title">Top 5 Stores by EBITDA</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={top5} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="store" width={180} tick={{ fontSize: 9 }} />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), 'EBITDA']}
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar dataKey="totalEbitda" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title">Bottom 5 Stores by EBITDA</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bottom5} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="store" width={180} tick={{ fontSize: 9 }} />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), 'EBITDA']}
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar dataKey="totalEbitda" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

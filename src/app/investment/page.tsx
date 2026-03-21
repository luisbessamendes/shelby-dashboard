'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ScatterChart, Scatter
} from 'recharts';
import { useFilters } from '@/contexts/FilterContext';
import KPICard from '@/components/ui/KPICard';
import { filterByPeriod, aggregate, aggregatePerStore, aggregateByDimension } from '@/lib/calculations';
import { formatCurrency, formatCompact, formatPercent } from '@/lib/formatters';
import { CHART_COLORS } from '@/lib/constants';

export default function InvestmentPage() {
  const { filteredData, filters, isLoading } = useFilters();

  const periodData = useMemo(() => {
    if (!filters.year || !filters.month) return filteredData;
    return filterByPeriod(filteredData, filters.periodBasis, filters.year, filters.month);
  }, [filteredData, filters]);

  const portfolio = useMemo(() => aggregate(periodData), [periodData]);

  const storeAggs = useMemo(() => {
    const map = aggregatePerStore(periodData);
    return Array.from(map.values());
  }, [periodData]);

  // Waterfall Calculation Logic (EBITDA -> FCFF)
  const waterfallData = useMemo(() => {
    let current = 0;
    const items = [
      { name: 'EBITDA', raw: portfolio.totalEbitda, isTotal: true, color: portfolio.totalEbitda >= 0 ? '#10b981' : '#ef4444' },
      { name: '- CAPEX', raw: -portfolio.totalCapex, color: '#f59e0b' },
      { name: '- CIT', raw: -portfolio.totalCit, color: '#ef4444' },
      { name: '= FCFF', raw: portfolio.totalFcff, isTotal: true, color: portfolio.totalFcff >= 0 ? '#10b981' : '#ef4444' },
    ];

    return items.map(item => {
      let base = 0;
      let val = 0;

      if (item.isTotal) {
        base = 0;
        val = item.raw;
        current = item.raw; // Reset current to the total
      } else {
        const start = current;
        const end = current + item.raw;
        base = Math.min(start, end);
        val = Math.abs(item.raw);
        current = end;
      }

      const pct = portfolio.totalSales !== 0 ? Math.abs(item.raw) / portfolio.totalSales : 0;

      return {
        ...item,
        base,
        displayValue: val,
        tooltipValue: item.raw,
        pct
      };
    });
  }, [portfolio]);

  // FCFF % by Region
  const fcffByRegion = useMemo(() => {
    const map = aggregateByDimension(periodData, 'region');
    return Array.from(map.entries())
      .map(([name, agg]) => ({ 
        name, 
        fcffPct: (agg.fcffPct ?? 0) * 100, 
        totalFcff: agg.totalFcff 
      }))
      .sort((a, b) => b.fcffPct - a.fcffPct);
  }, [periodData]);

  // Top CAPEX Spenders
  const topCapexStores = useMemo(() => {
    return [...storeAggs].sort((a, b) => b.totalCapex - a.totalCapex).slice(0, 10);
  }, [storeAggs]);

  // Scatter: CAPEX vs FCFF
  const capexVsFcff = useMemo(
    () => storeAggs.map((s, i) => ({
      name: s.store,
      x: s.totalCapex,
      y: s.totalFcff,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })),
    [storeAggs]
  );

  if (isLoading) return <div className="loading-spinner"><div className="spinner" /></div>;

  if (filteredData.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">💼</div>
        <div className="empty-state-title">No Data Available</div>
        <div className="empty-state-text">Upload data to view investment and cash flow metrics.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Investment View</h1>
        <p className="page-description">Analyze capital expenditure, cash conversion, and overall returns on investment</p>
      </div>

      <div className="kpi-grid">
        <KPICard 
          label="Total EBITDA" 
          value={portfolio.totalEbitda} 
          format="currency" 
          icon="📈" 
        />
        <KPICard 
          label="Total CAPEX" 
          value={portfolio.totalCapex} 
          format="currency" 
          icon="🏗️" 
        />
        <KPICard 
          label="Total CIT" 
          value={portfolio.totalCit} 
          format="currency" 
          icon="🏛️" 
        />
        <KPICard 
          label="Total FCFF" 
          value={portfolio.totalFcff} 
          format="currency" 
          icon="💵" 
        />
        <KPICard 
          label="FCFF Margin" 
          value={portfolio.fcffPct} 
          format="percent" 
          icon="💸" 
        />
      </div>

      <div className="chart-grid">
        {/* EBITDA to FCFF Waterfall */}
        <div className="chart-container">
          <div className="chart-title">Cash Flow Bridge: EBITDA → FCFF</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={waterfallData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} axisLine={false} tickLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="custom-tooltip" style={{ 
                        background: '#111827', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        padding: '12px', 
                        borderRadius: '8px' 
                      }}>
                        <div style={{ color: '#fff', fontWeight: 600, marginBottom: '4px' }}>{data.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: data.color }}>
                          <span style={{ fontSize: 13 }}>{formatCurrency(data.tooltipValue)}</span>
                          <span style={{ fontSize: 11, backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                            {formatPercent(data.pct)} of Sales
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

        {/* FCFF % by Region */}
        <div className="chart-container">
          <div className="chart-title">FCFF % by Region</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={fcffByRegion}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
              <YAxis tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="custom-tooltip" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px' }}>
                        <div style={{ color: '#fff', fontWeight: 600, marginBottom: '4px' }}>{data.name}</div>
                        <div style={{ color: data.fcffPct >= 0 ? '#10b981' : '#ef4444' }}>FCFF %: {data.fcffPct.toFixed(1)}%</div>
                        <div style={{ color: '#fff', fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>Absolute: {formatCurrency(data.totalFcff)}</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="fcffPct" radius={[4, 4, 0, 0]}>
                {fcffByRegion.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fcffPct >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-grid">
        {/* Top 10 CAPEX */}
        <div className="chart-container">
          <div className="chart-title">Top 10 Stores by CAPEX Spend</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topCapexStores} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
              <YAxis type="category" dataKey="store" width={140} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.8)' }} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="custom-tooltip" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px' }}>
                        <div style={{ color: '#fff', fontWeight: 600, marginBottom: '4px' }}>{data.store}</div>
                        <div style={{ color: '#f59e0b' }}>CAPEX: {formatCurrency(data.totalCapex)}</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="totalCapex" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* CAPEX vs FCFF */}
        <div className="chart-container">
          <div className="chart-title">CAPEX vs FCFF (Investment Efficiency)</div>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" dataKey="x" name="CAPEX" tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
              <YAxis type="number" dataKey="y" name="FCFF" tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="custom-tooltip" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ color: '#fff', fontWeight: 600, marginBottom: '4px' }}>{data.name}</div>
                        <div style={{ color: '#f59e0b', fontSize: '12px' }}>CAPEX: {formatCurrency(data.x)}</div>
                        <div style={{ color: data.y >= 0 ? '#10b981' : '#ef4444', fontSize: '12px' }}>FCFF: {formatCurrency(data.y)}</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter data={capexVsFcff}>
                {capexVsFcff.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} fillOpacity={0.7} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

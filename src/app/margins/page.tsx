'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ScatterChart, Scatter,
} from 'recharts';
import { useFilters } from '@/contexts/FilterContext';
import { filterByPeriod, aggregate, aggregatePerStore } from '@/lib/calculations';
import { formatCurrency, formatCompact } from '@/lib/formatters';
import { CHART_COLORS } from '@/lib/constants';

export default function MarginsPage() {
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

  // Cost Stack (% of Sales)
  const costStack = useMemo(() => {
    if (portfolio.totalSales === 0) return [];
    return [
      { name: 'Raw Mat.', value: (portfolio.rawMaterialsPct ?? 0) * 100, fill: '#ef4444' },
      { name: 'Staff', value: (portfolio.staffPct ?? 0) * 100, fill: '#f59e0b' },
      { name: 'Rents', value: (portfolio.rentsPct ?? 0) * 100, fill: '#8b5cf6' },
      { name: 'Utilities', value: (portfolio.utilitiesPct ?? 0) * 100, fill: '#06b6d4' },
      { name: 'Maint.', value: (portfolio.maintenancePct ?? 0) * 100, fill: '#6b7280' },
      { name: 'Banking', value: (portfolio.bankingCostsPct ?? 0) * 100, fill: '#3b82f6' },
      { name: 'VAT', value: (portfolio.vatPct ?? 0) * 100, fill: '#ec4899' },
      { name: 'Others', value: (portfolio.othersPct ?? 0) * 100, fill: '#9ca3af' },
      { name: 'Admin', value: (portfolio.adminCostsPct ?? 0) * 100, fill: '#a78bfa' },
    ];
  }, [portfolio]);

  // Scatter data: Sales vs EBITDA %
  const salesVsEbitda = useMemo(
    () => storeAggs.map((s, i) => ({
      name: s.store,
      x: s.totalSales,
      y: (s.ebitdaPct ?? 0) * 100,
      concept: 'concept' in s ? String((s as { concept?: string }).concept) : '',
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })),
    [storeAggs]
  );

  // Staff % vs EBITDA %
  const staffVsEbitda = useMemo(
    () => storeAggs.map((s, i) => ({
      name: s.store,
      x: (s.staffPct ?? 0) * 100,
      y: (s.ebitdaPct ?? 0) * 100,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })),
    [storeAggs]
  );

  // Raw Mat % vs EBITDA %
  const rawMatVsEbitda = useMemo(
    () => storeAggs.map((s, i) => ({
      name: s.store,
      x: (s.rawMaterialsPct ?? 0) * 100,
      y: (s.ebitdaPct ?? 0) * 100,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })),
    [storeAggs]
  );

  // Rent % vs EBITDA %
  const rentVsEbitda = useMemo(
    () => storeAggs.map((s, i) => ({
      name: s.store,
      x: (s.rentsPct ?? 0) * 100,
      y: (s.ebitdaPct ?? 0) * 100,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })),
    [storeAggs]
  );

  // Waterfall Calculation Logic
  const waterfallData = useMemo(() => {
    let current = 0;
    const items = [
      { name: 'Sales', raw: portfolio.totalSales, color: '#3b82f6' },
      { name: '- Raw Mat', raw: -portfolio.totalRawMaterials, color: '#ef4444' },
      { name: '- Staff', raw: -portfolio.totalStaff, color: '#ef4444' },
      { name: '- Rents', raw: -portfolio.totalRents, color: '#ef4444' },
      { name: '- Oth. Costs', raw: -(portfolio.totalUtilities + portfolio.totalMaintenance + portfolio.totalBankingCosts + portfolio.totalVat + portfolio.totalOthers), color: '#ef4444' },
      { name: '= EBITDA', raw: portfolio.totalEbitda, isTotal: true, color: portfolio.totalEbitda >= 0 ? '#10b981' : '#ef4444' },
      { name: '- CPX/CIT', raw: -(portfolio.totalCapex + portfolio.totalCit), color: '#f59e0b' },
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

      return {
        ...item,
        base,
        displayValue: val,
        tooltipValue: item.raw
      };
    });
  }, [portfolio]);

  if (isLoading) return <div className="loading-spinner"><div className="spinner" /></div>;

  if (filteredData.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔬</div>
        <div className="empty-state-title">No Data Available</div>
        <div className="empty-state-text">Upload data to view margin diagnostics.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Margin Diagnostics</h1>
        <p className="page-description">Understand profitability drivers and isolate margin leakage</p>
      </div>

      <div className="chart-grid">
        {/* Cost Stack */}
        <div className="chart-container">
          <div className="chart-title">P&L Cost Structure (% of Sales)</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={costStack}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} />
              <YAxis tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [`${(v as number).toFixed(1)}%`]}
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {costStack.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Waterfall */}
        <div className="chart-container">
          <div className="chart-title">Sales → EBITDA → FCFF Waterfall</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={waterfallData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} axisLine={false} tickLine={false} interval={0} />
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
                        <div style={{ color: '#fff' }}>{formatCurrency(data.tooltipValue)}</div>
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
      </div>

      {/* Scatter plots */}
      <div className="chart-grid">
        {/* Sales vs EBITDA % */}
        <div className="chart-container">
          <div className="chart-title">Sales vs EBITDA % (per store)</div>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" name="Sales" tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10 }} />
              <YAxis type="number" dataKey="y" name="EBITDA %" tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
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
                        <div style={{ color: '#fff', fontSize: '12px' }}>Sales: {formatCurrency(data.x)}</div>
                        <div style={{ color: '#fff', fontSize: '12px' }}>EBITDA %: {data.y.toFixed(1)}%</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter data={salesVsEbitda}>
                {salesVsEbitda.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} fillOpacity={0.7} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Staff % vs EBITDA % */}
        <div className="chart-container">
          <div className="chart-title">Staff % vs EBITDA %</div>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" name="Staff %" tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
              <YAxis type="number" dataKey="y" name="EBITDA %" tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
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
                        <div style={{ color: '#fff', fontSize: '12px' }}>Staff %: {data.x.toFixed(1)}%</div>
                        <div style={{ color: '#fff', fontSize: '12px' }}>EBITDA %: {data.y.toFixed(1)}%</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter data={staffVsEbitda}>
                {staffVsEbitda.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} fillOpacity={0.7} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-grid">
        {/* Raw Materials % vs EBITDA % */}
        <div className="chart-container">
          <div className="chart-title">Raw Materials % vs EBITDA %</div>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" name="Raw Mat %" tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
              <YAxis type="number" dataKey="y" name="EBITDA %" tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
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
                        <div style={{ color: '#fff', fontSize: '12px' }}>Raw Mat %: {data.x.toFixed(1)}%</div>
                        <div style={{ color: '#fff', fontSize: '12px' }}>EBITDA %: {data.y.toFixed(1)}%</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter data={rawMatVsEbitda}>
                {rawMatVsEbitda.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} fillOpacity={0.7} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Rent % vs EBITDA % */}
        <div className="chart-container">
          <div className="chart-title">Rent % vs EBITDA %</div>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" name="Rent %" tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
              <YAxis type="number" dataKey="y" name="EBITDA %" tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
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
                        <div style={{ color: '#fff', fontSize: '12px' }}>Rent %: {data.x.toFixed(1)}%</div>
                        <div style={{ color: '#fff', fontSize: '12px' }}>EBITDA %: {data.y.toFixed(1)}%</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter data={rentVsEbitda}>
                {rentVsEbitda.map((entry, idx) => (
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

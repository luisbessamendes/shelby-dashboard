'use client';

import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ScatterChart, Scatter,
} from 'recharts';
import { useFilters } from '@/contexts/FilterContext';
import { useRegisterReportScope } from '@/contexts/ReportContext';
import ProfitWaterfall from '@/components/ui/ProfitWaterfall';
import ProfitMetricSelect from '@/components/ui/ProfitMetricSelect';
import { PROFIT_METRICS, type ProfitMetric, filterByPeriod, aggregate, aggregatePerStore } from '@/lib/calculations';
import { formatCurrency, formatCompact } from '@/lib/formatters';
import { CHART_COLORS } from '@/lib/constants';

export default function MarginsPage() {
  const [profitMetric, setProfitMetric] = useState<ProfitMetric>('store_ebitdar');
  useRegisterReportScope({ profitMetric });
  const profit = PROFIT_METRICS[profitMetric];
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

  // Cost Stack (% of Turnover)
  const costStack = useMemo(() => {
    if (portfolio.totalTurnover === 0) return [];
    return [
      { name: 'Food Cost', value: (portfolio.rawMaterialsPct ?? 0) * 100, fill: '#ef4444' },
      { name: 'Staff', value: (portfolio.staffPct ?? 0) * 100, fill: '#f59e0b' },
      { name: 'Utilities', value: (portfolio.utilitiesPct ?? 0) * 100, fill: '#06b6d4' },
      { name: 'Maint.', value: (portfolio.maintenancePct ?? 0) * 100, fill: '#6b7280' },
      { name: 'Banking', value: (portfolio.bankingCostsPct ?? 0) * 100, fill: '#3b82f6' },
      { name: 'Others', value: (portfolio.othersPct ?? 0) * 100, fill: '#9ca3af' },
      { name: 'Leases', value: (portfolio.rentsPct ?? 0) * 100, fill: '#8b5cf6' },
      { name: 'Headquarter & Admin.', value: (portfolio.adminCostsPct ?? 0) * 100, fill: '#a78bfa' },
    ];
  }, [portfolio]);

  // Scatter data: Turnover vs EBITDA %
  const turnoverVsEbitda = useMemo(
    () => storeAggs.filter(s => s[profit.ratio] !== null).map((s, i) => ({
      name: s.store,
      x: s.totalTurnover,
      y: (s[profit.ratio] ?? 0) * 100,
      concept: 'concept' in s ? String((s as { concept?: string }).concept) : '',
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })),
    [storeAggs, profit.ratio]
  );

  // Staff % vs EBITDA %
  const staffVsEbitda = useMemo(
    () => storeAggs.filter(s => s[profit.ratio] !== null).map((s, i) => ({
      name: s.store,
      x: (s.staffPct ?? 0) * 100,
      y: (s[profit.ratio] ?? 0) * 100,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })),
    [storeAggs, profit.ratio]
  );

  // Food Cost % vs EBITDA %
  const rawMatVsEbitda = useMemo(
    () => storeAggs.filter(s => s[profit.ratio] !== null).map((s, i) => ({
      name: s.store,
      x: (s.rawMaterialsPct ?? 0) * 100,
      y: (s[profit.ratio] ?? 0) * 100,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })),
    [storeAggs, profit.ratio]
  );

  // Rent % vs EBITDA %
  const rentVsEbitda = useMemo(
    () => storeAggs.filter(s => s[profit.ratio] !== null).map((s, i) => ({
      name: s.store,
      x: (s.rentsPct ?? 0) * 100,
      y: (s[profit.ratio] ?? 0) * 100,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })),
    [storeAggs, profit.ratio]
  );

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
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: 16 }}>
          <h1 className="page-title">Margin Diagnostics</h1>
          <ProfitMetricSelect value={profitMetric} onChange={setProfitMetric} />
        </div>
        <p className="page-description">Understand profitability drivers and isolate margin leakage</p>
      </div>

      <div className="chart-grid">
        {/* Cost Stack */}
        <div className="chart-container">
          <div className="chart-title">P&L Cost Structure (% of Turnover)</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={costStack} margin={{ bottom: 55, right: 25 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" />
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
          <div className="chart-title">Sales to VAT to Turnover to FCFF Waterfall</div>
          <ProfitWaterfall metrics={portfolio} mode="full" />
        </div>
      </div>

      {/* Scatter plots */}
      <div className="chart-grid">
        {/* Turnover vs {profit.label} % */}
        <div className="chart-container">
          <div className="chart-title">Turnover vs {profit.label} % (per store)</div>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" name="Turnover" tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10 }} />
              <YAxis type="number" dataKey="y" name={`${profit.label} %`} tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
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
                        <div style={{ color: '#fff', fontSize: '12px' }}>Turnover: {formatCurrency(data.x)}</div>
                        <div style={{ color: '#fff', fontSize: '12px' }}>{profit.label} %: {data.y.toFixed(1)}%</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter data={turnoverVsEbitda}>
                {turnoverVsEbitda.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} fillOpacity={0.7} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Staff % vs {profit.label} % */}
        <div className="chart-container">
          <div className="chart-title">Staff % vs {profit.label} %</div>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" name="Staff %" tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
              <YAxis type="number" dataKey="y" name={`${profit.label} %`} tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
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
                        <div style={{ color: '#fff', fontSize: '12px' }}>{profit.label} %: {data.y.toFixed(1)}%</div>
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
        {/* Food Cost % vs {profit.label} % */}
        <div className="chart-container">
          <div className="chart-title">Food Cost % vs {profit.label} %</div>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" name="Food Cost %" tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
              <YAxis type="number" dataKey="y" name={`${profit.label} %`} tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
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
                        <div style={{ color: '#fff', fontSize: '12px' }}>Food Cost %: {data.x.toFixed(1)}%</div>
                        <div style={{ color: '#fff', fontSize: '12px' }}>{profit.label} %: {data.y.toFixed(1)}%</div>
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

        {/* Leases % vs {profit.label} % */}
        <div className="chart-container">
          <div className="chart-title">Leases % vs {profit.label} %</div>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" name="Leases %" tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
              <YAxis type="number" dataKey="y" name={`${profit.label} %`} tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
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
                        <div style={{ color: '#fff', fontSize: '12px' }}>Leases %: {data.x.toFixed(1)}%</div>
                        <div style={{ color: '#fff', fontSize: '12px' }}>{profit.label} %: {data.y.toFixed(1)}%</div>
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

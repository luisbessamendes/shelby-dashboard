'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ScatterChart, Scatter
} from 'recharts';
import { useFilters } from '@/contexts/FilterContext';
import KPICard from '@/components/ui/KPICard';
import { filterByPeriod, aggregatePerStore } from '@/lib/calculations';
import { formatCurrency, formatCompact } from '@/lib/formatters';
import { CHART_COLORS } from '@/lib/constants';

export default function RankingsPage() {
  const { filteredData, filters, isLoading } = useFilters();

  const periodData = useMemo(() => {
    if (!filters.year || !filters.month) return filteredData;
    return filterByPeriod(filteredData, filters.periodBasis, filters.year, filters.month);
  }, [filteredData, filters]);

  const storeAggs = useMemo(() => {
    const map = aggregatePerStore(periodData);
    return Array.from(map.values());
  }, [periodData]);

  // Sort logic
  const salesSorted = useMemo(() => {
    return [...storeAggs].sort((a, b) => b.totalSales - a.totalSales);
  }, [storeAggs]);

  const ebitdaPctSorted = useMemo(() => {
    // Only sort stores that have significant sales to avoid division by near-zero anomalies
    const valid = storeAggs.filter(s => s.totalSales > 1000);
    return valid.sort((a, b) => (b.ebitdaPct ?? 0) - (a.ebitdaPct ?? 0));
  }, [storeAggs]);

  // KPIs
  const topSalesStore = salesSorted[0];
  const bottomSalesStore = salesSorted[salesSorted.length - 1];
  const topEbitdaStore = ebitdaPctSorted[0];
  const bottomEbitdaStore = ebitdaPctSorted[ebitdaPctSorted.length - 1];

  // Top / Bottom 10s
  const top10Sales = salesSorted.slice(0, 10);
  const bottom10Sales = salesSorted.slice(-10).reverse();
  const top10Ebitda = ebitdaPctSorted.slice(0, 10);
  const bottom10Ebitda = ebitdaPctSorted.slice(-10).reverse();

  // Scatters
  const salesVsEbitda = useMemo(
    () => storeAggs.map((s, i) => ({
      name: s.store,
      x: s.totalSales,
      y: (s.ebitdaPct ?? 0) * 100,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })),
    [storeAggs]
  );

  const staffVsRawMat = useMemo(
    () => storeAggs.map((s, i) => ({
      name: s.store,
      x: (s.staffPct ?? 0) * 100,
      y: (s.rawMaterialsPct ?? 0) * 100,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })),
    [storeAggs]
  );

  if (isLoading) return <div className="loading-spinner"><div className="spinner" /></div>;

  if (filteredData.length === 0 || storeAggs.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🏆</div>
        <div className="empty-state-title">No Data Available</div>
        <div className="empty-state-text">Upload data to view rankings and outliers.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Rankings & Outliers</h1>
        <p className="page-description">Identify extreme performers and operational anomalies across the portfolio</p>
      </div>

      <div className="kpi-grid">
        <KPICard 
          label="Top Store (Sales)" 
          value={topSalesStore?.totalSales ?? 0} 
          format="currency" 
          icon={`🥇 ${topSalesStore?.store ?? ''}`} 
        />
        <KPICard 
          label="Bottom Store (Sales)" 
          value={bottomSalesStore?.totalSales ?? 0} 
          format="currency" 
          icon={`⚠️ ${bottomSalesStore?.store ?? ''}`} 
        />
        <KPICard 
          label="Top Store (EBITDA %)" 
          value={topEbitdaStore?.ebitdaPct ?? 0} 
          format="percent" 
          icon={`👑 ${topEbitdaStore?.store ?? ''}`} 
        />
        <KPICard 
          label="Bottom Store (EBITDA %)" 
          value={bottomEbitdaStore?.ebitdaPct ?? 0} 
          format="percent" 
          icon={`🚩 ${bottomEbitdaStore?.store ?? ''}`} 
        />
      </div>

      {/* Sales Rankings */}
      <div className="chart-grid">
        <div className="chart-container">
          <div className="chart-title">Top 10 Stores by Sales</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={top10Sales} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
              <YAxis type="category" dataKey="store" width={140} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.8)' }} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="custom-tooltip" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px' }}>
                        <div style={{ color: '#fff', fontWeight: 600, marginBottom: '4px' }}>{data.store}</div>
                        <div style={{ color: '#3b82f6' }}>Sales: {formatCurrency(data.totalSales)}</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="totalSales" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title">Bottom 10 Stores by Sales</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={bottom10Sales} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
              <YAxis type="category" dataKey="store" width={140} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.8)' }} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="custom-tooltip" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px' }}>
                        <div style={{ color: '#fff', fontWeight: 600, marginBottom: '4px' }}>{data.store}</div>
                        <div style={{ color: '#ef4444' }}>Sales: {formatCurrency(data.totalSales)}</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="totalSales" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* EBITDA % Rankings */}
      <div className="chart-grid">
        <div className="chart-container">
          <div className="chart-title">Top 10 Stores by EBITDA %</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={top10Ebitda} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
              <YAxis type="category" dataKey="store" width={140} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.8)' }} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="custom-tooltip" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px' }}>
                        <div style={{ color: '#fff', fontWeight: 600, marginBottom: '4px' }}>{data.store}</div>
                        <div style={{ color: '#10b981' }}>EBITDA %: {((data.ebitdaPct ?? 0) * 100).toFixed(1)}%</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="ebitdaPct" fill="#10b981">
                {top10Ebitda.map((entry, idx) => (
                  <Cell key={idx} fill={(entry.ebitdaPct || 0) >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title">Bottom 10 Stores by EBITDA %</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={bottom10Ebitda} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
              <YAxis type="category" dataKey="store" width={140} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.8)' }} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="custom-tooltip" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px' }}>
                        <div style={{ color: '#fff', fontWeight: 600, marginBottom: '4px' }}>{data.store}</div>
                        <div style={{ color: '#ef4444' }}>EBITDA %: {((data.ebitdaPct ?? 0) * 100).toFixed(1)}%</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="ebitdaPct">
                {bottom10Ebitda.map((entry, idx) => (
                  <Cell key={idx} fill={(entry.ebitdaPct || 0) >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Outlier Scatters */}
      <div className="chart-grid">
        <div className="chart-container">
          <div className="chart-title">Outliers: Volume vs Margin</div>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" dataKey="x" name="Sales" tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
              <YAxis type="number" dataKey="y" name="EBITDA %" tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="custom-tooltip" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ color: '#fff', fontWeight: 600, marginBottom: '4px' }}>{data.name}</div>
                        <div style={{ color: '#fff', fontSize: '12px' }}>Sales: {formatCurrency(data.x)}</div>
                        <div style={{ color: '#fff', fontSize: '12px' }}>EBITDA: {data.y.toFixed(1)}%</div>
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

        <div className="chart-container">
          <div className="chart-title">Outliers: Staff % vs Raw Materials %</div>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" dataKey="x" name="Staff %" tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
              <YAxis type="number" dataKey="y" name="Raw Mat %" tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="custom-tooltip" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ color: '#fff', fontWeight: 600, marginBottom: '4px' }}>{data.name}</div>
                        <div style={{ color: '#fff', fontSize: '12px' }}>Staff %: {data.x.toFixed(1)}%</div>
                        <div style={{ color: '#fff', fontSize: '12px' }}>Raw Mat %: {data.y.toFixed(1)}%</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter data={staffVsRawMat}>
                {staffVsRawMat.map((entry, idx) => (
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

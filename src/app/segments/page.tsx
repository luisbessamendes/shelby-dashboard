'use client';

import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { useFilters } from '@/contexts/FilterContext';
import { filterByPeriod, aggregateByDimension } from '@/lib/calculations';
import { formatCurrency, formatCompact, formatPercent } from '@/lib/formatters';
import { CHART_COLORS } from '@/lib/constants';

type Dimension = 'concept' | 'region' | 'store_type' | 'location' | 'legal_entity';

const DIMENSIONS: { value: Dimension; label: string }[] = [
  { value: 'concept', label: 'Concept / Brand' },
  { value: 'region', label: 'Region' },
  { value: 'store_type', label: 'Store Type' },
  { value: 'location', label: 'Location' },
  { value: 'legal_entity', label: 'Legal Entity' },
];

export default function SegmentsPage() {
  const { filteredData, filters, isLoading } = useFilters();
  const [dimension, setDimension] = useState<Dimension>('concept');
  const [sortKey, setSortKey] = useState<string>('ebitdaPct');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const thClass = (key: string) => `${sortKey === key ? 'sorted' : ''}`;

  const periodData = useMemo(() => {
    if (!filters.year || !filters.month) return filteredData;
    return filterByPeriod(filteredData, filters.periodBasis, filters.year, filters.month);
  }, [filteredData, filters]);

  const segmentData = useMemo(() => {
    const map = aggregateByDimension(periodData, dimension);
    const arr = Array.from(map.entries())
      .map(([name, agg]) => ({ name, ...agg }));
      
    arr.sort((a, b) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const va = (a as any)[sortKey];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vb = (b as any)[sortKey];
      const numA = typeof va === 'number' ? va : 0;
      const numB = typeof vb === 'number' ? vb : 0;
      
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === 'asc' ? numA - numB : numB - numA;
    });
    
    return arr;
  }, [periodData, dimension, sortKey, sortDir]);

  // Bubble chart data: Sales vs EBITDA %, bubble size = store count
  const bubbleData = useMemo(
    () => segmentData.map((s, i) => ({
      name: s.name,
      x: s.totalSales,
      y: (s.ebitdaPct ?? 0) * 100,
      z: s.storeCount,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })),
    [segmentData]
  );

  if (isLoading) return <div className="loading-spinner"><div className="spinner" /></div>;

  if (filteredData.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🏷️</div>
        <div className="empty-state-title">No Data Available</div>
        <div className="empty-state-text">Upload data to view segment analysis.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex-between">
          <div>
            <h1 className="page-title">Segment Analysis</h1>
            <p className="page-description">Aggregate performance by business dimension</p>
          </div>
          <div className="filter-group">
            <label className="filter-label">Dimension</label>
            <select
              className="filter-select"
              value={dimension}
              onChange={e => setDimension(e.target.value as Dimension)}
              style={{ minWidth: 160 }}
            >
              {DIMENSIONS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Segment Table */}
      <div className="data-table-container mb-24">
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th className={thClass('name')} onClick={() => handleSort('name')}>{DIMENSIONS.find(d => d.value === dimension)?.label} {sortKey === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th className={thClass('storeCount')} onClick={() => handleSort('storeCount')}># Stores {sortKey === 'storeCount' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th className={thClass('totalSales')} onClick={() => handleSort('totalSales')}>Sales {sortKey === 'totalSales' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th className={thClass('totalTickets')} onClick={() => handleSort('totalTickets')}>Tickets {sortKey === 'totalTickets' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th className={thClass('avgTicket')} onClick={() => handleSort('avgTicket')}>Avg Ticket {sortKey === 'avgTicket' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th className={thClass('rawMaterialsPct')} onClick={() => handleSort('rawMaterialsPct')}>Raw Mat % {sortKey === 'rawMaterialsPct' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th className={thClass('staffPct')} onClick={() => handleSort('staffPct')}>Staff % {sortKey === 'staffPct' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th className={thClass('storeContributionPct')} onClick={() => handleSort('storeContributionPct')}>SC % {sortKey === 'storeContributionPct' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th className={thClass('totalEbitda')} onClick={() => handleSort('totalEbitda')}>EBITDA {sortKey === 'totalEbitda' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th className={thClass('ebitdaPct')} onClick={() => handleSort('ebitdaPct')}>EBITDA % {sortKey === 'ebitdaPct' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th className={thClass('totalFcff')} onClick={() => handleSort('totalFcff')}>FCFF {sortKey === 'totalFcff' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th className={thClass('fcffPct')} onClick={() => handleSort('fcffPct')}>FCFF % {sortKey === 'fcffPct' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              </tr>
            </thead>
            <tbody>
              {segmentData.map(s => (
                <tr key={s.name}>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td className="numeric">{s.storeCount}</td>
                  <td className="numeric">{formatCurrency(s.totalSales)}</td>
                  <td className="numeric">{formatCurrency(s.totalTickets)}</td>
                  <td className="numeric">{formatCurrency(s.avgTicket)}</td>
                  <td className="numeric">{formatPercent(s.rawMaterialsPct)}</td>
                  <td className="numeric">{formatPercent(s.staffPct)}</td>
                  <td className="numeric">{formatPercent(s.storeContributionPct)}</td>
                  <td className={`numeric ${s.totalEbitda >= 0 ? 'cell-positive' : 'cell-negative'}`}>{formatCurrency(s.totalEbitda)}</td>
                  <td className={`numeric ${(s.ebitdaPct ?? 0) >= 0 ? 'cell-positive' : 'cell-negative'}`}>{formatPercent(s.ebitdaPct)}</td>
                  <td className={`numeric ${s.totalFcff >= 0 ? 'cell-positive' : 'cell-negative'}`}>{formatCurrency(s.totalFcff)}</td>
                  <td className={`numeric ${(s.fcffPct ?? 0) >= 0 ? 'cell-positive' : 'cell-negative'}`}>{formatPercent(s.fcffPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="chart-grid">
        {/* EBITDA % by Segment */}
        <div className="chart-container">
          <div className="chart-title">EBITDA % by {DIMENSIONS.find(d => d.value === dimension)?.label}</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={segmentData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [formatPercent(v as number), 'EBITDA %']}
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar dataKey="ebitdaPct" radius={[0, 4, 4, 0]}>
                {segmentData.map((s, idx) => (
                  <Cell key={idx} fill={(s.ebitdaPct ?? 0) >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sales vs EBITDA % Bubble */}
        <div className="chart-container">
          <div className="chart-title">Sales vs EBITDA % (bubble = # stores)</div>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                name="Sales"
                tickFormatter={(v: number) => formatCompact(v)}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="EBITDA %"
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                tick={{ fontSize: 10 }}
              />
              <ZAxis type="number" dataKey="z" range={[100, 800]} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="custom-tooltip" style={{ 
                        background: '#111827', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        padding: '12px', 
                        borderRadius: '8px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                      }}>
                        <div style={{ fontWeight: 600, color: '#fff', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                          {data.name}
                        </div>
                        <div style={{ color: '#fff', fontSize: '13px' }}>
                          <span style={{ opacity: 0.7 }}>Sales:</span> {formatCurrency(data.x)}
                        </div>
                        <div style={{ color: '#fff', fontSize: '13px' }}>
                          <span style={{ opacity: 0.7 }}>EBITDA %:</span> {data.y.toFixed(1)}%
                        </div>
                        <div style={{ color: '#fff', fontSize: '13px' }}>
                          <span style={{ opacity: 0.7 }}>Stores:</span> {data.z}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter data={bubbleData}>
                {bubbleData.map((entry, idx) => (
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

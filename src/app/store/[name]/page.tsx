'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import { useFilters } from '@/contexts/FilterContext';
import { filterByPeriod, aggregate, getMonthlyTrend } from '@/lib/calculations';
import KPICard from '@/components/ui/KPICard';
import { formatCurrency, formatCompact, formatPercent } from '@/lib/formatters';

export default function StoreDetailPage() {
  const params = useParams();
  const storeName = decodeURIComponent(params.name as string);
  const { filteredData, allData, filters, isLoading } = useFilters();

  const [sortKey, setSortKey] = useState<string>('');
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

  // Store data (all months)
  const storeAllData = useMemo(() => allData.filter(d => d.store === storeName), [allData, storeName]);

  // Period-filtered store data
  const storePeriodData = useMemo(() => {
    if (!filters.year || !filters.month) return storeAllData;
    return filterByPeriod(storeAllData, filters.periodBasis, filters.year, filters.month);
  }, [storeAllData, filters]);

  // Store aggregation
  const storeAgg = useMemo(() => aggregate(storePeriodData), [storePeriodData]);

  // Store metadata
  const storeMeta = storeAllData[0];

  // Benchmarks
  const portfolioData = useMemo(() => {
    if (!filters.year || !filters.month) return filteredData;
    return filterByPeriod(filteredData, filters.periodBasis, filters.year, filters.month);
  }, [filteredData, filters]);

  const portfolioAgg = useMemo(() => aggregate(portfolioData), [portfolioData]);

  const conceptData = useMemo(() => {
    if (!storeMeta) return [];
    return portfolioData.filter(d => d.concept === storeMeta.concept);
  }, [portfolioData, storeMeta]);
  const conceptAgg = useMemo(() => aggregate(conceptData), [conceptData]);

  const regionData = useMemo(() => {
    if (!storeMeta) return [];
    return portfolioData.filter(d => d.region === storeMeta.region);
  }, [portfolioData, storeMeta]);
  const regionAgg = useMemo(() => aggregate(regionData), [regionData]);

  const formatData = useMemo(() => {
    if (!storeMeta) return [];
    return portfolioData.filter(d => d.store_type === storeMeta.store_type);
  }, [portfolioData, storeMeta]);
  const formatAgg = useMemo(() => aggregate(formatData), [formatData]);

  // Trends (store)
  const salesTrend = useMemo(() => getMonthlyTrend(storeAllData, 'sales'), [storeAllData]);
  const ebitdaTrend = useMemo(() => getMonthlyTrend(storeAllData, 'ebitda'), [storeAllData]);

  // Cost structure
  const costStructure = useMemo(() => {
    if (storeAgg.totalSales === 0) return [];
    return [
      { name: 'Raw Mat.', value: (storeAgg.rawMaterialsPct ?? 0) * 100, fill: '#ef4444' },
      { name: 'Staff', value: (storeAgg.staffPct ?? 0) * 100, fill: '#f59e0b' },
      { name: 'Rents', value: (storeAgg.rentsPct ?? 0) * 100, fill: '#8b5cf6' },
      { name: 'Utilities', value: (storeAgg.utilitiesPct ?? 0) * 100, fill: '#06b6d4' },
      { name: 'Banking', value: (storeAgg.bankingCostsPct ?? 0) * 100, fill: '#3b82f6' },
      { name: 'VAT', value: (storeAgg.vatPct ?? 0) * 100, fill: '#ec4899' },
      { name: 'Others', value: (storeAgg.othersPct ?? 0) * 100 + (storeAgg.maintenancePct ?? 0) * 100, fill: '#6b7280' },
    ];
  }, [storeAgg]);

  // Diagnostic flags
  const diagnostics = useMemo(() => {
    const flags = [];
    if ((storeAgg.staffPct ?? 0) > 0.30) flags.push({ label: 'High Labor Burden', severity: 'high' as const, desc: `Staff at ${formatPercent(storeAgg.staffPct)} of sales (>30%)` });
    if ((storeAgg.rawMaterialsPct ?? 0) > 0.35) flags.push({ label: 'High Food Cost', severity: 'high' as const, desc: `Raw materials at ${formatPercent(storeAgg.rawMaterialsPct)} of sales (>35%)` });
    if ((storeAgg.rentsPct ?? 0) > 0.15) flags.push({ label: 'High Rent Burden', severity: 'medium' as const, desc: `Rents at ${formatPercent(storeAgg.rentsPct)} of sales (>15%)` });
    if (storeAgg.totalEbitda > 0 && storeAgg.totalFcff < 0) flags.push({ label: 'Weak Cash Conversion', severity: 'high' as const, desc: 'Positive EBITDA but negative FCFF' });
    if (storeAgg.totalEbitda < 0) flags.push({ label: 'EBITDA-Negative', severity: 'high' as const, desc: `EBITDA: ${formatCurrency(storeAgg.totalEbitda)}` });
    if (storeAgg.avgTicket < (portfolioAgg.avgTicket * 0.7)) flags.push({ label: 'Low Ticket Monetization', severity: 'medium' as const, desc: `Avg ticket €${storeAgg.avgTicket.toFixed(2)} vs portfolio €${portfolioAgg.avgTicket.toFixed(2)}` });
    if ((storeAgg.adminCostsPct ?? 0) > 0.05) flags.push({ label: 'Overhead Drag', severity: 'low' as const, desc: `Admin costs at ${formatPercent(storeAgg.adminCostsPct)} of sales` });
    return flags;
  }, [storeAgg, portfolioAgg]);

  if (isLoading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!storeMeta) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🏪</div>
        <div className="empty-state-title">Store Not Found</div>
        <div className="empty-state-text">No data found for &quot;{storeName}&quot;</div>
      </div>
    );
  }

  return (
    <div>
      {/* Store Header */}
      <div className="page-header">
        <h1 className="page-title">{storeName}</h1>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          {[
            { label: 'Concept', value: storeMeta.concept },
            { label: 'Region', value: storeMeta.region },
            { label: 'Type', value: storeMeta.store_type },
            { label: 'Location', value: storeMeta.location },
            { label: 'Legal Entity', value: storeMeta.legal_entity },
          ].map(item => (
            <span key={item.label} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--text-muted)' }}>{item.label}:</span> {item.value}
            </span>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <KPICard label="Sales" value={storeAgg.totalSales} format="compact" />
        <KPICard label="Tickets" value={storeAgg.totalTickets} format="number" />
        <KPICard label="Avg Ticket" value={storeAgg.avgTicket} format="currency" />
        <KPICard label="Raw Materials %" value={storeAgg.rawMaterialsPct} format="percent" />
        <KPICard label="Staff %" value={storeAgg.staffPct} format="percent" />
        <KPICard label="Store Contr. %" value={storeAgg.storeContributionPct} format="percent" />
        <KPICard label="EBITDA %" value={storeAgg.ebitdaPct} format="percent" />
        <KPICard label="FCFF %" value={storeAgg.fcffPct} format="percent" />
      </div>

      {/* Diagnostic Flags */}
      {diagnostics.length > 0 && (
        <div className="card mb-24">
          <div className="card-title">Diagnostic Flags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {diagnostics.map((f, i) => (
              <div key={i} className={`flag-badge ${f.severity}`} title={f.desc}>
                {f.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Benchmark Comparison */}
      <div className="chart-grid">
        <div className="chart-container">
          <div className="chart-title">Benchmark vs Portfolio / Concept / Region</div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th className={thClass('label')} onClick={() => handleSort('label')}>Metric {sortKey === 'label' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className={thClass('s')} onClick={() => handleSort('s')}>Store {sortKey === 's' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className={thClass('p')} onClick={() => handleSort('p')}>Portfolio {sortKey === 'p' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className={thClass('c')} onClick={() => handleSort('c')}>Concept {sortKey === 'c' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className={thClass('r')} onClick={() => handleSort('r')}>Region {sortKey === 'r' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className={thClass('f')} onClick={() => handleSort('f')}>Format {sortKey === 'f' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const arr = [
                    { label: 'EBITDA %', s: storeAgg.ebitdaPct, p: portfolioAgg.ebitdaPct, c: conceptAgg.ebitdaPct, r: regionAgg.ebitdaPct, f: formatAgg.ebitdaPct },
                    { label: 'Staff %', s: storeAgg.staffPct, p: portfolioAgg.staffPct, c: conceptAgg.staffPct, r: regionAgg.staffPct, f: formatAgg.staffPct },
                    { label: 'Raw Mat %', s: storeAgg.rawMaterialsPct, p: portfolioAgg.rawMaterialsPct, c: conceptAgg.rawMaterialsPct, r: regionAgg.rawMaterialsPct, f: formatAgg.rawMaterialsPct },
                    { label: 'Rents %', s: storeAgg.rentsPct, p: portfolioAgg.rentsPct, c: conceptAgg.rentsPct, r: regionAgg.rentsPct, f: formatAgg.rentsPct },
                    { label: 'SC %', s: storeAgg.storeContributionPct, p: portfolioAgg.storeContributionPct, c: conceptAgg.storeContributionPct, r: regionAgg.storeContributionPct, f: formatAgg.storeContributionPct },
                    { label: 'FCFF %', s: storeAgg.fcffPct, p: portfolioAgg.fcffPct, c: conceptAgg.fcffPct, r: regionAgg.fcffPct, f: formatAgg.fcffPct },
                    { label: 'Avg Ticket', s: storeAgg.avgTicket, p: portfolioAgg.avgTicket, c: conceptAgg.avgTicket, r: regionAgg.avgTicket, f: formatAgg.avgTicket },
                  ];
                  
                  if (sortKey) {
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
                  }
                  
                  return arr.map(row => (
                    <tr key={row.label}>
                      <td style={{ fontWeight: 500 }}>{row.label}</td>
                      <td className="numeric" style={{ fontWeight: 600 }}>{row.label.includes('%') ? formatPercent(row.s) : formatCurrency(row.s as number)}</td>
                      <td className="numeric" style={{ color: 'var(--text-secondary)' }}>{row.label.includes('%') ? formatPercent(row.p) : formatCurrency(row.p as number)}</td>
                      <td className="numeric" style={{ color: 'var(--text-secondary)' }}>{row.label.includes('%') ? formatPercent(row.c) : formatCurrency(row.c as number)}</td>
                      <td className="numeric" style={{ color: 'var(--text-secondary)' }}>{row.label.includes('%') ? formatPercent(row.r) : formatCurrency(row.r as number)}</td>
                      <td className="numeric" style={{ color: 'var(--text-secondary)' }}>{row.label.includes('%') ? formatPercent(row.f) : formatCurrency(row.f as number)}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cost Structure */}
        <div className="chart-container">
          <div className="chart-title">Cost Structure (% of Sales)</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={costStructure}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [`${(v as number).toFixed(1)}%`]}
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                itemStyle={{ color: '#fff' }}
              /><Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {costStructure.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trend Charts */}
      <div className="chart-grid">
        <div className="chart-container">
          <div className="chart-title">Sales Trend</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={salesTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10 }} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [formatCurrency(v), 'Sales']}
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                itemStyle={{ color: '#fff' }}
              /><Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title">EBITDA Trend</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={ebitdaTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10 }} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [formatCurrency(v), 'EBITDA']}
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                itemStyle={{ color: '#fff' }}
              /><Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

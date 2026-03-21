'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFilters } from '@/contexts/FilterContext';
import { filterByPeriod, aggregatePerStore } from '@/lib/calculations';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/formatters';

type SortKey = string;
type SortDir = 'asc' | 'desc';

export default function PerformancePage() {
  const { filteredData, filters, isLoading } = useFilters();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('totalEbitda');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const periodData = useMemo(() => {
    if (!filters.year || !filters.month) return filteredData;
    return filterByPeriod(filteredData, filters.periodBasis, filters.year, filters.month);
  }, [filteredData, filters]);

  const storeRows = useMemo(() => {
    const map = aggregatePerStore(periodData);
    let rows = Array.from(map.values());

    // Search
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.store.toLowerCase().includes(q) ||
        r.concept.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q)
      );
    }

    // Sort
    rows.sort((a, b) => {
      const va = (a as unknown as Record<string, unknown>)[sortKey];
      const vb = (b as unknown as Record<string, unknown>)[sortKey];
      const numA = typeof va === 'number' ? va : 0;
      const numB = typeof vb === 'number' ? vb : 0;
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === 'asc' ? numA - numB : numB - numA;
    });

    return rows;
  }, [periodData, search, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const thClass = (key: string) => `${sortKey === key ? 'sorted' : ''}`;

  const exportCSV = () => {
    const headers = ['Store', 'Concept', 'Region', 'Type', 'Location', 'Legal Entity', 'Sales', 'Tickets', 'Avg Ticket', 'Raw Mat', 'Raw Mat %', 'Staff', 'Staff %', 'Rents', 'Rents %', 'Utilities', 'Maintenance', 'Banking', 'VAT', 'Others', 'Store Contr.', 'SC %', 'Admin', 'Admin %', 'EBITDA', 'EBITDA %', 'CAPEX', 'CIT', 'FCFF', 'FCFF %'];
    const csvRows = storeRows.map(r => [
      r.store, r.concept, r.region, r.store_type, r.location, r.legal_entity,
      r.totalSales, r.totalTickets, r.avgTicket,
      r.totalRawMaterials, r.rawMaterialsPct,
      r.totalStaff, r.staffPct,
      r.totalRents, r.rentsPct,
      r.totalUtilities, r.totalMaintenance, r.totalBankingCosts, r.totalVat, r.totalOthers,
      r.totalStoreContribution, r.storeContributionPct,
      r.totalAdminCosts, r.adminCostsPct,
      r.totalEbitda, r.ebitdaPct,
      r.totalCapex, r.totalCit,
      r.totalFcff, r.fcffPct,
    ].join(','));
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qsf_performance_${filters.year}_${filters.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="loading-spinner"><div className="spinner" /></div>;

  if (filteredData.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <div className="empty-state-title">No Data Available</div>
        <div className="empty-state-text">Upload data to view the performance table.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Portfolio Performance Table</h1>
        <p className="page-description">
          Store-level metrics — {storeRows.length} stores — sortable, searchable, exportable
        </p>
      </div>

      <div className="data-table-container">
        <div className="data-table-toolbar">
          <input
            className="data-table-search"
            type="text"
            placeholder="Search stores, concepts, regions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="btn btn-secondary btn-sm" onClick={exportCSV}>
            📥 Export CSV
          </button>
        </div>

        <div className="data-table-wrapper" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th className={thClass('store')} onClick={() => handleSort('store')}>Store {sortKey === 'store' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th className={thClass('concept')} onClick={() => handleSort('concept')}>Concept</th>
                <th className={thClass('region')} onClick={() => handleSort('region')}>Region</th>
                <th className={thClass('store_type')} onClick={() => handleSort('store_type')}>Type</th>
                <th className={thClass('totalSales')} onClick={() => handleSort('totalSales')}>Sales {sortKey === 'totalSales' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th className={thClass('totalTickets')} onClick={() => handleSort('totalTickets')}>Tickets</th>
                <th className={thClass('avgTicket')} onClick={() => handleSort('avgTicket')}>Avg Ticket</th>
                <th className={thClass('rawMaterialsPct')} onClick={() => handleSort('rawMaterialsPct')}>Raw Mat %</th>
                <th className={thClass('staffPct')} onClick={() => handleSort('staffPct')}>Staff %</th>
                <th className={thClass('rentsPct')} onClick={() => handleSort('rentsPct')}>Rents %</th>
                <th className={thClass('storeContributionPct')} onClick={() => handleSort('storeContributionPct')}>SC %</th>
                <th className={thClass('totalEbitda')} onClick={() => handleSort('totalEbitda')}>EBITDA {sortKey === 'totalEbitda' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th className={thClass('ebitdaPct')} onClick={() => handleSort('ebitdaPct')}>EBITDA %</th>
                <th className={thClass('totalFcff')} onClick={() => handleSort('totalFcff')}>FCFF</th>
                <th className={thClass('fcffPct')} onClick={() => handleSort('fcffPct')}>FCFF %</th>
              </tr>
            </thead>
            <tbody>
              {storeRows.map(r => (
                <tr
                  key={r.store}
                  className="clickable"
                  onClick={() => router.push(`/store/${encodeURIComponent(r.store)}`)}
                >
                  <td style={{ fontWeight: 500 }}>{r.store}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{r.concept}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{r.region}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{r.store_type}</td>
                  <td className="numeric">{formatCurrency(r.totalSales)}</td>
                  <td className="numeric">{formatNumber(r.totalTickets)}</td>
                  <td className="numeric">{formatCurrency(r.avgTicket)}</td>
                  <td className="numeric">{formatPercent(r.rawMaterialsPct)}</td>
                  <td className={`numeric ${(r.staffPct ?? 0) > 0.30 ? 'cell-warning' : ''}`}>{formatPercent(r.staffPct)}</td>
                  <td className="numeric">{formatPercent(r.rentsPct)}</td>
                  <td className={`numeric ${(r.storeContributionPct ?? 0) < 0 ? 'cell-negative' : ''}`}>{formatPercent(r.storeContributionPct)}</td>
                  <td className={`numeric ${r.totalEbitda >= 0 ? 'cell-positive' : 'cell-negative'}`}>{formatCurrency(r.totalEbitda)}</td>
                  <td className={`numeric ${(r.ebitdaPct ?? 0) >= 0 ? 'cell-positive' : 'cell-negative'}`}>{formatPercent(r.ebitdaPct)}</td>
                  <td className={`numeric ${r.totalFcff >= 0 ? 'cell-positive' : 'cell-negative'}`}>{formatCurrency(r.totalFcff)}</td>
                  <td className={`numeric ${(r.fcffPct ?? 0) >= 0 ? 'cell-positive' : 'cell-negative'}`}>{formatPercent(r.fcffPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

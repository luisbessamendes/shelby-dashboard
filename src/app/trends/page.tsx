'use client';

import { useMemo, useState } from 'react';
import { useFilters } from '@/contexts/FilterContext';
import { getYearlyComparison } from '@/lib/calculations';
import type { TrendBasis } from '@/lib/calculations';
import TrendsCharts from './TrendsCharts';
import TrendYearlyTable from './TrendYearlyTable';

export default function TrendsPage() {
  const { filteredData, filters, availableYears, isLoading } = useFilters();
  const [trendBasis, setTrendBasis] = useState<TrendBasis>('monthly');

  const yearlyComparison = useMemo(() => {
    if (!filters.year || !filters.month) return [];
    return getYearlyComparison(filteredData, filters.periodBasis, filters.month, availableYears);
  }, [filteredData, filters.periodBasis, filters.year, filters.month, availableYears]);

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
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 className="page-title">Trend Analysis</h1>
          <p className="page-description">{trendBasis === 'ltm' ? 'LTM' : 'Monthly'} performance trends across the portfolio</p>
        </div>
        <div className="filter-group">
          <label className="filter-label">Trend View</label>
          <select
            className="filter-select"
            value={trendBasis}
            onChange={e => setTrendBasis(e.target.value as TrendBasis)}
            style={{ minWidth: 120 }}
          >
            <option value="monthly">Monthly</option>
            <option value="ltm">LTM</option>
          </select>
        </div>
      </div>

      {/* Modular Charts Component */}
      <TrendsCharts filteredData={filteredData} trendBasis={trendBasis} />

      {/* Modular Yearly Table Component */}
      <TrendYearlyTable 
        data={yearlyComparison} 
        basis={filters.periodBasis} 
        month={filters.month ?? 0} 
      />
    </div>
  );
}

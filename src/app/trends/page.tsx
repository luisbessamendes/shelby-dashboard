'use client';

import { useMemo } from 'react';
import { useFilters } from '@/contexts/FilterContext';
import { getYearlyComparison } from '@/lib/calculations';
import TrendsCharts from './TrendsCharts';
import TrendYearlyTable from './TrendYearlyTable';

export default function TrendsPage() {
  const { filteredData, filters, availableYears, isLoading } = useFilters();

  const yearlyComparison = useMemo(() => {
    if (!filters.year || !filters.month) return [];
    return getYearlyComparison(filteredData, filters.periodBasis, filters.month, availableYears);
  }, [filteredData, filters.periodBasis, filters.month, availableYears]);

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
      <div className="page-header">
        <h1 className="page-title">Trend Analysis</h1>
        <p className="page-description">Monthly performance trends across the portfolio</p>
      </div>

      {/* Modular Charts Component */}
      <TrendsCharts filteredData={filteredData} />

      {/* Modular Yearly Table Component */}
      <TrendYearlyTable 
        data={yearlyComparison} 
        basis={filters.periodBasis} 
        month={filters.month ?? 0} 
      />
    </div>
  );
}

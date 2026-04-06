'use client';

import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useFilters } from '@/contexts/FilterContext';
import { getMonthlyTrend, getRatioTrend, getYearlyComparison } from '@/lib/calculations';
import { formatCurrency, formatCompact, formatPercent, formatNumber, formatPercentPP, formatTrend } from '@/lib/formatters';

export default function TrendsPage() {
  const { filteredData, filters, availableYears, isLoading } = useFilters();
  const [activeMetric, setActiveMetric] = useState<any>('sales');
  const [activeRatio, setActiveRatio] = useState<any>('ebitda');

  const absData = useMemo(() => getMonthlyTrend(filteredData, activeMetric), [filteredData, activeMetric]);
  const ratData = useMemo(() => getRatioTrend(filteredData, activeRatio), [filteredData, activeRatio]);
  const yearlyComp = useMemo(() => getYearlyComparison(filteredData, filters.periodBasis, filters.month ?? 1, availableYears), [filteredData, filters, availableYears]);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Trend Analysis</h1>
      </div>
      <div className="chart-container mb-24">
        <div className="chart-title">Absolute Metrics</div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={absData}>
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-container mb-24">
        <div className="chart-title">Ratio Metrics</div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={ratData}>
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#10b981" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="data-table-container mt-24">
        <div className="data-table-toolbar"><h3>Annual Performance Benchmark</h3></div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Year</th>
              <th className="text-center">Sales</th>
              <th className="text-center">EBITDA %</th>
            </tr>
          </thead>
          <tbody>
            {yearlyComp.map(row => (
              <tr key={row.year}>
                <td>{row.year}</td>
                <td className="text-center">{formatCurrency(row.metrics.totalSales)}</td>
                <td className="text-center">{formatPercent(row.metrics.ebitdaPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import { formatCurrency, formatNumber, formatPercent, formatCompact } from '@/lib/formatters';

interface KPICardProps {
  label: string;
  value: number | null | undefined;
  format: 'currency' | 'number' | 'percent' | 'integer' | 'compact';
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: string;
}

export default function KPICard({ label, value, format, trend, icon }: KPICardProps) {
  const formattedValue = (() => {
    if (value == null) return '—';
    switch (format) {
      case 'currency': return formatCurrency(value);
      case 'compact': return formatCompact(value);
      case 'number': return formatNumber(value);
      case 'integer': return formatNumber(Math.round(value));
      case 'percent': return formatPercent(value);
      default: return String(value);
    }
  })();

  return (
    <div className="kpi-card">
      <div className="kpi-label">
        {icon && <span style={{ marginRight: 6 }}>{icon}</span>}
        {label}
      </div>
      <div className="kpi-value">{formattedValue}</div>
      {trend && (
        <div className={`kpi-trend ${trend.isPositive ? 'positive' : 'negative'}`}>
          <span>{trend.isPositive ? '▲' : '▼'}</span>
          <span>{Math.abs(trend.value * 100).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

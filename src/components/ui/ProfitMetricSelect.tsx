'use client';

import { PROFIT_METRICS, type ProfitMetric } from '@/lib/calculations';

export default function ProfitMetricSelect({ value, onChange }: { value: ProfitMetric; onChange: (value: ProfitMetric) => void }) {
  return <label className="filter-group">
    <span className="filter-label">Profit Measure</span>
    <select className="filter-select" value={value} onChange={event => onChange(event.target.value as ProfitMetric)} style={{ minWidth: 160 }}>
      {Object.entries(PROFIT_METRICS).map(([key, metric]) => <option key={key} value={key}>{metric.label}</option>)}
    </select>
  </label>;
}

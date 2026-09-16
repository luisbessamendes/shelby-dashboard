'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { buildProfitBridge } from '@/lib/profit-bridge';
import { formatCompact, formatCurrency, formatPercent } from '@/lib/formatters';
import type { AggregatedMetrics } from '@/lib/types';

export default function ProfitWaterfall({ metrics, mode = 'operating' }: {
  metrics: AggregatedMetrics;
  mode?: 'operating' | 'full' | 'cash';
}) {
  const data = useMemo(() => buildProfitBridge(metrics, mode), [metrics, mode]);
  const hasVariance = data.some(step => step.variance !== null);
  return (
    <>
      {hasVariance && <p className="pnl-notice" role="status">Some uploaded subtotals do not reconcile with their component costs. Source values are preserved.</p>}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <div style={{ minWidth: mode === 'cash' ? 650 : 1000 }}>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={data} margin={{ bottom: 65, top: 12, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" interval={0} angle={-35} textAnchor="end" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={formatCompact} tick={{ fontSize: 10 }} width={70} />
              <ReferenceLine y={0} stroke="var(--text-muted)" />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as (typeof data)[number];
                return <div style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: 8, padding: 12 }}>
                  <strong>{point.name}</strong>
                  <div>{formatCurrency(point.value)}</div>
                  {point.pct !== null && <div>{formatPercent(point.pct)} of Turnover</div>}
                  {point.variance !== null && <div>Source variance: {formatCurrency(point.variance)}</div>}
                </div>;
              }} />
              <Bar dataKey="range" isAnimationActive={false}>
                {data.map(point => <Cell key={point.name} fill={point.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

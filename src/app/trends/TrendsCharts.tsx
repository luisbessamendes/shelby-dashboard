'use client';

import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';
import { getMonthlyTrend, getRatioTrend } from '@/lib/calculations';
import { formatCurrency, formatCompact, formatNumber, formatPercent } from '@/lib/formatters';
import type { TrendBasis } from '@/lib/calculations';
import type { StoreMonthRecord } from '@/lib/types';

interface TrendsChartsProps {
  filteredData: StoreMonthRecord[];
  trendBasis: TrendBasis;
}

type MetricKey = 'turnover' | 'sales' | 'tickets' | 'ebitda' | 'fcff' | 'store_ebitda' | 'store_ebitdar';
type RatioKey = 'store_ebitdar' | 'store_ebitda' | 'ebitda' | 'staff' | 'raw_materials' | 'fcff';

const toNumber = (value: unknown) => typeof value === 'number' ? value : Number(value ?? 0);
const tooltipContentStyle = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
};
const tooltipTextStyle = { color: 'var(--text-primary)' };

export default function TrendsCharts({ filteredData, trendBasis }: TrendsChartsProps) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>('turnover');
  const [activeRatio, setActiveRatio] = useState<RatioKey>('store_ebitdar');

  const absoluteMetrics: { value: MetricKey; label: string; color: string }[] = [
    { value: 'turnover', label: 'Turnover', color: '#3b82f6' },
    { value: 'sales', label: 'Gross Sales', color: '#06b6d4' },
    { value: 'tickets', label: 'Tickets', color: '#8b5cf6' },
    { value: 'store_ebitdar', label: 'Store EBITDAR', color: '#10b981' },
    { value: 'ebitda', label: 'EBITDA', color: '#10b981' },
    { value: 'fcff', label: 'FCFF', color: '#f59e0b' },
    { value: 'store_ebitda', label: 'Store EBITDA', color: '#06b6d4' },
  ];

  const ratioMetrics: { value: RatioKey; label: string; color: string }[] = [
    { value: 'store_ebitdar', label: 'Store EBITDAR %', color: '#10b981' },
    { value: 'store_ebitda', label: 'Store EBITDA %', color: '#06b6d4' },
    { value: 'ebitda', label: 'EBITDA %', color: '#10b981' },
    { value: 'staff', label: 'Staff %', color: '#f59e0b' },
    { value: 'raw_materials', label: 'Food Cost %', color: '#ef4444' },
    { value: 'fcff', label: 'FCFF %', color: '#3b82f6' },
  ];

  const trendData = useMemo(() => getMonthlyTrend(filteredData, activeMetric, trendBasis), [filteredData, activeMetric, trendBasis]);
  const ratioData = useMemo(() => getRatioTrend(filteredData, activeRatio, 'turnover', trendBasis), [filteredData, activeRatio, trendBasis]);

  const allAbsData = useMemo(() => {
    const ebitdarT = getMonthlyTrend(filteredData, 'store_ebitdar', trendBasis);
    const ebitdaT = getMonthlyTrend(filteredData, 'ebitda', trendBasis);
    const storeEbitdaT = getMonthlyTrend(filteredData, 'store_ebitda', trendBasis);
    const ebitdaByPeriod = new Map(ebitdaT.map(s => [s.period, s.value]));
    const storeEbitdaByPeriod = new Map(storeEbitdaT.map(s => [s.period, s.value]));
    const periods = ebitdarT.map(s => s.period);
    return periods.map((p) => ({
      period: p,
      storeEbitdar: ebitdarT.find(s => s.period === p)?.value ?? null,
      ebitda: ebitdaByPeriod.get(p) ?? null,
      storeEbitda: storeEbitdaByPeriod.get(p) ?? null,
    }));
  }, [filteredData, trendBasis]);

  const allRatioData = useMemo(() => {
    const ebitdarR = getRatioTrend(filteredData, 'store_ebitdar', 'turnover', trendBasis);
    const staffR = getRatioTrend(filteredData, 'staff', 'turnover', trendBasis);
    const rawMatR = getRatioTrend(filteredData, 'raw_materials', 'turnover', trendBasis);
    const staffByPeriod = new Map(staffR.map(s => [s.period, s.value]));
    const rawMatByPeriod = new Map(rawMatR.map(s => [s.period, s.value]));
    const periods = ebitdarR.map(s => s.period);
    return periods.map((p, i) => ({
      period: p,
      store_ebitdar_pct: ebitdarR[i]?.value == null ? null : ebitdarR[i].value! * 100,
      staff_pct: staffByPeriod.get(p) == null ? null : staffByPeriod.get(p)! * 100,
      raw_mat_pct: rawMatByPeriod.get(p) == null ? null : rawMatByPeriod.get(p)! * 100,
    }));
  }, [filteredData, trendBasis]);

  const currentColor = absoluteMetrics.find(m => m.value === activeMetric)?.color ?? '#3b82f6';
  const currentRatioColor = ratioMetrics.find(m => m.value === activeRatio)?.color ?? '#10b981';
  const trendLabel = trendBasis === 'ltm' ? 'LTM' : 'Monthly';
  const formatActiveMetric = (value: unknown) => (
    activeMetric === 'tickets' ? formatNumber(toNumber(value)) : formatCurrency(toNumber(value))
  );

  return (
    <>
      {/* Absolute metric selector + chart */}
      <div className="chart-container mb-24">
        <div className="chart-title" style={{ flexWrap: 'wrap', gap: 12 }}>
          <span>Absolute Metrics Trend ({trendLabel})</span>
          <select aria-label="Absolute metric" className="filter-select" value={activeMetric} onChange={event => setActiveMetric(event.target.value as MetricKey)}>
            {absoluteMetrics.map(metric => <option key={metric.value} value={metric.value}>{metric.label}</option>)}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={trendData}>
            <defs>
              <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={currentColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={currentColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis interval="preserveStartEnd" dataKey="period" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(v: unknown) => [formatActiveMetric(v), absoluteMetrics.find(m => m.value === activeMetric)?.label]}
              contentStyle={tooltipContentStyle}
              itemStyle={tooltipTextStyle}
              labelStyle={tooltipTextStyle}
            />
            <Area type="monotone" dataKey="value" stroke={currentColor} fill="url(#trendGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Ratio metric selector + chart */}
      <div className="chart-container mb-24">
        <div className="chart-title" style={{ flexWrap: 'wrap', gap: 12 }}>
          <span>Ratio Metrics Trend ({trendLabel})</span>
          <select aria-label="Ratio metric" className="filter-select" value={activeRatio} onChange={event => setActiveRatio(event.target.value as RatioKey)}>
            {ratioMetrics.map(metric => <option key={metric.value} value={metric.value}>{metric.label}</option>)}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={ratioData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis interval="preserveStartEnd" dataKey="period" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(v: number) => formatPercent(v)} tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(v: unknown) => [formatPercent(toNumber(v)), ratioMetrics.find(m => m.value === activeRatio)?.label]}
              contentStyle={tooltipContentStyle}
              itemStyle={tooltipTextStyle}
              labelStyle={tooltipTextStyle}
            />
            <Line type="monotone" dataKey="value" stroke={currentRatioColor} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Multi-metric comparison */}
      <div className="chart-grid">
        <div className="chart-container">
          <div className="chart-title" style={{ flexWrap: 'wrap', gap: 12 }}>Store EBITDAR / Store EBITDA / EBITDA ({trendLabel})</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={allAbsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis interval="preserveStartEnd" dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: unknown, name: unknown) => [formatCurrency(toNumber(v)), String(name).toUpperCase()]}
                contentStyle={tooltipContentStyle}
                itemStyle={tooltipTextStyle}
                labelStyle={tooltipTextStyle}
              />
              <Line type="monotone" dataKey="storeEbitdar" stroke="#10b981" strokeWidth={2} dot={false} name="Store EBITDAR" />
              <Line type="monotone" dataKey="ebitda" stroke="#f59e0b" strokeWidth={2} dot={false} name="EBITDA" />
              <Line type="monotone" dataKey="storeEbitda" stroke="#06b6d4" strokeWidth={2} dot={false} name="Store EBITDA" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title" style={{ flexWrap: 'wrap', gap: 12 }}>Store EBITDAR % / Staff % / Food Cost % ({trendLabel})</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={allRatioData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis interval="preserveStartEnd" dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: unknown, name: unknown) => [`${toNumber(v).toFixed(1)}%`, String(name)]}
                contentStyle={tooltipContentStyle}
                itemStyle={tooltipTextStyle}
                labelStyle={tooltipTextStyle}
              />
              <Line type="monotone" dataKey="store_ebitdar_pct" stroke="#10b981" strokeWidth={2} dot={false} name="Store EBITDAR %" />
              <Line type="monotone" dataKey="staff_pct" stroke="#f59e0b" strokeWidth={2} dot={false} name="Staff %" />
              <Line type="monotone" dataKey="raw_mat_pct" stroke="#ef4444" strokeWidth={2} dot={false} name="Food Cost %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

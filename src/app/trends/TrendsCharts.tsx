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

type MetricKey = 'turnover' | 'sales' | 'tickets' | 'ebitda' | 'fcff' | 'store_contribution';
type RatioKey = 'ebitda' | 'staff' | 'raw_materials' | 'fcff';

const toNumber = (value: unknown) => typeof value === 'number' ? value : Number(value ?? 0);
const tooltipContentStyle = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
};
const tooltipTextStyle = { color: 'var(--text-primary)' };

export default function TrendsCharts({ filteredData, trendBasis }: TrendsChartsProps) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>('turnover');
  const [activeRatio, setActiveRatio] = useState<RatioKey>('ebitda');

  const absoluteMetrics: { value: MetricKey; label: string; color: string }[] = [
    { value: 'turnover', label: 'Turnover', color: '#3b82f6' },
    { value: 'sales', label: 'Gross Sales', color: '#06b6d4' },
    { value: 'tickets', label: 'Tickets', color: '#8b5cf6' },
    { value: 'ebitda', label: 'EBITDA', color: '#10b981' },
    { value: 'fcff', label: 'FCFF', color: '#f59e0b' },
    { value: 'store_contribution', label: 'Store Contribution', color: '#06b6d4' },
  ];

  const ratioMetrics: { value: RatioKey; label: string; color: string }[] = [
    { value: 'ebitda', label: 'EBITDA %', color: '#10b981' },
    { value: 'staff', label: 'Staff %', color: '#f59e0b' },
    { value: 'raw_materials', label: 'Raw Materials %', color: '#ef4444' },
    { value: 'fcff', label: 'FCFF %', color: '#3b82f6' },
  ];

  const trendData = useMemo(() => getMonthlyTrend(filteredData, activeMetric, trendBasis), [filteredData, activeMetric, trendBasis]);
  const ratioData = useMemo(() => getRatioTrend(filteredData, activeRatio, 'turnover', trendBasis), [filteredData, activeRatio, trendBasis]);

  const allAbsData = useMemo(() => {
    const turnoverT = getMonthlyTrend(filteredData, 'turnover', trendBasis);
    const ebitdaT = getMonthlyTrend(filteredData, 'ebitda', trendBasis);
    const fcffT = getMonthlyTrend(filteredData, 'fcff', trendBasis);
    const ebitdaByPeriod = new Map(ebitdaT.map(s => [s.period, s.value]));
    const fcffByPeriod = new Map(fcffT.map(s => [s.period, s.value]));
    const periods = turnoverT.map(s => s.period);
    return periods.map((p) => ({
      period: p,
      turnover: turnoverT.find(s => s.period === p)?.value ?? 0,
      ebitda: ebitdaByPeriod.get(p) ?? 0,
      fcff: fcffByPeriod.get(p) ?? 0,
    }));
  }, [filteredData, trendBasis]);

  const allRatioData = useMemo(() => {
    const ebitdaR = getRatioTrend(filteredData, 'ebitda', 'turnover', trendBasis);
    const staffR = getRatioTrend(filteredData, 'staff', 'turnover', trendBasis);
    const rawMatR = getRatioTrend(filteredData, 'raw_materials', 'turnover', trendBasis);
    const staffByPeriod = new Map(staffR.map(s => [s.period, s.value]));
    const rawMatByPeriod = new Map(rawMatR.map(s => [s.period, s.value]));
    const periods = ebitdaR.map(s => s.period);
    return periods.map((p, i) => ({
      period: p,
      ebitda_pct: ((ebitdaR[i]?.value ?? 0) * 100),
      staff_pct: ((staffByPeriod.get(p) ?? 0) * 100),
      raw_mat_pct: ((rawMatByPeriod.get(p) ?? 0) * 100),
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
        <div className="chart-title">
          <span>Absolute Metrics Trend ({trendLabel})</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {absoluteMetrics.map(m => (
              <button
                key={m.value}
                className={`btn btn-sm ${activeMetric === m.value ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveMetric(m.value)}
                style={activeMetric === m.value ? { background: m.color } : {}}
              >
                {m.label}
              </button>
            ))}
          </div>
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
            <XAxis dataKey="period" tick={{ fontSize: 10 }} />
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
        <div className="chart-title">
          <span>Ratio Metrics Trend ({trendLabel})</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {ratioMetrics.map(m => (
              <button
                key={m.value}
                className={`btn btn-sm ${activeRatio === m.value ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveRatio(m.value)}
                style={activeRatio === m.value ? { background: m.color } : {}}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={ratioData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} />
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
          <div className="chart-title">Turnover / EBITDA / FCFF Overlay ({trendLabel})</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={allAbsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: unknown, name: unknown) => [formatCurrency(toNumber(v)), String(name).toUpperCase()]}
                contentStyle={tooltipContentStyle}
                itemStyle={tooltipTextStyle}
                labelStyle={tooltipTextStyle}
              />
              <Line type="monotone" dataKey="turnover" stroke="#3b82f6" strokeWidth={2} dot={false} name="Turnover" />
              <Line type="monotone" dataKey="ebitda" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="fcff" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title">EBITDA % / Staff % / Raw Mat % Overlay ({trendLabel})</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={allRatioData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: unknown, name: unknown) => [`${toNumber(v).toFixed(1)}%`, String(name)]}
                contentStyle={tooltipContentStyle}
                itemStyle={tooltipTextStyle}
                labelStyle={tooltipTextStyle}
              />
              <Line type="monotone" dataKey="ebitda_pct" stroke="#10b981" strokeWidth={2} dot={false} name="EBITDA %" />
              <Line type="monotone" dataKey="staff_pct" stroke="#f59e0b" strokeWidth={2} dot={false} name="Staff %" />
              <Line type="monotone" dataKey="raw_mat_pct" stroke="#ef4444" strokeWidth={2} dot={false} name="Raw Mat %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

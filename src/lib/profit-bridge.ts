import type { AggregatedMetrics } from './types';

interface ProfitStep {
  name: string;
  value: number;
  total?: boolean;
  revenue?: boolean;
}

export function buildProfitBridge(m: AggregatedMetrics, mode: 'operating' | 'full' | 'cash' = 'operating') {
  const steps: ProfitStep[] = mode === 'cash' ? [
    { name: 'Store EBITDAR', value: m.totalStoreEbitdar, total: true },
  ] : [
    { name: 'Gross Sales', value: m.totalSales, total: true, revenue: true },
    { name: 'VAT', value: -m.totalVat, revenue: true },
    { name: 'Turnover', value: m.totalTurnover, total: true, revenue: true },
    { name: 'Food Cost', value: -m.totalRawMaterials },
    { name: 'Staff Cost', value: -m.totalStaff },
    { name: 'Utilities', value: -m.totalUtilities },
    { name: 'Maintenance', value: -m.totalMaintenance },
    { name: 'Banking Costs', value: -m.totalBankingCosts },
    { name: 'Others', value: -m.totalOthers },
    { name: 'Store EBITDAR', value: m.totalStoreEbitdar, total: true },
  ];
  steps.push(
    { name: 'Leases', value: -m.totalRents },
    { name: 'Store EBITDA', value: m.totalStoreEbitda, total: true },
    { name: 'Headquarter & Admin.', value: -m.totalAdminCosts },
    { name: 'EBITDA', value: m.totalEbitda, total: true },
  );
  if (mode !== 'operating') steps.push(
    { name: 'CAPEX', value: -m.totalCapex },
    { name: 'CIT', value: -m.totalCit },
    { name: 'FCFF', value: m.totalFcff, total: true },
  );

  let running = 0;
  return steps.map(step => {
    const end = step.total ? step.value : running + step.value;
    const start = step.total ? 0 : running;
    const variance = step.total ? step.value - running : 0;
    running = end;
    return {
      ...step,
      range: [Math.min(start, end), Math.max(start, end)],
      color: step.total ? (step.value < 0 ? '#ef4444' : step.revenue ? '#3b82f6' : '#10b981') : (step.value > 0 ? '#10b981' : '#ef4444'),
      pct: step.revenue || !Number.isFinite(m.totalTurnover) || !m.totalTurnover || !Number.isFinite(step.value)
        ? null : (step.total ? step.value : -step.value) / m.totalTurnover,
      variance: step.total && step.name !== steps[0].name && Math.abs(variance) > 1 ? variance : null,
    };
  });
}

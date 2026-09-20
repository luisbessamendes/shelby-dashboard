import { PNL_ROWS, type PnlRowDefinition } from './pnl-rows';
import type { AggregatedMetrics } from './types';

export const BI_METRICS: PnlRowDefinition[] = [...PNL_ROWS,
  { id: 'capex', label: 'CAPEX', format: 'currency', value: m => m.totalCapex, trendPreference: 'neutral' },
  { id: 'cit', label: 'CIT', format: 'currency', value: m => m.totalCit, trendPreference: 'neutral' },
  { id: 'fcff', label: 'FCFF', format: 'currency', value: m => m.totalFcff, trendPreference: 'higher' },
  { id: 'fcffPct', label: 'FCFF %', format: 'percent', value: m => m.fcffPct, trendPreference: 'higher' },
  ...([
    ['storeCount', 'Active Stores'], ['storeEbitdarNegativeCount', 'Store EBITDAR-Negative Stores'],
    ['storeEbitdaNegativeCount', 'Store EBITDA-Negative Stores'], ['ebitdaNegativeCount', 'EBITDA-Negative Stores'],
    ['fcffNegativeCount', 'FCFF-Negative Stores'],
  ] as const).map(([id, label]) => ({ id, label, format: 'number' as const, value: (m: AggregatedMetrics) => m[id], trendPreference: 'neutral' as const })),
  ...([
    ['salesPerStore', 'Gross Sales per Store'], ['turnoverPerStore', 'Turnover per Store'],
    ['ebitdaPerStore', 'EBITDA per Store'], ['fcffPerStore', 'FCFF per Store'],
  ] as const).map(([id, label]) => ({ id, label, format: 'currency' as const, value: (m: AggregatedMetrics) => m[id], trendPreference: 'higher' as const })),
];

const FORMULAS: Record<string, string> = {
  tickets: 'Sum of uploaded ticket counts.', avgTicket: 'Sum(Gross Sales) / Sum(Tickets). The dashboard displays 0 when tickets are zero; this is not a valid ticket price.',
  grossSales: 'Sum(sales), before VAT.', vat: '-Sum(vat), a deduction from Gross Sales, not an operating cost ratio.',
  turnover: 'Sum(turnover); legacy missing turnover uses sales - vat. Uploaded totals are retained even if reconciliation differs.',
  foodCost: '-Sum(raw_materials).', staffCost: '-Sum(staff).', primeCost: '-Sum(raw_materials + staff); a subtotal, not an additional cost.',
  utilities: '-Sum(utilities).', maintenance: '-Sum(maintenance).', bankingCosts: '-Sum(banking_costs).', others: '-Sum(others). Not the Other / Review perimeter cohort.',
  storeEbitdar: 'Sum(store_contribution + rents): Store EBITDA before leases, not corporate EBITDA plus leases.',
  leases: '-Sum(rents).', storeEbitda: 'Sum(store_contribution): after leases, before headquarters. Formerly Store Contribution.',
  adminCosts: '-Sum(admin_costs).', ebitda: 'Sum(ebitda): Store EBITDA less Headquarter & Admin. Uploaded values retained.',
  capex: 'Sum(capex); shown as a negative deduction in cash waterfalls.', cit: 'Sum(cit); shown as a negative deduction in cash waterfalls.',
  fcff: 'Sum(fcff): EBITDA - CAPEX - CIT. Uploaded values retained.',
  storeCount: 'Distinct uploaded store names with records in this scope, including zero placeholders. Not independently verified trading-store count.',
};
const RATIO_BASE: Record<string, string> = {
  foodCostPct: 'foodCost', staffCostPct: 'staffCost', primeCostPct: 'primeCost', utilitiesPct: 'utilities',
  maintenancePct: 'maintenance', bankingCostsPct: 'bankingCosts', othersPct: 'others', storeEbitdarPct: 'storeEbitdar',
  leasesPct: 'leases', storeEbitdaPct: 'storeEbitda', adminCostsPct: 'adminCosts', ebitdaPct: 'ebitda', fcffPct: 'fcff',
};

export function metricDefinition(id: string) {
  const row = BI_METRICS.find(m => m.id === id);
  if (!row) throw new Error(`Unknown metric ${id}. Use get_metric_definitions for valid IDs.`);
  const numerator = BI_METRICS.find(m => m.id === RATIO_BASE[id]);
  return { id, label: row.label, unit: row.format === 'percent' ? 'fraction' : row.format === 'currency' ? 'EUR' : 'number',
    formula: numerator ? `Sum(${numerator.label}${numerator.growthValue ? ' cost magnitude' : ''}) / Sum(Turnover). Weighted ratio, not an average of percentages.`
      : FORMULAS[id] ?? (id.endsWith('NegativeCount') ? 'Aggregate each store across the selected months, then count stores with a negative total.' : 'Selected total divided by distinct store count.'),
    display: row.format === 'percent' ? 'Multiply by 100 for %. Differences in fractions multiplied by 100 are percentage points.'
      : row.format === 'number' ? 'Count, not currency.' : 'EUR rounded for display; calculations use unrounded amounts.',
    favorableDirection: row.trendPreference,
  };
}

export function metricValue(id: string, metrics: AggregatedMetrics | null): number | null {
  if (!metrics) return null;
  const value = BI_METRICS.find(m => m.id === id)!.value(metrics);
  return value != null && Number.isFinite(value) ? value : null;
}

export function metricEvidence(id: string, metrics: AggregatedMetrics | null) {
  const definition = metricDefinition(id);
  const base = BI_METRICS.find(m => m.id === RATIO_BASE[id]);
  return { ...definition, value: metricValue(id, metrics),
    ...(base && metrics ? { numerator: (base.growthValue ?? base.value)(metrics), denominator: metrics.totalTurnover } : {}),
    ...(id === 'avgTicket' && metrics ? { numerator: metrics.totalSales, denominator: metrics.totalTickets, calculationAvailable: metrics.totalTickets !== 0 } : {}),
  };
}

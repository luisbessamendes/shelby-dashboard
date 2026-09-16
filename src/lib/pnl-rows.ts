import type { AggregatedMetrics } from './types';

export type RowFormat = 'currency' | 'number' | 'percent';
type TrendPreference = 'higher' | 'lower' | 'neutral';

export interface PnlRowDefinition {
  id: string;
  label: string;
  format: RowFormat;
  value: (metrics: AggregatedMetrics) => number | null;
  growthValue?: (metrics: AggregatedMetrics) => number | null;
  trendPreference: TrendPreference;
  sectionStart?: boolean;
  emphasis?: boolean;
}

export const PNL_ROWS: PnlRowDefinition[] = [
  { id: 'tickets', label: '# Tickets', format: 'number', value: m => m.totalTickets, trendPreference: 'higher' },
  { id: 'avgTicket', label: 'Average Ticket', format: 'currency', value: m => m.avgTicket, trendPreference: 'higher' },
  { id: 'grossSales', label: 'Gross Sales', format: 'currency', value: m => m.totalSales, trendPreference: 'higher', sectionStart: true },
  { id: 'vat', label: 'VAT', format: 'currency', value: m => -m.totalVat, growthValue: m => m.totalVat, trendPreference: 'lower' },
  { id: 'turnover', label: 'Turnover', format: 'currency', value: m => m.totalTurnover, trendPreference: 'higher', emphasis: true },
  { id: 'foodCost', label: 'Food Cost', format: 'currency', value: m => -m.totalRawMaterials, growthValue: m => m.totalRawMaterials, trendPreference: 'lower', sectionStart: true },
  { id: 'foodCostPct', label: 'Food Cost %', format: 'percent', value: m => m.rawMaterialsPct, trendPreference: 'lower' },
  { id: 'staffCost', label: 'Staff Cost', format: 'currency', value: m => -m.totalStaff, growthValue: m => m.totalStaff, trendPreference: 'lower', sectionStart: true },
  { id: 'staffCostPct', label: 'Staff Cost %', format: 'percent', value: m => m.staffPct, trendPreference: 'lower' },
  { id: 'primeCost', label: 'Prime Cost', format: 'currency', value: m => -(m.totalRawMaterials + m.totalStaff), growthValue: m => m.totalRawMaterials + m.totalStaff, trendPreference: 'lower', sectionStart: true, emphasis: true },
  { id: 'primeCostPct', label: 'Prime Cost %', format: 'percent', value: m => m.primeCostPct, trendPreference: 'lower', emphasis: true },
  { id: 'utilities', label: 'Utilities', format: 'currency', value: m => -m.totalUtilities, growthValue: m => m.totalUtilities, trendPreference: 'lower', sectionStart: true },
  { id: 'utilitiesPct', label: 'Utilities %', format: 'percent', value: m => m.utilitiesPct, trendPreference: 'lower' },
  { id: 'maintenance', label: 'Maintenance', format: 'currency', value: m => -m.totalMaintenance, growthValue: m => m.totalMaintenance, trendPreference: 'lower', sectionStart: true },
  { id: 'maintenancePct', label: 'Maintenance %', format: 'percent', value: m => m.maintenancePct, trendPreference: 'lower' },
  { id: 'bankingCosts', label: 'Banking Costs', format: 'currency', value: m => -m.totalBankingCosts, growthValue: m => m.totalBankingCosts, trendPreference: 'lower', sectionStart: true },
  { id: 'bankingCostsPct', label: 'Banking Costs %', format: 'percent', value: m => m.bankingCostsPct, trendPreference: 'lower' },
  { id: 'others', label: 'Others', format: 'currency', value: m => -m.totalOthers, growthValue: m => m.totalOthers, trendPreference: 'lower', sectionStart: true },
  { id: 'othersPct', label: 'Others %', format: 'percent', value: m => m.othersPct, trendPreference: 'lower' },
  { id: 'storeEbitdar', label: 'Store EBITDAR', format: 'currency', value: m => m.totalStoreEbitdar, trendPreference: 'higher', sectionStart: true, emphasis: true },
  { id: 'storeEbitdarPct', label: 'Store EBITDAR %', format: 'percent', value: m => m.storeEbitdarPct, trendPreference: 'higher', emphasis: true },
  { id: 'leases', label: 'Leases', format: 'currency', value: m => -m.totalRents, growthValue: m => m.totalRents, trendPreference: 'lower', sectionStart: true },
  { id: 'leasesPct', label: 'Leases %', format: 'percent', value: m => m.rentsPct, trendPreference: 'lower' },
  { id: 'storeEbitda', label: 'Store EBITDA', format: 'currency', value: m => m.totalStoreEbitda, trendPreference: 'higher', sectionStart: true, emphasis: true },
  { id: 'storeEbitdaPct', label: 'Store EBITDA %', format: 'percent', value: m => m.storeEbitdaPct, trendPreference: 'higher', emphasis: true },
  { id: 'adminCosts', label: 'Headquarter & Admin.', format: 'currency', value: m => -m.totalAdminCosts, growthValue: m => m.totalAdminCosts, trendPreference: 'lower', sectionStart: true },
  { id: 'adminCostsPct', label: 'Headquarter & Admin. %', format: 'percent', value: m => m.adminCostsPct, trendPreference: 'lower' },
  { id: 'ebitda', label: 'EBITDA', format: 'currency', value: m => m.totalEbitda, trendPreference: 'higher', sectionStart: true, emphasis: true },
  { id: 'ebitdaPct', label: 'EBITDA %', format: 'percent', value: m => m.ebitdaPct, trendPreference: 'higher', emphasis: true },
];

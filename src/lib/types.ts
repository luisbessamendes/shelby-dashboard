export interface StoreMonthRecord {
  store: string; concept: string; region: string; year: number; month: number;
  sales: number; ebitda: number; capex: number; fcff: number; tickets: number;
  staff: number; raw_materials: number; rents: number; utilities: number;
  maintenance: number; banking_costs: number; vat: number; others: number;
  store_contribution: number; admin_costs: number; cit: number;
}
export type PeriodBasis = 'monthly' | 'ytd' | 'ltm';
export interface FilterState {
  periodBasis: PeriodBasis; year: number | null; month: number | null;
  concepts: string[]; regions: string[]; stores: string[];
}
export interface AggregatedMetrics {
  totalSales: number; totalEbitda: number; ebitdaPct: number | null;
  totalCapex: number; totalFcff: number; storeCount: number;
  staffPct: number | null; rawMaterialsPct: number | null;
  totalTickets: number; avgTicket: number;
}

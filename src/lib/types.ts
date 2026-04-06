/* ────────────────────────────────────────────────────────
 * Core data types for the QSF Dashboard
 * ──────────────────────────────────────────────────────── */

/** Raw row from the fact_store_month table */
export interface StoreMonthRecord {
  id?: string;
  store: string;
  concept: string;
  region: string;
  store_type: string;
  location: string;
  legal_entity: string;
  year: number;
  month: number;
  tickets: number;
  avg_ticket: number;
  sales: number;
  raw_materials: number;
  staff: number;
  rents: number;
  utilities: number;
  maintenance: number;
  banking_costs: number;
  vat: number;
  others: number;
  store_contribution: number;
  admin_costs: number;
  ebitda: number;
  capex: number;
  cit: number;
  fcff: number;
  upload_id?: string;
  uploaded_at?: string;
}

/** Row with computed ratio columns (from vw_store_month_ratios) */
export interface StoreMonthWithRatios extends StoreMonthRecord {
  raw_materials_pct: number | null;
  staff_pct: number | null;
  rents_pct: number | null;
  utilities_pct: number | null;
  maintenance_pct: number | null;
  banking_costs_pct: number | null;
  vat_pct: number | null;
  others_pct: number | null;
  store_contribution_pct: number | null;
  admin_costs_pct: number | null;
  ebitda_pct: number | null;
  fcff_pct: number | null;
  ebitda_per_ticket: number | null;
  fcff_per_ticket: number | null;
}

/** Period basis for analysis */
export type PeriodBasis = 'monthly' | 'ytd' | 'ltm';

/** Filter state */
export interface FilterState {
  periodBasis: PeriodBasis;
  year: number | null;
  month: number | null;
  stores: string[];
  concepts: string[];
  regions: string[];
  storeTypes: string[];
  locations: string[];
  legalEntities: string[];
  // Advanced filters
  ebitdaSign: 'all' | 'positive' | 'negative';
  fcffSign: 'all' | 'positive' | 'negative';
  quartile: 'all' | 'top' | 'bottom';
  salesRange: [number, number] | null;
  ebitdaPctRange: [number, number] | null;
  staffPctRange: [number, number] | null;
  rawMaterialsPctRange: [number, number] | null;
  ticketsRange: [number, number] | null;
  avgTicketRange: [number, number] | null;
}

/** Aggregated metrics for a segment or portfolio */
export interface AggregatedMetrics {
  storeCount: number;
  totalSales: number;
  totalTickets: number;
  avgTicket: number; // totalSales / totalTickets (weighted)
  totalRawMaterials: number;
  totalStaff: number;
  totalRents: number;
  totalUtilities: number;
  totalMaintenance: number;
  totalBankingCosts: number;
  totalVat: number;
  totalOthers: number;
  totalStoreContribution: number;
  totalAdminCosts: number;
  totalEbitda: number;
  totalCapex: number;
  totalCit: number;
  totalFcff: number;
  // Weighted ratios
  rawMaterialsPct: number | null;
  staffPct: number | null;
  rentsPct: number | null;
  utilitiesPct: number | null;
  maintenancePct: number | null;
  bankingCostsPct: number | null;
  vatPct: number | null;
  othersPct: number | null;
  storeContributionPct: number | null;
  adminCostsPct: number | null;
  ebitdaPct: number | null;
  fcffPct: number | null;
  // Derived
  ebitdaNegativeCount: number;
  fcffNegativeCount: number;
  salesPerStore: number;
  ebitdaPerStore: number;
  fcffPerStore: number;
}

/** Benchmark comparison result */
export interface BenchmarkComparison {
  label: string;
  storeValue: number;
  benchmarkValue: number;
  absoluteVariance: number;
  pptVariance?: number; // percentage-point variance for ratios
}

/** Upload record */
export interface UploadRecord {
  id: string;
  filename: string;
  rows_inserted: number;
  rows_replaced: number;
  status: 'pending' | 'success' | 'error';
  error_message: string | null;
  uploaded_at: string;
}

/** Diagnostic flag for store detail */
export interface DiagnosticFlag {
  id: string;
  label: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  active: boolean;
}

/** KPI card data */
export interface KPICardData {
  label: string;
  value: number | string;
  format: 'currency' | 'number' | 'percent' | 'integer';
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'flat';
    isPositive: boolean; // green or red
  };
}

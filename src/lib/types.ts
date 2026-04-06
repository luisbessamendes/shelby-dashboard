
export type PeriodBasis = 'monthly' | 'ytd' | 'ltm';

export interface StoreMonthRecord {
  id: string;
  store: string;
  concept: string;
  region: string;
  location: string;
  store_type: 'Street' | 'Mall' | 'Travel';
  legal_entity: string;
  year: number;
  month: number;
  sales: number;
  tickets: number;
  ebitda: number;
  capex: number;
  staff: number;
  raw_materials: number;
  cit: number;
  fcff: number;
  opcf: number;
  rent: number;
  marketing: number;
  maintenance: number;
  utilities: number;
  other_opex: number;
}

export interface AggregatedMetrics {
  totalSales: number;
  totalTickets: number;
  avgTicket: number;
  totalEbitda: number;
  ebitdaPct: number | null;
  totalCapex: number;
  totalFcff: number;
  totalCit: number;
  staff: number;
  staffPct: number | null;
  rawMaterials: number;
  rawMaterialsPct: number | null;
  storeContribution: number;
  storeContributionPct: number | null;
  storeCount: number;
  salesPerStore: number;
  ebitdaPerStore: number;
}

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
  ebitdaSign: 'all' | 'positive' | 'negative';
  fcffSign: 'all' | 'positive' | 'negative';
  quartile: 'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4';
  salesRange: [number, number] | null;
  ebitdaPctRange: [number, number] | null;
  staffPctRange: [number, number] | null;
  rawMaterialsPctRange: [number, number] | null;
  ticketsRange: [number, number] | null;
  avgTicketRange: [number, number] | null;
}

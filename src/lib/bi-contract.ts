import type { FilterState, PeriodBasis } from './types';

export interface ReportContext {
  path: string;
  dimension?: 'concept' | 'region' | 'store_type' | 'location' | 'legal_entity' | 'perimeter';
  profitMetric?: 'store_ebitdar' | 'store_ebitda' | 'ebitda';
  trendBasis?: 'monthly' | 'ltm';
  search?: string;
}
export type BiDimension = 'portfolio' | 'store' | 'concept' | 'region' | 'location' | 'legal_entity' | 'store_type';
export interface BiArgs {
  metrics?: string[] | null;
  year?: number | null;
  month?: number | null;
  periodBasis?: PeriodBasis | null;
  stores?: string[] | null;
  concepts?: string[] | null;
  regions?: string[] | null;
  locations?: string[] | null;
  legalEntities?: string[] | null;
  storeTypes?: string[] | null;
  groupBy?: BiDimension | null;
  compareYear?: number | null;
  compareMonth?: number | null;
  compareBasis?: PeriodBasis | null;
  stage?: 'previous' | 'current' | null;
  cohort?: 'l4l' | 'new' | 'closed' | 'renovation' | 'other' | null;
  order?: 'asc' | 'desc' | null;
  limit?: number | null;
  offset?: number | null;
  fullHistory?: boolean | null;
  bridgeMode?: 'operating' | 'full' | 'cash' | null;
}

export function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.');
  return value as Record<string, unknown>;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 200 || value.some(v => typeof v !== 'string' || v.length > 250)) throw new Error('Invalid selection.');
  return [...new Set(value as string[])];
}

export function validateFilters(value: unknown): FilterState {
  const f = objectValue(value);
  if (!['monthly', 'ytd', 'ltm'].includes(String(f.periodBasis))) throw new Error('Invalid period basis.');
  for (const [key, max] of [['year', 2100], ['month', 12]] as const) {
    if (f[key] !== null && (!Number.isInteger(f[key]) || Number(f[key]) < (key === 'year' ? 2000 : 1) || Number(f[key]) > max)) throw new Error(`Invalid ${key}.`);
  }
  return {
    periodBasis: f.periodBasis as PeriodBasis, year: f.year as number | null, month: f.month as number | null,
    stores: strings(f.stores), concepts: strings(f.concepts), regions: strings(f.regions),
    locations: strings(f.locations), legalEntities: strings(f.legalEntities), storeTypes: strings(f.storeTypes),
    ebitdaSign: 'all', fcffSign: 'all', quartile: 'all', salesRange: null, ebitdaPctRange: null,
    staffPctRange: null, rawMaterialsPctRange: null, ticketsRange: null, avgTicketRange: null,
  };
}

export function validateReportContext(value: unknown): ReportContext {
  if (value == null) return { path: '/overview' };
  const v = objectValue(value);
  if (typeof v.path !== 'string' || v.path.length > 800 || !/^\/(overview|performance|pnl|segments|trends|margins|rankings|investment|upload|store\/[^/?#]+)$/.test(v.path)) throw new Error('Invalid report page.');
  const result: ReportContext = { path: v.path };
  const options = {
    dimension: ['concept', 'region', 'store_type', 'location', 'legal_entity', 'perimeter'],
    profitMetric: ['store_ebitdar', 'store_ebitda', 'ebitda'], trendBasis: ['monthly', 'ltm'],
  };
  for (const key of Object.keys(options) as (keyof typeof options)[]) {
    if (v[key] !== undefined) {
      if (!options[key].includes(String(v[key]))) throw new Error(`Invalid ${key}.`);
      Object.assign(result, { [key]: v[key] });
    }
  }
  if (v.search !== undefined) {
    if (typeof v.search !== 'string' || v.search.length > 250) throw new Error('Invalid search.');
    result.search = v.search;
  }
  return result;
}

export interface ChatInputMessage { role: 'user' | 'assistant'; content: string; scope?: string }
export function validateChatRequest(value: unknown) {
  const body = objectValue(value);
  if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 30) throw new Error('Send between 1 and 30 messages.');
  const messages = body.messages.map(item => {
    const m = objectValue(item);
    if (!['user', 'assistant'].includes(String(m.role)) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 8000) throw new Error('Invalid chat message.');
    if (m.scope !== undefined && (typeof m.scope !== 'string' || m.scope.length > 4000)) throw new Error('Invalid message scope.');
    return { role: m.role, content: m.content, scope: m.scope } as ChatInputMessage;
  });
  if (messages.at(-1)?.role !== 'user') throw new Error('The last message must be a question.');
  return { messages, filters: validateFilters(body.filters), report: validateReportContext(body.report) };
}

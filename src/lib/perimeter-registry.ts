import source from './data/perimeter-registry.json';

export type RegisteredCohort = 'l4l' | 'new' | 'closed' | 'renovation';
export interface PerimeterRegistryEntry {
  code: string;
  store: string;
  sourceRow: number;
  fy25: RegisteredCohort | null;
  ltm: RegisteredCohort | null;
  note?: string;
  opened?: string;
  entryKind?: 'opening' | 'acquisition';
  closed?: string;
  renovation?: { from: string; through: string };
}

export const PERIMETER_REGISTRY = source.stores as PerimeterRegistryEntry[];
export const PERIMETER_REGISTRY_SOURCE = source.source;

// The financial upload uses C2 where the register uses C02. No fuzzy name matching.
export function normalizePerimeterCode(code: string): string {
  return code.trim().toUpperCase().replace(/_C0+(\d+)$/, '_C$1');
}

export function registryMonth(value: string | undefined): number | null {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const [year, month] = value.split('-').map(Number);
  return year * 12 + month - 1;
}

export function indexPerimeterRegistry(entries: readonly PerimeterRegistryEntry[]) {
  const map = new Map<string, PerimeterRegistryEntry | null>();
  for (const entry of entries) {
    const key = normalizePerimeterCode(entry.code);
    map.set(key, map.has(key) ? null : entry);
  }
  return map;
}

export function expectsPerimeterReport(entry: PerimeterRegistryEntry | null | undefined, month: number): boolean {
  const opened = registryMonth(entry?.opened);
  const closed = registryMonth(entry?.closed);
  const from = registryMonth(entry?.renovation?.from);
  const through = registryMonth(entry?.renovation?.through);
  if (opened !== null && month < opened) return false;
  // Retain the event month: the source specifies months, not exact days.
  if (closed !== null && month > closed) return false;
  if (from !== null && through !== null && month > from && month < through) return false;
  return true;
}

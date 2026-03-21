/* ────────────────────────────────────────────────────────
 * Number / currency / percentage formatters
 * ──────────────────────────────────────────────────────── */

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const currencyDetailFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return currencyFormatter.format(value);
}

export function formatCurrencyDetail(value: number | null | undefined): string {
  if (value == null) return '—';
  return currencyDetailFormatter.format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '—';
  return numberFormatter.format(value);
}

export function formatDecimal(value: number | null | undefined): string {
  if (value == null) return '—';
  return decimalFormatter.format(value);
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatPercentPP(value: number | null | undefined): string {
  if (value == null) return '—';
  const pp = value * 100;
  const sign = pp >= 0 ? '+' : '';
  return `${sign}${pp.toFixed(1)}pp`;
}

export function formatCompact(value: number | null | undefined): string {
  if (value == null) return '—';
  if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value.toFixed(0)}`;
}

export function formatTrend(value: number | null | undefined): string {
  if (value == null) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)}%`;
}

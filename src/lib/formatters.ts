
export const formatCurrency = (val: number | null | undefined) => {
  if (val === null || val === undefined) return '—';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(val);
};

export const formatCompact = (val: number | null | undefined) => {
  if (val === null || val === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(val);
};

export const formatPercent = (val: number | null | undefined) => {
  if (val === null || val === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(val);
};

export const formatPercentPP = (val: number | null | undefined) => {
  if (val === null || val === undefined) return '—';
  const sign = val > 0 ? '+' : '';
  return `${sign}${(val * 100).toFixed(1)} pp`;
};

export const formatNumber = (val: number | null | undefined) => {
  if (val === null || val === undefined) return '—';
  return new Intl.NumberFormat('de-DE').format(Math.round(val));
};

export const formatTrend = (val: number | null | undefined) => {
  if (val === null || val === undefined) return '—';
  const color = val > 0 ? 'cell-positive' : val < 0 ? 'cell-negative' : '';
  const sign = val > 0 ? '▲' : val < 0 ? '▼' : '—';
  const formattedValue = Math.abs(val * 100).toFixed(1) + '%';
  return `${sign} ${formattedValue}`;
};

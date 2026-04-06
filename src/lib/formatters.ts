export function formatCurrency(v: number | null): string { return v ? \`€\${v.toLocaleString()}\` : '—'; }
export function formatPercent(v: number | null): string { return v ? \`\${(v * 100).toFixed(1)}%\` : '—'; }
export function formatCompact(v: number | null): string { return v ? v.toString() : '—'; }
export function formatNumber(v: number | null): string { return v ? v.toLocaleString() : '—'; }
export function formatPercentPP(v: number | null): string { return v ? \`\${(v * 100).toFixed(1)}pp\` : '—'; }
export function formatTrend(v: number | null): string { return v ? \`\${(v > 0 ? '+' : '')}\${(v * 100).toFixed(1)}%\` : '—'; }

/* ────────────────────────────────────────────────────────
 * Constants for the QSF Dashboard
 * ──────────────────────────────────────────────────────── */

/** Month name → number mapping */
export const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4,
  may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
};

/** Month number → short name */
export const MONTH_SHORT_NAMES: Record<number, string> = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr',
  5: 'May', 6: 'Jun', 7: 'Jul', 8: 'Aug',
  9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec',
};

/** Month number → full name */
export const MONTH_FULL_NAMES: Record<number, string> = {
  1: 'January', 2: 'February', 3: 'March', 4: 'April',
  5: 'May', 6: 'June', 7: 'July', 8: 'August',
  9: 'September', 10: 'October', 11: 'November', 12: 'December',
};

/** Column mapping from Excel header → database field */
export const EXCEL_COLUMN_MAP: Record<string, string> = {
  'Store': 'store',
  'Concept': 'concept',
  'Region': 'region',
  'Type of Store': 'store_type',
  'Location': 'location',
  'Legal Entity': 'legal_entity',
  'Year': 'year',
  'Month': 'month',
  'Tickets': 'tickets',
  'Average Ticket': 'avg_ticket',
  'Sales': 'sales',
  'Raw Materials': 'raw_materials',
  'Staff': 'staff',
  'Rents': 'rents',
  'Utilities': 'utilities',
  'Maintenance': 'maintenance',
  'Banking costs': 'banking_costs',
  'Banking Costs': 'banking_costs',
  'VAT': 'vat',
  'Others': 'others',
  'Store Contribution': 'store_contribution',
  'Admin. Costs': 'admin_costs',
  'EBITDA': 'ebitda',
  'CAPEX': 'capex',
  'CIT': 'cit',
  'FCFF': 'fcff',
};

/** Columns to skip when importing (percentage columns — always recomputed) */
export const SKIP_COLUMNS = new Set([
  'Raw Materials %',
  'Staff %',
  'Rents %',
  'Utilities %',
  'Maintenance %',
  'Banking Costs %',
  'VAT %',
  'Others %',
  'Store Contribution %',
  'Admin. Costs %',
  'EBITDA %',
  'FCFF %',
]);

/** Numeric fields in the database (non-dimension) */
export const NUMERIC_FIELDS = [
  'tickets', 'avg_ticket', 'sales', 'raw_materials', 'staff',
  'rents', 'utilities', 'maintenance', 'banking_costs', 'vat',
  'others', 'store_contribution', 'admin_costs', 'ebitda',
  'capex', 'cit', 'fcff',
] as const;

/** Dimension fields */
export const DIMENSION_FIELDS = [
  'store', 'concept', 'region', 'store_type', 'location', 'legal_entity',
] as const;

/** Sidebar navigation items */
export const NAV_ITEMS = [
  { href: '/overview', label: 'Portfolio Overview', icon: 'dashboard' },
  { href: '/performance', label: 'Performance Table', icon: 'table' },
  { href: '/segments', label: 'Segment Analysis', icon: 'segments' },
  { href: '/trends', label: 'Trend Analysis', icon: 'trending' },
  { href: '/margins', label: 'Margin Diagnostics', icon: 'diagnostics' },
  { href: '/rankings', label: 'Rankings & Outliers', icon: 'rankings' },
  { href: '/investment', label: 'Investment View', icon: 'investment' },
  { href: '/upload', label: 'Data Upload', icon: 'upload' },
] as const;

/** Chart color palette */
export const CHART_COLORS = [
  '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
] as const;

/** Positive/negative conditional formatting */
export const VALUE_COLORS = {
  positive: '#10b981',
  negative: '#ef4444',
  neutral: '#9ca3af',
  warning: '#f59e0b',
} as const;

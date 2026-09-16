export function storeMonth(overrides = {}) {
  return {
    store: 'Alentejo - Test', code: 'ALEN_TEST', concept: 'Alentejo', region: 'Lisbon',
    store_type: 'Shopping Mall', location: 'Test Mall', legal_entity: 'Entity A', year: 2026, month: 4,
    tickets: 100, avg_ticket: 12, sales: 1200, vat: 200, turnover: 1000,
    raw_materials: 300, staff: 250, rents: 100, utilities: 40, maintenance: 10, banking_costs: 5,
    others: 15, store_contribution: 280, admin_costs: 50, ebitda: 230, capex: 25, cit: 5, fcff: 200,
    ...overrides,
  };
}

export function history() {
  return Array.from({ length: 28 }, (_, index) => storeMonth({ year: 2024 + Math.floor(index / 12), month: index % 12 + 1 }));
}

export function filters(overrides = {}) {
  return {
    periodBasis: 'monthly', year: 2026, month: 4, stores: [], concepts: [], regions: [],
    storeTypes: [], locations: [], legalEntities: [], ebitdaSign: 'all', fcffSign: 'all', quartile: 'all',
    salesRange: null, ebitdaPctRange: null, staffPctRange: null, rawMaterialsPctRange: null,
    ticketsRange: null, avgTicketRange: null, ...overrides,
  };
}

export function uploadRow() {
  return {
    Store: 'Alentejo - Test', Code: 'ALEN_TEST', Concept: 'Alentejo', Region: 'Lisbon',
    'Type of Store': 'Shopping Mall', Location: 'Test Mall', 'Legal Entity': 'Entity A', Year: 2026, Month: 'April',
    Tickets: 100, 'Average Ticket': 12, Sales: 1200, VAT: 200, Turnover: 1000,
    'Raw Materials': 300, Staff: 250, Rents: 100, Utilities: 40, Maintenance: 10, 'Banking costs': 5, Others: 15,
    'Store Contribution': 280, 'Admin. Costs': 50, EBITDA: 230, CAPEX: 25, CIT: 5, FCFF: 200,
  };
}

'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { FilterState, PeriodBasis, StoreMonthRecord } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface FilterContextValue {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  updateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  clearFilters: () => void;
  // Available dimension values (from data)
  availableYears: number[];
  availableStores: string[];
  availableConcepts: string[];
  availableRegions: string[];
  availableStoreTypes: string[];
  availableLocations: string[];
  availableLegalEntities: string[];
  // All raw data
  allData: StoreMonthRecord[];
  filteredData: StoreMonthRecord[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

const defaultFilters: FilterState = {
  periodBasis: 'monthly',
  year: null,
  month: null,
  stores: [],
  concepts: [],
  regions: [],
  storeTypes: [],
  locations: [],
  legalEntities: [],
  ebitdaSign: 'all',
  fcffSign: 'all',
  quartile: 'all',
  salesRange: null,
  ebitdaPctRange: null,
  staffPctRange: null,
  rawMaterialsPctRange: null,
  ticketsRange: null,
  avgTicketRange: null,
};

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [allData, setAllData] = useState<StoreMonthRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all data from Supabase
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('fact_store_month')
        .select('*')
        .order('year', { ascending: true })
        .order('month', { ascending: true })
        .limit(100000);

      if (error) throw error;
      setAllData((data as StoreMonthRecord[]) || []);

      // Auto-set year and month to latest available if not set
      if (data && data.length > 0) {
        const maxYear = Math.max(...data.map((d: StoreMonthRecord) => d.year));
        const maxMonth = Math.max(
          ...data.filter((d: StoreMonthRecord) => d.year === maxYear).map((d: StoreMonthRecord) => d.month)
        );
        setFilters(prev => ({
          ...prev,
          year: prev.year ?? maxYear,
          month: prev.month ?? maxMonth,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Extract available dimension values (cascading)
  const availableYears = React.useMemo(() => [...new Set(allData.map(d => d.year))].sort(), [allData]);
  const availableLocations = React.useMemo(() => [...new Set(allData.map(d => d.location))].sort(), [allData]);
  const availableLegalEntities = React.useMemo(() => [...new Set(allData.map(d => d.legal_entity))].sort(), [allData]);

  const availableStores = React.useMemo(() => {
    const valid = allData.filter(d => 
      (filters.concepts.length === 0 || filters.concepts.includes(d.concept)) &&
      (filters.regions.length === 0 || filters.regions.includes(d.region)) &&
      (filters.storeTypes.length === 0 || filters.storeTypes.includes(d.store_type))
    );
    return [...new Set(valid.map(d => d.store))].sort();
  }, [allData, filters.concepts, filters.regions, filters.storeTypes]);

  const availableConcepts = React.useMemo(() => {
    const valid = allData.filter(d => 
      (filters.stores.length === 0 || filters.stores.includes(d.store)) &&
      (filters.regions.length === 0 || filters.regions.includes(d.region)) &&
      (filters.storeTypes.length === 0 || filters.storeTypes.includes(d.store_type))
    );
    return [...new Set(valid.map(d => d.concept))].sort();
  }, [allData, filters.stores, filters.regions, filters.storeTypes]);

  const availableRegions = React.useMemo(() => {
    const valid = allData.filter(d => 
      (filters.stores.length === 0 || filters.stores.includes(d.store)) &&
      (filters.concepts.length === 0 || filters.concepts.includes(d.concept)) &&
      (filters.storeTypes.length === 0 || filters.storeTypes.includes(d.store_type))
    );
    return [...new Set(valid.map(d => d.region))].sort();
  }, [allData, filters.stores, filters.concepts, filters.storeTypes]);

  const availableStoreTypes = React.useMemo(() => {
    const valid = allData.filter(d => 
      (filters.stores.length === 0 || filters.stores.includes(d.store)) &&
      (filters.concepts.length === 0 || filters.concepts.includes(d.concept)) &&
      (filters.regions.length === 0 || filters.regions.includes(d.region))
    );
    return [...new Set(valid.map(d => d.store_type))].sort();
  }, [allData, filters.stores, filters.concepts, filters.regions]);

  // Apply filters to all data
  const filteredData = React.useMemo(() => {
    let result = allData;

    // Dimension filters
    if (filters.stores.length > 0) {
      result = result.filter(d => filters.stores.includes(d.store));
    }
    if (filters.concepts.length > 0) {
      result = result.filter(d => filters.concepts.includes(d.concept));
    }
    if (filters.regions.length > 0) {
      result = result.filter(d => filters.regions.includes(d.region));
    }
    if (filters.storeTypes.length > 0) {
      result = result.filter(d => filters.storeTypes.includes(d.store_type));
    }
    if (filters.locations.length > 0) {
      result = result.filter(d => filters.locations.includes(d.location));
    }
    if (filters.legalEntities.length > 0) {
      result = result.filter(d => filters.legalEntities.includes(d.legal_entity));
    }

    return result;
  }, [allData, filters]);

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(prev => ({
      ...defaultFilters,
      year: prev.year,
      month: prev.month,
    }));
  }, []);

  return (
    <FilterContext.Provider
      value={{
        filters,
        setFilters,
        updateFilter,
        clearFilters,
        availableYears,
        availableStores,
        availableConcepts,
        availableRegions,
        availableStoreTypes,
        availableLocations,
        availableLegalEntities,
        allData,
        filteredData,
        isLoading,
        refreshData,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be used within FilterProvider');
  return ctx;
}

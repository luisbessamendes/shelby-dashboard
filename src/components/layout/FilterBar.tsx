'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useFilters } from '@/contexts/FilterContext';
import { MONTH_SHORT_NAMES } from '@/lib/constants';
import type { PeriodBasis } from '@/lib/types';

function MultiSelectDropdown({ 
  label, 
  options, 
  selectedValues, 
  onChange 
}: { 
  label: string; 
  options: string[]; 
  selectedValues: string[]; 
  onChange: (vals: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (opt: string) => {
    if (selectedValues.includes(opt)) {
      onChange(selectedValues.filter(v => v !== opt));
    } else {
      onChange([...selectedValues, opt]);
    }
  };

  const displayText = selectedValues.length === 0 
    ? 'All' 
    : selectedValues.length === 1 
      ? selectedValues[0] 
      : `${selectedValues.length} selected`;

  return (
    <div className="filter-group" ref={containerRef} style={{ position: 'relative' }}>
      <label className="filter-label">{label}</label>
      <div 
        className="filter-select" 
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', userSelect: 'none' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayText}</span>
        <span style={{ fontSize: '10px', marginLeft: '8px' }}>▼</span>
      </div>
      
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '4px',
          background: '#111827', // dark bg
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '8px',
          minWidth: '200px',
          zIndex: 50,
          maxHeight: '300px',
          overflowY: 'auto',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div 
             style={{ 
               padding: '6px 8px', cursor: 'pointer', borderRadius: '4px',
               color: selectedValues.length === 0 ? '#10b981' : '#fff',
               background: selectedValues.length === 0 ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
               fontWeight: selectedValues.length === 0 ? 600 : 400
             }}
             onClick={() => { onChange([]); setIsOpen(false); }}
             onMouseEnter={(e) => {
               if (selectedValues.length !== 0) Object.assign(e.currentTarget.style, { background: 'rgba(255,255,255,0.05)' });
             }}
             onMouseLeave={(e) => {
               if (selectedValues.length !== 0) Object.assign(e.currentTarget.style, { background: 'transparent' });
             }}
          >
            All
          </div>
          {options.map(opt => {
            const isSelected = selectedValues.includes(opt);
            return (
              <div 
                key={opt}
                style={{
                  padding: '6px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: '4px',
                  color: isSelected ? '#10b981' : '#d1d5db',
                  background: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                }}
                onClick={() => toggleOption(opt)}
                onMouseEnter={(e) => {
                  if (!isSelected) Object.assign(e.currentTarget.style, { background: 'rgba(255,255,255,0.05)', color: '#fff' });
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) Object.assign(e.currentTarget.style, { background: 'transparent', color: '#d1d5db' });
                }}
              >
                <div style={{
                  width: '14px', height: '14px', borderRadius: '3px', border: `1px solid ${isSelected ? '#10b981' : 'rgba(255,255,255,0.3)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? '#10b981' : 'transparent'
                }}>
                  {isSelected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 4L3.5 6.5L9 1" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>{opt}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FilterBar() {
  const {
    filters,
    updateFilter,
    clearFilters,
    availableYears,
    availableStores,
    availableConcepts,
    availableRegions,
    availableStoreTypes,
  } = useFilters();

  const periodOptions: { value: PeriodBasis; label: string }[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'ytd', label: 'YTD' },
    { value: 'ltm', label: 'LTM' },
  ];

  return (
    <div className="filter-bar">
      {/* Period Basis Toggle */}
      <div className="period-toggle">
        {periodOptions.map(opt => (
          <button
            key={opt.value}
            className={`period-btn${filters.periodBasis === opt.value ? ' active' : ''}`}
            onClick={() => updateFilter('periodBasis', opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Year */}
      <div className="filter-group">
        <label className="filter-label">Year</label>
        <select
          className="filter-select"
          value={filters.year ?? ''}
          onChange={e => updateFilter('year', e.target.value ? Number(e.target.value) : null)}
          style={{ minWidth: 80 }}
        >
          <option value="">All</option>
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Month */}
      <div className="filter-group">
        <label className="filter-label">Month</label>
        <select
          className="filter-select"
          value={filters.month ?? ''}
          onChange={e => updateFilter('month', e.target.value ? Number(e.target.value) : null)}
          style={{ minWidth: 80 }}
        >
          <option value="">All</option>
          {Object.entries(MONTH_SHORT_NAMES).map(([num, name]) => (
            <option key={num} value={num}>{name}</option>
          ))}
        </select>
      </div>

      {/* Store */}
      <MultiSelectDropdown
        label="Store"
        options={availableStores}
        selectedValues={filters.stores}
        onChange={(vals) => updateFilter('stores', vals)}
      />

      {/* Concept */}
      <MultiSelectDropdown
        label="Concept"
        options={availableConcepts}
        selectedValues={filters.concepts}
        onChange={(vals) => updateFilter('concepts', vals)}
      />

      {/* Region */}
      <MultiSelectDropdown
        label="Region"
        options={availableRegions}
        selectedValues={filters.regions}
        onChange={(vals) => updateFilter('regions', vals)}
      />

      {/* Store Type */}
      <MultiSelectDropdown
        label="Type"
        options={availableStoreTypes}
        selectedValues={filters.storeTypes}
        onChange={(vals) => updateFilter('storeTypes', vals)}
      />

      {/* Clear */}
      <button className="filter-clear" onClick={clearFilters}>
        Clear Filters
      </button>
    </div>
  );
}

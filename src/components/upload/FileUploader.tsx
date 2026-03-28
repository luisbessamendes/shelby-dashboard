'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { parseExcelFile } from '@/lib/excel-parser';
import { supabase } from '@/lib/supabase';
import { useFilters } from '@/contexts/FilterContext';
import type { StoreMonthRecord } from '@/lib/types';

export default function FileUploader() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<StoreMonthRecord[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const thClass = (key: string) => `${sortKey === key ? 'sorted' : ''}`;
  const { refreshData } = useFilters();

  const handleFile = useCallback(async (file: File) => {
    setUploadResult(null);
    setFileName(file.name);

    const buffer = await file.arrayBuffer();
    const result = parseExcelFile(buffer);

    setParseErrors(result.errors);
    setPreview(result.records);

    if (result.records.length === 0 && result.errors.length > 0) {
      setUploadResult({ success: false, message: `Parse failed: ${result.errors.join(', ')}` });
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleCommit = useCallback(async () => {
    if (!preview || preview.length === 0) return;
    setIsUploading(true);
    setUploadResult(null);

    try {
      // Create upload record
      const { data: uploadData, error: uploadError } = await supabase
        .from('uploads')
        .insert({ filename: fileName, status: 'pending' })
        .select('id')
        .single();

      if (uploadError) throw uploadError;
      const uploadId = uploadData.id;

      // Upsert records with upload_id
      const recordsWithUploadId = preview.map(r => ({
        ...r,
        upload_id: uploadId,
      }));

      const { error: upsertError } = await supabase
        .from('fact_store_month')
        .upsert(recordsWithUploadId, {
          onConflict: 'store,year,month',
          ignoreDuplicates: false,
        });

      if (upsertError) throw upsertError;

      // Update upload status
      await supabase
        .from('uploads')
        .update({
          status: 'success',
          rows_inserted: preview.length,
        })
        .eq('id', uploadId);

      setUploadResult({
        success: true,
        message: `Successfully uploaded ${preview.length} records from "${fileName}"`,
      });
      setPreview(null);
      await refreshData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setUploadResult({ success: false, message: `Upload failed: ${msg}` });
    } finally {
      setIsUploading(false);
    }
  }, [preview, fileName, refreshData]);

  return (
    <div>
      {/* Drop Zone */}
      <div
        className={`upload-zone${isDragOver ? ' dragover' : ''}`}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="upload-zone-icon">📊</div>
        <div className="upload-zone-text">
          Drop your Excel file here or click to browse
        </div>
        <div className="upload-zone-hint">
          Supports .xlsx files with the standard template format
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
      </div>

      {/* Parse Errors */}
      {parseErrors.length > 0 && (
        <div className="card mt-24" style={{ borderColor: 'var(--accent-danger)' }}>
          <div className="card-title" style={{ color: 'var(--accent-danger)' }}>Parse Warnings</div>
          <ul style={{ paddingLeft: 20, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {parseErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview Table */}
      {preview && preview.length > 0 && (
        <div className="mt-24">
          <div className="flex-between mb-24">
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>
                Preview — {preview.length} records from &quot;{fileName}&quot;
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                Existing records with the same Store + Year + Month will be replaced.
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleCommit}
              disabled={isUploading}
            >
              {isUploading ? 'Uploading...' : `Upload ${preview.length} Records`}
            </button>
          </div>

          <div className="data-table-container">
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className={thClass('store')} onClick={() => handleSort('store')}>Store {sortKey === 'store' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th className={thClass('concept')} onClick={() => handleSort('concept')}>Concept {sortKey === 'concept' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th className={thClass('region')} onClick={() => handleSort('region')}>Region {sortKey === 'region' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th className={thClass('store_type')} onClick={() => handleSort('store_type')}>Type {sortKey === 'store_type' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th className={thClass('year')} onClick={() => handleSort('year')}>Year {sortKey === 'year' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th className={thClass('month')} onClick={() => handleSort('month')}>Month {sortKey === 'month' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th className={thClass('sales')} onClick={() => handleSort('sales')}>Sales {sortKey === 'sales' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th className={thClass('ebitda')} onClick={() => handleSort('ebitda')}>EBITDA {sortKey === 'ebitda' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th className={thClass('fcff')} onClick={() => handleSort('fcff')}>FCFF {sortKey === 'fcff' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    if (!sortKey) return preview.slice(0, 50);
                    const arr = [...preview];
                    arr.sort((a, b) => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const va = (a as any)[sortKey];
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const vb = (b as any)[sortKey];
                      
                      const numA = typeof va === 'number' ? va : 0;
                      const numB = typeof vb === 'number' ? vb : 0;
                      
                      if (typeof va === 'string' && typeof vb === 'string') {
                        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
                      }
                      return sortDir === 'asc' ? numA - numB : numB - numA;
                    });
                    return arr.slice(0, 50);
                  })().map((r, i) => (
                    <tr key={i}>
                      <td>{r.store}</td>
                      <td>{r.concept}</td>
                      <td>{r.region}</td>
                      <td>{r.store_type}</td>
                      <td className="numeric">{r.year}</td>
                      <td className="numeric">{r.month}</td>
                      <td className="numeric">{r.sales?.toLocaleString('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</td>
                      <td className={`numeric ${r.ebitda >= 0 ? 'cell-positive' : 'cell-negative'}`}>
                        {r.ebitda?.toLocaleString('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                      </td>
                      <td className={`numeric ${r.fcff >= 0 ? 'cell-positive' : 'cell-negative'}`}>
                        {r.fcff?.toLocaleString('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 50 && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Showing first 50 of {preview.length} records
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Result */}
      {uploadResult && (
        <div
          className="card mt-24"
          style={{
            borderColor: uploadResult.success ? 'var(--accent-primary)' : 'var(--accent-danger)',
            background: uploadResult.success ? 'var(--accent-primary-dim)' : 'var(--accent-danger-dim)',
          }}
        >
          <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>
            {uploadResult.success ? '✓' : '✗'} {uploadResult.message}
          </p>
        </div>
      )}
    </div>
  );
}

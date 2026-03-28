'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import FileUploader from '@/components/upload/FileUploader';
import { supabase } from '@/lib/supabase';
import type { UploadRecord } from '@/lib/types';
import { useFilters } from '@/contexts/FilterContext';

export default function UploadPage() {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [isClearing, setIsClearing] = useState(false);
  
  const [sortKey, setSortKey] = useState<string>('uploaded_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const thClass = (key: string) => `${sortKey === key ? 'sorted' : ''}`;

  const router = useRouter();
  const { refreshData } = useFilters();

  const fetchUploads = useCallback(async () => {
    const { data } = await supabase
      .from('uploads')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .limit(20);
    if (data) setUploads(data as UploadRecord[]);
  }, []);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  const handleClearDatabase = useCallback(async () => {
    if (!window.confirm('⚠️ WARNING: Are you absolutely sure you want to delete ALL data in the database? This action cannot be undone.')) {
      return;
    }
    
    setIsClearing(true);
    try {
      // Delete all records where store is not null (which is all of them)
      const { error: dataError } = await supabase.from('fact_store_month').delete().not('store', 'is', null);
      if (dataError) throw dataError;
      
      // Delete all records where id is not null (which is all of them)
      const { error: uploadsError } = await supabase.from('uploads').delete().not('id', 'is', null);
      if (uploadsError) throw uploadsError;
      
      alert('Database successfully cleared.');
      setUploads([]);
      await refreshData();
      router.refresh();
    } catch (e) {
      console.error(e);
      alert('Failed to clear database: ' + JSON.stringify(e));
    } finally {
      setIsClearing(false);
    }
  }, [refreshData, router]);

  return (
    <div>
      <div className="flex-between mb-24">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Data Upload</h1>
          <p className="page-description">
            Upload monthly store-level management files to build your analytics database.
          </p>
        </div>
        
        <button 
          className="btn" 
          onClick={handleClearDatabase}
          disabled={isClearing}
          style={{ 
            background: 'var(--accent-danger-dim)', 
            color: 'var(--accent-danger)', 
            border: '1px solid rgba(239, 68, 68, 0.3)',
            opacity: isClearing ? 0.7 : 1
          }}
        >
          {isClearing ? 'Clearing...' : '🗑️ Clear All Data'}
        </button>
      </div>

      <FileUploader />

      {/* Upload History */}
      {uploads.length > 0 && (
        <div className="mt-24">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Upload History</h2>
          <div className="data-table-container">
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className={thClass('filename')} onClick={() => handleSort('filename')}>File {sortKey === 'filename' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th className={thClass('status')} onClick={() => handleSort('status')}>Status {sortKey === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th className={thClass('rows_inserted')} onClick={() => handleSort('rows_inserted')}>Rows {sortKey === 'rows_inserted' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th className={thClass('uploaded_at')} onClick={() => handleSort('uploaded_at')}>Date {sortKey === 'uploaded_at' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const arr = [...uploads];
                    arr.sort((a, b) => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const va = (a as any)[sortKey];
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const vb = (b as any)[sortKey];
                      
                      const numA = typeof va === 'number' ? va : 0;
                      const numB = typeof vb === 'number' ? vb : 0;
                      
                      if (sortKey === 'uploaded_at') {
                        const timeA = new Date(va as string).getTime();
                        const timeB = new Date(vb as string).getTime();
                        return sortDir === 'asc' ? timeA - timeB : timeB - timeA;
                      }
                      
                      if (typeof va === 'string' && typeof vb === 'string') {
                        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
                      }
                      return sortDir === 'asc' ? numA - numB : numB - numA;
                    });
                    
                    return arr.map(u => (
                      <tr key={u.id}>
                        <td>{u.filename}</td>
                        <td>
                          <span
                            className="flag-badge"
                            style={{
                              background: u.status === 'success' ? 'var(--accent-primary-dim)' : 'var(--accent-danger-dim)',
                              color: u.status === 'success' ? 'var(--accent-primary)' : 'var(--accent-danger)',
                            }}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td className="numeric">{u.rows_inserted}</td>
                        <td style={{ color: 'var(--text-muted)' }}>
                          {new Date(u.uploaded_at).toLocaleString()}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


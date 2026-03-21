'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import FileUploader from '@/components/upload/FileUploader';
import { supabase } from '@/lib/supabase';
import type { UploadRecord } from '@/lib/types';
import { useFilters } from '@/contexts/FilterContext';

export default function UploadPage() {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [isClearing, setIsClearing] = useState(false);
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
                    <th>File</th>
                    <th>Status</th>
                    <th>Rows</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map(u => (
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


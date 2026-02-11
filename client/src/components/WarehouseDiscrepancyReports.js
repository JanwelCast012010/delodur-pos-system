import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import rateLimitManager from '../utils/rateLimitManager';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ArrowLeft, AlertTriangle } from 'lucide-react';

const WarehouseDiscrepancyReports = () => {
  const navigate = useNavigate();
  const [discrepancies, setDiscrepancies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    fetchDiscrepancies();
  }, []);

  const fetchDiscrepancies = async () => {
    if (isFetchingRef.current) return;
    if (!rateLimitManager.canMakeRequest()) {
      const waitTime = rateLimitManager.getTimeUntilCooldownEnds();
      rateLimitManager.queueRequest(() => fetchDiscrepancies());
      return;
    }
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      isFetchingRef.current = true;
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('No authentication token found. Please log in again.');
        setLoading(false);
        return;
      }

      console.log('🔍 Fetching warehouse discrepancy reports...');
      const res = await axios.get('/api/warehouse/discrepancies', {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortController.signal
      });
      if (abortController.signal.aborted) return;
      rateLimitManager.handleSuccess();
      
      console.log('✅ Discrepancy reports fetched successfully:', res.data);
      setDiscrepancies(res.data || []);
    } catch (err) {
      if (axios.isCancel(err) || err.name === 'AbortError' || abortController.signal.aborted) return;
      if (err.response?.status === 429) {
        const backoffDelay = rateLimitManager.handle429Error();
        const waitSeconds = Math.ceil(backoffDelay / 1000);
        setError(`Rate limit exceeded. Retrying in ${waitSeconds} seconds...`);
        rateLimitManager.queueRequest(() => fetchDiscrepancies());
        return;
      }
      console.error('❌ Fetch error:', err);
      
      if (err.response?.status === 401) {
        setError('Authentication failed. Please log in again.');
      } else if (err.response?.status === 500) {
        setError(`Server error: ${err.response.data?.message || 'Database query failed'}`);
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError(`Failed to fetch discrepancy reports: ${err.message}`);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingRef.current = false;
      abortControllerRef.current = null;
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDiscrepancies();
  };

     const formatDate = (dateString) => {
     if (!dateString) return 'N/A';
     try {
       const date = new Date(dateString);
       return date.toLocaleDateString('en-US', {
         month: '2-digit',
         day: '2-digit',
         year: 'numeric'
       });
     } catch (e) {
       return dateString;
     }
   };

           return (
      <div style={{
        padding: '24px',
        background: '#1a1a1a',
        minHeight: '100vh',
        color: 'var(--text-primary)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        lineHeight: '1.6'
      }}>
        {/* Header */}
        <div style={{ 
          background: '#2d2d2d', 
          padding: '20px 24px', 
          borderRadius: '10px', 
          marginBottom: '24px',
          border: '1px solid #404040',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid #404040',
                color: 'var(--text-primary)',
                borderRadius: '8px',
                padding: '8px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                fontSize: '14px',
                fontWeight: '500'
              }}
              onMouseOver={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseOut={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              <ArrowLeft size={18} />
              Back
            </button>
            <div>
              <h1 style={{ 
                color: 'var(--text-primary)', 
                margin: 0, 
                fontSize: '28px', 
                fontWeight: '700',
                letterSpacing: '-0.3px'
              }}>
                Warehouse Discrepancy Reports
              </h1>
              <p style={{ 
                color: '#b0b0b0', 
                margin: '6px 0 0 0', 
                fontSize: '14px',
                fontWeight: '400'
              }}>
                View all warehouse ID discrepancies and changes
              </p>
            </div>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            style={{
              background: '#007bff',
              color: 'var(--text-primary)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontWeight: '600',
              fontSize: '14px',
              cursor: (refreshing || loading) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background 0.2s ease',
              opacity: (refreshing || loading) ? 0.6 : 1
            }}
            onMouseOver={(e) => {
              if (!refreshing && !loading) {
                e.target.style.background = '#0056b3';
              }
            }}
            onMouseOut={(e) => {
              if (!refreshing && !loading) {
                e.target.style.background = '#007bff';
              }
            }}
          >
            <RefreshCw size={18} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

             {/* Loading State */}
       {loading ? (
         <div style={{ 
           background: '#2d2d2d', 
           padding: '40px', 
           borderRadius: '8px', 
           textAlign: 'center',
           border: '1px solid #404040'
         }}>
           <RefreshCw size={36} style={{ animation: 'spin 1s linear infinite', color: '#007bff' }} />
           <p style={{ color: '#ccc', margin: '16px 0 0 0', fontSize: '14px' }}>Loading discrepancy reports...</p>
         </div>
       ) : error ? (
         <div style={{ 
           background: '#2d2d2d', 
           padding: '40px', 
           borderRadius: '8px', 
           textAlign: 'center',
           border: '1px solid #404040'
         }}>
           <AlertTriangle size={36} style={{ color: '#dc3545' }} />
           <p style={{ color: '#dc3545', margin: '16px 0 0 0', fontSize: '14px' }}>{error}</p>
           <button
             onClick={handleRefresh}
             style={{
               background: '#007bff',
               color: 'var(--text-primary)',
               border: 'none',
               borderRadius: '6px',
               padding: '8px 16px',
               marginTop: '16px',
               fontWeight: '600',
               fontSize: '13px',
               cursor: 'pointer',
               transition: 'background 0.2s ease'
             }}
             onMouseOver={(e) => e.target.style.background = '#0056b3'}
             onMouseOut={(e) => e.target.style.background = '#007bff'}
           >
             Try Again
           </button>
         </div>
       ) : discrepancies.length === 0 ? (
         <div style={{ 
           background: '#2d2d2d', 
           padding: '40px', 
           borderRadius: '8px', 
           textAlign: 'center',
           border: '1px solid #404040'
         }}>
           <AlertTriangle size={40} style={{ color: '#666', marginBottom: '12px' }} />
           <h3 style={{ color: '#ccc', margin: '0 0 8px 0', fontSize: '18px' }}>No Discrepancies Found</h3>
           <p style={{ color: '#999', margin: 0, fontSize: '13px' }}>All warehouse records are consistent</p>
         </div>
      ) : (
                                   <div style={{
            background: '#2d2d2d',
            borderRadius: '10px',
            border: '1px solid #404040',
            overflow: 'hidden'
          }}>
            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                background: '#2d2d2d',
                color: '#e0e0e0',
                fontSize: '14px'
              }}>
                <thead>
                  <tr style={{
                    background: '#1a1a1a',
                    borderBottom: '2px solid #404040'
                  }}>
                    <th style={{
                      padding: '14px 16px',
                      textAlign: 'left',
                      fontWeight: '600',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>ORDER NO</th>
                    <th style={{
                      padding: '14px 16px',
                      textAlign: 'left',
                      fontWeight: '600',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>DATE</th>
                    <th style={{
                      padding: '14px 16px',
                      textAlign: 'left',
                      fontWeight: '600',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>ID</th>
                    <th style={{
                      padding: '14px 16px',
                      textAlign: 'left',
                      fontWeight: '600',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>BENZ</th>
                    <th style={{
                      padding: '14px 16px',
                      textAlign: 'left',
                      fontWeight: '600',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>BRAND</th>
                    <th style={{
                      padding: '14px 16px',
                      textAlign: 'left',
                      fontWeight: '600',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>ALT NO</th>
                    <th style={{
                      padding: '14px 16px',
                      textAlign: 'left',
                      fontWeight: '600',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>DESCRIPTION</th>
                    <th style={{
                      padding: '14px 16px',
                      textAlign: 'left',
                      fontWeight: '600',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>REASON</th>
                    <th style={{
                      padding: '14px 16px',
                      textAlign: 'left',
                      fontWeight: '600',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>NOTES</th>
                    <th style={{
                      padding: '14px 16px',
                      textAlign: 'left',
                      fontWeight: '600',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>EXCHANGE ID</th>
                  </tr>
                </thead>
                <tbody>
                  {discrepancies.map((discrepancy) => (
                    <tr 
                      key={discrepancy.id || discrepancy.order_id || Math.random()}
                      style={{
                        borderBottom: '1px solid #404040',
                        transition: 'background 0.2s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = '#3a3a3a';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: '#007bff' }}>
                        {discrepancy.order_id || 'N/A'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '14px' }}>
                        {formatDate(discrepancy.created_at)}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '14px', color: '#dc3545' }}>
                        {discrepancy.old_stock_id || 'N/A'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '14px' }}>
                        {discrepancy.old_item_benz || 'N/A'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '14px' }}>
                        {discrepancy.old_item_brand || 'N/A'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '14px' }}>
                        {discrepancy.old_item_altno || 'N/A'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '14px' }}>
                        {discrepancy.old_item_description || 'N/A'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '14px' }}>
                        {discrepancy.reason || 'N/A'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '14px' }}>
                        {discrepancy.notes || 'N/A'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '14px', color: '#28a745' }}>
                        {discrepancy.new_stock_id || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default WarehouseDiscrepancyReports;

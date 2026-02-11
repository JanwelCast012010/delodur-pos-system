import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import rateLimitManager from '../utils/rateLimitManager';
import { useNavigate } from 'react-router-dom';
import { 
  RefreshCw, 
  Search, 
  ArrowLeft,
  Package
} from 'lucide-react';
import useCustomModal from '../hooks/useCustomModal';
import CustomModal from './CustomModal';
import { useTheme } from '../contexts/ThemeContext';

const AdjustmentHistory = () => {
  const navigate = useNavigate();
  const { modalState, showAlert, showConfirm, closeModal } = useCustomModal();
  const { theme, isDark, isLight } = useTheme();
  
  const [adjustmentHistory, setAdjustmentHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef(null);
  
  // Fetch adjustment history
  const fetchAdjustmentHistory = async () => {
    if (isFetchingRef.current) return;
    if (!rateLimitManager.canMakeRequest()) {
      const waitTime = rateLimitManager.getTimeUntilCooldownEnds();
      rateLimitManager.queueRequest(() => fetchAdjustmentHistory());
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
      const response = await axios.get('/api/stock/adjustments', {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortController.signal
      });
      if (abortController.signal.aborted) return;
      rateLimitManager.handleSuccess();
      
      // Ensure we get the data array from the response
      const historyData = response.data?.data || response.data || [];
      // Ensure it's always an array
      const adjustments = Array.isArray(historyData) ? historyData : [];
      
      setAdjustmentHistory(adjustments);
      setTotalRecords(adjustments.length);
      setTotalPages(Math.ceil(adjustments.length / itemsPerPage));
    } catch (err) {
      if (axios.isCancel(err) || err.name === 'AbortError' || abortController.signal.aborted) return;
      if (err.response?.status === 429) {
        const backoffDelay = rateLimitManager.handle429Error();
        const waitSeconds = Math.ceil(backoffDelay / 1000);
        setError(`Rate limit exceeded. Retrying in ${waitSeconds} seconds...`);
        rateLimitManager.queueRequest(() => fetchAdjustmentHistory());
        return;
      }
      console.error('Error fetching adjustment history:', err);
      setError('Failed to fetch adjustment history.');
      await showAlert('Failed to fetch adjustment history. Please try again.', 'Error');
      setAdjustmentHistory([]);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      abortControllerRef.current = null;
    }
  };
  
  useEffect(() => {
    fetchAdjustmentHistory();
  }, [currentPage]);
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Filter adjustments
  const filteredAdjustments = React.useMemo(() => {
    let filtered = Array.isArray(adjustmentHistory) ? adjustmentHistory : [];
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(adj => 
        (adj.stock_id && String(adj.stock_id).toLowerCase().includes(searchLower)) ||
        (adj.benz && adj.benz.toLowerCase().includes(searchLower)) ||
        (adj.brand && adj.brand.toLowerCase().includes(searchLower)) ||
        (adj.reason && adj.reason.toLowerCase().includes(searchLower)) ||
        (adj.note && adj.note.toLowerCase().includes(searchLower))
      );
    }
    
    if (dateFilter) {
      filtered = filtered.filter(adj => {
        if (!adj.date) return false;
        const adjDate = new Date(adj.date).toISOString().split('T')[0];
        return adjDate === dateFilter;
      });
    }
    
    return filtered;
  }, [adjustmentHistory, searchTerm, dateFilter]);
  
  // Paginate filtered results
  const paginatedAdjustments = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAdjustments.slice(startIndex, endIndex);
  }, [filteredAdjustments, currentPage, itemsPerPage]);
  
  const totalFiltered = filteredAdjustments.length;
  const totalPagesFiltered = Math.ceil(totalFiltered / itemsPerPage);
  
  return (
    <div style={{
      minHeight: 'calc(100vh - 120px)',
      background: 'transparent',
      padding: '20px',
      color: 'var(--text-primary)'
    }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <CustomModal modalState={modalState} closeModal={closeModal} />
      
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: '700',
            color: 'var(--text-primary)'
          }}>
            Adjustment History
          </h1>
          <p style={{
            margin: '8px 0 0 0',
            fontSize: '14px',
            color: 'var(--text-muted)'
          }}>
            View all stock adjustment records
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => navigate('/inventory-management')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: 'rgba(108, 117, 125, 0.2)',
              border: '1px solid #6c757d',
              borderRadius: '8px',
              color: '#6c757d',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <ArrowLeft size={16} />
            Back to Inventory
          </button>
          
          <button
            onClick={fetchAdjustmentHistory}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: 'rgba(0, 123, 255, 0.2)',
              border: '1px solid #007bff',
              borderRadius: '8px',
              color: '#007bff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <RefreshCw size={16} style={{ 
              animation: loading ? 'spin 1s linear infinite' : 'none' 
            }} />
            Refresh
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
            <Search 
              size={20} 
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#6c757d'
              }}
            />
            <input
              type="text"
              placeholder="Search by Stock ID, BENZ, Brand, Reason, Note..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '10px 12px 10px 44px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
          
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: '10px 12px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>
      </div>
      
      {/* Adjustments Table */}
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '60px',
            color: '#6c757d'
          }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginRight: '12px' }} />
            Loading adjustment history...
          </div>
        ) : !Array.isArray(adjustmentHistory) || filteredAdjustments.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '60px',
            color: '#6c757d',
            textAlign: 'center'
          }}>
            <Package size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>No adjustments found</h3>
            <p style={{ margin: 0, fontSize: '14px' }}>
              {searchTerm || dateFilter 
                ? 'Try adjusting your filters' 
                : 'No adjustment records recorded yet'}
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                background: 'var(--card-bg)', 
                color: 'var(--text-primary)' 
              }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 10 }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Date</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Stock ID</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>BENZ</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Brand</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Reason</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Qty Added</th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Price</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Previous Qty</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>New Qty</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAdjustments.map((adj, index) => (
                    <tr key={adj.id || index} style={{ 
                      borderBottom: '1px solid var(--border-color)', 
                      backgroundColor: index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--card-bg)' 
                    }}>
                      <td style={{ padding: '12px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatDate(adj.date || adj.created_at)}</td>
                      <td style={{ padding: '12px', color: 'var(--text-primary)', fontFamily: 'monospace' }}>{adj.stock_id || 'N/A'}</td>
                      <td style={{ padding: '12px', color: '#64b5f6', fontFamily: 'monospace', fontWeight: '600' }}>{adj.benz || 'N/A'}</td>
                      <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{adj.brand || 'N/A'}</td>
                      <td style={{ padding: '12px', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                        {adj.reason ? adj.reason.replace('_', ' ').replace('-', ' ') : '-'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', color: '#28a745', fontWeight: '600' }}>
                        +{adj.quantity_added || 0}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        ₱{parseFloat(adj.price || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-primary)' }}>{adj.previous_quantity || 0}</td>
                      <td style={{ padding: '12px', textAlign: 'center', color: '#28a745', fontWeight: '600' }}>{adj.new_quantity || 0}</td>
                      <td style={{ 
                        padding: '12px', 
                        color: 'var(--text-primary)', 
                        maxWidth: '200px', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap' 
                      }} title={adj.note || ''}>
                        {adj.note || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPagesFiltered > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderTop: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)'
              }}>
                <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalFiltered)} of {totalFiltered} entries
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '8px 12px',
                      background: currentPage === 1 ? 'rgba(108, 117, 125, 0.2)' : 'rgba(0, 123, 255, 0.2)',
                      border: `1px solid ${currentPage === 1 ? '#6c757d' : '#007bff'}`,
                      borderRadius: '6px',
                      color: currentPage === 1 ? '#6c757d' : '#007bff',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}
                  >
                    Previous
                  </button>
                  
                  <span style={{ color: 'var(--text-primary)', fontSize: '14px', padding: '0 12px' }}>
                    Page {currentPage} of {totalPagesFiltered}
                  </span>
                  
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPagesFiltered, currentPage + 1))}
                    disabled={currentPage === totalPagesFiltered}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '8px 12px',
                      background: currentPage === totalPagesFiltered ? 'rgba(108, 117, 125, 0.2)' : 'rgba(0, 123, 255, 0.2)',
                      border: `1px solid ${currentPage === totalPagesFiltered ? '#6c757d' : '#007bff'}`,
                      borderRadius: '6px',
                      color: currentPage === totalPagesFiltered ? '#6c757d' : '#007bff',
                      cursor: currentPage === totalPagesFiltered ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdjustmentHistory;


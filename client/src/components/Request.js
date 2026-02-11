import React, { useState, useEffect, useMemo, useContext, useRef } from 'react';
import axios from 'axios';
import { AuthContext } from '../AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import rateLimitManager from '../utils/rateLimitManager';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Search, 
  Filter, 
  Download, 
  RefreshCw,
  Calendar,
  User,
  Package,
  FileText,
  TrendingUp,
  Zap,
  Edit2,
  Save,
  X
} from 'lucide-react';

const Request = () => {
  const { user } = useContext(AuthContext);
  const { socket, isConnected, on, off } = useWebSocket();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRequests, setSelectedRequests] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteValue, setNoteValue] = useState('');
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef(null);

  const PAGE_SIZE = 10;

  useEffect(() => {
    fetchRequests();
    // Auto-refresh every 5 seconds for faster updates (fallback if WebSocket not available)
    const interval = setInterval(() => {
      fetchRequests(true);
    }, 5000);
    
    // WebSocket: Listen for real-time stock request updates
    let handleStockRequestUpdate = null;
    if (socket && isConnected) {
      handleStockRequestUpdate = () => {
        console.log('📨 Stock request update received via WebSocket, refreshing...');
        fetchRequests(true);
      };
      
      on('stock-request-updated', handleStockRequestUpdate);
    }
    
    // Cleanup function
    return () => {
      clearInterval(interval);
      if (handleStockRequestUpdate) {
        off('stock-request-updated', handleStockRequestUpdate);
      }
    };
  }, [socket, isConnected, on, off]);

  const fetchRequests = async (silent = false) => {
    // Prevent multiple simultaneous API calls
    if (isFetchingRef.current) {
      console.log('🚫 Fetch already in progress, skipping...');
      return;
    }

    // Check rate limit manager
    if (!rateLimitManager.canMakeRequest()) {
      const waitTime = rateLimitManager.getTimeUntilCooldownEnds();
      console.log(`⏳ Rate limit cooldown active. Waiting ${waitTime / 1000}s...`);
      rateLimitManager.queueRequest(() => fetchRequests(silent));
      return;
    }

    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    if (!silent) setLoading(true);
    setError('');
    try {
      isFetchingRef.current = true;
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/stock-requests', {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortController.signal
      });

      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      // Mark success in rate limit manager
      rateLimitManager.handleSuccess();

      setRequests(response.data.data || response.data);
      setLastRefresh(new Date());
    } catch (err) {
      // Ignore aborted requests
      if (axios.isCancel(err) || err.name === 'AbortError' || abortController.signal.aborted) {
        console.log('Request aborted');
        return;
      }

      // Handle 429 rate limit errors
      if (err.response?.status === 429) {
        const backoffDelay = rateLimitManager.handle429Error();
        const waitSeconds = Math.ceil(backoffDelay / 1000);
        setError(`Rate limit exceeded. Retrying in ${waitSeconds} seconds...`);
        
        // Queue the request to retry after cooldown
        rateLimitManager.queueRequest(() => fetchRequests(silent));
        return;
      }

      setError('Failed to fetch requests');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      abortControllerRef.current = null;
    }
  };

  // Statistics
  const stats = useMemo(() => {
    const pending = requests.filter(r => r.status?.toLowerCase() === 'pending').length;
    const approved = requests.filter(r => r.status?.toLowerCase() === 'approved').length;
    const rejected = requests.filter(r => r.status?.toLowerCase() === 'rejected').length;
    const total = requests.length;
    const urgent = requests.filter(r => {
      if (r.status?.toLowerCase() !== 'pending') return false;
      const daysSince = (new Date() - new Date(r.created_at)) / (1000 * 60 * 60 * 24);
      return daysSince >= 3; // Urgent if pending for 3+ days
    }).length;

    return { pending, approved, rejected, total, urgent };
  }, [requests]);

  // Approve/Reject actions
  const handleStatusChange = async (id, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/stock-requests/${id}`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(reqs => reqs.map(r => r.id === id ? { ...r, status: newStatus } : r));
      setSelectedRequests(prev => prev.filter(sid => sid !== id));
    } catch (err) {
      alert('Failed to update status');
    }
  };

  // Handle note editing
  const handleEditNote = (req) => {
    setEditingNoteId(req.id);
    setNoteValue(req.notes || '');
  };

  const handleSaveNote = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/stock-requests/${id}`, { notes: noteValue }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(reqs => reqs.map(r => r.id === id ? { ...r, notes: noteValue } : r));
      setEditingNoteId(null);
      setNoteValue('');
    } catch (err) {
      alert('Failed to save note');
    }
  };

  const handleCancelNote = () => {
    setEditingNoteId(null);
    setNoteValue('');
  };

  // Bulk actions
  const handleBulkApprove = async () => {
    if (!window.confirm(`Approve ${selectedRequests.length} request(s)?`)) return;
    try {
      const token = localStorage.getItem('token');
      await Promise.all(
        selectedRequests.map(id => 
          axios.put(`/api/stock-requests/${id}`, { status: 'Approved' }, {
            headers: { Authorization: `Bearer ${token}` }
          })
        )
      );
      setRequests(reqs => reqs.map(r => 
        selectedRequests.includes(r.id) ? { ...r, status: 'Approved' } : r
      ));
      setSelectedRequests([]);
      alert(`${selectedRequests.length} request(s) approved successfully!`);
    } catch (err) {
      alert('Failed to approve requests');
    }
  };

  const handleBulkReject = async () => {
    if (!window.confirm(`Reject ${selectedRequests.length} request(s)?`)) return;
    try {
      const token = localStorage.getItem('token');
      await Promise.all(
        selectedRequests.map(id => 
          axios.put(`/api/stock-requests/${id}`, { status: 'Rejected' }, {
            headers: { Authorization: `Bearer ${token}` }
          })
        )
      );
      setRequests(reqs => reqs.map(r => 
        selectedRequests.includes(r.id) ? { ...r, status: 'Rejected' } : r
      ));
      setSelectedRequests([]);
      alert(`${selectedRequests.length} request(s) rejected successfully!`);
    } catch (err) {
      alert('Failed to reject requests');
    }
  };

  // Delete a stock request
  const handleDeleteRequest = async (id) => {
    if (!window.confirm('Are you sure you want to delete this stock request? This action cannot be undone.')) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/stock-requests/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(reqs => reqs.filter(r => r.id !== id));
      setSelectedRequests(prev => prev.filter(sid => sid !== id));
      alert('Stock request deleted successfully');
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to delete request';
      alert(`Failed to delete request: ${errorMessage}`);
    }
  };

  // Export to CSV
  const handleExport = () => {
    const csv = [
      ['Date', 'User', 'Part No.', 'OEM', 'Brand', 'Description', 'Reason', 'Status', 'Notes from ATB'].join(','),
      ...filteredRequests.map(req => [
        new Date(req.created_at).toLocaleString(),
        req.username || req.user_id,
        req.part_no,
        req.oem,
        req.brand,
        `"${req.stock_description?.replace(/"/g, '""') || ''}"`,
        `"${req.reason?.replace(/"/g, '""') || ''}"`,
        req.status,
        `"${req.notes?.replace(/"/g, '""') || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-requests-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Search and filter logic
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const matchesSearch =
        search === '' ||
        req.username?.toLowerCase().includes(search.toLowerCase()) ||
        req.part_no?.toLowerCase().includes(search.toLowerCase()) ||
        req.oem?.toLowerCase().includes(search.toLowerCase()) ||
        req.brand?.toLowerCase().includes(search.toLowerCase()) ||
        req.stock_description?.toLowerCase().includes(search.toLowerCase()) ||
        req.reason?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        !statusFilter || req.status?.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [requests, search, statusFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredRequests.length / PAGE_SIZE);
  const paginatedRequests = filteredRequests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Format date with relative time
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Check if request is urgent
  const isUrgent = (req) => {
    if (req.status?.toLowerCase() !== 'pending') return false;
    const daysSince = (new Date() - new Date(req.created_at)) / (1000 * 60 * 60 * 24);
    return daysSince >= 3;
  };

  const toggleSelect = (id) => {
    setSelectedRequests(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRequests.length === paginatedRequests.length) {
      setSelectedRequests([]);
    } else {
      setSelectedRequests(paginatedRequests.map(r => r.id));
    }
  };

  return (
    <div style={{ padding: '24px', backgroundColor: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h1 style={{ color: '#2563eb', margin: 0, fontSize: '28px', fontWeight: 600 }}>
            Stock Requests
          </h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => fetchRequests()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--hover-bg)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--bg-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <button
              onClick={handleExport}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #2563eb',
                background: '#2563eb',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#1e40af';
                e.currentTarget.style.borderColor = '#1e40af';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#2563eb';
                e.currentTarget.style.borderColor = '#2563eb';
              }}
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
          Manage and track stock requests from users
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '4px 0 0 0' }}>
          Last updated: {lastRefresh.toLocaleTimeString()}
        </p>
      </div>


      {/* Filters and Bulk Actions */}
      <div style={{ 
        marginBottom: '24px', 
        display: 'flex', 
        gap: '16px', 
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
          <Search size={18} style={{ 
            position: 'absolute', 
            left: '12px', 
            top: '50%', 
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)'
          }} />
          <input
            type="text"
            placeholder="Search requests..."
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            style={{ 
              width: '100%',
              padding: '10px 12px 10px 40px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)', 
              background: 'var(--input-bg)', 
              color: 'var(--text-primary)',
              fontSize: '14px',
              transition: 'border-color 0.2s'
            }}
            onFocus={e => e.target.style.borderColor = '#2563eb'}
            onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
          />
        </div>
        <div style={{ position: 'relative' }}>
          <Filter size={18} style={{ 
            position: 'absolute', 
            left: '12px', 
            top: '50%', 
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            pointerEvents: 'none'
          }} />
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            style={{ 
              padding: '10px 12px 10px 40px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)', 
              background: 'var(--input-bg)', 
              color: 'var(--text-primary)',
              fontSize: '14px',
              minWidth: '180px',
              cursor: 'pointer',
              appearance: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={e => e.target.style.borderColor = '#2563eb'}
            onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
        {user?.role === 'admin' && selectedRequests.length > 0 && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleBulkApprove}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#16a34a',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#15803d'}
              onMouseLeave={e => e.currentTarget.style.background = '#16a34a'}
            >
              <CheckCircle size={16} />
              Approve ({selectedRequests.length})
            </button>
            <button
              onClick={handleBulkReject}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#dc2626',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#b91c1c'}
              onMouseLeave={e => e.currentTarget.style.background = '#dc2626'}
            >
              <XCircle size={16} />
              Reject ({selectedRequests.length})
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        boxShadow: '0 2px 8px var(--shadow-sm)'
      }}>
        {loading ? (
          <div style={{ color: 'var(--text-primary)', padding: '40px', textAlign: 'center' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
            <div>Loading requests...</div>
          </div>
        ) : error ? (
          <div style={{ color: '#dc2626', padding: '40px', textAlign: 'center' }}>
            <AlertCircle size={24} style={{ marginBottom: '12px' }} />
            <div>{error}</div>
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
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {user?.role === 'admin' && (
                      <th style={{
                        padding: '16px',
                        textAlign: 'left',
                        borderBottom: '2px solid var(--border-color)',
                        fontWeight: 600,
                        fontSize: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: 'var(--text-primary)'
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedRequests.length === paginatedRequests.length && paginatedRequests.length > 0}
                          onChange={toggleSelectAll}
                          style={{ cursor: 'pointer' }}
                        />
                      </th>
                    )}
                    <th style={{
                      padding: '16px',
                      textAlign: 'left',
                      borderBottom: '2px solid var(--border-color)',
                      fontWeight: 600,
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--text-primary)'
                    }}>Date</th>
                    <th style={{
                      padding: '16px',
                      textAlign: 'left',
                      borderBottom: '2px solid var(--border-color)',
                      fontWeight: 600,
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--text-primary)'
                    }}>User</th>
                    <th style={{
                      padding: '16px',
                      textAlign: 'left',
                      borderBottom: '2px solid var(--border-color)',
                      fontWeight: 600,
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--text-primary)'
                    }}>Part No.</th>
                    <th style={{
                      padding: '16px',
                      textAlign: 'left',
                      borderBottom: '2px solid var(--border-color)',
                      fontWeight: 600,
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--text-primary)'
                    }}>OEM</th>
                    <th style={{
                      padding: '16px',
                      textAlign: 'left',
                      borderBottom: '2px solid var(--border-color)',
                      fontWeight: 600,
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--text-primary)'
                    }}>Brand</th>
                    <th style={{
                      padding: '16px',
                      textAlign: 'left',
                      borderBottom: '2px solid var(--border-color)',
                      fontWeight: 600,
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--text-primary)'
                    }}>Description</th>
                    <th style={{
                      padding: '16px',
                      textAlign: 'left',
                      borderBottom: '2px solid var(--border-color)',
                      fontWeight: 600,
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--text-primary)'
                    }}>Reason</th>
                    <th style={{
                      padding: '16px',
                      textAlign: 'left',
                      borderBottom: '2px solid var(--border-color)',
                      fontWeight: 600,
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--text-primary)'
                    }}>Status</th>
                    {user?.role === 'admin' && <th style={{
                      padding: '16px',
                      textAlign: 'left',
                      borderBottom: '2px solid var(--border-color)',
                      fontWeight: 600,
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--text-primary)'
                    }}>Actions</th>}
                    <th style={{
                      padding: '16px',
                      textAlign: 'left',
                      borderBottom: '2px solid var(--border-color)',
                      fontWeight: 600,
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--text-primary)'
                    }}>Notes from ATB</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRequests.length === 0 ? (
                    <tr>
                      <td colSpan={user?.role === 'admin' ? 11 : 10} style={{ 
                        textAlign: 'center', 
                        padding: '60px 24px', 
                        color: 'var(--text-muted)' 
                      }}>
                        <Package size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                        <div style={{ fontSize: '16px', fontWeight: 500 }}>No stock requests found</div>
                        <div style={{ fontSize: '14px', marginTop: '8px' }}>
                          {search || statusFilter ? 'Try adjusting your filters' : 'No requests have been submitted yet'}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedRequests.map(req => {
                      const urgent = isUrgent(req);
                      return (
                        <tr 
                          key={req.id} 
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            transition: 'background 0.2s',
                            background: urgent ? 'rgba(220, 38, 38, 0.05)' : 'transparent'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = urgent ? 'rgba(220, 38, 38, 0.1)' : 'var(--hover-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = urgent ? 'rgba(220, 38, 38, 0.05)' : 'transparent'}
                        >
                          {user?.role === 'admin' && (
                            <td style={{ padding: '16px' }}>
                              <input
                                type="checkbox"
                                checked={selectedRequests.includes(req.id)}
                                onChange={() => toggleSelect(req.id)}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                          )}
                          <td style={{ padding: '16px', fontSize: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Calendar size={14} color="var(--text-muted)" />
                              <div>
                                <div style={{ color: 'var(--text-primary)' }}>{formatDate(req.created_at)}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                  {new Date(req.created_at).toLocaleTimeString('en-US', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <User size={14} color="var(--text-muted)" />
                              <span style={{ color: 'var(--text-primary)' }}>{req.username || req.user_id}</span>
                            </div>
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                            {req.part_no}
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: 'var(--text-primary)' }}>
                            {req.oem}
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: 'var(--text-primary)' }}>
                            {req.brand}
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: 'var(--text-primary)', maxWidth: '250px' }}>
                            <div style={{ 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap',
                              title: req.stock_description
                            }}>
                              {req.stock_description || '-'}
                            </div>
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: 'var(--text-primary)', maxWidth: '200px' }}>
                            <div style={{ 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap',
                              title: req.reason
                            }}>
                              {req.reason || '-'}
                            </div>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              ...(req.status?.toLowerCase() === 'pending' ? {
                                background: 'rgba(202, 138, 4, 0.2)',
                                color: '#ca8a04',
                                border: '1px solid rgba(202, 138, 4, 0.3)'
                              } : req.status?.toLowerCase() === 'approved' ? {
                                background: 'rgba(22, 163, 74, 0.2)',
                                color: '#16a34a',
                                border: '1px solid rgba(22, 163, 74, 0.3)'
                              } : {
                                background: 'rgba(220, 38, 38, 0.2)',
                                color: '#dc2626',
                                border: '1px solid rgba(220, 38, 38, 0.3)'
                              })
                            }}>
                              {req.status?.toLowerCase() === 'pending' && <Clock size={12} />}
                              {req.status?.toLowerCase() === 'approved' && <CheckCircle size={12} />}
                              {req.status?.toLowerCase() === 'rejected' && <XCircle size={12} />}
                              {req.status}
                              {urgent && <Zap size={12} style={{ marginLeft: '4px' }} />}
                            </span>
                          </td>
                          {user?.role === 'admin' && (
                            <td style={{ padding: '12px', whiteSpace: 'nowrap', minWidth: '200px' }}>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap', alignItems: 'center' }}>
                                {req.status === 'Pending' && (
                                  <>
                                    <button
                                      onClick={() => handleStatusChange(req.id, 'Approved')}
                                      style={{
                                        padding: '6px 10px',
                                        borderRadius: '4px',
                                        border: 'none',
                                        background: '#16a34a',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)',
                                        whiteSpace: 'nowrap'
                                      }}
                                      onMouseEnter={e => {
                                        e.currentTarget.style.background = '#15803d';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(22, 163, 74, 0.3)';
                                      }}
                                      onMouseLeave={e => {
                                        e.currentTarget.style.background = '#16a34a';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(22, 163, 74, 0.2)';
                                      }}
                                    >
                                      <CheckCircle size={12} />
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => handleStatusChange(req.id, 'Rejected')}
                                      style={{
                                        padding: '6px 10px',
                                        borderRadius: '4px',
                                        border: 'none',
                                        background: '#dc2626',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                                        whiteSpace: 'nowrap'
                                      }}
                                      onMouseEnter={e => {
                                        e.currentTarget.style.background = '#b91c1c';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(220, 38, 38, 0.3)';
                                      }}
                                      onMouseLeave={e => {
                                        e.currentTarget.style.background = '#dc2626';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(220, 38, 38, 0.2)';
                                      }}
                                    >
                                      <XCircle size={12} />
                                      Reject
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => handleDeleteRequest(req.id)}
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.background = '#dc2626';
                                    e.currentTarget.style.borderColor = '#dc2626';
                                    e.currentTarget.style.color = '#fff';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = 'var(--bg-secondary)';
                                    e.currentTarget.style.borderColor = 'var(--border-color)';
                                    e.currentTarget.style.color = 'var(--text-primary)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                  }}
                                >
                                  <XCircle size={12} />
                                  Delete
                                </button>
                              </div>
                            </td>
                          )}
                          <td style={{ padding: '16px', fontSize: '14px', maxWidth: '300px', minWidth: '200px' }}>
                            {editingNoteId === req.id ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <textarea
                                  value={noteValue}
                                  onChange={(e) => setNoteValue(e.target.value)}
                                  placeholder="Add a note from ATB..."
                                  style={{
                                    width: '100%',
                                    minHeight: '80px',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: '2px solid #2563eb',
                                    background: 'var(--input-bg)',
                                    color: 'var(--text-primary)',
                                    fontSize: '13px',
                                    resize: 'vertical',
                                    fontFamily: 'inherit',
                                    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.1)',
                                    transition: 'all 0.2s'
                                  }}
                                  autoFocus
                                />
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={handleCancelNote}
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--border-color)',
                                      background: 'var(--bg-secondary)',
                                      color: 'var(--text-primary)',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      fontWeight: 500,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => {
                                      e.currentTarget.style.background = 'var(--hover-bg)';
                                    }}
                                    onMouseLeave={e => {
                                      e.currentTarget.style.background = 'var(--bg-secondary)';
                                    }}
                                  >
                                    <X size={14} />
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleSaveNote(req.id)}
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: '6px',
                                      border: 'none',
                                      background: '#16a34a',
                                      color: '#fff',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      fontWeight: 500,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      transition: 'all 0.2s',
                                      boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)'
                                    }}
                                    onMouseEnter={e => {
                                      e.currentTarget.style.background = '#15803d';
                                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(22, 163, 74, 0.3)';
                                    }}
                                    onMouseLeave={e => {
                                      e.currentTarget.style.background = '#16a34a';
                                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(22, 163, 74, 0.2)';
                                    }}
                                  >
                                    <Save size={14} />
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%' }}>
                                <div style={{ 
                                  flex: 1,
                                  minWidth: 0,
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  background: req.notes ? 'var(--bg-tertiary)' : 'transparent',
                                  border: req.notes ? '1px solid var(--border-color)' : 'none',
                                  minHeight: '36px',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}>
                                  <span style={{ 
                                    color: req.notes ? 'var(--text-primary)' : 'var(--text-muted)', 
                                    fontSize: '13px',
                                    lineHeight: '1.4',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'pre-wrap'
                                  }} title={req.notes || ''}>
                                    {req.notes || <span style={{ fontStyle: 'italic' }}>No notes</span>}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleEditNote(req)}
                                  style={{
                                    padding: '6px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: '32px',
                                    height: '32px',
                                    transition: 'all 0.2s',
                                    flexShrink: 0
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.background = '#2563eb';
                                    e.currentTarget.style.borderColor = '#2563eb';
                                    e.currentTarget.style.color = '#fff';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = 'var(--bg-secondary)';
                                    e.currentTarget.style.borderColor = 'var(--border-color)';
                                    e.currentTarget.style.color = 'var(--text-primary)';
                                  }}
                                  title={req.notes ? "Edit note" : "Add note"}
                                >
                                  <Edit2 size={14} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                padding: '20px',
                gap: '12px',
                borderTop: '1px solid var(--border-color)'
              }}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: currentPage === 1 ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                    color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    if (currentPage !== 1) {
                      e.currentTarget.style.background = 'var(--hover-bg)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (currentPage !== 1) {
                      e.currentTarget.style.background = 'var(--bg-tertiary)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }
                  }}
                >
                  Previous
                </button>
                <span style={{ color: 'var(--text-primary)', fontSize: '14px', padding: '0 16px' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: currentPage === totalPages ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                    color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    if (currentPage !== totalPages) {
                      e.currentTarget.style.background = 'var(--hover-bg)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (currentPage !== totalPages) {
                      e.currentTarget.style.background = 'var(--bg-tertiary)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Request;

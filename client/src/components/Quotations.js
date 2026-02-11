import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import CustomModal from './CustomModal';
import useCustomModal from '../hooks/useCustomModal';
import rateLimitManager from '../utils/rateLimitManager';

const Quotations = () => {
  // Custom Modal Hook
  const { modalState, showAlert, showConfirm, closeModal } = useCustomModal();
  
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    customer_name: '',
    chassis_number: '',
    contact_number: '',
    status: ''
  });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [stockSearchTerm, setStockSearchTerm] = useState('');
  const [stockSearchResults, setStockSearchResults] = useState([]);
  const [selectedStockItem, setSelectedStockItem] = useState(null);
  const [addItemQuantity, setAddItemQuantity] = useState(1);
  const [searchingStock, setSearchingStock] = useState(false);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef(null);

  const statusColors = {
    pending: '#ca8a04', // semantic-yellow
    approved: '#16a34a', // semantic-green
    converted: '#2563eb', // semantic-blue (corp-primary-blue)
    expired: '#dc2626' // semantic-red
  };

  const statusLabels = {
    pending: 'Pending',
    approved: 'Approved',
    converted: 'Converted',
    expired: 'Expired'
  };

  useEffect(() => {
    fetchQuotations();
  }, [currentPage, searchTerm, statusFilter]);

  const fetchQuotations = async () => {
    // Prevent multiple simultaneous API calls
    if (isFetchingRef.current) {
      console.log('🚫 Fetch already in progress, skipping...');
      return;
    }

    // Check rate limit manager
    if (!rateLimitManager.canMakeRequest()) {
      const waitTime = rateLimitManager.getTimeUntilCooldownEnds();
      console.log(`⏳ Rate limit cooldown active. Waiting ${waitTime / 1000}s...`);
      rateLimitManager.queueRequest(() => fetchQuotations());
      return;
    }

    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      isFetchingRef.current = true;
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        search: searchTerm,
        status: statusFilter
      });

      const response = await axios.get(`/api/quotations?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortController.signal
      });

      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      // Mark success in rate limit manager
      rateLimitManager.handleSuccess();

      setQuotations(response.data.data);
      setTotalPages(response.data.pagination.pages);
    } catch (error) {
      // Ignore aborted requests
      if (axios.isCancel(error) || error.name === 'AbortError' || abortController.signal.aborted) {
        console.log('Request aborted');
        return;
      }

      // Handle 429 rate limit errors
      if (error.response?.status === 429) {
        const backoffDelay = rateLimitManager.handle429Error();
        const waitSeconds = Math.ceil(backoffDelay / 1000);
        await showAlert(`Rate limit exceeded. Retrying in ${waitSeconds} seconds...`, 'Rate Limit');
        
        // Queue the request to retry after cooldown
        rateLimitManager.queueRequest(() => fetchQuotations());
        return;
      }

      console.error('Error fetching quotations:', error);
      await showAlert('Error fetching quotations: ' + (error.response?.data?.message || error.message), 'Error');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      abortControllerRef.current = null;
    }
  };

  const handleViewDetails = async (quotationId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/quotations/${quotationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSelectedQuotation(response.data);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error fetching quotation details:', error);
      await showAlert('Error fetching quotation details: ' + (error.response?.data?.message || error.message), 'Error');
    }
  };

  const handleEditQuotation = (quotation) => {
    setEditForm({
      customer_name: quotation.customer_name,
      chassis_number: quotation.chassis_number || '',
      contact_number: quotation.contact_number || '',
      status: quotation.status
    });
    setSelectedQuotation(quotation);
    setShowEditModal(true);
  };

  const handleUpdateQuotation = async () => {
    if (!editForm.customer_name.trim()) {
      await showAlert('Customer name is required.', 'Required Field');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/quotations/${selectedQuotation.id}`, editForm, {
        headers: { Authorization: `Bearer ${token}` }
      });

      await showAlert('Quotation updated successfully!', 'Success');
      setShowEditModal(false);
      fetchQuotations();
    } catch (error) {
      console.error('Error updating quotation:', error);
      await showAlert('Error updating quotation: ' + (error.response?.data?.message || error.message), 'Error');
    }
  };

  const handleDeleteQuotation = (quotation) => {
    setDeleteConfirmModal(quotation);
  };

  const confirmDeleteQuotation = async () => {
    if (!deleteConfirmModal) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/quotations/${deleteConfirmModal.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      await showAlert('Quotation deleted successfully!', 'Success');
      setDeleteConfirmModal(null);
      fetchQuotations();
    } catch (error) {
      console.error('Error deleting quotation:', error);
      await showAlert('Error deleting quotation: ' + (error.response?.data?.message || error.message), 'Error');
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setEditQuantity(item.quantity.toString());
  };

  const handleUpdateItemQuantity = async () => {
    if (!editingItem || !editQuantity || parseInt(editQuantity) < 1) {
      alert('Please enter a valid quantity.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `/api/quotations/${selectedQuotation.quotation.id}/items/${editingItem.id}`,
        { quantity: parseInt(editQuantity) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert('Item quantity updated successfully!');
        setEditingItem(null);
        setEditQuantity('');
        // Refresh the quotation details
        handleViewDetails(selectedQuotation.quotation.id);
      }
    } catch (error) {
      console.error('Error updating item quantity:', error);
      alert('Error updating item quantity: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleRemoveItem = async (item) => {
    if (!window.confirm(`Are you sure you want to remove this item from the quotation?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(
        `/api/quotations/${selectedQuotation.quotation.id}/items/${item.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert('Item removed successfully!');
        // Refresh the quotation details
        handleViewDetails(selectedQuotation.quotation.id);
      }
    } catch (error) {
      console.error('Error removing item:', error);
      alert('Error removing item: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleAddItem = () => {
    setShowAddItemModal(true);
    setStockSearchTerm('');
    setStockSearchResults([]);
    setSelectedStockItem(null);
    setAddItemQuantity(1);
  };

  const handleSearchStock = async () => {
    if (!stockSearchTerm.trim()) {
      setStockSearchResults([]);
      return;
    }

    try {
      setSearchingStock(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `/api/quotations/${selectedQuotation.quotation.id}/search-stock?search=${encodeURIComponent(stockSearchTerm)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setStockSearchResults(response.data.items || []);
    } catch (error) {
      console.error('Error searching stock:', error);
      alert('Error searching stock: ' + (error.response?.data?.message || error.message));
    } finally {
      setSearchingStock(false);
    }
  };

  const handleSelectStockItem = (item) => {
    setSelectedStockItem(item);
  };

  const handleAddItemToQuotation = async () => {
    if (!selectedStockItem || !addItemQuantity || addItemQuantity < 1) {
      alert('Please select an item and enter a valid quantity.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `/api/quotations/${selectedQuotation.quotation.id}/items`,
        {
          stock_id: selectedStockItem.ID,
          quantity: parseInt(addItemQuantity)
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert('Item added successfully!');
        setShowAddItemModal(false);
        setStockSearchTerm('');
        setStockSearchResults([]);
        setSelectedStockItem(null);
        setAddItemQuantity(1);
        // Refresh the quotation details
        handleViewDetails(selectedQuotation.quotation.id);
      }
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Error adding item: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleUpdateStatus = async (quotationId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/quotations/${quotationId}/status`, 
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Status updated successfully!');
      fetchQuotations();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleConvertToOrder = async (quotationId) => {
    if (!window.confirm('Are you sure you want to convert this quotation to an order? This will deduct stock quantities.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`/api/quotations/${quotationId}/convert-to-order`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(`Quotation converted to order successfully!\nOrder Number: #${response.data.order_id}`);
      fetchQuotations();
    } catch (error) {
      console.error('Error converting quotation:', error);
      alert('Error converting quotation: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleExpireQuotations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/quotations/expire', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(response.data.message);
      fetchQuotations();
    } catch (error) {
      console.error('Error expiring quotations:', error);
      alert('Error expiring quotations: ' + (error.response?.data?.message || error.message));
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpired = (expiryDate) => {
    return new Date(expiryDate) < new Date();
  };

  return (
    <div style={{ padding: '20px', backgroundColor: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ color: '#2563eb', marginBottom: '8px', fontSize: '28px', fontWeight: 600 }}>
            Quotations Management
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>
            Manage customer quotations and convert them to orders
          </p>
        </div>

        {/* Controls */}
        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <input
              type="text"
              placeholder="Search quotations..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--input-bg)',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--input-bg)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              minWidth: '150px'
            }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="converted">Converted</option>
            <option value="expired">Expired</option>
          </select>
          <button
            onClick={handleExpireQuotations}
            style={{
              padding: '10px 16px',
              borderRadius: '6px',
              border: '1px solid #dc3545',
              backgroundColor: '#dc3545',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={e => {
              e.currentTarget.style.backgroundColor = '#b91c1c';
              e.currentTarget.style.borderColor = '#b91c1c';
            }}
            onMouseOut={e => {
              e.currentTarget.style.backgroundColor = '#dc2626';
              e.currentTarget.style.borderColor = '#dc2626';
            }}
          >
            Expire Old Quotations
          </button>
        </div>

        {/* Quotations Table */}
        <div style={{
          backgroundColor: 'var(--card-bg)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          boxShadow: '0 2px 8px var(--shadow-sm)'
        }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading quotations...
            </div>
          ) : quotations.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No quotations found
            </div>
          ) : (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 1fr',
                gap: '16px',
                padding: '16px',
                backgroundColor: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)',
                fontWeight: 600,
                fontSize: '14px',
                color: 'var(--text-primary)'
              }}>
                <div>Quotation #</div>
                <div>Customer</div>
                <div>Chassis</div>
                <div>Date</div>
                <div>Expiry</div>
                <div>Status</div>
                <div>Actions</div>
              </div>
              {quotations.map((quotation) => (
                <div key={quotation.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 1fr',
                  gap: '16px',
                  padding: '16px',
                  borderBottom: '1px solid var(--border-color)',
                  alignItems: 'center',
                  fontSize: '14px',
                  transition: 'background 0.2s',
                  backgroundColor: 'var(--card-bg)'
                }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = 'var(--card-bg)'}>
                  <div style={{ color: '#2563eb', fontWeight: 600 }}>
                    {quotation.quotation_number}
                  </div>
                  <div style={{ color: 'var(--text-primary)' }}>
                    {quotation.customer_name}
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    {quotation.chassis_number || '-'}
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    {formatDate(quotation.quotation_date)}
                  </div>
                  <div style={{ 
                    color: isExpired(quotation.expiry_date) ? '#dc2626' : 'var(--text-muted)' 
                  }}>
                    {formatDate(quotation.expiry_date)}
                  </div>
                  <div>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: statusColors[quotation.status] + '20',
                      color: statusColors[quotation.status],
                      border: `1px solid ${statusColors[quotation.status]}40`
                    }}>
                      {statusLabels[quotation.status]}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleViewDetails(quotation.id)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleEditQuotation(quotation)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid #ca8a04',
                        backgroundColor: '#ca8a04',
                        color: '#fff',
                        fontSize: '11px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.backgroundColor = '#a16207';
                        e.currentTarget.style.borderColor = '#e0a800';
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.backgroundColor = '#a16207';
                        e.currentTarget.style.borderColor = '#a16207';
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteQuotation(quotation)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid #dc2626',
                        backgroundColor: '#dc2626',
                        color: '#fff',
                        fontSize: '11px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.backgroundColor = '#b91c1c';
                        e.currentTarget.style.borderColor = '#b91c1c';
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.backgroundColor = '#b91c1c';
                        e.currentTarget.style.borderColor = '#b91c1c';
                      }}
                    >
                      Delete
                    </button>
                    {quotation.status === 'pending' && (
                      <button
                        onClick={() => handleUpdateStatus(quotation.id, 'approved')}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid #16a34a',
                          backgroundColor: '#16a34a',
                          color: '#fff',
                          fontSize: '11px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={e => {
                          e.currentTarget.style.backgroundColor = '#15803d';
                          e.currentTarget.style.borderColor = '#15803d';
                        }}
                        onMouseOut={e => {
                          e.currentTarget.style.backgroundColor = '#15803d';
                          e.currentTarget.style.borderColor = '#15803d';
                        }}
                      >
                        Approve
                      </button>
                    )}
                    {quotation.status === 'approved' && (
                      <button
                        onClick={() => handleConvertToOrder(quotation.id)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid #2563eb',
                          backgroundColor: '#2563eb',
                          color: '#fff',
                          fontSize: '11px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={e => {
                          e.currentTarget.style.backgroundColor = '#1e40af';
                          e.currentTarget.style.borderColor = '#1e40af';
                        }}
                        onMouseOut={e => {
                          e.currentTarget.style.backgroundColor = '#1e40af';
                          e.currentTarget.style.borderColor = '#1e40af';
                        }}
                      >
                        Convert
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            marginTop: '24px'
          }}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: currentPage === 1 ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: '14px',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              Previous
            </button>
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: currentPage === totalPages ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: '14px',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Quotation Details Modal */}
      {showDetailsModal && selectedQuotation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--modal-overlay)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 5000
        }}>
          <div style={{
            backgroundColor: 'var(--modal-bg)',
            borderRadius: '12px',
            padding: 0,
            maxWidth: '800px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px var(--shadow-lg)',
            border: '1px solid var(--border-color)'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-secondary)'
            }}>
              <h3 style={{ margin: 0, color: '#2563eb', fontSize: '20px', fontWeight: 600 }}>
                Quotation Details - {selectedQuotation.quotation.quotation_number}
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'background 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(144, 202, 249, 0.1)'}
                onMouseOut={e => e.currentTarget.style.background = 'none'}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div style={{
              padding: '24px',
              flex: 1,
              overflowY: 'auto'
            }}>
              {/* Customer Info */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ color: '#2563eb', marginBottom: '12px', fontSize: '16px' }}>
                  Customer Information
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  padding: '16px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>Customer Name</div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{selectedQuotation.quotation.customer_name}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>Contact Number</div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{selectedQuotation.quotation.contact_number || '-'}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>Chassis Number</div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{selectedQuotation.quotation.chassis_number || '-'}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>Status</div>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: statusColors[selectedQuotation.quotation.status] + '20',
                      color: statusColors[selectedQuotation.quotation.status],
                      border: `1px solid ${statusColors[selectedQuotation.quotation.status]}40`
                    }}>
                      {statusLabels[selectedQuotation.quotation.status]}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ color: '#2563eb', fontSize: '16px', margin: 0 }}>
                    Quotation Items ({selectedQuotation.items.length})
                  </h4>
                  <button
                    onClick={handleAddItem}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1px solid #28a745',
                      backgroundColor: '#28a745',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.backgroundColor = '#218838';
                      e.currentTarget.style.borderColor = '#218838';
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.backgroundColor = '#28a745';
                      e.currentTarget.style.borderColor = '#28a745';
                    }}
                  >
                    + Add Item
                  </button>
                </div>
                <div style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  {selectedQuotation.items.map((item, index) => (
                    <div key={item.id} style={{
                      padding: '16px',
                      borderBottom: index < selectedQuotation.items.length - 1 ? '1px solid var(--border-color)' : 'none',
                      backgroundColor: 'var(--card-bg)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#2563eb', fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                            ID: {item.stock_id}
                          </div>
                          <div style={{ color: 'var(--text-primary)', fontSize: '13px', marginBottom: '2px' }}>
                            {item.BENZ} - {item.BRAND} {item.ALTNO}
                          </div>
                          {item.DESCRIPTION && item.DESCRIPTION !== 'null' && (
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>
                              {item.DESCRIPTION}
                            </div>
                          )}
                          <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                            Location: {item.LOCATION && item.LOCATION !== 'null' ? item.LOCATION : 'Not specified'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', minWidth: '200px' }}>
                          {editingItem && editingItem.id === item.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                  type="number"
                                  value={editQuantity}
                                  onChange={e => setEditQuantity(e.target.value)}
                                  min="1"
                                  style={{
                                    width: '60px',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--input-bg)',
                                    color: 'var(--text-primary)',
                                    fontSize: '12px'
                                  }}
                                />
                                <button
                                  onClick={handleUpdateItemQuantity}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    border: '1px solid #28a745',
                                    backgroundColor: '#28a745',
                                    color: '#fff',
                                    fontSize: '11px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingItem(null);
                                    setEditQuantity('');
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    border: '1px solid #6c757d',
                                    backgroundColor: '#6c757d',
                                    color: '#fff',
                                    fontSize: '11px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ color: 'var(--text-primary)', fontSize: '14px', marginBottom: '2px' }}>
                                Qty: {item.quantity}
                              </div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '2px' }}>
                                ₱{item.unit_price.toLocaleString()} each
                              </div>
                              <div style={{ color: '#2563eb', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                                ₱{item.total_price.toLocaleString()}
                              </div>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                <button
                                  onClick={() => handleEditItem(item)}
                                  style={{
                                    padding: '3px 6px',
                                    borderRadius: '3px',
                                    border: '1px solid #ffc107',
                                    backgroundColor: '#ffc107',
                                    color: '#000',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseOver={e => {
                                    e.currentTarget.style.backgroundColor = '#e0a800';
                                    e.currentTarget.style.borderColor = '#e0a800';
                                  }}
                                  onMouseOut={e => {
                                    e.currentTarget.style.backgroundColor = '#ffc107';
                                    e.currentTarget.style.borderColor = '#ffc107';
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleRemoveItem(item)}
                                  style={{
                                    padding: '3px 6px',
                                    borderRadius: '3px',
                                    border: '1px solid #dc3545',
                                    backgroundColor: '#dc3545',
                                    color: '#fff',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseOver={e => {
                                    e.currentTarget.style.backgroundColor = '#c82333';
                                    e.currentTarget.style.borderColor = '#c82333';
                                  }}
                                  onMouseOut={e => {
                                    e.currentTarget.style.backgroundColor = '#dc3545';
                                    e.currentTarget.style.borderColor = '#dc3545';
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div style={{
                padding: '16px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>
                    Total Amount:
                  </span>
                  <span style={{ color: '#2563eb', fontSize: '18px', fontWeight: 700 }}>
                    ₱{selectedQuotation.quotation.total_amount.toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <span>Created: {formatDate(selectedQuotation.quotation.created_at)}</span>
                  <span>Expires: {formatDate(selectedQuotation.quotation.expiry_date)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              backgroundColor: 'var(--bg-secondary)'
            }}>
              <button
                onClick={() => setShowDetailsModal(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Quotation Modal */}
      {showEditModal && selectedQuotation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--modal-overlay)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 5000
        }}>
          <div style={{
            backgroundColor: 'var(--card-bg)',
            borderRadius: '12px',
            padding: 0,
            maxWidth: '500px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            border: '1px solid var(--border-color)'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-secondary)'
            }}>
              <h3 style={{ margin: 0, color: '#2563eb', fontSize: '20px', fontWeight: 600 }}>
                Edit Quotation - {selectedQuotation.quotation_number}
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'background 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(144, 202, 249, 0.1)'}
                onMouseOut={e => e.currentTarget.style.background = 'none'}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div style={{
              padding: '24px',
              flex: 1,
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={editForm.customer_name}
                    onChange={e => setEditForm(prev => ({ ...prev, customer_name: e.target.value.toUpperCase() }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                    Chassis Number
                  </label>
                  <input
                    type="text"
                    value={editForm.chassis_number}
                    onChange={e => setEditForm(prev => ({ ...prev, chassis_number: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                    Contact Number
                  </label>
                  <input
                    type="text"
                    value={editForm.contact_number}
                    onChange={e => setEditForm(prev => ({ ...prev, contact_number: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                    Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '14px'
                    }}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="converted">Converted</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              backgroundColor: 'var(--bg-secondary)'
            }}>
              <button
                onClick={() => setShowEditModal(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateQuotation}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: '1px solid #ffc107',
                  backgroundColor: '#ffc107',
                  color: '#000',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.backgroundColor = '#e0a800';
                  e.currentTarget.style.borderColor = '#e0a800';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.backgroundColor = '#ffc107';
                  e.currentTarget.style.borderColor = '#ffc107';
                }}
              >
                Update Quotation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--modal-overlay)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 5000
        }}>
          <div style={{
            backgroundColor: 'var(--card-bg)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            border: '1px solid #dc3545'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#dc3545', fontSize: '18px', fontWeight: 600 }}>
              Delete Quotation
            </h3>
            <p style={{ color: 'var(--text-primary)', marginBottom: '24px', lineHeight: '1.5' }}>
              Are you sure you want to delete quotation <strong>{deleteConfirmModal.quotation_number}</strong>? 
              This action cannot be undone and will permanently remove the quotation and all its items.
            </p>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => setDeleteConfirmModal(null)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteQuotation}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: '1px solid #dc3545',
                  backgroundColor: '#dc3545',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.backgroundColor = '#c82333';
                  e.currentTarget.style.borderColor = '#c82333';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.backgroundColor = '#dc3545';
                  e.currentTarget.style.borderColor = '#dc3545';
                }}
              >
                Delete Quotation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItemModal && selectedQuotation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--modal-overlay)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 6000
        }}>
          <div style={{
            backgroundColor: 'var(--card-bg)',
            borderRadius: '12px',
            padding: 0,
            maxWidth: '700px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            border: '1px solid var(--border-color)'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-secondary)'
            }}>
              <h3 style={{ margin: 0, color: '#2563eb', fontSize: '20px', fontWeight: 600 }}>
                Add Item to Quotation - {selectedQuotation.quotation.quotation_number}
              </h3>
              <button
                onClick={() => setShowAddItemModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'background 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(144, 202, 249, 0.1)'}
                onMouseOut={e => e.currentTarget.style.background = 'none'}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div style={{
              padding: '24px',
              flex: 1,
              overflowY: 'auto'
            }}>
              {/* Search Section */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ color: '#2563eb', marginBottom: '12px', fontSize: '16px' }}>
                  Search Stock Items
                </h4>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <input
                    type="text"
                    placeholder="Search by ID, Brand, Part Number, or Description..."
                    value={stockSearchTerm}
                    onChange={e => setStockSearchTerm(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleSearchStock()}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '14px'
                    }}
                  />
                  <button
                    onClick={handleSearchStock}
                    disabled={searchingStock}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '6px',
                      border: '1px solid #007bff',
                      backgroundColor: '#007bff',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: searchingStock ? 'not-allowed' : 'pointer',
                      opacity: searchingStock ? 0.6 : 1
                    }}
                  >
                    {searchingStock ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>

              {/* Search Results */}
              {stockSearchResults.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ color: '#2563eb', marginBottom: '12px', fontSize: '16px' }}>
                    Search Results ({stockSearchResults.length})
                  </h4>
                  <div style={{
                    maxHeight: '300px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-tertiary)'
                  }}>
                    {stockSearchResults.map((item, index) => (
                      <div
                        key={item.ID}
                        onClick={() => handleSelectStockItem(item)}
                        style={{
                          padding: '12px 16px',
                          borderBottom: index < stockSearchResults.length - 1 ? '1px solid var(--border-color)' : 'none',
                          backgroundColor: selectedStockItem && selectedStockItem.ID === item.ID ? 'var(--hover-bg)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                        onMouseOver={e => {
                          if (!selectedStockItem || selectedStockItem.ID !== item.ID) {
                            e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                          }
                        }}
                        onMouseOut={e => {
                          if (!selectedStockItem || selectedStockItem.ID !== item.ID) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: '#2563eb', fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                              ID: {item.ID}
                            </div>
                            <div style={{ color: 'var(--text-primary)', fontSize: '13px', marginBottom: '2px' }}>
                              {item.BENZ} - {item.BRAND} {item.ALTNO}
                            </div>
                            {item.REMARKS && item.REMARKS !== 'null' && (
                              <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '2px' }}>
                                {item.REMARKS}
                              </div>
                            )}
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                              Location: {item.LOCATION && item.LOCATION !== 'null' ? item.LOCATION : 'Not specified'} | Stock: {item.QTY}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', minWidth: '100px' }}>
                            <div style={{ color: '#2563eb', fontSize: '14px', fontWeight: 600 }}>
                              ₱{item.SELL.toLocaleString()}
                            </div>
                            {selectedStockItem && selectedStockItem.ID === item.ID && (
                              <div style={{ color: '#28a745', fontSize: '12px', marginTop: '4px' }}>
                                ✓ Selected
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Item and Quantity */}
              {selectedStockItem && (
                <div style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  marginBottom: '24px'
                }}>
                  <h4 style={{ color: '#2563eb', marginBottom: '12px', fontSize: '16px' }}>
                    Selected Item
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: 'var(--text-primary)', fontSize: '14px', marginBottom: '4px' }}>
                        ID: {selectedStockItem.ID} - {selectedStockItem.BENZ} {selectedStockItem.BRAND}
                      </div>
                      <div style={{ color: 'var(--text-primary)', fontSize: '13px', marginBottom: '4px' }}>
                        {selectedStockItem.ALTNO}
                      </div>
                      {selectedStockItem.REMARKS && selectedStockItem.REMARKS !== 'null' && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                          {selectedStockItem.REMARKS}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ color: 'var(--text-primary)', fontSize: '14px' }}>Quantity:</label>
                      <input
                        type="number"
                        value={addItemQuantity}
                        onChange={e => setAddItemQuantity(e.target.value)}
                        min="1"
                        style={{
                          width: '80px',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          fontSize: '14px'
                        }}
                      />
                      <div style={{ color: '#2563eb', fontSize: '14px', fontWeight: 600 }}>
                        Total: ₱{(selectedStockItem.SELL * addItemQuantity).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              backgroundColor: 'var(--bg-secondary)'
            }}>
              <button
                onClick={() => setShowAddItemModal(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddItemToQuotation}
                disabled={!selectedStockItem}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: '1px solid #28a745',
                  backgroundColor: selectedStockItem ? '#28a745' : '#6c757d',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: selectedStockItem ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => {
                  if (selectedStockItem) {
                    e.currentTarget.style.backgroundColor = '#218838';
                    e.currentTarget.style.borderColor = '#218838';
                  }
                }}
                onMouseOut={e => {
                  if (selectedStockItem) {
                    e.currentTarget.style.backgroundColor = '#28a745';
                    e.currentTarget.style.borderColor = '#28a745';
                  }
                }}
              >
                Add to Quotation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Modal */}
      <CustomModal
        show={modalState.show}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        onConfirm={modalState.onConfirm}
        onCancel={modalState.onCancel || closeModal}
      />
    </div>
  );
};

export default Quotations;

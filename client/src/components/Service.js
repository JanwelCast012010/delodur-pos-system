import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { Package, RefreshCw, AlertTriangle, Wrench, ArrowRight, RotateCcw, Trash2, XCircle } from 'lucide-react';
import CustomModal from './CustomModal';
import useCustomModal from '../hooks/useCustomModal';
import { useNotifications } from '../contexts/NotificationContext';

const Service = () => {
  // Custom Modal Hook
  const { modalState, showAlert, showConfirm, closeModal } = useCustomModal();
  const location = useLocation();
  const { orderCounts, refresh: refreshNotifications } = useNotifications();
  const hasRefreshedOnMountRef = useRef(false);
  const lastCountRef = useRef(0);
  const isUserInteractingRef = useRef(false);
  const pendingRefreshRef = useRef(null);
  
  // Professional optimizations: Request deduplication and exponential backoff
  const isFetchingRef = useRef(false);
  const backoffDelayRef = useRef(5000);
  const lastEventRefreshRef = useRef(0);
  
  // Helper function to check if user is actively interacting with form inputs
  const isUserInteracting = () => {
    const activeElement = document.activeElement;
    if (!activeElement) return false;
    
    const tagName = activeElement.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
      return true;
    }
    
    const isInsideInput = activeElement.closest('input, textarea, select');
    if (isInsideInput) return true;
    
    return false;
  };

  // Execute pending refresh if user is no longer interacting
  const executePendingRefresh = () => {
    if (pendingRefreshRef.current && !isUserInteracting() && !isUserInteractingRef.current) {
      console.log('✅ User stopped typing, executing pending refresh...');
      const refreshFn = pendingRefreshRef.current;
      pendingRefreshRef.current = null;
      refreshFn();
    }
  };

  // Track user interaction with inputs using event delegation
  useEffect(() => {
    const handleFocus = (e) => {
      const target = e.target;
      const tagName = target.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        isUserInteractingRef.current = true;
      }
    };
    
    const handleBlur = (e) => {
      setTimeout(() => {
        if (!isUserInteracting()) {
          isUserInteractingRef.current = false;
          executePendingRefresh();
        }
      }, 300);
    };
    
    if (location.pathname === '/service') {
      document.addEventListener('focusin', handleFocus, true);
      document.addEventListener('focusout', handleBlur, true);
      
      const checkInterval = setInterval(() => {
        if (!isUserInteracting() && !isUserInteractingRef.current && pendingRefreshRef.current) {
          executePendingRefresh();
        }
      }, 500);
      
      return () => {
        document.removeEventListener('focusin', handleFocus, true);
        document.removeEventListener('focusout', handleBlur, true);
        clearInterval(checkInterval);
      };
    }
    
    return () => {
      document.removeEventListener('focusin', handleFocus, true);
      document.removeEventListener('focusout', handleBlur, true);
    };
  }, [location.pathname]);
  
  const [serviceOrders, setServiceOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [plateNumber, setPlateNumber] = useState('');

  useEffect(() => {
    fetchServiceOrders();
    hasRefreshedOnMountRef.current = false;
    lastCountRef.current = orderCounts.serviceCount || 0;
  }, []);

  // Listen for notification count changes and refresh if on this page
  useEffect(() => {
    const handleServiceCountChange = (event) => {
      const newCount = event.detail?.count || orderCounts.serviceCount || 0;
      if (location.pathname === '/service' && newCount !== lastCountRef.current) {
        if (isUserInteractingRef.current || isUserInteracting()) {
          console.log('⏸️ Service order count changed, but user is typing - queueing refresh...');
          pendingRefreshRef.current = () => {
            const countChange = newCount - lastCountRef.current;
            console.log(`🔄 Executing queued refresh - Service order count changed (${countChange > 0 ? '+' : ''}${countChange})`);
            lastCountRef.current = newCount;
            silentRefetch();
            
            if (countChange < 0) {
              setTimeout(() => {
                if (!isUserInteracting()) {
                  silentRefetch();
                }
              }, 500);
            }
          };
          return;
        }
        
        const countChange = newCount - lastCountRef.current;
        console.log(`🔄 Service order count changed (${countChange > 0 ? '+' : ''}${countChange}), refreshing data...`);
        lastCountRef.current = newCount;
        silentRefetch();
        
        if (countChange < 0) {
          setTimeout(() => {
            if (!isUserInteracting()) {
              silentRefetch();
            }
          }, 500);
        }
      }
    };

    window.addEventListener('serviceOrderCountChanged', handleServiceCountChange);
    
    return () => {
      window.removeEventListener('serviceOrderCountChanged', handleServiceCountChange);
    };
  }, [location.pathname, orderCounts.serviceCount]);

  // Watch for service count changes and refresh when count decreases
  useEffect(() => {
    if (location.pathname === '/service' && !loading) {
      const currentCount = orderCounts.serviceCount || 0;
      const previousCount = lastCountRef.current;
      
      if (previousCount > 0 && currentCount < previousCount) {
        if (isUserInteractingRef.current || isUserInteracting()) {
          console.log('⏸️ Service count decreased, but user is typing - queueing refresh...');
          pendingRefreshRef.current = () => {
            const decreaseAmount = previousCount - currentCount;
            console.log(`🔄 Executing queued refresh - Service count decreased from ${previousCount} to ${currentCount} (${decreaseAmount} order(s) removed)`);
            silentRefetch();
            
            setTimeout(() => {
              if (!isUserInteracting()) {
                silentRefetch();
              }
            }, 300);
            
            setTimeout(() => {
              if (!isUserInteracting()) {
                silentRefetch();
              }
            }, 1000);
          };
          return;
        }
        
        const decreaseAmount = previousCount - currentCount;
        console.log(`🔄 Service count decreased from ${previousCount} to ${currentCount} (${decreaseAmount} order(s) removed), refreshing data...`);
        silentRefetch();
        
        setTimeout(() => {
          if (!isUserInteracting()) {
            silentRefetch();
          }
        }, 300);
        
        setTimeout(() => {
          if (!isUserInteracting()) {
            silentRefetch();
          }
        }, 1000);
      }
      
      if (currentCount !== previousCount) {
        lastCountRef.current = currentCount;
      }
    }
  }, [orderCounts.serviceCount, location.pathname, loading]);

  // Refresh once when navigating to this page if badge shows orders but data is empty
  useEffect(() => {
    if (location.pathname === '/service' && !hasRefreshedOnMountRef.current) {
      if (orderCounts.serviceCount > 0) {
        const timeoutId = setTimeout(() => {
          if (serviceOrders.length === 0 && !loading) {
            console.log('🔄 Badge shows orders but data is empty, refreshing...');
            silentRefetch();
          }
          hasRefreshedOnMountRef.current = true;
        }, 1000);
        return () => clearTimeout(timeoutId);
      } else {
        hasRefreshedOnMountRef.current = true;
      }
    }
  }, [location.pathname]);

  const fetchServiceOrders = async (isRetry = false) => {
    // Request deduplication: skip if already fetching
    if (isFetchingRef.current && !isRetry) {
      return;
    }
    
    isFetchingRef.current = true;
    
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('No authentication token found. Please log in again.');
        setLoading(false);
        isFetchingRef.current = false;
        return;
      }

      console.log('🔍 Fetching service orders...');
      const res = await axios.get('/api/service/orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Service orders fetched successfully:', res.data);
      console.log('🔍 First order requisition number:', res.data[0]?.items[0]?.requisition_number);
      setServiceOrders(res.data);
      
      // Reset backoff delay on successful request
      backoffDelayRef.current = 5000;
      isFetchingRef.current = false;
    } catch (err) {
      console.error('❌ Service fetch error:', err);
      
      // Professional error handling with exponential backoff
      if (err.response?.status === 429) {
        // Rate limited - implement exponential backoff
        console.warn(`⚠️ Service rate limited (429). Backing off for ${backoffDelayRef.current}ms`);
        
        // Increase backoff delay (exponential: 5s -> 10s -> 20s -> 30s max)
        backoffDelayRef.current = Math.min(backoffDelayRef.current * 2, 30000);
        
        // Retry after backoff delay
        setTimeout(() => {
          fetchServiceOrders(true); // Retry flag
        }, backoffDelayRef.current);
        
        setError('Too many requests. Retrying automatically...');
        setLoading(false);
        return;
      }
      
      if (err.response?.status === 401) {
        setError('Authentication failed. Please log in again.');
      } else if (err.response?.status === 500) {
        setError(`Server error: ${err.response.data?.message || 'Database query failed'}`);
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError(`Failed to fetch service orders: ${err.message}`);
      }
      backoffDelayRef.current = 5000;
      isFetchingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchServiceOrders();
    setRefreshing(false);
  };

  // Silent background refetch - updates data without disrupting user
  const silentRefetch = async (isRetry = false) => {
    // Request deduplication: skip if already fetching
    if (isFetchingRef.current && !isRetry) {
      return;
    }
    
    isFetchingRef.current = true;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        isFetchingRef.current = false;
        return;
      }
      
      // Save current scroll position
      const scrollPosition = window.scrollY;
      
      // Fetch data silently (no loading spinner)
      const res = await axios.get('/api/service/orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update state
      setServiceOrders(res.data);
      
      // Reset backoff delay on successful request
      backoffDelayRef.current = 5000;
      isFetchingRef.current = false;
      
      // Restore scroll position after a brief delay to allow DOM update
      setTimeout(() => {
        window.scrollTo(0, scrollPosition);
      }, 0);
    } catch (err) {
      console.error('Silent refetch error:', err);
      
      // Professional error handling with exponential backoff
      if (err.response?.status === 429) {
        // Rate limited - implement exponential backoff
        console.warn(`⚠️ Service silent refetch rate limited (429). Backing off for ${backoffDelayRef.current}ms`);
        
        // Increase backoff delay (exponential: 5s -> 10s -> 20s -> 30s max)
        backoffDelayRef.current = Math.min(backoffDelayRef.current * 2, 30000);
        
        // Retry after backoff delay
        setTimeout(() => {
          silentRefetch(true); // Retry flag
        }, backoffDelayRef.current);
        return;
      }
      
      // Reset backoff on non-rate-limit errors
      backoffDelayRef.current = 5000;
      isFetchingRef.current = false;
    }
  };
  
  // Throttled refresh function for event-driven updates
  const throttledSilentRefetch = () => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastEventRefreshRef.current;
    const throttleDelay = 2000; // Minimum 2 seconds between event-driven refreshes
    
    if (timeSinceLastRefresh < throttleDelay) {
      // Skip if called too soon
      return;
    }
    
    lastEventRefreshRef.current = now;
    silentRefetch();
  };

  const handleSendToCashier = async (order) => {
    const confirmed = await showConfirm(
      `Are you sure you want to send the entire order #${order.order_id.slice(0, 8).toUpperCase()} to Cashier?`,
      'Send to Cashier'
    );
    
    if (confirmed) {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/service/send-to-cashier', {
          order_id: order.order_id,
          items: order.items.map(item => ({
            service_id: item.id,
            stock_id: item.stock_id,
            quantity: item.quantity
          }))
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Send to cashier response:', response.data);
      
      // Refresh service orders and notifications
      await silentRefetch();
      refreshNotifications();
      
      // Dispatch event to notify other users
      window.dispatchEvent(new CustomEvent('serviceOrderSentToCashier', {
        detail: { order_id: order.order_id }
      }));
      
      // Force additional refresh after delay
      setTimeout(() => {
        silentRefetch();
        refreshNotifications();
      }, 500);
      
      await showAlert(`Sent ${response.data?.inserted_count || order.items.length} item(s) to cashier successfully!`, 'Success');
    } catch (err) {
        console.error('Error sending to cashier:', err);
      await showAlert('Failed to send to cashier.', 'Error');
      }
    }
  };

  const handleReturnToStock = async (order) => {
    const confirmed = await showConfirm(
      `Are you sure you want to return the entire order #${order.order_id.slice(0, 8).toUpperCase()} to Stock?`,
      'Return to Stock'
    );
    
    if (confirmed) {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/service/return-to-stock', {
          order_id: order.order_id,
          items: order.items.map(item => ({
            service_id: item.id,
            stock_id: item.stock_id,
            quantity: item.quantity
          }))
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Refresh service orders and notifications
      await silentRefetch();
      refreshNotifications();
      
      // Dispatch event to notify other users
      window.dispatchEvent(new CustomEvent('serviceOrderReturnedToStock', {
        detail: { order_id: order.order_id }
      }));
      
      // Force additional refresh after delay
      setTimeout(() => {
        silentRefetch();
        refreshNotifications();
      }, 500);
      
      await showAlert('Returned entire order to stock successfully!', 'Success');
    } catch (err) {
        console.error('Error returning to stock:', err);
      await showAlert('Failed to return to stock.', 'Error');
    }
    }
  };

  const formatNumber = (num) => {
    return Number(num).toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    });
  };

  const getOrderTotal = (items) => {
    return items.reduce((sum, item) => sum + (Number(item.unit_price) * Number(item.quantity)), 0);
  };

  const handleDeleteClick = (item) => {
    setDeletingItem(item);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`/api/service/items/${deletingItem.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Service item deleted successfully:', response.data);
      
      // Show success message with stock restoration info
      await showAlert(`✅ Item deleted successfully!\n\nStock restored: ${response.data.restoredQuantity} units added back to tbl_stock`, 'Success');
      
      // Refresh service orders and notifications
      await silentRefetch();
      refreshNotifications();
      
      // Dispatch event to notify other users
      window.dispatchEvent(new CustomEvent('serviceOrderDeleted', {
        detail: { service_id: deletingItem.id }
      }));
      
      // Force additional refresh after delay
      setTimeout(() => {
        silentRefetch();
        refreshNotifications();
      }, 500);
      
      // Clear delete state
      setDeletingItem(null);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('❌ Delete error:', error);
      await showAlert('Failed to delete item. Please try again.', 'Error');
      setDeletingItem(null);
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeletingItem(null);
    setShowDeleteConfirm(false);
  };

  const handleEditCustomer = (order) => {
    setEditingCustomer(order);
    setCustomerName(order.customer_name || '');
    setPlateNumber(order.plate_number || '');
  };

  const handleCancelEditCustomer = () => {
    setEditingCustomer(null);
    setCustomerName('');
    setPlateNumber('');
  };

  const handleSaveCustomer = async () => {
    if (!editingCustomer) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/service/update-customer/${editingCustomer.order_id}`, {
        customer_name: customerName.trim().toUpperCase() || null,
        plate_number: plateNumber.trim() || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update local state
      setServiceOrders(prevOrders => 
        prevOrders.map(order => 
          order.order_id === editingCustomer.order_id 
            ? { ...order, customer_name: customerName.trim().toUpperCase() || null, plate_number: plateNumber.trim() || null }
            : order
        )
      );
      
      await showAlert('Customer information updated successfully!', 'Success');
      handleCancelEditCustomer();
    } catch (error) {
      console.error('❌ Update customer error:', error);
      await showAlert('Failed to update customer information. Please try again.', 'Error');
    }
  };

  return (
    <div style={{
      padding: '24px',
      background: 'var(--bg-primary)',
      minHeight: '100vh',
      color: 'var(--text-primary)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      lineHeight: '1.6'
    }}>
      {/* Header */}
      <div style={{ 
        background: 'var(--card-bg)', 
        padding: '24px', 
        borderRadius: '12px', 
        marginBottom: '24px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 8px var(--shadow-sm)'
      }}>
        <div>
          <h1 style={{ 
            color: 'var(--text-primary)', 
            margin: 0, 
            fontSize: '32px', 
            fontWeight: '700',
            letterSpacing: '-0.5px'
          }}>
            Service Orders
          </h1>
          <p style={{ 
            color: 'var(--text-secondary)', 
            margin: '8px 0 0 0', 
            fontSize: '16px',
            fontWeight: '400'
          }}>
            Manage orders sent from warehouse for service
          </p>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            background: '#ffc107',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 20px',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'background 0.2s ease'
          }}
          onMouseOver={(e) => e.target.style.background = '#e0a800'}
          onMouseOut={(e) => e.target.style.background = '#ffc107'}
        >
          <RefreshCw size={18} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div style={{ 
          background: 'var(--card-bg)', 
          padding: '60px', 
          borderRadius: '12px', 
          textAlign: 'center',
          border: '1px solid var(--border-color)',
          boxShadow: '0 2px 8px var(--shadow-sm)'
        }}>
          <RefreshCw size={48} style={{ animation: 'spin 1s linear infinite', color: '#ffc107' }} />
          <p style={{ color: 'var(--text-secondary)', margin: '20px 0 0 0', fontSize: '18px' }}>Loading service orders...</p>
        </div>
      ) : error ? (
        <div style={{ 
          background: 'var(--card-bg)', 
          padding: '60px', 
          borderRadius: '12px', 
          textAlign: 'center',
          border: '1px solid var(--border-color)',
          boxShadow: '0 2px 8px var(--shadow-sm)'
        }}>
          <AlertTriangle size={48} style={{ color: '#dc3545' }} />
          <p style={{ color: '#dc3545', margin: '20px 0 0 0', fontSize: '18px' }}>{error}</p>
          <button
            onClick={handleRefresh}
            style={{
              background: '#ffc107',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              marginTop: '20px',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'background 0.2s ease'
            }}
            onMouseOver={(e) => e.target.style.background = '#e0a800'}
            onMouseOut={(e) => e.target.style.background = '#ffc107'}
          >
            Try Again
          </button>
        </div>
      ) : serviceOrders.length === 0 ? (
        <div style={{ 
          background: 'var(--card-bg)', 
          padding: '60px', 
          borderRadius: '12px', 
          textAlign: 'center',
          border: '1px solid var(--border-color)',
          boxShadow: '0 2px 8px var(--shadow-sm)'
        }}>
          <Wrench size={64} style={{ color: 'var(--text-muted)', marginBottom: '20px' }} />
          <h3 style={{ color: 'var(--text-primary)', margin: '0 0 16px 0', fontSize: '24px' }}>No Service Orders Found</h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '16px' }}>Orders will appear here when sent from warehouse</p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', 
          gap: '24px'
        }}>
          {serviceOrders.map((order) => {
            const itemCount = order.items.length;
            
            return (
              <div key={order.order_id} style={{
                background: 'var(--card-bg)',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
                boxShadow: '0 2px 8px var(--shadow-sm)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 16px var(--shadow-md)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px var(--shadow-sm)';
              }}>
                
                {/* Order Header */}
                <div style={{
                  background: 'linear-gradient(135deg, #ffc107 0%, #e0a800 100%)',
                  color: '#000',
                  padding: '24px 28px',
                  position: 'relative'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px'
                  }}>
                    <div>
                      <h3 style={{
                        color: '#000',
                        margin: '0 0 8px 0',
                        fontSize: '24px',
                        fontWeight: '700',
                        letterSpacing: '-0.3px'
                      }}>
                        Service Order #{order.order_id.slice(0, 8).toUpperCase()}
                      </h3>
                      <p style={{
                        color: '#333',
                        margin: '0 0 6px 0',
                        fontSize: '16px',
                        fontWeight: '500'
                      }}>
                        {itemCount} {itemCount === 1 ? 'item' : 'items'}
                      </p>
                      <div style={{
                        display: 'flex',
                        gap: '10px',
                        marginTop: '10px',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{
                          background: order.items[0]?.requisition_number ? '#4CAF50' : '#ff6b6b',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px 16px',
                          flex: '1',
                          minWidth: '140px'
                        }}>
                          <p style={{
                            color: '#fff',
                            margin: 0,
                            fontSize: '15px',
                            fontWeight: '600',
                            letterSpacing: '0.3px'
                          }}>
                            PRF #: {order.items[0]?.requisition_number || 'Not specified'}
                          </p>
                        </div>
                        <div style={{
                          background: order.items[0]?.repair_order_number ? '#2196F3' : '#ff6b6b',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px 16px',
                          flex: '1',
                          minWidth: '140px'
                        }}>
                          <p style={{
                            color: '#fff',
                            margin: 0,
                            fontSize: '15px',
                            fontWeight: '600',
                            letterSpacing: '0.3px'
                          }}>
                            RO #: {order.items[0]?.repair_order_number || 'Not specified'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '14px',
                      fontWeight: '600',
                      backdropFilter: 'blur(10px)'
                    }}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  {/* Customer Information Section */}
                  <div style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: '10px',
                    padding: '20px',
                    marginTop: '20px',
                    marginBottom: '24px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px'
                    }}>
                      <h4 style={{
                        color: 'var(--text-primary)',
                        margin: 0,
                        fontSize: '18px',
                        fontWeight: '700',
                        letterSpacing: '-0.2px'
                      }}>
                        Customer Information
                      </h4>
                      <button
                        onClick={() => handleEditCustomer(order)}
                        style={{
                          background: '#007bff',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseOver={(e) => e.target.style.background = '#0056b3'}
                        onMouseOut={(e) => e.target.style.background = '#007bff'}
                      >
                        {editingCustomer && editingCustomer.order_id === order.order_id ? 'Cancel' : 'Edit'}
                      </button>
                    </div>
                    
                    {editingCustomer && editingCustomer.order_id === order.order_id ? (
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr', 
                        gap: '16px',
                        marginBottom: '16px'
                      }}>
                        <div>
                          <label style={{
                            color: 'var(--text-primary)',
                            fontSize: '14px',
                            fontWeight: '600',
                            marginBottom: '4px',
                            display: 'block'
                          }}>
                            NAME:
                          </label>
                          <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                            placeholder="Enter customer name"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              fontSize: '14px',
                              background: 'var(--input-bg)',
                              color: 'var(--text-primary)'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{
                            color: 'var(--text-primary)',
                            fontSize: '14px',
                            fontWeight: '600',
                            marginBottom: '4px',
                            display: 'block'
                          }}>
                            VEHICLE PLATE #:
                          </label>
                          <input
                            type="text"
                            value={plateNumber}
                            onChange={(e) => setPlateNumber(e.target.value)}
                            placeholder="Enter plate number"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              fontSize: '14px',
                              background: 'var(--input-bg)',
                              color: 'var(--text-primary)'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={handleCancelEditCustomer}
                            style={{
                              background: '#6c757d',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '8px 16px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              fontWeight: '600'
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveCustomer}
                            style={{
                              background: '#28a745',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '8px 16px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              fontWeight: '600'
                            }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr', 
                        gap: '16px' 
                      }}>
                        <div>
                          <div style={{
                            color: 'var(--text-secondary)',
                            fontSize: '12px',
                            fontWeight: '600',
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            NAME:
                          </div>
                          <div style={{
                            color: 'var(--text-primary)',
                            fontSize: '16px',
                            fontWeight: '600'
                          }}>
                            {order.customer_name || 'Not specified'}
                          </div>
                        </div>
                        <div>
                          <div style={{
                            color: 'var(--text-secondary)',
                            fontSize: '12px',
                            fontWeight: '600',
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            VEHICLE PLATE #:
                          </div>
                          <div style={{
                            color: 'var(--text-primary)',
                            fontSize: '16px',
                            fontWeight: '600'
                          }}>
                            {order.plate_number || 'Not specified'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Order Action Buttons */}
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <button
                      onClick={() => handleSendToCashier(order)}
                      style={{
                        flex: 1,
                        background: '#28a745',
                        color: '#fff',
                        border: 'none',
                        padding: '14px 20px',
                        fontSize: '15px',
                        cursor: 'pointer',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        letterSpacing: '0.3px'
                      }}
                      onMouseOver={(e) => e.target.style.background = '#218838'}
                      onMouseOut={(e) => e.target.style.background = '#28a745'}
                    >
                      <ArrowRight size={18} />
                      SEND TO CASHIER
                    </button>
                    <button
                      onClick={() => handleReturnToStock(order)}
                      style={{
                        flex: 1,
                        background: '#dc3545',
                        color: '#fff',
                        border: 'none',
                        padding: '14px 20px',
                        fontSize: '15px',
                        cursor: 'pointer',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        letterSpacing: '0.3px'
                      }}
                      onMouseOver={(e) => e.target.style.background = '#c82333'}
                      onMouseOut={(e) => e.target.style.background = '#dc3545'}
                    >
                      <RotateCcw size={18} />
                      RETURN TO STOCK
                    </button>
                  </div>
                </div>

                {/* Order Items */}
                <div style={{ padding: '24px 28px', background: 'var(--card-bg)' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{
                      color: 'var(--text-primary)',
                      margin: '0 0 20px 0',
                      fontSize: '20px',
                      fontWeight: '700',
                      letterSpacing: '-0.2px'
                    }}>
                      Service Items
                    </h4>
                  </div>
                  
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {order.items.map((item, index) => (
                      <div key={item.id} style={{
                        padding: '20px',
                        marginBottom: index < order.items.length - 1 ? '16px' : '0',
                        borderBottom: index < order.items.length - 1 ? '1px solid var(--border-color)' : 'none',
                        borderRadius: '8px',
                        background: 'var(--bg-secondary)'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: '8px'
                        }}>
                          <div style={{
                            color: 'var(--text-primary)',
                            fontSize: '24px',
                            fontWeight: '700',
                            textAlign: 'left',
                            letterSpacing: '0.5px'
                          }}>
                            {item.part_no}
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <div style={{
                              color: 'var(--text-primary)',
                              fontWeight: '700',
                              fontSize: '22px',
                              textAlign: 'right'
                            }}>
                              {item.id_number}
                            </div>
                            <button
                              onClick={() => handleDeleteClick(item)}
                              style={{
                                background: '#dc3545',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '6px 8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background-color 0.2s',
                                fontSize: '14px'
                              }}
                              onMouseOver={(e) => e.target.style.background = '#c82333'}
                              onMouseOut={(e) => e.target.style.background = '#dc3545'}
                              title="Delete this item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-end',
                          marginBottom: '4px'
                        }}>
                          <div style={{
                            color: 'var(--text-secondary)',
                            fontSize: '16px',
                            marginBottom: '6px',
                            fontWeight: '500',
                            letterSpacing: '0.1px'
                          }}>
                            {item.description || 'No description'}
                          </div>
                          <div style={{
                            background: '#ffc107',
                            color: '#000',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '14px',
                            fontWeight: '600',
                            minWidth: '40px',
                            textAlign: 'center',
                            marginLeft: 'auto'
                          }}>
                            {item.quantity}
                          </div>
                        </div>
                        {item.location && (
                          <div style={{
                            color: '#ffc107',
                            fontSize: '13px',
                            fontWeight: '500'
                          }}>
                            <span style={{ 
                              color: '#4CAF50',
                              fontWeight: 'bold'
                            }}>
                              {item.location}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--modal-overlay)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--modal-bg)',
            padding: '30px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            maxWidth: '400px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 10px 40px var(--shadow-lg)'
          }}>
            <XCircle size={48} style={{ color: '#dc3545', marginBottom: '20px' }} />
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '16px', fontSize: '20px' }}>
              Delete Service Item
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
              Are you sure you want to delete this item from the service order?
            </p>
            <div style={{
              background: 'var(--bg-secondary)',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '16px',
              border: '1px solid #28a745',
              borderLeft: '4px solid #28a745'
            }}>
              <div style={{ color: '#28a745', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                ✓ Stock will be restored
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                {deletingItem.quantity} units will be added back to tbl_stock
              </div>
            </div>
            <div style={{
              background: 'var(--bg-secondary)',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '24px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: '600', marginBottom: '8px' }}>
                {deletingItem.part_no}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                {deletingItem.description || 'No description'}
              </div>
              <div style={{ color: '#007bff', fontSize: '14px', marginTop: '4px' }}>
                Qty: {deletingItem.quantity}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={handleDeleteCancel}
                style={{
                  background: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#5a6268'}
                onMouseOut={(e) => e.target.style.background = '#6c757d'}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                style={{
                  background: '#dc3545',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#c82333'}
                onMouseOut={(e) => e.target.style.background = '#dc3545'}
              >
                Delete Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for spinning animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

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

export default Service; 
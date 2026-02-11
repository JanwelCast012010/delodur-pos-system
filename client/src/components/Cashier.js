  import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import CustomModal from './CustomModal';
import useCustomModal from '../hooks/useCustomModal';
import { ShoppingCart, RefreshCw, AlertTriangle } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { useTheme } from '../contexts/ThemeContext';

const Cashier = () => {
  // Custom Modal Hook
  const { modalState, showAlert, showConfirm, closeModal } = useCustomModal();
  const location = useLocation();
  const { orderCounts, refresh: refreshNotifications } = useNotifications();
  const { theme, isDark } = useTheme();
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
    
    // Check if active element is an input, textarea, or select
    const tagName = activeElement.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
      return true;
    }
    
    // Check if active element is inside an input container (for custom inputs)
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
      // Only track if it's an input, textarea, or select
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        isUserInteractingRef.current = true;
      }
    };
    
    const handleBlur = (e) => {
      // Small delay to allow focus to move to another input
      setTimeout(() => {
        if (!isUserInteracting()) {
          isUserInteractingRef.current = false;
          // Check if there's a pending refresh when user stops typing
          executePendingRefresh();
        }
      }, 300);
    };
    
    // Use event delegation on document level to catch all inputs (even dynamically added ones)
    // Only listen when on cashier page
    if (location.pathname === '/cashier') {
      document.addEventListener('focusin', handleFocus, true);
      document.addEventListener('focusout', handleBlur, true);
      
      // Also check periodically if user stopped typing (fallback)
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
  
  const [cashierItems, setCashierItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [invoiceType, setInvoiceType] = useState('cash_invoice');
  const [refreshing, setRefreshing] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationOrder, setVerificationOrder] = useState(null);
  const [verifiedItems, setVerifiedItems] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [applyWithholdingTax, setApplyWithholdingTax] = useState(false);
  const [applyZeroRatedSales, setApplyZeroRatedSales] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [itemQuantities, setItemQuantities] = useState({});
  const [itemPrices, setItemPrices] = useState({});
  const [originalPrices, setOriginalPrices] = useState({});
  const [originalQuantities, setOriginalQuantities] = useState({});
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [priceRawValues, setPriceRawValues] = useState({});
  const [editingQtyId, setEditingQtyId] = useState(null);
  const [qtyRawValues, setQtyRawValues] = useState({});
  
  // Large font mode state (shared across system, persisted in localStorage)
  const [largeFontMode, setLargeFontMode] = useState(() => {
    const saved = localStorage.getItem('systemLargeFont');
    return saved === 'true';
  });
  
  // Listen for font mode changes from navbar
  useEffect(() => {
    const handleFontModeChange = (e) => {
      setLargeFontMode(e.detail.largeFontMode);
    };
    
    window.addEventListener('fontModeChanged', handleFontModeChange);
    
    // Also check localStorage periodically in case it was changed in another tab
    const interval = setInterval(() => {
      const saved = localStorage.getItem('systemLargeFont');
      const currentValue = saved === 'true';
      if (currentValue !== largeFontMode) {
        setLargeFontMode(currentValue);
      }
    }, 500);
    
    return () => {
      window.removeEventListener('fontModeChanged', handleFontModeChange);
      clearInterval(interval);
    };
  }, [largeFontMode]);
  
  // Font size helper function
  const getFontSize = (baseSize) => {
    return largeFontMode ? Math.round(baseSize * 1.5) : baseSize;
  };

  useEffect(() => {
    fetchCashierItems();
    hasRefreshedOnMountRef.current = false; // Reset when component mounts
    lastCountRef.current = orderCounts.cashierCount;
  }, []);

  // Listen for notification count changes and refresh if on this page
  useEffect(() => {
    const handleCashierCountChange = (event) => {
      // Refresh if count changed (increased OR decreased) and we're on this page
      const newCount = event.detail?.count || orderCounts.cashierCount;
      if (location.pathname === '/cashier' && newCount !== lastCountRef.current) {
        // Skip refresh if user is actively interacting with inputs
        if (isUserInteractingRef.current || isUserInteracting()) {
          console.log('⏸️ Cashier order count changed, but user is typing - queueing refresh...');
          // Store refresh function to execute when user stops typing
          pendingRefreshRef.current = () => {
            const countChange = newCount - lastCountRef.current;
            console.log(`🔄 Executing queued refresh - Cashier order count changed (${countChange > 0 ? '+' : ''}${countChange})`);
            lastCountRef.current = newCount;
            throttledSilentRefetch(); // Use throttled version
          };
          return;
        }
        
        const countChange = newCount - lastCountRef.current;
        console.log(`🔄 Cashier order count changed (${countChange > 0 ? '+' : ''}${countChange}), refreshing data...`);
        lastCountRef.current = newCount;
        throttledSilentRefetch(); // Use throttled version (removed multiple setTimeout calls)
      }
    };

    const handleCashierOrderProcessed = () => {
      // When an order is processed (by any user), refresh data and notifications
      if (location.pathname === '/cashier') {
        // Skip refresh if user is actively interacting with inputs
        if (isUserInteractingRef.current || isUserInteracting()) {
          console.log('⏸️ Cashier order processed, but user is typing - queueing refresh...');
          pendingRefreshRef.current = () => {
            console.log('🔄 Executing queued refresh - Cashier order processed');
            throttledSilentRefetch(); // Use throttled version
            refreshNotifications();
          };
          return;
        }
        
        console.log('🔄 Cashier order processed by another user, refreshing...');
        throttledSilentRefetch(); // Use throttled version (removed multiple setTimeout calls)
        refreshNotifications();
      }
    };

    const handleWarehouseOrderSentToCashier = () => {
      // When an order is sent from warehouse to cashier (by any user), refresh data
      if (location.pathname === '/cashier') {
        // Skip refresh if user is actively interacting with inputs
        if (isUserInteractingRef.current || isUserInteracting()) {
          console.log('⏸️ Order sent to cashier, but user is typing - queueing refresh...');
          pendingRefreshRef.current = () => {
            console.log('🔄 Executing queued refresh - Order sent to cashier');
            throttledSilentRefetch(); // Use throttled version
            refreshNotifications();
          };
          return;
        }
        
        console.log('🔄 Order sent to cashier from warehouse, refreshing...');
        throttledSilentRefetch(); // Use throttled version (removed multiple setTimeout calls)
        refreshNotifications();
      }
    };

    const handleCashierOrderReturnedToWarehouse = () => {
      // When an order is returned to warehouse (by any user), refresh data
      if (location.pathname === '/cashier') {
        // Skip refresh if user is actively interacting with inputs
        if (isUserInteractingRef.current || isUserInteracting()) {
          console.log('⏸️ Order returned to warehouse, but user is typing - queueing refresh...');
          pendingRefreshRef.current = () => {
            console.log('🔄 Executing queued refresh - Order returned to warehouse');
            throttledSilentRefetch(); // Use throttled version
            refreshNotifications();
          };
          return;
        }
        
        console.log('🔄 Order returned to warehouse from cashier, refreshing...');
        throttledSilentRefetch(); // Use throttled version (removed multiple setTimeout calls)
        refreshNotifications();
      }
    };

    window.addEventListener('cashierOrderCountChanged', handleCashierCountChange);
    window.addEventListener('cashierOrderProcessed', handleCashierOrderProcessed);
    window.addEventListener('warehouseOrderSentToCashier', handleWarehouseOrderSentToCashier);
    window.addEventListener('cashierOrderReturnedToWarehouse', handleCashierOrderReturnedToWarehouse);
    
    return () => {
      window.removeEventListener('cashierOrderCountChanged', handleCashierCountChange);
      window.removeEventListener('cashierOrderProcessed', handleCashierOrderProcessed);
      window.removeEventListener('warehouseOrderSentToCashier', handleWarehouseOrderSentToCashier);
      window.removeEventListener('cashierOrderReturnedToWarehouse', handleCashierOrderReturnedToWarehouse);
    };
  }, [location.pathname, orderCounts.cashierCount, refreshNotifications]);

  // Watch for cashier count changes and refresh when count decreases (order returned/deleted)
  useEffect(() => {
    if (location.pathname === '/cashier' && !loading) {
      const currentCount = orderCounts.cashierCount;
      const previousCount = lastCountRef.current;
      
      // Only refresh if count actually decreased (not on initial load)
      // previousCount > 0 ensures we don't trigger on initial mount
      if (previousCount > 0 && currentCount < previousCount) {
        // Skip refresh if user is actively interacting with inputs
        if (isUserInteractingRef.current || isUserInteracting()) {
          console.log('⏸️ Cashier count decreased, but user is typing - queueing refresh...');
          pendingRefreshRef.current = () => {
            const decreaseAmount = previousCount - currentCount;
            console.log(`🔄 Executing queued refresh - Cashier count decreased from ${previousCount} to ${currentCount} (${decreaseAmount} order(s) removed)`);
            throttledSilentRefetch(); // Use throttled version
          };
          return;
        }
        
        const decreaseAmount = previousCount - currentCount;
        console.log(`🔄 Cashier count decreased from ${previousCount} to ${currentCount} (${decreaseAmount} order(s) removed), refreshing data...`);
        
        // Single throttled refresh (removed multiple setTimeout calls to prevent request bursts)
        throttledSilentRefetch();
      }
      
      // Update the ref to track current count (only if it changed)
      if (currentCount !== previousCount) {
        lastCountRef.current = currentCount;
      }
    }
  }, [orderCounts.cashierCount, location.pathname, loading]);

  // Refresh once when navigating to this page if badge shows orders but data is empty
  useEffect(() => {
    // Only check once when navigating to the page, not on every render
    if (location.pathname === '/cashier' && !hasRefreshedOnMountRef.current) {
      if (orderCounts.cashierCount > 0) {
        // Wait a bit for initial data to load, then check if we need to refresh
        const timeoutId = setTimeout(() => {
          if (cashierItems.length === 0 && !loading) {
            console.log('🔄 Badge shows orders but data is empty, refreshing...');
            fetchCashierItems();
          }
          hasRefreshedOnMountRef.current = true; // Mark as checked
        }, 1000); // Wait 1 second after navigation

        return () => clearTimeout(timeoutId);
      } else {
        hasRefreshedOnMountRef.current = true; // Mark as checked even if no orders
      }
    }
  }, [location.pathname]); // Only depend on pathname, not other values

  const fetchCashierItems = async (isRetry = false) => {
    // Request deduplication: skip if already fetching
    if (isFetchingRef.current && !isRetry) {
      return;
    }
    
    isFetchingRef.current = true;
    
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/cashier/cart', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('📋 Cashier items fetched:', res.data);
      console.log('📊 Total items:', res.data.length);
      console.log('📊 Grouped orders:', Object.keys(res.data.reduce((acc, item) => {
        acc[item.order_id] = true;
        return acc;
      }, {})).length);
      setCashierItems(res.data);
      // Update last count after successful fetch
      lastCountRef.current = orderCounts.cashierCount;
      
      // Reset backoff delay on successful request
      backoffDelayRef.current = 5000;
      isFetchingRef.current = false;
    } catch (err) {
      console.error('❌ Fetch cashier items error:', err);
      
      // Professional error handling with exponential backoff
      if (err.response?.status === 429) {
        // Rate limited - implement exponential backoff
        console.warn(`⚠️ Cashier rate limited (429). Backing off for ${backoffDelayRef.current}ms`);
        
        // Increase backoff delay (exponential: 5s -> 10s -> 20s -> 30s max)
        backoffDelayRef.current = Math.min(backoffDelayRef.current * 2, 30000);
        
        // Retry after backoff delay
        setTimeout(() => {
          fetchCashierItems(true); // Retry flag
        }, backoffDelayRef.current);
        
        setError('Too many requests. Retrying automatically...');
        setLoading(false);
        return;
      }
      
      setError('Failed to fetch cashier items.');
      backoffDelayRef.current = 5000;
      isFetchingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCashierItems();
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
      const res = await axios.get('/api/cashier/cart', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update state
      setCashierItems(res.data);
      
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
        console.warn(`⚠️ Cashier silent refetch rate limited (429). Backing off for ${backoffDelayRef.current}ms`);
        
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

    const handleOrderSelect = (orderId, items) => {
      if (selectedOrder && selectedOrder.orderId === orderId) {
        setSelectedOrder(null);
        setCustomerName(''); // Clear customer name when deselecting
        setOrderDate(''); // Clear date when deselecting
        setItemQuantities({});
        setItemPrices({});
        setOriginalPrices({});
        setOriginalQuantities({});
        setEditingPriceId(null);
        setPriceRawValues({});
        setEditingQtyId(null);
        setQtyRawValues({});
      } else {
        setSelectedOrder({ orderId, items });
        // Auto-populate customer_name from the first item if available
        const customerNameFromOrder = items[0]?.customer_name;
        if (customerNameFromOrder) {
          setCustomerName(customerNameFromOrder);
        } else {
          setCustomerName(''); // Clear if no customer name
        }
        // Auto-populate date from order's created_at
        if (items[0]?.created_at) {
          const orderDateValue = new Date(items[0].created_at).toISOString().split('T')[0];
          setOrderDate(orderDateValue);
        } else {
          // Default to today if no order date
          setOrderDate(new Date().toISOString().split('T')[0]);
        }
        // Initialize quantities and prices
        const initialQuantities = {};
        const initialPrices = {};
        const initialOriginalPrices = {};
        const initialOriginalQuantities = {};
        items.forEach(item => {
          const originalQty = item.quantity;
          initialQuantities[item.id] = originalQty;
          initialOriginalQuantities[item.id] = originalQty; // Store original quantity
          const originalPrice = Number(item.SELL);
          initialPrices[item.id] = originalPrice;
          initialOriginalPrices[item.id] = originalPrice; // Store original price
        });
        setItemQuantities(initialQuantities);
        setItemPrices(initialPrices);
        setOriginalPrices(initialOriginalPrices);
        setOriginalQuantities(initialOriginalQuantities);
      }
    };

  const handleStartVerification = (orderId, items) => {
    setVerificationOrder({ orderId, items });
    setVerifiedItems([]);
    setBarcodeInput('');
    setVerificationError('');
    setShowVerificationModal(true);
  };


  const handleBarcodeScan = (scannedId) => {
    if (!verificationOrder) return;
    
    console.log('🔍 Barcode scan triggered:', scannedId);
    console.log('🔍 Verification order items:', verificationOrder.items);
    
    setVerificationError('');
    const scannedStockId = parseInt(scannedId.trim());
    
    console.log('🔍 Parsed stock ID:', scannedStockId);
    
    // Check if this item exists in the order
    const orderItem = verificationOrder.items.find(item => item.stock_id === scannedStockId);
    
    console.log('🔍 Found order item:', orderItem);
    
    if (orderItem) {
      // Check if already verified
      const alreadyVerified = verifiedItems.find(item => item.stock_id === scannedStockId);
      if (alreadyVerified) {
        setVerificationError('Item already verified!');
        setBarcodeInput(''); // Clear input even when already verified
        return;
      }
      
      // Add to verified items
      setVerifiedItems(prev => [...prev, orderItem]);
      setBarcodeInput('');
      console.log('✅ Item verified successfully!');
    } else {
      setVerificationError(`Item ID ${scannedStockId} not found in this order!`);
      setBarcodeInput(''); // Clear input when item not found
      console.log('❌ Item not found in order');
    }
  };

  const handleBarcodeInputChange = (e) => {
    const value = e.target.value;
    setBarcodeInput(value);
  };

  const handleBarcodeKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const cleanValue = barcodeInput.trim();
      if (cleanValue) {
        handleBarcodeScan(cleanValue);
      }
    }
  };

  const handleReturnToWarehouse = async () => {
    if (!verificationOrder) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/cashier/return-to-warehouse', {
        order_id: verificationOrder.orderId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      await showAlert('Order returned to warehouse successfully!', 'Success');
      setShowVerificationModal(false);
      setVerificationOrder(null);
      setVerifiedItems([]);
      
      // Refresh cashier items and notification counts
      await fetchCashierItems();
      refreshNotifications();
      
      // Dispatch event to notify other users
      window.dispatchEvent(new CustomEvent('cashierOrderReturnedToWarehouse', {
        detail: { order_id: verificationOrder.orderId }
      }));
      
      // Force additional refresh after delay
      setTimeout(() => {
        fetchCashierItems();
        refreshNotifications();
      }, 500);
    } catch (err) {
      await showAlert('Failed to return order to warehouse.', 'Error');
      console.error('Return error:', err);
    }
  };

  const handleReturnOrderToWarehouse = async (orderId, items) => {
    const confirmed = await showConfirm(
      `Are you sure you want to return Order #${orderId} to warehouse?`,
      'This will move all items back to the warehouse and remove them from the cashier.',
      'Return to Warehouse',
      'Cancel'
    );
    
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/cashier/return-to-warehouse', {
        order_id: orderId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      await showAlert('Order returned to warehouse successfully!', 'Success');
      
      // Clear selected order if it was the returned one
      if (selectedOrder && selectedOrder.orderId === orderId) {
        setSelectedOrder(null);
        setCustomerName('');
        setOrderDate('');
        setItemQuantities({});
        setItemPrices({});
        setOriginalPrices({});
        setOriginalQuantities({});
      }
      
      // Refresh cashier items and notification counts
      await fetchCashierItems();
      refreshNotifications();
      
      // Dispatch event to notify other users
      window.dispatchEvent(new CustomEvent('cashierOrderReturnedToWarehouse', {
        detail: { order_id: orderId }
      }));
      
      // Force additional refresh after delay
      setTimeout(() => {
        fetchCashierItems();
        refreshNotifications();
      }, 500);
    } catch (err) {
      await showAlert(
        err.response?.data?.message || 'Failed to return order to warehouse.',
        'Error'
      );
      console.error('Return to warehouse error:', err);
    }
  };

  const handleDeleteOrder = async (orderId, items) => {
    const confirmed = await showConfirm(
      `Are you sure you want to delete Order #${orderId}?`,
      'This will return all quantities back to stock and cannot be undone.',
      'Delete Order',
      'Cancel'
    );
    
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`/api/cashier/order/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      await showAlert(
        response.data.message || `Order #${orderId} deleted successfully. Quantities returned to stock.`,
        'Success'
      );
      
      // Clear selected order if it was the deleted one
      if (selectedOrder && selectedOrder.orderId === orderId) {
        setSelectedOrder(null);
        setCustomerName('');
        setOrderDate('');
        setItemQuantities({});
        setItemPrices({});
        setOriginalPrices({});
        setOriginalQuantities({});
      }
      
      // Refresh cashier items and notification counts
      await fetchCashierItems();
      refreshNotifications();
      
      // Dispatch event to notify other users (order deleted/processed)
      window.dispatchEvent(new CustomEvent('cashierOrderProcessed', {
        detail: { order_id: orderId }
      }));
      
      // Force additional refresh after delay
      setTimeout(() => {
        fetchCashierItems();
        refreshNotifications();
      }, 500);
    } catch (err) {
      await showAlert(
        err.response?.data?.message || 'Failed to delete order.',
        'Error'
      );
      console.error('Delete order error:', err);
    }
  };

  const handleProcessVerifiedPayment = async () => {
    if (verifiedItems.length !== verificationOrder.items.length) {
      await showAlert('Please verify all items before processing payment.', 'Verification Required');
      return;
    }
    
      // Close modal and set selected order for payment
      setSelectedOrder({ orderId: verificationOrder.orderId, items: verificationOrder.items });
      // Auto-populate customer_name from the first item if available
      const customerNameFromOrder = verificationOrder.items[0]?.customer_name;
      if (customerNameFromOrder) {
        setCustomerName(customerNameFromOrder);
      } else {
        setCustomerName(''); // Clear if no customer name
      }
      setShowVerificationModal(false);
      setVerificationOrder(null);
      setVerifiedItems([]);
    };

  const getItemQuantity = (itemId) => {
    return itemQuantities[itemId] !== undefined ? itemQuantities[itemId] : (selectedOrder?.items.find(i => i.id === itemId)?.quantity || 0);
  };

  const getItemPrice = (itemId) => {
    // Get base price (original price stored, or from item data)
    const basePrice = itemPrices[itemId] !== undefined 
      ? itemPrices[itemId] 
      : (selectedOrder?.items.find(i => i.id === itemId) ? Number(selectedOrder.items.find(i => i.id === itemId).SELL) : 0);
    
    // Apply 12% reduction (divide by 1.12 to remove VAT) if zero rated sales is enabled
    if (applyZeroRatedSales) {
      return basePrice / 1.12;
    }
    return basePrice;
  };

  // Helper functions for price editing (like Stock page)
  const getRawPrice = (price) => {
    return price ? price.toString() : '';
  };

  const getFormattedPrice = (price) => {
    return price ? price.toFixed(2) : '0.00';
  };

  const handlePriceFocus = (id) => {
    setEditingPriceId(id);
    // Clear the raw price to allow fresh typing
    setPriceRawValues(prev => ({ ...prev, [id]: '' }));
  };

  const handlePriceBlur = (id, value) => {
    const numericValue = parseFloat(value.replace(/,/g, '')) || 0;
    
    // If value is 0 or empty, revert to original price before any changes
    if (numericValue === 0 || value.trim() === '') {
      // Get the original price that was stored when the order was selected
      const originalPrice = originalPrices[id] !== undefined 
        ? originalPrices[id] 
        : (selectedOrder?.items.find(i => i.id === id) ? Number(selectedOrder.items.find(i => i.id === id).SELL) : 0);
      
      // Restore the original price
      setItemPrices(prev => ({ ...prev, [id]: originalPrice }));
    } else {
      // Save the new price
      // If zero rated is enabled, store the base price (multiply by 1.12)
      const basePrice = applyZeroRatedSales ? numericValue * 1.12 : numericValue;
      setItemPrices(prev => ({ ...prev, [id]: basePrice }));
    }
    
    setEditingPriceId(null);
    setPriceRawValues(prev => {
      const newValues = { ...prev };
      delete newValues[id];
      return newValues;
    });
  };

  const handlePriceChange = (id, value) => {
    // Only allow numbers and decimal point
    let cleanValue = value.replace(/[^\d.]/g, '');
    // Only one decimal point
    cleanValue = cleanValue.replace(/(\..*)\./g, '$1');
    // Limit to two decimal places
    if (cleanValue.includes('.')) {
      const [intPart, decPart] = cleanValue.split('.');
      cleanValue = intPart + '.' + decPart.slice(0, 2);
    }
    
    // Update the raw value in state (temporary)
    setPriceRawValues(prev => ({ ...prev, [id]: cleanValue }));
  };

  // Helper functions for quantity editing (similar to price editing)
  const getRawQty = (qty) => {
    return qty ? qty.toString() : '';
  };

  const handleQtyFocus = (id) => {
    setEditingQtyId(id);
    // Clear the raw quantity to allow fresh typing
    setQtyRawValues(prev => ({ ...prev, [id]: '' }));
  };

  const handleQtyBlur = async (id, value) => {
    const numericValue = parseInt(value.replace(/,/g, '')) || 0;
    
    // If value is 0 or empty, revert to original quantity
    if (numericValue < 1 || value.trim() === '') {
      // Get the original quantity that was stored when the order was selected
      const originalQty = originalQuantities[id] !== undefined 
        ? originalQuantities[id] 
        : (selectedOrder?.items.find(i => i.id === id) ? selectedOrder.items.find(i => i.id === id).quantity : 1);
      
      // Restore the original quantity (minimum 1)
      setItemQuantities(prev => ({ ...prev, [id]: Math.max(1, originalQty) }));
    } else {
      // Validate against available stock (accounting for quantity already in order)
      const item = selectedOrder?.items.find(i => i.id === id);
      if (item) {
        const stockQty = parseInt(item.stock_qty || item.QTY || 0) || 0;
        const originalOrderQty = originalQuantities[id] !== undefined 
          ? originalQuantities[id] 
          : (item.quantity || 0);
        
        // Available stock = current stock + quantity already in this order (because it's reserved, not sold yet)
        // This allows editing back to original quantity or less
        const availableStock = stockQty + originalOrderQty;
        
        console.log('🔍 QTY Validation:', {
          id,
          numericValue,
          stockQty,
          originalOrderQty,
          availableStock,
          item: {
            stock_qty: item.stock_qty,
            QTY: item.QTY,
            quantity: item.quantity
          },
          originalQuantities: originalQuantities[id]
        });
        
        // Check if requested quantity exceeds available stock
        if (numericValue > availableStock) {
          // Show error and revert to original quantity
          await showAlert(
            `Insufficient Stock!\n\nYou requested: ${numericValue} units\n\nAvailable stock: ${stockQty} units\n\nAlready in this order: ${originalOrderQty} units\n\nMaximum allowed: ${availableStock} units\n\nPlease reduce the quantity to ${availableStock} or less.`,
            'Insufficient Stock'
          );
          
          // Revert to original quantity
          const originalQty = originalQuantities[id] !== undefined 
            ? originalQuantities[id] 
            : (item.quantity || 1);
          setItemQuantities(prev => ({ ...prev, [id]: Math.max(1, originalQty) }));
        } else {
          // Save the new quantity (valid) - allow any value from 1 to availableStock
          setItemQuantities(prev => ({ ...prev, [id]: numericValue }));
        }
      } else {
        // If item not found, just save the value
        setItemQuantities(prev => ({ ...prev, [id]: numericValue }));
      }
    }
    
    setEditingQtyId(null);
    setQtyRawValues(prev => {
      const newValues = { ...prev };
      delete newValues[id];
      return newValues;
    });
  };

  const handleQtyChange = (id, value) => {
    // Only allow numbers (no decimal point for quantity)
    // Don't cap during typing - let user type freely, validate on blur
    let cleanValue = value.replace(/[^\d]/g, '');
    
    // Update the raw value in state (temporary)
    // Validation will happen on blur
    setQtyRawValues(prev => ({ ...prev, [id]: cleanValue }));
  };

  const calculateSubtotal = () => {
    if (!selectedOrder) return 0;
    return selectedOrder.items.reduce((total, item) => {
      const quantity = getItemQuantity(item.id);
      const price = getItemPrice(item.id);
      return total + (price * quantity);
    }, 0);
  };

  // Total Sales (VAT inclusive)
  const calculateTotalSales = () => {
    return calculateSubtotal();
  };

  // VAT Amount = Total Sales ÷ 1.12
  const calculateVAT = () => {
    return calculateTotalSales() / 1.12;
  };

  // Net of VAT = Total Sales - VAT
  const calculateNetOfVAT = () => {
    return calculateTotalSales() - calculateVAT();
  };

  // Withholding Tax = VAT Amount × 0.01 (applied to "Less VAT" amount when enabled)
  const calculateWithholdingTax = () => {
    return applyWithholdingTax ? calculateVAT() * 0.01 : 0;
  };

  // Final Total = Simple total for Delivery Invoice, or calculated total for other invoice types
  const calculateTotal = () => {
    // For Delivery Invoice, just return the simple subtotal (no tax calculations)
    if (invoiceType === 'delivery_invoice') {
      return calculateSubtotal();
    }
    
    // For other invoice types, apply tax calculations
    if (applyWithholdingTax) {
      return calculateVAT() - calculateWithholdingTax();
    } else {
      return calculateTotalSales();
    }
  };

  const handleProcessPayment = async () => {
    if (!selectedOrder) {
      await showAlert('Please select an order to process payment.', 'No Order Selected');
      return;
    }

    // Show formal confirmation modal
    setShowConfirmationModal(true);
  };

  const handleConfirmPayment = async () => {
    console.log('🔄 Starting payment process...');
    console.log('📋 Payment data:', {
      order_id: selectedOrder.orderId,
      customer_name: customerName ? customerName.toUpperCase() : '',
      si_number: invoiceNumber,
      payment_method: paymentMethod,
      invoice_type: invoiceType
    });

    try {
      const token = localStorage.getItem('token');
      
      // Get the date (use selected order date or fallback to today)
      const paymentDate = orderDate || (selectedOrder?.items?.[0]?.created_at ? new Date(selectedOrder.items[0].created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      
      // History insertion is now handled by the process-payment endpoint
      // No need for separate history/save call

      // Process payment with updated quantities
      const items = selectedOrder.items.map(item => ({
        cashier_id: item.id,
        stock_id: item.stock_id,
        quantity: getItemQuantity(item.id),
        unit_price: getItemPrice(item.id)
      }));
      
      console.log('📡 Sending payment request to server...');
      
      const paymentData = {
        order_id: selectedOrder.orderId,
        items,
        payment_method: paymentMethod,
        invoice_type: invoiceType,
        si_number: invoiceNumber || `AUTO-${Date.now()}`,
        customer_name: customerName ? customerName.toUpperCase() : 'WALK-IN CUSTOMER',
        payment_date: paymentDate,
        total_sales: calculateTotalSales(),
        vat_amount: calculateVAT(),
        net_of_vat: calculateNetOfVAT(),
        withholding_tax: calculateWithholdingTax(),
        apply_withholding_tax: applyWithholdingTax,
        apply_zero_rated_sales: applyZeroRatedSales,
        final_total: calculateTotal()
      };
      
      console.log('📋 Payment data being sent:', paymentData);
      
      const response = await axios.post('/api/cashier/process-payment', paymentData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Payment response:', response.data);
      
      await showAlert('Payment processed successfully!', 'Success');
      
      // Clear state first
      setSelectedOrder(null);
      setApplyWithholdingTax(false);  
      setApplyZeroRatedSales(false);
      setShowConfirmationModal(false);
      setCustomerName('');
      setInvoiceNumber('');
      setItemQuantities({});
      setItemPrices({});
      setOriginalPrices({});
      setOriginalQuantities({});
      setEditingPriceId(null);
      setPriceRawValues({});
      setEditingQtyId(null);
      setQtyRawValues({});
      
      // Dispatch event FIRST to notify all users immediately
      window.dispatchEvent(new CustomEvent('cashierOrderProcessed', {
        detail: { order_id: paymentData.order_id }
      }));
      
      // Small delay to ensure database transaction is committed, then refresh
      setTimeout(async () => {
        // Refresh cashier items after payment
        await fetchCashierItems();
        
        // Refresh notification counts
        refreshNotifications();
      }, 300);
      
      // Force additional refresh after longer delay to ensure sync (for edge cases)
      setTimeout(() => {
        fetchCashierItems();
        refreshNotifications();
      }, 1000);
      
      // One more refresh after 2 seconds to catch any edge cases
      setTimeout(() => {
        fetchCashierItems();
        refreshNotifications();
      }, 2000);
      
      setCustomerName('');
      setInvoiceNumber('');
      setItemQuantities({});
      setItemPrices({});
      setOriginalPrices({});
      setOriginalQuantities({});
      setEditingPriceId(null);
      setPriceRawValues({});
      setEditingQtyId(null);
      setQtyRawValues({});
    } catch (err) {
      console.error('❌ Payment error details:', err);
      console.error('❌ Error response:', err.response?.data);
      console.error('❌ Error status:', err.response?.status);
      await showAlert('Failed to process payment. Please try again.', 'Error');
      setShowConfirmationModal(false);
    }
  };

  const handleCancelPayment = () => {
    setShowConfirmationModal(false);
  };


  // Group items by order_id
  const groupedOrders = cashierItems.reduce((acc, item) => {
    if (!acc[item.order_id]) {
      acc[item.order_id] = [];
    }
    acc[item.order_id].push(item);
    return acc;
  }, {});

  const formatNumber = (num) => {
    const numValue = Number(num);
    if (isNaN(numValue)) return '0.00';
    // Use toFixed to ensure 2 decimal places, then format with locale for thousands separators
    return numValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  return (
    <>
      <style>
        {`
          /* Hide number input spinners */
          input[type="number"]::-webkit-outer-spin-button,
          input[type="number"]::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          
          input[type="number"] {
            -moz-appearance: textfield;
          }
        `}
      </style>
      <div style={{
        padding: '20px',
        background: 'var(--bg-primary)',
        minHeight: '100vh',
        color: 'var(--text-primary)',
        fontFamily: 'Arial, sans-serif'
      }}>

        {/* Loading State */}
        {loading ? (
          <div style={{ 
            background: 'var(--card-bg)', 
            padding: '60px', 
            borderRadius: '12px', 
            textAlign: 'center',
            border: '1px solid var(--border-color)'
          }}>
            <RefreshCw size={getFontSize(48)} style={{ animation: 'spin 1s linear infinite', color: '#007bff' }} />
            <p style={{ color: 'var(--text-secondary)', margin: '20px 0 0 0', fontSize: `${getFontSize(18)}px` }}>Loading cashier items...</p>
          </div>
        ) : error ? (
          <div style={{ 
            background: 'var(--card-bg)', 
            padding: '60px', 
            borderRadius: '12px', 
            textAlign: 'center',
            border: '1px solid var(--border-color)'
          }}>
            <AlertTriangle size={getFontSize(48)} style={{ color: '#dc3545' }} />
            <p style={{ color: '#dc3545', margin: '20px 0 0 0', fontSize: `${getFontSize(18)}px` }}>{error}</p>
            <button
              onClick={handleRefresh}
              style={{
                background: '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: largeFontMode ? '16px 28px' : '12px 24px',
                marginTop: '20px',
                fontWeight: '600',
                fontSize: `${getFontSize(14)}px`,
                cursor: 'pointer',
                transition: 'background 0.2s ease'
              }}
              onMouseOver={(e) => e.target.style.background = '#0056b3'}
              onMouseOut={(e) => e.target.style.background = '#007bff'}
            >
              Try Again
            </button>
          </div>
        ) : Object.entries(groupedOrders).length === 0 ? (
          <div style={{ 
            background: 'var(--card-bg)', 
            padding: '60px', 
            borderRadius: '12px', 
            textAlign: 'center',
            border: '1px solid var(--border-color)'
          }}>
            <ShoppingCart size={getFontSize(64)} style={{ color: 'var(--text-muted)', marginBottom: '20px' }} />
            <h3 style={{ color: 'var(--text-secondary)', margin: '0 0 16px 0', fontSize: `${getFontSize(24)}px` }}>No Items in Cashier</h3>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: `${getFontSize(16)}px` }}>Items will appear here when sent from warehouse</p>
          </div>
        ) : (
          <>
            {/* Left Content Area */}
            <div style={{
              flex: '1',
              maxWidth: 'calc(100% - 790px)',
              paddingRight: '20px'
            }}>
              {/* Action Buttons Row */}
              <div style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '20px',
                alignItems: 'center'
              }}>
                {/* Refresh Button */}
                <button
                  onClick={handleRefresh}
                  disabled={refreshing || loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    background: 'rgba(0, 123, 255, 0.2)',
                    border: '1px solid #007bff',
                    borderRadius: '8px',
                    color: '#007bff',
                    cursor: (refreshing || loading) ? 'not-allowed' : 'pointer',
                    fontSize: getFontSize(14),
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                    opacity: (refreshing || loading) ? 0.6 : 1,
                    zIndex: 1000
                  }}
                  onMouseEnter={(e) => {
                    if (!refreshing && !loading) {
                      e.target.style.background = 'rgba(0, 123, 255, 0.3)';
                      e.target.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!refreshing && !loading) {
                      e.target.style.background = 'rgba(0, 123, 255, 0.2)';
                      e.target.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  <RefreshCw size={getFontSize(16)} style={{ 
                    animation: refreshing ? 'spin 1s linear infinite' : 'none' 
                  }} />
                  Refresh Orders
                </button>
              </div>
              
              {/* Items List */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: largeFontMode ? 'repeat(auto-fill, minmax(380px, 1fr))' : 'repeat(auto-fill, minmax(320px, 1fr))', 
                gap: largeFontMode ? '20px' : '18px',
                maxWidth: largeFontMode ? '800px' : '700px'
              }}>
                {Object.entries(groupedOrders).reverse().map(([orderId, items]) => {
                const itemCount = items.length;
                const orderSource = items[0]?.source || 'counter';
                const isServiceOrder = orderSource === 'service';
                const isSelected = selectedOrder && selectedOrder.orderId === orderId;
                
                // Navy blue for service orders, green for counter orders
                const headerGradient = isServiceOrder 
                  ? 'linear-gradient(135deg, #001f3f 0%, #003d7a 100%)' 
                  : 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)';
                
                const cardBackground = isSelected 
                  ? (isServiceOrder ? '#0a1a2e' : '#1a4d1a')
                  : 'var(--card-bg)';
                
                const cardBorder = isSelected
                  ? (isServiceOrder ? '2px solid #001f3f' : '2px solid #28a745')
                  : `1px solid var(--border-color)`;
                
                const cardShadow = isSelected
                  ? (isServiceOrder ? '0 8px 24px rgba(0, 31, 63, 0.4)' : '0 8px 24px rgba(40, 167, 69, 0.3)')
                  : '0 4px 12px rgba(0,0,0,0.3)';
                
                return (
                  <div key={orderId} style={{
                    background: 'var(--card-bg)',
                    borderRadius: '12px',
                    border: cardBorder,
                    overflow: 'hidden',
                    boxShadow: isSelected ? cardShadow : '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.08)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                  onClick={() => handleOrderSelect(orderId, items)}
                  onMouseOver={(e) => {
                    if (!selectedOrder || selectedOrder.orderId !== orderId) {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15), 0 4px 8px rgba(0, 0, 0, 0.1)';
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    if (!selectedOrder || selectedOrder.orderId !== orderId) {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.08)';
                    }
                  }}>
                    
                    {/* Order Header */}
                    <div style={{
                      background: headerGradient,
                      color: '#fff',
                      padding: largeFontMode ? '18px 20px 14px 20px' : '16px 20px 12px 20px',
                      position: 'relative',
                      flexShrink: 0
                    }}>
                      {/* Main Header Layout */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        width: '100%',
                        gap: largeFontMode ? '16px' : '12px'
                      }}>
                        {/* Left Side: Customer Name and Date */}
                        <div style={{
                          flex: 1,
                          minWidth: 0,
                          paddingRight: largeFontMode ? '16px' : '12px'
                        }}>
                          <div style={{
                            fontSize: `${getFontSize(18)}px`,
                            fontWeight: 'bold',
                            color: '#fff',
                            marginBottom: '4px',
                            overflow: 'hidden',
                            textOverflow: largeFontMode ? 'clip' : 'ellipsis',
                            whiteSpace: largeFontMode ? 'normal' : 'nowrap',
                            wordBreak: largeFontMode ? 'break-word' : 'normal',
                            lineHeight: largeFontMode ? '1.3' : '1',
                            maxWidth: '100%'
                          }}
                          title={items[0]?.customer_name || 'No Customer Name'}
                          >
                            {items[0]?.customer_name || 'No Customer Name'}
                          </div>
                          <div style={{
                            fontSize: `${getFontSize(11)}px`,
                            color: '#e3f2fd',
                            opacity: 0.8
                          }}>
                            {new Date(items[0]?.created_at).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                        </div>

                        {/* Right Side: Action Buttons, Source Badge and Order Number */}
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: largeFontMode ? '6px' : '4px',
                          justifyContent: 'flex-start'
                        }}>
                          {/* Action Buttons Row */}
                          <div style={{
                            display: 'flex',
                            gap: largeFontMode ? '8px' : '6px',
                            alignItems: 'center'
                          }}>
                            {/* Return to Warehouse Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReturnOrderToWarehouse(orderId, items);
                              }}
                              style={{
                                background: '#ffc107',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '0',
                                color: '#000',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: largeFontMode ? '28px' : '24px',
                                height: largeFontMode ? '28px' : '24px',
                                transition: 'all 0.2s ease',
                                zIndex: 10,
                                lineHeight: '1',
                                title: 'Return to Warehouse',
                                boxShadow: '0 2px 4px rgba(255, 193, 7, 0.3)'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = '#e0a800';
                                e.currentTarget.style.transform = 'scale(1.15) translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 8px rgba(255, 193, 7, 0.5)';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = '#ffc107';
                                e.currentTarget.style.transform = 'scale(1) translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(255, 193, 7, 0.3)';
                              }}
                              title="Return to Warehouse"
                            >
                              ↶
                            </button>
                            
                            {/* Delete Button - Simple, Small, Red, X Icon */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteOrder(orderId, items);
                              }}
                              style={{
                                background: '#dc3545',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '0',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: largeFontMode ? '28px' : '24px',
                                height: largeFontMode ? '28px' : '24px',
                                transition: 'all 0.2s ease',
                                zIndex: 10,
                                lineHeight: '1',
                                boxShadow: '0 2px 4px rgba(220, 53, 69, 0.3)'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = '#c82333';
                                e.currentTarget.style.transform = 'scale(1.15) translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 8px rgba(220, 53, 69, 0.5)';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = '#dc3545';
                                e.currentTarget.style.transform = 'scale(1) translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(220, 53, 69, 0.3)';
                              }}
                              title="Delete Order"
                            >
                              ×
                            </button>
                          </div>

                          {/* Source Badge - Under Delete Button */}
                          <div style={{
                            background: isServiceOrder ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.15)',
                            borderRadius: '4px',
                            padding: largeFontMode ? '4px 10px' : '2px 8px',
                            fontSize: `${getFontSize(10)}px`,
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            border: '1px solid rgba(255, 255, 255, 0.3)'
                          }}>
                            {isServiceOrder ? 'SERVICE' : 'COUNTER'}
                          </div>

                          {/* Order Number - Below Source Badge */}
                          <div style={{
                            textAlign: 'right',
                            whiteSpace: 'nowrap'
                          }}>
                            <div style={{
                              fontSize: `${getFontSize(24)}px`,
                              fontWeight: 'bold',
                              color: '#fff',
                              lineHeight: '1.2',
                              wordBreak: 'keep-all'
                            }}>
                              Order #{orderId}
                            </div>
                            {selectedOrder && selectedOrder.orderId === orderId && (
                              <div style={{
                                fontSize: `${getFontSize(10)}px`,
                                color: '#fff',
                                opacity: 0.9,
                                marginTop: '2px'
                              }}>
                                Selected
                              </div>
                            )}
                          </div>

                          {/* PRF and RO Badges - Under Order Number (Horizontal) */}
                          {(items[0]?.requisition_number || items[0]?.repair_order_number) && (
                            <div style={{
                              display: 'flex',
                              gap: '6px',
                              justifyContent: 'flex-end',
                              marginTop: '4px'
                            }}>
                              {items[0]?.requisition_number && (
                                <div style={{
                                  color: '#90caf9',
                                  fontSize: `${getFontSize(11)}px`,
                                  fontWeight: '600',
                                  background: 'rgba(144, 202, 249, 0.15)',
                                  padding: largeFontMode ? '4px 10px' : '3px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(144, 202, 249, 0.3)',
                                  whiteSpace: 'nowrap'
                                }}>
                                  PRF: {items[0].requisition_number}
                                </div>
                              )}
                              {items[0]?.repair_order_number && (
                                <div style={{
                                  color: '#ffc107',
                                  fontSize: `${getFontSize(11)}px`,
                                  fontWeight: '600',
                                  background: 'rgba(255, 193, 7, 0.15)',
                                  padding: largeFontMode ? '4px 10px' : '3px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(255, 193, 7, 0.3)',
                                  whiteSpace: 'nowrap'
                                }}>
                                  RO: {items[0].repair_order_number}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div style={{ padding: largeFontMode ? '18px 20px' : '16px 18px', background: 'var(--card-bg)' }}>
                      <div style={{ marginBottom: largeFontMode ? '14px' : '12px' }}>
                        <h4 style={{
                          color: 'var(--text-primary)',
                          margin: '0 0 12px 0',
                          fontSize: `${getFontSize(13)}px`,
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          opacity: 0.9
                        }}>
                          Items ({itemCount})
                        </h4>
                      </div>
                      
                      <div style={{ maxHeight: largeFontMode ? '320px' : '280px', overflowY: 'auto' }}>
                        {items.map((item, index) => (
                          <div key={item.id} style={{
                            padding: largeFontMode ? '14px' : '12px',
                            marginBottom: index < items.length - 1 ? (largeFontMode ? '10px' : '8px') : '0',
                            background: 'var(--bg-secondary)',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = 'var(--hover-bg)';
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08)';
                            e.currentTarget.style.transform = 'translateX(2px) translateY(-2px)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = 'var(--bg-secondary)';
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)';
                            e.currentTarget.style.transform = 'translateX(0) translateY(0)';
                          }}>
                            {/* Top Row: Part Number and Price */}
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '8px'
                            }}>
                              <div style={{
                                color: '#90caf9',
                                fontSize: `${getFontSize(16)}px`,
                                fontWeight: '600',
                                textAlign: 'left',
                                textDecoration: 'underline',
                                textUnderlineOffset: '3px',
                                textDecorationColor: 'rgba(144, 202, 249, 0.4)',
                                wordBreak: largeFontMode ? 'break-word' : 'normal',
                                maxWidth: '100%'
                              }}>
                                {item.BENZ}
                              </div>
                              <div style={{
                                color: '#28a745',
                                fontWeight: '700',
                                fontSize: `${getFontSize(15)}px`,
                                textAlign: 'right'
                              }}>
                                ₱{formatNumber(Number(item.SELL) * item.quantity)}
                              </div>
                            </div>
                            
                            {/* ID and Brand Row */}
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '6px'
                            }}>
                              <div style={{
                                color: 'var(--text-primary)',
                                fontSize: `${getFontSize(12)}px`,
                                fontWeight: '500',
                                background: 'var(--bg-tertiary)',
                                padding: largeFontMode ? '6px 10px' : '4px 8px',
                                borderRadius: '4px',
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
                              }}>
                                ID: {item.stock_id}
                              </div>
                              <div style={{
                                color: 'var(--text-primary)',
                                fontSize: `${getFontSize(13)}px`,
                                fontWeight: '600',
                                wordBreak: largeFontMode ? 'break-word' : 'normal',
                                maxWidth: largeFontMode ? '60%' : 'none'
                              }}>
                                {item.BRAND && item.ALTNO ? `${item.BRAND} ${item.ALTNO}` : (item.BRAND || 'No brand')}
                              </div>
                            </div>
                            
                            {/* Description and Quantity Row */}
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-end',
                              gap: largeFontMode ? '12px' : '8px'
                            }}>
                              <div style={{
                                color: 'var(--text-secondary)',
                                fontSize: `${getFontSize(12)}px`,
                                flex: 1,
                                paddingRight: largeFontMode ? '12px' : '10px',
                                wordBreak: largeFontMode ? 'break-word' : 'normal'
                              }}>
                                {item.description || 'No description'}
                              </div>
                              <div style={{
                                background: '#007bff',
                                color: '#fff',
                                borderRadius: '6px',
                                padding: largeFontMode ? '6px 12px' : '4px 10px',
                                fontSize: `${getFontSize(12)}px`,
                                fontWeight: '600',
                                minWidth: largeFontMode ? '40px' : '35px',
                                textAlign: 'center',
                                flexShrink: 0,
                                boxShadow: '0 2px 6px rgba(0, 123, 255, 0.3)',
                                transition: 'all 0.2s ease',
                                cursor: 'pointer'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.5)';
                                e.currentTarget.style.transform = 'scale(1.05)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 123, 255, 0.3)';
                                e.currentTarget.style.transform = 'scale(1)';
                              }}>
                                {item.quantity}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>
            </div>

            {/* Fixed Shopping Cart */}
            <div style={{
            background: 'var(--card-bg)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            padding: '16px',
            height: 'calc(100vh - 120px)',
            position: 'fixed',
            top: '80px',
            right: '20px',
            width: '750px',
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
            zIndex: 100,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column'
          }}>

            {/* Payment Information Form */}
              <div style={{ 
                marginTop: '0',
                marginBottom: '16px',
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.08)',
                border: '1px solid var(--border-color)',
                flexShrink: 0
              }}>
                {/* Row 1: Invoice Type, Payment Method, Date - 3 Column Grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '12px', 
                  marginBottom: '14px' 
                }}>
                  {/* Invoice Type */}
                  <div>
                    <label style={{ 
                      color: 'var(--text-primary)', 
                      display: 'block', 
                      marginBottom: '8px',
                      fontSize: `${getFontSize(12)}px`,
                      fontWeight: '600',
                      letterSpacing: '0.3px'
                    }}>
                      Invoice Type
                    </label>
                    <select
                      value={invoiceType}
                      onChange={(e) => setInvoiceType(e.target.value)}
                      style={{ 
                        width: '100%', 
                        height: largeFontMode ? '48px' : '40px',
                        padding: '0 14px', 
                        borderRadius: '8px', 
                        background: 'var(--input-bg)', 
                        color: 'var(--text-primary)', 
                        border: '1px solid var(--border-color)',
                        fontSize: `${getFontSize(13)}px`,
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#28a745';
                        e.target.style.boxShadow = '0 0 0 3px rgba(40, 167, 69, 0.2), 0 4px 8px rgba(0, 0, 0, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'var(--border-color)';
                        e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.08)';
                      }}
                    >
                      <option value="cash_invoice">Cash Invoice</option>
                      <option value="charge_invoice">Charge Invoice</option>
                      <option value="delivery_invoice">Delivery Invoice</option>
                    </select>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label style={{ 
                      color: 'var(--text-primary)', 
                      display: 'block', 
                      marginBottom: '8px',
                      fontSize: `${getFontSize(12)}px`,
                      fontWeight: '600',
                      letterSpacing: '0.3px'
                    }}>
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      style={{ 
                        width: '100%', 
                        height: largeFontMode ? '48px' : '40px',
                        padding: '0 14px', 
                        borderRadius: '8px', 
                        background: 'var(--input-bg)', 
                        color: 'var(--text-primary)', 
                        border: '1px solid var(--border-color)',
                        fontSize: `${getFontSize(13)}px`,
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#28a745';
                        e.target.style.boxShadow = '0 0 0 3px rgba(40, 167, 69, 0.2), 0 4px 8px rgba(0, 0, 0, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'var(--border-color)';
                        e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.08)';
                      }}
                    >
                      <option value="cash">CASH</option>
                      <option value="credit_card">CREDIT CARD</option>
                      <option value="debit_card">DEBIT CARD</option>
                      <option value="check">CHECK</option>
                      <option value="direct_deposit">DIRECT DEPOSIT</option>
                      <option value="gcash">GCASH</option>
                      <option value="payment_notice">PAYMENT NOTICE</option>
                    </select>
                  </div>

                  {/* Date Field */}
                  <div>
                    <label style={{ 
                      color: 'var(--text-primary)', 
                      display: 'block', 
                      marginBottom: '8px',
                      fontSize: `${getFontSize(12)}px`,
                      fontWeight: '600',
                      letterSpacing: '0.3px'
                    }}>
                      Date
                    </label>
                    <input
                      type="date"
                      value={orderDate || new Date().toISOString().split('T')[0]}
                      onChange={(e) => setOrderDate(e.target.value)}
                      style={{ 
                        width: '100%', 
                        height: largeFontMode ? '48px' : '40px',
                        padding: '0 14px', 
                        borderRadius: '8px', 
                        background: 'var(--input-bg)', 
                        color: 'var(--text-primary)', 
                        border: '1px solid var(--border-color)',
                        fontSize: `${getFontSize(13)}px`,
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#28a745';
                        e.target.style.boxShadow = '0 0 0 3px rgba(40, 167, 69, 0.2), 0 4px 8px rgba(0, 0, 0, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'var(--border-color)';
                        e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.08)';
                      }}
                    />
                  </div>
                </div>

                {/* Row 2: Invoice Number, Customer Name - Unequal Column Grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 2fr',
                  gap: '12px', 
                  marginBottom: '0' 
                }}>
                  {/* Invoice Number */}
                  <div>
                    <label style={{ 
                      color: 'var(--text-primary)', 
                      display: 'block', 
                      marginBottom: '8px',
                      fontSize: `${getFontSize(12)}px`,
                      fontWeight: '600',
                      letterSpacing: '0.3px'
                    }}>
                      Invoice Number
                    </label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="Enter invoice number"
                      style={{ 
                        width: '100%', 
                        height: largeFontMode ? '48px' : '40px',
                        padding: '0 14px', 
                        borderRadius: '8px', 
                        background: 'var(--input-bg)', 
                        color: 'var(--text-primary)', 
                        border: '1px solid var(--border-color)',
                        fontSize: `${getFontSize(13)}px`,
                        boxSizing: 'border-box',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#28a745';
                        e.target.style.boxShadow = '0 0 0 3px rgba(40, 167, 69, 0.2), 0 4px 8px rgba(0, 0, 0, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'var(--border-color)';
                        e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.08)';
                      }}
                    />
                  </div>

                  {/* Customer Name */}
                  <div>
                    <label style={{ 
                      color: 'var(--text-primary)', 
                      display: 'block', 
                      marginBottom: '8px',
                      fontSize: `${getFontSize(12)}px`,
                      fontWeight: '600',
                      letterSpacing: '0.3px'
                    }}>
                      Customer Name
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                      placeholder="Enter customer name"
                      style={{ 
                        width: '100%', 
                        height: largeFontMode ? '48px' : '40px',
                        padding: '0 14px', 
                        borderRadius: '8px', 
                        background: 'var(--input-bg)', 
                        color: 'var(--text-primary)', 
                        border: '1px solid var(--border-color)',
                        fontSize: `${getFontSize(13)}px`,
                        boxSizing: 'border-box',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#28a745';
                        e.target.style.boxShadow = '0 0 0 3px rgba(40, 167, 69, 0.2), 0 4px 8px rgba(0, 0, 0, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'var(--border-color)';
                        e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.08)';
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Selected Order */}
              <div style={{ marginBottom: '12px', flex: '1', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  color: 'var(--text-primary)',
                  fontSize: `${getFontSize(14)}px`,
                  fontWeight: '600',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {selectedOrder ? `Order ${selectedOrder.orderId}` : 'No Order Selected'}
                </div>
                
                {!selectedOrder ? (
                  <div style={{ 
                    color: 'var(--text-muted)', 
                    fontSize: `${getFontSize(14)}px`, 
                    textAlign: 'center',
                    padding: '60px 20px',
                    background: 'var(--card-bg)',
                    borderRadius: '12px',
                    border: `2px dashed var(--border-color)`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '200px',
                    opacity: 0.7,
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.opacity = '0.7';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
                  }}
                  >
                    <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>📋</div>
                    Click on an order to select it
                  </div>
                ) : (
                  <div style={{
                    background: isDark ? '#1a1a1a' : '#fafafa',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: isDark ? '1px solid #404040' : '1px solid #d2d2d7',
                    boxShadow: isDark 
                      ? '0 4px 16px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)' 
                      : '0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    flex: '1',
                    minHeight: 0
                  }}>
                    {/* Table Header */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '60px 20px 150px 1fr 90px 60px 90px',
                      background: isDark 
                        ? 'linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%)' 
                        : 'linear-gradient(135deg, #f0f0f2 0%, #e8e8ea 100%)',
                      padding: largeFontMode ? '14px 18px' : '10px 14px',
                      borderBottom: isDark ? `2px solid #404040` : `2px solid #d2d2d7`,
                      fontSize: `${getFontSize(10)}px`,
                      fontWeight: '700',
                      color: isDark ? '#e0e0e0' : '#1d1d1f',
                      textTransform: 'uppercase',
                      letterSpacing: '0.8px',
                      flexShrink: 0,
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
                      position: 'sticky',
                      top: 0,
                      zIndex: 10
                    }}>
                      <div style={{ textAlign: 'center' }}>ID</div>
                      <div></div>
                      <div style={{ textAlign: 'left', paddingLeft: '10px' }}>Part Number</div>
                      <div style={{ textAlign: 'left', paddingLeft: '40px' }}>Product Details</div>
                      <div style={{ textAlign: 'right' }}>Unit Price</div>
                      <div style={{ textAlign: 'center' }}>Qty</div>
                      <div style={{ textAlign: 'right' }}>Total</div>
                    </div>
                    
                    {/* Table Body */}
                    <div style={{ 
                      flex: '1',
                      minHeight: 0,
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      background: isDark ? '#1a1a1a' : '#fafafa'
                    }}>
                      {selectedOrder.items.map((item, index) => {
                        const rowBg = isDark 
                          ? (index % 2 === 0 ? '#23272f' : '#1e1e1e')
                          : (index % 2 === 0 ? '#fafafa' : '#f0f0f2');
                        const hoverBg = isDark ? '#2d3748' : '#e8f4f8';
                        const borderColor = isDark ? '#404040' : '#e8e8ea';
                        
                        return (
                        <div key={item.id} style={{
                          display: 'grid',
                          gridTemplateColumns: '60px 20px 150px 1fr 90px 60px 90px',
                          padding: largeFontMode ? '16px 20px' : '12px 16px',
                          borderBottom: index < selectedOrder.items.length - 1 ? `1px solid ${borderColor}` : 'none',
                          alignItems: 'center',
                          fontSize: `${getFontSize(11)}px`,
                          transition: 'all 0.2s ease',
                          minHeight: largeFontMode ? '80px' : '60px',
                          background: rowBg,
                          borderLeft: '3px solid transparent'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = hoverBg;
                          e.currentTarget.style.borderLeftColor = isDark ? '#4a9eff' : '#2196f3';
                          e.currentTarget.style.boxShadow = isDark 
                            ? '0 2px 8px rgba(74, 158, 255, 0.2)' 
                            : '0 2px 8px rgba(33, 150, 243, 0.15)';
                          e.currentTarget.style.transform = 'translateX(2px)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = rowBg;
                          e.currentTarget.style.borderLeftColor = 'transparent';
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                        >
                          {/* ID */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'center'
                          }}>
                            <div style={{
                              color: isDark ? '#ffc107' : '#f57c00',
                              fontSize: `${getFontSize(16)}px`,
                              fontWeight: 'bold',
                              textAlign: 'center',
                              background: isDark ? 'rgba(255, 193, 7, 0.15)' : '#fff3e0',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: isDark ? '1px solid rgba(255, 193, 7, 0.3)' : '1px solid #ffb74d',
                              boxShadow: '0 1px 3px rgba(245, 124, 0, 0.2)'
                            }}>
                              {item.stock_id}
                            </div>
                          </div>
                          
                          {/* Spacer */}
                          <div></div>
                          
                          {/* Part Number */}
                          <div style={{
                            color: isDark ? '#90caf9' : '#1565c0',
                            fontWeight: '700',
                            fontSize: `${getFontSize(16)}px`,
                            letterSpacing: '0.3px',
                            textAlign: 'left',
                            paddingLeft: '10px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontFamily: 'monospace'
                          }}>
                            {item.BENZ}
                          </div>
                          
                          {/* Product Details */}
                          <div style={{ 
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            textAlign: 'left',
                            paddingLeft: '40px',
                            paddingRight: '10px'
                          }}>
                            {/* Description - Large and Bold */}
                            <div style={{ 
                              color: isDark ? '#e0e0e0' : '#1d1d1f',
                              fontSize: `${getFontSize(11)}px`,
                              fontWeight: '600',
                              lineHeight: '1.3',
                              marginBottom: '4px'
                            }}>
                              {item.description || 'No description'}
                            </div>
                            {/* Brand and Alt Number - Smaller and Gray */}
                            <div style={{ 
                              color: isDark ? '#b0b0b0' : '#6e6e73',
                              fontSize: `${getFontSize(9)}px`,
                              fontWeight: '400',
                              lineHeight: '1.2',
                              fontStyle: 'normal'
                            }}>
                              {item.BRAND} {item.ALTNO && `(${item.ALTNO})`}
                            </div>
                          </div>
                          
                          {/* Unit Price - Editable (like Stock page) */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center'
                          }}>
                            <input
                              type="text"
                              value={editingPriceId === item.id
                                ? (priceRawValues[item.id] !== undefined ? priceRawValues[item.id] : getRawPrice(getItemPrice(item.id)))
                                : getFormattedPrice(getItemPrice(item.id))
                              }
                              onFocus={(e) => {
                                handlePriceFocus(item.id);
                                // Select all text so user can immediately start typing
                                e.target.select();
                                e.target.style.borderColor = '#28a745';
                                e.target.style.boxShadow = '0 0 0 3px rgba(40, 167, 69, 0.2), 0 2px 6px rgba(0, 0, 0, 0.12)';
                              }}
                              onBlur={(e) => {
                                handlePriceBlur(item.id, e.target.value);
                                e.target.style.borderColor = isDark ? '#404040' : '#d2d2d7';
                                e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                              }}
                              onChange={(e) => handlePriceChange(item.id, e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.target.blur(); // Trigger blur to save and format
                                }
                              }}
                              style={{
                                width: '100%',
                                maxWidth: '85px',
                                color: isDark ? '#e0e0e0' : '#1d1d1f',
                                fontSize: `${getFontSize(11)}px`,
                                fontWeight: '600',
                                textAlign: 'right',
                                background: isDark ? '#2d2d2d' : '#fafafa',
                                padding: largeFontMode ? '8px 10px' : '5px 8px',
                                borderRadius: '6px',
                                border: editingPriceId === item.id ? '2px solid #28a745' : (isDark ? `1px solid #404040` : `1px solid #d2d2d7`),
                                outline: 'none',
                                transition: 'all 0.2s ease',
                                boxShadow: editingPriceId === item.id ? '0 0 0 3px rgba(40, 167, 69, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.1)'
                              }}
                            />
                          </div>
                          
                          {/* Quantity - Editable (like Unit Price) */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                          }}>
                            <input
                              type="text"
                              value={editingQtyId === item.id
                                ? (qtyRawValues[item.id] !== undefined ? qtyRawValues[item.id] : getRawQty(getItemQuantity(item.id)))
                                : getItemQuantity(item.id).toString()
                              }
                              onFocus={(e) => {
                                handleQtyFocus(item.id);
                                // Select all text so user can immediately start typing
                                e.target.select();
                                e.target.style.borderColor = '#28a745';
                                e.target.style.boxShadow = '0 0 0 3px rgba(40, 167, 69, 0.2), 0 2px 6px rgba(0, 0, 0, 0.12)';
                              }}
                              onBlur={(e) => {
                                handleQtyBlur(item.id, e.target.value);
                                e.target.style.borderColor = isDark ? '#404040' : '#d2d2d7';
                                e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                              }}
                              onChange={(e) => handleQtyChange(item.id, e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.target.blur(); // Trigger blur to save and format
                                }
                              }}
                              title={`Available in stock: ${item.stock_qty || item.QTY || 'Unknown'}`}
                              style={{
                                width: '100%',
                                maxWidth: '50px',
                                color: isDark ? '#e0e0e0' : '#1d1d1f',
                                fontWeight: '600',
                                fontSize: `${getFontSize(11)}px`,
                                textAlign: 'center',
                                background: isDark ? '#2d2d2d' : '#fafafa',
                                padding: largeFontMode ? '8px 10px' : '5px 8px',
                                borderRadius: '6px',
                                border: editingQtyId === item.id ? '2px solid #28a745' : (isDark ? `1px solid #404040` : `1px solid #d2d2d7`),
                                outline: 'none',
                                transition: 'all 0.2s ease',
                                letterSpacing: '0.3px',
                                boxShadow: editingQtyId === item.id ? '0 0 0 3px rgba(40, 167, 69, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.1)'
                              }}
                            />
                          </div>
                          
                          {/* Total */}
                          <div style={{
                            color: '#28a745',
                            fontSize: `${getFontSize(12)}px`,
                            fontWeight: 'bold',
                            textAlign: 'right',
                            background: isDark ? 'rgba(40, 167, 69, 0.15)' : '#d4edda',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            border: isDark ? '1px solid rgba(40, 167, 69, 0.3)' : '1px solid #c3e6cb',
                            display: 'inline-block',
                            marginLeft: 'auto',
                            boxShadow: '0 1px 3px rgba(40, 167, 69, 0.2)'
                          }}>
                            ₱{formatNumber(getItemPrice(item.id) * getItemQuantity(item.id))}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Zero Rated Sales and Total */}
              <div style={{
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '16px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.08)',
                border: '1px solid var(--border-color)',
                flexShrink: 0
              }}>
                {/* Zero Rated Sales Toggle */}
                {invoiceType !== 'delivery_invoice' && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                    padding: '2px 0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="zero-rated-sales"
                        checked={applyZeroRatedSales}
                        onChange={(e) => {
                          setApplyZeroRatedSales(e.target.checked);
                          // The price calculation is handled by getItemPrice() function
                          // No need to modify stored prices here - just toggle the flag
                        }}
                        style={{ 
                          width: largeFontMode ? '18px' : '14px', 
                          height: largeFontMode ? '18px' : '14px', 
                          accentColor: '#28a745',
                          cursor: 'pointer'
                        }}
                      />
                      <label 
                        htmlFor="zero-rated-sales" 
                        style={{ 
                          color: applyZeroRatedSales ? 'var(--text-primary)' : 'var(--text-secondary)', 
                          fontSize: `${getFontSize(12)}px`,
                          fontWeight: '400',
                          cursor: 'pointer'
                        }}
                      >
                        Zero Rated Sales:
                      </label>
                    </div>
                    <span style={{ 
                      color: applyZeroRatedSales ? 'var(--text-primary)' : 'var(--text-secondary)', 
                      fontSize: `${getFontSize(13)}px`, 
                      fontWeight: '600' 
                    }}>
                      {applyZeroRatedSales ? 'Applied' : '₱0.00'}
                    </span>
                  </div>
                )}

                {/* Final Total */}
                <div style={{
                  borderTop: invoiceType !== 'delivery_invoice' ? `1px solid var(--border-color)` : 'none',
                  paddingTop: invoiceType !== 'delivery_invoice' ? '16px' : '0',
                  marginTop: invoiceType !== 'delivery_invoice' ? '16px' : '0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-tertiary)',
                  padding: '16px 20px',
                  borderRadius: '8px',
                  margin: invoiceType !== 'delivery_invoice' ? '16px -20px -20px -20px' : '0 -20px -20px -20px',
                  border: `1px solid var(--border-color)`,
                  boxShadow: '0 4px 12px rgba(40, 167, 69, 0.15), 0 2px 6px rgba(0, 0, 0, 0.1)'
                }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: `${getFontSize(16)}px`, fontWeight: '700', letterSpacing: '0.5px' }}>
                    TOTAL:
                  </span>
                  <span style={{ color: '#28a745', fontSize: `${getFontSize(22)}px`, fontWeight: '700', letterSpacing: '0.3px' }}>
                    ₱{formatNumber(calculateTotal())}
                  </span>
                </div>
              </div>

              {/* Process Payment Button */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center',
                marginTop: 'auto',
                paddingTop: '10px',
                flexShrink: 0
              }}>
                <button
                  onClick={handleProcessPayment}
                  disabled={!selectedOrder || !customerName.trim() || !invoiceNumber.trim()}
                  style={{
                    width: '100%',
                    padding: largeFontMode ? '18px 20px' : '14px 16px',
                    background: (!selectedOrder || !customerName.trim() || !invoiceNumber.trim()) ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: `${getFontSize(15)}px`,
                    fontWeight: '700',
                    cursor: (!selectedOrder || !customerName.trim() || !invoiceNumber.trim()) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: (!selectedOrder || !customerName.trim() || !invoiceNumber.trim()) ? 'none' : '0 4px 16px rgba(40, 167, 69, 0.25)',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    opacity: (!selectedOrder || !customerName.trim() || !invoiceNumber.trim()) ? 0.6 : 1
                  }}
                  onMouseOver={(e) => {
                    if (selectedOrder && customerName.trim() && invoiceNumber.trim()) {
                      e.target.style.background = 'linear-gradient(135deg, #1e7e34 0%, #198754 100%)';
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 6px 20px rgba(40, 167, 69, 0.35)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (selectedOrder && customerName.trim() && invoiceNumber.trim()) {
                      e.target.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 4px 16px rgba(40, 167, 69, 0.25)';
                    }
                  }}
                >
                  PAY
                </button>
              </div>
            </div>
          </>
        )}

        {/* CSS for spinning animation */}
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>

      {/* Verification Modal */}
      {showVerificationModal && verificationOrder && (
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
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            border: '1px solid var(--border-color)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{
                color: 'var(--text-primary)',
                margin: 0,
                fontSize: '24px',
                fontWeight: 'bold'
              }}>
                Verify Order #{verificationOrder.orderId}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => setShowVerificationModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: '24px',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <span style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '600' }}>
                  Verification Progress
                </span>
                <span style={{ color: '#28a745', fontSize: '16px', fontWeight: '600' }}>
                  {verifiedItems.length} / {verificationOrder.items.length} verified
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                background: 'var(--bg-secondary)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${(verifiedItems.length / verificationOrder.items.length) * 100}%`,
                  height: '100%',
                  background: '#28a745',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>

            {/* Barcode Input */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                color: 'var(--text-primary)',
                display: 'block',
                marginBottom: '8px',
                fontSize: '16px',
                fontWeight: '600'
              }}>
                Scan or Type Item ID:
              </label>
              <input
                type="text"
                value={barcodeInput}
                onChange={handleBarcodeInputChange}
                onKeyPress={handleBarcodeKeyPress}
                placeholder="Scan barcode or type item ID..."
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  border: `2px solid var(--border-color)`,
                  fontSize: '16px',
                  outline: 'none'
                }}
              />
              {verificationError && (
                <div style={{
                  color: '#dc3545',
                  fontSize: '14px',
                  marginTop: '8px',
                  padding: '8px 12px',
                  background: 'rgba(220, 53, 69, 0.1)',
                  borderRadius: '6px',
                  border: '1px solid #dc3545'
                }}>
                  {verificationError}
                </div>
              )}
            </div>

            {/* Items List */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{
                color: 'var(--text-primary)',
                margin: '0 0 16px 0',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                Order Items
              </h3>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {verificationOrder.items.map((item, index) => {
                  const isVerified = verifiedItems.find(verified => verified.stock_id === item.stock_id);
                  return (
                    <div key={item.id} style={{
                      padding: '16px',
                      marginBottom: '12px',
                      background: isVerified ? 'rgba(40, 167, 69, 0.1)' : 'var(--card-bg)',
                      border: isVerified ? '2px solid #28a745' : `1px solid var(--border-color)`,
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '8px'
                        }}>
                          <div style={{
                            color: 'var(--text-primary)',
                            fontSize: '18px',
                            fontWeight: '600'
                          }}>
                            {item.BENZ}
                          </div>
                          {isVerified && (
                            <div style={{
                              color: '#28a745',
                              fontSize: '20px'
                            }}>
                              ✓
                            </div>
                          )}
                        </div>
                        <div style={{
                          color: 'var(--text-secondary)',
                          fontSize: '14px',
                          marginBottom: '4px'
                        }}>
                          {item.BRAND && item.ALTNO ? `${item.BRAND} ${item.ALTNO}` : (item.BRAND || 'No brand')}
                        </div>
                        <div style={{
                          color: 'var(--text-secondary)',
                          fontSize: '14px',
                          marginBottom: '4px'
                        }}>
                          {item.description || 'No description'}
                        </div>
                        <div style={{
                          color: '#ffc107',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: 'rgba(255, 193, 7, 0.2)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          display: 'inline-block'
                        }}>
                          ID: {item.stock_id}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          color: '#28a745',
                          fontSize: '16px',
                          fontWeight: '600',
                          marginBottom: '4px'
                        }}>
                          ₱{formatNumber(Number(item.SELL) * item.quantity)}
                        </div>
                        <div style={{
                          color: 'var(--text-secondary)',
                          fontSize: '14px'
                        }}>
                          Qty: {item.quantity}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={handleReturnToWarehouse}
                style={{
                  background: '#dc3545',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#c82333'}
                onMouseOut={(e) => e.target.style.background = '#dc3545'}
              >
                Return to Warehouse
              </button>
              <button
                onClick={handleProcessVerifiedPayment}
                disabled={verifiedItems.length !== verificationOrder.items.length}
                style={{
                  background: verifiedItems.length === verificationOrder.items.length ? '#28a745' : '#6c757d',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: verifiedItems.length === verificationOrder.items.length ? 'pointer' : 'not-allowed',
                  transition: 'background 0.2s ease'
                }}
                onMouseOver={(e) => {
                  if (verifiedItems.length === verificationOrder.items.length) {
                    e.target.style.background = '#218838';
                  }
                }}
                onMouseOut={(e) => {
                  if (verifiedItems.length === verificationOrder.items.length) {
                    e.target.style.background = '#28a745';
                  }
                }}
              >
                Process Payment ({verifiedItems.length}/{verificationOrder.items.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {showConfirmationModal && selectedOrder && (
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
          zIndex: 4000
        }}>
          <div style={{
            background: 'var(--modal-bg)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            border: '1px solid var(--border-color)',
            boxShadow: '0 10px 40px var(--shadow-lg)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '20px',
              gap: '12px'
            }}>
              <div style={{
                background: '#ffc107',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px'
              }}>
                ⚠️
              </div>
              <h2 style={{
                color: 'var(--text-primary)',
                margin: 0,
                fontSize: '20px',
                fontWeight: '600'
              }}>
                Confirm Payment
              </h2>
            </div>

            {/* Modal Content */}
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px'
            }}>
              <p style={{
                color: 'var(--text-primary)',
                margin: '0 0 16px 0',
                fontSize: '16px',
                fontWeight: '500'
              }}>
                Are you sure you want to process this payment?
              </p>
              
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Order:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{selectedOrder.orderId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Items:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{selectedOrder.items.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Total:</span>
                  <span style={{ color: '#28a745', fontWeight: '600', fontSize: '16px' }}>
                    ₱{formatNumber(calculateTotal())}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Payment Method:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                    {paymentMethod.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Invoice Type:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                    {invoiceType.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Customer:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                    {customerName || 'Walk-in Customer'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span>Invoice #:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                    {invoiceNumber || `AUTO-${Date.now()}`}
                  </span>
                </div>
                
                <div style={{
                  borderTop: `1px solid var(--border-color)`,
                  paddingTop: '12px',
                  color: '#ffc107',
                  fontSize: '13px',
                  fontStyle: 'italic'
                }}>
                  ⚠️ This action cannot be undone.
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={handleCancelPayment}
                style={{
                  background: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#5a6268'}
                onMouseOut={(e) => e.target.style.background = '#6c757d'}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPayment}
                style={{
                  background: '#28a745',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#218838'}
                onMouseOut={(e) => e.target.style.background = '#28a745'}
              >
                Confirm Payment
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
    </>
  );
};

export default Cashier;



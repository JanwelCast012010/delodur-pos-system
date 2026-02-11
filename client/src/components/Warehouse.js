import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { Package, RefreshCw, AlertTriangle, XCircle, Trash2, Plus } from 'lucide-react';
import CustomModal from './CustomModal';
import useCustomModal from '../hooks/useCustomModal';
import { useNotifications } from '../contexts/NotificationContext';

const Warehouse = () => {
  // Custom Modal Hook
  const { modalState, showAlert, showConfirm, closeModal } = useCustomModal();
  const navigate = useNavigate();
  const location = useLocation();
  const { orderCounts, refresh: refreshNotifications } = useNotifications();
  const hasRefreshedOnMountRef = useRef(false);
  const lastCountRef = useRef(0);
  
  // Professional optimizations: Request deduplication and exponential backoff
  const isFetchingRef = useRef(false);
  const backoffDelayRef = useRef(5000);
  const lastEventRefreshRef = useRef(0);
  
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [deletingItem, setDeletingItem] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceOrderId, setServiceOrderId] = useState(null);
  const [requisitionNumber, setRequisitionNumber] = useState('');
  const [requisitionError, setRequisitionError] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [repairOrderNumber, setRepairOrderNumber] = useState('');
  const [customerNameError, setCustomerNameError] = useState('');
  const [plateNumberError, setPlateNumberError] = useState('');
  const [repairOrderError, setRepairOrderError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  // Verification state (moved from Cashier UX)
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verificationOrder, setVerificationOrder] = useState(null);
  const [verifiedItems, setVerifiedItems] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [orderVerifiedMap, setOrderVerifiedMap] = useState({});
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTargetOrder, setEditTargetOrder] = useState(null);
  const [editForm, setEditForm] = useState({ warehouse_no: '', new_id_number: '', qty: '', unit_price: '', reason: 'not_found', notes: '' });
  const [showChangeItemForm, setShowChangeItemForm] = useState(false);
  const [changeItemForm, setChangeItemForm] = useState({ new_id: '', reason: '' });
  const [selectedStockItem, setSelectedStockItem] = useState(null);
  const [stockSearchResults, setStockSearchResults] = useState([]);
  const [stockSearchTerm, setStockSearchTerm] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  // Location modal state
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationModalData, setLocationModalData] = useState({ partNumber: '', locations: [] });
  const [loadingLocations, setLoadingLocations] = useState(false);

  const fetchReservations = async (isRetry = false) => {
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

      console.log('🔍 Fetching warehouse items...');
      const res = await axios.get('/api/warehouse/items', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Warehouse items fetched successfully:', res.data);
      console.log('🔍 First item details:', res.data[0]);
      
      // Debug: Check for duplicate 'no' values
      const noValues = res.data.map(item => item.no);
      const uniqueNoValues = [...new Set(noValues)];
      console.log('🔍 Total items:', res.data.length);
      console.log('🔍 Unique no values:', uniqueNoValues.length);
      console.log('🔍 All no values:', noValues);
      
      if (noValues.length !== uniqueNoValues.length) {
        console.error('⚠️ DUPLICATE no VALUES FOUND!');
        const duplicates = noValues.filter((no, index) => noValues.indexOf(no) !== index);
        console.error('🔍 Duplicate no values:', [...new Set(duplicates)]);
      }
      
      setReservations(res.data);
      
      // Load verification status for all unique orders (optimized - batch request)
      const uniqueOrderIds = [...new Set(res.data.map(item => item.order_id))];
      const verificationMap = {};
      
      if (uniqueOrderIds.length > 0) {
        try {
          const verificationRes = await axios.post('/api/warehouse/verification/batch', 
            { order_ids: uniqueOrderIds },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          // Process batch response
          Object.keys(verificationRes.data).forEach(orderId => {
            const verifiedSet = new Set(
              verificationRes.data[orderId]
                .filter(r => r.verified === 1)
                .map(r => r.warehouse_no)
            );
            verificationMap[orderId] = verifiedSet;
          });
          
          // Initialize empty sets for orders with no verification records
          uniqueOrderIds.forEach(orderId => {
            if (!verificationMap[orderId]) {
              verificationMap[orderId] = new Set();
            }
          });
        } catch (verificationError) {
          console.warn('Failed to load verification status:', verificationError);
          // Initialize empty sets for all orders on error
          uniqueOrderIds.forEach(orderId => {
            verificationMap[orderId] = new Set();
          });
        }
      }
      
      setOrderVerifiedMap(verificationMap);
      console.log('✅ Verification status loaded for all orders');
      // Update last count after successful fetch
      lastCountRef.current = orderCounts.warehouseCount;
      
      // Reset backoff delay on successful request
      backoffDelayRef.current = 5000;
      isFetchingRef.current = false;
    } catch (err) {
      console.error('❌ Warehouse fetch error:', err);
      
      // Professional error handling with exponential backoff
      if (err.response?.status === 429) {
        // Rate limited - implement exponential backoff
        console.warn(`⚠️ Warehouse rate limited (429). Backing off for ${backoffDelayRef.current}ms`);
        
        // Increase backoff delay (exponential: 5s -> 10s -> 20s -> 30s max)
        backoffDelayRef.current = Math.min(backoffDelayRef.current * 2, 30000);
        
        // Retry after backoff delay
        setTimeout(() => {
          fetchReservations(true); // Retry flag
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
        setError(`Failed to fetch orders: ${err.message}`);
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchReservations();
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
      const res = await axios.get('/api/warehouse/items', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update state
      setReservations(res.data);
      
      // Load verification status for all unique orders
      const uniqueOrderIds = [...new Set(res.data.map(item => item.order_id))];
      const verificationMap = {};
      
      if (uniqueOrderIds.length > 0) {
        try {
          const verificationRes = await axios.post('/api/warehouse/verification/batch', 
            { order_ids: uniqueOrderIds },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          Object.keys(verificationRes.data).forEach(orderId => {
            const verifiedSet = new Set(
              verificationRes.data[orderId]
                .filter(r => r.verified === 1)
                .map(r => r.warehouse_no)
            );
            verificationMap[orderId] = verifiedSet;
          });
          
          uniqueOrderIds.forEach(orderId => {
            if (!verificationMap[orderId]) {
              verificationMap[orderId] = new Set();
            }
          });
        } catch (verificationError) {
          console.warn('Failed to load verification status:', verificationError);
          uniqueOrderIds.forEach(orderId => {
            verificationMap[orderId] = new Set();
          });
        }
      }
      
      setOrderVerifiedMap(verificationMap);
      // Update last count after successful silent refetch
      lastCountRef.current = orderCounts.warehouseCount;
      
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
        console.warn(`⚠️ Warehouse silent refetch rate limited (429). Backing off for ${backoffDelayRef.current}ms`);
        
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

  // Handle inline editing
  const handleEditStart = (item, field, currentValue) => {
    setEditingItem(item);
    setEditingField(field);
    setEditValue(currentValue.toString());
  };

  const handleEditCancel = () => {
    setEditingItem(null);
    setEditingField(null);
    setEditValue('');
  };

  const handleEditSave = async () => {
    if (!editingItem || !editingField) return;

    try {
      const token = localStorage.getItem('token');
      const updateData = {
        new_id_number: editingField === 'id_number' ? parseInt(editValue) : editingItem.id_number,
        qty: editingField === 'qty' ? parseInt(editValue) : editingItem.qty
      };

      console.log('🔄 Updating warehouse item:', updateData);

      const response = await axios.put(`/api/warehouse/items/${editingItem.no}`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        // Update the local state with the new item data
        setReservations(prevReservations => {
          return prevReservations.map(item => {
            if (item.no === editingItem.no) {
              return {
                ...item,
                ...response.data.item
              };
            }
            return item;
          });
        });

        console.log('✅ Warehouse item updated successfully');
        // Silent refetch to ensure data is in sync
        silentRefetch();
      }

      handleEditCancel();
    } catch (error) {
      console.error('❌ Update error:', error);
      
      // Show more detailed error message for stock validation
      if (error.response?.data?.error?.includes('Insufficient stock')) {
        const { availableStock, requestedQty } = error.response.data;
        await showAlert(`❌ Insufficient Stock!\n\nAvailable: ${availableStock}\nRequested: ${requestedQty}\n\nPlease reduce the quantity or choose a different item.`, 'Insufficient Stock');
      } else {
        await showAlert(`Failed to update item: ${error.response?.data?.error || error.message}`, 'Error');
      }
      
      handleEditCancel();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleEditSave();
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  const handleDeleteClick = (item) => {
    setDeletingItem(item);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`/api/warehouse/items/${deletingItem.no}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Item deleted successfully:', response.data);
      
      // Show success message with stock restoration info
      await showAlert(`✅ Item deleted successfully!\n\nStock restored: ${response.data.restoredQuantity} units added back to tbl_stock`, 'Success');
      
      // Silent refetch to update data without disrupting user
      await silentRefetch();
      
      // Immediately refresh notification counts (local refresh)
      refreshNotifications();
      
      // Force an additional refresh after a small delay to ensure sync
      setTimeout(() => {
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

  const handleCashierAction = async (orderId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to send this order to Cashier?',
      'Send to Cashier'
    );
    
    if (confirmed) {
      try {
        const token = localStorage.getItem('token');
        // Get the items for this order
        const orderItems = reservations.filter(item => item.order_id === orderId);
        const items = orderItems.map(item => ({
          warehouse_id: item.no,
          stock_id: item.id_number,
          quantity: item.qty
        }));
        
        const response = await axios.post('/api/warehouse/send-to-cashier', 
          { order_id: orderId, items },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        // Dispatch event FIRST to notify other users immediately (before local refresh)
        window.dispatchEvent(new CustomEvent('warehouseOrderSentToCashier', {
          detail: { order_id: orderId }
        }));
        
        // Small delay to ensure event is broadcast, then refresh locally
        setTimeout(() => {
          // Success - refresh warehouse data and notifications
          silentRefetch();
          refreshNotifications();
          
          // Force additional refresh after delay to ensure sync
          setTimeout(() => {
            silentRefetch();
            refreshNotifications();
          }, 500);
        }, 100);
        
        await showAlert('Order sent to cashier successfully!', 'Success');
      } catch (err) {
        // Error occurred - show alert and when user clicks OK, navigate to cashier page
        await showAlert('Failed to send to cashier. The order may have already been sent. Click OK to view Cashier page.', 'Error');
        
        // After user clicks OK, navigate to cashier page to see current state
        navigate('/cashier');
      }
    }
  };

  // Load verification status for an order
  const loadVerificationStatus = async (orderId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/warehouse/verification/${orderId}`, { headers: { Authorization: `Bearer ${token}` } });
      const verifiedSet = new Set(res.data.filter(r => r.verified === 1).map(r => r.warehouse_no));
      setOrderVerifiedMap(prev => ({ ...prev, [orderId]: verifiedSet }));
      return verifiedSet;
    } catch (e) { return new Set(); }
  };

  const openVerifyModal = async (orderId, items) => {
    const set = await loadVerificationStatus(orderId);
    setVerificationOrder({ orderId, items });
    setVerifiedItems(items.filter(i => set.has(i.no)));
    setBarcodeInput('');
    setVerificationError('');
    setShowVerifyModal(true);
  };

  const handleVerifyScan = async (value) => {
    if (!verificationOrder) return;
    const scannedId = parseInt(String(value).trim());
    if (!scannedId) return;
    setVerificationError('');
    const match = verificationOrder.items.find(it => it.id_number === scannedId);
    if (!match) {
      setVerificationError(`Item ID ${scannedId} not found in this order`);
      setBarcodeInput('');
      return;
    }
    if (verifiedItems.some(v => v.no === match.no)) {
      setVerificationError('Item already verified');
      setBarcodeInput('');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/warehouse/verify-item', { warehouse_no: match.no, order_id: verificationOrder.orderId }, { headers: { Authorization: `Bearer ${token}` } });
      const updatedVerifiedItems = [...verifiedItems, match];
      setVerifiedItems(updatedVerifiedItems);
      setOrderVerifiedMap(prev => {
        const set = new Set(prev[verificationOrder.orderId] || []);
        set.add(match.no);
        return { ...prev, [verificationOrder.orderId]: set };
      });
      // Silent refetch to ensure data is in sync
      silentRefetch();
      setBarcodeInput('');
      
      // Check if all items are verified and close modal automatically
      if (updatedVerifiedItems.length === verificationOrder.items.length) {
        setTimeout(() => {
          setShowVerifyModal(false);
          setVerificationOrder(null);
          setVerifiedItems([]);
          setBarcodeInput('');
          setVerificationError('');
        }, 500); // Small delay to show the last item as verified before closing
      }
    } catch (e) {
      setVerificationError('Failed to mark as verified');
    }
  };

  const isOrderFullyVerified = (orderId, items) => {
    const set = orderVerifiedMap[orderId];
    if (!set) return false;
    return items.every(it => set.has(it.no));
  };

  // Auto-close verification modal when all items are verified
  useEffect(() => {
    if (showVerifyModal && verificationOrder && verifiedItems.length > 0) {
      // Check if all items are verified
      if (verifiedItems.length === verificationOrder.items.length) {
        // Close modal after a short delay to show the last item as verified
        const timer = setTimeout(() => {
          setShowVerifyModal(false);
          setVerificationOrder(null);
          setVerifiedItems([]);
          setBarcodeInput('');
          setVerificationError('');
        }, 500);
        
        return () => clearTimeout(timer);
      }
    }
  }, [verifiedItems.length, verificationOrder, showVerifyModal]);

  // Edit modal helpers
  const openEditModal = (orderId, items) => {
    setEditTargetOrder({ orderId, items });
    const first = items[0];
    setEditForm({ warehouse_no: first.no, new_id_number: first.id_number, qty: first.qty, unit_price: first.unit_price || '', reason: 'not_found', notes: '' });
    setShowChangeItemForm(false);
    setChangeItemForm({ new_id: '', reason: '' });
    setSelectedStockItem(null);
    setStockSearchResults([]);
    setStockSearchTerm('');
    setDeleteReason('');
    setShowEditModal(true);
  };

      // Search stock items for change item
    const searchStockItems = async (searchTerm) => {
      if (!searchTerm || searchTerm.length < 1) {
        setStockSearchResults([]);
        setSelectedStockItem(null);
        return;
      }
      
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`/api/stock-items?search=${encodeURIComponent(searchTerm)}&limit=10`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Handle both response.data (array) and response.data.data (wrapped) structures
        const results = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        
        if (results.length > 0) {
          setStockSearchResults(results);
          // If exact ID match found, select it automatically
          const searchNum = parseInt(searchTerm);
          if (!isNaN(searchNum)) {
            const exactMatch = results.find(item => {
              const itemId = item.ID || item.id;
              return itemId === searchNum || itemId === parseInt(searchTerm);
            });
            if (exactMatch) {
              setSelectedStockItem(exactMatch);
            }
          }
        } else {
          setStockSearchResults([]);
        }
      } catch (error) {
        console.error('Error searching stock items:', error);
        setStockSearchResults([]);
      }
    };

      // Handle stock item selection from search
    const handleStockItemSelect = (item) => {
      if (!item) return;
      const itemId = item.ID || item.id;
      if (itemId === undefined || itemId === null) {
        console.error('Item ID is missing:', item);
        return;
      }
      setSelectedStockItem(item);
      setChangeItemForm(prev => ({ ...prev, new_id: String(itemId) }));
      setStockSearchTerm(String(itemId));
      setStockSearchResults([]);
    };

  // Handle Enter key press for ID search
  const handleIdInputKeyPress = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const searchValue = stockSearchTerm.trim();
      if (!searchValue) return;
      
      try {
        const token = localStorage.getItem('token');
        
        // If search value is numeric, try to find by ID first
        const isNumeric = !isNaN(searchValue) && searchValue.trim() !== '';
        let foundItem = null;
        
        if (isNumeric) {
          // Try to get item by ID directly
          try {
            const idResponse = await axios.get(`/api/stock-items?search=${encodeURIComponent(searchValue)}&limit=100`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            // Handle both response.data (array) and response.data.data (wrapped) structures
            const idResults = Array.isArray(idResponse.data) ? idResponse.data : (idResponse.data?.data || []);
            if (idResults.length > 0) {
              // Find exact ID match (check both ID and id fields)
              foundItem = idResults.find(item => 
                item.ID === parseInt(searchValue) || 
                item.id === parseInt(searchValue) ||
                String(item.ID) === searchValue ||
                String(item.id) === searchValue
              );
            }
          } catch (idError) {
            console.error('Error searching by ID:', idError);
          }
        }
        
        // If not found by ID or not numeric, use general search
        if (!foundItem) {
          const response = await axios.get(`/api/stock-items?search=${encodeURIComponent(searchValue)}&limit=100`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          // Handle both response.data (array) and response.data.data (wrapped) structures
          const results = Array.isArray(response.data) ? response.data : (response.data?.data || []);
          
          if (results.length > 0) {
            // If numeric search, try to find exact ID match
            if (isNumeric) {
              foundItem = results.find(item => 
                item.ID === parseInt(searchValue) || 
                item.id === parseInt(searchValue) ||
                String(item.ID) === searchValue ||
                String(item.id) === searchValue
              );
            }
            
                          // If exact match found, select it
              if (foundItem) {
                const itemId = foundItem.ID || foundItem.id;
                if (itemId !== undefined && itemId !== null) {
                  setSelectedStockItem(foundItem);
                  setChangeItemForm(prev => ({ ...prev, new_id: String(itemId) }));
                  setStockSearchTerm(String(itemId));
                  setStockSearchResults([]);
                } else {
                  setStockSearchResults(results);
                }
              } else if (results.length === 1) {
                // If only one result, select it
                const singleItem = results[0];
                const itemId = singleItem.ID || singleItem.id;
                if (itemId !== undefined && itemId !== null) {
                  setSelectedStockItem(singleItem);
                  setChangeItemForm(prev => ({ ...prev, new_id: String(itemId) }));
                  setStockSearchTerm(String(itemId));
                  setStockSearchResults([]);
                } else {
                  setStockSearchResults(results);
                }
              } else {
                // Multiple results, show dropdown
                setStockSearchResults(results);
              }
            } else {
              setStockSearchResults([]);
              setSelectedStockItem(null);
              await showAlert(`No item found with ID: ${searchValue}`, 'Not Found');
            }
          } else {
            // Found by ID, select it
            const itemId = foundItem.ID || foundItem.id;
            if (itemId !== undefined && itemId !== null) {
              setSelectedStockItem(foundItem);
              setChangeItemForm(prev => ({ ...prev, new_id: String(itemId) }));
              setStockSearchTerm(String(itemId));
              setStockSearchResults([]);
            } else {
              setStockSearchResults([]);
              setSelectedStockItem(null);
              await showAlert(`Item found but ID is missing`, 'Error');
            }
          }
      } catch (error) {
        console.error('Error searching stock items:', error);
        setStockSearchResults([]);
        setSelectedStockItem(null);
        await showAlert(`Error searching for item: ${error.response?.data?.message || error.message}`, 'Error');
      }
    }
  };

  // Save changes to current item (quantity and price)
  const handleSaveChanges = async () => {
    if (!editTargetOrder || !editForm.warehouse_no) {
      await showAlert('Please select an item first.', 'No Item Selected');
      return;
    }
    
    const selectedItem = editTargetOrder.items.find(i => i.no === editForm.warehouse_no);
    if (!selectedItem) {
      await showAlert('Selected item not found.', 'Item Not Found');
      return;
    }
    
    const qty = parseInt(editForm.qty);
    const unitPrice = parseFloat(editForm.unit_price);
    
    if (!qty || qty <= 0) {
      await showAlert('Please enter a valid quantity (greater than 0).', 'Invalid Quantity');
      return;
    }
    
    if (unitPrice === undefined || unitPrice === null || unitPrice < 0) {
      await showAlert('Please enter a valid price (0 or greater).', 'Invalid Price');
      return;
    }
    
    const confirmed = await showConfirm(
      `Update item with new quantity and price?\n\nID: ${selectedItem.id_number}\nNew Quantity: ${qty}\nNew Price: ₱${unitPrice.toFixed(2)}`,
      'Confirm Update'
    );
    
    if (!confirmed) return;
    
    try {
      const token = localStorage.getItem('token');
      
      // Update the warehouse item with new quantity and price
      const response = await axios.put(`/api/warehouse/items/${editForm.warehouse_no}`, {
        new_id_number: selectedItem.id_number, // Keep same ID
        qty: qty,
        unit_price: unitPrice
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      if (response.data?.success) {
        silentRefetch();
        setShowEditModal(false);
        await showAlert('Item updated successfully with new quantity and price.', 'Success');
      } else {
        await showAlert(response.data?.error || response.data?.message || 'Failed to update item', 'Error');
      }
    } catch (error) {
      console.error('Update item error:', error);
      await showAlert(
        error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to update item', 
        'Error'
      );
    }
  };

  // Unified delete function - handles both return to stock and report
  const handleDeleteItem = async () => {
    if (!editTargetOrder) {
      await showAlert('No order selected. Please select an order first.', 'Error');
      return;
    }
    
    if (!editForm.warehouse_no || editForm.warehouse_no === '') {
      await showAlert('Please select an item from the dropdown before reporting or deleting.', 'No Item Selected');
      return;
    }
    
    const selectedItem = editTargetOrder.items.find(i => i.no === editForm.warehouse_no);
    if (!selectedItem) {
      await showAlert('Selected item not found in order. Please refresh and try again.', 'Item Not Found');
      return;
    }
    
    const hasReason = deleteReason && deleteReason.trim() !== '';
    const actionText = hasReason ? 'send to discrepancy report' : 'return quantity to stock';
    
    const confirmed = await showConfirm(
      `Are you sure you want to delete this item and ${actionText}?\n\nID: ${selectedItem.id_number}\nPart: ${selectedItem.part_no || 'N/A'}${hasReason ? `\nReason: ${deleteReason}` : ''}`,
      hasReason ? 'Delete Item (Report)' : 'Delete Item (Return to Stock)'
    );
    
    if (!confirmed) return;
    
    try {
      const token = localStorage.getItem('token');
      
      // Delete the warehouse item first (this returns quantity to stock)
      const deleteResponse = await axios.delete(`/api/warehouse/items/${editForm.warehouse_no}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!deleteResponse.data?.success) {
        throw new Error('Failed to delete warehouse item and return quantity to stock');
      }
      
      // If reason is provided, create discrepancy record AFTER successful deletion
      if (hasReason) {
        try {
          await axios.post('/api/warehouse/discrepancies', {
            order_id: editTargetOrder.orderId,
            warehouse_no: editForm.warehouse_no,
            old_stock_id: selectedItem.id_number,
            reason: deleteReason,
            notes: `Item deleted - ${deleteReason}`,
            old_qty: selectedItem.qty,
            new_qty: 0
          }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (discrepancyError) {
          // Even if discrepancy creation fails, the item is already deleted and returned to stock
          console.warn('Failed to create discrepancy record, but item was deleted:', discrepancyError);
          // Don't throw - the main action (delete + return to stock) succeeded
        }
      }
      
      // Refresh data first
      await silentRefetch();
      
      // Check if this was the last item in the order (order should be removed)
      const remainingItems = editTargetOrder.items.filter(i => i.no !== editForm.warehouse_no);
      if (remainingItems.length === 0) {
        // Last item deleted - dispatch event to trigger notification refresh for all users
        window.dispatchEvent(new CustomEvent('warehouseOrderDeleted', {
          detail: { order_id: editTargetOrder.orderId }
        }));
      }
      
      // Immediately refresh notification counts after item deletion (local refresh)
      refreshNotifications();
      
      // Force an additional refresh after a small delay to ensure sync
      setTimeout(() => {
        refreshNotifications();
      }, 500);
      
      setOrderVerifiedMap(prev => {
        const set = new Set(prev[editTargetOrder.orderId] || []);
        set.delete(editForm.warehouse_no);
        return { ...prev, [editTargetOrder.orderId]: set };
      });
      setShowEditModal(false);
      await showAlert(
        hasReason 
          ? `Item deleted successfully. ${selectedItem.qty} unit(s) returned to stock and sent to discrepancy report.` 
          : `Item deleted successfully. ${selectedItem.qty} unit(s) returned to stock.`, 
        'Success'
      );
    } catch (error) {
      console.error('Delete item error:', error);
      await showAlert(
        error.response?.data?.message || error.message || 'Failed to delete item and return quantity to stock', 
        'Error'
      );
    }
  };

  // Save change item (exchange) - send to report
  const saveChangeItem = async () => {
    if (!editTargetOrder || !editForm.warehouse_no || !selectedStockItem) {
      await showAlert('Please select a new item ID', 'Validation Error');
      return;
    }
    
    if (!changeItemForm.reason || changeItemForm.reason.trim() === '') {
      await showAlert('Please select a reason to change the item', 'Validation Error');
      return;
    }
    
          const selectedItem = editTargetOrder.items.find(i => i.no === editForm.warehouse_no);
      if (!selectedItem) return;

      const newItemId = selectedStockItem.ID || selectedStockItem.id;
      if (!newItemId) {
        await showAlert('Selected item has no valid ID', 'Error');
        return;
      }

      // Check if the new ID already exists in the order (excluding the current item being edited)
      const existingItem = editTargetOrder.items.find(i => 
        i.no !== editForm.warehouse_no && i.id_number === parseInt(newItemId)
      );
      
      if (existingItem) {
        await showAlert(
          `This ID (${newItemId}) is already in the order.\n\nYou cannot change an item to an ID that already exists in the order.`,
          'Validation Error'
        );
        return;
      }

      const qtyForConfirm = parseInt(editForm.qty) || parseInt(selectedItem.qty) || 1;
      const priceForConfirm = parseFloat(editForm.unit_price) || parseFloat(selectedStockItem.SELL) || parseFloat(selectedStockItem.unit_price) || 0;
      
      const confirmed = await showConfirm(
        `Change item and send to discrepancy report?\n\nOld ID: ${selectedItem.id_number}\nNew ID: ${newItemId}\nQuantity: ${qtyForConfirm}\nPrice: ₱${priceForConfirm.toFixed(2)}\nReason: ${changeItemForm.reason}`,
        'Change Item (Send to Report)'
      );

      if (!confirmed) return;

              try {
          const token = localStorage.getItem('token');

          // Create discrepancy record for the change (optional - don't fail if this fails)
          try {
            await axios.post('/api/warehouse/discrepancies', {
              order_id: editTargetOrder.orderId,
              warehouse_no: editForm.warehouse_no,
              old_stock_id: selectedItem.id_number,
              new_stock_id: newItemId,
              reason: changeItemForm.reason,
              notes: `Item exchanged - ${changeItemForm.reason}`,
              old_qty: selectedItem.qty,
              new_qty: selectedItem.qty,
              old_price: selectedItem.unit_price || selectedItem.selling_price,
              new_price: selectedStockItem.SELL || selectedStockItem.unit_price
            }, { headers: { Authorization: `Bearer ${token}` } });
          } catch (discrepancyError) {
            console.warn('Failed to create discrepancy record (non-critical):', discrepancyError);
            // Continue anyway - the discrepancy will be created by the server endpoint
          }

        // Update the warehouse item with new ID
        // Use edited quantity and price from form, or fall back to defaults
        const qty = parseInt(editForm.qty) || parseInt(selectedItem.qty) || 1;
        const unitPrice = parseFloat(editForm.unit_price) || parseFloat(selectedStockItem.SELL) || parseFloat(selectedStockItem.unit_price) || 0;
        const newIdNumber = parseInt(newItemId);
        
        if (isNaN(newIdNumber)) {
          await showAlert('Invalid new item ID', 'Validation Error');
          return;
        }
        
        if (isNaN(qty) || qty <= 0) {
          await showAlert('Invalid quantity', 'Validation Error');
          return;
        }
        
        console.log('Updating warehouse item:', {
          warehouse_no: editForm.warehouse_no,
          new_id_number: newIdNumber,
          qty: qty,
          unit_price: unitPrice
        });
        
        const response = await axios.put(`/api/warehouse/items/${editForm.warehouse_no}`, {
          new_id_number: newIdNumber,
          qty: qty,
          unit_price: unitPrice,
          discrepancy_reason: changeItemForm.reason,
          discrepancy_notes: `Item exchanged - ${changeItemForm.reason}`
        }, { headers: { Authorization: `Bearer ${token}` } });
      
              if (response.data?.success) {
          silentRefetch();
          setOrderVerifiedMap(prev => {
            const set = new Set(prev[editTargetOrder.orderId] || []);
            set.delete(editForm.warehouse_no);
            return { ...prev, [editTargetOrder.orderId]: set };
          });
          setShowEditModal(false);
          await showAlert('Item changed and sent to discrepancy report', 'Success');
        } else {
          await showAlert(response.data?.error || response.data?.message || 'Failed to change item', 'Error');
        }
      } catch (error) {
        console.error('Error changing item:', error);
        const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to change item';
        await showAlert(errorMessage, 'Error');
      }
  };

  const handleServiceAction = (orderId) => {
    setServiceOrderId(orderId);
    // Get customer info from the order
    const orderItems = reservations.filter(item => item.order_id === orderId);
    const existingCustomerName = orderItems[0]?.customer_name || '';
    const existingPlateNumber = orderItems[0]?.plate_number || '';
    const existingRepairOrder = orderItems[0]?.repair_order_number || '';
    
    setCustomerName(existingCustomerName);
    setPlateNumber(existingPlateNumber);
    setRepairOrderNumber(existingRepairOrder);
    setRequisitionNumber('');
    setRequisitionError('');
    setCustomerNameError('');
    setPlateNumberError('');
    setRepairOrderError('');
    setShowServiceModal(true);
  };

  const handleServiceModalSubmit = async () => {
    // Clear previous errors
    setRequisitionError('');
    setPlateNumberError('');
    setRepairOrderError('');
    
    // Validate all required fields
    let hasErrors = false;
    
    if (!requisitionNumber.trim()) {
      setRequisitionError('PRF number is required');
      hasErrors = true;
    }
    
    if (!plateNumber.trim()) {
      setPlateNumberError('Vehicle plate number is required');
      hasErrors = true;
    }
    
    if (!repairOrderNumber.trim()) {
      setRepairOrderError('Repair Order (RO #) is required');
      hasErrors = true;
    }
    
    if (hasErrors) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      // Get the items for this order
      const orderItems = reservations.filter(item => item.order_id === serviceOrderId);
      const items = orderItems.map(item => ({
        warehouse_id: item.no,
        stock_id: item.id_number,
        quantity: item.qty
      }));
      
      console.log('🚀 Sending to service:', { 
        requisition_number: requisitionNumber.trim(),
        customer_name: customerName.trim().toUpperCase(),
        plate_number: plateNumber.trim(),
        repair_order_number: repairOrderNumber.trim()
      });
      const response = await axios.post('/api/warehouse/send-to-service', 
        { 
          order_id: serviceOrderId, 
          items,
          requisition_number: requisitionNumber.trim(),
          customer_name: customerName.trim().toUpperCase() || null,
          plate_number: plateNumber.trim() || null,
          repair_order_number: repairOrderNumber.trim() || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('✅ Service submission response:', response.data);
      
      // Close modal and refresh data
      setShowServiceModal(false);
      setServiceOrderId(null);
      setRequisitionNumber('');
      setRequisitionError('');
      setCustomerName('');
      setPlateNumber('');
      setRepairOrderNumber('');
      setCustomerNameError('');
      setPlateNumberError('');
      setRepairOrderError('');
      silentRefetch();
      
      // Show success modal instead of alert
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Service submission error:', err);
      await showAlert('Failed to send to service.', 'Error');
    }
  };

  const handleServiceModalCancel = () => {
    setShowServiceModal(false);
    setServiceOrderId(null);
    setRequisitionNumber('');
    setRequisitionError('');
    setCustomerName('');
    setPlateNumber('');
    setRepairOrderNumber('');
    setCustomerNameError('');
    setPlateNumberError('');
    setRepairOrderError('');
  };

  const handleOrderCardClick = (orderId, items) => {
    setSelectedOrder({ orderId, items });
    setShowOrderModal(true);
  };

  const handleOrderModalClose = () => {
    setShowOrderModal(false);
    setSelectedOrder(null);
  };

  const handlePrintOrder = () => {
    const printWindow = window.open('', '_blank');
    const order = selectedOrder;
    const orderTotal = getOrderTotal(order.items);
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
    const customerName = order.items[0]?.customer_name || 'Walk-in Customer';
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Parts Requisition/Issuance Slip - Order #${order.orderId}</title>
        <style>
          @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none !important; }
            @page { 
              margin: 0.2cm 0.3cm; 
              size: letter portrait;
            }
            .container { 
              width: 100%;
              max-width: 100%;
              margin: 0;
              padding: 8px;
              page-break-inside: avoid;
              box-shadow: none;
              border-radius: 0;
            }
          }
          * { box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0;
            padding: 10px;
            background: #f5f5f5;
            line-height: 1.4;
          }
          .container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            padding: 12px;
            max-width: 100%;
            margin: 0 auto;
            width: 100%;
          }
          .header-section {
            border-bottom: 3px solid #000;
            padding-bottom: 8px;
            margin-bottom: 10px;
          }
          .company-info {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 6px;
          }
          .company-name {
            font-size: 22px;
            font-weight: 900;
            color: #000;
            letter-spacing: 0.5px;
            margin: 0;
          }
          .company-address {
            font-size: 8px;
            color: #666;
            margin-top: 2px;
          }
          .order-info {
            text-align: right;
            background: #000;
            color: white;
            padding: 7px 12px;
            border-radius: 4px;
            font-size: 10px;
          }
          .order-info div {
            margin: 2px 0;
          }
          .order-date {
            font-size: 12px;
            font-weight: bold;
            color: white;
          }
          .order-id {
            font-size: 16px;
            font-weight: bold;
            color: white;
            margin-top: 4px;
          }
          .document-title {
            text-align: center;
            font-size: 14px;
            font-weight: 700;
            color: #000;
            margin: 10px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 12px;
            font-size: 10px;
          }
          .info-item {
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .info-label {
            font-weight: 600;
            color: #000;
            min-width: 50px;
            font-size: 10px;
          }
          .info-value {
            flex: 1;
            border-bottom: 1px solid #000;
            padding-bottom: 2px;
            color: #000;
          }
          .transaction-badges {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
          }
          .badge {
            padding: 4px 10px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: 600;
            border: 1.5px solid #ccc;
            background: #f9f9f9;
          }
          .badge.checked {
            background: #1a1a1a;
            color: white;
            border-color: #1a1a1a;
          }
          .parts-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
            font-size: 10px;
            border: 2px solid #000;
          }
          .parts-table thead {
            background: #000;
            color: white;
          }
          .parts-table th {
            padding: 8px 6px;
            text-align: center;
            font-weight: 700;
            font-size: 10px;
            border: 1px solid #000;
          }
          .parts-table td {
            padding: 7px 6px;
            border: 1px solid #000;
            font-size: 10px;
            color: #000;
          }
          .parts-table tbody tr:nth-child(even) {
            background: #f9f9f9;
          }
          .parts-table tbody tr:hover {
            background: #f0f0f0;
          }
          .col-no { width: 5%; text-align: center; }
          .col-qty { width: 6%; text-align: center; font-weight: 600; }
          .col-partno { width: 16%; font-family: 'Courier New', monospace; }
          .col-id { width: 11%; font-family: 'Courier New', monospace; color: #000; font-weight: 900; font-size: 10.5px; }
          .col-desc { width: 28%; }
          .col-price { width: 13%; text-align: right; font-weight: 600; color: #000; }
          .col-location { width: 11%; font-size: 9px; color: #000; }
          .col-remarks { width: 10%; font-size: 9px; }
          .signature-section {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-top: 12px;
            padding-top: 10px;
            border-top: 2px solid #000;
          }
          .signature-box {
            text-align: center;
            padding: 8px;
            border: 1px dashed #000;
            border-radius: 4px;
            min-height: 50px;
          }
          .signature-label {
            font-size: 8px;
            font-weight: 600;
            color: #000;
            margin-bottom: 10px;
            text-transform: uppercase;
          }
          .signature-line {
            border-top: 1px solid #000;
            margin-top: 14px;
            padding-top: 5px;
            font-size: 7px;
            color: #666;
          }
          .total-section {
            margin-top: 10px;
            padding-top: 8px;
            border-top: 2px solid #000;
            text-align: right;
            font-size: 10px;
          }
          .total-label {
            font-weight: 700;
            color: #000;
            margin-right: 12px;
          }
          .total-value {
            font-weight: 900;
            font-size: 13px;
            color: #000;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header Section -->
          <div class="header-section">
            <div class="company-info">
              <div>
                <div class="company-name">DELODUR CORP.</div>
                <div class="company-address">#10 Calle Industria Bagumbayan, Quezon City</div>
              </div>
              <div class="order-info">
                <div class="order-date"><strong>Date:</strong> ${formattedDate}</div>
                <div class="order-id">SI#: ${order.orderId}</div>
              </div>
            </div>
          </div>
          
          <!-- Document Title -->
          <div class="document-title">Parts Requisition / Issuance Slip</div>
          
          <!-- Transaction Type & Customer Info -->
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Customer:</span>
              <span class="info-value">${customerName}</span>
            </div>
            <div class="transaction-badges">
              <span class="badge">☐ Counter</span>
              <span class="badge">☐ Service</span>
            </div>
          </div>
          
          <!-- Parts Table -->
          <table class="parts-table">
            <thead>
              <tr>
                <th class="col-no">#</th>
                <th class="col-qty">Qty</th>
                <th class="col-partno">Part Number</th>
                <th class="col-id">ID Number</th>
                <th class="col-desc">Description</th>
                <th class="col-price">Unit Price</th>
                <th class="col-location">Location</th>
                <th class="col-remarks">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map((item, index) => {
                const rowNumber = index + 1;
                const partNo = item.part_no || '';
                const idNumber = item.id_number || item.no || '';
                const description = (item.description || 'No description').substring(0, 35);
                const qty = item.qty || 0;
                const unitPrice = item.selling_price || item.unit_price || 0;
                const location = item.location && item.location.trim() && item.location.trim().toLowerCase() !== 'location not indicated' 
                  ? item.location.trim() 
                  : '';
                const remarks = '';
                
                if (index < 10) {
                  return `
                    <tr>
                      <td class="col-no">${rowNumber}</td>
                      <td class="col-qty">${qty}</td>
                      <td class="col-partno">${partNo}</td>
                      <td class="col-id">${idNumber}</td>
                      <td class="col-desc">${description}</td>
                      <td class="col-price">₱${formatNumber(unitPrice)}</td>
                      <td class="col-location">${location}</td>
                      <td class="col-remarks">${remarks}</td>
                    </tr>
                  `;
                }
                return '';
              }).join('')}
              ${Array(Math.max(0, 10 - order.items.length)).fill(0).map(() => `
                <tr>
                  <td class="col-no"></td>
                  <td class="col-qty"></td>
                  <td class="col-partno"></td>
                  <td class="col-id"></td>
                  <td class="col-desc"></td>
                  <td class="col-price"></td>
                  <td class="col-location"></td>
                  <td class="col-remarks"></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <!-- Total Section -->
          <div class="total-section">
            <span class="total-label">TOTAL AMOUNT:</span>
            <span class="total-value">₱${formatNumber(orderTotal)}</span>
          </div>
          
          <!-- Signature Sections -->
          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-label">Requested by</div>
              <div class="signature-line">Signature over printed name</div>
            </div>
            <div class="signature-box">
              <div class="signature-label">Issued by</div>
              <div class="signature-line">Signature over printed name</div>
            </div>
            <div class="signature-box">
              <div class="signature-label">Received by</div>
              <div class="signature-line">Signature over printed name</div>
            </div>
          </div>
        </div>
        
        <div class="no-print" style="margin-top: 30px; text-align: center;">
          <button onclick="window.print()" style="padding: 12px 24px; font-size: 16px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; margin-right: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">🖨️ Print Order</button>
          <button onclick="window.close()" style="padding: 12px 24px; font-size: 16px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">✕ Close</button>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCancelOrder = async (orderId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to cancel this order?',
      'Cancel Order'
    );
    
    if (confirmed) {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.post('/api/warehouse/order/cancel', 
          { order_id: orderId, reason: 'Cancelled by user' },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        // Only proceed if cancellation was successful
        if (response.data.success) {
          // Silent refetch data first
          await silentRefetch();
          
          // Then immediately refresh notification counts (local refresh)
          refreshNotifications();
          
          // Dispatch event to trigger notification refresh for all users
          window.dispatchEvent(new CustomEvent('warehouseOrderDeleted', {
            detail: { order_id: orderId }
          }));
          
          // Force an additional refresh after a small delay to ensure sync
          setTimeout(() => {
            refreshNotifications();
          }, 500);
        }
      } catch (err) {
        await showAlert('Failed to cancel order.', 'Error');
      }
    }
  };

  const formatNumber = (num) => {
    return Number(num).toLocaleString('en-US', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    });
  };

  const getOrderTotal = (items) => {
    return items.reduce((sum, item) => sum + (Number(item.unit_price) * Number(item.qty)), 0);
  };

  // Group items by order_id
  const groupedOrders = reservations.reduce((acc, item) => {
    if (!acc[item.order_id]) {
      acc[item.order_id] = [];
    }
    acc[item.order_id].push(item);
    return acc;
  }, {});

  useEffect(() => {
    fetchReservations();
    hasRefreshedOnMountRef.current = false; // Reset when component mounts/navigates
    lastCountRef.current = orderCounts.warehouseCount;
    
    // Check if we're returning from adding items to order
    const searchParams = new URLSearchParams(location.search);
    const addedToOrder = searchParams.get('addedToOrder');
    const orderId = searchParams.get('orderId');
    
    if (addedToOrder === 'true' && orderId) {
      // Show success message
      showAlert(`Items successfully added to Order #${orderId}!`, 'Success');
      // Clean up URL
      navigate('/warehouses', { replace: true });
    }
  }, [location]);

  // Listen for notification count changes and refresh if on this page
  useEffect(() => {
    const handleWarehouseCountChange = (event) => {
      // Refresh if count changed (increased OR decreased) and we're on this page
      const newCount = event.detail?.count || orderCounts.warehouseCount;
      if (location.pathname === '/warehouses' && newCount !== lastCountRef.current) {
        const countChange = newCount - lastCountRef.current;
        console.log(`🔄 Warehouse order count changed (${countChange > 0 ? '+' : ''}${countChange}), refreshing data...`);
        lastCountRef.current = newCount;
        throttledSilentRefetch(); // Use throttled version
      }
    };

    const handleWarehouseOrderDeleted = () => {
      // When an order is deleted (by any user), refresh data and notifications
      if (location.pathname === '/warehouses') {
        console.log('🔄 Warehouse order deleted by another user, refreshing...');
        throttledSilentRefetch(); // Use throttled version
        refreshNotifications();
      }
    };

    const handleWarehouseOrderSentToCashier = (event) => {
      // When an order is sent to cashier (by any user), refresh data (throttled)
      if (location.pathname === '/warehouses') {
        const orderId = event.detail?.order_id;
        console.log('🔄 Warehouse order sent to cashier by another user, refreshing...', orderId ? `Order ID: ${orderId}` : '');
        
        // Single throttled refresh (removed multiple setTimeout calls to prevent request bursts)
        throttledSilentRefetch();
        refreshNotifications();
      }
    };

    const handleCashierOrderReturnedToWarehouse = () => {
      // When an order is returned from cashier to warehouse (by any user), refresh data (throttled)
      if (location.pathname === '/warehouses') {
        console.log('🔄 Order returned to warehouse from cashier by another user, refreshing...');
        throttledSilentRefetch(); // Use throttled version (removed multiple setTimeout calls)
        refreshNotifications();
      }
    };

    window.addEventListener('warehouseOrderCountChanged', handleWarehouseCountChange);
    window.addEventListener('warehouseOrderDeleted', handleWarehouseOrderDeleted);
    window.addEventListener('warehouseOrderSentToCashier', handleWarehouseOrderSentToCashier);
    window.addEventListener('cashierOrderReturnedToWarehouse', handleCashierOrderReturnedToWarehouse);
    
    return () => {
      window.removeEventListener('warehouseOrderCountChanged', handleWarehouseCountChange);
      window.removeEventListener('warehouseOrderDeleted', handleWarehouseOrderDeleted);
      window.removeEventListener('warehouseOrderSentToCashier', handleWarehouseOrderSentToCashier);
      window.removeEventListener('cashierOrderReturnedToWarehouse', handleCashierOrderReturnedToWarehouse);
    };
  }, [location.pathname, orderCounts.warehouseCount, refreshNotifications]);

  // Watch for warehouse count changes and refresh when count decreases (order sent to cashier)
  useEffect(() => {
    if (location.pathname === '/warehouses' && !loading) {
      const currentCount = orderCounts.warehouseCount;
      const previousCount = lastCountRef.current;
      
      // Only refresh if count actually decreased (not on initial load)
      // previousCount > 0 ensures we don't trigger on initial mount
      if (previousCount > 0 && currentCount < previousCount) {
        const decreaseAmount = previousCount - currentCount;
        console.log(`🔄 Warehouse count decreased from ${previousCount} to ${currentCount} (${decreaseAmount} order(s) removed), refreshing data...`);
        
        // Immediate refresh
        silentRefetch();
        
        // Force additional refreshes after delays to ensure sync
        setTimeout(() => {
          silentRefetch();
        }, 300);
        
        setTimeout(() => {
          silentRefetch();
        }, 1000);
      }
      
      // Update the ref to track current count (only if it changed)
      if (currentCount !== previousCount) {
        lastCountRef.current = currentCount;
      }
    }
  }, [orderCounts.warehouseCount, location.pathname, loading]);

  // Refresh once when navigating to this page if badge shows orders but data is empty
  useEffect(() => {
    // Only check once when navigating to the page, not on every render
    if (location.pathname === '/warehouses' && !hasRefreshedOnMountRef.current) {
      if (orderCounts.warehouseCount > 0) {
        // Wait a bit for initial data to load, then check if we need to refresh
        const timeoutId = setTimeout(() => {
          if (reservations.length === 0 && !loading) {
            console.log('🔄 Badge shows orders but data is empty, refreshing...');
            silentRefetch();
          }
          hasRefreshedOnMountRef.current = true; // Mark as checked
        }, 1000); // Wait 1 second after navigation

        return () => clearTimeout(timeoutId);
      } else {
        hasRefreshedOnMountRef.current = true; // Mark as checked even if no orders
      }
    }
  }, [location.pathname]); // Only depend on pathname, not other values

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
      {/* Header */}
      <div style={{ 
        background: 'var(--card-bg)', 
        padding: '20px', 
        borderRadius: '12px', 
        marginBottom: '20px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ 
            color: 'var(--text-primary)', 
            margin: 0, 
            fontSize: '28px', 
            fontWeight: 'bold'
          }}>
            Warehouse Orders
          </h1>
          <p style={{ 
            color: 'var(--text-secondary)', 
            margin: '8px 0 0 0', 
            fontSize: '16px' 
          }}>
            Manage incoming orders from counter
          </p>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            background: '#007bff',
            color: '#fff',
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
          onMouseOver={(e) => e.target.style.background = '#0056b3'}
          onMouseOut={(e) => e.target.style.background = '#007bff'}
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
          border: '1px solid var(--border-color)'
        }}>
          <RefreshCw size={48} style={{ animation: 'spin 1s linear infinite', color: '#007bff' }} />
          <p style={{ color: 'var(--text-secondary)', margin: '20px 0 0 0', fontSize: '18px' }}>Loading orders...</p>
        </div>
      ) : error ? (
        <div style={{ 
          background: 'var(--card-bg)', 
          padding: '60px', 
          borderRadius: '12px', 
          textAlign: 'center',
          border: '1px solid var(--border-color)'
        }}>
          <AlertTriangle size={48} style={{ color: '#dc3545' }} />
          <p style={{ color: '#dc3545', margin: '20px 0 0 0', fontSize: '18px' }}>{error}</p>
          <button
            onClick={handleRefresh}
            style={{
              background: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              marginTop: '20px',
              fontWeight: '600',
              fontSize: '14px',
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
          <Package size={64} style={{ color: 'var(--text-muted)', marginBottom: '20px' }} />
          <h3 style={{ color: 'var(--text-secondary)', margin: '0 0 16px 0', fontSize: '24px' }}>No Orders Found</h3>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '16px' }}>Orders will appear here when submitted from the counter</p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', 
          gap: '24px'
        }}>
          {Object.entries(groupedOrders).reverse().map(([orderId, items]) => {
            const itemCount = items.length;
            
            return (
                  <div key={orderId} style={{
                    background: 'var(--card-bg)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: '500px'
                }}>
                  
                                   {/* Order Header */}
                  <div style={{
                    background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
                    color: '#fff',
                    padding: '20px 24px',
                    position: 'relative',
                    flexShrink: 0
                  }}>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        width: '100%'
                      }}>
                        {/* Row 1: Status (left) | Date (right) */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          width: '100%'
                        }}>
                          <div>
                            {(() => {
                              const verifiedCount = orderVerifiedMap[orderId]?.size || 0;
                              const isFullyVerified = isOrderFullyVerified(orderId, items);
                              const isPartiallyVerified = verifiedCount > 0 && !isFullyVerified;
                              
                              if (isFullyVerified) {
                                return (
                                  <div style={{
                                    background: 'rgba(40, 167, 69, 0.9)',
                                    color: '#fff',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                  }}>
                                    <span>✓</span>
                                    <span>VERIFIED</span>
                                  </div>
                                );
                              } else if (isPartiallyVerified) {
                                return (
                                  <div style={{
                                    background: 'rgba(255, 193, 7, 0.9)',
                                    color: '#000',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                  }}>
                                    <span>{verifiedCount}/{itemCount}</span>
                                    <span>VERIFIED</span>
                                  </div>
                                );
                              } else {
                                return (
                                  <div style={{
                                    background: 'rgba(220, 53, 69, 0.9)',
                                    color: '#fff',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                  }}>
                                    <span>PENDING</span>
                                  </div>
                                );
                              }
                            })()}
                          </div>
                          <div style={{
                            fontSize: '14px',
                            color: '#e3f2fd',
                            fontWeight: '500'
                          }}>
                            {new Date(items[0]?.created_at).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </div>
                        </div>
                        
                        {/* Row 2: Customer Name (left) | Order # (right) */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          width: '100%'
                        }}>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start'
                          }}>
                            <div style={{
                              fontSize: '18px',
                              fontWeight: 'bold',
                              color: '#fff',
                              marginBottom: '2px'
                            }}>
                              {items[0]?.customer_name ? items[0].customer_name.toUpperCase() : 'No Customer Name'}
                            </div>
                            <div style={{
                              fontSize: '11px',
                              fontWeight: '400',
                              color: '#e3f2fd',
                              opacity: 0.8
                            }}>
                              Customer name
                            </div>
                          </div>
                          <div style={{
                            fontSize: '26px',
                            fontWeight: 'bold',
                            color: '#fff'
                          }}>
                            Order #{orderId}
                          </div>
                        </div>
                      </div>
                  </div>

                  {/* Order Items */}
                  <div style={{ 
                    padding: '20px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    minHeight: 0
                  }}>
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{
                        color: 'var(--text-primary)',
                        margin: '0 0 16px 0',
                        fontSize: '18px',
                        fontWeight: '600'
                      }}>
                        Items
                      </h4>
                    </div>
                    
                    <div style={{ 
                      maxHeight: '300px', 
                      overflowY: 'auto',
                      flex: 1,
                      minHeight: 0
                    }}>
                      {items.map((item, index) => (
                      <div key={item.no} style={{
                        padding: '16px',
                        marginBottom: '12px',
                        borderBottom: '1px solid var(--border-color)'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: '8px'
                        }}>
                          <div style={{
                            color: 'var(--text-primary)',
                            fontSize: '22px',
                            fontWeight: '600',
                            textAlign: 'left'
                          }}>
                            <a
                              href={`https://www.google.com/search?q=${encodeURIComponent(item.part_no)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: '#007bff',
                                textDecoration: 'none',
                                cursor: 'pointer',
                                transition: 'color 0.2s ease',
                                borderBottom: '1px dotted #007bff'
                              }}
                              onMouseOver={(e) => e.target.style.color = '#0056b3'}
                              onMouseOut={(e) => e.target.style.color = '#007bff'}
                              title={`Search "${item.part_no}" on Google`}
                            >
                              {item.part_no}
                            </a>
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
                              textAlign: 'right',
                              padding: '4px 8px',
                              borderRadius: '4px'
                            }}>
                              {item.id_number}
                            </div>
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-end',
                          marginBottom: '4px'
                        }}>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start'
                          }}>
                            <div style={{
                              color: 'var(--text-primary)',
                              fontSize: '16px',
                              fontWeight: '600',
                              marginBottom: '2px'
                            }}>
                              {item.brand && item.altno ? `${item.brand} ${item.altno}` : (item.brand || 'No brand')}
                            </div>
                            <div style={{
                              color: 'var(--text-secondary)',
                              fontSize: '14px',
                              marginBottom: '4px'
                            }}>
                              {item.description || 'No description'}
                            </div>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            {/* Price Display */}
                            <div style={{
                              background: '#28a745',
                              color: '#fff',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              fontSize: '14px',
                              fontWeight: '600',
                              minWidth: '80px',
                              textAlign: 'center'
                            }}>
                              ₱{formatNumber(item.selling_price || 0)}
                            </div>
                            {/* Quantity Display */}
                            <div style={{
                              background: '#007bff',
                              color: '#fff',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              fontSize: '14px',
                              fontWeight: '600',
                              minWidth: '40px',
                              textAlign: 'center'
                            }}
                            title={`Quantity: ${item.qty} (Available in stock: ${item.stock_qty || 'Unknown'})`}
                          >
                            {item.qty}
                          </div>
                        </div>
                        </div>
                        <div style={{
                          color: '#007bff',
                          fontSize: '13px',
                          fontWeight: '500'
                        }}>
                          <span 
                            onClick={async () => {
                              if (!item.part_no) return;
                              setLoadingLocations(true);
                              setShowLocationModal(true);
                              setLocationModalData({ partNumber: item.part_no, locations: [] });
                              
                              try {
                                const token = localStorage.getItem('token');
                                const response = await axios.get(`/api/warehouse/part-locations/${encodeURIComponent(item.part_no)}`, {
                                  headers: { Authorization: `Bearer ${token}` }
                                });
                                
                                if (response.data.success) {
                                  setLocationModalData({
                                    partNumber: item.part_no,
                                    locations: response.data.locations || []
                                  });
                                } else {
                                  setLocationModalData({
                                    partNumber: item.part_no,
                                    locations: []
                                  });
                                }
                              } catch (error) {
                                console.error('Error fetching locations:', error);
                                setLocationModalData({
                                  partNumber: item.part_no,
                                  locations: []
                                });
                              } finally {
                                setLoadingLocations(false);
                              }
                            }}
                            style={{ 
                              color: (item.location && item.location.trim() && item.location.trim().toLowerCase() !== 'location not indicated') ? '#4CAF50' : '#f44336',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              textDecorationStyle: 'dotted'
                            }}
                            title="Click to view all locations for this part"
                          >
                            {item.location && item.location.trim() ? item.location : 'Location not indicated'}
                          </span>
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>

                  {/* Order Total */}
                  <div style={{
                    padding: '20px 24px',
                    marginTop: 'auto',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0,
                    borderTop: '1px solid var(--border-color)'
                  }}>
                    <div style={{
                      color: 'var(--text-primary)',
                      fontSize: '16px',
                      fontWeight: '600'
                    }}>
                      Order Total:
                    </div>
                    <div style={{
                      color: '#28a745',
                      fontSize: '18px',
                      fontWeight: 'bold'
                    }}>
                      ₱{formatNumber(getOrderTotal(items))}
                    </div>
                  </div>

                  {/* Action Buttons (Pending vs Verified) */}
                  <div style={{ padding: '0 24px 20px 24px', display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCancelOrder(orderId); }}
                      style={{ flex: 1, background: '#dc3545', color: '#fff', border: 'none', padding: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '600', borderRadius: '4px' }}
                    >CANCEL ORDER</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal(orderId, items); }}
                      style={{ flex: 1, background: '#17a2b8', color: '#fff', border: 'none', padding: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '600', borderRadius: '4px' }}
                    >EDIT</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOrderCardClick(orderId, items); }}
                      style={{ flex: 1, background: '#6c757d', color: '#fff', border: 'none', padding: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '600', borderRadius: '4px' }}
                    >VIEW</button>
                    {!isOrderFullyVerified(orderId, items) ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); openVerifyModal(orderId, items); }}
                        style={{ flex: 1, background: '#007bff', color: '#fff', border: 'none', padding: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '600', borderRadius: '4px' }}
                      >VERIFY</button>
                    ) : (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCashierAction(orderId); }}
                          style={{ flex: 1, background: '#28a745', color: '#fff', border: 'none', padding: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '600', borderRadius: '4px' }}
                        >CASHIER</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleServiceAction(orderId); }}
                          style={{ flex: 1, background: '#ffc107', color: '#000', border: 'none', padding: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '600', borderRadius: '4px' }}
                        >SERVICE</button>
                      </>
                    )}
                  </div>
                </div>
            );
          })}
        </div>
      )}

      {/* Verify Modal */}
      {showVerifyModal && verificationOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', width: '800px', maxWidth: '95%', maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 8px 32px var(--shadow-lg)' }}>
            <div style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Verify Order #{verificationOrder.orderId}</h3>
                <div style={{ opacity: 0.85, fontSize: '12px', color: 'var(--text-muted)' }}>{verifiedItems.length} / {verificationOrder.items.length} verified</div>
              </div>
              <button onClick={() => setShowVerifyModal(false)} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer' }}>Close</button>
            </div>
            <div style={{ padding: '16px 20px', background: 'var(--card-bg)' }}>
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleVerifyScan(barcodeInput); } }}
                placeholder="Scan barcode or type item ID..."
                style={{ width: '100%', padding: '12px', background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
              />
              {verificationError && (
                <div style={{ color: '#dc3545', marginTop: '8px', fontSize: '12px' }}>{verificationError}</div>
              )}
              <div style={{ marginTop: '16px', maxHeight: '50vh', overflowY: 'auto' }}>
                {verificationOrder.items.map(item => {
                  const isVerified = verifiedItems.some(v => v.no === item.no);
                  return (
                    <div key={item.no} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border-color)', background: isVerified ? 'rgba(40,167,69,0.1)' : 'transparent' }}>
                      <div style={{ color: 'var(--text-primary)' }}>
                        <div style={{ fontWeight: 700 }}>{item.part_no}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID: {item.id_number} • Qty: {item.qty}</div>
                      </div>
                      <div>
                        {isVerified ? (
                          <span style={{ background: '#28a745', color: '#fff', borderRadius: '12px', padding: '4px 10px', fontSize: '12px', fontWeight: 700 }}>Verified</span>
                        ) : (
                          <button onClick={() => handleVerifyScan(item.id_number)} style={{ background: '#007bff', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontWeight: 600 }}>Verify</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editTargetOrder && (
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
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{ 
            background: 'var(--card-bg)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '12px', 
            width: showChangeItemForm ? '1400px' : '700px',
            maxWidth: 'calc(100% - 40px)', 
            overflow: 'hidden',
            transition: 'width 0.3s ease-in-out, transform 0.3s ease-in-out',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '90vh',
            transform: showChangeItemForm ? 'translateX(50px)' : 'translateX(0px)' // Shift right when expanded for better visual centering
          }}>
            <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Edit Order #{editTargetOrder.orderId}</h3>
            </div>
            <div style={{ 
              padding: '16px 20px', 
              background: 'var(--card-bg)',
              display: 'flex',
              gap: '20px',
              flex: 1,
              overflow: 'auto',
              alignItems: 'flex-start'
            }}>
              {/* Left Side - Original Item & Form */}
              <div style={{ 
                flex: showChangeItemForm ? '0 0 48%' : '1',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'auto',
                minWidth: 0
              }}>
                {/* Spacer to align with right side ID input when Change Item is active */}
                {showChangeItemForm && (
                  <div style={{ marginBottom: '16px', height: '54px' }}>
                    {/* Empty spacer matching ID input field height (label ~18px + input ~40px + margin ~6px = ~64px total, adjusted to 54px for visual alignment) */}
                  </div>
                )}
                
                {/* Item Information Display - Compact Card Style */}
                {(() => {
                  const selectedItem = editTargetOrder.items.find(i => i.no === editForm.warehouse_no);
                  if (selectedItem) {
                    const formatNumber = (num) => {
                      return parseFloat(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    };
                    
                    return (
                      <div style={{
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '12px',
                        marginBottom: '16px'
                      }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: '600' }}>
                          Current Item Information
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              <a
                                href={`https://www.google.com/search?q=${encodeURIComponent(selectedItem.part_no || '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: '#007bff',
                                  fontSize: '22px',
                                  fontWeight: '600',
                                  textDecoration: 'none',
                                  display: 'inline-block',
                                  marginBottom: '6px',
                                  borderBottom: '1px dotted #007bff',
                                  width: 'fit-content'
                                }}
                                title={`Search "${selectedItem.part_no}" on Google`}
                              >
                                {selectedItem.part_no || 'N/A'}
                              </a>
                              <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', marginBottom: '2px' }}>
                                {selectedItem.brand && selectedItem.altno ? `${selectedItem.brand} ${selectedItem.altno}` : (selectedItem.brand || 'No brand')}
                              </div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>
                                {selectedItem.description || 'No description'}
                              </div>
                            </div>
                                                          <div style={{ fontSize: '11px', marginTop: 'auto' }}>
                                <span style={{ 
                                  color: (selectedItem.location && selectedItem.location.trim() && selectedItem.location.trim().toLowerCase() !== 'location not indicated') ? '#4CAF50' : '#f44336',
                                  fontWeight: '500'
                                }}>
                                  {selectedItem.location && selectedItem.location.trim() ? selectedItem.location : 'Location not indicated'}
                                </span>
                              </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', marginLeft: '12px', marginTop: '-8px' }}>
                            <div style={{
                              color: 'var(--text-primary)',
                              fontWeight: '700',
                              fontSize: '28px',
                              textAlign: 'right',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'var(--bg-tertiary)'
                            }}>
                              {selectedItem.id_number || 'N/A'}
                            </div>
                            <div>
                              <div style={{
                                background: '#28a745',
                                color: '#fff',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                fontWeight: '600',
                                whiteSpace: 'nowrap',
                                textAlign: 'right',
                                minWidth: '80px',
                                marginBottom: '4px'
                              }}>
                                ₱{formatNumber(selectedItem.selling_price || selectedItem.unit_price || 0)}
                              </div>
                              <div style={{
                                background: '#007bff',
                                color: '#fff',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                fontWeight: '600',
                                whiteSpace: 'nowrap',
                                textAlign: 'right',
                                minWidth: '80px'
                              }}>
                                Qty: {selectedItem.qty || '0'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              
                {/* Main Form Section */}
                <div style={{ marginBottom: '16px' }}>
                  {/* Row 1: Select Item | Reason (Reason hidden when Change Item is active) */}
                  <div style={{ display: 'grid', gridTemplateColumns: showChangeItemForm ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ color: 'var(--text-primary)', fontSize: '12px', marginBottom: '6px', display: 'block', fontWeight: 500 }}>Select Item</label>
                      <select 
                        value={editForm.warehouse_no} 
                        onChange={(e) => {
                          const w = parseInt(e.target.value);
                          const it = editTargetOrder.items.find(i => i.no === w);
                          setEditForm({ warehouse_no: w, new_id_number: it.id_number, qty: it.qty, unit_price: it.unit_price || it.selling_price || '', reason: 'not_found', notes: '' });
                          setShowChangeItemForm(false);
                          setSelectedStockItem(null);
                          setChangeItemForm({ new_id: '', reason: '' });
                          setStockSearchTerm('');
                          setDeleteReason('');
                        }} 
                        style={{ width: '100%', padding: '10px', background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                      >
                        {editTargetOrder.items.map(i => (
                          <option key={i.no} value={i.no}>ID {i.id_number}</option>
                        ))}
                      </select>
                    </div>
                    {!showChangeItemForm && (
                      <div>
                        <label style={{ color: 'var(--text-primary)', fontSize: '12px', marginBottom: '6px', display: 'block', fontWeight: 500 }}>Reason</label>
                        <select 
                          value={deleteReason} 
                          onChange={(e) => setDeleteReason(e.target.value)} 
                          style={{ 
                            width: '100%',
                            padding: '10px', 
                            background: 'var(--input-bg)', 
                            color: 'var(--text-primary)', 
                            border: '1px solid var(--border-color)', 
                            borderRadius: '8px' 
                          }}
                        >
                          <option value="">-- None --</option>
                          <option value="not_found">Not Found</option>
                          <option value="broken">Defective</option>
                          <option value="wrong_item_picked">Wrong Content</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Row 2: Quantity | Price */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ color: 'var(--text-primary)', fontSize: '12px', marginBottom: '6px', display: 'block', fontWeight: 500 }}>Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={editForm.qty || ''}
                        onChange={(e) => {
                          const qty = parseInt(e.target.value) || '';
                          setEditForm({ ...editForm, qty });
                        }}
                        style={{ 
                          width: '100%',
                          padding: '10px', 
                          background: 'var(--input-bg)', 
                          color: 'var(--text-primary)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                        placeholder="Enter quantity"
                      />
                    </div>
                    <div>
                      <label style={{ color: 'var(--text-primary)', fontSize: '12px', marginBottom: '6px', display: 'block', fontWeight: 500 }}>Price</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.unit_price || ''}
                        onChange={(e) => {
                          const unit_price = parseFloat(e.target.value) || '';
                          setEditForm({ ...editForm, unit_price });
                        }}
                        style={{ 
                          width: '100%',
                          padding: '10px', 
                          background: 'var(--input-bg)', 
                          color: 'var(--text-primary)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                        placeholder="Enter price"
                      />
                    </div>
                  </div>

                  {/* Row 3: Save Changes | Delete | Change Item | Add Item | Close */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <button 
                      onClick={handleSaveChanges}
                      disabled={showChangeItemForm}
                      style={{ 
                        flex: 1,
                        background: showChangeItemForm ? '#6c757d' : '#28a745', 
                        color: '#fff', 
                        border: 'none', 
                        padding: '10px 16px', 
                        borderRadius: '8px', 
                        cursor: showChangeItemForm ? 'not-allowed' : 'pointer', 
                        fontWeight: 600, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        gap: '6px',
                        opacity: showChangeItemForm ? 0.6 : 1
                      }}
                    >
                      Save Changes
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => {
                        // Navigate to stock page with addToOrder parameter
                        navigate(`/stock?addToOrder=${editTargetOrder.orderId}`);
                        setShowEditModal(false);
                      }}
                      disabled={showChangeItemForm}
                      style={{ 
                        flex: 1,
                        background: showChangeItemForm ? '#6c757d' : '#17a2b8', 
                        color: '#fff', 
                        border: 'none', 
                        padding: '10px 16px', 
                        borderRadius: '8px', 
                        cursor: showChangeItemForm ? 'not-allowed' : 'pointer', 
                        fontWeight: 600, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        gap: '6px',
                        opacity: showChangeItemForm ? 0.6 : 1
                      }}
                    >
                      <Plus size={16} />
                      Add Item
                    </button>
                    <button 
                      onClick={handleDeleteItem}
                      disabled={showChangeItemForm}
                      style={{ 
                        flex: 1,
                        background: showChangeItemForm ? '#6c757d' : '#dc3545', 
                        color: '#fff', 
                        border: 'none', 
                        padding: '10px 16px', 
                        borderRadius: '8px', 
                        cursor: showChangeItemForm ? 'not-allowed' : 'pointer', 
                        fontWeight: 600, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        gap: '6px',
                        opacity: showChangeItemForm ? 0.6 : 1
                      }}
                    >
                      <Trash2 size={16} />
                      {deleteReason && deleteReason.trim() !== '' ? 'Report' : 'Return to Stock'}
                    </button>
                    <button 
                      onClick={() => {
                        setShowChangeItemForm(!showChangeItemForm);
                        if (!showChangeItemForm) {
                          setSelectedStockItem(null);
                          setChangeItemForm({ new_id: '', reason: '' });
                          setStockSearchTerm('');
                        }
                      }} 
                      style={{ 
                        flex: 1,
                        background: '#17a2b8', 
                        color: '#fff', 
                        border: 'none', 
                        padding: '10px 16px', 
                        borderRadius: '8px', 
                        cursor: 'pointer', 
                        fontWeight: 600,
                        fontSize: '14px'
                      }}
                    >
                      Change Item
                    </button>
                    <button 
                      onClick={() => setShowEditModal(false)} 
                      style={{ 
                        flex: 1,
                        background: 'var(--bg-tertiary)', 
                        color: 'var(--text-primary)', 
                        border: '1px solid var(--border-color)', 
                        padding: '10px 16px', 
                        borderRadius: '8px', 
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => e.target.style.background = 'var(--hover-bg)'}
                      onMouseOut={(e) => e.target.style.background = 'var(--bg-tertiary)'}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Side - Change Item Comparison View */}
              {showChangeItemForm && (
                <div style={{ 
                  flex: '0 0 48%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderLeft: '2px solid var(--border-color)',
                  paddingLeft: '20px',
                  overflow: 'auto',
                  minWidth: 0
                }}>
                  {/* ID Input - Compact at top, positioned to align cards */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ color: 'var(--text-primary)', fontSize: '12px', marginBottom: '6px', display: 'block', fontWeight: 500 }}>New/Exchange ID (Press Enter)</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={stockSearchTerm}
                        onChange={(e) => {
                          const value = e.target.value;
                          setStockSearchTerm(value);
                          if (value) {
                            searchStockItems(value);
                          } else {
                            setStockSearchResults([]);
                            setSelectedStockItem(null);
                          }
                        }}
                        onKeyPress={handleIdInputKeyPress}
                        placeholder="Type ID and press Enter..."
                        style={{ 
                          width: '100%', 
                          padding: '10px', 
                          background: 'var(--input-bg)', 
                          color: 'var(--text-primary)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '8px' 
                        }}
                      />
                      {stockSearchResults.length > 0 && !selectedStockItem && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: 'var(--card-bg)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          marginTop: '4px',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          zIndex: 100,
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                        }}>
                                                      {stockSearchResults.map(item => {
                              const itemId = item.ID || item.id || 'N/A';
                              return (
                                <div
                                  key={itemId}
                                  onClick={() => handleStockItemSelect(item)}
                                  style={{
                                    padding: '10px',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)'
                                  }}
                                  onMouseOver={(e) => e.target.style.background = 'var(--hover-bg)'}
                                  onMouseOut={(e) => e.target.style.background = 'transparent'}
                                >
                                  ID {itemId} - {item.BENZ || item.ALTNO || 'N/A'} - {item.BRAND || 'N/A'}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* New Item Information Display (Same format as original) - Aligned with left side */}
                  {selectedStockItem && (() => {
                    const selectedItem = editTargetOrder.items.find(i => i.no === editForm.warehouse_no);
                    const formatNumber = (num) => {
                      return parseFloat(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    };
                    
                    return (
                      <div style={{
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '12px',
                        marginBottom: '16px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              <a
                                href={`https://www.google.com/search?q=${encodeURIComponent(selectedStockItem.BENZ || '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: '#007bff',
                                  fontSize: '22px',
                                  fontWeight: '600',
                                  textDecoration: 'none',
                                  display: 'inline-block',
                                  marginBottom: '6px',
                                  borderBottom: '1px dotted #007bff',
                                  width: 'fit-content'
                                }}
                                title={`Search "${selectedStockItem.BENZ}" on Google`}
                              >
                                {selectedStockItem.BENZ || 'N/A'}
                              </a>
                              <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', marginBottom: '2px' }}>
                                {selectedStockItem.BRAND && selectedStockItem.ALTNO ? `${selectedStockItem.BRAND} ${selectedStockItem.ALTNO}` : (selectedStockItem.BRAND || 'No brand')}
                              </div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>
                                {selectedStockItem.DESCRIPTION || selectedStockItem.REMARKS || 'No description'}
                              </div>
                            </div>
                                                          <div style={{ fontSize: '11px', marginTop: 'auto' }}>
                                <span style={{ 
                                  color: (selectedStockItem.LOCATION && selectedStockItem.LOCATION.trim() && selectedStockItem.LOCATION.trim().toLowerCase() !== 'location not indicated') ? '#4CAF50' : '#f44336',
                                  fontWeight: '500'
                                }}>
                                  {selectedStockItem.LOCATION && selectedStockItem.LOCATION.trim() ? selectedStockItem.LOCATION : 'Location not indicated'}
                                </span>
                              </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', marginLeft: '12px', marginTop: '-8px' }}>
                            <div style={{
                              color: 'var(--text-primary)',
                              fontWeight: '700',
                              fontSize: '28px',
                              textAlign: 'right',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'var(--bg-tertiary)'
                            }}>
                              {(selectedStockItem.ID || selectedStockItem.id) || 'N/A'}
                            </div>
                            <div>
                              <div style={{
                                background: '#28a745',
                                color: '#fff',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                fontWeight: '600',
                                whiteSpace: 'nowrap',
                                textAlign: 'right',
                                minWidth: '80px',
                                marginBottom: '4px'
                              }}>
                                ₱{formatNumber(selectedStockItem.SELL || 0)}
                              </div>
                              <div style={{
                                background: '#007bff',
                                color: '#fff',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                fontWeight: '600',
                                whiteSpace: 'nowrap',
                                textAlign: 'right',
                                minWidth: '80px'
                              }}>
                                Qty: {selectedItem?.qty || '0'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Reason Dropdown (Required for Change Item) */}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ color: 'var(--text-primary)', fontSize: '12px', marginBottom: '6px', display: 'block', fontWeight: 500 }}>
                      Reason <span style={{ color: '#dc3545' }}>*</span>
                    </label>
                    <select 
                      value={changeItemForm.reason} 
                      onChange={(e) => setChangeItemForm(prev => ({ ...prev, reason: e.target.value }))} 
                      style={{ 
                        width: '100%',
                        padding: '10px', 
                        background: 'var(--input-bg)', 
                        color: 'var(--text-primary)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '8px' 
                      }}
                    >
                      <option value="">-- Select Reason --</option>
                      <option value="not_found">Not Found</option>
                      <option value="broken">Defective</option>
                      <option value="wrong_item_picked">Wrong Content</option>
                      <option value="substituted">Substituted</option>
                    </select>
                  </div>

                  {/* Save Button */}
                  <button 
                    onClick={saveChangeItem} 
                    style={{ 
                      width: '100%',
                      background: (selectedStockItem && changeItemForm.reason) ? '#28a745' : '#6c757d', 
                      color: '#fff', 
                      border: 'none', 
                      padding: '12px', 
                      borderRadius: '8px', 
                      cursor: (selectedStockItem && changeItemForm.reason) ? 'pointer' : 'not-allowed', 
                      fontWeight: 700,
                      fontSize: '14px'
                    }}
                    disabled={!selectedStockItem || !changeItemForm.reason}
                  >
                    Save Change & Send to Report
                  </button>
                </div>
              )}
            </div>
          </div>
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
            background: 'var(--card-bg)',
            padding: '30px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            maxWidth: '400px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 8px 32px var(--shadow-lg)'
          }}>
            <XCircle size={48} style={{ color: '#dc3545', marginBottom: '20px' }} />
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '16px', fontSize: '20px' }}>
              Delete Item
            </h3>
            <p style={{ color: 'var(--text-primary)', marginBottom: '24px', lineHeight: '1.5' }}>
              Are you sure you want to delete this item from the warehouse order?
            </p>
            <div style={{
              background: 'var(--bg-tertiary)',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '16px',
              border: '1px solid #28a745',
              borderLeft: '4px solid #28a745'
            }}>
              <div style={{ color: '#28a745', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                ✓ Stock will be restored
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                {deletingItem.qty} units will be added back to tbl_stock
              </div>
            </div>
            <div style={{
              background: 'var(--bg-tertiary)',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '24px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: '600', marginBottom: '8px' }}>
                {deletingItem.part_no}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                {deletingItem.brand && deletingItem.altno ? `${deletingItem.brand} ${deletingItem.altno}` : (deletingItem.brand || 'No brand')}
              </div>
              <div style={{ color: '#007bff', fontSize: '14px', marginTop: '4px' }}>
                Qty: {deletingItem.qty}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={handleDeleteCancel}
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = 'var(--hover-bg)'}
                onMouseOut={(e) => e.target.style.background = 'var(--bg-tertiary)'}
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

      {/* Service Modal */}
      {showServiceModal && (
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
            background: 'var(--card-bg)',
            padding: '30px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            maxWidth: '600px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 8px 32px var(--shadow-lg)'
          }}>
            <h3 style={{ 
              color: 'var(--text-primary)', 
              marginBottom: '24px', 
              fontSize: '24px',
              fontWeight: 'bold'
            }}>
              Part Requisition Form
            </h3>
            
            <div style={{ marginBottom: '20px' }}>
              {/* Row 1: NAME (display) | VEHICLE PLATE # (input) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginBottom: '20px'
              }}>
                {/* NAME Field (Display Only) */}
                <div>
                  <label style={{
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '8px',
                    display: 'block'
                  }}>
                    NAME:
                  </label>
                  <div style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    minHeight: '40px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    {customerName ? customerName.toUpperCase() : 'No Customer Name'}
                  </div>
                </div>
                
                {/* VEHICLE PLATE # Input */}
                <div>
                  <label style={{
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '8px',
                    display: 'block'
                  }}>
                    VEHICLE PLATE #: <span style={{ color: '#dc3545' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={plateNumber}
                    onChange={(e) => {
                      setPlateNumber(e.target.value);
                      setPlateNumberError('');
                    }}
                    placeholder="Enter plate number"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: plateNumberError ? '2px solid #dc3545' : '1px solid var(--border-color)',
                      background: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  {plateNumberError && (
                    <div style={{
                      color: '#dc3545',
                      fontSize: '12px',
                      marginTop: '4px'
                    }}>
                      {plateNumberError}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: PRF # (input) | RO # (input) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginBottom: '20px'
              }}>
                {/* PRF # Input */}
                <div>
                  <label style={{
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '8px',
                    display: 'block'
                  }}>
                    PRF #: <span style={{ color: '#dc3545' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={requisitionNumber}
                    onChange={(e) => {
                      setRequisitionNumber(e.target.value);
                      setRequisitionError('');
                    }}
                    placeholder="Enter PRF number"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: requisitionError ? '2px solid #dc3545' : '1px solid var(--border-color)',
                      background: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    autoFocus
                  />
                  {requisitionError && (
                    <div style={{
                      color: '#dc3545',
                      fontSize: '12px',
                      marginTop: '4px'
                    }}>
                      {requisitionError}
                    </div>
                  )}
                </div>
                
                {/* RO # Input */}
                <div>
                  <label style={{
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '8px',
                    display: 'block'
                  }}>
                    RO #: <span style={{ color: '#dc3545' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={repairOrderNumber}
                    onChange={(e) => {
                      setRepairOrderNumber(e.target.value);
                      setRepairOrderError('');
                    }}
                    placeholder="Enter Repair Order #"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: repairOrderError ? '2px solid #dc3545' : '1px solid var(--border-color)',
                      background: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  {repairOrderError && (
                    <div style={{
                      color: '#dc3545',
                      fontSize: '12px',
                      marginTop: '4px'
                    }}>
                      {repairOrderError}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              justifyContent: 'center',
              marginTop: '24px'
            }}>
              <button
                onClick={handleServiceModalCancel}
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  transition: 'background-color 0.2s',
                  minWidth: '120px'
                }}
                onMouseOver={(e) => e.target.style.background = 'var(--hover-bg)'}
                onMouseOut={(e) => e.target.style.background = 'var(--bg-tertiary)'}
              >
                Cancel
              </button>
              <button
                onClick={handleServiceModalSubmit}
                style={{
                  background: '#28a745',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  transition: 'background-color 0.2s',
                  minWidth: '120px'
                }}
                onMouseOver={(e) => e.target.style.background = '#218838'}
                onMouseOut={(e) => e.target.style.background = '#28a745'}
              >
                Submit to Service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#2d2d2d',
            borderRadius: '16px',
            border: '1px solid #404040',
            padding: '32px',
            maxWidth: '400px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px auto'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20,6 9,17 4,12"></polyline>
              </svg>
            </div>
            <h3 style={{
              color: '#fff',
              margin: '0 0 16px 0',
              fontSize: '24px',
              fontWeight: '700'
            }}>
              Success!
            </h3>
            <p style={{
              color: '#b0b0b0',
              margin: '0 0 32px 0',
              fontSize: '16px',
              lineHeight: '1.5'
            }}>
              Order sent to service successfully!
            </p>
            <button
              onClick={() => setShowSuccessModal(false)}
              style={{
                background: '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 32px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = '#218838'}
              onMouseOut={(e) => e.target.style.background = '#28a745'}
            >
              OK
            </button>
          </div>
        </div>
      )}

              {/* Order Details Modal */}
        {showOrderModal && selectedOrder && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: '250px',
            right: 0,
            bottom: 0,
            background: 'var(--modal-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
                        <div style={{
                background: 'var(--card-bg)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                maxWidth: '1350px',
                width: '95%',
                maxHeight: '90vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
              color: '#fff',
              padding: '20px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
                  Order #{selectedOrder.orderId}
                </h2>
                <p style={{ margin: '8px 0 0 0', fontSize: '16px', opacity: 0.9 }}>
                  {selectedOrder.items.length} items • {new Date(selectedOrder.items[0]?.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={handleOrderModalClose}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '24px',
                  cursor: 'pointer',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px'
            }}>
              {/* Order Summary */}
              <div style={{
                background: 'var(--bg-tertiary)',
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                  color: 'var(--text-primary)'
                }}>
                  <div>
                    <strong style={{ color: '#007bff' }}>Total Items:</strong><br />
                    {selectedOrder.items.length} items
                  </div>
                  <div>
                    <strong style={{ color: '#28a745' }}>Total Value:</strong><br />
                    ₱{formatNumber(getOrderTotal(selectedOrder.items))}
                  </div>
                  <div>
                    <strong style={{ color: '#ffc107' }}>Date Created:</strong><br />
                    {new Date(selectedOrder.items[0]?.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '16px', fontSize: '18px' }}>
                Items to Pick:
              </h3>
              
                              <div style={{
                  background: 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  overflowX: 'auto',
                  overflowY: 'auto',
                  maxHeight: '50vh'
                }}>
                  <table style={{
                    width: '100%',
                    minWidth: '1200px',
                    borderCollapse: 'collapse',
                    color: 'var(--text-primary)'
                  }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>#</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>ID</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Part Number</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Brand</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Alt No</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Description</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: '600' }}>Qty</th>
                      <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '600' }}>Price</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((item, index) => (
                      <tr key={item.no} style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background 0.2s ease'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '12px', fontSize: '14px', fontWeight: '600', color: '#007bff' }}>
                          {index + 1}
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', fontWeight: '600', color: '#dc3545' }}>
                          {item.id_number || item.no || 'N/A'}
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>
                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(item.part_no)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#007bff',
                              textDecoration: 'none',
                              cursor: 'pointer',
                              transition: 'color 0.2s ease',
                              borderBottom: '1px dotted #007bff',
                              fontWeight: '600'
                            }}
                            onMouseOver={(e) => e.target.style.color = '#0056b3'}
                            onMouseOut={(e) => e.target.style.color = '#007bff'}
                            title={`Search "${item.part_no}" on Google`}
                          >
                            {item.part_no}
                          </a>
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-primary)' }}>
                          {item.brand || 'N/A'}
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-primary)' }}>
                          {item.altno || 'N/A'}
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-primary)', maxWidth: '200px' }}>
                          <div style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            title: item.description || 'No description'
                          }}>
                            {item.description || 'No description'}
                          </div>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px' }}>
                          <span style={{
                            background: '#007bff',
                            color: '#fff',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {item.qty}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#28a745' }}>
                          ₱{formatNumber(item.selling_price || 0)}
                        </td>
                                                  <td style={{ padding: '12px', fontSize: '14px', color: (item.location && item.location.trim() && item.location.trim().toLowerCase() !== 'location not indicated') ? '#4CAF50' : '#f44336' }}>
                            {item.location && item.location.trim() ? item.location : 'Location not indicated'}
                          </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '20px 24px',
              background: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={handleOrderModalClose}
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  transition: 'background 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = 'var(--hover-bg)'}
                onMouseOut={(e) => e.target.style.background = 'var(--bg-tertiary)'}
              >
                Close
              </button>
              <button
                onClick={handlePrintOrder}
                style={{
                  background: '#28a745',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  transition: 'background 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseOver={(e) => e.target.style.background = '#218838'}
                onMouseOut={(e) => e.target.style.background = '#28a745'}
              >
                🖨️ Print Order
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
    </div>

    {/* Location Modal */}
    {showLocationModal && (
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
        zIndex: 10000,
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowLocationModal(false);
        }
      }}
      >
        <div style={{
          background: '#1a1a1a',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          border: '2px solid #404040',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
        }}
        onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid #404040',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h2 style={{
              color: '#fff',
              fontSize: '20px',
              fontWeight: '600',
              margin: 0
            }}>
              Part Locations
            </h2>
            <button
              onClick={() => setShowLocationModal(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '0',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'background 0.2s ease'
              }}
              onMouseOver={(e) => e.target.style.background = '#404040'}
              onMouseOut={(e) => e.target.style.background = 'transparent'}
            >
              ×
            </button>
          </div>

          {/* Modal Body */}
          <div style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1
          }}>
            {loadingLocations ? (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '40px',
                color: 'var(--text-primary)'
              }}>
                <div style={{
                  display: 'inline-block',
                  width: '20px',
                  height: '20px',
                  border: '3px solid var(--border-color)',
                  borderTop: '3px solid #007bff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <span style={{ marginLeft: '12px' }}>Loading locations...</span>
              </div>
            ) : locationModalData.locations.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: 'var(--text-muted)'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📍</div>
                <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-primary)' }}>No locations found</div>
                <div style={{ fontSize: '14px', marginTop: '8px', color: 'var(--text-muted)' }}>
                  No locations available for part number: <strong style={{ color: 'var(--text-primary)' }}>{locationModalData.partNumber}</strong>
                </div>
              </div>
            ) : (
              <div>
                <div style={{
                  marginBottom: '16px',
                  padding: '12px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>Part Number</div>
                  <div style={{ color: '#007bff', fontSize: '16px', fontWeight: '600' }}>
                    {locationModalData.partNumber}
                  </div>
                </div>

                <div style={{
                  marginBottom: '12px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  Locations ({locationModalData.locations.length}):
                </div>

                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid var(--border-color)'
                }}>
                  <thead>
                    <tr style={{
                      background: 'var(--bg-secondary)',
                      borderBottom: '2px solid var(--border-color)'
                    }}>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        fontWeight: '600',
                        width: '35%'
                      }}>
                        BENZ PART NO
                      </th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        fontWeight: '600',
                        width: '25%'
                      }}>
                        BRAND
                      </th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        fontWeight: '600',
                        width: '40%'
                      }}>
                        LOCATION
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {locationModalData.locations.map((loc, index) => (
                      <tr
                        key={index}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.target.parentElement.style.background = 'var(--hover-bg)'}
                        onMouseLeave={(e) => e.target.parentElement.style.background = 'transparent'}
                      >
                        <td style={{
                          padding: '12px',
                          color: '#007bff',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}>
                          {loc.part_number || locationModalData.partNumber}
                        </td>
                        <td style={{
                          padding: '12px',
                          color: 'var(--text-primary)',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}>
                          {loc.brand || 'N/A'}
                        </td>
                        <td style={{
                          padding: '12px',
                          color: '#4CAF50',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}>
                          {loc.location}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'var(--bg-secondary)'
          }}>
            <button
              onClick={() => setShowLocationModal(false)}
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                padding: '10px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'background 0.2s ease'
              }}
              onMouseOver={(e) => e.target.style.background = 'var(--hover-bg)'}
              onMouseOut={(e) => e.target.style.background = 'var(--bg-tertiary)'}
            >
              Close
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

export default Warehouse; 
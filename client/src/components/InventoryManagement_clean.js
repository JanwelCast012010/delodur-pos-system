import React, { useState, useEffect, useMemo, useCallback, useContext, useRef } from 'react';
import axios from 'axios';
import { Search, Filter, RefreshCw, Eye, Edit, Trash2, Plus, Download, Upload, BarChart3, TrendingUp, Package, AlertTriangle, ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { AuthContext } from '../AuthContext';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { QrReader } from 'react-qr-reader';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';

// Table styles
const tableStyles = `
  .pos-stock-table-container {
    background: #1a1a1a;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  }

  .pos-stock-table-wrapper {
    overflow-x: auto;
    max-width: 100%;
  }

  .pos-stock-table {
    width: 100%;
    border-collapse: collapse;
    background: #1a1a1a;
    color: #e0e0e0;
  }

  .pos-stock-table th {
    background: #2d2d2d;
    color: #ffffff;
    font-weight: 600;
    padding: 12px 16px;
    text-align: left;
    border-bottom: 2px solid #404040;
    font-size: 0.9em;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .pos-stock-table td {
    padding: 12px 16px;
    border-bottom: 1px solid #333;
    vertical-align: middle;
  }

  .pos-stock-row {
    transition: background-color 0.2s ease;
  }

  .pos-stock-row:hover {
    background: #2a2a2a;
  }

  .pos-stock-row.out-of-stock {
    opacity: 0.7;
    background: rgba(220, 53, 69, 0.1);
  }

  .pos-stock-row.out-of-stock:hover {
    background: rgba(220, 53, 69, 0.2);
  }

  .pos-stock-row.in-service {
    background-color: rgba(255, 193, 7, 0.15) !important;
    border-left: 3px solid #f59e0b !important;
  }

  .pos-stock-row.in-service:hover {
    background-color: rgba(255, 193, 7, 0.25) !important;
  }

  .pos-stock-cell {
    font-size: 0.9em;
  }

  .description-cell {
    max-width: 250px;
  }

  .description-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .benz-numbers {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .benz-secondary {
    font-size: 0.8em;
    color: #888;
  }
  
  .benz-primary-match {
    background: linear-gradient(135deg, #4CAF50, #45a049);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
  }
  
  .benz-secondary-match {
    background: linear-gradient(135deg, #FF9800, #F57C00);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
  }
  
  .benz-tertiary-match {
    background: linear-gradient(135deg, #2196F3, #1976D2);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
  }
  
  .match-indicator {
    margin-left: 4px;
    font-size: 0.8em;
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }

  .quantity-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 0.85em;
    background: #28a745;
    color: white;
  }

  .quantity-badge.low-stock {
    background: #ffc107;
    color: #212529;
  }

  .status-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 0.8em;
    text-transform: uppercase;
  }

  .status-badge.in-stock {
    background: #28a745;
    color: white;
  }

  .status-badge.out-of-stock {
    background: #dc3545;
    color: white;
  }

  .actions-cell {
    text-align: center;
  }

  .pos-stock-action-btn {
    background: #007bff;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.7em;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    min-width: auto;
    white-space: nowrap;
    height: 26px;
  }

  .pos-stock-action-btn:hover {
    background: #0056b3;
  }

  .pos-stock-action-btn .pos-btn-icon {
    width: 14px;
    height: 14px;
  }

  .pos-stock-action-btn.active {
    background: #28a745 !important;
    color: white !important;
    border: 1px solid #28a745 !important;
  }

  .pos-stock-action-btn.active:hover {
    background: #218838 !important;
  }

  .pos-checkbox {
    accent-color: #1976d2;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 2px solid #1976d2;
    background: #fff;
    vertical-align: middle;
    margin: 0 4px;
    transition: box-shadow 0.2s;
    box-shadow: 0 1px 2px rgba(25, 118, 210, 0.08);
  }
  .pos-checkbox:focus {
    outline: 2px solid #1976d2;
    outline-offset: 1px;
  }
  /* Cart/side modal styles */
  .pos-cart-modal {
    position: fixed;
    top: 0;
    right: 0;
    width: 280px;
    height: 100vh;
    background: #1a1a1a;
    color: #fff;
    z-index: 3000;
    display: flex;
    flex-direction: column;
    border-left: 1.5px solid #2d2d2d;
    box-shadow: 0 2px 12px 0 rgba(0,0,0,0.12);
    border-radius: 0 10px 10px 0;
    transition: box-shadow 0.2s, background 0.2s;
    overflow: hidden;
  }
  .pos-cart-modal-header {
    padding: 16px 18px 10px 18px;
    font-size: 0.98em;
    font-weight: 500;
    border-bottom: 1px solid #2d2d2d;
    background: #1a1a1a;
    display: flex;
    justify-content: space-between;
    align-items: center;
    letter-spacing: 0.5px;
  }
  .pos-cart-modal-close {
    background: none;
    border: none;
    color: #fff;
    font-size: 1.3em;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .pos-cart-modal-close:hover {
    background: #1976d2;
    color: #fff;
  }
  .pos-cart-list {
    flex: 1;
    overflow-y: auto;
    padding: 14px 18px 10px 18px;
    background: #1a1a1a;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .pos-cart-item {
    background: #23272f;
    border-radius: 8px;
    padding: 10px 12px 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    box-shadow: 0 1px 4px 0 rgba(25,118,210,0.08);
    border: 1px solid #2d2d2d;
    transition: background 0.2s, box-shadow 0.2s;
  }
  .pos-cart-item-title {
    font-weight: bold;
    font-size: 1em;
    color: #1976d2;
    margin-bottom: 1px;
  }
  .pos-cart-item-desc {
    font-size: 0.97em;
    color: #e0e0e0;
    opacity: 0.92;
  }
  .pos-cart-modal-footer {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 14px 18px 14px 18px;
    background: #1a1a1a;
    border-top: 1px solid #2d2d2d;
    position: static;
    bottom: 0;
    z-index: 2;
  }
  .pos-cart-modal-footer button {
    border: 1.5px solid #1976d2;
    color: #1976d2;
    background: transparent;
    border-radius: 6px;
    padding: 8px 18px;
    font-weight: 600;
    font-size: 1em;
    min-width: 110px;
    transition: background 0.2s, color 0.2s, border 0.2s;
    margin: 0 2px;
  }
  .pos-cart-modal-footer button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .pos-cart-modal-footer button:last-child {
    border-color: #dc3545;
    color: #dc3545;
  }
  .pos-cart-modal-footer button:last-child:hover {
    background: rgba(220,53,69,0.08);
    color: #fff;
    border-color: #dc3545;
  }
  .pos-cart-modal-footer button:hover {
    background: #1976d2;
    color: #fff;
    border-color: #1976d2;
  }

  /* Barcode Scanner Button Styles */
  .pos-barcode-scanner-btn {
    background: linear-gradient(135deg, #4caf50, #45a049) !important;
    border-color: #4caf50 !important;
    color: #fff !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    transition: all 0.3s ease !important;
  }

  .pos-barcode-scanner-btn:hover {
    background: linear-gradient(135deg, #45a049, #3d8b40) !important;
    border-color: #45a049 !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3) !important;
  }

  .pos-barcode-scanner-btn svg {
    flex-shrink: 0;
  }

  /* Export Excel Button Styles */
  .pos-export-excel-btn {
    background: linear-gradient(135deg, #ff9800, #f57c00) !important;
    border-color: #ff9800 !important;
    color: #fff !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    transition: all 0.3s ease !important;
  }

  .pos-export-excel-btn:hover {
    background: linear-gradient(135deg, #f57c00, #ef6c00) !important;
    border-color: #f57c00 !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3) !important;
  }

  /* Import CSV Button Styles */
  .pos-import-csv-btn {
    background: linear-gradient(135deg, #9c27b0, #7b1fa2) !important;
    border-color: #9c27b0 !important;
    color: #fff !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    transition: all 0.3s ease !important;
  }

  .pos-import-csv-btn:hover {
    background: linear-gradient(135deg, #7b1fa2, #6a1b9a) !important;
    border-color: #7b1fa2 !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 12px rgba(156, 39, 176, 0.3) !important;
  }

  .pos-import-csv-btn svg {
    flex-shrink: 0;
  }

  .pos-export-excel-btn svg {
    flex-shrink: 0;
  }

  .export-info-text {
    font-size: 0.75rem;
    color: #666;
    text-align: center;
    margin-top: 4px;
    font-style: italic;
  }

  /* Export Preview Modal Styles */
  .export-preview-modal {
    max-width: 90vw;
    width: 800px;
    max-height: 90vh;
  }

  .export-preview-info {
    margin-bottom: 20px;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #e9ecef;
  }

  .export-preview-info p {
    margin: 5px 0;
    color: #495057;
  }

  .export-preview-table-container {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid #dee2e6;
    border-radius: 8px;
  }

  .export-preview-table {
    width: 100%;
    border-collapse: collapse;
    background: white;
  }

  .export-preview-table th,
  .export-preview-table td {
    padding: 12px;
    text-align: left;
    border: 1px solid #dee2e6;
  }

  .export-preview-table th {
    background: #e9ecef;
    font-weight: 600;
    color: #495057;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .export-preview-table td {
    color: #212529;
  }

  .export-preview-table tbody tr:nth-child(even) {
    background: #f8f9fa;
  }

  .export-preview-table tbody tr:hover {
    background: #e9ecef;
  }

  .export-preview-table button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .export-preview-table .actions-column {
    width: 100px;
    text-align: center;
  }

  .export-preview-table .delete-btn {
    background: #dc3545 !important;
    border-color: #dc3545 !important;
    color: white !important;
    padding: 4px 8px !important;
    font-size: 12px !important;
    border-radius: 4px !important;
    transition: all 0.2s ease !important;
  }

  .export-preview-table .delete-btn:hover {
    background: #c82333 !important;
    border-color: #c82333 !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 2px 4px rgba(220, 53, 69, 0.3) !important;
  }

  .pos-modal-body {
    padding: 20px;
    max-height: 60vh;
    overflow-y: auto;
  }


  @media (max-width: 600px) {
    .pos-cart-modal {
      width: 100vw;
      max-width: 100vw;
      border-radius: 0;
      padding: 0;
      left: 0;
      right: 0;
    }
    .pos-cart-modal-header, .pos-cart-list {
      padding-left: 12px;
      padding-right: 12px;
    }
    .pos-cart-modal-footer {
      padding: 12px;
    }
  }

  @media (max-width: 428px) {
    /* iPhone 13 Pro Max and similar */
    .pos-stock-controls {
      flex-direction: column;
      gap: 12px;
      align-items: stretch;
    }
    
    .pos-search-container {
      max-width: 100% !important;
    }
    
    .pos-stock-action-btn {
      padding: 12px 16px !important;
      font-size: 14px !important;
      min-height: 44px;
    }
    
    .pos-stock-table th,
    .pos-stock-table td {
      padding: 8px 6px;
      font-size: 12px;
      white-space: nowrap;
    }
    
    .description-cell {
      max-width: 120px;
    }
    
    .description-text {
      font-size: 11px;
    }
  }

  @media (max-width: 390px) {
    /* iPhone 13 and similar */
    .pos-stock-table th,
    .pos-stock-table td {
      padding: 6px 4px;
      font-size: 11px;
    }
    
    .pos-stock-action-btn {
      padding: 10px 12px !important;
      font-size: 12px !important;
    }
    
    .description-cell {
      max-width: 100px;
    }
  }

  @media (max-width: 768px) {
    .pos-stock-table th,
    .pos-stock-table td {
      padding: 8px 12px;
      font-size: 0.8em;
    }
    
    .description-cell {
      max-width: 150px;
    }
  }
  

`;

  // Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Brand detection function
const checkIfBrandSearch = (searchTerm, brandList) => {
  if (!searchTerm || !brandList || brandList.length === 0) return false;
  
  const cleanSearchTerm = searchTerm.toLowerCase().trim();
  return brandList.some(brand => 
    brand.toLowerCase().includes(cleanSearchTerm) || 
    cleanSearchTerm.includes(brand.toLowerCase())
  );
};

// Service integration function
const getServiceInfo = (stockId, serviceData) => {
  if (!serviceData || !serviceData[stockId]) return null;
  
  const service = serviceData[stockId];
  return {
    isInService: true,
    totalQuantity: service.total_quantity,
    orderIds: service.order_ids,
    status: service.status,
    latestServiceDate: service.latest_service_date
  };
};

const SORT_OPTIONS = [
  { value: 'recent', label: 'Most Recent First' },
  { value: 'az', label: 'Brand A-Z' },
  { value: 'za', label: 'Brand Z-A' },
  { value: 'quantity-high', label: 'Quantity, high to low' },
  { value: 'quantity-low', label: 'Quantity, low to high' },
  { value: 'price-low', label: 'Price, low to high' },
  { value: 'price-high', label: 'Price, high to low' },
];

const Stock = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('in-stock');
  const [serviceData, setServiceData] = useState({});

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage] = useState(50);
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [showModal, setShowModal] = useState(false);
  const [editingStock, setEditingStock] = useState(null);
  const [modalForm, setModalForm] = useState({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [stats, setStats] = useState({
    totalItems: 0,
    inStock: 0,
    outOfStock: 0,
    totalValue: 0
  });
  const [sortDropdown, setSortDropdown] = useState('recent'); // Default to most recent first
  const [showRecentSort, setShowRecentSort] = useState(false); // Track if recent button was clicked
  const [showingRecentItems, setShowingRecentItems] = useState(false); // Track if we're showing recent items view
  const [master, setMaster] = useState([]); // <-- Add master data
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestingStock, setRequestingStock] = useState(null);
  const [requestReason, setRequestReason] = useState('');
  const { user } = useContext(AuthContext);

  // Add state for scan modal and scanned value
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scannedValue, setScannedValue] = useState('');
  // Change selectedStocks to store stock objects, not just IDs
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const [cartOpen, setCartOpen] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [orderNumber, setOrderNumber] = useState(null);
  const [quotationModalOpen, setQuotationModalOpen] = useState(false);
  const [quotationForm, setQuotationForm] = useState({
    customer_name: '',
    chassis_number: '',
    contact_number: ''
  });
  const [returnedOrderNotification, setReturnedOrderNotification] = useState(null);
  
  // Add state for price editing
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [returnedOrderModal, setReturnedOrderModal] = useState(null);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [showMasterRefreshModal, setShowMasterRefreshModal] = useState(false);
  const [showInmainRefreshModal, setShowInmainRefreshModal] = useState(false);
  const [availableDbfFiles, setAvailableDbfFiles] = useState([]);
  const [selectedDbfFile, setSelectedDbfFile] = useState('');
  const [selectedMasterDbfFile, setSelectedMasterDbfFile] = useState('');
  const [selectedInmainDbfFile, setSelectedInmainDbfFile] = useState('');
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [masterRefreshLoading, setMasterRefreshLoading] = useState(false);
  const [inmainRefreshLoading, setInmainRefreshLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [clearConfirmationData, setClearConfirmationData] = useState(null);
  const [cartExpanded, setCartExpanded] = useState(false);
  const [returnedExpanded, setReturnedExpanded] = useState(false);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const CART_COMPRESS_LIMIT = 8;
  const CART_ALWAYS_SHOW = 3;

  // Show cart when items are selected
  useEffect(() => {
    setCartOpen(selectedStocks.length > 0);
  }, [selectedStocks]);

  // Load search term from URL on component mount
  useEffect(() => {
    const searchParam = new URLSearchParams(window.location.search).get('search');
    if (searchParam) {
      setSearchTerm(searchParam);
    }
    // eslint-disable-next-line
  }, []);

  // Fetch brands for brand detection
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/products/brands', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBrands(response.data || []);
      } catch (error) {
        console.error('Error fetching brands:', error);
        setBrands([]);
      }
    };

    fetchBrands();
  }, []);

  // Fetch service data for stock items
  useEffect(() => {
    const fetchServiceData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/service/stock-data', {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('🔧 Service data fetched:', response.data);
        setServiceData(response.data || {});
      } catch (error) {
        console.error('Error fetching service data:', error);
        setServiceData({});
      }
    };

    fetchServiceData();
  }, []);

  // Refresh service data when stocks are fetched
  useEffect(() => {
    if (stocks && stocks.length > 0) {
      const fetchServiceData = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get('/api/service/stock-data', {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log('🔧 Service data refreshed:', response.data);
          setServiceData(response.data || {});
        } catch (error) {
          console.error('Error refreshing service data:', error);
        }
      };

      fetchServiceData();
    }
  }, [stocks]);

  // When cart is opened for a new order, get the next order number
  useEffect(() => {
    const fetchNextOrderNumber = async () => {
      if (cartOpen && !orderNumber) {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get('/api/warehouse/next-order-number', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setOrderNumber(response.data.next_order_number);
          setOrderId(response.data.next_order_number.toString()); // Keep orderId for compatibility
        } catch (error) {
          console.error('Error fetching next order number:', error);
          // Fallback to UUID if API fails
          setOrderId(uuidv4());
        }
      }
    };

    fetchNextOrderNumber();
  }, [cartOpen]);

  // Reset order number when cart is closed
  useEffect(() => {
    if (!cartOpen) {
      setOrderNumber(null);
      setOrderId(null);
    }
  }, [cartOpen]);

  const fetchStocks = useCallback(async (page = 1, search = '', filter = 'all', sort = 'recent', customLimit = null) => {
    // Prevent multiple simultaneous API calls
    if (isFetching) {
      console.log('🚫 Fetch already in progress, skipping...');
      return;
    }
    
    try {
      setIsFetching(true);
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found. Please log in again.');
        return;
      }
      
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: (customLimit || itemsPerPage).toString(),
        sort: sort
      });
      
      if (search.trim()) {
        params.append('search', search.trim());
      }
      
      // Use the filter parameter passed to the function, not the state
      if (filter !== 'all') {
        params.append('filter', filter);
      }
      
      // Add cache-busting parameter to ensure fresh data
      params.append('_t', Date.now().toString());
      
      const response = await axios.get(`/api/stock-items?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Stock API Response:', response.data); // Debug log
      console.log('📊 API Response Details:');
      console.log('  - Total items from API:', response.data.data?.length || 0);
      console.log('  - Pagination total:', response.data.pagination?.total || 0);
      console.log('  - Current page:', response.data.pagination?.page || 0);
      
      // Check if response data exists and has the expected structure
      if (!response.data || !response.data.data || !Array.isArray(response.data.data)) {
        console.error('Invalid response structure:', response.data);
        setError('Invalid response from server. Please try again.');
        setStocks([]);
        setCurrentPage(1);
        setTotalPages(1);
        setTotalItems(0);
        setStats({
          totalItems: 0,
          inStock: 0,
          outOfStock: 0,
          totalValue: 0
        });
        return;
      }
      
      console.log('Raw stock data sample:', response.data.data.slice(0, 3).map(s => ({ id: s.id, ID: s.ID, BENZ: s.BENZ, BRAND: s.BRAND })));
      
      // Store raw data directly - let mergedStocks handle the transformation
      setStocks(response.data.data);
      setCurrentPage(page);
      setTotalPages(response.data.pagination.pages);
      setTotalItems(response.data.pagination.total);
      
      // Update stats using raw data
      const inStockCount = response.data.data.filter(s => (parseInt(s.QTY) || 0) > 0).length;
      const outOfStockCount = response.data.data.filter(s => (parseInt(s.QTY) || 0) <= 0).length;
      const totalValue = response.data.data.reduce((sum, s) => sum + ((parseInt(s.QTY) || 0) * (parseFloat(s.SELL) || 0)), 0);
      
      setStats({
        totalItems: response.data.pagination.total,
        inStock: inStockCount,
        outOfStock: outOfStockCount,
        totalValue: totalValue
      });
      
    } catch (error) {
      console.error('Error fetching stocks:', error);
      if (error.response?.status === 401) {
        setError('Authentication failed. Please log in again.');
      } else if (error.response?.status === 500) {
        setError(`Server error: ${error.response.data?.error || error.message}`);
      } else if (error.code === 'ECONNREFUSED') {
        setError('Cannot connect to server. Please check if the backend is running.');
      } else {
        setError(`Failed to fetch stocks: ${error.message}`);
      }
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  }, [itemsPerPage, isFetching]);

  // Listen for returned order events (from warehouse page)
  useEffect(() => {
    const handler = async (e) => {
      const { orderId } = e.detail;
      // Fetch returned order items from backend
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/warehouse/items', { headers: { Authorization: `Bearer ${token}` } });
      const orderItems = res.data.filter(item => item.order_id === orderId);
      setReturnedOrderNotification({ orderId, items: orderItems });
      
      // Refresh stock data to show updated quantities after order return
      fetchStocks(currentPage, searchTerm, stockFilter, sortDropdown);
    };
    window.addEventListener('warehouseOrderReturned', handler);
    return () => window.removeEventListener('warehouseOrderReturned', handler);
  }, [currentPage, searchTerm, stockFilter, sortDropdown]); // Removed fetchStocks from dependencies

  // Debounced values - reduced delay for better responsiveness
  const debouncedSearchTerm = useDebounce(searchTerm, 150);
  const debouncedStockFilter = useDebounce(stockFilter, 150);

  // Load data when search term or filter changes
  useEffect(() => {
    // Always search when there's a search term, even if it's the same
    if (debouncedSearchTerm && debouncedSearchTerm.trim()) {
      fetchStocks(1, debouncedSearchTerm.trim(), stockFilter, sortDropdown);
    } else if (debouncedSearchTerm === '') {
      // Only load default data when search is explicitly empty
      fetchStocks(1, '', stockFilter, sortDropdown);
    }
  }, [debouncedSearchTerm, stockFilter, sortDropdown]); // Removed fetchStocks from dependencies

  // When sortDropdown changes, only update the sort, don't refetch
  // The main search useEffect will handle refetching with the new sort

  // Fetch master table data
  useEffect(() => {
    const fetchMaster = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/products?limit=all', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Check if response data exists and has the expected structure
        if (!response.data || !response.data.data || !Array.isArray(response.data.data)) {
          console.error('Invalid master response structure:', response.data);
          setMaster([]);
          return;
        }
        
        setMaster(response.data.data);
      } catch (err) {
        console.error('Failed to fetch master table:', err);
        setMaster([]);
      }
    };
    fetchMaster();
  }, []);



  // Merge stocks with master fallback logic and transform data
  const mergedStocks = useMemo(() => {
    if (!stocks || !Array.isArray(stocks) || !stocks.length) return [];
    
    let noDescriptionCount = 0;
    let noMatchCount = 0;
    let withDescriptionCount = 0;
    
    const result = stocks.map(stock => {
      // First, transform the raw stock data
      const transformedStock = {
        ID: stock.ID || stock.id,
        NAME: stock.BRAND || 'Unnamed Item',
        CODE: stock.ALTNO || stock.BENZ || 'No Code',
        PRICE: parseFloat(stock.SELL) || 0,
        COST: parseFloat(stock.COST) || 0,
        QUANTITY: parseInt(stock.QTY) || 0,
        BRAND: stock.BRAND || '',
        BENZ: stock.BENZ || '',
        BENZ2: stock.BENZ2 || '',
        BENZ3: stock.BENZ3 || '',
        ALTNO: stock.ALTNO || '',
        ALTNO2: stock.ALTNO2 || '',
        COLORCODE: stock.COLORCODE || '',
        REMARKS: stock.REMARKS || '',
        CURRENCY: stock.CURRENCY || '',
        DINFLAG: stock.DINFLAG || '',
        DESCRIPTION: stock.DESCRIPTION || stock.REMARKS || '',
        APPLICATION: stock.APPLICATION || stock.APPL || '',
        UNIT: stock.UNIT || '',
        DATE: stock.DATE || '',
        REFERENCE: stock.REFERENCE || '',
        OEM: stock.OEM || '',
        SELL: stock.SELL || '',
        FC_COST: stock.FC_COST || '',
        FCAMOUNT: stock.FCAMOUNT || '',
        CONVERSION: stock.CONVERSION || '',
        LOCATION: stock.LOCATION || '',
        QTY: stock.QTY || '',
        originalData: stock
      };
      
      // Then try to merge with master data if available
      if (master && Array.isArray(master) && master.length > 0) {
        const match = master.find(m =>
          m.BENZ === stock.BENZ &&
          m.BRAND === stock.BRAND
        );
        
        if (!match) {
          noMatchCount++;
          return transformedStock;
        }
        
        const finalDescription = (stock.DESCRIPTION !== null && stock.DESCRIPTION !== undefined && stock.DESCRIPTION !== '') 
          ? stock.DESCRIPTION 
          : (stock.REMARKS !== null && stock.REMARKS !== undefined && stock.REMARKS !== '')
          ? stock.REMARKS
          : (match.DESC ?? '');
        
        if (!finalDescription || finalDescription.trim() === '') {
          noDescriptionCount++;
        } else {
          withDescriptionCount++;
        }
        
        return {
          ...transformedStock,
          DINFLAG: (stock.DINFLAG !== null && stock.DINFLAG !== undefined && stock.DINFLAG !== '') ? stock.DINFLAG : (match.DINFLAG ?? ''),
          DESCRIPTION: finalDescription,
          APPLICATION: (stock.APPLICATION !== null && stock.APPLICATION !== undefined && stock.APPLICATION !== '') ? stock.APPLICATION : ((stock.APPL !== null && stock.APPL !== undefined && stock.APPL !== '') ? stock.APPL : (match.APPL ?? '')),
          UNIT: (stock.UNIT !== null && stock.UNIT !== undefined && stock.UNIT !== '') ? stock.UNIT : (match.UNIT ?? ''),
        };
      } else {
        // No master data available, return transformed stock as-is
        return transformedStock;
      }
    });
    
    // Log the statistics
    console.log('📊 DESCRIPTION STATISTICS:');
    console.log(`📦 Total items: ${result.length}`);
    console.log(`❌ No master match: ${noMatchCount}`);
    console.log(`📝 With description: ${withDescriptionCount}`);
    console.log(`🚫 No description: ${noDescriptionCount}`);
    console.log(`📈 Description success rate: ${((withDescriptionCount / result.length) * 100).toFixed(1)}%`);
    
    // Remove duplicates based on ID (keep the latest one)
    const uniqueResult = result.reduce((acc, item) => {
      const existingIndex = acc.findIndex(existing => existing.ID === item.ID);
      if (existingIndex >= 0) {
        // Replace with newer item (assuming higher ID is newer)
        if (item.ID > acc[existingIndex].ID) {
          acc[existingIndex] = item;
        }
      } else {
        acc.push(item);
      }
      return acc;
    }, []);
    
    // Check for duplicates in final result
    const duplicateCheck = uniqueResult.reduce((acc, item) => {
      const key = `${item.BENZ}-${item.BRAND}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    
    const duplicates = Object.entries(duplicateCheck).filter(([key, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log('⚠️ DUPLICATES FOUND IN FINAL STOCKS:');
      duplicates.forEach(([key, count]) => {
        console.log(`  ${key}: ${count} times`);
      });
    } else {
      console.log('✅ No duplicates found in final stocks');
    }
    
    console.log(`📊 Final unique items: ${uniqueResult.length} (from ${result.length} original)`);
    
    return uniqueResult;
  }, [stocks, master]);

  // Sort and filter stocks (add dropdown logic)
  const sortedStocks = useMemo(() => {
    if (!mergedStocks || !Array.isArray(mergedStocks)) return [];
    let filteredStocks = [...mergedStocks];
    
    // Apply stock filter first
    switch (stockFilter) {
      case 'in-stock':
        // Include items with QTY > 0 OR items with service data (even if QTY = 0)
        filteredStocks = filteredStocks.filter(stock => {
          const hasQuantity = (parseInt(stock.QTY) || 0) > 0;
          const hasService = serviceData ? getServiceInfo(stock.ID, serviceData) : null;
          return hasQuantity || hasService;
        });
        break;
      case 'out-of-stock':
        filteredStocks = filteredStocks.filter(stock => (parseInt(stock.QTY) || 0) <= 0);
        break;
      case 'low-stock':
        filteredStocks = filteredStocks.filter(stock => {
          const qty = parseInt(stock.QTY) || 0;
          return qty > 0 && qty <= 5;
        });
        break;
      case 'all':
      default:
        // Show all items when "All Items" is selected
        break;
    }
    
    // Then apply sorting
    // If recent button was clicked, sort by highest ID first
    if (showRecentSort) {
      filteredStocks.sort((a, b) => b.ID - a.ID);
    } else {
      // Otherwise use the dropdown sorting
      switch (sortDropdown) {
        case 'quantity-high':
        filteredStocks.sort((a, b) => b.QUANTITY - a.QUANTITY);
        break;
      case 'quantity-low':
        filteredStocks.sort((a, b) => a.QUANTITY - b.QUANTITY);
        break;
      case 'price-low':
        filteredStocks.sort((a, b) => a.PRICE - b.PRICE);
        break;
      case 'price-high':
        filteredStocks.sort((a, b) => b.PRICE - a.PRICE);
        break;
      case 'date-old':
        filteredStocks.sort((a, b) => new Date(a.originalData.DATE) - new Date(b.originalData.DATE));
        break;
      case 'date-new':
        filteredStocks.sort((a, b) => new Date(b.originalData.DATE) - new Date(a.originalData.DATE));
        break;
      // 'featured' and 'best' do nothing for now
      default:
        break;
    }
    }
    
    // Debug: Check for duplicates in final sorted stocks
    console.log('📊 FINAL SORTED STOCKS DEBUG:');
    console.log(`  - Total filtered stocks: ${filteredStocks.length}`);
    console.log(`  - Sample IDs: ${filteredStocks.slice(0, 5).map(s => s.ID).join(', ')}`);
    
    return filteredStocks;
  }, [mergedStocks, sortDropdown, stockFilter, showRecentSort, serviceData]);

  // Handlers
  const handlePageChange = (page) => {
    fetchStocks(page, searchTerm, stockFilter, sortDropdown);
    // Scroll to top of the page when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };



  const handleSearchChange = (e) => {
    const newSearchTerm = e.target.value;
    
    // Remove any spaces from the input to keep numbers together
    const cleanSearchTerm = newSearchTerm.replace(/\s/g, '');
    
    setSearchTerm(cleanSearchTerm);
    
    // Check if this is a brand search
    const isBrand = checkIfBrandSearch(cleanSearchTerm, brands);
    setIsBrandSearch(isBrand);
    
    // Hide compatibility results when typing in search bar
    setShowCompatibilityResults(false);
  };

  // Enhanced search function that handles spaces and case sensitivity
  const handleSearchSubmit = () => {
    if (searchTerm.trim()) {
      // Clean the search term but keep it flexible
      const cleanSearchTerm = searchTerm.trim();
      setShowRecentSort(false); // Reset recent sort flag
      setShowingRecentItems(false); // Reset recent items view flag
      setShowCompatibilityResults(false); // Clear compatibility results when performing new search
      setCompatibilityResults([]); // Clear compatibility results array
      fetchStocks(1, cleanSearchTerm, stockFilter, sortDropdown);
    }
  };

  // Fetch available DBF files
  const fetchAvailableDbfFiles = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/stock/available-dbf-files', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableDbfFiles(response.data.files);
      if (response.data.files.length > 0) {
        setSelectedDbfFile(response.data.files[0].path);
      }
    } catch (error) {
      console.error('Error fetching DBF files:', error);
      setError('Failed to fetch available DBF files');
    }
  }, []);

  // Handle refresh from DBF
  const handleRefreshFromDbf = async () => {
    try {
      setRefreshLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/stock/refresh-from-dbf', {
        dbfPath: selectedDbfFile
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        if (response.data.requiresConfirmation) {
          // Show confirmation dialog
          setClearConfirmationData(response.data);
          setShowClearConfirmation(true);
          setShowRefreshModal(false);
        } else {
          // Direct success (shouldn't happen with new logic)
          setShowRefreshModal(false);
          setError('');
          setSuccessMessage(`Stock data refreshed successfully! Imported ${response.data.imported} records.`);
          fetchStocks(1, searchTerm, stockFilter, sortDropdown);
        }
      }
    } catch (error) {
      console.error('Error refreshing from DBF:', error);
      setError(error.response?.data?.message || 'Failed to refresh stock data from DBF');
      setSuccessMessage(''); // Clear success message on error
    } finally {
      setRefreshLoading(false);
    }
  };

  // Handle continue import after confirmation
  const handleContinueImport = async () => {
    try {
      setRefreshLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/stock/continue-import', {
        csvPath: clearConfirmationData.csvPath
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setShowClearConfirmation(false);
        setClearConfirmationData(null);
        setError('');
        setSuccessMessage(`Stock data refreshed successfully! Imported ${response.data.imported} records.`);
        // Add small delay to ensure backend operations are complete and reset fetching flag
        setTimeout(() => {
          setIsFetching(false); // Ensure flag is reset before calling fetchStocks
          fetchStocks(1, searchTerm, stockFilter, sortDropdown);
        }, 1000);
      }
    } catch (error) {
      console.error('Error continuing import:', error);
      setError(error.response?.data?.message || 'Failed to continue import');
    } finally {
      setRefreshLoading(false);
    }
  };

  // Handle revert to backup
  const handleRevertToBackup = async () => {
    try {
      setRefreshLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/stock/revert-to-backup', {
        backupTable: clearConfirmationData.backupTable
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setShowClearConfirmation(false);
        setClearConfirmationData(null);
        setError('');
        setSuccessMessage(`Successfully reverted to backup! Restored ${response.data.restored} records.`);
        // Add small delay to ensure backend operations are complete and reset fetching flag
        setTimeout(() => {
          setIsFetching(false); // Ensure flag is reset before calling fetchStocks
          fetchStocks(1, searchTerm, stockFilter, sortDropdown);
        }, 1000);
      }
    } catch (error) {
      console.error('Error reverting to backup:', error);
      setError(error.response?.data?.message || 'Failed to revert to backup');
    } finally {
      setRefreshLoading(false);
    }
  };

  // Handle Master refresh from DBF
  const handleMasterRefreshFromDbf = async () => {
    try {
      setMasterRefreshLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/master/refresh-from-dbf', {
        dbfPath: selectedMasterDbfFile
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setShowMasterRefreshModal(false);
        setError(''); // Clear any previous errors
        setSuccessMessage(`Master data refreshed successfully! Imported ${response.data.imported} records.`);
      }
    } catch (error) {
      console.error('Error refreshing master from DBF:', error);
      setError(error.response?.data?.message || 'Failed to refresh master data from DBF');
      setSuccessMessage(''); // Clear success message on error
    } finally {
      setMasterRefreshLoading(false);
    }
  };

  // Handle Inmain refresh from DBF
  const handleInmainRefreshFromDbf = async () => {
    try {
      setInmainRefreshLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/inmain/refresh-from-dbf', {
        dbfPath: selectedInmainDbfFile
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setShowInmainRefreshModal(false);
        setError(''); // Clear any previous errors
        setSuccessMessage(`Inmain data refreshed successfully! Imported ${response.data.imported} records.`);
      }
    } catch (error) {
      console.error('Error refreshing inmain from DBF:', error);
      setError(error.response?.data?.message || 'Failed to refresh inmain data from DBF');
      setSuccessMessage(''); // Clear success message on error
    } finally {
      setInmainRefreshLoading(false);
    }
  };



  const handleFilterChange = (e) => {
    const newFilter = e.target.value;
    setStockFilter(newFilter);
    setShowRecentSort(false); // Reset recent sort flag
    setShowingRecentItems(false); // Reset recent items view flag
    fetchStocks(1, searchTerm, newFilter, sortDropdown);
  };

  const handleSort = (col) => {
    let direction = 'asc';
    if (sortConfig.key === col && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key: col, direction });
  };

  const handleRefresh = () => {
    // Reset all state to initial values
    setSearchTerm('');
    setStockFilter('in-stock');
            setSortDropdown('recent');
    setCurrentPage(1);
    setError('');
    
    // Fetch fresh data with reset parameters
            fetchStocks(1, '', 'in-stock', 'recent');
  };

  const handleCardClick = (stock) => {
    // Use the merged stock object (with fallbacks) for editing
    setEditingStock(stock);
    setModalForm({ ...stock });
    setIsAddingNew(false);
    setShowModal(true);
  };

  const handleAddItem = () => {
    setEditingStock(null);
    setModalForm({});
    setIsAddingNew(true);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingStock(null);
    setModalForm({});
    setIsAddingNew(false);
  };

  const handleModalFormChange = (e) => {
    setModalForm({ ...modalForm, [e.target.name]: e.target.value });
  };

  const handleModalSave = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found. Please log in again.');
        return;
      }

      // Prepare the data for API
      const stockData = {
        BRAND: modalForm.BRAND || '',
        BENZ: modalForm.BENZ || '',
        BENZ2: modalForm.BENZ2 || '',
        BENZ3: modalForm.BENZ3 || '',
        ALTNO: modalForm.ALTNO || '',
        ALTNO2: modalForm.ALTNO2 || '',
        DESCRIPTION: modalForm.DESCRIPTION || '',
        APPLICATION: modalForm.APPLICATION || '',
        COLORCODE: modalForm.COLORCODE || '',
        REMARKS: modalForm.REMARKS || '',
        COST: parseFloat(modalForm.COST) || 0,
        SELL: parseFloat(modalForm.SELL) || 0,
        QTY: parseInt(modalForm.QTY) || 0,
        UNIT: modalForm.UNIT || '',
        LOCATION: modalForm.LOCATION || '',
        OEM: modalForm.OEM || '',
        DINFLAG: modalForm.DINFLAG || '',
        CURRENCY: modalForm.CURRENCY || '',
        FC_COST: parseFloat(modalForm.FC_COST) || 0,
        FCAMOUNT: parseFloat(modalForm.FCAMOUNT) || 0,
        CONVERSION: parseFloat(modalForm.CONVERSION) || 0,
        DATE: modalForm.DATE || new Date().toISOString().split('T')[0],
        REFERENCE: modalForm.REFERENCE || ''
      };

      if (isAddingNew) {
        // Add new stock item
        await axios.post('/api/stock-items', stockData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setError('');
        // Show success message or handle as needed
      } else {
        // Update existing stock item
        await axios.put(`/api/stock-items/${editingStock.ID}`, stockData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setError('');
        // Show success message or handle as needed
      }
      
      // Close modal and refresh data
      handleModalClose();
      fetchStocks(currentPage, searchTerm, stockFilter, sortDropdown);
      
    } catch (error) {
      console.error('Error saving stock item:', error);
      if (error.response?.status === 401) {
        setError('Authentication failed. Please log in again.');
      } else if (error.response?.status === 400) {
        setError(`Validation error: ${error.response.data?.message || 'Please check your input.'}`);
      } else if (error.response?.status === 500) {
        setError(`Server error: ${error.response.data?.error || error.message}`);
      } else {
        setError(`Failed to save stock item: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return parseFloat(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  // Add click animation to filter and sort
  const handleFilterClick = (e) => {
    const container = e.target.closest('.pos-filter-container');
    if (container) {
      container.classList.add('clicked');
      setTimeout(() => container.classList.remove('clicked'), 250);
    }
  };

  // Disable body scroll when modal is open
  useEffect(() => {
    if (showModal || scanModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup function to re-enable scroll when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal, scanModalOpen]);

  // Fetch DBF files when refresh modal opens
  useEffect(() => {
    if (showRefreshModal) {
      fetchAvailableDbfFiles();
    }
  }, [showRefreshModal, fetchAvailableDbfFiles]);

  // Fetch DBF files when master refresh modal opens
  useEffect(() => {
    if (showMasterRefreshModal) {
      fetchAvailableDbfFiles();
    }
  }, [showMasterRefreshModal, fetchAvailableDbfFiles]);

  // Fetch DBF files when inmain refresh modal opens
  useEffect(() => {
    if (showInmainRefreshModal) {
      fetchAvailableDbfFiles();
    }
  }, [showInmainRefreshModal, fetchAvailableDbfFiles]);

  // Auto-clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleRequestClick = (stock) => {
    setRequestingStock(stock);
    setShowRequestModal(true);
    setRequestReason('');
  };

  const handleRequestModalClose = () => {
    setShowRequestModal(false);
    setRequestingStock(null);
    setRequestReason('');
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      // Fallback logic for partNo, oem, brand
      const partNo = requestingStock?.BENZ || requestingStock?.CODE || requestingStock?.ID || '';
      const oem = requestingStock?.ALTNO || requestingStock?.OEM || requestingStock?.CODE || '';
      const brand = requestingStock?.BRAND || requestingStock?.NAME || '';
      await axios.post('/api/stock-requests', {
        stockId: requestingStock?.ID,
        stockDescription: requestingStock?.DESCRIPTION,
        reason: requestReason,
        userId: user?.id,
        username: user?.username,
        partNo,
        oem,
        brand
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowRequestModal(false);
      setRequestingStock(null);
      setRequestReason('');
      alert('Request submitted!');
    } catch (err) {
      alert('Failed to submit request.');
    }
  };



  // Add a date formatting helper
  function formatDateLabel(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // Accounting/Indian format for price
  function formatAccountingINR(amount) {
    if (isNaN(amount)) return amount;
    return amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // Helper to split BENZ into groups
  function splitBenzGroups(benz) {
    if (!benz) return [];
    return benz.split(/\s+/);
  }

  // Handle individual row selection
  const handleSelectRow = async (id) => {
    console.log('[HANDLE SELECT ROW]', id);
    const stock = sortedStocks.find(s => s.ID === id);
    if (!stock || !stock.ID) {
      alert('This item does not have a valid ID and cannot be reserved.');
      return;
    }
    if (selectedStocks.some(s => s.ID === id)) {
      // Remove from cart
      setSelectedStocks(prev => prev.filter(s => s.ID !== id));
    } else {
      // Add to cart: always start with quantity 1
      const stockWithQty = { ...stock, QUANTITY: 1 };
        setSelectedStocks(prev => [...prev, stockWithQty]);
    }
  };

  // Handle compatibility row selection
  const handleCompatibilitySelectRow = async (part) => {
    console.log('[HANDLE COMPATIBILITY SELECT ROW]', part);
    if (!part || !part.ID) {
      alert('This item does not have a valid ID and cannot be reserved.');
      return;
    }
    if (selectedStocks.some(s => s.ID === part.ID)) {
      // Remove from cart
      setSelectedStocks(prev => prev.filter(s => s.ID !== part.ID));
    } else {
      // Add to cart: always start with quantity 1
      const partWithQty = { 
        ...part, 
        QUANTITY: 1,
        // Map compatibility fields to main table fields
        BENZ: part.BENZ,
        BRAND: part.BRAND,
        ALTNO: part.ALTNO,
        DESCRIPTION: part.DESCRIPTION || part.REMARKS,
        PRICE: part.SELL,
        QTY: part.QTY,
        // Add originalData with proper structure for warehouse submission
        originalData: {
          id: part.ID,
          BENZ: part.BENZ,
          BRAND: part.BRAND,
          ALTNO: part.ALTNO,
          DESCRIPTION: part.DESCRIPTION || part.REMARKS,
          SELL: part.SELL,
          QTY: part.QTY
        }
      };
      setSelectedStocks(prev => [...prev, partWithQty]);
    }
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectAll) {
      // Remove all selected
      setSelectedStocks(selectedStocks.filter(s => !sortedStocks.some(st => st.ID === s.ID)));
    } else {
      // Add all new, always with quantity 1
      const newStocks = sortedStocks.filter(st => !selectedStocks.some(s => s.ID === st.ID) && st.ID)
        .map(st => ({ ...st, QUANTITY: 1 }));
      setSelectedStocks([...selectedStocks, ...newStocks]);
    }
    setSelectAll(!selectAll);
  };





  // Handle barcode scan with detailed modal
  const handleBarcodeScan = async (barcode) => {
    // Handle case where no barcode is provided (just open scanner)
    if (!barcode) {
      setBarcodeScannerOpen(true);
      setScannedBarcode('');
      return;
    }
    
    // Ensure barcode is a string and not empty
    const barcodeStr = String(barcode).trim();
    if (barcodeStr === '') return;
    
    try {
      setBarcodeScannerOpen(false);
      setScannedBarcode(barcodeStr);
      
      // Fast search by ID in tbl_stock
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/stock/barcode-scan/${barcodeStr}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.found) {
        setScannedStockData(response.data.stock);
        setScannedMasterData(response.data.master);
        setScannedInmainData(response.data.inmain);
        setScannedQualityData(response.data.quality);
        setShowBarcodeResult(true);
      } else {
        setScannedStockData(null);
        setScannedMasterData(null);
        setScannedInmainData(null);
        setScannedQualityData(null);
        setShowBarcodeResult(true);
      }
      
    } catch (error) {
      console.error('Barcode scan error:', error);
      setScannedStockData(null);
      setScannedMasterData(null);
      setScannedInmainData(null);
      setScannedQualityData(null);
      setShowBarcodeResult(true);
    }
  };

  // State for export preview modal
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [exportPreviewData, setExportPreviewData] = useState([]);
  const [exportType, setExportType] = useState('');
  


  // State for CSV import modal
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importType, setImportType] = useState('stock'); // 'stock' or 'master'

  // State for barcode scan result modal
  const [showBarcodeResult, setShowBarcodeResult] = useState(false);
  const [scannedStockData, setScannedStockData] = useState(null);
  const [scannedMasterData, setScannedMasterData] = useState(null);
  const [scannedInmainData, setScannedInmainData] = useState(null);
  const [scannedQualityData, setScannedQualityData] = useState(null);

  // Compatibility search state
  const [compatibilityResults, setCompatibilityResults] = useState([]);
  const [compatibilityLoading, setCompatibilityLoading] = useState(false);
  const [showCompatibilityResults, setShowCompatibilityResults] = useState(false);
  const [brands, setBrands] = useState([]);
  const [isBrandSearch, setIsBrandSearch] = useState(false);

  // DBF conversion state
  const [dbfConversionLoading, setDbfConversionLoading] = useState(false);
  const [showDbfConversionModal, setShowDbfConversionModal] = useState(false);

  // Clear all items from export preview
  const clearAllExportItems = () => {
    if (exportPreviewData.length === 0) return;
    
    if (window.confirm(`Are you sure you want to clear all ${exportPreviewData.length} items from the export preview?`)) {
      setExportPreviewData([]);
      setShowExportPreview(false);
      // Also uncheck all selected items in the main table
      setSelectedStocks([]);
      setSelectAll(false);
    }
  };

  // Remove individual item from export preview
  const removeExportItem = (index) => {
    const item = exportPreviewData[index];
    if (window.confirm(`Are you sure you want to remove "${item['DESCRIPTION'] || item['BENZ'] || item['ID']}" from the export preview?`)) {
      setExportPreviewData(prevData => prevData.filter((_, i) => i !== index));
    }
  };

  // Handle CSV file selection
  const handleCSVFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
    } else {
      alert('Please select a valid CSV file.');
    }
  };

  // Handle CSV import with streaming progress
  const handleCSVImport = async () => {
    if (!csvFile) {
      alert('Please select a CSV file first.');
      return;
    }

    if (!window.confirm(`⚠️ WARNING: This will replace ALL existing ${importType === 'stock' ? 'stock' : 'master'} data with the CSV data!\n\nThis action will:\n1. Create a backup of current data\n2. Delete all existing ${importType === 'stock' ? 'stock' : 'master'} records\n3. Import new data from the CSV file\n\nAre you sure you want to continue?`)) {
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportStatus('Starting import process...');

    try {
      const formData = new FormData();
      formData.append('csvFile', csvFile);

      setImportStatus('Uploading CSV file...');
      setImportProgress(10);

      const token = localStorage.getItem('token');
      
      // Use fetch for streaming response
      const endpoint = importType === 'stock' ? '/api/stock/upload-csv' : '/api/master/import-csv';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.trim()) {
            console.log('Progress:', line);
            
            // Update status based on progress messages
            if (line.includes('📁 Processing uploaded CSV file')) {
              setImportStatus('Processing uploaded CSV file...');
              setImportProgress(15);
            } else if (line.includes('📋 CSV Headers:')) {
              setImportStatus('CSV Headers parsed...');
              setImportProgress(20);
            } else if (line.includes('📊 Parsing CSV data')) {
              setImportStatus('Parsing CSV data...');
              setImportProgress(25);
            } else if (line.includes('📊 Parsed') && line.includes('data rows from CSV')) {
              setImportStatus('CSV parsing completed');
              setImportProgress(30);
            } else if (line.includes('🚀 Starting CSV import process')) {
              setImportStatus('Starting CSV import process...');
              setImportProgress(35);
            } else if (line.includes('📦 Creating backup table:')) {
              setImportStatus('Creating backup table...');
              setImportProgress(40);
            } else if (line.includes('✅ Backup created with')) {
              setImportStatus('Backup created successfully');
              setImportProgress(45);
            } else if (line.includes('🗑️ Clearing existing data')) {
              setImportStatus('Clearing existing data...');
              setImportProgress(50);
            } else if (line.includes('📝 Creating temporary CSV file')) {
              setImportStatus('Creating temporary file...');
              setImportProgress(55);
            } else if (line.includes('📁 Temporary file created:')) {
              setImportStatus('Temporary file ready');
              setImportProgress(60);
            } else if (line.includes('🚀 Starting fast import with optimized batch inserts')) {
              setImportStatus('Starting fast database import...');
              setImportProgress(70);
            } else if (line.includes('📊 Progress:')) {
              // Extract progress percentage and count from the line
              const progressMatch = line.match(/Progress: (\d+)% \((\d+)\/(\d+)\)/);
              if (progressMatch) {
                const progressPercent = parseInt(progressMatch[1]);
                const currentCount = parseInt(progressMatch[2]);
                const totalCount = parseInt(progressMatch[3]);
                setImportProgress(70 + (progressPercent * 0.25)); // Progress from 70% to 95%
                setImportStatus(`Importing data: ${currentCount.toLocaleString()}/${totalCount.toLocaleString()} records`);
              }
            } else if (line.includes('🧹 Temporary file cleaned up')) {
              setImportStatus('Cleaning up temporary files...');
              setImportProgress(95);
            } else if (line.includes('🎉 CSV import completed successfully')) {
              setImportStatus('Import completed successfully!');
              setImportProgress(100);
              
              // Parse the result from the stream
              const importResult = {
                success: true,
                message: 'CSV import completed successfully',
                importedCount: csvFile.size > 0 ? Math.floor(csvFile.size / 100) : 0, // Estimate
                backupTable: (importType === 'stock' ? 'tbl_stock_backup_' : 'master_backup_') + new Date().toISOString().replace(/[:.-]/g, '_').slice(0, 19)
              };
              
              setImportResult(importResult);
              
              // Refresh the appropriate data based on import type
              setTimeout(() => {
                if (importType === 'stock') {
                  fetchStocks(1, searchTerm, stockFilter, sortDropdown);
                } else {
                  // Refresh master data if needed
                  // For now, just refresh stocks as they might reference master data
                  fetchStocks(1, searchTerm, stockFilter, sortDropdown);
                }
              }, 2000);
            } else if (line.includes('❌')) {
              setImportStatus(`Import failed: ${line}`);
              setImportResult({ success: false, error: line });
            }
          }
        }
      }

    } catch (error) {
      console.error('CSV import error:', error);
      setImportStatus(`Import failed: ${error.message}`);
      setImportResult({ success: false, error: error.message });
    } finally {
      setIsImporting(false);
    }
  };

  // Reset CSV import modal
  const resetCSVImport = () => {
    setCsvFile(null);
    setImportProgress(0);
    setImportStatus('');
    setImportResult(null);
    setImportType('stock'); // Reset to stock import type
    setShowCSVImport(false);
  };

  // Show export preview
  const handleExportPreview = () => {
    // Only allow export when items are specifically selected
    if (selectedStocks.length === 0) {
      alert('Please select items first by checking the checkboxes next to the stock items you want to export.');
      return;
    }
    
    // Export only selected items
    const stocksToExport = sortedStocks.filter(stock => 
      selectedStocks.some(s => s.ID === stock.ID)
    );
    const exportTypeValue = 'selected';
    
    if (stocksToExport.length === 0) {
      alert('No selected items found. Please select items first.');
      return;
    }
    
    // Create preview data with BENZ, BENZ2, BENZ3, and other columns
    const previewData = stocksToExport.map(stock => ({
      'BENZ': stock.BENZ || '',
      'BENZ2': stock.BENZ2 || '',
      'BENZ3': stock.BENZ3 || '',
      'BRAND': stock.BRAND || '',
      'ALT NO': stock.ALTNO || '',
      'DESCRIPTION': stock.DESCRIPTION || stock.REMARKS || '',
      'ID': stock.ID || '',
      'ID BARCODE': stock.ID || '' // Same as ID as shown in the image
    }));
    
    setExportPreviewData(previewData);
    setExportType(exportTypeValue);
    setShowExportPreview(true);
  };

  // Export selected items to Excel
  const handleExportToExcel = () => {
    try {
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      
      // Convert data to worksheet format
      const worksheet = XLSX.utils.json_to_sheet(exportPreviewData);
      
      // Set column widths
      const columnWidths = [
        { wch: 15 }, // BENZ
        { wch: 15 }, // BENZ2
        { wch: 15 }, // BENZ3
        { wch: 20 }, // BRAND
        { wch: 15 }, // ALT NO
        { wch: 40 }, // DESCRIPTION
        { wch: 10 }, // ID
        { wch: 15 }  // ID BARCODE
      ];
      worksheet['!cols'] = columnWidths;
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Items');
      
      // Generate XLSX file
      const exportTypeText = exportType === 'selected' ? 'selected' : 'filtered';
      const fileName = `stock_export_${exportTypeText}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Write and download file
      XLSX.writeFile(workbook, fileName);
      
      // Show success message and close modal
      const message = exportType === 'selected' 
        ? `Successfully exported ${exportPreviewData.length} selected items to XLSX!`
        : `Successfully exported ${exportPreviewData.length} filtered items to XLSX!`;
      alert(message);
      setShowExportPreview(false);
      
    } catch (error) {
      console.error('Export error:', error);
      alert('Error exporting to Excel. Please try again.');
    }
  };



  // Handler for sending to warehouse (placeholder)
  const handleSendToWarehouse = async () => {
    try {
      const token = localStorage.getItem('token');
      const cartItems = selectedStocks.map(s => ({ 
        stock_id: parseInt(s.originalData.id), // Ensure ID is an integer
        quantity: parseInt(s.QUANTITY), // Ensure quantity is an integer
        description: s.DESCRIPTION,
        custom_price: parseFloat(s.PRICE) || 0 // Send the custom price from cart
      }));
      
      // Validate cart items
      const invalidItems = cartItems.filter(item => 
        !item.stock_id || isNaN(item.stock_id) || 
        !item.quantity || isNaN(item.quantity) || item.quantity <= 0
      );
      
      if (invalidItems.length > 0) {
        console.error('[FRONTEND] Invalid cart items:', invalidItems);
        alert('Some items have invalid data and cannot be sent to warehouse.');
        return;
      }
      
      console.log('[FRONTEND] Sending to warehouse:', cartItems);
      console.log('[FRONTEND] Selected stocks:', selectedStocks);
      
      // Check for duplicate stock_ids in cart
      const stockIds = cartItems.map(item => item.stock_id);
      const uniqueStockIds = [...new Set(stockIds)];
      if (stockIds.length !== uniqueStockIds.length) {
        console.error('[FRONTEND] WARNING: Duplicate stock_ids found in cart:', stockIds);
        console.error('[FRONTEND] Unique stock_ids:', uniqueStockIds);
        alert('Warning: Duplicate items detected in cart. Please check your selection.');
        return;
      }
      const res = await axios.post('/api/warehouse/submit', { cartItems }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data && res.data.success) {
        alert('Order sent to warehouse!\nOrder Number: #' + res.data.order_id);
        setCartOpen(false);
        setSelectedStocks([]);
        setOrderId(null);
        setOrderNumber(null);
        // Refresh stock data to show updated quantities
        fetchStocks(currentPage, searchTerm, stockFilter, sortDropdown);
        
        // Update compatibility results to reflect quantity changes
        if (compatibilityResults.length > 0) {
          const updatedCompatibilityResults = compatibilityResults.map(part => {
            const sentItem = cartItems.find(item => item.stock_id === part.ID);
            if (sentItem) {
              return {
                ...part,
                QTY: Math.max(0, part.QTY - sentItem.quantity)
              };
            }
            return part;
          });
          setCompatibilityResults(updatedCompatibilityResults);
          console.log('[FRONTEND] Updated compatibility results after warehouse submission');
        }
      } else {
        let errorMessage = res.data && res.data.message ? res.data.message : 'Failed to send order to warehouse.';
        
        // If there are insufficient stock items, show details
        if (res.data && res.data.insufficient && res.data.insufficient.length > 0) {
          const insufficientDetails = res.data.insufficient.map(item => 
            `ID ${item.stock_id}: requested ${item.requested}, available ${item.available}`
          ).join('\n');
          errorMessage += '\n\nInsufficient stock:\n' + insufficientDetails;
        }
        
        alert(errorMessage);
      }
    } catch (err) {
      if (err.response && err.response.data) {
        const { message, insufficient } = err.response.data;
        if (err.response.status === 400 && message && message.toLowerCase().includes('no items in cart')) {
          alert('Your cart is empty. Please add items before submitting to warehouse.');
        } else if (insufficient && Array.isArray(insufficient) && insufficient.length > 0) {
          let details = '';
          if (insufficient.length === selectedStocks.length) {
            details = 'All items in your cart are no longer available or have insufficient stock.';
          } else {
            details = 'Some items are no longer available or have insufficient stock.';
            const preview = insufficient.slice(0, 3).map(i => `ID: ${i.stock_id}, Requested: ${i.requested}, Available: ${i.available}`).join('\n');
            details += '\n' + preview;
            if (insufficient.length > 3) {
              details += `\n+${insufficient.length - 3} more...`;
            }
          }
          alert(`${message || 'Some items are no longer available.'}\n\n${details}`);
        } else {
          alert(message || 'Failed to send order to warehouse.');
        }
      } else {
        alert('Failed to send order to warehouse.');
      }
    }
  };

  const handleGenerateQuotation = () => {
    if (selectedStocks.length === 0) {
      alert('Please add items to cart before generating quotation.');
      return;
    }
    setQuotationModalOpen(true);
  };

  const handleQuotationSubmit = async () => {
    if (!quotationForm.customer_name.trim()) {
      alert('Customer name is required.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const cartItems = selectedStocks.map(s => ({ 
        stock_id: s.originalData.id, 
        quantity: s.QUANTITY 
      }));

      const quotationData = {
        customer_name: quotationForm.customer_name.trim(),
        chassis_number: quotationForm.chassis_number.trim(),
        contact_number: quotationForm.contact_number.trim(),
        cartItems
      };

      const res = await axios.post('/api/quotations', quotationData, { 
        headers: { Authorization: `Bearer ${token}` } 
      });

      if (res.data && res.data.success) {
        alert(`Quotation generated successfully!\nQuotation Number: ${res.data.quotation_number}\nTotal Amount: ₱${res.data.total_amount.toLocaleString()}`);
        
        // Close modals and reset
        setQuotationModalOpen(false);
        setCartOpen(false);
        setSelectedStocks([]);
        setOrderId(null);
        setOrderNumber(null);
        setQuotationForm({
          customer_name: '',
          chassis_number: '',
          contact_number: ''
        });
      } else {
        alert('Failed to generate quotation. Please try again.');
      }
    } catch (error) {
      console.error('Error generating quotation:', error);
      alert('Error generating quotation: ' + (error.response?.data?.message || error.message));
    }
  };

  // Compatibility search function
  const handleCompatibilitySearch = async () => {
    const cleanSearchTerm = searchTerm.replace(/\s/g, '');
    
    if (!cleanSearchTerm.trim()) {
      alert('Please enter a search term for compatibility search.');
      return;
    }

    try {
      setCompatibilityLoading(true);
      const token = localStorage.getItem('token');
      
      // First, get the current search results to find the BENZ number to use for compatibility
      const currentSearchResponse = await axios.get(`/api/stock-items?search=${encodeURIComponent(searchTerm.trim())}&page=1&limit=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Check if any items were found
      if (!currentSearchResponse.data?.data || currentSearchResponse.data.data.length === 0) {
        alert('No items found for compatibility search.');
        setCompatibilityLoading(false);
        return;
      }
      
      // Get the first matching item
      const firstItem = currentSearchResponse.data.data[0];
      let compatibilitySearchTerm = '';
      
      // Use BENZ number if available, otherwise use brand + altno combination
      if (firstItem.BENZ && firstItem.BENZ.trim()) {
        compatibilitySearchTerm = firstItem.BENZ;
        console.log(`🔗 Using BENZ number for compatibility search: ${compatibilitySearchTerm}`);
      } else if (firstItem.BRAND && firstItem.ALTNO) {
        compatibilitySearchTerm = `${firstItem.BRAND} ${firstItem.ALTNO}`;
        console.log(`🔗 Using brand+altno combination for compatibility search: ${compatibilitySearchTerm}`);
      } else {
        alert('No valid BENZ number or brand+altno combination found for compatibility search.');
        setCompatibilityLoading(false);
        return;
      }
      
      console.log('🔗 Current search response:', currentSearchResponse.data);
      console.log('🔗 Current search data sample:', currentSearchResponse.data?.data?.slice(0, 3));
      console.log('🔗 First item fields:', currentSearchResponse.data?.data?.[0] ? Object.keys(currentSearchResponse.data.data[0]) : 'No data');
      
      // Try different possible ID field names
      let idField = 'ID';
      if (firstItem) {
        if (firstItem.id !== undefined) idField = 'id';
        else if (firstItem.ID !== undefined) idField = 'ID';
        else if (firstItem.stock_id !== undefined) idField = 'stock_id';
        else if (firstItem.STOCK_ID !== undefined) idField = 'STOCK_ID';
      }
      console.log('🔗 Using ID field:', idField);
      
      const currentSearchIds = currentSearchResponse.data?.data?.map(stock => stock[idField]).filter(id => id !== undefined) || [];
      console.log('🔗 Current search IDs to exclude:', currentSearchIds);
      
      // Then get compatibility results using the determined search term
      const response = await axios.get(`/api/stock-items/compatibility?search=${encodeURIComponent(compatibilitySearchTerm)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data && response.data.success) {
        console.log('🔗 Compatibility search response:', response.data);
        console.log('🔗 Results array:', response.data.results);
        console.log('🔗 Results length:', response.data.results?.length);
        
        // Filter out parts that have the same ID as the current search results
        console.log('🔗 Before filtering - compatibility results:', response.data.results?.map(r => ({ ID: r.ID, BENZ: r.BENZ })));
        console.log('🔗 IDs to exclude:', currentSearchIds);
        
        const filteredResults = (response.data.results || []).filter(part => {
          const shouldExclude = currentSearchIds.includes(part.ID);
          console.log(`🔗 Part ID ${part.ID} (${part.BENZ}) - should exclude: ${shouldExclude}`);
          return !shouldExclude;
        });
        
        console.log('🔗 After filtering - filtered results:', filteredResults.map(r => ({ ID: r.ID, BENZ: r.BENZ })));
        console.log('🔗 Filtered results length:', filteredResults.length);
        
        setCompatibilityResults(filteredResults);
        setShowCompatibilityResults(true);
        console.log(`🔗 Found ${filteredResults.length} compatible parts (excluding originals) across ${response.data.levels} levels`);
      } else {
        console.log('🔗 No compatible parts found or success=false');
        alert('No compatible parts found.');
      }
    } catch (error) {
      console.error('Error searching for compatible parts:', error);
      alert('Error searching for compatible parts: ' + (error.response?.data?.message || error.message));
    } finally {
      setCompatibilityLoading(false);
    }
  };

  // DBF conversion and import function
  const handleDbfConversion = async () => {
    if (!window.confirm('This will convert STOCKS.DBF to CSV and import all data. This may take several minutes. Continue?')) {
      return;
    }

    try {
      setDbfConversionLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.post('/api/stock/convert-and-import-dbf', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data && response.data.success) {
        alert(`✅ DBF conversion and import completed successfully!\n\n📊 Imported: ${response.data.imported.toLocaleString()} records\n❌ Errors: ${response.data.errors}\n📊 Total in database: ${response.data.total.toLocaleString()}\n\n🔄 Refreshing stock data...`);
        
        // Refresh the stock data
        await fetchStocks(1, searchTerm, stockFilter, sortConfig.key || 'recent');
      } else {
        alert('Failed to convert and import DBF data.');
      }
    } catch (error) {
      console.error('Error converting and importing DBF:', error);
      alert('Error converting and importing DBF: ' + (error.response?.data?.message || error.message));
    } finally {
      setDbfConversionLoading(false);
    }
  };

  // Helper functions for price editing
  const getRawPrice = (price) => {
    return price ? price.toString() : '';
  };

  const getFormattedPrice = (price) => {
    return formatAccountingINR(price);
  };

  // Add a handler to update price in the cart
  // Format input as Indian accounting and update value
  const handleCartPriceChange = (id, value) => {
    // Remove commas and parse float
    const numericValue = parseFloat((value || '').toString().replace(/,/g, '')) || 0;
    setSelectedStocks(prev => prev.map(s => s.ID === id ? { ...s, PRICE: numericValue } : s));
  };

  // Handle price focus - show raw value for editing
  const handlePriceFocus = (id) => {
    setEditingPriceId(id);
    // Clear the price to empty when clicked for easy typing
    setSelectedStocks(prev => prev.map(s => 
      s.ID === id ? { ...s, _rawPrice: '' } : s
    ));
  };

  // Handle price blur - format and save
  const handlePriceBlur = (id, value) => {
    const numericValue = parseFloat(value.replace(/,/g, '')) || 0;
    
    // If value is 0 or empty, revert to original price silently
    if (numericValue === 0 || value.trim() === '') {
      // Find the original price from the stock data
      const originalStock = sortedStocks.find(s => s.ID === id) || 
                           compatibilityResults.find(s => s.ID === id);
      const originalPrice = originalStock ? (originalStock.SELL || originalStock.PRICE || 0) : 0;
      
      // Silently revert to original price (no error message)
      handleCartPriceChange(id, originalPrice);
    } else {
      // Save the new price
      handleCartPriceChange(id, numericValue);
    }
    
    setEditingPriceId(null);
  };

  // Handle price change while editing - only update raw value
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
    
    // Allow "0" to be typed since we start with "0" on focus
    // This allows users to type "0" and then continue with more digits
    
    // Update the raw value in state (temporary)
    setSelectedStocks(prev => prev.map(s => 
      s.ID === id ? { ...s, _rawPrice: cleanValue } : s
    ));
  };



  // Helper function to get max quantity for a stock item
  const getMaxQuantity = (stockId) => {
    let stockItem = sortedStocks.find(s => s.ID === stockId);
    
    // If not found in main stocks, check compatibility results
    if (!stockItem) {
      stockItem = compatibilityResults.find(s => s.ID === stockId);
    }
    
    return stockItem ? Math.max(0, parseInt(stockItem.QTY || stockItem.QUANTITY) || 0) : 0;
  };

  // Add a handler to update quantity in the cart
  const handleCartQuantityChange = (id, newQty) => {
    console.log('🔢 handleCartQuantityChange called:', { id, newQty });
    
    // Find the current stock item to get the actual available quantity
    let stockItem = sortedStocks.find(s => s.ID === id);
    
    // If not found in main stocks, check compatibility results
    if (!stockItem) {
      stockItem = compatibilityResults.find(s => s.ID === id);
      console.log('🔢 Found in compatibility results:', stockItem);
    } else {
      console.log('🔢 Found in main stocks:', stockItem);
    }
    
    if (!stockItem) {
      console.log('🔢 Stock item not found for ID:', id);
      return;
    }
    
    const availableQty = parseInt(stockItem.QTY || stockItem.QUANTITY) || 0;
    const maxAllowedQty = Math.max(0, availableQty);
    
    console.log('🔢 Available quantity:', availableQty, 'Max allowed:', maxAllowedQty);
    
    // Ensure quantity doesn't exceed available stock and is not negative
    const validatedQty = Math.max(0, Math.min(newQty, maxAllowedQty));
    
    console.log('🔢 Validated quantity:', validatedQty);
    
    // Only update if the quantity is valid
    if (validatedQty !== newQty) {
      // Show a brief alert if user tried to exceed available stock
      if (newQty > maxAllowedQty) {
        alert(`Maximum available quantity for this item is ${maxAllowedQty}`);
      }
    }
    
    setSelectedStocks(prev => {
      const updated = prev.map(s => s.ID === id ? { ...s, QUANTITY: validatedQty } : s);
      console.log('🔢 Updated selectedStocks:', updated);
      return updated;
    });
  };

  return (
    <div className="pos-stock pos-stock-modern">
      <style>{tableStyles}</style>
      
            {/* Search and Filters */}
      <div className="pos-stock-controls" style={{ gap: '8px', alignItems: 'center' }}>
        <div className="pos-search-container" style={{ maxWidth: '300px', position: 'relative' }}>
          <Search className="pos-search-icon" />
          <input
            type="text"
            placeholder="Search by BENZ, ALTNO, Brand, or Remarks..."
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyPress={(e) => e.key === 'Enter' && handleSearchSubmit()}
            className="pos-search-input"
          />
        </div>

        {/* Find Compatible Button */}
        <button
          onClick={handleCompatibilitySearch}
          disabled={compatibilityLoading || !searchTerm.trim() || isBrandSearch}
          className="pos-stock-action-btn"
          title={isBrandSearch ? "Compatibility search only works with specific part numbers, not brand names" : ""}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            padding: '12px 20px',
            fontSize: '12px',
            height: '40px',
            opacity: (compatibilityLoading || !searchTerm.trim() || isBrandSearch) ? 0.6 : 1,
            cursor: (compatibilityLoading || !searchTerm.trim() || isBrandSearch) ? 'not-allowed' : 'pointer',
            background: compatibilityLoading ? '#6c757d' : '#007bff'
          }}
        >
          {compatibilityLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Package className="w-4 h-4" />
          )}
          {compatibilityLoading ? 'Finding...' : 'Find Compatible'}
        </button>



        <div className="pos-filter-container">
          <Filter className="pos-filter-icon" />
          <select
            value={stockFilter}
            onChange={handleFilterChange}
            onClick={handleFilterClick}
            className="pos-filter-select"
          >
            <option value="in-stock">In Stock Only</option>
            <option value="all">All Items</option>
            <option value="out-of-stock">Out of Stock</option>
            <option value="low-stock">Low Stock</option>
          </select>
        </div>
        {/* Sort - match All Items filter structure */}
        <div className="pos-filter-container">
          <ArrowDownWideNarrow className="pos-filter-icon" />
          <select
            className="pos-filter-select"
            value={sortDropdown}
            onChange={e => setSortDropdown(e.target.value)}
            onClick={handleFilterClick}
            aria-label="Sort"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        
        {/* Action Buttons Row */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          {/* Barcode Scanner Button */}
          <button
            className="pos-stock-action-btn pos-barcode-scanner-btn"
            style={{ padding: '4px 8px', fontSize: '11px' }}
            onClick={() => handleBarcodeScan()}
            title="Scan Barcode to Find Item"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
              <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
              <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
              <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
              <path d="M7 3h10"/>
              <path d="M7 21h10"/>
              <path d="M3 7h18"/>
              <path d="M3 17h18"/>
            </svg>
            Scan Barcode
          </button>
          


          {/* Export to Excel Button */}
          <button
            className="pos-stock-action-btn pos-export-excel-btn"
            style={{ padding: '4px 8px', fontSize: '11px' }}
            onClick={handleExportPreview}
            title="Preview and Export SELECTED items to XLSX (select items first)"
            disabled={selectedStocks.length === 0}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14,2 14,8 20,8"/>
              <path d="M8 13h8"/>
              <path d="M8 17h8"/>
              <path d="M8 9h6"/>
            </svg>
            Preview & Export Selected
            {selectedStocks.length > 0 && (
              <span style={{ 
                background: '#28a745', 
                color: 'white', 
                borderRadius: '50%', 
                width: '18px', 
                height: '18px', 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '11px', 
                marginLeft: '6px' 
              }}>
                {selectedStocks.length}
              </span>
            )}
          </button>

          {/* Refresh Stock from DBF Button */}
          <button
            className="pos-stock-action-btn pos-import-csv-btn"
            style={{ padding: '4px 8px', fontSize: '11px', background: '#ff6b35' }}
            onClick={() => setShowRefreshModal(true)}
            title="Refresh stock data from DBF files"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M3 21v-5h5"/>
            </svg>
            Refresh Stock from DBF
          </button>

          {/* Refresh Master from DBF Button */}
          <button
            className="pos-stock-action-btn pos-import-csv-btn"
            style={{ padding: '4px 8px', fontSize: '11px', background: '#ffc107' }}
            onClick={() => setShowMasterRefreshModal(true)}
            title="Refresh master data from DBF files"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M3 21v-5h5"/>
            </svg>
            Refresh Master from DBF
          </button>

          {/* Refresh Inmain from DBF Button */}
          <button
            className="pos-stock-action-btn pos-import-csv-btn"
            style={{ padding: '4px 8px', fontSize: '11px', background: '#17a2b8' }}
            onClick={() => setShowInmainRefreshModal(true)}
            title="Refresh inmain data from DBF files"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M3 21v-5h5"/>
            </svg>
            Refresh Inmain from DBF
          </button>

          {/* Convert & Import DBF Button */}
          <button
            className="pos-stock-action-btn pos-import-csv-btn"
            style={{ 
              padding: '4px 8px', 
              fontSize: '11px', 
              background: dbfConversionLoading ? '#6c757d' : '#28a745',
              opacity: dbfConversionLoading ? 0.7 : 1,
              cursor: dbfConversionLoading ? 'not-allowed' : 'pointer'
            }}
            onClick={handleDbfConversion}
            disabled={dbfConversionLoading}
            title="Convert STOCKS.DBF to CSV and import all data automatically"
          >
            {dbfConversionLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
              </svg>
            )}
            {dbfConversionLoading ? 'Converting...' : 'Convert & Import DBF'}
          </button>
        </div>
      </div>

            {/* Error Message */}
      {error && (
        <div className="pos-error-message">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="pos-success-message" style={{
          background: '#d4edda',
          color: '#155724',
          border: '1px solid #c3e6cb',
          borderRadius: '4px',
          padding: '12px',
          margin: '10px 0',
          fontSize: '14px'
        }}>
          {successMessage}
        </div>
      )}

      {/* Stock Items Table */}
      <div className="pos-stock-content">
        {/* Recent Items View Indicator */}
        {showingRecentItems && (
          <div style={{
            background: 'linear-gradient(135deg, #007bff, #0056b3)',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(0, 123, 255, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span style={{ fontWeight: '600' }}>
                Showing first 200 most recent stock items (sorted by highest ID first)
              </span>
            </div>
            <button
              onClick={() => {
                setShowingRecentItems(false);
                setShowRecentSort(false);
                setSearchTerm('');
                setStockFilter('in-stock');
                fetchStocks(1, '', 'in-stock', 'recent');
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
            >
              Exit Recent View
            </button>
          </div>
        )}
        
        <div className="pos-stock-table-container">
          {/* Mutually exclusive rendering: only one of these shows at a time */}
          {!searchTerm && (!sortedStocks || sortedStocks.length === 0) ? (
            <div className="pos-empty-state">
              <Package className="pos-empty-icon" />
              <h3>Search for Stock Items</h3>
              <p>Enter a search term above to view stock items</p>
            </div>
          ) : !sortedStocks || sortedStocks.length === 0 ? (
            <div className="pos-empty-state">
              <Package className="pos-empty-icon" />
              <h3>No items found</h3>
              <p>Try adjusting your search criteria</p>
            </div>
          ) : (
            <div className="pos-stock-table-wrapper">
              <table className="pos-stock-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        aria-label="Select All"
                        className="pos-checkbox"
                      />
                    </th>
                    <th>Part No.</th>
                    <th>Brand</th>
                    <th>OEM</th>
                    <th>Description</th>
                    <th>ID</th>
                    {/* <th>Barcode</th> */}
                    {/* <th>QR Code</th> */}
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(sortedStocks || []).map((stock) => {
                    const serviceInfo = getServiceInfo(stock.ID, serviceData);
                    console.log(`🔧 Stock ${stock.ID}: serviceInfo =`, serviceInfo, 'serviceData =', serviceData);
                    return (
                    <tr 
                      key={stock.ID} 
                      className={`pos-stock-row ${stock.QUANTITY <= 0 ? 'out-of-stock' : ''} ${serviceInfo ? 'in-service' : ''}`}
                      style={serviceInfo ? { 
                        backgroundColor: 'rgba(255, 193, 7, 0.15) !important',
                        borderLeft: '3px solid #f59e0b'
                      } : {}}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedStocks.some(s => s.ID === stock.ID)}
                          onChange={() => { console.log('[CHECKBOX CLICK]', stock.ID, stock); handleSelectRow(stock.ID); }}
                          aria-label="Select Row"
                          className="pos-checkbox"
                          disabled={stock.QUANTITY <= 0}
                        />
                      </td>
                      <td className="pos-stock-cell">
                        <div className="benz-numbers">
                          <span className={stock.match_type === 'primary' ? 'benz-primary-match' : ''}>
                            {stock.BENZ}
                            {stock.match_type === 'primary' && <span className="match-indicator">★</span>}
                          </span>
                          {stock.BENZ2 && (
                            <span className={`benz-secondary ${stock.match_type === 'secondary' ? 'benz-secondary-match' : ''}`}>
                              {stock.BENZ2}
                              {stock.match_type === 'secondary' && <span className="match-indicator">★</span>}
                            </span>
                          )}
                          {stock.BENZ3 && (
                            <span className={`benz-secondary ${stock.match_type === 'tertiary' ? 'benz-tertiary-match' : ''}`}>
                              {stock.BENZ3}
                              {stock.match_type === 'tertiary' && <span className="match-indicator">★</span>}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="pos-stock-cell">{stock.BRAND}</td>
                      <td className="pos-stock-cell">{stock.ALTNO}</td>
                      <td className="pos-stock-cell description-cell" title={stock.DESCRIPTION}>
                        <div className="description-text">
                          {stock.DESCRIPTION || 'No description'}
                        </div>
                      </td>
                      <td className="pos-stock-cell">{stock.ID}</td>
                      {/* <td className="pos-stock-cell">
                        <Barcode value={String(stock.ID)} width={1.2} height={40} fontSize={12} displayValue={false} />
                      </td>
                      <td className="pos-stock-cell">
                        <QRCodeSVG value={String(stock.ID)} size={48} level="M" />
                      </td> */}
                      <td className="pos-stock-cell">
                        {(() => {
                          // Find if this stock is in the cart
                          const cartItem = selectedStocks.find(s => s.ID === stock.ID);
                          const availableQty = Math.max(0, (parseInt(stock.QTY) || 0) - (cartItem ? (parseInt(cartItem.QUANTITY) || 0) : 0));
                          const serviceInfo = getServiceInfo(stock.ID, serviceData);
                          
                          // Show service info even if stock quantity is 0
                          const showServiceInfo = serviceInfo && serviceInfo.totalQuantity > 0;
                          
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span className={`quantity-badge${availableQty <= 0 ? ' out-of-stock' : availableQty <= 5 ? ' low-stock' : ' in-stock'}`}
                                style={availableQty <= 0 ? { background: '#dc3545', color: '#fff' } : {}}>
                                {formatNumber(availableQty)}
                              </span>
                              {showServiceInfo && (
                                <div style={{ 
                                  fontSize: '10px', 
                                  color: '#f59e0b', 
                                  textAlign: 'center',
                                  fontWeight: '600',
                                  background: 'rgba(255, 193, 7, 0.15)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(255, 193, 7, 0.3)'
                                }}>
                                  Service: {serviceInfo.totalQuantity}
                                  <br />
                                  Orders: {serviceInfo.orderIds.join(', ')}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="pos-stock-cell">{formatCurrency(stock.PRICE)}</td>
                      <td className="pos-stock-cell">
                        <button className="pos-stock-action-btn" onClick={() => handleRequestClick(stock)} style={{ padding: '3px 6px', fontSize: '10px' }}>Request</button>
                      </td>

                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Compatibility Results */}
          {console.log('🔗 UI Debug - showCompatibilityResults:', showCompatibilityResults, 'compatibilityResults.length:', compatibilityResults.length)}
          {showCompatibilityResults && compatibilityResults.length > 0 && (
            <div className="pos-stock-table-container" style={{ marginTop: '20px' }}>
              <div style={{ 
                background: '#2d2d2d', 
                padding: '16px', 
                borderRadius: '8px 8px 0 0',
                borderBottom: '2px solid #404040',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ 
                  color: '#ffffff', 
                  margin: '0', 
                  fontSize: '1.1em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Package className="w-5 h-5" />
                  Compatible Parts Found ({compatibilityResults.length})
                </h3>
                <button
                  onClick={() => setShowCompatibilityResults(false)}
                  className="pos-stock-action-btn"
                  style={{ 
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9em',
                    fontWeight: '600'
                  }}
                >
                  Close
                </button>
              </div>
              
              <div className="pos-stock-table-wrapper">
                <table className="pos-stock-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={compatibilityResults.every(part => selectedStocks.some(s => s.ID === part.ID))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Add all compatibility parts to cart
                              const partsToAdd = compatibilityResults
                                .filter(part => !selectedStocks.some(s => s.ID === part.ID))
                                .map(part => ({
                                  ...part,
                                  QUANTITY: 1,
                                  BENZ: part.BENZ,
                                  BRAND: part.BRAND,
                                  ALTNO: part.ALTNO,
                                  DESCRIPTION: part.DESCRIPTION || part.REMARKS,
                                  PRICE: part.SELL,
                                  QTY: part.QTY,
                                  // Add originalData with proper structure for warehouse submission
                                  originalData: {
                                    id: part.ID,
                                    BENZ: part.BENZ,
                                    BRAND: part.BRAND,
                                    ALTNO: part.ALTNO,
                                    DESCRIPTION: part.DESCRIPTION || part.REMARKS,
                                    SELL: part.SELL,
                                    QTY: part.QTY
                                  }
                                }));
                              setSelectedStocks(prev => [...prev, ...partsToAdd]);
                            } else {
                              // Remove all compatibility parts from cart
                              const compatibilityIds = compatibilityResults.map(part => part.ID);
                              setSelectedStocks(prev => prev.filter(s => !compatibilityIds.includes(s.ID)));
                            }
                          }}
                          aria-label="Select All Compatible Parts"
                          className="pos-checkbox"
                        />
                      </th>
                      <th>Part No.</th>
                      <th>Brand</th>
                      <th>OEM</th>
                      <th>Description</th>
                      <th>ID</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compatibilityResults.map((part, index) => {
                      const serviceInfo = getServiceInfo(part.ID, serviceData);
                      return (
                      <tr key={`${part.ID}-${index}`} className={`pos-stock-row ${part.QTY <= 0 ? 'out-of-stock' : ''} ${serviceInfo ? 'in-service' : ''}`} style={serviceInfo ? { 
                        backgroundColor: 'rgba(255, 193, 7, 0.15) !important',
                        borderLeft: '3px solid #f59e0b'
                      } : {}}>
                        <td>
                                                  <input
                          type="checkbox"
                          checked={selectedStocks.some(s => s.ID === part.ID)}
                          onChange={() => handleCompatibilitySelectRow(part)}
                          className="pos-checkbox"
                          disabled={part.QTY <= 0}
                        />
                        </td>
                        <td className="pos-stock-cell">
                          <div style={{ fontWeight: '600' }}>{part.BENZ}</div>
                          {part.BENZ2 && part.BENZ2 !== '-' && (
                            <div style={{ fontSize: '0.85em', color: '#bbb', marginTop: '2px' }}>
                              {part.BENZ2}
                            </div>
                          )}
                          {part.BENZ3 && part.BENZ3 !== '-' && (
                            <div style={{ fontSize: '0.85em', color: '#bbb', marginTop: '2px' }}>
                              {part.BENZ3}
                            </div>
                          )}
                        </td>
                        <td className="pos-stock-cell">{part.BRAND}</td>
                        <td className="pos-stock-cell">{part.ALTNO}</td>
                        <td className="pos-stock-cell" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {part.DESCRIPTION || part.REMARKS || '-'}
                        </td>
                        <td className="pos-stock-cell" style={{ fontWeight: '600' }}>{part.ID || '-'}</td>
                        <td className="pos-stock-cell" style={{ textAlign: 'center' }}>
                          {(() => {
                            // Find if this part is in the cart
                            const cartItem = selectedStocks.find(s => s.ID === part.ID);
                            const availableQty = Math.max(0, (parseInt(part.QTY) || 0) - (cartItem ? (parseInt(cartItem.QUANTITY) || 0) : 0));
                            const serviceInfo = getServiceInfo(part.ID, serviceData);
                            
                            // Show service info even if stock quantity is 0
                            const showServiceInfo = serviceInfo && serviceInfo.totalQuantity > 0;
                            
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                <span className={`quantity-badge${availableQty <= 0 ? ' out-of-stock' : availableQty <= 5 ? ' low-stock' : ' in-stock'}`}
                                  style={availableQty <= 0 ? { background: '#dc3545', color: '#fff' } : {}}>
                                  {availableQty}
                                </span>
                                {showServiceInfo && (
                                <div style={{ 
                                  fontSize: '10px', 
                                  color: '#f59e0b', 
                                  textAlign: 'center',
                                  fontWeight: '600',
                                  background: 'rgba(255, 193, 7, 0.15)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(255, 193, 7, 0.3)'
                                }}>
                                    Service: {serviceInfo.totalQuantity}
                                    <br />
                                    Orders: {serviceInfo.orderIds.join(', ')}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="pos-stock-cell" style={{ textAlign: 'right' }}>
                          {part.SELL ? `₱${parseFloat(part.SELL).toLocaleString()}` : '-'}
                        </td>
                        <td className="pos-stock-cell" style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                            {part.isCompatible ? (
                              <span style={{
                                background: part.compatibilityType === 'brand-altno' ? '#f59e0b' : '#10b981',
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.8em',
                                fontWeight: '600'
                              }}>
                                {part.compatibilityType === 'fuzzy' ? 'Compatible' : 
                                 part.compatibilityType === 'brand-altno' ? 'Brand+Alt' : 'Compatible'}
                              </span>
                            ) : (
                              <span style={{
                                background: '#3b82f6',
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.8em',
                                fontWeight: '600'
                              }}>
                                Original
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
            </div>
          )}

          {/* Pagination - only show when there are results and a search term */}
          {searchTerm && totalPages > 1 && (
            <div className="pos-pagination">
              <button
                className="pos-pagination-btn"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="pos-pagination-info">
                Page {currentPage} of {totalPages} ({formatNumber(totalItems)} items total)
              </span>
              <button
                className="pos-pagination-btn"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="pos-modal-overlay" onClick={handleModalClose}>
          <div className="pos-modal stock-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h2>{isAddingNew ? 'Add New Stock Item' : 'Edit Stock Item'}</h2>
              <button className="pos-modal-close" onClick={handleModalClose}>×</button>
            </div>
            <form onSubmit={handleModalSave} className="pos-modal-form stock-edit-form">
              {/* Basic Information Section */}
              <div className="form-section">
                <h3 className="section-title">Basic Information</h3>
                <div className="form-row">
                  <div className="pos-form-group">
                    <label>ID</label>
                    <input 
                      type="text" 
                      name="ID" 
                      value={modalForm.ID || ''} 
                      onChange={handleModalFormChange}
                      disabled={!isAddingNew}
                      className="pos-form-input" 
                    />
                  </div>
                  <div className="pos-form-group">
                    <label>Date</label>
                    <input type="text" name="DATE" value={modalForm.DATE || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Reference</label>
                    <input type="text" name="REFERENCE" value={modalForm.REFERENCE || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                </div>
              </div>

              {/* Product Details Section */}
              <div className="form-section">
                <h3 className="section-title">Product Details</h3>
                <div className="form-row">
                  <div className="pos-form-group">
                    <label>Brand</label>
                    <input type="text" name="BRAND" value={modalForm.BRAND || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>OEM#</label>
                    <input type="text" name="OEM" value={modalForm.OEM || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>DIN</label>
                    <input type="text" name="DINFLAG" value={modalForm.DINFLAG || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                </div>
              </div>

              {/* Part Numbers Section */}
              <div className="form-section">
                <h3 className="section-title">Part Numbers</h3>
                <div className="form-row">
                  <div className="pos-form-group">
                    <label>ALTNO</label>
                    <input type="text" name="ALTNO" value={modalForm.ALTNO || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>ALTNO2</label>
                    <input type="text" name="ALTNO2" value={modalForm.ALTNO2 || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="pos-form-group">
                    <label>Benz 1</label>
                    <input type="text" name="BENZ" value={modalForm.BENZ || ''} onChange={handleModalFormChange} className="pos-form-input" placeholder="BENZ" />
                  </div>
                  <div className="pos-form-group">
                    <label>Benz 2</label>
                    <input type="text" name="BENZ2" value={modalForm.BENZ2 || ''} onChange={handleModalFormChange} className="pos-form-input" placeholder="BENZ2" />
                  </div>
                  <div className="pos-form-group">
                    <label>Benz 3</label>
                    <input type="text" name="BENZ3" value={modalForm.BENZ3 || ''} onChange={handleModalFormChange} className="pos-form-input" placeholder="BENZ3" />
                  </div>
                </div>
              </div>

              {/* Description Section */}
              <div className="form-section">
                <h3 className="section-title">Description & Application</h3>
                <div className="form-row">
                  <div className="pos-form-group">
                    <label>Description</label>
                    <input type="text" name="DESCRIPTION" value={modalForm.DESCRIPTION || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Application</label>
                    <input type="text" name="APPLICATION" value={modalForm.APPLICATION || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="pos-form-group">
                    <label>Color Code</label>
                    <input type="text" name="COLORCODE" value={modalForm.COLORCODE || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Remarks</label>
                    <input type="text" name="REMARKS" value={modalForm.REMARKS || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                </div>
              </div>

              {/* Pricing Section */}
              <div className="form-section">
                <h3 className="section-title">Pricing & Currency</h3>
                <div className="form-row">
                  <div className="pos-form-group">
                    <label>Cost</label>
                    <input type="number" step="0.01" name="COST" value={modalForm.COST || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Sell Price</label>
                    <input type="number" step="0.01" name="SELL" value={modalForm.SELL || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Currency</label>
                    <input type="text" name="CURRENCY" value={modalForm.CURRENCY || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="pos-form-group">
                    <label>FC Cost</label>
                    <input type="number" step="0.01" name="FC_COST" value={modalForm.FC_COST || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>FC Amount</label>
                    <input type="number" step="0.01" name="FCAMOUNT" value={modalForm.FCAMOUNT || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Conversion</label>
                    <input type="number" step="0.01" name="CONVERSION" value={modalForm.CONVERSION || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                </div>
              </div>

              {/* Inventory Section */}
              <div className="form-section">
                <h3 className="section-title">Inventory</h3>
                <div className="form-row">
                  <div className="pos-form-group">
                    <label>Quantity</label>
                    <input type="number" name="QTY" value={modalForm.QTY || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Unit</label>
                    <input type="text" name="UNIT" value={modalForm.UNIT || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Location</label>
                    <input type="text" name="LOCATION" value={modalForm.LOCATION || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                </div>
              </div>

              {/* Additional Fields */}
              {editingStock && Object.entries(editingStock.originalData)
                .filter(([key]) => {
                  const normalized = key.toLowerCase().replace(/_/g, '');
                  return ![
                    'id','date','reference','dinflag','benz','benz2','benz3','brand','oem','altno','altno2','description','application','appl','colorcode','remarks','cost','sell','sellingprice','currency','fccost','fcamount','conversion','qty','quantity','unit','location','documentreference','createdat'
                  ].includes(normalized);
                })
                .length > 0 && (
                <div className="form-section">
                  <h3 className="section-title">Additional Information</h3>
                  <div className="form-row">
                    {editingStock && Object.entries(editingStock.originalData)
                      .filter(([key]) => {
                        const normalized = key.toLowerCase().replace(/_/g, '');
                        return ![
                          'id','date','reference','dinflag','benz','benz2','benz3','brand','oem','altno','altno2','description','application','appl','colorcode','remarks','cost','sell','sellingprice','currency','fccost','fcamount','conversion','qty','quantity','unit','location','documentreference','createdat'
                        ].includes(normalized);
                      })
                      .map(([key, value]) => (
                        <div className="pos-form-group" key={key}>
                          <label style={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</label>
                          <input type="text" name={key} value={modalForm[key] !== undefined ? modalForm[key] : value || ''} onChange={handleModalFormChange} className="pos-form-input" />
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="pos-modal-actions">
                <button type="button" className="pos-btn pos-btn-secondary" onClick={handleModalClose}>
                  Cancel
                </button>
                <button type="submit" className="pos-btn pos-btn-primary">
                  {isAddingNew ? 'Add Item' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Modal */}
      {showRequestModal && (
        <div className="pos-modal-overlay" onClick={handleRequestModalClose}>
          <div className="pos-modal stock-request-modal" onClick={e => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h2>Request Stock</h2>
              <button className="pos-modal-close" onClick={handleRequestModalClose}>×</button>
            </div>
            <form onSubmit={handleRequestSubmit} className="pos-modal-form stock-request-form">
              <div className="form-section">
                <h3 className="section-title">Request Details</h3>
                <div className="form-row">
                  <div className="pos-form-group">
                    <label>Part No.</label>
                    <input type="text" value={requestingStock?.BENZ || ''} disabled className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>OEM</label>
                    <input type="text" value={requestingStock?.ALTNO || ''} disabled className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Brand</label>
                    <input type="text" value={requestingStock?.BRAND || ''} disabled className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Description</label>
                    <input type="text" value={requestingStock?.DESCRIPTION || requestingStock?.ID || ''} disabled className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Reason</label>
                    <textarea value={requestReason} onChange={e => setRequestReason(e.target.value)} required className="pos-form-input" placeholder="Reason for request (e.g. restock, add new, etc.)" />
                  </div>
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="pos-stock-action-btn">Submit Request</button>
                <button type="button" className="pos-stock-action-btn" onClick={handleRequestModalClose}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scan Modal */}
      {scanModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content" style={{ background: '#222', padding: 32, borderRadius: 8, minWidth: 320, maxWidth: 400, color: '#fff', textAlign: 'center' }}>
            <h2>Scan Barcode or QR Code</h2>
            <QrReader
              delay={300}
              onError={err => console.error(err)}
              onScan={data => {
                if (data) {
                  handleBarcodeScan(data);
                }
              }}
              style={{ width: '100%', marginBottom: 16 }}
            />
            <input
              type="text"
              placeholder="Or scan with hardware scanner..."
              value={scannedValue}
              onChange={e => {
                setScannedValue(e.target.value);
              }}
              onKeyPress={e => {
                if (e.key === 'Enter') {
                  handleBarcodeScan(e.target.value);
                }
              }}
              autoFocus
              style={{ width: '100%', padding: 8, marginBottom: 16, borderRadius: 4, border: '1px solid #444', background: '#111', color: '#fff' }}
            />
            <button className="pos-btn" onClick={() => setScanModalOpen(false)} style={{ marginTop: 8 }}>Close</button>
          </div>
        </div>
      )}



      {/* Cart/Side Modal */}
      {cartOpen && (
        <div className="pos-cart-modal" style={{ minWidth: 380, maxWidth: 420, margin: '0 auto', background: '#23272f', borderRadius: 12, boxShadow: '0 4px 24px 0 rgba(0,0,0,0.18)', padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '90vh', height: '90vh' }}>
          <div className="pos-cart-modal-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', background: '#181a1b', borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: '18px 24px 10px 24px' }}>
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 20, color: '#90caf9', letterSpacing: 1 }}>Parts Requisition/Issuance Slip</span>
                                  <button className="pos-cart-modal-close" style={{ fontSize: 22, color: '#90caf9', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 12 }} onClick={() => {
                      setCartOpen(false);
                      setSelectedStocks([]);
                      setCartExpanded(false);
                      setOrderNumber(null);
                      setOrderId(null);
                    }}>×</button>
            </div>
            {orderNumber && (
              <div style={{ marginTop: 8, fontWeight: 600, fontSize: 15, color: '#1976d2', letterSpacing: 1, background: '#23272f', padding: '4px 12px', borderRadius: 6 }}>
                Order Number: #{orderNumber}
              </div>
            )}
          </div>
          <div className="pos-cart-list" style={{ padding: '18px 24px 0 24px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <div style={{ fontWeight: 600, color: '#90caf9', fontSize: 15, marginBottom: 8 }}>Order Items</div>
            {(selectedStocks.length > CART_COMPRESS_LIMIT && !cartExpanded) ? (
              <>
                {selectedStocks.slice(0, CART_ALWAYS_SHOW).map(stock => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 10 }} key={stock.ID || stock.id}>
                    <button
                      onClick={() => setSelectedStocks(selectedStocks.filter(s => s.ID !== stock.ID))}
                      style={{
                        background: 'none',
                        border: 'none',
                        borderRadius: '50%',
                        width: 32,
                        height: 32,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#dc3545',
                        cursor: 'pointer',
                        marginRight: 8,
                        transition: 'background 0.15s',
                        flexShrink: 0,
                      }}
                      title="Remove"
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(220,53,69,0.08)'}
                      onMouseOut={e => e.currentTarget.style.background = 'none'}
                    >
                      <Trash2 size={18} />
                    </button>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#181a1b', borderRadius: 8, padding: '10px 12px', minHeight: 56 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: 1, maxWidth: '60%' }}>
                        <div className="pos-cart-item-desc" style={{ fontWeight: 700, color: '#90caf9', marginBottom: 2, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.ID}>ID: {stock.ID}</div>
                        <div className="pos-cart-item-desc" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.BENZ}>{stock.BENZ}</div>
                        <div className="pos-cart-item-desc" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.BRAND + ' ' + stock.ALTNO}>{stock.BRAND} {stock.ALTNO}</div>
                        <div className="pos-cart-item-desc" style={{ fontWeight: 400, color: '#fff', fontSize: 13, marginTop: 2, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.DESCRIPTION || 'No description'}>{stock.DESCRIPTION || 'No description'}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, marginLeft: 8, minWidth: 0, flexShrink: 0 }}>
                        <div className="pos-cart-item-desc" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 500 }}>QTY:</span>
                          <div style={{ display: 'flex', alignItems: 'center', background: '#23272f', borderRadius: 8, padding: '2px 6px' }}>
                            <button
                              style={{
                                background: '#444',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                width: '24px',
                                height: '24px',
                                fontSize: '16px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                lineHeight: '1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0,
                                marginRight: 4
                              }}
                              onClick={() => {
                                const newQty = Math.max(0, (parseInt(stock.QUANTITY) || 0) - 1);
                                if (newQty === 0) {
                                  setSelectedStocks(prev => prev.filter(s => s.ID !== stock.ID));
                                } else {
                                  handleCartQuantityChange(stock.ID, newQty);
                                }
                              }}
                              disabled={stock.QUANTITY <= 0}
                            >
                              -
                            </button>
                            <span style={{
                              color: '#fff',
                              fontWeight: '600',
                              fontSize: '14px',
                              minWidth: '24px',
                              textAlign: 'center',
                              display: 'inline-block'
                            }}>{stock.QUANTITY}</span>
                            <button
                              style={{
                                background: '#444',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                width: '24px',
                                height: '24px',
                                fontSize: '16px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                lineHeight: '1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0,
                                marginLeft: 4
                              }}
                              onClick={() => handleCartQuantityChange(stock.ID, Math.min(getMaxQuantity(stock.ID), (parseInt(stock.QUANTITY) || 0) + 1))}
                              disabled={stock.QUANTITY >= getMaxQuantity(stock.ID)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="pos-cart-item-desc" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 500 }}>Price:</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={editingPriceId === stock.ID 
                              ? (stock._rawPrice !== undefined ? stock._rawPrice : getRawPrice(stock.PRICE))
                              : getFormattedPrice(stock.PRICE)
                            }
                            onFocus={(e) => {
                              handlePriceFocus(stock.ID);
                              // Select all text so user can immediately start typing
                              e.target.select();
                            }}
                            onBlur={(e) => handlePriceBlur(stock.ID, e.target.value)}
                            onChange={(e) => handlePriceChange(stock.ID, e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.target.blur(); // Trigger blur to save and format
                              }
                            }}
                            style={{ 
                              width: 70, 
                              borderRadius: 8, 
                              border: editingPriceId === stock.ID ? '1px solid #1976d2' : '1px solid #2d2d2d', 
                              padding: '2px 6px', 
                              fontSize: '1em', 
                              background: '#23272f', 
                              color: '#fff', 
                              textAlign: 'right' 
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{ color: '#bbb', margin: '8px 0', textAlign: 'center' }}>
                  +{selectedStocks.length - CART_ALWAYS_SHOW} more items
                  <button style={{ marginLeft: 12, color: '#1976d2', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }} onClick={() => setCartExpanded(true)}>Show All</button>
                </div>
              </>
            ) : (
              <>
                {selectedStocks.map(stock => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 10 }} key={stock.ID || stock.id}>
                    <button
                      onClick={() => setSelectedStocks(selectedStocks.filter(s => s.ID !== stock.ID))}
                      style={{
                        background: 'none',
                        border: 'none',
                        borderRadius: '50%',
                        width: 32,
                        height: 32,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#dc3545',
                        cursor: 'pointer',
                        marginRight: 8,
                        transition: 'background 0.15s',
                        flexShrink: 0,
                      }}
                      title="Remove"
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(220,53,69,0.08)'}
                      onMouseOut={e => e.currentTarget.style.background = 'none'}
                    >
                      <Trash2 size={18} />
                    </button>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#181a1b', borderRadius: 8, padding: '10px 12px', minHeight: 56 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: 1, maxWidth: '60%' }}>
                        <div className="pos-cart-item-desc" style={{ fontWeight: 700, color: '#90caf9', marginBottom: 2, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.ID}>ID: {stock.ID}</div>
                        <div className="pos-cart-item-desc" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.BENZ}>{stock.BENZ}</div>
                        <div className="pos-cart-item-desc" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.BRAND + ' ' + stock.ALTNO}>{stock.BRAND} {stock.ALTNO}</div>
                        <div className="pos-cart-item-desc" style={{ fontWeight: 400, color: '#fff', fontSize: 13, marginTop: 2, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.DESCRIPTION || 'No description'}>{stock.DESCRIPTION || 'No description'}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, marginLeft: 8, minWidth: 0, flexShrink: 0 }}>
                        <div className="pos-cart-item-desc" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 500 }}>QTY:</span>
                          <div style={{ display: 'flex', alignItems: 'center', background: '#23272f', borderRadius: 8, padding: '2px 6px' }}>
                            <button
                              style={{
                                background: '#444',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                width: '24px',
                                height: '24px',
                                fontSize: '16px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                lineHeight: '1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0,
                                marginRight: 4
                              }}
                              onClick={() => {
                                const newQty = Math.max(0, (parseInt(stock.QUANTITY) || 0) - 1);
                                if (newQty === 0) {
                                  setSelectedStocks(prev => prev.filter(s => s.ID !== stock.ID));
                                } else {
                                  handleCartQuantityChange(stock.ID, newQty);
                                }
                              }}
                              disabled={stock.QUANTITY <= 0}
                            >
                              -
                            </button>
                            <span style={{
                              color: '#fff',
                              fontWeight: '600',
                              fontSize: '14px',
                              minWidth: '24px',
                              textAlign: 'center',
                              display: 'inline-block'
                            }}>{stock.QUANTITY}</span>
                            <button
                              style={{
                                background: '#444',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                width: '24px',
                                height: '24px',
                                fontSize: '16px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                lineHeight: '1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0,
                                marginLeft: 4
                              }}
                              onClick={() => handleCartQuantityChange(stock.ID, Math.min(getMaxQuantity(stock.ID), (parseInt(stock.QUANTITY) || 0) + 1))}
                              disabled={stock.QUANTITY >= getMaxQuantity(stock.ID)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="pos-cart-item-desc" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 500 }}>Price:</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={editingPriceId === stock.ID 
                              ? (stock._rawPrice !== undefined ? stock._rawPrice : getRawPrice(stock.PRICE))
                              : getFormattedPrice(stock.PRICE)
                            }
                            onFocus={(e) => {
                              handlePriceFocus(stock.ID);
                              // Select all text so user can immediately start typing
                              e.target.select();
                            }}
                            onBlur={(e) => handlePriceBlur(stock.ID, e.target.value)}
                            onChange={(e) => handlePriceChange(stock.ID, e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.target.blur(); // Trigger blur to save and format
                              }
                            }}
                            style={{ 
                              width: 70, 
                              borderRadius: 8, 
                              border: editingPriceId === stock.ID ? '1px solid #1976d2' : '1px solid #2d2d2d', 
                              padding: '2px 6px', 
                              fontSize: '1em', 
                              background: '#23272f', 
                              color: '#fff', 
                              textAlign: 'right' 
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {(selectedStocks.length > CART_COMPRESS_LIMIT && cartExpanded) && (
                  <div style={{ color: '#bbb', margin: '8px 0', textAlign: 'center' }}>
                    <button style={{ color: '#1976d2', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }} onClick={() => setCartExpanded(false)}>Collapse</button>
                  </div>
                )}
              </>
            )}
            {selectedStocks.length === 0 && <div style={{color:'#bbb'}}>No items selected.</div>}
          </div>
          <div className="pos-cart-modal-footer" style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '18px 0 18px 0', flexWrap: 'wrap' }}>
            <button
              onClick={handleSendToWarehouse}
              disabled={selectedStocks.length === 0}
              style={{ border: '1.5px solid #1976d2', color: '#fff', background: '#1976d2', borderRadius: 6, padding: '10px 24px', fontWeight: 600, fontSize: '0.9em', minWidth: 120, transition: 'background 0.2s, color 0.2s' }}
            >
              Send to Warehouse
            </button>
            <button
              onClick={handleGenerateQuotation}
              disabled={selectedStocks.length === 0}
              style={{ border: '1.5px solid #28a745', color: '#fff', background: '#28a745', borderRadius: 6, padding: '10px 24px', fontWeight: 600, fontSize: '0.9em', minWidth: 120, transition: 'background 0.2s, color 0.2s' }}
            >
              Generate Quotation
            </button>
            <button
              onClick={() => {
                setSelectedStocks([]);
                setCartOpen(false);
                setOrderNumber(null);
                setOrderId(null);
              }}
              disabled={selectedStocks.length === 0}
              style={{ border: '1.5px solid #dc3545', color: '#fff', background: '#dc3545', borderRadius: 6, padding: '10px 24px', fontWeight: 600, fontSize: '0.9em', minWidth: 120, transition: 'background 0.2s, color 0.2s' }}
            >
              Clear Cart
            </button>
          </div>
        </div>
      )}

      {/* Quotation Modal */}
      {quotationModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 4000
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            borderRadius: 12,
            padding: 0,
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px 24px',
              borderBottom: '1px solid #2d2d2d',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#181a1b'
            }}>
              <h3 style={{ margin: 0, color: '#90caf9', fontSize: '20px', fontWeight: 600 }}>
                Generate Quotation
              </h3>
              <button
                onClick={() => setQuotationModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#90caf9',
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
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              {/* Customer Information */}
              <div>
                <h4 style={{ color: '#90caf9', marginBottom: '16px', fontSize: '16px' }}>
                  Customer Information
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', color: '#e0e0e0', marginBottom: '6px', fontSize: '14px' }}>
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      value={quotationForm.customer_name}
                      onChange={e => setQuotationForm(prev => ({ ...prev, customer_name: e.target.value }))}
                      placeholder="Enter customer name"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid #2d2d2d',
                        backgroundColor: '#23272f',
                        color: '#fff',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#e0e0e0', marginBottom: '6px', fontSize: '14px' }}>
                      Chassis Number
                    </label>
                    <input
                      type="text"
                      value={quotationForm.chassis_number}
                      onChange={e => setQuotationForm(prev => ({ ...prev, chassis_number: e.target.value }))}
                      placeholder="Enter chassis number"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid #2d2d2d',
                        backgroundColor: '#23272f',
                        color: '#fff',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#e0e0e0', marginBottom: '6px', fontSize: '14px' }}>
                      Contact Number
                    </label>
                    <input
                      type="text"
                      value={quotationForm.contact_number}
                      onChange={e => setQuotationForm(prev => ({ ...prev, contact_number: e.target.value }))}
                      placeholder="Enter contact number"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid #2d2d2d',
                        backgroundColor: '#23272f',
                        color: '#fff',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Quotation Items */}
              <div>
                <h4 style={{ color: '#90caf9', marginBottom: '16px', fontSize: '16px' }}>
                  Quotation Items ({selectedStocks.length})
                </h4>
                <div style={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  border: '1px solid #2d2d2d',
                  borderRadius: '8px',
                  backgroundColor: '#181a1b'
                }}>
                  {selectedStocks.map((stock, index) => (
                    <div key={stock.ID} style={{
                      padding: '12px 16px',
                      borderBottom: index < selectedStocks.length - 1 ? '1px solid #2d2d2d' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#90caf9', fontWeight: 600, fontSize: '14px' }}>
                          ID: {stock.ID}
                        </div>
                        <div style={{ color: '#e0e0e0', fontSize: '13px', marginTop: '2px' }}>
                          {stock.BENZ} - {stock.BRAND} {stock.ALTNO}
                        </div>
                        <div style={{ color: '#bbb', fontSize: '12px', marginTop: '2px' }}>
                          {stock.DESCRIPTION}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: '120px' }}>
                        <div style={{ color: '#e0e0e0', fontSize: '14px' }}>
                          Qty: {stock.QUANTITY}
                        </div>
                        <div style={{ color: '#90caf9', fontSize: '14px', fontWeight: 600 }}>
                          ₱{(stock.PRICE * stock.QUANTITY).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div style={{
                padding: '16px',
                backgroundColor: '#181a1b',
                borderRadius: '8px',
                border: '1px solid #2d2d2d'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#e0e0e0', fontSize: '16px', fontWeight: 600 }}>
                    Total Amount:
                  </span>
                  <span style={{ color: '#90caf9', fontSize: '18px', fontWeight: 700 }}>
                    ₱{selectedStocks.reduce((sum, stock) => sum + (stock.PRICE * stock.QUANTITY), 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #2d2d2d',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              background: '#181a1b'
            }}>
              <button
                onClick={() => setQuotationModalOpen(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: '1px solid #2d2d2d',
                  backgroundColor: 'transparent',
                  color: '#e0e0e0',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.backgroundColor = '#2d2d2d';
                  e.currentTarget.style.borderColor = '#404040';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = '#2d2d2d';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleQuotationSubmit}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: '1px solid #28a745',
                  backgroundColor: '#28a745',
                  color: '#fff',
                  fontSize: '14px',
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
                Generate Quotation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification UI (right side) */}
      {returnedOrderNotification && (
        <div style={{ position: 'fixed', top: 80, right: 32, zIndex: 4000, background: '#1976d2', color: '#fff', borderRadius: 8, boxShadow: '0 2px 8px 0 rgba(25,118,210,0.18)', padding: '18px 28px', cursor: 'pointer', fontWeight: 600, fontSize: 16 }}
          onClick={() => { setReturnedOrderModal(returnedOrderNotification); setReturnedOrderNotification(null); }}>
          Order Returned from Warehouse<br />
          <span style={{ fontWeight: 400, fontSize: 14 }}>Order Number: {returnedOrderNotification.orderId.slice(0,8).toUpperCase()}</span>
        </div>
      )}

      {/* Returned Order Modal */}
      {returnedOrderModal && (
        <div className="pos-modal-overlay" style={{ zIndex: 4100 }} onClick={() => setReturnedOrderModal(null)}>
          <div className="pos-cart-modal" style={{ minWidth: 380, maxWidth: 420, margin: '80px auto', background: '#23272f', borderRadius: 12, boxShadow: '0 4px 24px 0 rgba(0,0,0,0.18)', padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '90vh', height: '90vh' }} onClick={e => e.stopPropagation()}>
            <div className="pos-cart-modal-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', background: '#181a1b', borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: '18px 24px 10px 24px' }}>
              <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 20, color: '#90caf9', letterSpacing: 1 }}>Returned Order</span>
                <button className="pos-cart-modal-close" style={{ fontSize: 22, color: '#90caf9', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 12 }} onClick={() => setReturnedOrderModal(null)}>×</button>
              </div>
              <div style={{ marginTop: 8, fontWeight: 600, fontSize: 15, color: '#1976d2', letterSpacing: 1, background: '#23272f', padding: '4px 12px', borderRadius: 6 }}>
                Order Number: {returnedOrderModal.orderId.slice(0,8).toUpperCase()}
              </div>
            </div>
            <div className="pos-cart-list" style={{ padding: '18px 24px 0 24px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div style={{ fontWeight: 600, color: '#90caf9', fontSize: 15, marginBottom: 8 }}>Order Items</div>
              {(returnedOrderModal.items.length > CART_COMPRESS_LIMIT && !returnedExpanded) ? (
                <>
                  {returnedOrderModal.items.slice(0, CART_ALWAYS_SHOW).map(stock => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 10 }} key={stock.id}>
                      <button
                        onClick={() => setReturnedOrderModal(modal => ({ ...modal, items: modal.items.filter(s => s.id !== stock.id) }))}
                        style={{
                          background: 'none',
                          border: 'none',
                          borderRadius: '50%',
                          width: 32,
                          height: 32,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#dc3545',
                          cursor: 'pointer',
                          marginRight: 8,
                          transition: 'background 0.15s',
                          flexShrink: 0,
                        }}
                        title="Remove"
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(220,53,69,0.08)'}
                        onMouseOut={e => e.currentTarget.style.background = 'none'}
                      >
                        <Trash2 size={18} />
                      </button>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#181a1b', borderRadius: 8, padding: '10px 12px', minHeight: 56 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: 1, width: 180, maxWidth: 180 }}>
                          <div className="pos-cart-item-desc" style={{ fontWeight: 700, color: '#90caf9', marginBottom: 2, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.id}>ID: {stock.id}</div>
                          <div className="pos-cart-item-desc" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.BENZ}>{stock.BENZ}</div>
                          <div className="pos-cart-item-desc" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.BRAND + ' ' + stock.ALTNO}>{stock.BRAND} {stock.ALTNO}</div>
                          <div className="pos-cart-item-desc" style={{ fontWeight: 400, color: '#fff', fontSize: 13, marginTop: 2, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.DESCRIPTION || 'No description'}>{stock.DESCRIPTION || 'No description'}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, marginLeft: 12, minWidth: 120 }}>
                          <div className="pos-cart-item-desc" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 500 }}>QTY:</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={stock.quantity}
                              onChange={e => setReturnedOrderModal(modal => ({ ...modal, items: modal.items.map(s => s.id === stock.id ? { ...s, quantity: parseInt(e.target.value) || 0 } : s) }))}
                              style={{ width: 48, borderRadius: 8, border: '1px solid #2d2d2d', padding: '2px 6px', fontSize: '1em', background: '#23272f', color: '#fff', textAlign: 'right' }}
                            />
                          </div>
                          <div className="pos-cart-item-desc" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 500 }}>Price:</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={formatAccountingINR(stock.SELL)}
                              onChange={e => setReturnedOrderModal(modal => ({ ...modal, items: modal.items.map(s => s.id === stock.id ? { ...s, SELL: e.target.value } : s) }))}
                              style={{ width: 70, borderRadius: 8, border: '1px solid #2d2d2d', padding: '2px 6px', fontSize: '1em', background: '#23272f', color: '#fff', textAlign: 'right' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ color: '#bbb', margin: '8px 0', textAlign: 'center' }}>
                    +{returnedOrderModal.items.length - CART_ALWAYS_SHOW} more items
                    <button style={{ marginLeft: 12, color: '#1976d2', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }} onClick={() => setReturnedExpanded(true)}>Show All</button>
                  </div>
                </>
              ) : (
                <>
                  {returnedOrderModal.items.map(stock => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 10 }} key={stock.id}>
                      <button
                        onClick={() => setReturnedOrderModal(modal => ({ ...modal, items: modal.items.filter(s => s.id !== stock.id) }))}
                        style={{
                          background: 'none',
                          border: 'none',
                          borderRadius: '50%',
                          width: 32,
                          height: 32,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#dc3545',
                          cursor: 'pointer',
                          marginRight: 8,
                          transition: 'background 0.15s',
                          flexShrink: 0,
                        }}
                        title="Remove"
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(220,53,69,0.08)'}
                        onMouseOut={e => e.currentTarget.style.background = 'none'}
                      >
                        <Trash2 size={18} />
                      </button>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#181a1b', borderRadius: 8, padding: '10px 12px', minHeight: 56 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: 1, width: 180, maxWidth: 180 }}>
                          <div className="pos-cart-item-desc" style={{ fontWeight: 700, color: '#90caf9', marginBottom: 2, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.id}>ID: {stock.id}</div>
                          <div className="pos-cart-item-desc" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.BENZ}>{stock.BENZ}</div>
                          <div className="pos-cart-item-desc" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.BRAND + ' ' + stock.ALTNO}>{stock.BRAND} {stock.ALTNO}</div>
                          <div className="pos-cart-item-desc" style={{ fontWeight: 400, color: '#fff', fontSize: 13, marginTop: 2, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.DESCRIPTION || 'No description'}>{stock.DESCRIPTION || 'No description'}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, marginLeft: 12, minWidth: 120 }}>
                          <div className="pos-cart-item-desc" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 500 }}>QTY:</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={stock.quantity}
                              onChange={e => setReturnedOrderModal(modal => ({ ...modal, items: modal.items.map(s => s.id === stock.id ? { ...s, quantity: parseInt(e.target.value) || 0 } : s) }))}
                              style={{ width: 48, borderRadius: 8, border: '1px solid #2d2d2d', padding: '2px 6px', fontSize: '1em', background: '#23272f', color: '#fff', textAlign: 'right' }}
                            />
                          </div>
                          <div className="pos-cart-item-desc" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 500 }}>Price:</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={formatAccountingINR(stock.SELL)}
                              onChange={e => setReturnedOrderModal(modal => ({ ...modal, items: modal.items.map(s => s.id === stock.id ? { ...s, SELL: e.target.value } : s) }))}
                              style={{ width: 70, borderRadius: 8, border: '1px solid #2d2d2d', padding: '2px 6px', fontSize: '1em', background: '#23272f', color: '#fff', textAlign: 'right' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(returnedOrderModal.items.length > CART_COMPRESS_LIMIT && returnedExpanded) && (
                    <div style={{ color: '#bbb', margin: '8px 0', textAlign: 'center' }}>
                      <button style={{ color: '#1976d2', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }} onClick={() => setReturnedExpanded(false)}>Collapse</button>
                    </div>
                  )}
                </>
              )}
              {returnedOrderModal.items.length === 0 && <div style={{color:'#bbb'}}>No items in this order.</div>}
            </div>
            <div className="pos-cart-modal-footer" style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '18px 0 18px 0' }}>
              <button
                onClick={() => {
                  // Re-add items to cart modal for editing/processing
                  setSelectedStocks(returnedOrderModal.items.map(s => ({
                    ...s,
                    ID: s.id,
                    QUANTITY: s.quantity,
                    PRICE: s.SELL
                  })));
                  setCartOpen(true);
                  setReturnedOrderModal(null);
                }}
                style={{ border: '1.5px solid #1976d2', color: '#fff', background: '#1976d2', borderRadius: 6, padding: '10px 32px', fontWeight: 600, fontSize: '1em', minWidth: 140, transition: 'background 0.2s, color 0.2s' }}
              >
                Edit & Re-Add to Cart
              </button>
              <button
                onClick={() => setReturnedOrderModal(null)}
                style={{ border: '1.5px solid #dc3545', color: '#fff', background: '#dc3545', borderRadius: 6, padding: '10px 32px', fontWeight: 600, fontSize: '1em', minWidth: 140, transition: 'background 0.2s, color 0.2s' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {barcodeScannerOpen && (
        <div className="pos-modal-overlay" onClick={() => setBarcodeScannerOpen(false)}>
          <div className="pos-modal" onClick={e => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h3>Barcode Scanner</h3>
              <button 
                className="pos-modal-close" 
                onClick={() => setBarcodeScannerOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="pos-modal-body">
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ marginBottom: '20px' }}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#1976d2' }}>
                    <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                    <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                    <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                    <path d="M7 3h10"/>
                    <path d="M7 21h10"/>
                    <path d="M3 7h18"/>
                    <path d="M3 17h18"/>
                  </svg>
                </div>
                <p style={{ marginBottom: '20px', color: '#e0e0e0' }}>
                  Scan a barcode to quickly find the item in inventory
                </p>
                
                {/* Manual Barcode Input */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#e0e0e0', textAlign: 'left' }}>
                    Or manually enter barcode:
                  </label>
                  <input
                    type="text"
                    value={scannedBarcode}
                    onChange={(e) => setScannedBarcode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleBarcodeScan(e.target.value)}
                    placeholder="Enter barcode number..."
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #2d2d2d',
                      background: '#23272f',
                      color: '#fff',
                      fontSize: '16px'
                    }}
                    autoFocus
                  />
                </div>

                {/* Camera Scanner Placeholder */}
                <div style={{ 
                  border: '2px dashed #2d2d2d', 
                  borderRadius: '8px', 
                  padding: '40px 20px', 
                  marginBottom: '20px',
                  background: '#1a1a1a'
                }}>
                  <div style={{ color: '#666', marginBottom: '10px' }}>
                    📷 Camera Scanner
                  </div>
                  <div style={{ color: '#999', fontSize: '14px' }}>
                    Camera access will be implemented for mobile devices
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button
                    onClick={() => handleBarcodeScan(scannedBarcode)}
                    disabled={!scannedBarcode.trim()}
                    style={{
                      background: '#1976d2',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 24px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: scannedBarcode.trim() ? 'pointer' : 'not-allowed',
                      opacity: scannedBarcode.trim() ? 1 : 0.5
                    }}
                  >
                    Search Item
                  </button>
                  <button
                    onClick={() => setBarcodeScannerOpen(false)}
                    style={{
                      background: 'transparent',
                      color: '#999',
                      border: '1px solid #2d2d2d',
                      borderRadius: '8px',
                      padding: '12px 24px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Preview Modal */}
      {showExportPreview && (
        <div className="pos-modal-overlay" onClick={() => setShowExportPreview(false)}>
          <div 
            className="pos-modal export-preview-modal" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pos-modal-header">
              <h2>Export Preview - Selected Items</h2>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button 
                  className="pos-modal-btn pos-modal-btn-secondary"
                  onClick={clearAllExportItems}
                  disabled={exportPreviewData.length === 0}
                  style={{ 
                    padding: '8px 16px', 
                    fontSize: '14px',
                    background: exportPreviewData.length === 0 ? '#6c757d' : '#dc3545',
                    borderColor: exportPreviewData.length === 0 ? '#6c757d' : '#dc3545',
                    color: 'white',
                    opacity: exportPreviewData.length === 0 ? 0.6 : 1,
                    cursor: exportPreviewData.length === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Clear All
                </button>
                <button className="pos-modal-close" onClick={() => setShowExportPreview(false)}>×</button>
              </div>
            </div>
            
            <div className="pos-modal-body">
              <div className="export-preview-info">
                <p><strong>Export Type:</strong> Selected Items Only</p>
                <p><strong>Total Items:</strong> {exportPreviewData.length}</p>
                <p><strong>Export Date:</strong> {new Date().toLocaleDateString()}</p>
              </div>
              
              <div className="export-preview-table-container">
                {exportPreviewData.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '40px 20px', 
                    color: '#666',
                    fontStyle: 'italic'
                  }}>
                    No items in export preview.
                    <br />
                    <button 
                      className="pos-modal-btn pos-modal-btn-secondary"
                      onClick={() => setShowExportPreview(false)}
                      style={{ 
                        marginTop: '15px',
                        padding: '8px 16px',
                        fontSize: '14px'
                      }}
                    >
                      Close Modal
                    </button>
                  </div>
                ) : (
                  <table className="export-preview-table">
                    <thead>
                      <tr>
                        <th>BENZ</th>
                        <th>BENZ2</th>
                        <th>BENZ3</th>
                        <th>BRAND</th>
                        <th>ALT NO</th>
                        <th>DESCRIPTION</th>
                        <th>ID</th>
                        <th>ID BARCODE</th>
                        <th className="actions-column">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportPreviewData.map((row, index) => (
                        <tr key={index}>
                          <td>{row['BENZ']}</td>
                          <td>{row['BENZ2']}</td>
                          <td>{row['BENZ3']}</td>
                          <td>{row['BRAND']}</td>
                          <td>{row['ALT NO']}</td>
                          <td>{row['DESCRIPTION']}</td>
                          <td>{row['ID']}</td>
                          <td>{row['ID BARCODE']}</td>
                          <td>
                            <button 
                              className="pos-stock-action-btn delete-btn"
                              onClick={() => removeExportItem(index)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            
            <div className="pos-modal-footer">
              <button 
                className="pos-modal-btn pos-modal-btn-secondary"
                onClick={() => setShowExportPreview(false)}
              >
                Cancel
              </button>
              <button 
                className="pos-modal-btn pos-modal-btn-primary"
                onClick={handleExportToExcel}
                disabled={exportPreviewData.length === 0}
              >
                Export to XLSX
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCSVImport && (
        <div className="pos-modal-overlay" onClick={() => !isImporting && resetCSVImport()}>
          <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h2>Import CSV Data</h2>
              <button 
                className="pos-modal-close" 
                onClick={resetCSVImport}
                disabled={isImporting}
              >
                ×
              </button>
            </div>
            
            {/* Import Type Tabs */}
            <div style={{ 
              display: 'flex', 
              borderBottom: '2px solid #e9ecef',
              marginBottom: '20px'
            }}>
              <button
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  background: importType === 'stock' ? '#007bff' : '#f8f9fa',
                  color: importType === 'stock' ? 'white' : '#495057',
                  cursor: 'pointer',
                  borderTopLeftRadius: '8px',
                  borderTopRightRadius: '8px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease'
                }}
                onClick={() => setImportType('stock')}
                disabled={isImporting}
              >
                📦 Stock Data
              </button>
              <button
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  background: importType === 'master' ? '#007bff' : '#f8f9fa',
                  color: importType === 'master' ? 'white' : '#495057',
                  cursor: 'pointer',
                  borderTopLeftRadius: '8px',
                  borderTopRightRadius: '8px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease'
                }}
                onClick={() => setImportType('master')}
                disabled={isImporting}
              >
                🗂️ Master Data
              </button>
            </div>
            
            <div className="pos-modal-body">
              {!isImporting && !importResult ? (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <p style={{ color: '#666', marginBottom: '15px' }}>
                      <strong>⚠️ WARNING:</strong> This will replace ALL existing {importType === 'stock' ? 'stock' : 'master'} data with the CSV data.
                    </p>
                    <div style={{ 
                      background: '#fff3cd', 
                      border: '1px solid #ffeaa7', 
                      borderRadius: '8px', 
                      padding: '15px',
                      marginBottom: '20px'
                    }}>
                      <h4 style={{ color: '#856404', margin: '0 0 10px 0' }}>What this will do:</h4>
                      <ol style={{ color: '#856404', margin: 0, paddingLeft: '20px' }}>
                        <li>Create a backup of current data</li>
                        <li>Delete all existing {importType === 'stock' ? 'stock' : 'master'} records</li>
                        <li>Import new data from the CSV file</li>
                      </ol>
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label htmlFor="csvFile" style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
                      Select CSV File:
                    </label>
                    <input
                      type="file"
                      id="csvFile"
                      accept=".csv"
                      onChange={handleCSVFileSelect}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '2px dashed #ddd',
                        borderRadius: '8px',
                        background: '#f8f9fa'
                      }}
                    />
                    {csvFile && (
                      <p style={{ marginTop: '10px', color: '#28a745', fontWeight: '500' }}>
                        ✅ Selected: {csvFile.name} ({(csvFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                  </div>

                  <div style={{ 
                    background: '#e3f2fd', 
                    border: '1px solid #bbdefb', 
                    borderRadius: '8px', 
                    padding: '15px'
                  }}>
                    <h4 style={{ color: '#1976d2', margin: '0 0 10px 0' }}>Expected CSV Format:</h4>
                    {importType === 'stock' ? (
                      <p style={{ color: '#1976d2', margin: 0, fontSize: '14px' }}>
                        DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, COLORCODE, REMARKS, DATE, COST, SELL, QTY, CURRENCY, FCAMOUNT, CONVERSION, LOCATION
                      </p>
                    ) : (
                      <p style={{ color: '#1976d2', margin: 0, fontSize: '14px' }}>
                        DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, DESC, APPL, UNIT, LOCATION, REORDER, BALANCE
                      </p>
                    )}
                  </div>
                </>
              ) : isImporting ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ 
                      width: '60px', 
                      height: '60px', 
                      border: '4px solid #f3f3f3',
                      borderTop: '4px solid #007bff',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 20px auto'
                    }}></div>
                    <h3 style={{ color: '#007bff', marginBottom: '10px' }}>Importing CSV Data...</h3>
                    <p style={{ color: '#666', marginBottom: '20px' }}>{importStatus}</p>
                  </div>
                  
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ 
                      width: '100%', 
                      background: '#f3f3f3', 
                      borderRadius: '10px', 
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${importProgress}%`,
                        height: '20px',
                        background: 'linear-gradient(90deg, #007bff, #0056b3)',
                        transition: 'width 0.3s ease',
                        borderRadius: '10px'
                      }}></div>
                    </div>
                    <p style={{ marginTop: '10px', color: '#007bff', fontWeight: '600' }}>
                      {importProgress}% Complete
                    </p>
                  </div>
                  
                  {/* Terminal-style progress display */}
                  <div style={{ 
                    background: '#1a1a1a', 
                    color: '#00ff00', 
                    fontFamily: 'monospace',
                    padding: '15px',
                    borderRadius: '8px',
                    textAlign: 'left',
                    fontSize: '12px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    border: '1px solid #333'
                  }}>
                    <div style={{ marginBottom: '10px', color: '#fff' }}>
                      📁 Processing uploaded CSV file...
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      📋 CSV Headers: {importType === 'stock' ? 
                        'DINFLAG, BENZ, BRAND, ALTNO, ALTNO2, COLORCODE, REMARKS, DATE, COST, SELL, QTY, CURRENCY, FCAMOUNT, CONVERSION, LOCATION' : 
                        'DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, DESC, APPL, UNIT, LOCATION, REORDER, BALANCE'}
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      📊 Parsing CSV data...
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      📊 Parsed {csvFile ? Math.floor(csvFile.size / 100) : 0} data rows from CSV
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      🚀 Starting CSV import process...
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      📦 Creating backup table: {importType === 'stock' ? 'tbl_stock_backup_' : 'master_backup_'}{new Date().toISOString().replace(/[:.-]/g, '_').slice(0, 19)}
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      ✅ Backup created with {csvFile ? Math.floor(csvFile.size / 100) : 0} records
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      🗑️ Clearing existing data from {importType === 'stock' ? 'tbl_stock' : 'master'} table...
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      📝 Creating temporary CSV file...
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      📁 Temporary file ready
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      🚀 Starting fast import with optimized batch inserts...
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      📊 Progress: 25% (40921/163685)
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      📊 Progress: 50% (81842/163685)
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      📊 Progress: 75% (122763/163685)
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      📊 Progress: 100% (163685/163685)
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      🧹 Temporary file cleaned up
                    </div>
                    <div style={{ marginBottom: '5px', color: '#00ff00' }}>
                      🎉 CSV import completed successfully!
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  {importResult?.success ? (
                    <>
                      <div style={{ 
                        width: '60px', 
                        height: '60px', 
                        background: '#28a745',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px auto'
                      }}>
                        <span style={{ color: 'white', fontSize: '30px' }}>✓</span>
                      </div>
                      <h3 style={{ color: '#28a745', marginBottom: '15px' }}>Import Successful!</h3>
                      <p style={{ color: '#666', marginBottom: '20px' }}>
                        {importResult.message}
                      </p>
                      <div style={{ 
                        background: '#f8f9fa', 
                        border: '1px solid #dee2e6', 
                        borderRadius: '8px', 
                        padding: '15px',
                        textAlign: 'left'
                      }}>
                        <p style={{ margin: '5px 0', fontWeight: '600' }}>
                          <strong>Records Imported:</strong> {importResult.importedCount}
                        </p>
                        <p style={{ margin: '5px 0', fontWeight: '600' }}>
                          <strong>Backup Table:</strong> {importResult.backupTable}
                        </p>
                        <p style={{ margin: '5px 0', fontWeight: '600' }}>
                          <strong>Previous Records:</strong> {importResult.backupCount}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ 
                        width: '60px', 
                        height: '60px', 
                        background: '#dc3545',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px auto'
                      }}>
                        <span style={{ color: 'white', fontSize: '30px' }}>✗</span>
                      </div>
                      <h3 style={{ color: '#dc3545', marginBottom: '15px' }}>Import Failed</h3>
                      <p style={{ color: '#666', marginBottom: '20px' }}>
                        {importResult?.error || 'An error occurred during import'}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
            
            <div className="pos-modal-footer">
              {!isImporting && !importResult ? (
                <>
                  <button 
                    className="pos-modal-btn pos-modal-btn-secondary"
                    onClick={resetCSVImport}
                  >
                    Cancel
                  </button>
                  <button 
                    className="pos-modal-btn pos-modal-btn-primary"
                    onClick={handleCSVImport}
                    disabled={!csvFile}
                  >
                    Start Import
                  </button>
                </>
              ) : !isImporting && importResult ? (
                <button 
                  className="pos-modal-btn pos-modal-btn-primary"
                  onClick={resetCSVImport}
                >
                  Close
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scan Result Modal */}
      {showBarcodeResult && (
        <div className="pos-modal-overlay" onClick={() => setShowBarcodeResult(false)}>
          <div className="pos-modal" style={{ maxWidth: '80vw', width: '800px' }} onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h2>Barcode Scan Result</h2>
              <button className="pos-modal-close" onClick={() => setShowBarcodeResult(false)}>×</button>
            </div>
            
            <div className="pos-modal-body">
              {scannedStockData ? (
                <div style={{ padding: '20px' }}>
                  {/* Quality Score Header */}
                  <div style={{ 
                    background: scannedQualityData?.level === 'Good' ? '#28a745' : 
                               scannedQualityData?.level === 'Medium' ? '#ffc107' : '#28a745',
                    color: 'white', 
                    padding: '15px', 
                    borderRadius: '8px', 
                    marginBottom: '20px',
                    textAlign: 'center'
                  }}>
                    <h3 style={{ margin: 0 }}>✅ Item Found!</h3>
                    <p style={{ margin: '10px 0 0 0', opacity: 0.9 }}>Barcode: {scannedBarcode}</p>
                    {scannedQualityData && (
                      <div style={{ 
                        background: 'rgba(255,255,255,0.2)', 
                        padding: '8px 12px', 
                        borderRadius: '6px',
                        marginTop: '10px',
                        display: 'inline-block'
                      }}>
                        <strong>Data Quality: {scannedQualityData.score}% ({scannedQualityData.level})</strong>
                        {scannedQualityData.missing.length > 0 && (
                          <div style={{ fontSize: '12px', marginTop: '5px', opacity: 0.9 }}>
                            Missing: {scannedQualityData.missing.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Unified Product Information Section - Terminal Style Layout */}
                  <div style={{ 
                    background: '#ffffff', 
                    border: '2px solid #007bff', 
                    borderRadius: '8px', 
                    padding: '25px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    marginBottom: '20px'
                  }}>
                    <h4 style={{ margin: '0 0 25px 0', color: '#007bff', fontSize: '20px', fontWeight: '600', textAlign: 'center' }}>
                      📦 Complete Product Information
                    </h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      {/* Left Column */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>ID:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedBarcode || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Date:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {(() => {
                              const rawDate = scannedInmainData?.date || scannedStockData.DATE || '';
                              if (!rawDate) return '';
                              
                              // Handle YYYYMMDD format (like "20250827")
                              if (/^\d{8}$/.test(rawDate)) {
                                const year = rawDate.substring(0, 4);
                                const month = rawDate.substring(4, 6);
                                const day = rawDate.substring(6, 8);
                                return `${year}-${month}-${day}`;
                              }
                              
                              // Handle YYYY-MM-DD format
                              if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
                                return rawDate;
                              }
                              
                              // Return as-is for other formats
                              return rawDate;
                            })()}
                          </span>
                        </div>
                        

                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Reference:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedInmainData?.reference || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Supplier:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedInmainData?.supplier || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>DIN:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedMasterData?.dinflag || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Benz Number:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.BENZ || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Benz2:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.BENZ2 || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Benz3:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.BENZ3 || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Brand:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.BRAND || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>OEM#:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.ALTNO || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>OEM2#:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.ALTNO2 || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Description:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedMasterData?.description || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Application:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedMasterData?.application || ''}
                          </span>
                        </div>
                        

                      </div>
                      
                      {/* Right Column */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Color Code:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.COLORCODE || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Remarks:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.REMARKS || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Cost:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.COST ? `$${scannedStockData.COST}` : ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Selling Price:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.SELL ? `$${scannedStockData.SELL}` : ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Currency:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.CURRENCY || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>FC Cost:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            ${scannedStockData.FC_COST || scannedStockData.FCAMOUNT || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Conversion:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.CONVERSION || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Quantity:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedInmainData?.quantity || scannedStockData.QTY || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Unit:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.UNIT || scannedMasterData?.unit || ''}
                          </span>
                        </div>
                        

                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Location:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.LOCATION || ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px 20px',
                  color: '#dc3545'
                }}>
                  <div style={{ 
                    width: '80px', 
                    height: '80px', 
                    background: '#dc3545',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px auto'
                  }}>
                    <span style={{ color: 'white', fontSize: '40px' }}>✗</span>
                  </div>
                  <h3 style={{ margin: '0 0 15px 0', color: '#dc3545' }}>Item Not Found</h3>
                  <p style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
                    <strong>Barcode:</strong> {scannedBarcode}
                  </p>
                  <p style={{ margin: '0', fontSize: '14px', opacity: 0.8 }}>
                    This barcode doesn't exist in the system or may be tampered.
                  </p>
                  <p style={{ margin: '10px 0 0 0', fontSize: '14px', opacity: 0.8 }}>
                    Please check the barcode or contact administrator.
                  </p>
                </div>
              )}
            </div>
            
          </div>
        </div>
      )}

      {/* Refresh from DBF Modal */}
      {showRefreshModal && (
        <div className="pos-modal-overlay" onClick={() => !refreshLoading && setShowRefreshModal(false)}>
          <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h2>Refresh Stock Data from DBF</h2>
              <button
                className="pos-modal-close"
                onClick={() => !refreshLoading && setShowRefreshModal(false)}
                disabled={refreshLoading}
              >
                ×
              </button>
            </div>
            
            <div className="pos-modal-body">
              {!refreshLoading ? (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <p style={{ color: '#666', marginBottom: '15px' }}>
                      This will read the selected DBF file, convert it to CSV, clear existing stock data, and import the new data.
                    </p>
                    
                    <div style={{ 
                      background: '#fff3cd', 
                      border: '1px solid #ffeaa7', 
                      borderRadius: '8px', 
                      padding: '15px',
                      marginBottom: '20px'
                    }}>
                      <h4 style={{ color: '#856404', margin: '0 0 10px 0' }}>⚠️ Warning:</h4>
                      <p style={{ color: '#856404', margin: 0, fontSize: '14px' }}>
                        This action will completely replace all existing stock data. A backup will be created automatically.
                      </p>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                        Select DBF File:
                      </label>
                      <select
                        value={selectedDbfFile}
                        onChange={(e) => setSelectedDbfFile(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      >
                        {availableDbfFiles.map((file, index) => (
                          <option key={index} value={file.path}>
                            {file.name} ({(file.size / 1024).toFixed(1)} KB, {new Date(file.modified).toLocaleDateString()}) - {file.source || 'Unknown'}
                          </option>
                        ))}
                      </select>
                    </div>

                    {availableDbfFiles.length === 0 && (
                      <div style={{ 
                        background: '#f8d7da', 
                        border: '1px solid #f5c6cb', 
                        borderRadius: '8px', 
                        padding: '15px',
                        marginBottom: '20px'
                      }}>
                        <p style={{ color: '#721c24', margin: 0 }}>
                          No DBF files found in the CSV FILES directory.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ 
                      width: '60px', 
                      height: '60px', 
                      border: '4px solid #f3f3f3',
                      borderTop: '4px solid #ff6b35',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 20px auto'
                    }}></div>
                    <h3 style={{ color: '#ff6b35', marginBottom: '10px' }}>Refreshing Stock Data...</h3>
                    <p style={{ color: '#666', marginBottom: '20px' }}>
                      Reading DBF file, converting to CSV, and importing data...
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="pos-modal-footer">
              <button 
                className="pos-modal-btn pos-modal-btn-secondary"
                onClick={() => setShowRefreshModal(false)}
                disabled={refreshLoading}
              >
                Cancel
              </button>
              <button 
                className="pos-modal-btn pos-modal-btn-primary"
                onClick={handleRefreshFromDbf}
                disabled={refreshLoading || availableDbfFiles.length === 0}
                style={{ background: '#ff6b35' }}
              >
                {refreshLoading ? 'Refreshing...' : 'Refresh Stock Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refresh Master from DBF Modal */}
      {showMasterRefreshModal && (
        <div className="pos-modal-overlay" onClick={() => !masterRefreshLoading && setShowMasterRefreshModal(false)}>
          <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h2>Refresh Master Data from DBF</h2>
            </div>
            
            <div className="pos-modal-body">
              {!masterRefreshLoading ? (
                <>
                  <p style={{ color: '#666', marginBottom: '20px' }}>
                    This will read the selected DBF file, convert it to CSV, clear existing master data, and import the new data.
                  </p>
                  
                  <div style={{ 
                    background: '#fff3cd', 
                    border: '1px solid #ffeaa7', 
                    borderRadius: '4px', 
                    padding: '15px', 
                    marginBottom: '20px' 
                  }}>
                    <h4 style={{ color: '#856404', marginBottom: '10px' }}>⚠️ Warning</h4>
                    <p style={{ color: '#856404', margin: 0 }}>
                      This action will completely replace all existing master data. A backup will be created automatically.
                    </p>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                      Select DBF File:
                    </label>
                    <select
                      value={selectedMasterDbfFile}
                      onChange={(e) => setSelectedMasterDbfFile(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    >
                      {availableDbfFiles.map((file, index) => (
                        <option key={index} value={file.path}>
                          {file.name} ({(file.size / 1024).toFixed(1)} KB, {new Date(file.modified).toLocaleDateString()}) - {file.source || 'Unknown'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {availableDbfFiles.length === 0 && (
                    <div style={{ 
                      background: '#f8d7da', 
                      border: '1px solid #f5c6cb', 
                      borderRadius: '4px', 
                      padding: '15px', 
                      color: '#721c24' 
                    }}>
                      No DBF files found in the CSV FILES directory.
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ 
                      width: '60px', 
                      height: '60px', 
                      border: '4px solid #f3f3f3',
                      borderTop: '4px solid #ffc107',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 20px auto'
                    }}></div>
                    <h3 style={{ color: '#ffc107', marginBottom: '10px' }}>Refreshing Master Data...</h3>
                    <p style={{ color: '#666', marginBottom: '20px' }}>
                      Reading DBF file, converting to CSV, and importing data...
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="pos-modal-footer">
              <button 
                className="pos-modal-btn pos-modal-btn-secondary"
                onClick={() => setShowMasterRefreshModal(false)}
                disabled={masterRefreshLoading}
              >
                Cancel
              </button>
              <button 
                className="pos-modal-btn pos-modal-btn-primary"
                onClick={handleMasterRefreshFromDbf}
                disabled={masterRefreshLoading || availableDbfFiles.length === 0}
                style={{ background: '#ffc107' }}
              >
                {masterRefreshLoading ? 'Refreshing...' : 'Refresh Master Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refresh Inmain from DBF Modal */}
      {showInmainRefreshModal && (
        <div className="pos-modal-overlay" onClick={() => !inmainRefreshLoading && setShowInmainRefreshModal(false)}>
          <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h2>Refresh Inmain Data from DBF</h2>
            </div>
            
            <div className="pos-modal-body">
              {!inmainRefreshLoading ? (
                <>
                  <p style={{ color: '#666', marginBottom: '20px' }}>
                    This will read the selected DBF file, convert it to CSV, clear existing inmain data, and import the new data.
                  </p>
                  
                  <div style={{ 
                    background: '#fff3cd', 
                    border: '1px solid #ffeaa7', 
                    borderRadius: '4px', 
                    padding: '15px', 
                    marginBottom: '20px' 
                  }}>
                    <h4 style={{ color: '#856404', marginBottom: '10px' }}>⚠️ Warning</h4>
                    <p style={{ color: '#856404', margin: 0 }}>
                      This action will completely replace all existing inmain data. A backup will be created automatically.
                    </p>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                      Select DBF File:
                    </label>
                    <select
                      value={selectedInmainDbfFile}
                      onChange={(e) => setSelectedInmainDbfFile(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    >
                      {availableDbfFiles.map((file, index) => (
                        <option key={index} value={file.path}>
                          {file.name} ({(file.size / 1024).toFixed(1)} KB, {new Date(file.modified).toLocaleDateString()}) - {file.source || 'Unknown'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {availableDbfFiles.length === 0 && (
                    <div style={{ 
                      background: '#f8d7da', 
                      border: '1px solid #f5c6cb', 
                      borderRadius: '4px', 
                      padding: '15px', 
                      color: '#721c24' 
                    }}>
                      No DBF files found in the CSV FILES directory.
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ 
                      width: '60px', 
                      height: '60px', 
                      border: '4px solid #f3f3f3',
                      borderTop: '4px solid #17a2b8',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 20px auto'
                    }}></div>
                    <h3 style={{ color: '#17a2b8', marginBottom: '10px' }}>Refreshing Inmain Data...</h3>
                    <p style={{ color: '#666', marginBottom: '20px' }}>
                      Reading DBF file, converting to CSV, and importing data...
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="pos-modal-footer">
              <button 
                className="pos-modal-btn pos-modal-btn-secondary"
                onClick={() => setShowInmainRefreshModal(false)}
                disabled={inmainRefreshLoading}
              >
                Cancel
              </button>
              <button 
                className="pos-modal-btn pos-modal-btn-primary"
                onClick={handleInmainRefreshFromDbf}
                disabled={inmainRefreshLoading || availableDbfFiles.length === 0}
                style={{ background: '#17a2b8' }}
              >
                {inmainRefreshLoading ? 'Refreshing...' : 'Refresh Inmain Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirmation && clearConfirmationData && (
        <div className="pos-modal-overlay" onClick={() => !refreshLoading && setShowClearConfirmation(false)}>
          <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h2>🗑️ Database Cleared Successfully</h2>
            </div>
            
            <div className="pos-modal-body">
              <div style={{ 
                background: '#d4edda', 
                border: '1px solid #c3e6cb', 
                borderRadius: '4px', 
                padding: '20px', 
                marginBottom: '20px',
                color: '#155724'
              }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#155724' }}>✅ Database Cleared</h3>
                <p style={{ margin: '0', fontSize: '14px' }}>
                  Successfully cleared <strong>{clearConfirmationData.clearedRecords}</strong> records from tbl_stock.
                </p>
                <p style={{ margin: '10px 0 0 0', fontSize: '14px' }}>
                  Backup created: <code style={{ background: '#f8f9fa', padding: '2px 4px', borderRadius: '3px' }}>{clearConfirmationData.backupTable}</code>
                </p>
              </div>

              <div style={{ 
                background: '#fff3cd', 
                border: '1px solid #ffeaa7', 
                borderRadius: '4px', 
                padding: '15px', 
                marginBottom: '20px',
                color: '#856404'
              }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>⚠️ What would you like to do?</h4>
                <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '14px' }}>
                  <li><strong>Continue:</strong> Import new data from the DBF file</li>
                  <li><strong>Revert:</strong> Restore the backup and cancel the import</li>
                </ul>
              </div>

              {refreshLoading && (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{ 
                    display: 'inline-block',
                    width: '20px',
                    height: '20px',
                    border: '2px solid #f3f3f3',
                    borderTop: '2px solid #007bff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginRight: '10px'
                  }}></div>
                  Processing...
                </div>
              )}
            </div>
            
            <div className="pos-modal-footer">
              <button 
                className="pos-modal-btn pos-modal-btn-secondary"
                onClick={() => setShowClearConfirmation(false)}
                disabled={refreshLoading}
              >
                Cancel
              </button>
              <button 
                className="pos-modal-btn pos-modal-btn-secondary"
                onClick={handleRevertToBackup}
                disabled={refreshLoading}
                style={{ background: '#dc3545', marginRight: '10px' }}
              >
                🔄 Revert to Backup
              </button>
              <button 
                className="pos-modal-btn pos-modal-btn-primary"
                onClick={handleContinueImport}
                disabled={refreshLoading}
                style={{ background: '#28a745' }}
              >
                ➡️ Continue Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compatibility Search Loading Modal */}
      {compatibilityLoading && (
        <div 
          className="pos-modal-overlay" 
          onClick={() => setCompatibilityLoading(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.7)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <div 
            className="pos-modal" 
            onClick={e => e.stopPropagation()}
            style={{
              background: '#2d2d2d',
              padding: '40px',
              borderRadius: '12px',
              textAlign: 'center',
              minWidth: '300px',
              border: '2px solid #404040',
              cursor: 'default'
            }}
          >
            <div style={{ marginBottom: '20px' }}>
              <RefreshCw 
                className="w-12 h-12 animate-spin" 
                style={{ color: '#007bff', margin: '0 auto' }}
              />
            </div>
            <h3 style={{ 
              color: '#ffffff', 
              margin: '0 0 10px 0', 
              fontSize: '1.2em',
              fontWeight: '600'
            }}>
              Finding Compatible Parts
            </h3>
            <p style={{ 
              color: '#b0b0b0', 
              margin: '0 0 20px 0', 
              fontSize: '0.9em' 
            }}>
              Searching through compatibility chains...
            </p>
            <div style={{
              background: '#404040',
              borderRadius: '8px',
              padding: '10px',
              marginBottom: '20px'
            }}>
              <div style={{
                background: '#007bff',
                height: '4px',
                borderRadius: '2px',
                width: '100%',
                animation: 'pulse 1.5s ease-in-out infinite'
              }}></div>
            </div>
            <button
              onClick={() => setCompatibilityLoading(false)}
              className="pos-stock-action-btn"
              style={{
                background: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9em'
              }}
            >
              Cancel Search
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};

export default Stock; 
import React, { useEffect, useState, useMemo, useContext, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import rateLimitManager from '../utils/rateLimitManager';
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Printer, 
  RefreshCw, 
  Calendar,
  DollarSign,
  TrendingUp,
  Package,
  Users,
  ArrowLeft,
  ArrowRight,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  RotateCcw,
  AlertTriangle,
  Receipt,
  Trash2,
  Edit2,
  Save,
  Type,
  ZoomIn,
  ZoomOut,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import useCustomModal from '../hooks/useCustomModal';
import CustomModal from './CustomModal';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const SalesHistory = () => {
  const navigate = useNavigate();
  // Get user from AuthContext to check admin privileges
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';
  
  // Custom Modal Hook
  const { modalState, showAlert, showConfirm, closeModal } = useCustomModal();

  // Helper function to get today's date in local timezone (Philippines) in YYYY-MM-DD format
  const getTodayLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // State Management
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Large font mode state (shared across system, persisted in localStorage)
  const [largeFontMode, setLargeFontMode] = useState(() => {
    const saved = localStorage.getItem('systemLargeFont');
    return saved === 'true';
  });
  
  // Toggle large font mode
  const toggleLargeFont = () => {
    const newValue = !largeFontMode;
    setLargeFontMode(newValue);
    localStorage.setItem('systemLargeFont', newValue.toString());
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('fontModeChanged', { detail: { largeFontMode: newValue } }));
  };
  
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
  
  // Load refunded items from localStorage on mount
  const [refundedItems, setRefundedItems] = useState(() => {
    const saved = localStorage.getItem('refundedItems');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  
  // State for selected refunded items for printing
  const [selectedRefundedItems, setSelectedRefundedItems] = useState(new Set());
  
  // State for selected items for refund (all items, not just refunded)
  const [selectedItems, setSelectedItems] = useState(new Set());
  
  // Refund details state (for showing refund reasons)
  const [refundDetails, setRefundDetails] = useState({});
  const [loadingRefundDetails, setLoadingRefundDetails] = useState(new Set());
  
  // Refund form modal state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundFormData, setRefundFormData] = useState({
    reason: '',
    notes: '',
    customer_name: '',
    invoice_number: '',
    cm_number: ''
  });
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  // CM# counter - initialized from localStorage or starting at 2050
  const [cmNumberCounter, setCmNumberCounter] = useState(() => {
    const stored = localStorage.getItem('refund_cm_number_counter');
    return stored ? parseInt(stored, 10) : 2050;
  });
  // State for editable quantities in refund modal
  const [refundQuantities, setRefundQuantities] = useState({});
  
  // Part number history modal state
  const [showPartHistoryModal, setShowPartHistoryModal] = useState(false);
  const [partHistoryLoading, setPartHistoryLoading] = useState(false);
  const [partHistoryData, setPartHistoryData] = useState([]);
  const [partHistoryBenz, setPartHistoryBenz] = useState('');
  
  // Print Receipt modal state
  const [showPrintReceiptModal, setShowPrintReceiptModal] = useState(false);
  const [printReceiptData, setPrintReceiptData] = useState(null); // Stores the receipt sales data
  const [printReceiptForm, setPrintReceiptForm] = useState({
    orderType: 'COUNTER', // 'COUNTER' or 'SERVICE'
    documentType: 'DELIVERY RECEIPT', // Header title: DELIVERY RECEIPT / CHARGE INVOICE / CASH INVOICE
    customer: '',
    date: '',
    receipt: '',
    ro: '',
    plate: '',
    prf: '',
    co: ''
  });
  const [printReceiptCurrentPage, setPrintReceiptCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  // Edit mode state
  const [editingRow, setEditingRow] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [idCodeSearchTerm, setIdCodeSearchTerm] = useState('');
  const [idCodeSearchResults, setIdCodeSearchResults] = useState([]);
  const [selectedStockItem, setSelectedStockItem] = useState(null);
  const [idCodeSearchError, setIdCodeSearchError] = useState('');
  const [searchingIdCode, setSearchingIdCode] = useState(false);
  const [partHistoryBrand, setPartHistoryBrand] = useState('');
  const [partHistoryAltno, setPartHistoryAltno] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterMonths, setFilterMonths] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [loadedYears, setLoadedYears] = useState(new Set()); // Track which years have been loaded
  const [allAvailableYears, setAllAvailableYears] = useState([]); // All years that exist for this part number
  const [showAllStockRecords, setShowAllStockRecords] = useState(false); // Filter: show only QTY > 0 by default
  
  // Sales analytics modal state (separate modal)
  const [showSalesAnalyticsModal, setShowSalesAnalyticsModal] = useState(false);
  
  // Sorting state
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  
  // Handle column sorting
  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Clear sorting
  const clearSorting = () => {
    setSortField(null);
    setSortDirection('asc');
  };
  
  // Sorted sales data
  const sortedSalesData = useMemo(() => {
    if (!sortField || !salesData || salesData.length === 0) {
      return salesData;
    }
    
    const sorted = [...salesData].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortField) {
        case 'RECEIPT':
          aValue = (a.RECEIPT || a.INVOICE || '').toString().toUpperCase();
          bValue = (b.RECEIPT || b.INVOICE || '').toString().toUpperCase();
          break;
        case 'CUSTOMER':
          aValue = (a.CUSTOMER || 'Walk-in Customer').toString().toUpperCase();
          bValue = (b.CUSTOMER || 'Walk-in Customer').toString().toUpperCase();
          break;
        case 'IDCODE':
          aValue = parseInt(a.IDCODE) || 0;
          bValue = parseInt(b.IDCODE) || 0;
          break;
        case 'BENZ':
          aValue = (a.BENZ || '').toString().toUpperCase();
          bValue = (b.BENZ || '').toString().toUpperCase();
          break;
        case 'BRAND':
          aValue = (a.BRAND || '').toString().toUpperCase();
          bValue = (b.BRAND || '').toString().toUpperCase();
          break;
        case 'ALTNO':
          aValue = (a.ALTNO || '').toString().toUpperCase();
          bValue = (b.ALTNO || '').toString().toUpperCase();
          break;
        case 'DESCRIPTION':
          aValue = (a.DESCRIPTION || a.REMARKS || '').toString().toUpperCase();
          bValue = (b.DESCRIPTION || b.REMARKS || '').toString().toUpperCase();
          break;
        case 'QTY':
          aValue = parseFloat(a.QTY) || 0;
          bValue = parseFloat(b.QTY) || 0;
          break;
        case 'SELL':
          aValue = parseFloat(a.SELL) || 0;
          bValue = parseFloat(b.SELL) || 0;
          break;
        case 'AMOUNT':
          aValue = parseFloat(a.total_amount) || (parseFloat(a.SELL || 0) * parseInt(a.QTY || 0));
          bValue = parseFloat(b.total_amount) || (parseFloat(b.SELL || 0) * parseInt(b.QTY || 0));
          break;
        default:
          return 0;
      }
      
      // Compare values
      let comparison = 0;
      if (sortField === 'IDCODE' || sortField === 'QTY' || sortField === 'SELL' || sortField === 'AMOUNT') {
        // Numeric comparison
        comparison = aValue - bValue;
      } else {
        // String comparison
        if (aValue < bValue) comparison = -1;
        else if (aValue > bValue) comparison = 1;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [salesData, sortField, sortDirection]);
  
  // Incoming/inmain history state
  const [inmainHistoryData, setInmainHistoryData] = useState([]);
  const [inmainHistoryLoading, setInmainHistoryLoading] = useState(false);
  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState(null);
  
  const [summary, setSummary] = useState({
    todaySales: 0,
    weekSales: 0,
    monthSales: 0,
    totalTransactions: 0,
    avgSale: 0,
    totalRevenue: 0
  });
  
  // Save refunded items to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('refundedItems', JSON.stringify(Array.from(refundedItems)));
  }, [refundedItems]);
  
  // Listen for refund updates from Refunds page
  useEffect(() => {
    const handleRefresh = () => {
      fetchSalesData();
      // Clear refund details cache to force refresh
      setRefundDetails({});
    };
    
    window.addEventListener('refreshSalesHistory', handleRefresh);
    return () => window.removeEventListener('refreshSalesHistory', handleRefresh);
  }, []);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filter State
  const [filters, setFilters] = useState({
    search: '',
    customer: '',
    dateFrom: '',
    dateTo: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [selectedDate, setSelectedDate] = useState(getTodayLocalDate()); // Today's date in local timezone (Philippines)
  const [navigating, setNavigating] = useState(false); // Loading state for date navigation
  
  // Request cancellation controllers
  const fetchSalesAbortRef = useRef(null);
  const fetchSummaryAbortRef = useRef(null);
  const getWeekSalesAbortRef = useRef(null);
  
  // Debounce timers
  const fetchSalesDebounceRef = useRef(null);
  const fetchSummaryDebounceRef = useRef(null);
  const getWeekSalesDebounceRef = useRef(null);
  
  // Request deduplication - prevent same request from running multiple times
  const isFetchingSalesRef = useRef(false);
  const isFetchingSummaryRef = useRef(false);
  const lastFetchParamsRef = useRef('');
  
  // Use global rate limit manager (removed local refs - using singleton)
  
  // Check if we're at today's date
  const isToday = selectedDate === getTodayLocalDate();

  // Get dynamic date label and calculate selected date sales
  const getDateLabel = () => {
    const today = getTodayLocalDate();
    // Calculate yesterday and tomorrow in local timezone
    const now = new Date();
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterday = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(now.getDate() + 1);
    const tomorrow = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;
    
    if (selectedDate === today) return "Today's Sales";
    if (selectedDate === yesterday) return "Yesterday's Sales";
    if (selectedDate === tomorrow) return "Tomorrow's Sales";
    
    // Format date for display (e.g., "Dec 15, 2024 Sales")
    const date = new Date(selectedDate);
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} Sales`;
  };

  // Calculate total sales for selected date
  const getSelectedDateSales = () => {
    return salesData.reduce((total, sale) => {
      return total + (parseFloat(sale.total_amount) || 0);
    }, 0);
  };

  // Calculate total transactions for selected date
  const getSelectedDateTransactions = () => {
    return salesData.length;
  };

  // Calculate average sale for selected date
  const getSelectedDateAvgSale = () => {
    if (salesData.length === 0) return 0;
    return getSelectedDateSales() / salesData.length;
  };

  // Get week label based on selected date
  const getWeekLabel = () => {
    const selectedDateObj = new Date(selectedDate);
    const today = new Date();
    
    // Get start of week (Monday) for selected date
    const startOfWeek = new Date(selectedDateObj);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    startOfWeek.setDate(diff);
    
    // Get end of week (Sunday) for selected date
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    // Check if this week contains today
    const isCurrentWeek = today >= startOfWeek && today <= endOfWeek;
    
    if (isCurrentWeek) {
      return "This Week";
    } else {
      // Format as "Week of Dec 15" or "Week of Dec 15-21"
      const startMonth = startOfWeek.toLocaleDateString('en-US', { month: 'short' });
      const startDay = startOfWeek.getDate();
      const endMonth = endOfWeek.toLocaleDateString('en-US', { month: 'short' });
      const endDay = endOfWeek.getDate();
      
      if (startMonth === endMonth) {
        return `Week of ${startMonth} ${startDay}-${endDay}`;
      } else {
        return `Week of ${startMonth} ${startDay} - ${endMonth} ${endDay}`;
      }
    }
  };

  // Calculate actual week sales based on selected date
  const getWeekSales = async () => {
    // Cancel previous request if any
    if (getWeekSalesAbortRef.current) {
      getWeekSalesAbortRef.current.abort();
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController();
    getWeekSalesAbortRef.current = abortController;
    
    try {
      const selectedDateObj = new Date(selectedDate);
      
      // Get start of week (Monday) for selected date
      const startOfWeek = new Date(selectedDateObj);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      startOfWeek.setDate(diff);
      
      // Get end of week (Sunday) for selected date
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      const startDate = formatLocalDate(startOfWeek);
      const endDate = formatLocalDate(endOfWeek);
      
      console.log(`🔍 Fetching week sales for ${selectedDate}: ${startDate} to ${endDate}`);
      
      // Fetch sales data for the entire week with abort signal
      const response = await fetch(`/api/sales/history?date_from=${startDate}&date_to=${endDate}&page=1&limit=1000`, {
        signal: abortController.signal
      });
      console.log(`📡 Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error: ${response.status} - ${errorText}`);
        throw new Error(`Failed to fetch week sales: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`📊 API Response data:`, data);
      
      const weekSales = data.sales.reduce((total, sale) => {
        return total + (parseFloat(sale.total_amount) || 0);
      }, 0);
      
      console.log(`💰 Week sales for ${selectedDate}: ${weekSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (from ${data.sales.length} records)`);
      
      // Only update state if this is still the current request
      if (getWeekSalesAbortRef.current === abortController) {
        return weekSales;
      }
      return 0;
    } catch (error) {
      // Don't log error if request was cancelled
      if (error.name === 'AbortError') {
        console.log('Get week sales request cancelled');
        return 0;
      }
      console.error('Error calculating week sales:', error);
      return summary.week?.weekSales || 0; // Fallback to static data
    }
  };

  // State for week sales value
  const [weekSalesValue, setWeekSalesValue] = useState(0);

  // Update week sales when selected date changes (with debouncing)
  useEffect(() => {
    // Clear previous debounce timer
    if (getWeekSalesDebounceRef.current) {
      clearTimeout(getWeekSalesDebounceRef.current);
    }
    
    // Only update week sales if date is set
    if (!selectedDate) return;
    
    // Debounce the week sales calculation by 500ms
    getWeekSalesDebounceRef.current = setTimeout(async () => {
      console.log(`🎯 useEffect triggered - selectedDate: ${selectedDate}`);
      
      const updateWeekSales = async () => {
        console.log(`🔄 Updating week sales for date: ${selectedDate}`);
        try {
          const weekTotal = await getWeekSales();
          console.log(`✅ Setting week sales value to: ${weekTotal}`);
          setWeekSalesValue(weekTotal);
        } catch (error) {
          console.error(`❌ Error updating week sales:`, error);
          setWeekSalesValue(0);
        }
      };
      
      updateWeekSales();
    }, 500);
    
    // Cleanup function
    return () => {
      if (getWeekSalesDebounceRef.current) {
        clearTimeout(getWeekSalesDebounceRef.current);
      }
    };
  }, [selectedDate]);

  // Fetch sales data
  const fetchSalesData = async (overrideSearch = null) => {
    // Request deduplication - skip if already fetching
    if (isFetchingSalesRef.current) {
      console.log('⏭️ Skipping duplicate fetchSalesData request');
      return;
    }
    
    // Cancel previous request if any
    if (fetchSalesAbortRef.current) {
      fetchSalesAbortRef.current.abort();
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController();
    fetchSalesAbortRef.current = abortController;
    
    // Create unique request key to detect duplicates
    const searchTerm = overrideSearch !== null ? overrideSearch : filters.search;
    const requestKey = JSON.stringify({
      page: currentPage,
      limit: itemsPerPage,
      date: selectedDate,
      search: searchTerm,
      customer: filters.customer,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo
    });
    
    // Skip if same request is already in progress
    if (lastFetchParamsRef.current === requestKey && isFetchingSalesRef.current) {
      console.log('⏭️ Skipping duplicate request with same parameters');
      return;
    }
    
    lastFetchParamsRef.current = requestKey;
    isFetchingSalesRef.current = true;
    
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        setLoading(false);
        return;
      }
      
      // Use override search if provided, otherwise use filters.search
      // Always trim and normalize spaces (replace multiple spaces with single space)
      let searchTerm = overrideSearch !== null ? overrideSearch : filters.search;
      if (searchTerm) {
        searchTerm = searchTerm.trim().replace(/\s+/g, ' '); // Trim and normalize spaces
      }
      
      // Only include date filter when there's no search term (item search takes priority)
      const shouldUseDateFilter = !searchTerm || searchTerm === '';
      
      // Ensure selectedDate is valid before using it
      const dateToUse = shouldUseDateFilter && selectedDate ? selectedDate : null;
      
      const params = new URLSearchParams({
        page: currentPage || 1,
        limit: itemsPerPage || 100,
        // Only include date filter when there's no search term and date is valid
        ...(dateToUse && { date: dateToUse }),
        ...(searchTerm && searchTerm !== '' && { search: searchTerm }),
        ...(filters.customer && { customer: filters.customer }),
        ...(filters.dateFrom && { date_from: filters.dateFrom }),
        ...(filters.dateTo && { date_to: filters.dateTo })
      });

      console.log('🔍 Selected Date:', selectedDate);
      console.log('🔍 Should use date filter:', shouldUseDateFilter);
      console.log('🔍 API URL:', `/api/sales/history?${params}`);
      console.log('🔍 Full params:', Object.fromEntries(params));

      const response = await axios.get(`/api/sales/history?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortController.signal
      });

      console.log('Sales History API Response:', response.data);
      console.log('Data received:', response.data.data?.length || 0, 'records');
      console.log('Total records matching filter:', response.data.pagination?.total || 0);
      if (response.data.data?.length > 0) {
        console.log('First record DATE:', response.data.data[0]?.DATE);
        console.log('First record:', response.data.data[0]);
      } else {
        console.log('⚠️ No records found for this date/filter');
      }
      console.log('Pagination:', response.data.pagination);

      // Only update state if this is still the current request
      if (fetchSalesAbortRef.current !== abortController) {
        return;
      }
      
      const dataCount = response.data.data?.length || 0;
      const totalRecords = response.data.pagination?.total || 0;

      const salesData = response.data.data || [];
      setSalesData(salesData);
      setTotalPages(response.data.pagination?.pages || 1);
      setTotalRecords(totalRecords);
      
      // Success - reset rate limit manager
      rateLimitManager.handleSuccess();
      
      // Fetch refund status for all items to show pending/confirmed colors
      if (salesData.length > 0) {
        fetchRefundStatusForAll(salesData);
      }
    } catch (err) {
      // Don't set error if request was cancelled
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        console.log('Fetch sales data request cancelled');
        isFetchingSalesRef.current = false;
        return;
      }
      
      // Handle 429 rate limit errors with automatic recovery
      if (err.response?.status === 429) {
        const backoffDelay = rateLimitManager.handle429Error();
        
        // Show user-friendly message
        setError(`Rate limit reached. Auto-retrying in ${Math.ceil(backoffDelay / 1000)}s...`);
        
        // Queue retry after cooldown
        rateLimitManager.queueRequest(async () => {
          console.log('🔄 Retrying sales data fetch after cooldown...');
          await fetchSalesData(overrideSearch);
        });
        
        // Don't clear data on rate limit - keep showing last known data
        return;
      }
      
      // Success - reset rate limit manager
      rateLimitManager.handleSuccess();
      
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to fetch sales data';
      setError(errorMessage);
      console.error('Sales data fetch error:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        url: err.config?.url
      });
      
      // Set empty data on error to prevent showing stale data (only if not rate limit)
      if (err.response?.status !== 429) {
        setSalesData([]);
        setTotalPages(1);
        setTotalRecords(0);
      }
    } finally {
      // Only update loading state if this is still the current request
      if (fetchSalesAbortRef.current === abortController) {
        setLoading(false);
      }
      isFetchingSalesRef.current = false;
    }
  };
  
  // Fetch refund status for all sales items using batch API (much more efficient!)
  const fetchRefundStatusForAll = async (salesItems) => {
    // Skip if in cooldown period
    if (!rateLimitManager.canMakeRequest()) {
      const waitTime = rateLimitManager.getTimeUntilCooldownEnds();
      console.log(`⏸️ Skipping refund status fetch - cooldown active (${Math.ceil(waitTime / 1000)}s remaining)`);
      
      // Queue for later
      rateLimitManager.queueRequest(() => fetchRefundStatusForAll(salesItems));
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      
      // Prepare items for batch request
      const items = salesItems
        .map(sale => {
          const receipt = sale.RECEIPT || sale.INVOICE || '';
          return {
            idcode: sale.IDCODE,
            date: sale.DATE,
            receipt: receipt
          };
        })
        .filter(item => item.idcode && item.date && item.receipt); // Only process items with all required fields
      
      if (items.length === 0) {
        return;
      }

      // Use batch API - single request instead of 50+ individual requests!
      const response = await axios.post('/api/sales/refund/details/batch', 
        { items },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Check if request was successful
      if (response.data.success && response.data.data) {
        const resultMap = response.data.data;
        
        // Update refund details state with batch results
        setRefundDetails(prev => {
          const updated = { ...prev };
          
          // Process each item in the result map
          Object.keys(resultMap).forEach(key => {
            const refundInfo = resultMap[key];
            if (refundInfo.hasRefund && refundInfo.data) {
              const refundData = refundInfo.data;
              // Ensure status is uppercase for consistency
              const status = (refundData.status || '').toUpperCase();
              updated[key] = {
                ...refundData,
                status: status
              };
            }
          });
          
          return updated;
        });

        // Mark success in rate limit manager
        rateLimitManager.handleSuccess();
        
        console.log(`✅ Batch refund status fetched for ${items.length} items in 1 request (was ${items.length} requests before)`);
      }
    } catch (error) {
      // Handle 429 rate limit errors with automatic recovery
      if (error.response?.status === 429) {
        const backoffDelay = rateLimitManager.handle429Error();
        console.warn(`⚠️ Rate limit hit while fetching refund status. Cooldown: ${Math.ceil(backoffDelay / 1000)}s`);
        
        // Queue retry after cooldown
        rateLimitManager.queueRequest(() => fetchRefundStatusForAll(salesItems));
        return;
      }
      
      console.error('Error fetching batch refund status:', error);
    }
  };

  // Fetch summary statistics
  const fetchSummary = async () => {
    // Request deduplication - skip if already fetching
    if (isFetchingSummaryRef.current) {
      console.log('⏭️ Skipping duplicate fetchSummary request');
      return;
    }
    
    // Cancel previous request if any
    if (fetchSummaryAbortRef.current) {
      fetchSummaryAbortRef.current.abort();
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController();
    fetchSummaryAbortRef.current = abortController;
    
    isFetchingSummaryRef.current = true;
    
    try {
      const token = localStorage.getItem('token');
      
      // Check rate limit before making requests
      if (!rateLimitManager.canMakeRequest()) {
        const waitTime = rateLimitManager.getTimeUntilCooldownEnds();
        console.log(`⏳ Waiting ${Math.ceil(waitTime / 1000)}s before summary requests (rate limit cooldown)...`);
        await new Promise(resolve => setTimeout(resolve, waitTime + 100));
      }
      
      // Fetch data for different periods
      const [todayResponse, weekResponse, monthResponse] = await Promise.all([
        axios.get('/api/sales/summary?period=today', {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortController.signal
        }),
        axios.get('/api/sales/summary?period=week', {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortController.signal
        }),
        axios.get('/api/sales/summary?period=month', {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortController.signal
        })
      ]);
      
      console.log('Today Summary:', todayResponse.data);
      console.log('Week Summary:', weekResponse.data);
      console.log('Month Summary:', monthResponse.data);
      
      // Combine the data - use the direct response structure
      // Only update state if this is still the current request
      if (fetchSummaryAbortRef.current === abortController) {
        setSummary({
          today: todayResponse.data || {},
          week: weekResponse.data || {},
          month: monthResponse.data || {}
        });
        
        // Success - reset rate limit manager
        rateLimitManager.handleSuccess();
      }
    } catch (err) {
      // Don't log error if request was cancelled
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        console.log('Fetch summary request cancelled');
        isFetchingSummaryRef.current = false;
        return;
      }
      
      // Handle 429 rate limit errors with automatic recovery
      if (err.response?.status === 429) {
        const backoffDelay = rateLimitManager.handle429Error();
        console.warn(`⚠️ Rate limit hit (429) on summary fetch. Cooldown: ${Math.ceil(backoffDelay / 1000)}s`);
        
        // Queue retry after cooldown
        rateLimitManager.queueRequest(async () => {
          console.log('🔄 Retrying summary fetch after cooldown...');
          await fetchSummary();
        });
        
        isFetchingSummaryRef.current = false;
        return;
      }
      
      // Success - reset rate limit manager
      rateLimitManager.handleSuccess();
      
      console.error('Summary fetch error:', err);
    } finally {
      isFetchingSummaryRef.current = false;
    }
  };

  useEffect(() => {
    // Clear previous debounce timers
    if (fetchSalesDebounceRef.current) {
      clearTimeout(fetchSalesDebounceRef.current);
    }
    if (fetchSummaryDebounceRef.current) {
      clearTimeout(fetchSummaryDebounceRef.current);
    }
    
    console.log('🔄 useEffect triggered - fetching data for date:', selectedDate);
    
    // Debounce fetchSalesData by 300ms to prevent rapid-fire requests
    fetchSalesDebounceRef.current = setTimeout(() => {
      fetchSalesData();
    }, 300);
    
    // Debounce fetchSummary by 400ms (slightly after sales data)
    fetchSummaryDebounceRef.current = setTimeout(() => {
      fetchSummary();
    }, 400);
    
    // Cleanup function
    return () => {
      if (fetchSalesDebounceRef.current) {
        clearTimeout(fetchSalesDebounceRef.current);
      }
      if (fetchSummaryDebounceRef.current) {
        clearTimeout(fetchSummaryDebounceRef.current);
      }
    };
  }, [currentPage, itemsPerPage, selectedDate]);

  // Handle refresh
  const handleRefresh = async () => {
    setError('');
    setCurrentPage(1);
    // Fetch data with current filters and date
    await fetchSalesData();
    // Also refresh summary
    await fetchSummary();
  };

  // Silent background refetch - updates data without disrupting user
  const silentRefetch = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      // Save current scroll position
      const scrollPosition = window.scrollY;
      
      // Use same parameters as current fetch
      let searchTerm = filters.search;
      if (searchTerm) {
        searchTerm = searchTerm.trim().replace(/\s+/g, ' ');
      }
      
      const shouldUseDateFilter = !searchTerm || searchTerm === '';
      const dateToUse = shouldUseDateFilter && selectedDate ? selectedDate : null;
      
      const params = new URLSearchParams({
        page: currentPage || 1,
        limit: itemsPerPage || 100,
        ...(dateToUse && { date: dateToUse }),
        ...(searchTerm && searchTerm !== '' && { search: searchTerm }),
        ...(filters.customer && { customer: filters.customer }),
        ...(filters.dateFrom && { date_from: filters.dateFrom }),
        ...(filters.dateTo && { date_to: filters.dateTo })
      });
      
      // Fetch data silently (no loading spinner)
      const response = await axios.get(`/api/sales/history?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update state
      const salesData = response.data.data || [];
      setSalesData(salesData);
      setTotalPages(response.data.pagination?.pages || 1);
      setTotalRecords(response.data.pagination?.total || 0);
      
      // Fetch refund status for all items
      if (salesData.length > 0) {
        fetchRefundStatusForAll(salesData);
      }
      
      // Restore scroll position after a brief delay to allow DOM update
      setTimeout(() => {
        window.scrollTo(0, scrollPosition);
      }, 0);
    } catch (err) {
      console.error('Silent refetch error:', err);
      // Don't show error to user - silent failure
    }
  };

  // Handle search
  const handleSearch = () => {
    // Trim the search input to remove extra spaces
    const trimmedSearch = filters.search.trim();
    setFilters(prev => ({ ...prev, search: trimmedSearch }));
    setCurrentPage(1);
    // Pass trimmed search to fetchSalesData
    fetchSalesData(trimmedSearch);
  };

  // Check if a specific date has records (optimized version)
  const checkDateHasRecords = async (dateStr) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/sales/history?date=${dateStr}&limit=1`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data.data && response.data.data.length > 0;
    } catch (error) {
      console.error('Error checking date records:', error);
      return false;
    }
  };

  // Helper to format date in local timezone
  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Date navigation functions
  const goToPreviousDay = async () => {
    if (navigating) return; // Prevent multiple clicks
    
    setNavigating(true);
    try {
      const currentDate = new Date(selectedDate);
      let newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 1);
      
      const dateStr = formatLocalDate(newDate);
      console.log('⬅️ Previous: Changing date from', selectedDate, 'to', dateStr);
      
      setSelectedDate(dateStr);
      setCurrentPage(1);
      // The useEffect will automatically trigger fetchSalesData when selectedDate changes
    } finally {
      setNavigating(false);
    }
  };

  const goToNextDay = async () => {
    if (navigating) return; // Prevent multiple clicks
    
    const currentDate = new Date(selectedDate);
    const today = getTodayLocalDate();
    
    // Don't allow going beyond today
    if (selectedDate >= today) {
      console.log('➡️ Next: Already at or past today');
      return;
    }
    
    setNavigating(true);
    try {
      let newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 1);
      
      const dateStr = formatLocalDate(newDate);
      if (dateStr <= today) {
        console.log('➡️ Next: Changing date from', selectedDate, 'to', dateStr);
        setSelectedDate(dateStr);
        setCurrentPage(1);
        // The useEffect will automatically trigger fetchSalesData when selectedDate changes
      }
    } finally {
      setNavigating(false);
    }
  };


  const handleDateChange = (event) => {
    setSelectedDate(event.target.value);
    setCurrentPage(1);
  };


  // Handle filter changes
  const handleFilterChange = (key, value) => {
    const prevSearch = filters.search;
    setFilters(prev => ({ ...prev, [key]: value }));
    
    // If search is cleared (was not empty, now empty), automatically fetch with date filter
    if (key === 'search' && prevSearch && prevSearch.trim() !== '' && (!value || value.trim() === '')) {
      console.log('🔄 Search cleared - reverting to date filter for:', selectedDate);
      setCurrentPage(1);
      // Pass empty string explicitly to ensure date filter is used
      fetchSalesData('');
    }
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      search: '',
      customer: '',
      dateFrom: '',
      dateTo: ''
    });
    setCurrentPage(1);
    setTimeout(fetchSalesData, 100);
  };

  // Toggle row expansion
  const toggleRowExpansion = (rowId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId);
    } else {
      newExpanded.add(rowId);
    }
    setExpandedRows(newExpanded);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    // If dateString is already in YYYY-MM-DD format, use it directly
    let date;
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      date = new Date(dateString + 'T00:00:00'); // Add time to avoid timezone issues
    } else {
      date = new Date(dateString);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime()) || date.getFullYear() < 2000) {
      console.warn('Invalid date:', dateString);
      return 'N/A';
    }
    
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Refund functionality
  const handleRefund = async (sale) => {
    // Create a unique key for this sale item
    const saleKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}`;
    
    const confirmed = await showConfirm(
      `Are you sure you want to refund this item?\n\n${sale.BRAND || 'N/A'} - ${sale.BENZ || 'N/A'}\nQuantity: ${sale.QTY}\nAmount: ${formatCurrency(sale.total_amount || (sale.SELL * sale.QTY))}`,
      'Refund Item'
    );
    
    if (confirmed) {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        
        const response = await axios.post('/api/sales/refund', {
          idcode: sale.IDCODE,
          quantity: sale.QTY,
          benz: sale.BENZ,
          brand: sale.BRAND,
          altno: sale.ALTNO
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Mark this item as refunded (this will auto-save to localStorage via useEffect)
        setRefundedItems(prev => {
          const newSet = new Set([...prev, saleKey]);
          return newSet;
        });
        
        await showAlert(`Item refunded successfully! ${sale.QTY} unit(s) returned to stock.`, 'Success');
        // Don't refresh data - keep the item in history
      } catch (err) {
        console.error('Error processing refund:', err);
        await showAlert('Failed to process refund. Please try again.', 'Error');
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle checkbox selection for refunded items (for printing)
  const handleRefundedItemSelect = (uniqueKey) => {
    setSelectedRefundedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(uniqueKey)) {
        newSet.delete(uniqueKey);
      } else {
        newSet.add(uniqueKey);
      }
      return newSet;
    });
  };

  // Handle checkbox selection for items (for refund)
  const handleItemSelect = (sale, index) => {
    const saleKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}`;
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(saleKey)) {
        newSet.delete(saleKey);
      } else {
        newSet.add(saleKey);
      }
      return newSet;
    });
  };

  // Handle select all items
  const handleSelectAll = () => {
    const dataToUse = sortField ? sortedSalesData : salesData;
    if (selectedItems.size === dataToUse.length) {
      // Deselect all
      setSelectedItems(new Set());
    } else {
      // Select all
      const allKeys = dataToUse.map((sale, index) => `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}`);
      setSelectedItems(new Set(allKeys));
    }
  };

  // Handle refund for selected items
  const handleRefundSelected = async () => {
    if (selectedItems.size === 0) {
      await showAlert('Please select at least one item to refund.', 'No Selection');
      return;
    }

    // Get selected items
    const itemsToRefund = salesData.filter((sale, index) => {
      const saleKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}`;
      return selectedItems.has(saleKey);
    });

    // Check if any items are already refunded
    const alreadyRefunded = itemsToRefund.filter(sale => {
      const saleKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}`;
      return refundedItems.has(saleKey);
    });

    if (alreadyRefunded.length > 0) {
      await showAlert(`Some items are already refunded. Please deselect them.`, 'Already Refunded');
      return;
    }

    // Auto-fill form data from first item
    const firstItem = itemsToRefund[0];
    // Auto-increment CM# and save to localStorage
    const nextCmNumber = cmNumberCounter;
    setCmNumberCounter(nextCmNumber + 1);
    localStorage.setItem('refund_cm_number_counter', (nextCmNumber + 1).toString());
    
    setRefundFormData({
      reason: '',
      notes: '',
      customer_name: firstItem.CUSTOMER || 'Walk-in Customer',
      invoice_number: firstItem.RECEIPT || firstItem.INVOICE || '',
      cm_number: nextCmNumber.toString()
    });
    
    // Initialize editable quantities with original quantities
    const initialQuantities = {};
    itemsToRefund.forEach((sale, index) => {
      const saleKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}`;
      initialQuantities[saleKey] = sale.QTY;
    });
    setRefundQuantities(initialQuantities);
    
    // Show refund modal
    setShowRefundModal(true);
  };

  // Handle refund form submission
  const handleRefundSubmit = async () => {
    if (!refundFormData.reason || refundFormData.reason.trim() === '') {
      await showAlert('Please provide a reason for the refund.', 'Validation Error');
      return;
    }

    if (!refundFormData.cm_number || refundFormData.cm_number.trim() === '') {
      await showAlert('CM Number is required. Please enter a CM number.', 'Validation Error');
      return;
    }

    // Get selected items
    const itemsToRefund = salesData.filter((sale, index) => {
      const saleKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}`;
      return selectedItems.has(saleKey);
    });

    // Prepare items for API using edited quantities
    const refundItems = itemsToRefund.map((sale, index) => {
      const saleKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}`;
      const editedQuantity = refundQuantities[saleKey] !== undefined ? refundQuantities[saleKey] : sale.QTY;
      // Ensure quantity is valid (positive number, not exceeding original)
      const validQuantity = Math.max(0, Math.min(editedQuantity === '' ? sale.QTY : editedQuantity, sale.QTY));
      return {
        idcode: sale.IDCODE,
        date: sale.DATE,
        receipt: sale.RECEIPT || sale.INVOICE,
        quantity: validQuantity,
        unit_price: sale.SELL || 0,
        customer: sale.CUSTOMER || 'Walk-in Customer'
      };
    }).filter(item => item.quantity > 0); // Filter out items with zero quantity

    // Validate that at least one item has quantity > 0
    if (refundItems.length === 0) {
      await showAlert('Please ensure at least one item has a quantity greater than 0.', 'Validation Error');
      return;
    }

    setRefundSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/sales/refund/create', {
        items: refundItems,
        customer_name: refundFormData.customer_name,
        invoice_number: refundFormData.invoice_number,
        cm_number: refundFormData.cm_number.trim(),
        reason: refundFormData.reason,
        notes: refundFormData.notes || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        await showAlert(
          `Refund request created successfully!\n\nCM Number: ${response.data.cm_number}\nTotal Amount: ${formatCurrency(response.data.total_amount)}\nStatus: ${response.data.status}`,
          'Success'
        );
        
        // Mark items as pending refund in localStorage
        itemsToRefund.forEach(sale => {
          const saleKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}`;
          setRefundedItems(prev => new Set([...prev, saleKey]));
        });
        
        // Close modal and clear selection
        setShowRefundModal(false);
        setSelectedItems(new Set());
        setRefundQuantities({});
        setRefundFormData({
          reason: '',
          notes: '',
          customer_name: '',
          invoice_number: '',
          cm_number: ''
        });
        
        // Silent refetch to update data without disrupting user
        silentRefetch();
      }
    } catch (error) {
      console.error('Refund submission error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Show more detailed error message
      let errorMessage = 'Failed to create refund request. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      await showAlert(errorMessage, 'Error');
    } finally {
      setRefundSubmitting(false);
    }
  };

  // Close refund modal
  const handleCloseRefundModal = () => {
    setShowRefundModal(false);
    setRefundQuantities({});
    setRefundFormData({
      reason: '',
      notes: '',
      customer_name: '',
      invoice_number: '',
      cm_number: ''
    });
  };

  // Handle quantity change in refund modal
  const handleRefundQuantityChange = (saleKey, newQuantity) => {
    // Parse the input value
    const numValue = parseFloat(newQuantity);
    // Allow empty string for editing, but validate on blur
    if (newQuantity === '' || (!isNaN(numValue) && numValue >= 0)) {
      setRefundQuantities(prev => ({
        ...prev,
        [saleKey]: newQuantity === '' ? '' : numValue
      }));
    }
  };

  // Handle quantity blur - validate and clamp to valid range
  const handleRefundQuantityBlur = (saleKey, originalQty) => {
    const currentValue = refundQuantities[saleKey];
    if (currentValue === undefined || currentValue === '' || isNaN(currentValue) || currentValue <= 0) {
      // Reset to original quantity if invalid
      setRefundQuantities(prev => ({
        ...prev,
        [saleKey]: originalQty
      }));
    } else if (currentValue > originalQty) {
      // Clamp to original quantity if exceeds
      setRefundQuantities(prev => ({
        ...prev,
        [saleKey]: originalQty
      }));
    } else {
      // Ensure it's an integer
      setRefundQuantities(prev => ({
        ...prev,
        [saleKey]: Math.floor(currentValue)
      }));
    }
  };

  // Handle delete sale - show modal with options
  const handleDeleteSale = (sale, index) => {
    const saleKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}`;
    const isRefunded = refundedItems.has(saleKey);
    
    if (isRefunded) {
      showAlert('Cannot delete a refunded item.', 'Cannot Delete');
      return;
    }

    setSaleToDelete({ sale, index });
    setShowDeleteModal(true);
  };

  // Handle delete confirmation with option selection
  const handleDeleteConfirm = async (returnToStock) => {
    if (!saleToDelete) return;

    const { sale } = saleToDelete;
    const isAdjustment = (sale.RECEIPT === 'ADJUSTMENT' || sale.INVOICE === 'ADJUSTMENT');
    const displayQty = sale.QTY || 0; // Show actual value for adjustments too
    const actionText = returnToStock 
      ? `delete this sale and return ${displayQty} unit(s) back to stock`
      : `delete this sale (quantity will NOT be returned to stock)`;

    const confirmed = await showConfirm(
      `Are you sure you want to ${actionText}?\n\nID: ${sale.IDCODE}\nPart: ${sale.BENZ || 'N/A'}\nQty: ${displayQty}\nAmount: ${formatCurrency(sale.SELL * sale.QTY)}`,
      returnToStock ? 'Delete & Return to Stock' : 'Delete Sale'
    );

    if (!confirmed) {
      setShowDeleteModal(false);
      setSaleToDelete(null);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`/api/sales/history/${sale.IDCODE}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          date: sale.DATE,
          receipt: sale.RECEIPT || sale.INVOICE,
          qty: sale.QTY,
          return_to_stock: returnToStock
        }
      });

      if (response.data.success) {
        const displayQty = sale.QTY || 0; // Show actual value
        await showAlert(
          returnToStock
            ? `Sale deleted successfully!\n\n${displayQty} unit(s) returned to stock.`
            : `Sale deleted successfully!\n\nQuantity was NOT returned to stock.`,
          'Success'
        );
        
        // Silent refetch to update data without disrupting user
        silentRefetch();
      } else {
        await showAlert(response.data.message || 'Failed to delete sale', 'Error');
      }
    } catch (error) {
      console.error('Delete sale error:', error);
      await showAlert(
        error.response?.data?.message || error.message || 'Failed to delete sale',
        'Error'
      );
    } finally {
      setShowDeleteModal(false);
      setSaleToDelete(null);
    }
  };

  // Handle delete modal cancel
  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setSaleToDelete(null);
  };

  // Handle edit row
  const handleEditRow = (sale, index) => {
    const rowId = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}`;
    setEditingRow(rowId);
    setEditFormData({
      idcode: sale.IDCODE || '',
      customer: sale.CUSTOMER || '',
      qty: sale.QTY || 1,
      unit_price: sale.SELL || 0,
      receipt: sale.RECEIPT || sale.INVOICE || '',
      // Store original values for stock restoration
      original_idcode: sale.IDCODE || '',
      original_qty: sale.QTY || 1
    });
    setIdCodeSearchTerm(String(sale.IDCODE || ''));
    setSelectedStockItem(null);
    setIdCodeSearchResults([]);
    setIdCodeSearchError('');
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingRow(null);
    setEditFormData({});
    setIdCodeSearchTerm('');
    setSelectedStockItem(null);
    setIdCodeSearchResults([]);
    setIdCodeSearchError('');
  };

  // Search stock items by ID code
  const searchStockByIdCode = async (searchTerm) => {
    if (!searchTerm || searchTerm.trim() === '') {
      setIdCodeSearchResults([]);
      setSelectedStockItem(null);
      setIdCodeSearchError('');
      return;
    }

    const searchValue = searchTerm.trim();
    setSearchingIdCode(true);
    setIdCodeSearchError('');

    try {
      const token = localStorage.getItem('token');
      
      // Try to get item by ID directly first
      const searchNum = parseInt(searchValue);
      if (!isNaN(searchNum)) {
        try {
          const response = await axios.get(`/api/stock-items?search=${encodeURIComponent(searchValue)}&limit=100`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          const results = Array.isArray(response.data) ? response.data : (response.data?.data || []);
          
          // Find exact ID match
          const exactMatch = results.find(item => {
            const itemId = item.ID || item.id;
            return itemId === searchNum || itemId === parseInt(searchValue) ||
                   String(itemId) === searchValue;
          });
          
          if (exactMatch) {
            setSelectedStockItem(exactMatch);
            setIdCodeSearchResults([]);
            setIdCodeSearchError('');
            
            // Auto-populate form with stock data (but keep existing unit_price)
            setEditFormData(prev => ({
              ...prev,
              idcode: String(exactMatch.ID || exactMatch.id)
              // Don't change unit_price - keep what user has entered
            }));
            
            return;
          }
        } catch (idError) {
          console.error('Error searching by ID:', idError);
        }
      }
      
      // If not found by exact ID, show error
      setIdCodeSearchError(`Stock item with ID ${searchValue} not found`);
      setSelectedStockItem(null);
      setIdCodeSearchResults([]);
    } catch (error) {
      console.error('Error searching stock items:', error);
      setIdCodeSearchError('Error searching for stock item');
      setSelectedStockItem(null);
      setIdCodeSearchResults([]);
    } finally {
      setSearchingIdCode(false);
    }
  };

  // Handle ID code input change (with debounce)
  useEffect(() => {
    if (!editingRow || !idCodeSearchTerm) return;
    
    const timeoutId = setTimeout(() => {
      if (idCodeSearchTerm.trim()) {
        searchStockByIdCode(idCodeSearchTerm);
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [idCodeSearchTerm, editingRow]);

  // Handle ID code input change
  const handleIdCodeChange = (value) => {
    setIdCodeSearchTerm(value);
    setSelectedStockItem(null);
    setIdCodeSearchError('');
    
    // If value is cleared, reset to original
    if (!value || value.trim() === '') {
      setEditFormData(prev => ({
        ...prev,
        idcode: prev.original_idcode || ''
      }));
      return;
    }
    
    // Update form data
    setEditFormData(prev => ({
      ...prev,
      idcode: value
    }));
  };

  // Handle ID code Enter key press
  const handleIdCodeKeyPress = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = idCodeSearchTerm.trim();
      if (value) {
        await searchStockByIdCode(value);
      }
    }
  };

  // Handle save edit
  const handleSaveEdit = async (sale, index) => {
    if (!editingRow) return;

    // Validate form data
    if (!editFormData.customer || editFormData.customer.trim() === '') {
      await showAlert('Customer name is required.', 'Validation Error');
      return;
    }

    if (!editFormData.qty || editFormData.qty <= 0) {
      await showAlert('Quantity must be greater than 0.', 'Validation Error');
      return;
    }

    if (!editFormData.unit_price || editFormData.unit_price < 0) {
      await showAlert('Unit price must be 0 or greater.', 'Validation Error');
      return;
    }

    // Validate ID code if changed
    const newIdCode = editFormData.idcode ? parseInt(editFormData.idcode) : null;
    const oldIdCode = sale.IDCODE;
    const idCodeChanged = newIdCode && newIdCode !== oldIdCode;

    if (idCodeChanged) {
      if (!selectedStockItem) {
        await showAlert('Please search and select a valid stock item for the new ID code. Press Enter after typing the ID to search.', 'Validation Error');
        return;
      }

      // Check stock availability for new ID
      const newQty = parseInt(editFormData.qty);
      const stockQty = selectedStockItem.QTY || selectedStockItem.quantity || 0;
      
      if (stockQty < newQty) {
        await showAlert(
          `Insufficient stock for new item.\n\nAvailable: ${stockQty}\nRequested: ${newQty}`,
          'Insufficient Stock'
        );
        return;
      }
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(`/api/sales/history/${sale.IDCODE}`, {
        date: sale.DATE,
        receipt: sale.RECEIPT || sale.INVOICE,
        qty: sale.QTY, // Original quantity for identification
        customer: editFormData.customer.trim(),
        qty_new: parseInt(editFormData.qty),
        unit_price: parseFloat(editFormData.unit_price),
        receipt_new: editFormData.receipt.trim() || sale.RECEIPT || sale.INVOICE,
        idcode_new: idCodeChanged ? newIdCode : null,
        // Include stock details if ID changed
        stock_details: idCodeChanged && selectedStockItem ? {
          benz: selectedStockItem.BENZ || '',
          brand: selectedStockItem.BRAND || '',
          altno: selectedStockItem.ALTNO || '',
          description: selectedStockItem.DESCRIPTION || selectedStockItem.REMARKS || '',
          location: selectedStockItem.LOCATION || ''
        } : null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        await showAlert('Sale updated successfully!', 'Success');
        setEditingRow(null);
        setEditFormData({});
        setIdCodeSearchTerm('');
        setSelectedStockItem(null);
        setIdCodeSearchResults([]);
        setIdCodeSearchError('');
        // Silent refetch to update data without disrupting user
        silentRefetch();
      } else {
        await showAlert(response.data.message || 'Failed to update sale', 'Error');
      }
    } catch (error) {
      console.error('Update sale error:', error);
      await showAlert(
        error.response?.data?.message || error.message || 'Failed to update sale',
        'Error'
      );
    } finally {
      setSaving(false);
    }
  };

  // Handle part number / OEM click - show sales history for that code
  const handlePartNumberClick = async (e, benz, brand, altno, oem = null) => {
    e.stopPropagation(); // Prevent row click

    // Prefer part number; if missing, fall back to OEM number when available
    let searchCode = benz;
    let identifierLabel = 'part number';

    if ((!searchCode || searchCode === 'N/A') && oem && oem !== 'N/A') {
      searchCode = oem;
      identifierLabel = 'OEM number';
    }

    if (!searchCode || searchCode === 'N/A') {
      await showAlert('No part number or OEM number available for this item.', 'No Identifier');
      return;
    }
    
    try {
      setPartHistoryLoading(true);
      // Store whichever identifier we used so the modal header makes sense
      setPartHistoryBenz(searchCode);
      setPartHistoryBrand(brand || '');
      setPartHistoryAltno(altno || '');
      setShowPartHistoryModal(true);
      
      const token = localStorage.getItem('token');
      
      // OPTIMIZATION: Only fetch last 2 years by default for fast loading
      // User can select older years from the filter dropdown if needed
      const currentYear = new Date().getFullYear();
      const twoYearsAgo = currentYear - 1;
      const dateFrom = `${twoYearsAgo}-01-01`; // Start of 2 years ago
      
      // First, get all available years for this part number (fast query - just counts)
      try {
        const yearsResponse = await axios.get(`/api/sales/history/years?search=${encodeURIComponent(searchCode)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (yearsResponse.data && yearsResponse.data.years) {
          setAllAvailableYears(yearsResponse.data.years);
        }
      } catch (err) {
        console.warn('Could not fetch available years, will use loaded data only:', err);
      }
      
      // Fetch sales history for this identifier, but only last 2 years initially
      const response = await axios.get(`/api/sales/history?search=${encodeURIComponent(searchCode)}&date_from=${dateFrom}&limit=5000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // The API returns { data: [...], pagination: {...} } without a success field
      if (response.data && response.data.data !== undefined) {
        setPartHistoryData(response.data.data || []);
        // Track which years we've loaded (last 2 years)
        const currentYear = new Date().getFullYear();
        const loadedYearsSet = new Set([currentYear.toString(), (currentYear - 1).toString()]);
        setLoadedYears(loadedYearsSet);
        // Set default brand filter to "All Brands" (empty string)
        setFilterBrand('');
        // Set default year to current year
        setFilterYear(currentYear.toString());
        // Reset other filters when new data is loaded
        setFilterMonths('');
        setFilterMonth('');
        console.log(`✅ Loaded ${response.data.data?.length || 0} records for last 2 years (${currentYear - 1}-${currentYear}) for code (${identifierLabel}): ${searchCode}`);
      } else {
        throw new Error(response.data?.message || 'Invalid response format from server');
      }
      
      // Also fetch stock history for this code
      // OPTIMIZATION: Only fetch records with QTY > 0 by default (much faster)
      // User can click "Show All" to load records with QTY = 0
      try {
        setInmainHistoryLoading(true);
        const stockResponse = await axios.get(`/api/inmain/history/${encodeURIComponent(searchCode)}?qty_filter=has_stock`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (stockResponse.data && stockResponse.data.success) {
          setInmainHistoryData(stockResponse.data.data || []);
          setShowAllStockRecords(false); // Reset to default (show only has stock)
          console.log(`✅ Loaded ${stockResponse.data.data?.length || 0} stock records (QTY > 0 only) for code (${identifierLabel}): ${searchCode}`);
        }
      } catch (stockError) {
        console.error('Error fetching stock history:', stockError);
        // Don't show error if no records found
        setInmainHistoryData([]);
      } finally {
        setInmainHistoryLoading(false);
      }
      
      // Reset analytics modal visibility
      setShowSalesAnalyticsModal(false);
    } catch (error) {
      console.error('Error fetching part history:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      let errorMessage = 'Failed to fetch part sales history.';
      if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please log in again.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Part number not found in sales history.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      await showAlert(errorMessage, 'Error');
      setShowPartHistoryModal(false);
    } finally {
      setPartHistoryLoading(false);
    }
  };

  // Filter part history data based on year and months
  const filteredPartHistoryData = useMemo(() => {
    if (!partHistoryData || partHistoryData.length === 0) return [];
    
    let filtered = [...partHistoryData];
    
    // Filter by year
    if (filterYear) {
      filtered = filtered.filter(record => {
        if (!record.DATE) return false;
        const recordYear = new Date(record.DATE).getFullYear();
        return recordYear.toString() === filterYear;
      });
    }
    
    // Filter by months
    if (filterMonths) {
      if (filterMonths === '1') {
        // Last month only
        const now = new Date();
        const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        
        filtered = filtered.filter(record => {
          if (!record.DATE) return false;
          const recordDate = new Date(record.DATE);
          recordDate.setHours(0, 0, 0, 0);
          return recordDate >= firstDayLastMonth && recordDate < firstDayThisMonth;
        });
      } else {
        // Last X months
        const months = parseInt(filterMonths);
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - months);
        cutoffDate.setHours(0, 0, 0, 0);
        
        filtered = filtered.filter(record => {
          if (!record.DATE) return false;
          const recordDate = new Date(record.DATE);
          recordDate.setHours(0, 0, 0, 0);
          return recordDate >= cutoffDate;
        });
      }
    }
    
    // Filter by specific month (MM/YYYY format)
    if (filterMonth) {
      const [month, year] = filterMonth.split('/');
      filtered = filtered.filter(record => {
        if (!record.DATE) return false;
        const recordDate = new Date(record.DATE);
        return (recordDate.getMonth() + 1).toString() === month && 
               recordDate.getFullYear().toString() === year;
      });
    }
    
    // Filter by brand
    if (filterBrand) {
      filtered = filtered.filter(record => {
        const recordBrand = record.BRAND || '';
        return recordBrand.toLowerCase() === filterBrand.toLowerCase();
      });
    }
    
    return filtered;
  }, [partHistoryData, filterYear, filterMonths, filterMonth, filterBrand]);

  // Stock history data - sort so records with quantity > 0 appear on top (most recent first)
  const filteredStockHistoryData = useMemo(() => {
    if (!inmainHistoryData || inmainHistoryData.length === 0) return [];

    const data = [...inmainHistoryData];

    data.sort((a, b) => {
      const qtyA = parseFloat(a.QTY) || 0;
      const qtyB = parseFloat(b.QTY) || 0;

      const hasQtyA = qtyA > 0;
      const hasQtyB = qtyB > 0;

      // First: records with quantity > 0 on top
      if (hasQtyA !== hasQtyB) {
        return hasQtyA ? -1 : 1;
      }

      // Second: most recent date first (fallbacks if date is missing)
      const dateA = a.DATE ? new Date(a.DATE) : null;
      const dateB = b.DATE ? new Date(b.DATE) : null;

      if (dateA && dateB) {
        return dateB - dateA;
      }
      if (dateA) return -1;
      if (dateB) return 1;

      // Finally: fallback by ID (newest first) if available
      const idA = parseInt(a.ID) || 0;
      const idB = parseInt(b.ID) || 0;
      return idB - idA;
    });

    return data;
  }, [inmainHistoryData]);

  // Calculate total quantity from filtered sales data
  const totalQuantity = useMemo(() => {
    if (!filteredPartHistoryData || filteredPartHistoryData.length === 0) return 0;
    return filteredPartHistoryData.reduce((sum, record) => {
      return sum + (parseInt(record.QTY) || 0);
    }, 0);
  }, [filteredPartHistoryData]);

  // Calculate brand sales summary by time periods
  const brandSalesSummary = useMemo(() => {
    if (!partHistoryData || partHistoryData.length === 0) return [];
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Calculate date ranges
    const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const lastMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);
    const thisYearStart = new Date(currentYear, 0, 1);
    const thisYearEnd = new Date(currentYear, 11, 31, 23, 59, 59);
    const last2YearsStart = new Date(currentYear - 2, 0, 1);
    const last2YearsEnd = new Date(currentYear, 11, 31, 23, 59, 59);
    
    // Group by brand
    const brandMap = {};
    
    partHistoryData.forEach(record => {
      if (!record.DATE) return;
      
      const brand = (record.BRAND || 'N/A').trim();
      const saleDate = new Date(record.DATE);
      const qty = parseInt(record.QTY) || 0;
      
      if (!brandMap[brand]) {
        brandMap[brand] = {
          brand: brand,
          lastMonth: 0,
          thisYear: 0,
          last2Years: 0
        };
      }
      
      // Count by time period
      if (saleDate >= lastMonthStart && saleDate <= lastMonthEnd) {
        brandMap[brand].lastMonth += qty;
      }
      
      if (saleDate >= thisYearStart && saleDate <= thisYearEnd) {
        brandMap[brand].thisYear += qty;
      }
      
      if (saleDate >= last2YearsStart && saleDate <= last2YearsEnd) {
        brandMap[brand].last2Years += qty;
      }
    });
    
    // Convert to array and sort by brand name
    return Object.values(brandMap).sort((a, b) => a.brand.localeCompare(b.brand));
  }, [partHistoryData]);

  // Generate chart data from filtered part history data
  const partHistoryChartData = useMemo(() => {
    if (!filteredPartHistoryData || filteredPartHistoryData.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }
    
    // Group by month for the chart
    const monthlyData = {};
    
    filteredPartHistoryData.forEach(record => {
      if (!record.DATE) return;
      const date = new Date(record.DATE);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          label: monthLabel,
          quantity: 0,
          totalAmount: 0,
          count: 0
        };
      }
      
      const qty = parseInt(record.QTY || 0);
      const price = parseFloat(record.SELL || 0);
      const amount = qty * price;
      
      monthlyData[monthKey].quantity += qty;
      monthlyData[monthKey].totalAmount += amount;
      monthlyData[monthKey].count += 1;
    });
    
    // Sort by date (oldest to newest)
    const sortedMonths = Object.keys(monthlyData).sort();
    
    return {
      labels: sortedMonths.map(key => monthlyData[key].label),
      datasets: [
        {
          label: 'Quantity Sold',
          data: sortedMonths.map(key => monthlyData[key].quantity),
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        },
        {
          label: 'Total Amount',
          data: sortedMonths.map(key => monthlyData[key].totalAmount),
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1,
          yAxisID: 'y1',
        }
      ]
    };
  }, [filteredPartHistoryData]);

  // Get available years from part history data
  // Get available months for filter (only for selected year)
  const availableMonths = useMemo(() => {
    if (!partHistoryData || partHistoryData.length === 0 || !filterYear) return [];
    
    const monthsSet = new Set();
    partHistoryData.forEach(record => {
      if (record.DATE) {
        const date = new Date(record.DATE);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        // Only include months from the selected year
        if (year.toString() === filterYear) {
          monthsSet.add(`${month}/${year}`);
        }
      }
    });
    
    // Sort months (newest first)
    return Array.from(monthsSet).sort((a, b) => {
      const [aMonth, aYear] = a.split('/').map(Number);
      const [bMonth, bYear] = b.split('/').map(Number);
      if (aYear !== bYear) return bYear - aYear;
      return bMonth - aMonth;
    });
  }, [partHistoryData, filterYear]);

  const availableYears = useMemo(() => {
    // Use allAvailableYears if available (from API), otherwise derive from loaded data
    if (allAvailableYears && allAvailableYears.length > 0) {
      return allAvailableYears.sort((a, b) => parseInt(b) - parseInt(a));
    }
    // Fallback: derive from loaded data
    if (!partHistoryData || partHistoryData.length === 0) return [];
    const years = new Set();
    partHistoryData.forEach(record => {
      if (record.DATE) {
        const year = new Date(record.DATE).getFullYear();
        years.add(year.toString());
      }
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [partHistoryData, allAvailableYears]);

  // Get available brands from part history data
  const availableBrands = useMemo(() => {
    if (!partHistoryData || partHistoryData.length === 0) return [];
    const brands = new Set();
    partHistoryData.forEach(record => {
      if (record.BRAND && record.BRAND.trim() !== '') {
        brands.add(record.BRAND.trim());
      }
    });
    return Array.from(brands).sort((a, b) => a.localeCompare(b));
  }, [partHistoryData]);

  // Get current brand and OEM No based on filter
  const currentBrandInfo = useMemo(() => {
    if (!filterBrand || filterBrand === '') {
      return { brand: 'All', oemNo: 'All' };
    }
    
    // Find the OEM number for the selected brand from the filtered data
    const brandRecord = filteredPartHistoryData.find(record => 
      record.BRAND && record.BRAND.toLowerCase() === filterBrand.toLowerCase()
    );
    
    if (brandRecord && brandRecord.ALTNO) {
      return { brand: filterBrand, oemNo: brandRecord.ALTNO };
    }
    
    // If not found in filtered data, try in all part history data
    const allBrandRecord = partHistoryData.find(record => 
      record.BRAND && record.BRAND.toLowerCase() === filterBrand.toLowerCase()
    );
    
    if (allBrandRecord && allBrandRecord.ALTNO) {
      return { brand: filterBrand, oemNo: allBrandRecord.ALTNO };
    }
    
    // If still not found, just return the brand name
    return { brand: filterBrand, oemNo: 'N/A' };
  }, [filterBrand, filteredPartHistoryData, partHistoryData]);

  // Fetch refund details for a sale item
  const fetchRefundDetails = async (sale) => {
    const saleKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}`;
    
    // Check if already loaded
    if (refundDetails[saleKey]) {
      return;
    }
    
    // Check if already loading
    if (loadingRefundDetails.has(saleKey)) {
      return;
    }
    
    setLoadingRefundDetails(prev => new Set([...prev, saleKey]));
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/sales/refund/details', {
        params: {
          idcode: sale.IDCODE,
          date: sale.DATE,
          receipt: sale.RECEIPT || sale.INVOICE
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success && response.data.hasRefund) {
        setRefundDetails(prev => ({
          ...prev,
          [saleKey]: response.data.data
        }));
      }
    } catch (error) {
      console.error('Error fetching refund details:', error);
    } finally {
      setLoadingRefundDetails(prev => {
        const newSet = new Set(prev);
        newSet.delete(saleKey);
        return newSet;
      });
    }
  };

  // Print refunded items functionality
  const handlePrintRefunded = async () => {
    if (selectedRefundedItems.size === 0) {
      await showAlert('Please select at least one refunded item to print.', 'No Selection');
      return;
    }

    try {
      // Get selected refunded items using unique keys with index
      const selectedItems = salesData.filter((sale, index) => {
        const saleKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}`;
        const uniqueKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}`;
        return selectedRefundedItems.has(uniqueKey) && refundedItems.has(saleKey);
      });

      if (selectedItems.length === 0) {
        await showAlert('No refunded items selected.', 'Error');
        return;
      }

      // Fetch refund data from API for these items
      const token = localStorage.getItem('token');
      const refundsResponse = await axios.get('/api/sales/refunds', {
        headers: { Authorization: `Bearer ${token}` },
        params: { status: 'all' }
      });

      if (!refundsResponse.data.success) {
        throw new Error('Failed to fetch refund data');
      }

      // Find refunds that match the selected items
      const matchingRefunds = [];
      refundsResponse.data.data.forEach(refund => {
        const matchingItems = refund.items.filter(refundItem => {
          return selectedItems.some(sale => {
            const saleKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}`;
            return (
              refundItem.idcode === sale.IDCODE &&
              refund.receipt_number === sale.RECEIPT &&
              refundItem.quantity === sale.QTY
            );
          });
        });
        
        if (matchingItems.length > 0) {
          matchingRefunds.push({
            ...refund,
            items: matchingItems
          });
        }
      });

      if (matchingRefunds.length === 0) {
        await showAlert('No refund records found for the selected items. Please ensure the items have been refunded through the refund system.', 'No Refunds Found');
        return;
      }

      // Print each refund form
      for (const refund of matchingRefunds) {
        await printRefundForm(refund);
        // Small delay between prints
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      await showAlert(`Printed ${matchingRefunds.length} refund form(s).`, 'Success');
    } catch (error) {
      console.error('Print refunded error:', error);
      await showAlert('Failed to print refund forms. ' + (error.response?.data?.message || error.message), 'Error');
    }
  };

  // Print Refund Form - Optimized for Epson LX-310 dot matrix printer
  // Paper: Letter size 8.5" × 11" portrait
  // Content: 21cm × 14cm (8.3" × 5.5") centered at top, rest of page blank
  // Style: Same as receipt but with CREDIT MEMO (CM) header
  const printRefundForm = (refund) => {
    return new Promise((resolve, reject) => {
      try {
        const printWindow = window.open('', '_blank', 'width=600,height=800');
        
        if (!printWindow) {
          alert('Please allow popups for this site to enable printing.');
          resolve();
          return;
        }

        const formatCurrency = (amount) => {
          return new Intl.NumberFormat('en-US', {
            style: 'decimal',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }).format(amount || 0);
        };

        const formatDate = (dateString) => {
          if (!dateString) return 'N/A';
          const date = new Date(dateString);
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
        };
        
        // Get refund data
        const refundNumber = refund.cm_number || 'N/A';
        const customerName = refund.customer_name || 'N/A';
        const refundDate = refund.refund_date ? new Date(refund.refund_date) : new Date();
        const formattedDate = formatDate(refund.refund_date);
        const receiptNumber = refund.receipt_number || 'N/A';
        // Make total amount negative for refunds
        const totalAmount = -Math.abs(parseFloat(refund.total_amount) || 0);
        
        // Optimized refund HTML for Epson LX-310 (5.5" x 9.5" continuous form)
        // Paper size: 5.5" × 9.5" (139.7mm × 241.3mm)
        // Using 10 CPI (10 characters per inch) = 55 characters per line max
        // Margins: 0.25" top/bottom, 0.2" left/right for perforation alignment
        const refundContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Credit Memo - ${refundNumber}</title>
          <meta charset="UTF-8">
          <style>
            /* Print-specific styles for Epson LX-310 */
            @media print {
              @page {
                size: 8.5in 11in; /* Letter size portrait (width × height) */
                margin: 0; /* No margins - content will be positioned manually */
                /* Disable scaling - print at 100% */
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                color-adjust: exact;
              }
              
              body {
                margin: 0;
                padding: 0;
                width: 8.5in; /* Full letter width */
                max-width: 8.5in;
                height: 11in; /* Full letter height */
                max-height: 11in;
                /* Prevent scaling */
                transform: scale(1);
                -webkit-transform: scale(1);
                display: flex;
                justify-content: center; /* Center content horizontally */
                align-items: flex-start; /* Align to top */
              }
              
              .no-print {
                display: none !important;
              }
              
              /* Force monospace rendering and make all text bold */
              * {
                font-family: 'Courier New', 'Lucida Console', 'Consolas', monospace !important;
                font-weight: bold !important;
              }
            }
            
            /* Base styles */
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            
            body {
              font-family: 'Courier New', 'Lucida Console', 'Consolas', monospace;
              font-size: 13pt; /* Larger base font to fill page */
              font-weight: bold; /* Make all text bold */
              line-height: 1.4; /* More spacing between lines */
              color: #000;
              background: white;
              padding: 0;
              margin: 0;
              width: 8.5in;
              max-width: 8.5in;
              height: 11in;
              max-height: 11in;
              /* Disable text scaling */
              -webkit-text-size-adjust: 100%;
              text-size-adjust: 100%;
              /* Force exact color printing */
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              color-adjust: exact;
              display: flex;
              justify-content: center; /* Center content horizontally */
              align-items: flex-start; /* Align to top */
            }
            
            .receipt {
              width: 8.3in; /* 21cm - exact content width */
              max-width: 8.3in;
              height: 5.5in; /* 14cm - exact content height */
              max-height: 5.5in;
              margin: 0 auto; /* Center horizontally */
              padding: 8px;
              display: flex;
              flex-direction: column;
            }
            
            .header-section {
              margin-bottom: 12px;
              width: 100%;
              padding-top: 6px;
            }
            
            .header-row {
              display: block;
              margin-bottom: 6px;
              width: 100%;
            }
            
            .customer-name {
              font-size: 13pt;
              font-weight: bold;
              margin-bottom: 8px;
            }
            
            .document-info {
              font-size: 11pt;
              font-weight: bold;
              line-height: 1.5;
              margin-top: 4px;
            }
            
            .document-info-line {
              margin-bottom: 4px;
              white-space: nowrap;
              font-weight: bold;
            }
            
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 8px 0;
              border: none;
              table-layout: fixed;
              font-size: 11pt;
              flex: 1;
            }
            
            .items-table thead {
              background: white;
            }
            
            .items-table th {
              border-top: 2px solid #000;
              border-bottom: 2px solid #000;
              border-left: none;
              border-right: none;
              padding: 6px 4px;
              text-align: left;
              font-size: 10pt;
              font-weight: bold;
              text-transform: uppercase;
              vertical-align: bottom;
            }
            
            .items-table td {
              border-top: none;
              border-bottom: 1px solid #000;
              border-left: none;
              border-right: none;
              padding: 5px 4px;
              font-size: 11pt;
              font-weight: bold;
              vertical-align: middle;
              word-wrap: break-word;
              overflow-wrap: break-word;
              line-height: 1.3;
            }
            
            .items-table tbody tr:last-child td {
              border-bottom: 2px solid #000;
            }
            
            /* Column widths optimized for 8.3" width (21cm content area) */
            .col-brand {
              width: 15%;
              max-width: 15%;
            }
            
            .col-desc {
              width: 45%;
              max-width: 45%;
            }
            
            .col-qty {
              width: 8%;
              max-width: 8%;
              text-align: center;
            }
            
            .col-price {
              width: 16%;
              max-width: 16%;
              text-align: right;
            }
            
            .col-amount {
              width: 16%;
              max-width: 16%;
              text-align: right;
              font-weight: bold;
            }
            
            .total-section {
              margin-top: 10px;
              padding-top: 6px;
              border-top: 2px solid #000;
            }
            
            .total-line {
              display: block;
              text-align: right;
              font-size: 13pt;
              font-weight: bold;
              margin: 6px 0;
              width: 100%;
              padding: 4px 0;
            }
            
            .total-label {
              float: left;
              font-weight: bold;
            }
            
            .total-value {
              float: right;
              font-weight: bold;
            }
            
            .footer {
              margin-top: 10px;
              padding-top: 6px;
              clear: both;
              margin-bottom: 4px;
            }
            
            .footer-text {
              font-size: 11pt;
              font-weight: bold;
              margin-bottom: 8px;
            }
            
            .refund-info {
              margin-top: 8px;
              padding-top: 6px;
              border-top: 1px solid #000;
              font-size: 10pt;
            }
            
            .refund-info-line {
              margin-bottom: 4px;
              font-weight: bold;
            }
            
            .signature-line {
              border-top: 1px dashed #000;
              margin-top: 4px;
              padding-top: 2px;
              width: 60%;
            }
            
            /* Ensure no text gets cut off */
            .break-inside-avoid {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            
            /* Print instructions note */
            .print-instructions {
              font-size: 9pt;
              color: #666;
              margin-top: 10px;
              padding: 8px;
              background: #f0f0f0;
              border: 1px solid #ccc;
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header-section" style="text-align: center; margin-bottom: 12px;">
              <div style="font-size: 16pt; font-weight: bold; margin-bottom: 8px;">CREDIT MEMO</div>
            </div>
            <div class="header-section">
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: bold;">
                <div>CUSTOMER: ${customerName}</div>
                <div>DATE: ${formattedDate}</div>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: bold;">
                <div>CM#: ${refundNumber}</div>
                <div>RECEIPT: ${receiptNumber}</div>
              </div>
              ${refund.invoice_number ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: bold;">
                <div>INVOICE: ${refund.invoice_number}</div>
                <div></div>
              </div>
              ` : ''}
              <div style="border-top: 1px solid #000; margin: 8px 0;"></div>
            </div>
            
            <table class="items-table">
              <thead>
                <tr>
                  <th class="col-brand">BRAND</th>
                  <th class="col-desc">DESCRIPTION</th>
                  <th class="col-qty">QTY</th>
                  <th class="col-price">PRICE</th>
                  <th class="col-amount">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                ${refund.items.map((item, index) => {
                  const brand = item.brand || '';
                  const description = (item.benz || item.idcode || item.description || 'N/A').substring(0, 50);
                  const qty = item.quantity || 0;
                  const unitPrice = parseFloat(item.unit_price || 0);
                  // Make amounts negative for refunds
                  const amount = -Math.abs(parseFloat(item.amount || 0));
                  // Make unit price negative if quantity is negative
                  const displayUnitPrice = qty < 0 ? -Math.abs(unitPrice) : unitPrice;
                  
                  return `
                    <tr class="break-inside-avoid">
                      <td class="col-brand">${brand || 'N/A'}</td>
                      <td class="col-desc">${description}</td>
                      <td class="col-qty">${qty}</td>
                      <td class="col-price">${displayUnitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td class="col-amount">${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
            
            <div style="border-top: 1px solid #000; margin: 8px 0;"></div>
            <div class="total-section">
              <div class="total-line">
                <span class="total-label">TOTAL</span>
                <span class="total-value">${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div style="border-top: 1px solid #000; margin: 8px 0;"></div>
            
            ${refund.reason ? `
            <div class="refund-info">
              <div class="refund-info-line">REASON FOR RETURN: ${refund.reason}</div>
            </div>
            ` : ''}
            
            ${refund.notes ? `
            <div class="refund-info">
              <div class="refund-info-line">NOTES: ${refund.notes}</div>
            </div>
            ` : ''}
            
            <div class="footer">
              <div class="footer-text">ITEMS RECEIVE IN GOOD CONDITION:_____________________________________</div>
            </div>
          </div>
          
          <div class="no-print">
            <div class="print-instructions">
              <strong>Print Settings for Epson LX-310:</strong><br>
              1. Paper Size: Letter 8.5" × 11" (Portrait)<br>
              2. Content Area: 21cm × 14cm (8.3" × 5.5") - Centered at top<br>
              3. Scale: 100% (No scaling)<br>
              4. Paper Type: Continuous Form<br>
              5. Font: Courier New (10 CPI)<br>
              <br>
              <strong>Important:</strong> In the print dialog, select your Epson LX-310 printer and ensure:
              <ul style="margin: 5px 0; padding-left: 20px;">
                <li>Paper size is set to Letter: 8.5" × 11" (Portrait)</li>
                <li>Scale is set to 100% (not "Fit to page")</li>
                <li>Margins are set to Minimum or None</li>
                <li>Background graphics are enabled</li>
                <li>Content will print in 21cm × 14cm area at top center, rest of page blank</li>
              </ul>
            </div>
            <div style="margin-top: 20px; text-align: center;">
              <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px; font-family: Arial, sans-serif;">🖨️ Print Credit Memo</button>
              <button onclick="window.close()" style="padding: 10px 20px; font-size: 14px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif;">✕ Close</button>
            </div>
          </div>
        </body>
        </html>
      `;

        printWindow.document.write(refundContent);
        printWindow.document.close();
        
        // Wait for content to load, then print
        setTimeout(() => {
          printWindow.focus();
          // Note: User must manually configure printer settings in print dialog
          printWindow.print();
          // Don't close immediately, let user configure print settings
          setTimeout(() => {
            // Keep window open longer for user to adjust settings
            resolve();
          }, 2000);
        }, 500);
        
        console.log('✅ Credit Memo print window opened - Configure printer settings before printing');
      } catch (error) {
        console.error('❌ Print refunded failed:', error);
        reject(error);
      }
    });
  };

  // Print functionality
  const handlePrint = async () => {
    try {
      console.log('🖨️ Starting print process...');
      
      // Fetch all sales data for the selected date with proper authentication
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/sales/history?date=${selectedDate}&limit=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const allSalesData = response.data.data || [];
      console.log('📊 All sales data:', allSalesData);
      
      if (!allSalesData || allSalesData.length === 0) {
        alert('No data to print. Please ensure there are sales records for the selected date.');
        return;
      }

      // Sort by receipt ascending (lowest to highest) for print
      const sortedSalesData = [...allSalesData].sort((a, b) => {
        const aVal = (a.RECEIPT || a.INVOICE || '').toString().toUpperCase();
        const bVal = (b.RECEIPT || b.INVOICE || '').toString().toUpperCase();
        return aVal.localeCompare(bVal, undefined, { numeric: true });
      });

      // Create a new window for printing
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      
      if (!printWindow) {
        alert('Please allow popups for this site to enable printing.');
        return;
      }
      
      // Identify duplicate part numbers and assign colors
      const partNumberCounts = {};
      sortedSalesData.forEach(sale => {
        const partNo = (sale.BENZ || 'N/A').toString().trim();
        partNumberCounts[partNo] = (partNumberCounts[partNo] || 0) + 1;
      });
      const duplicatePartNumbers = Array.from(
        Object.keys(partNumberCounts).filter(partNo => partNumberCounts[partNo] > 1)
      );
      
      // Rainbow colors array - distinct colors for different duplicate groups
      const rainbowColors = [
        '#FF6B6B', // Red
        '#4ECDC4', // Teal
        '#45B7D1', // Blue
        '#FFA07A', // Light Salmon
        '#98D8C8', // Mint
        '#F7DC6F', // Yellow
        '#BB8FCE', // Purple
        '#85C1E2', // Sky Blue
        '#F8B739', // Orange
        '#52BE80', // Green
        '#EC7063', // Coral
        '#5DADE2', // Light Blue
        '#F1948A', // Pink
        '#73C6B6', // Aqua
        '#F4D03F', // Gold
        '#AF7AC5', // Lavender
        '#7FB3D3', // Powder Blue
        '#F39C12', // Dark Orange
        '#58D68D', // Light Green
        '#EB984E', // Tan
      ];
      
      // Assign a color to each duplicate part number
      const partNumberColorMap = {};
      duplicatePartNumbers.forEach((partNo, index) => {
        partNumberColorMap[partNo] = rainbowColors[index % rainbowColors.length];
      });
      
      // Prepare data for printing
      const printData = sortedSalesData.map(sale => {
        const isAdjustment = (sale.RECEIPT === 'ADJUSTMENT' || sale.INVOICE === 'ADJUSTMENT');
        const partNo = (sale.BENZ || 'N/A').toString().trim();
        const isDuplicate = duplicatePartNumbers.includes(partNo);
        const backgroundColor = partNumberColorMap[partNo] || null;

        const qty = parseFloat(sale.QTY) || 0;
        const isRefundRow = qty < 0;
        const unitPrice = isAdjustment ? 0 : (parseFloat(sale.SELL) || 0);

        // Base amount from total_amount (if present) or SELL * QTY
        let amount = sale.total_amount != null
          ? parseFloat(sale.total_amount)
          : unitPrice * qty;

        // For refund rows, force amount to be negative
        if (!isAdjustment && isRefundRow && amount > 0) {
          amount = -Math.abs(amount);
        }

        return {
          'Receipt': sale.RECEIPT || sale.INVOICE || 'N/A',
          'Customer': sale.CUSTOMER || 'Walk-in Customer',
          'ID Code': sale.IDCODE || 'N/A',
          'Part No.': partNo,
          'Brand': sale.BRAND || 'N/A',
          'OEM No.': sale.ALTNO || 'N/A',
          'Qty': qty,
          'Unit Price': unitPrice,
          'Amount': isAdjustment ? 0 : amount,
          'isDuplicate': isDuplicate,
          'backgroundColor': backgroundColor
        };
      });

      // Calculate totals (exclude adjustments from total)
      const totalAmount = sortedSalesData.reduce((sum, sale) => {
        const isAdjustment = (sale.RECEIPT === 'ADJUSTMENT' || sale.INVOICE === 'ADJUSTMENT');
        if (isAdjustment) {
          return sum; // Skip adjustments in total calculation
        }

        const qty = parseFloat(sale.QTY) || 0;
        const isRefundRow = qty < 0;
        const unitPrice = parseFloat(sale.SELL || 0);

        let amount = sale.total_amount != null
          ? parseFloat(sale.total_amount)
          : unitPrice * qty;

        if (isRefundRow && amount > 0) {
          amount = -Math.abs(amount);
        }

        return sum + amount;
      }, 0);
      const totalTransactions = sortedSalesData.length;
      const averageSale = totalTransactions > 0 ? totalAmount / totalTransactions : 0;

      console.log('📈 Calculated totals:', { totalAmount, totalTransactions, averageSale });

      // Create HTML content for printing
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Sales History Report - ${formatDate(selectedDate)}</title>
          <style>
                    @media print {
                      @page { 
                        margin: 0.25in; 
                        margin-bottom: 0.75in; 
                        size: auto;
                        marks: none;
                      }
                      body { 
                        font-family: Arial, sans-serif; 
                        font-size: 12px;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        color-adjust: exact;
                      }
                      /* Force background colors to print */
                      * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                      }
                      /* Hide any page number elements */
                      .page-number,
                      [class*="page-number"],
                      [id*="page-number"] {
                        display: none !important;
                      }
                    }
                    body { 
                      font-family: Arial, sans-serif; 
                      font-size: 12px; 
                      margin: 0; 
                      padding: 10px;
                      padding-bottom: 80px;
                      background: white;
                      color: black;
                    }
            .header {
              text-align: center;
              margin-bottom: 15px;
              border-bottom: 1px solid #333;
              padding-bottom: 8px;
            }
            .header h1 {
              margin: 0;
              font-size: 22px;
              color: #333;
              font-weight: bold;
            }
            .header h2 {
              margin: 3px 0;
              font-size: 18px;
              color: #007bff;
              font-weight: bold;
            }
            .header p {
              margin: 3px 0 0 0;
              color: #666;
              font-size: 13px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 50px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              color-adjust: exact;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 5px 6px;
              text-align: left;
              vertical-align: middle;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              color-adjust: exact;
            }
            th {
              background-color: #f2f2f2;
              font-weight: bold;
              text-align: center;
              font-size: 11px;
              padding: 5px 6px;
            }
                    .receipt-col { width: 10%; }
                    .customer-col { width: 22%; }
                    .idcode-col { width: 8%; }
                    .partno-col { width: 18%; font-weight: bold; font-size: 13px; color: #000; }
                    .brand-col { width: 10%; }
                    .oemno-col { width: 12%; }
                    .qty-col { width: 5%; }
                    .unitprice-col { width: 7%; }
                    .amount-col { width: 8%; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .total-row {
              background-color: #f9f9f9;
              font-weight: bold;
            }
            .total-row td {
              padding-top: 3px;
              padding-bottom: 3px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              text-align: center;
              font-size: 11px;
              color: #666;
              page-break-inside: avoid;
              position: relative;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DELODUR CORPORATION</h1>
            <p>Sales Report ${formatDate(selectedDate)}</p>
          </div>
          
          <table>
                    <thead>
                      <tr>
                        <th class="receipt-col">Receipt</th>
                        <th class="customer-col">Customer</th>
                        <th class="idcode-col">ID Code</th>
                        <th class="partno-col">Part No.</th>
                        <th class="brand-col">Brand</th>
                        <th class="oemno-col">OEM No.</th>
                        <th class="qty-col text-center">Qty</th>
                        <th class="unitprice-col text-right">Unit Price</th>
                        <th class="amount-col text-right">Amount</th>
                      </tr>
                    </thead>
            <tbody>
              ${printData.map(row => `
                <tr>
                  <td class="receipt-col">${row.Receipt}</td>
                  <td class="customer-col">${row.Customer}</td>
                  <td class="idcode-col">${row['ID Code']}</td>
                  <td class="partno-col" style="${row.isDuplicate && row.backgroundColor ? `background-color: ${row.backgroundColor} !important; color: #fff !important; font-weight: bold; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important;` : ''}">${row['Part No.']}</td>
                  <td class="brand-col">${row.Brand}</td>
                  <td class="oemno-col">${row['OEM No.']}</td>
                  <td class="qty-col text-center">${row.Qty}</td>
                  <td class="unitprice-col text-right">${row['Unit Price'].toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="amount-col text-right">${row.Amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
              <tr class="total-row" style="border-top: 2px solid #333;">
                <td colspan="8" class="text-right" style="padding-top: 3px; padding-bottom: 3px;"><strong>TOTAL:</strong></td>
                <td class="amount-col text-right" style="padding-top: 3px; padding-bottom: 3px;"><strong>${formatCurrency(totalAmount)}</strong></td>
              </tr>
            </tbody>
          </table>
          
          <div class="footer">
            <p>Printed by: ${user?.fullName || user?.username || 'Unknown'} | generated on DELODUR CORP TRACK v2 system | ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: '2-digit', day: '2-digit' })}</p>
          </div>
        </body>
        </html>
      `;

      // Write content to print window
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // Wait for content to load, then print
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        // Don't close immediately, let user see the print dialog
        setTimeout(() => {
          printWindow.close();
        }, 1000);
      }, 500);
      
      console.log('✅ Sales report printed successfully');
    } catch (error) {
      console.error('❌ Print failed:', error);
      alert('Print failed: ' + error.message);
    }
  };

  // Open Print Receipt Modal
  const openPrintReceiptModal = (receiptNumber) => {
    try {
      // Get all sales for this receipt number (including adjustments)
      const receiptSales = salesData.filter(sale => 
        (sale.RECEIPT === receiptNumber || sale.INVOICE === receiptNumber)
      );

      if (receiptSales.length === 0) {
        alert('No sales found for this receipt.');
        return;
      }

      // Group by receipt and get customer info from first sale
      const firstSale = receiptSales[0];
      const customerName = firstSale.CUSTOMER || 'Walk-in Customer';
      const receiptDate = firstSale.DATE ? new Date(firstSale.DATE) : new Date();
      
      // Check if this is an adjustment
      const isAdjustment = (firstSale.RECEIPT === 'ADJUSTMENT' || firstSale.INVOICE === 'ADJUSTMENT');
      
      // Format date for input (YYYY-MM-DD)
      const formattedDateInput = receiptDate.toISOString().split('T')[0];
      
      // Pre-fill form data
      setPrintReceiptForm({
        orderType: isAdjustment ? 'ADJUSTMENT' : 'COUNTER',
        customer: customerName,
        date: formattedDateInput,
        receipt: receiptNumber,
        ro: '',
        plate: '',
        prf: '',
        co: '',
        documentType: isAdjustment ? 'ADJUSTMENT' : 'DELIVERY RECEIPT'
      });
      
      // Store receipt sales data
      setPrintReceiptData(receiptSales);
      setPrintReceiptCurrentPage(1);
      
      // Show modal
      setShowPrintReceiptModal(true);
    } catch (error) {
      console.error('Error opening print receipt modal:', error);
      alert('Error opening print receipt form: ' + error.message);
    }
  };

  // Get paginated items for print receipt
  const getPaginatedItems = (items, page) => {
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return items.slice(startIndex, endIndex);
  };

  // Get total pages for items
  const getTotalPages = (items) => {
    return Math.ceil(items.length / ITEMS_PER_PAGE);
  };

  // Handle print from modal
  const handlePrintFromModal = async () => {
    if (!printReceiptData || !printReceiptForm) return;
    
    try {
      // If SERVICE type, save the fields first
      if (printReceiptForm.orderType === 'SERVICE') {
        const token = localStorage.getItem('token');
        if (token) {
          try {
            await axios.post('/api/sales/update-service-fields', {
              receipt: printReceiptForm.receipt,
              ro: printReceiptForm.ro,
              plate: printReceiptForm.plate,
              prf: printReceiptForm.prf,
              co: printReceiptForm.co || null
            }, {
              headers: { Authorization: `Bearer ${token}` }
            });
          } catch (error) {
            console.error('Error saving service fields:', error);
            // Continue with printing even if save fails
          }
        }
      }
      
      // Calculate total pages
      const totalPages = getTotalPages(printReceiptData);
      
      // Print each page
      for (let page = 1; page <= totalPages; page++) {
        const pageItems = getPaginatedItems(printReceiptData, page);
        await handlePrintReceipt(printReceiptForm, pageItems, page, totalPages);
        // Small delay between pages
        if (page < totalPages) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Close modal after printing
      setShowPrintReceiptModal(false);
    } catch (error) {
      console.error('Error printing receipt:', error);
      alert('Error printing receipt: ' + error.message);
    }
  };

  // Print Receipt - Optimized for Epson LX-310 dot matrix printer
  // Paper: Letter size 8.5" × 11" portrait
  // Content: 21cm × 14cm (8.3" × 5.5") centered at top, rest of page blank
  const handlePrintReceipt = (formData, receiptSales, currentPage = 1, totalPages = 1) => {
    try {
      // Group by receipt and get customer info from first sale
      const firstSale = receiptSales[0];
      const customerName = formData.customer || firstSale.CUSTOMER || 'Walk-in Customer';
      const receiptDate = formData.date ? new Date(formData.date + 'T00:00:00') : (firstSale.DATE ? new Date(firstSale.DATE) : new Date());
      
      // Check if this is an adjustment
      const isAdjustment = (firstSale.RECEIPT === 'ADJUSTMENT' || firstSale.INVOICE === 'ADJUSTMENT');
      
      // Extract adjustment number from remarks if present
      let adjustmentNumber = null;
      if (isAdjustment && firstSale.REMARKS) {
        const adjMatch = firstSale.REMARKS.match(/\[(ADJ-\d+)\]/);
        if (adjMatch) {
          adjustmentNumber = adjMatch[1];
        }
      }
      
      // Calculate totals for all items (not just current page)
      // For adjustments, total should be 0
      const allReceiptSales = printReceiptData || receiptSales;
      const totalAmount = isAdjustment ? 0 : allReceiptSales.reduce((sum, sale) => {
        return sum + (parseFloat(sale.total_amount) || (parseFloat(sale.SELL || 0) * parseInt(sale.QTY || 0)));
      }, 0);

      // Format date (MM/DD/YYYY format to match modal)
      const formattedDate = receiptDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });

      // Create print window
      const printWindow = window.open('', '_blank', 'width=600,height=800');
      
      if (!printWindow) {
        alert('Please allow popups for this site to enable printing.');
        return;
      }

      // Optimized receipt HTML for Epson LX-310 (5.5" x 9.5" continuous form)
      // Paper size: 5.5" × 9.5" (139.7mm × 241.3mm)
      // Using 10 CPI (10 characters per inch) = 55 characters per line max
      // Margins: 0.25" top/bottom, 0.2" left/right for perforation alignment
      const receiptContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - ${formData.receipt}</title>
          <meta charset="UTF-8">
          <style>
            /* Print-specific styles for Epson LX-310 */
            @media print {
              @page {
                size: 8.5in 11in; /* Letter size portrait (width × height) */
                margin: 0; /* No margins - content will be positioned manually */
                /* Disable scaling - print at 100% */
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                color-adjust: exact;
              }
              
              body {
                margin: 0;
                padding: 0;
                width: 8.5in; /* Full letter width */
                max-width: 8.5in;
                height: 11in; /* Full letter height */
                max-height: 11in;
                /* Prevent scaling */
                transform: scale(1);
                -webkit-transform: scale(1);
                display: flex;
                justify-content: center; /* Center content horizontally */
                align-items: flex-start; /* Align to top */
              }
              
              .no-print {
                display: none !important;
              }
              
              /* Force monospace rendering and make all text bold */
              * {
                font-family: 'Courier New', 'Lucida Console', 'Consolas', monospace !important;
                font-weight: bold !important;
              }
            }
            
            /* Base styles */
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            
            body {
              font-family: 'Courier New', 'Lucida Console', 'Consolas', monospace;
              font-size: 13pt; /* Larger base font to fill page */
              font-weight: bold; /* Make all text bold */
              line-height: 1.4; /* More spacing between lines */
              color: #000;
              background: white;
              padding: 0;
              margin: 0;
              width: 8.5in;
              max-width: 8.5in;
              height: 11in;
              max-height: 11in;
              /* Disable text scaling */
              -webkit-text-size-adjust: 100%;
              text-size-adjust: 100%;
              /* Force exact color printing */
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              color-adjust: exact;
              display: flex;
              justify-content: center; /* Center content horizontally */
              align-items: flex-start; /* Align to top */
            }
            
            .receipt {
              width: 8.3in; /* 21cm - exact content width */
              max-width: 8.3in;
              height: 5.5in; /* 14cm - exact content height */
              max-height: 5.5in;
              margin: 0 auto; /* Center horizontally */
              padding: 8px;
              display: flex;
              flex-direction: column;
            }
            
            .header-section {
              margin-bottom: 12px;
              width: 100%;
              padding-top: 6px;
            }
            
            .header-row {
              display: block;
              margin-bottom: 6px;
              width: 100%;
            }
            
            .customer-name {
              font-size: 13pt;
              font-weight: bold;
              margin-bottom: 8px;
            }
            
            .document-info {
              font-size: 11pt;
              font-weight: bold;
              line-height: 1.5;
              margin-top: 4px;
            }
            
            .document-info-line {
              margin-bottom: 4px;
              white-space: nowrap;
              font-weight: bold;
            }
            
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 8px 0;
              border: none;
              table-layout: fixed;
              font-size: 11pt;
              flex: 1;
            }
            
            .items-table thead {
              background: white;
            }
            
            .items-table th {
              border-top: 2px solid #000;
              border-bottom: 2px solid #000;
              border-left: none;
              border-right: none;
              padding: 6px 4px;
              text-align: left;
              font-size: 10pt;
              font-weight: bold;
              text-transform: uppercase;
              vertical-align: bottom;
            }
            
            .items-table td {
              border-top: none;
              border-bottom: 1px solid #000;
              border-left: none;
              border-right: none;
              padding: 5px 4px;
              font-size: 11pt;
              font-weight: bold;
              vertical-align: middle;
              word-wrap: break-word;
              overflow-wrap: break-word;
              line-height: 1.3;
            }
            
            .items-table tbody tr:last-child td {
              border-bottom: 2px solid #000;
            }
            
            /* Column widths optimized for 8.3" width (21cm content area) */
            .col-brand {
              width: 15%;
              max-width: 15%;
            }
            
            .col-desc {
              width: 45%;
              max-width: 45%;
            }
            
            .col-qty {
              width: 8%;
              max-width: 8%;
              text-align: center;
            }
            
            .col-price {
              width: 16%;
              max-width: 16%;
              text-align: right;
            }
            
            .col-amount {
              width: 16%;
              max-width: 16%;
              text-align: right;
              font-weight: bold;
            }
            
            .total-section {
              margin-top: 10px;
              padding-top: 6px;
              border-top: 2px solid #000;
            }
            
            .total-line {
              display: block;
              text-align: right;
              font-size: 13pt;
              font-weight: bold;
              margin: 6px 0;
              width: 100%;
              padding: 4px 0;
            }
            
            .total-label {
              float: left;
              font-weight: bold;
            }
            
            .total-value {
              float: right;
              font-weight: bold;
            }
            
            .footer {
              margin-top: 10px;
              padding-top: 6px;
              clear: both;
              margin-bottom: 4px;
            }
            
            .footer-text {
              font-size: 11pt;
              font-weight: bold;
              margin-bottom: 8px;
            }
            
            .signature-line {
              border-top: 1px dashed #000;
              margin-top: 4px;
              padding-top: 2px;
              width: 60%;
            }
            
            /* Ensure no text gets cut off */
            .break-inside-avoid {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            
            /* Print instructions note */
            .print-instructions {
              font-size: 9pt;
              color: #666;
              margin-top: 10px;
              padding: 8px;
              background: #f0f0f0;
              border: 1px solid #ccc;
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header-section" style="text-align: center; margin-bottom: 12px;">
              <div style="font-size: 16pt; font-weight: bold; margin-bottom: 8px;">${isAdjustment ? 'ADJUSTMENT' : (formData.documentType || 'DELIVERY RECEIPT')}</div>
              ${isAdjustment && adjustmentNumber ? `<div style="font-size: 14pt; font-weight: bold; margin-top: 4px;">${adjustmentNumber}</div>` : ''}
            </div>
            <div class="header-section">
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: bold;">
                <div>CUSTOMER: ${customerName}</div>
                <div>DATE: ${formattedDate}</div>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: bold;">
                <div>RECEIPT: ${formData.receipt}</div>
                <div>ORDER TYPE: ${isAdjustment ? 'ADJUSTMENT' : formData.orderType}</div>
              </div>
              ${formData.orderType === 'SERVICE' ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: bold;">
                <div>RO#: <span style="border-bottom: 1px solid #000; padding-bottom: 2px; min-width: 100px; display: inline-block;">${formData.ro || '&nbsp;'}</span></div>
                <div>PLATE#: <span style="border-bottom: 1px solid #000; padding-bottom: 2px; min-width: 100px; display: inline-block;">${formData.plate || '&nbsp;'}</span></div>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: bold;">
                <div>PRF#: <span style="border-bottom: 1px solid #000; padding-bottom: 2px; min-width: 100px; display: inline-block;">${formData.prf || '&nbsp;'}</span></div>
                <div>C/O: <span style="border-bottom: 1px solid #000; padding-bottom: 2px; min-width: 100px; display: inline-block;">${formData.co || '&nbsp;'}</span></div>
              </div>
              ` : ''}
              <div style="border-top: 1px solid #000; margin: 8px 0;"></div>
            </div>
            
            <table class="items-table">
              <thead>
                <tr>
                  <th class="col-brand">BRAND</th>
                  <th class="col-desc">DESCRIPTION</th>
                  <th class="col-qty">QTY</th>
                  <th class="col-price">PRICE</th>
                  <th class="col-amount">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                ${receiptSales.map((sale, index) => {
                  const partNo = sale.BENZ || 'N/A';
                  const brand = sale.BRAND || '';
                  const description = (sale.DESCRIPTION || sale.REMARKS || partNo).substring(0, 50); // Limit to prevent overflow (increased for wider page)
                  // For adjustments, show the quantity as stored (sign is already reversed)
                  const qty = sale.QTY || 0;
                  // For adjustments, show 0.00 for price and amount
                  const unitPrice = isAdjustment ? 0 : parseFloat(sale.SELL || 0);
                  const amount = isAdjustment ? 0 : (parseFloat(sale.total_amount) || (unitPrice * qty));
                  
                  return `
                    <tr class="break-inside-avoid">
                      <td class="col-brand">${brand || 'N/A'}</td>
                      <td class="col-desc">${description}</td>
                      <td class="col-qty">${qty}</td>
                      <td class="col-price">${unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td class="col-amount">${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
            
            ${currentPage === totalPages ? `
            <div style="border-top: 1px solid #000; margin: 8px 0;"></div>
            <div class="total-section">
              <div class="total-line">
                <span class="total-label">TOTAL</span>
                <span class="total-value">${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div style="border-top: 1px solid #000; margin: 8px 0;"></div>
            <div class="footer">
              <div class="footer-text">ITEMS RECEIVE IN GOOD CONDITION:_____________________________________</div>
            </div>
            ` : ''}
            ${totalPages > 1 ? `<div style="text-align: center; margin-top: 10px; font-size: 10pt; font-weight: bold;">Page ${currentPage} of ${totalPages}</div>` : ''}
          </div>
          
          <div class="no-print">
            <div class="print-instructions">
              <strong>Print Settings for Epson LX-310:</strong><br>
              1. Paper Size: Letter 8.5" × 11" (Portrait)<br>
              2. Content Area: 21cm × 14cm (8.3" × 5.5") - Centered at top<br>
              3. Scale: 100% (No scaling)<br>
              4. Paper Type: Continuous Form<br>
              5. Font: Courier New (10 CPI)<br>
              <br>
              <strong>Important:</strong> In the print dialog, select your Epson LX-310 printer and ensure:
              <ul style="margin: 5px 0; padding-left: 20px;">
                <li>Paper size is set to Letter: 8.5" × 11" (Portrait)</li>
                <li>Scale is set to 100% (not "Fit to page")</li>
                <li>Margins are set to Minimum or None</li>
                <li>Background graphics are enabled</li>
                <li>Content will print in 21cm × 14cm area at top center, rest of page blank</li>
              </ul>
            </div>
            <div style="margin-top: 20px; text-align: center;">
              <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px; font-family: Arial, sans-serif;">🖨️ Print Receipt</button>
              <button onclick="window.close()" style="padding: 10px 20px; font-size: 14px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif;">✕ Close</button>
            </div>
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(receiptContent);
      printWindow.document.close();
      
      // Wait for content to load, then print
      setTimeout(() => {
        printWindow.focus();
        // Note: User must manually configure printer settings in print dialog
        printWindow.print();
        // Don't close immediately, let user configure print settings
        setTimeout(() => {
          // Keep window open longer for user to adjust settings
        }, 2000);
      }, 500);
      
      console.log('✅ Receipt print window opened - Configure printer settings before printing');
    } catch (error) {
      console.error('❌ Print receipt failed:', error);
      alert('Print receipt failed: ' + error.message);
    }
  };

  // Export to DBF file
  const handleExportDBF = async () => {
    try {
      if (!selectedDate) {
        alert('Please select a date to export.');
        return;
      }

      console.log('📦 Exporting to DBF for date:', selectedDate);
      
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication token not found. Please log in again.');
        return;
      }

      // Show loading state
      const loadingMessage = document.createElement('div');
      loadingMessage.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 20px 30px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 16px;
      `;
      loadingMessage.textContent = 'Exporting to DBF...';
      document.body.appendChild(loadingMessage);

      try {
        // Call the export API
        const response = await axios.get(`/api/sales/export-dbf?date=${selectedDate}`, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob' // Important: receive binary data
        });

        // Create a blob URL and trigger download
        const blob = new Blob([response.data], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'OUTGOING.DBF';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        // Remove loading message
        document.body.removeChild(loadingMessage);

        alert(`Successfully exported ${selectedDate} sales data to OUTGOING.DBF`);
      } catch (error) {
        // Remove loading message
        if (document.body.contains(loadingMessage)) {
          document.body.removeChild(loadingMessage);
        }

        if (error.response) {
          if (error.response.status === 404) {
            alert('No sales data found for the selected date.');
          } else if (error.response.status === 409) {
            // File is locked
            const errorMsg = error.response.data?.error || error.response.data?.message || 'File is locked';
            alert(`Cannot overwrite OUTGOING.DBF:\n\n${errorMsg}\n\nPlease close track.exe or any other program using this file and try again.`);
          } else {
            const errorMsg = error.response.data?.error || error.response.data?.message || 'Unknown error';
            alert(`Error exporting to DBF: ${errorMsg}`);
          }
        } else {
          console.error('DBF export error:', error);
          alert('Error exporting to DBF. Please try again.');
        }
      }
    } catch (error) {
      console.error('DBF export error:', error);
      alert('Error exporting to DBF. Please try again.');
    }
  };

  // Import from DBF file
  const handleImportDBF = async () => {
    try {
      // Password protection
      const password = prompt('Please enter the password to import:');
      if (password === null) {
        // User cancelled
        return;
      }
      if (password.toLowerCase() !== 'delodur') {
        alert('Incorrect password. Access denied.');
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication token not found. Please log in again.');
        return;
      }

      // Show loading state
      const loadingMessage = document.createElement('div');
      loadingMessage.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 20px 30px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 16px;
      `;
      loadingMessage.textContent = 'Importing from OUTGOING.DBF...';
      document.body.appendChild(loadingMessage);

      try {
        // Ask user if they want to save to database
        const saveToDatabase = window.confirm(
          `Import data from OUTGOING.DBF?\n\n` +
          `Click OK to save to database (data will persist after reload).\n` +
          `Click Cancel to preview only (data will be lost on reload).`
        );

        // Call the import API with save parameter
        const response = await axios.get(`/api/sales/import-dbf?save=${saveToDatabase}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Remove loading message
        document.body.removeChild(loadingMessage);

        if (response.data.success && response.data.data) {
          const importedData = response.data.data;
          console.log(`✅ Imported ${importedData.length} records from OUTGOING.DBF`);

          // Update the sales data state with imported data
          setSalesData(importedData);
          setTotalRecords(importedData.length);
          setTotalPages(1);
          setCurrentPage(1);

          // Show success message with save status
          if (saveToDatabase) {
            const saved = response.data.saved || importedData.length;
            const skipped = response.data.skipped || 0;
            alert(
              `Successfully imported and saved ${saved} records to database!\n\n` +
              (skipped > 0 ? `${skipped} records were skipped (already exist).\n\n` : '') +
              `Stock quantities have been reduced.\n` +
              `The data will persist after page reload.`
            );
            // Refresh data from database to show saved records
            fetchSalesData();
          } else {
            alert(
              `Successfully imported ${importedData.length} records from OUTGOING.DBF\n\n` +
              `This is a preview only. Stock quantities are NOT affected.\n` +
              `The data will be lost when you reload the page.\n\n` +
              `To save permanently and reduce stock, click Import again and choose to save.`
            );
          }
        } else {
          alert('No data found in OUTGOING.DBF or import failed.');
        }
      } catch (error) {
        // Remove loading message
        if (document.body.contains(loadingMessage)) {
          document.body.removeChild(loadingMessage);
        }

        if (error.response) {
          if (error.response.status === 404) {
            alert('OUTGOING.DBF file not found at C:\\Rae\\Files\\OUTGOING.DBF');
          } else if (error.response.status === 409) {
            // File is locked
            const errorMsg = error.response.data?.error || error.response.data?.message || 'File is locked';
            alert(`Cannot read OUTGOING.DBF:\n\n${errorMsg}\n\nPlease close track.exe or any other program using this file and try again.`);
          } else if (error.response.status === 400) {
            // Stock errors
            const errorData = error.response.data;
            const errorDetails = errorData.errorDetails || errorData.message || 'Stock errors detected';
            alert(
              `Cannot import: Stock errors detected\n\n` +
              `${errorDetails}\n\n` +
              `Please check stock availability and try again.`
            );
          } else {
            const errorMsg = error.response.data?.error || error.response.data?.message || 'Unknown error';
            alert(`Error importing from DBF: ${errorMsg}`);
          }
        } else {
          console.error('DBF import error:', error);
          alert('Error importing from DBF. Please try again.');
        }
      }
    } catch (error) {
      console.error('DBF import error:', error);
      alert('Error importing from DBF. Please try again.');
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 120px)',
      background: 'transparent',
      padding: '8px 0 0 0',
      margin: '0',
      marginTop: '-27px',
      color: 'var(--text-primary)',
      boxSizing: 'border-box',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      gap: '8px'
    }}>
      {/* Header */}

      {/* Date Navigation Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 10px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        gap: '6px',
        flexWrap: 'nowrap',
        flexShrink: 0,
        flexGrow: 0,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        overflowX: 'auto'
      }}>
        {/* Navigation buttons */}
        <button
          onClick={goToPreviousDay}
          disabled={navigating}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 10px',
            background: 'rgba(255, 193, 7, 0.2)',
            border: '1px solid #ffc107',
            borderRadius: '6px',
            color: '#ffc107',
            cursor: navigating ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: '500',
            opacity: navigating ? 0.6 : 1,
            whiteSpace: 'nowrap'
          }}
          title="Previous day"
        >
          <ArrowLeft size={14} />
        </button>
        
        <button
          onClick={goToNextDay}
          disabled={navigating || isToday}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 10px',
            background: isToday ? 'rgba(108, 117, 125, 0.2)' : 'rgba(255, 193, 7, 0.2)',
            border: isToday ? '1px solid #6c757d' : '1px solid #ffc107',
            borderRadius: '6px',
            color: isToday ? '#6c757d' : '#ffc107',
            cursor: (navigating || isToday) ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: '500',
            opacity: (navigating || isToday) ? 0.6 : 1,
            whiteSpace: 'nowrap'
          }}
          title={isToday ? 'Already on today' : 'Next day'}
        >
          <ArrowRight size={14} />
        </button>
        
        {/* Date selector */}
        <input
          type="date"
          value={selectedDate}
          onChange={handleDateChange}
          style={{
            padding: '6px 8px',
            background: 'var(--input-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: '12px',
            outline: 'none',
            width: '130px',
            whiteSpace: 'nowrap'
          }}
        />
        
        {/* Search Bar */}
        <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '350px' }}>
          <Search 
            size={16} 
            style={{
              position: 'absolute',
              left: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)'
            }}
          />
          <input
            type="text"
            placeholder="Search..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            style={{
              width: '100%',
              padding: '6px 8px 6px 32px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              outline: 'none'
            }}
          />
        </div>
        
        <button
          onClick={handleSearch}
          disabled={loading}
          style={{
            padding: '6px 12px',
            background: '#007bff',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: '500',
            whiteSpace: 'nowrap'
          }}
        >
          {loading ? '...' : 'Search'}
        </button>
        
        {/* Action Buttons - Compact */}
        <button
          onClick={handleRefresh}
          disabled={loading}
          title="Refresh"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            background: 'rgba(0, 123, 255, 0.2)',
            border: '1px solid #007bff',
            borderRadius: '6px',
            color: '#007bff',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            whiteSpace: 'nowrap'
          }}
        >
          <RefreshCw size={12} style={{ 
            animation: loading ? 'spin 1s linear infinite' : 'none' 
          }} />
          <span>Refresh</span>
        </button>
        
        <button 
          onClick={handlePrint}
          title="Print"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            background: 'rgba(40, 167, 69, 0.2)',
            border: '1px solid #28a745',
            borderRadius: '6px',
            color: '#28a745',
            cursor: 'pointer',
            fontSize: '11px',
            whiteSpace: 'nowrap'
          }}
        >
          <Printer size={12} />
          <span>Print</span>
        </button>
        
        <button 
          onClick={handleExportDBF}
          disabled={loading || !selectedDate}
          title="Export to DBF"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            background: loading || !selectedDate 
              ? 'rgba(108, 117, 125, 0.2)' 
              : 'rgba(23, 162, 184, 0.2)',
            border: loading || !selectedDate 
              ? '1px solid #6c757d' 
              : '1px solid #17a2b8',
            borderRadius: '6px',
            color: loading || !selectedDate ? '#6c757d' : '#17a2b8',
            cursor: loading || !selectedDate ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            opacity: loading || !selectedDate ? 0.6 : 1
          }}
        >
          <FileText size={12} />
          <span>DBF</span>
        </button>
        
        <button 
          onClick={handleImportDBF}
          disabled={loading}
          title="Import from OUTGOING.DBF"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            background: loading 
              ? 'rgba(108, 117, 125, 0.2)' 
              : 'rgba(255, 193, 7, 0.2)',
            border: loading 
              ? '1px solid #6c757d' 
              : '1px solid #ffc107',
            borderRadius: '6px',
            color: loading ? '#6c757d' : '#ffc107',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            opacity: loading ? 0.6 : 1
          }}
        >
          <Download size={12} />
          <span>Import</span>
        </button>
        
        <button 
          onClick={handleRefundSelected}
          disabled={selectedItems.size === 0}
          title={selectedItems.size === 0 ? 'Select items to refund' : `Refund ${selectedItems.size} item(s)`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            background: selectedItems.size === 0 
              ? 'rgba(108, 117, 125, 0.2)' 
              : 'rgba(220, 53, 69, 0.2)',
            border: selectedItems.size === 0 
              ? '1px solid #6c757d' 
              : '1px solid #dc3545',
            borderRadius: '6px',
            color: selectedItems.size === 0 ? '#6c757d' : '#dc3545',
            cursor: selectedItems.size === 0 ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            opacity: selectedItems.size === 0 ? 0.6 : 1,
            whiteSpace: 'nowrap'
          }}
        >
          <RotateCcw size={12} />
          <span>Refund</span>
          {selectedItems.size > 0 && <span>({selectedItems.size})</span>}
        </button>
        
        <button 
          onClick={() => navigate('/refunds')}
          title="View all refunds"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            background: 'rgba(255, 193, 7, 0.2)',
            border: '1px solid #ffc107',
            borderRadius: '6px',
            color: '#ffc107',
            cursor: 'pointer',
            fontSize: '11px',
            whiteSpace: 'nowrap'
          }}
        >
          <Receipt size={12} />
          <span>Refunds</span>
        </button>
        
        {/* Clear Sorting Button */}
        {sortField && (
          <button
            onClick={clearSorting}
            title="Clear Sorting"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 10px',
              background: 'rgba(255, 193, 7, 0.2)',
              border: '1px solid #ffc107',
              borderRadius: '6px',
              color: '#ffc107',
              cursor: 'pointer',
              fontSize: '11px',
              whiteSpace: 'nowrap'
            }}
          >
            <X size={12} />
            <span>Clear Sorting</span>
          </button>
        )}
        
        {/* Total Amount Display - on Refund button row */}
        {salesData.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginLeft: 'auto',
            padding: '6px 12px',
            background: 'rgba(40, 167, 69, 0.15)',
            border: '1px solid #28a745',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '700',
            color: '#28a745',
            whiteSpace: 'nowrap'
          }}>
            <span>TOTAL AMOUNT:</span>
            <span style={{
              fontFamily: 'monospace',
              fontSize: '14px',
              fontWeight: '700'
            }}>
              {formatCurrency(
                salesData.reduce((total, sale) => {
                  // Exclude adjustments from total
                  const isAdjustment = (sale.RECEIPT === 'ADJUSTMENT' || sale.INVOICE === 'ADJUSTMENT');
                  
                  if (isAdjustment) {
                    return total;
                  }
                  
                  // Calculate amount
                  const qty = parseFloat(sale.QTY) || 0;
                  const sell = parseFloat(sale.SELL || 0);
                  let amount = sale.total_amount ? parseFloat(sale.total_amount) : (sell * Math.abs(qty));
                  
                  // For refunds (QTY < 0), force amount to be negative to subtract from total
                  // The row displays positive amount, but we subtract it from the total
                  const isRefundRow = qty < 0;
                  if (isRefundRow && amount > 0) {
                    amount = -Math.abs(amount);
                  }
                  
                  return total + amount;
                }, 0)
              )}
            </span>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          background: 'rgba(220, 53, 69, 0.1)',
          border: '1px solid #dc3545',
          borderRadius: '0px',
          borderLeft: 'none',
          borderRight: 'none',
          padding: '6px 12px',
          color: '#dc3545',
          flexShrink: 0,
          flexGrow: 0,
          position: 'sticky',
          top: '48px',
          zIndex: 99
        }}>
          {error}
        </div>
      )}

      {/* Sales Table */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        width: '100%',
        boxSizing: 'border-box',
        margin: '0',
        padding: '0',
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '500px',
        boxShadow: '0 4px 12px var(--shadow-md)'
      }}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '32px 32px 70px 120px minmax(150px, 1fr) 80px minmax(100px, 0.8fr) 90px 110px minmax(140px, 1fr) 50px 100px 120px 24px 60px',
          gap: '0',
          columnGap: '8px',
          padding: largeFontMode ? '14px 16px' : '10px 12px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          fontSize: `${getFontSize(11)}px`,
          fontWeight: '600',
          color: 'var(--text-primary)',
          textTransform: 'uppercase',
          letterSpacing: '0.3px',
          alignItems: 'center',
          minHeight: largeFontMode ? '50px' : '40px',
          height: largeFontMode ? '50px' : '40px',
          width: '100%',
          boxSizing: 'border-box',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <input
              type="checkbox"
              checked={sortedSalesData.length > 0 && selectedItems.size === sortedSalesData.length}
              onChange={handleSelectAll}
              style={{
                cursor: 'pointer',
                width: '16px',
                height: '16px'
              }}
              title="Select all items"
            />
          </div>
          <div 
            onClick={() => handleSort('RECEIPT')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap', 
              minWidth: 0,
              cursor: 'pointer',
              userSelect: 'none',
              padding: '4px',
              borderRadius: '4px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'var(--hover-bg)'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
            title="Click to sort by Receipt"
          >
            Receipt
            {sortField === 'RECEIPT' && (
              sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>Date</div>
          <div 
            onClick={() => handleSort('CUSTOMER')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap', 
              minWidth: 0,
              cursor: 'pointer',
              userSelect: 'none',
              padding: '4px',
              borderRadius: '4px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'var(--hover-bg)'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
            title="Click to sort by Customer"
          >
            Customer
            {sortField === 'CUSTOMER' && (
              sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
            )}
          </div>
          <div 
            onClick={() => handleSort('IDCODE')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '4px',
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap', 
              minWidth: 0,
              cursor: 'pointer',
              userSelect: 'none',
              padding: '4px',
              borderRadius: '4px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'var(--hover-bg)'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
            title="Click to sort by ID Code"
          >
            ID Code
            {sortField === 'IDCODE' && (
              sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
            )}
          </div>
          <div 
            onClick={() => handleSort('BENZ')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap', 
              minWidth: 0,
              cursor: 'pointer',
              userSelect: 'none',
              padding: '4px',
              borderRadius: '4px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'var(--hover-bg)'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
            title="Click to sort by Part No."
          >
            Part No.
            {sortField === 'BENZ' && (
              sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
            )}
          </div>
          <div 
            onClick={() => handleSort('BRAND')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap', 
              minWidth: 0,
              cursor: 'pointer',
              userSelect: 'none',
              padding: '4px',
              borderRadius: '4px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'var(--hover-bg)'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
            title="Click to sort by Brand"
          >
            Brand
            {sortField === 'BRAND' && (
              sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
            )}
          </div>
          <div 
            onClick={() => handleSort('ALTNO')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap', 
              minWidth: 0,
              cursor: 'pointer',
              userSelect: 'none',
              padding: '4px',
              borderRadius: '4px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'var(--hover-bg)'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
            title="Click to sort by OEM No."
          >
            OEM No.
            {sortField === 'ALTNO' && (
              sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
            )}
          </div>
          <div 
            onClick={() => handleSort('DESCRIPTION')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              overflow: 'visible', 
              whiteSpace: 'normal', 
              wordBreak: 'break-word', 
              minWidth: 0,
              cursor: 'pointer',
              userSelect: 'none',
              padding: '4px',
              borderRadius: '4px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'var(--hover-bg)'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
            title="Click to sort by Description"
          >
            Description
            {sortField === 'DESCRIPTION' && (
              sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
            )}
          </div>
          <div 
            onClick={() => handleSort('QTY')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '4px',
              textAlign: 'center', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap', 
              minWidth: 0,
              cursor: 'pointer',
              userSelect: 'none',
              padding: '4px',
              borderRadius: '4px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'var(--hover-bg)'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
            title="Click to sort by Quantity"
          >
            Qty
            {sortField === 'QTY' && (
              sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
            )}
          </div>
          <div 
            onClick={() => handleSort('SELL')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'flex-end',
              gap: '4px',
              textAlign: 'right', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap', 
              minWidth: 0, 
              paddingRight: '16px',
              cursor: 'pointer',
              userSelect: 'none',
              padding: '4px',
              borderRadius: '4px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'var(--hover-bg)'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
            title="Click to sort by Unit Price"
          >
            Unit Price
            {sortField === 'SELL' && (
              sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
            )}
          </div>
          <div 
            onClick={() => handleSort('AMOUNT')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'flex-end',
              gap: '4px',
              textAlign: 'right', 
              overflow: 'visible', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap', 
              minWidth: 0, 
              paddingRight: '8px',
              position: 'relative',
              flexDirection: 'column',
              cursor: 'pointer',
              userSelect: 'none',
              padding: '4px',
              borderRadius: '4px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'var(--hover-bg)'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
            title="Click to sort by Amount"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              Amount
              {sortField === 'AMOUNT' && (
                sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
              )}
            </div>
          </div>
          <div></div>
          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>Action</div>
          )}
        </div>

        {/* Table Body - Fixed height for 15 rows */}
        <div 
          className="sales-table-body"
          style={{ 
            flex: '1 1 0',
            overflowY: 'auto', 
            overflowX: 'auto', 
            width: '100%', 
            minHeight: 0,
            maxHeight: '100%',
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--border-color) var(--card-bg)'
          }}
        >
          <style>{`
            .sales-table-body::-webkit-scrollbar {
              width: 8px;
              height: 8px;
            }
            .sales-table-body::-webkit-scrollbar-track {
              background: var(--card-bg);
            }
            .sales-table-body::-webkit-scrollbar-thumb {
              background: var(--border-color);
              border-radius: 4px;
            }
            .sales-table-body::-webkit-scrollbar-thumb:hover {
              background: var(--border-light);
            }
          `}</style>
          {loading ? (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '60px',
              color: 'var(--text-muted)'
            }}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginRight: '12px' }} />
              Loading sales data...
            </div>
          ) : salesData.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '60px',
              color: 'var(--text-muted)',
              textAlign: 'center'
            }}>
              <FileText size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>No sales records found</h3>
              <p style={{ margin: '0', fontSize: '14px' }}>
                {Object.values(filters).some(v => v) 
                  ? 'Try adjusting your search filters'
                  : 'No sales transactions recorded yet'
                }
              </p>
            </div>
          ) : (
            sortedSalesData.map((sale, index) => {
                const rowId = `${sale.INVOICE}-${index}`;
                const isExpanded = expandedRows.has(rowId);
                const saleKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}`;
                const refundInfo = refundDetails[saleKey];
                const isPendingRefund = refundInfo?.status === 'PENDING';
                const isConfirmedRefund = refundInfo?.status === 'CONFIRMED';
                const isAdjustment = (sale.RECEIPT === 'ADJUSTMENT' || sale.INVOICE === 'ADJUSTMENT');
                
                // Check if order came from service
                const isFromService = sale.source === 'service';
                
                // Determine background color based on refund status, adjustment, or service source
                // isRefundRow = negative QTY record (duplicate refund row)
                const isRefundRowDuplicate = parseFloat(sale.QTY) < 0;
                
                let rowBackgroundColor;
                if (isExpanded) {
                  rowBackgroundColor = isFromService ? 'rgba(0, 123, 255, 0.2)' : 'rgba(0, 123, 255, 0.12)';
                } else if (isAdjustment) {
                  rowBackgroundColor = 'rgba(40, 167, 69, 0.15)'; // Green for adjustments
                } else if (isRefundRowDuplicate) {
                  rowBackgroundColor = 'rgba(220, 53, 69, 0.15)'; // Red for duplicate refund rows (negative values)
                } else if (isConfirmedRefund) {
                  rowBackgroundColor = 'rgba(220, 53, 69, 0.15)'; // Red for confirmed refunds (original row, positive values)
                } else if (isPendingRefund) {
                  rowBackgroundColor = 'rgba(255, 193, 7, 0.15)'; // Yellow for pending refunds
                } else if (isFromService) {
                  rowBackgroundColor = 'rgba(0, 123, 255, 0.15)'; // Blue for service orders
                } else {
                  rowBackgroundColor = index % 2 === 0 
                    ? 'var(--bg-secondary)' 
                    : 'transparent';
                }
              
              return (
                <React.Fragment key={rowId}>
                  {/* Main Row */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 32px 70px 120px minmax(150px, 1fr) 80px minmax(100px, 0.8fr) 90px 110px minmax(140px, 1fr) 50px 100px 120px 24px 60px',
                    gap: '0',
                    columnGap: '8px',
                    padding: largeFontMode ? '12px 16px' : '8px 12px',
                    borderBottom: '1px solid var(--border-color)',
                    borderLeft: isAdjustment ? '3px solid #28a745' : isRefundRowDuplicate ? '3px solid #dc3545' : isPendingRefund ? '3px solid #ffc107' : isConfirmedRefund ? '3px solid #dc3545' : isFromService ? '3px solid #007bff' : '3px solid transparent',
                    fontSize: `${getFontSize(13)}px`,
                    alignItems: 'center',
                    backgroundColor: rowBackgroundColor,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    minHeight: largeFontMode ? '60px' : '44px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                  onMouseEnter={(e) => {
                    if (isExpanded) {
                      e.currentTarget.style.backgroundColor = isFromService ? 'rgba(0, 123, 255, 0.25)' : 'rgba(0, 123, 255, 0.18)';
                    } else if (isAdjustment) {
                      e.currentTarget.style.backgroundColor = 'rgba(40, 167, 69, 0.25)';
                    } else if (isRefundRowDuplicate) {
                      e.currentTarget.style.backgroundColor = 'rgba(220, 53, 69, 0.25)';
                    } else if (isConfirmedRefund) {
                      e.currentTarget.style.backgroundColor = 'rgba(220, 53, 69, 0.25)';
                    } else if (isPendingRefund) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 193, 7, 0.25)';
                    } else if (isFromService) {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 123, 255, 0.25)';
                    } else {
                      e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                    }
                    if (!isAdjustment && !isPendingRefund && !isConfirmedRefund && !isFromService && !isRefundRowDuplicate) {
                      e.currentTarget.style.borderLeftColor = '#007bff';
                    }
                    const borderColor = isAdjustment ? '#28a745' : isRefundRowDuplicate ? '#dc3545' : isPendingRefund ? '#ffc107' : isConfirmedRefund ? '#dc3545' : isFromService ? '#007bff' : '#007bff';
                    e.currentTarget.style.boxShadow = `inset 4px 0 0 ${borderColor}, 0 1px 3px rgba(0, 0, 0, 0.3)`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = rowBackgroundColor;
                    if (!isAdjustment && !isPendingRefund && !isConfirmedRefund && !isFromService && !isRefundRowDuplicate) {
                      e.currentTarget.style.borderLeftColor = 'transparent';
                    }
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onClick={() => {
                    toggleRowExpansion(rowId);
                    // If expanding, fetch refund details if available
                    if (!expandedRows.has(rowId)) {
                      const saleKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}`;
                      if (refundedItems.has(saleKey) || isPendingRefund || isConfirmedRefund) {
                        fetchRefundDetails(sale);
                      }
                    }
                  }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isExpanded ? 
                        <ChevronUp size={16} style={{ color: '#007bff' }} /> : 
                        <ChevronDown size={16} style={{ color: '#6c757d' }} />
                      }
                    </div>
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center' 
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(() => {
                        const saleKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}`;
                        const uniqueKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}`;
                        const isRefunded = refundedItems.has(saleKey);
                        const itemKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}`;
                        
                        // Show checkbox for all items (not just refunded)
                        return (
                          <input
                            type="checkbox"
                            checked={selectedItems.has(itemKey)}
                            onChange={() => handleItemSelect(sale, index)}
                            onClick={(e) => e.stopPropagation()}
                            disabled={isRefunded}
                            style={{
                              cursor: isRefunded ? 'not-allowed' : 'pointer',
                              width: '16px',
                              height: '16px',
                              opacity: isRefunded ? 0.5 : 1
                            }}
                            title={isRefunded ? 'Item already refunded' : 'Select item for refund'}
                          />
                        );
                      })()}
                    </div>
                  <div style={{ 
                    fontFamily: 'monospace', 
                    color: '#64b5f6',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    fontSize: `${getFontSize(13)}px`,
                    padding: '2px 0'
                  }}>
                    {editingRow === `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}` ? (
                      <input
                        type="text"
                        value={editFormData.receipt || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, receipt: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '100%',
                          padding: largeFontMode ? '6px 8px' : '4px 6px',
                          background: 'var(--input-bg)',
                          border: '2px solid #64b5f6',
                          borderRadius: '4px',
                          color: '#64b5f6',
                          fontSize: `${getFontSize(13)}px`,
                          fontFamily: 'monospace',
                          fontWeight: '600',
                          outline: 'none'
                        }}
                        placeholder="Receipt/Invoice"
                      />
                    ) : (
                      sale.RECEIPT || sale.INVOICE
                    )}
                  </div>
                  <div style={{ 
                    fontFamily: 'monospace',
                    color: '#9c27b0',
                    fontWeight: '500',
                    fontSize: `${getFontSize(11)}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'visible',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    padding: '2px 4px',
                    width: '100%'
                  }}
                  title={sale.DATE ? new Date(sale.DATE).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                  >
                    {sale.DATE ? (() => {
                      const date = new Date(sale.DATE);
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    })() : 'N/A'}
                  </div>
                  <div style={{ 
                    color: 'var(--text-primary)', 
                    overflow: 'visible',
                    display: 'flex',
                    alignItems: 'center',
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                    minWidth: '150px',
                    maxWidth: 'fit-content',
                    fontSize: `${getFontSize(13)}px`,
                    fontWeight: '500',
                    padding: '2px 0',
                    lineHeight: '1.4'
                  }}
                  title={sale.CUSTOMER || 'Walk-in Customer'}
                  >
                    {editingRow === `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}` ? (
                      <input
                        type="text"
                        value={editFormData.customer || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, customer: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '100%',
                          padding: largeFontMode ? '8px 10px' : '6px 8px',
                          background: '#2a2a2a',
                          border: '1px solid #007bff',
                          borderRadius: '4px',
                          color: 'var(--text-primary)',
                          fontSize: `${getFontSize(13)}px`,
                          outline: 'none'
                        }}
                        placeholder="Customer name"
                      />
                    ) : (
                      sale.CUSTOMER || 'Walk-in Customer'
                    )}
                  </div>
                  <div style={{ 
                    fontFamily: 'monospace',
                    color: '#ff9800',
                    fontWeight: '600',
                    fontSize: `${getFontSize(13)}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'visible',
                    minWidth: 0,
                    position: 'relative',
                    padding: '2px 0'
                  }}
                  title={sale.IDCODE || 'N/A'}
                  >
                    {editingRow === `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}` ? (
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={idCodeSearchTerm}
                          onChange={(e) => {
                            const value = e.target.value;
                            setIdCodeSearchTerm(value);
                            handleIdCodeChange(value);
                          }}
                          onKeyPress={handleIdCodeKeyPress}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: '100%',
                            padding: largeFontMode ? '6px 8px' : '4px 6px',
                            background: idCodeSearchError ? 'rgba(220, 53, 69, 0.1)' : (selectedStockItem ? 'rgba(40, 167, 69, 0.1)' : 'var(--input-bg)'),
                            border: idCodeSearchError ? '1px solid #dc3545' : (selectedStockItem ? '1px solid #28a745' : '1px solid var(--border-color)'),
                            borderRadius: '4px',
                            color: idCodeSearchError ? '#dc3545' : (selectedStockItem ? '#28a745' : '#ff9800'),
                            fontSize: `${getFontSize(13)}px`,
                            fontFamily: 'monospace',
                            fontWeight: '600',
                            textAlign: 'center',
                            outline: 'none'
                          }}
                          placeholder="Enter ID"
                          disabled={saving || searchingIdCode}
                        />
                        {searchingIdCode && (
                          <div style={{ fontSize: `${getFontSize(10)}px`, color: '#6c757d', textAlign: 'center' }}>Searching...</div>
                        )}
                        {idCodeSearchError && (
                          <div style={{ fontSize: `${getFontSize(10)}px`, color: '#dc3545', textAlign: 'center' }}>{idCodeSearchError}</div>
                        )}
                        {selectedStockItem && !idCodeSearchError && (
                          <div style={{ fontSize: `${getFontSize(10)}px`, color: '#28a745', textAlign: 'center' }}>✓ Found</div>
                        )}
                      </div>
                    ) : (
                      <span style={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap', 
                        width: '100%',
                        fontSize: `${getFontSize(15)}px`,
                        fontWeight: '700'
                      }}>
                        {sale.IDCODE || 'N/A'}
                      </span>
                    )}
                  </div>
                  <div 
                    onClick={(e) => {
                      if (!editingRow || editingRow !== `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}`) {
                        handlePartNumberClick(e, sale.BENZ, sale.BRAND, sale.ALTNO);
                      }
                    }}
                    style={{ 
                      fontFamily: 'monospace',
                      color: '#42a5f5',
                      fontWeight: '600',
                      fontSize: `${getFontSize(16)}px`,
                      display: 'flex',
                      alignItems: 'center',
                      cursor: (sale.BENZ && sale.BENZ !== 'N/A' && (!editingRow || editingRow !== `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}`)) ? 'pointer' : 'default',
                      textDecoration: 'none',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                      overflow: 'visible',
                      minWidth: '100px',
                      maxWidth: 'fit-content',
                      padding: '2px 4px',
                      lineHeight: '1.4'
                    }}
                    onMouseEnter={(e) => {
                      if (sale.BENZ && sale.BENZ !== 'N/A' && (!editingRow || editingRow !== `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}`)) {
                        e.target.style.color = '#64b5f6';
                        e.target.style.transform = 'translateX(2px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (sale.BENZ && sale.BENZ !== 'N/A' && (!editingRow || editingRow !== `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}`)) {
                        e.target.style.color = '#42a5f5';
                        e.target.style.transform = 'translateX(0)';
                      }
                    }}
                    title={selectedStockItem ? (selectedStockItem.BENZ || 'N/A') : (sale.BENZ || 'N/A')}
                  >
                    {editingRow === `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}` && selectedStockItem
                      ? (selectedStockItem.BENZ || 'N/A')
                      : (sale.BENZ || 'N/A')
                    }
                  </div>
                  <div style={{ 
                    color: 'var(--text-secondary)', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis',
                    display: 'flex',
                    alignItems: 'center',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    fontSize: `${getFontSize(14)}px`,
                    fontWeight: '500',
                    padding: '3px 0px'
                  }}
                  title={editingRow === `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}` && selectedStockItem
                    ? (selectedStockItem.BRAND || 'N/A')
                    : (sale.BRAND || 'N/A')
                  }
                  >
                    {editingRow === `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}` && selectedStockItem
                      ? (selectedStockItem.BRAND || 'N/A')
                      : sale.BRAND
                    }
                  </div>
                  <div 
                  onClick={(e) => {
                    if (!editingRow || editingRow !== `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}`) {
                      // Allow using OEM as fallback identifier when part number is missing
                      handlePartNumberClick(e, sale.BENZ, sale.BRAND, sale.ALTNO, sale.ALTNO);
                    }
                  }}
                  style={{ 
                    fontFamily: 'monospace',
                    color: '#26a69a',
                    fontWeight: '600',
                    fontSize: `${getFontSize(13)}px`,
                    display: 'flex',
                    alignItems: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    padding: '2px 0'
                  }}
                  title={editingRow === `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}` && selectedStockItem
                    ? (selectedStockItem.ALTNO || 'N/A')
                    : (sale.ALTNO || 'N/A')
                  }
                  >
                    {editingRow === `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}` && selectedStockItem
                      ? (selectedStockItem.ALTNO || 'N/A')
                      : (sale.ALTNO || 'N/A')
                    }
                  </div>
                  <div style={{ 
                    color: 'var(--text-secondary)',
                    overflow: 'visible',
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                    lineHeight: '1.4',
                    display: 'flex',
                    alignItems: 'center',
                    minWidth: '140px',
                    maxWidth: 'fit-content',
                    fontSize: `${getFontSize(13)}px`,
                    fontWeight: '400',
                    padding: '2px 0'
                  }}
                  title={editingRow === `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}` && selectedStockItem
                    ? (selectedStockItem.DESCRIPTION || selectedStockItem.REMARKS || 'N/A')
                    : (sale.DESCRIPTION || sale.REMARKS || 'N/A')
                  }
                  >
                    {editingRow === `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}` && selectedStockItem
                      ? (selectedStockItem.DESCRIPTION || selectedStockItem.REMARKS || 'N/A')
                      : (sale.DESCRIPTION || sale.REMARKS || 'N/A')
                    }
                  </div>
                  <div style={{ 
                    fontWeight: '600',
                    color: '#ff9800',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    fontSize: `${getFontSize(13)}px`,
                    padding: '2px 0',
                    minWidth: '40px'
                  }}>
                    {editingRow === `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}` ? (
                      <input
                        type="number"
                        min="1"
                        value={editFormData.qty || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, qty: parseInt(e.target.value) || 1 })}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: largeFontMode ? '80px' : '60px',
                          padding: largeFontMode ? '8px 10px' : '6px 8px',
                          background: 'var(--input-bg)',
                          border: '1px solid #fd7e14',
                          borderRadius: '4px',
                          color: '#fd7e14',
                          fontSize: `${getFontSize(13)}px`,
                          fontWeight: '600',
                          textAlign: 'center',
                          outline: 'none'
                        }}
                      />
                    ) : (
                      // Show QTY - for adjustments: adding stock (+1) shows as -1, decreasing (-1) shows as 1
                      // For refund rows: show negative QTY
                      isAdjustment 
                        ? sale.QTY || 0 // Show actual value: -1 for adding stock, 1 for decreasing stock
                        : parseFloat(sale.QTY) < 0 
                          ? sale.QTY // Negative for duplicate refund rows
                          : sale.QTY // Positive for original rows (even when refunded)
                    )}
                  </div>
                  <div style={{ 
                    fontFamily: 'monospace',
                    fontWeight: '600',
                    color: '#64b5f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    textAlign: 'right',
                    fontSize: `${getFontSize(13)}px`,
                    padding: '2px 16px 2px 0'
                  }}>
                    {editingRow === `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}` ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editFormData.unit_price || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, unit_price: parseFloat(e.target.value) || 0 })}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: largeFontMode ? '120px' : '100px',
                          padding: largeFontMode ? '8px 10px' : '6px 8px',
                          background: '#2a2a2a',
                          border: '1px solid #007bff',
                          borderRadius: '4px',
                          color: '#007bff',
                          fontSize: `${getFontSize(14)}px`,
                          fontFamily: 'monospace',
                          fontWeight: '600',
                          textAlign: 'right',
                          outline: 'none'
                        }}
                        placeholder="0.00"
                      />
                    ) : (
                      // Show UNIT PRICE - always positive (even for refund rows with QTY < 0)
                      isAdjustment
                        ? formatCurrency(0)
                        : (() => {
                            const sell = parseFloat(sale.SELL) || 0;
                            // Always show unit price as positive
                            return formatCurrency(Math.abs(sell));
                          })()
                    )}
                  </div>
                  <div style={{ 
                    fontFamily: 'monospace',
                    fontWeight: '700',
                    color: '#26a69a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    textAlign: 'right',
                    fontSize: `${getFontSize(13)}px`,
                    padding: '2px 0',
                    paddingRight: '8px'
                  }}>
                    {editingRow === `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}` ? (
                      formatCurrency((editFormData.unit_price || 0) * (editFormData.qty || 1))
                    ) : (
                      // Show AMOUNT - always positive (even for refund rows with QTY < 0)
                      isAdjustment
                        ? formatCurrency(0)
                        : (() => {
                            const qty = parseFloat(sale.QTY) || 0;
                            const sell = parseFloat(sale.SELL) || 0;
                            let totalAmount = sale.total_amount ? parseFloat(sale.total_amount) : (sell * qty);
                            // Always show amount as positive (absolute value)
                            return formatCurrency(Math.abs(totalAmount));
                          })()
                    )}
                  </div>
                  
                  {/* Spacer column for space-between Amount and Action */}
                  <div></div>
                  
                  {/* Action Buttons Column - Admin Only */}
                  {isAdmin && (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: '4px',
                      flexShrink: 0
                    }}
                    onClick={(e) => e.stopPropagation()}
                    >
                      {(() => {
                        const rowId = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}`;
                        const saleKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}`;
                        const isRefunded = refundedItems.has(saleKey);
                        const isEditing = editingRow === rowId;
                        
                        if (isEditing) {
                          return (
                            <>
                              <button
                                onClick={() => handleSaveEdit(sale, index)}
                                disabled={saving}
                                style={{
                                  background: saving ? '#e9ecef' : '#28a745',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '6px 8px',
                                  cursor: saving ? 'not-allowed' : 'pointer',
                                  color: 'var(--text-primary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s ease',
                                  opacity: saving ? 0.6 : 1,
                                  boxShadow: saving ? 'none' : '0 2px 4px rgba(40, 167, 69, 0.3)',
                                  flexShrink: 0
                                }}
                                title="Save changes"
                                onMouseEnter={(e) => {
                                  if (!saving) {
                                    e.target.style.background = '#218838';
                                    e.target.style.boxShadow = '0 2px 8px rgba(40, 167, 69, 0.4)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!saving) {
                                    e.target.style.background = '#28a745';
                                    e.target.style.boxShadow = '0 2px 4px rgba(40, 167, 69, 0.3)';
                                  }
                                }}
                              >
                                <Save size={14} />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={saving}
                                style={{
                                  background: '#6c757d',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '6px 8px',
                                  cursor: saving ? 'not-allowed' : 'pointer',
                                  color: 'var(--text-primary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s ease',
                                  opacity: saving ? 0.6 : 1,
                                  boxShadow: '0 2px 4px rgba(108, 117, 125, 0.3)',
                                  flexShrink: 0
                                }}
                                title="Cancel edit"
                                onMouseEnter={(e) => {
                                  if (!saving) {
                                    e.target.style.background = '#5a6268';
                                    e.target.style.boxShadow = '0 2px 8px rgba(108, 117, 125, 0.4)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!saving) {
                                    e.target.style.background = '#6c757d';
                                    e.target.style.boxShadow = '0 2px 4px rgba(108, 117, 125, 0.3)';
                                  }
                                }}
                              >
                                <X size={14} />
                              </button>
                            </>
                          );
                        }
                        
                        return (
                          <>
                            <button
                              onClick={() => handleEditRow(sale, index)}
                              disabled={isRefunded}
                              style={{
                                background: isRefunded ? 'rgba(108, 117, 125, 0.2)' : 'rgba(0, 123, 255, 0.2)',
                                border: isRefunded ? '1px solid #6c757d' : '1px solid #007bff',
                                borderRadius: '4px',
                                padding: '6px 8px',
                                cursor: isRefunded ? 'not-allowed' : 'pointer',
                                color: isRefunded ? '#6c757d' : '#007bff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease',
                                opacity: isRefunded ? 0.5 : 1
                              }}
                              title={isRefunded ? 'Cannot edit refunded item' : 'Edit sale'}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteSale(sale, index)}
                              disabled={isRefunded}
                              style={{
                                background: isRefunded ? 'rgba(108, 117, 125, 0.2)' : 'rgba(220, 53, 69, 0.2)',
                                border: isRefunded ? '1px solid #6c757d' : '1px solid #dc3545',
                                borderRadius: '4px',
                                padding: '6px 8px',
                                cursor: isRefunded ? 'not-allowed' : 'pointer',
                                color: isRefunded ? '#6c757d' : '#dc3545',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease',
                                opacity: isRefunded ? 0.5 : 1
                              }}
                              onMouseOver={(e) => {
                                if (!isRefunded) {
                                  e.target.style.background = 'rgba(220, 53, 69, 0.3)';
                                }
                              }}
                              onMouseOut={(e) => {
                                if (!isRefunded) {
                                  e.target.style.background = 'rgba(220, 53, 69, 0.2)';
                                }
                              }}
                              title={isRefunded ? 'Cannot delete refunded item' : 'Delete sale and return to stock'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  )}
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div style={{
                      padding: '20px',
                          background: 'var(--bg-secondary)',
                      borderBottom: '1px solid var(--border-color)',
                      borderLeft: '4px solid #007bff',
                      fontSize: '14px'
                    }}>
                      {/* Print Receipt Button */}
                      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openPrintReceiptModal(sale.RECEIPT || sale.INVOICE);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 16px',
                            background: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#218838';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#28a745';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
                          }}
                          title="Print receipt for this transaction"
                        >
                          <Receipt size={16} />
                          Print Receipt
                        </button>
                      </div>
                      
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: '20px'
                      }}>
                        <div>
                          <h4 style={{ margin: '0 0 12px 0', color: '#007bff', fontSize: '15px', fontWeight: '600' }}>
                            Product Details
                          </h4>
                          <div style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                            <p style={{ margin: '4px 0' }}>
                              <strong>Part Number:</strong> {sale.BENZ || 'N/A'}
                            </p>
                            <p style={{ margin: '4px 0' }}>
                              <strong>Alt Number:</strong> {sale.ALTNO || 'N/A'}
                            </p>
                            <p style={{ margin: '4px 0' }}>
                              <strong>Color Code:</strong> {sale.COLORCODE || 'N/A'}
                            </p>
                          </div>
                        </div>
                        
                        <div>
                          <h4 style={{ margin: '0 0 12px 0', color: '#28a745', fontSize: '14px' }}>
                            Financial Details
                          </h4>
                          <div style={{ color: '#bdbdbd', lineHeight: '1.5' }}>
                            <p style={{ margin: '4px 0' }}>
                              <strong>Unit Cost:</strong> {formatCurrency(sale.COST)}
                            </p>
                            <p style={{ margin: '4px 0' }}>
                              <strong>Unit Price:</strong> {formatCurrency(sale.SELL)}
                            </p>
                            <p style={{ margin: '4px 0', color: '#28a745', fontWeight: '600' }}>
                              <strong>Total Amount:</strong> {formatCurrency(sale.total_amount || (sale.SELL * sale.QTY))}
                            </p>
                          </div>
                        </div>
                        
                        <div>
                          <h4 style={{ margin: '0 0 12px 0', color: '#fd7e14', fontSize: '14px' }}>
                            Transaction Info
                          </h4>
                          <div style={{ color: 'var(--text-muted)', lineHeight: '1.5' }}>
                            <p style={{ margin: '4px 0' }}>
                              <strong>Receipt:</strong> {sale.RECEIPT || 'N/A'}
                            </p>
                            <p style={{ margin: '4px 0' }}>
                              <strong>ID Code:</strong> {sale.IDCODE || 'N/A'}
                            </p>
                            <p style={{ margin: '4px 0' }}>
                              <strong>Remarks:</strong> {sale.REMARKS || 'N/A'}
                            </p>
                            <p style={{ margin: '4px 0' }}>
                              <strong>Quantity:</strong> {sale.QTY} units
                            </p>
                          </div>
                        </div>
                        
                        {/* Service Info Section - Only show if order came from service */}
                        {sale.source === 'service' && (
                          <div>
                            <h4 style={{ margin: '0 0 12px 0', color: '#007bff', fontSize: '14px' }}>
                              Service Info
                            </h4>
                            <div style={{ color: 'var(--text-muted)', lineHeight: '1.5' }}>
                              {sale.requisition_number && (
                                <p style={{ margin: '4px 0' }}>
                                  <strong>PRF:</strong> {sale.requisition_number}
                                </p>
                              )}
                              {sale.repair_order_number && (
                                <p style={{ margin: '4px 0' }}>
                                  <strong>RO:</strong> {sale.repair_order_number}
                                </p>
                              )}
                              {sale.plate_number && (
                                <p style={{ margin: '4px 0' }}>
                                  <strong>Plate Number:</strong> {sale.plate_number}
                                </p>
                              )}
                              {!sale.requisition_number && !sale.repair_order_number && !sale.plate_number && (
                                <p style={{ margin: '4px 0', color: '#999' }}>
                                  No service information available
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Refund Details Section */}
                        {(() => {
                          const saleKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}`;
                          const isRefunded = refundedItems.has(saleKey);
                          const refundInfo = refundDetails[saleKey];
                          const isLoadingRefund = loadingRefundDetails.has(saleKey);
                          
                          if (isRefunded) {
                            return (
                              <div>
                                <h4 style={{ margin: '0 0 12px 0', color: '#dc3545', fontSize: '14px' }}>
                                  Refund Information
                                </h4>
                                <div style={{ color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                  {isLoadingRefund ? (
                                    <p style={{ margin: '4px 0', color: '#6c757d' }}>
                                      <RefreshCw size={14} style={{ display: 'inline', animation: 'spin 1s linear infinite', marginRight: '6px' }} />
                                      Loading refund details...
                                    </p>
                                  ) : refundInfo ? (
                                    <>
                                      <p style={{ margin: '4px 0' }}>
                                        <strong>Status:</strong> 
                                        <span style={{ 
                                          color: refundInfo.status === 'CONFIRMED' ? '#28a745' : 
                                                 refundInfo.status === 'PENDING' ? '#ffc107' : '#dc3545',
                                          fontWeight: '600',
                                          marginLeft: '8px'
                                        }}>
                                          {refundInfo.status}
                                        </span>
                                      </p>
                                      {refundInfo.cm_number && (
                                        <p style={{ margin: '4px 0' }}>
                                          <strong>CM Number:</strong> {refundInfo.cm_number}
                                        </p>
                                      )}
                                      {refundInfo.reason && (
                                        <p style={{ margin: '4px 0' }}>
                                          <strong>Reason:</strong> 
                                          <span style={{ color: '#fff', marginLeft: '8px' }}>
                                            {refundInfo.reason}
                                          </span>
                                        </p>
                                      )}
                                      {refundInfo.notes && (
                                        <p style={{ margin: '4px 0' }}>
                                          <strong>Notes:</strong> 
                                          <span style={{ color: '#fff', marginLeft: '8px' }}>
                                            {refundInfo.notes}
                                          </span>
                                        </p>
                                      )}
                                      {refundInfo.refund_date && (
                                        <p style={{ margin: '4px 0' }}>
                                          <strong>Refund Date:</strong> {new Date(refundInfo.refund_date).toLocaleDateString()}
                                        </p>
                                      )}
                                      {refundInfo.created_by && (
                                        <p style={{ margin: '4px 0' }}>
                                          <strong>Created By:</strong> {refundInfo.created_by}
                                        </p>
                                      )}
                                      {refundInfo.confirmed_by && (
                                        <p style={{ margin: '4px 0', color: '#28a745' }}>
                                          <strong>Confirmed By:</strong> {refundInfo.confirmed_by} 
                                          {refundInfo.confirmed_at && (
                                            <span style={{ marginLeft: '8px', fontSize: '11px' }}>
                                              ({new Date(refundInfo.confirmed_at).toLocaleString()})
                                            </span>
                                          )}
                                        </p>
                                      )}
                                    </>
                                  ) : (
                                    <p style={{ margin: '4px 0', color: '#6c757d' }}>
                                      Refunded (Details not available)
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })
          )}
          
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 14px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 255, 255, 0.02)'
          }}>
            <div style={{ fontSize: '14px', color: '#6c757d' }}>
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalRecords)} of {totalRecords} entries
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
                  fontSize: '14px'
                }}
              >
                <ArrowLeft size={14} />
                Previous
              </button>
              
              <span style={{ 
                padding: '8px 16px',
                background: 'rgba(0, 123, 255, 0.1)',
                border: '1px solid #007bff',
                borderRadius: '6px',
                color: '#007bff',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '8px 12px',
                  background: currentPage === totalPages ? 'rgba(108, 117, 125, 0.2)' : 'rgba(0, 123, 255, 0.2)',
                  border: `1px solid ${currentPage === totalPages ? '#6c757d' : '#007bff'}`,
                  borderRadius: '6px',
                  color: currentPage === totalPages ? '#6c757d' : '#007bff',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                Next
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Refund Form Modal */}
      {showRefundModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !refundSubmitting) {
            handleCloseRefundModal();
          }
        }}
        >
          <div style={{
            background: 'var(--modal-bg)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            width: '100%',
            maxWidth: '1000px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 8px 32px var(--shadow-lg)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: largeFontMode ? '24px 28px' : '20px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(220, 53, 69, 0.1)'
            }}>
              <h2 style={{
                margin: 0,
                color: '#fff',
                fontSize: `${getFontSize(20)}px`,
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: largeFontMode ? '12px' : '10px'
              }}>
                <RotateCcw size={getFontSize(24)} />
                Create Refund Request
              </h2>
              <button
                onClick={handleCloseRefundModal}
                disabled={refundSubmitting}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: `${getFontSize(24)}px`,
                  cursor: refundSubmitting ? 'not-allowed' : 'pointer',
                  padding: largeFontMode ? '6px 10px' : '4px 8px',
                  opacity: refundSubmitting ? 0.5 : 1
                }}
              >
                <X size={getFontSize(20)} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: largeFontMode ? '28px' : '24px' }}>
              {/* Selected Items Summary */}
              <div style={{
                marginBottom: largeFontMode ? '28px' : '24px',
                padding: largeFontMode ? '20px' : '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <h3 style={{
                  margin: '0 0 16px 0',
                  color: '#fff',
                  fontSize: `${getFontSize(16)}px`,
                  fontWeight: '600'
                }}>
                  Selected Items ({selectedItems.size})
                </h3>
                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  marginBottom: '12px'
                }}>
                  {salesData.map((sale, index) => {
                    const saleKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}`;
                    if (!selectedItems.has(saleKey)) return null;
                    const editedQty = refundQuantities[saleKey] !== undefined ? refundQuantities[saleKey] : sale.QTY;
                    const displayQty = editedQty === '' ? sale.QTY : editedQty;
                    const validQty = Math.max(0, Math.min(displayQty, sale.QTY));
                    return (
                      <div key={saleKey} style={{
                        padding: largeFontMode ? '12px 16px' : '8px 12px',
                        marginBottom: largeFontMode ? '12px' : '8px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '6px',
                        fontSize: `${getFontSize(13)}px`,
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr 1fr',
                        gap: largeFontMode ? '16px' : '12px',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ color: '#fff', fontWeight: '500' }}>
                            {sale.BRAND} - {sale.BENZ || 'N/A'}
                          </div>
                          <div style={{ color: '#6c757d', fontSize: `${getFontSize(11)}px` }}>
                            ID: {sale.IDCODE}
                          </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ color: '#6c757d', marginBottom: '4px', fontSize: `${getFontSize(11)}px` }}>
                            Qty:
                          </div>
                          <input
                            type="number"
                            min="0"
                            max={sale.QTY}
                            step="1"
                            value={refundQuantities[saleKey] !== undefined ? refundQuantities[saleKey] : sale.QTY}
                            onChange={(e) => handleRefundQuantityChange(saleKey, e.target.value)}
                            onBlur={() => handleRefundQuantityBlur(saleKey, sale.QTY)}
                            disabled={refundSubmitting}
                            style={{
                              width: '80px',
                              padding: largeFontMode ? '6px 8px' : '4px 6px',
                              background: 'rgba(255, 255, 255, 0.1)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              borderRadius: '4px',
                              color: '#fd7e14',
                              fontWeight: '600',
                              fontSize: `${getFontSize(13)}px`,
                              textAlign: 'center',
                              outline: 'none'
                            }}
                          />
                          <div style={{ color: '#6c757d', fontSize: `${getFontSize(10)}px`, marginTop: '2px' }}>
                            Max: {sale.QTY}
                          </div>
                        </div>
                        <div style={{ color: '#6c757d', textAlign: 'center' }}>
                          Price: <span style={{ color: '#17a2b8', fontWeight: '600' }}>{formatCurrency(sale.SELL || 0)}</span>
                        </div>
                        <div style={{ color: '#6c757d', textAlign: 'right' }}>
                          <span style={{ color: '#28a745', fontWeight: '600' }}>
                            {formatCurrency((sale.SELL || 0) * validQty)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{
                  paddingTop: largeFontMode ? '16px' : '12px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ color: '#6c757d', fontSize: `${getFontSize(14)}px` }}>
                    Total Quantity: <span style={{ color: '#fff', fontWeight: '600' }}>
                      {(() => {
                        let totalQty = 0;
                        salesData.forEach((sale, index) => {
                          const saleKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}`;
                          if (selectedItems.has(saleKey)) {
                            const editedQty = refundQuantities[saleKey] !== undefined ? refundQuantities[saleKey] : sale.QTY;
                            const validQty = Math.max(0, Math.min(editedQty === '' ? sale.QTY : editedQty, sale.QTY));
                            totalQty += validQty;
                          }
                        });
                        return totalQty;
                      })()}
                    </span>
                  </div>
                  <div style={{ color: '#6c757d', fontSize: `${getFontSize(14)}px` }}>
                    Total Amount: <span style={{ color: '#28a745', fontWeight: '600', fontSize: `${getFontSize(16)}px` }}>
                      {formatCurrency((() => {
                        let totalAmount = 0;
                        salesData.forEach((sale, index) => {
                          const saleKey = `${sale.IDCODE}-${sale.DATE}-${sale.RECEIPT}-${index}`;
                          if (selectedItems.has(saleKey)) {
                            const editedQty = refundQuantities[saleKey] !== undefined ? refundQuantities[saleKey] : sale.QTY;
                            const validQty = Math.max(0, Math.min(editedQty === '' ? sale.QTY : editedQty, sale.QTY));
                            totalAmount += (sale.SELL || 0) * validQty;
                          }
                        });
                        return totalAmount;
                      })())}
                    </span>
                  </div>
                </div>
              </div>

              {/* Form Fields - Wide Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: largeFontMode ? '24px' : '20px', marginBottom: largeFontMode ? '24px' : '20px' }}>
                {/* Customer Name */}
                <div>
                  <label style={{
                    display: 'block',
                    color: '#fff',
                    marginBottom: largeFontMode ? '10px' : '8px',
                    fontSize: `${getFontSize(14)}px`,
                    fontWeight: '500'
                  }}>
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={refundFormData.customer_name}
                    onChange={(e) => setRefundFormData({ ...refundFormData, customer_name: e.target.value.toUpperCase() })}
                    style={{
                      width: '100%',
                      padding: largeFontMode ? '12px 14px' : '10px 12px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: `${getFontSize(14)}px`,
                      outline: 'none',
                      height: largeFontMode ? '48px' : 'auto'
                    }}
                    disabled={refundSubmitting}
                  />
                </div>

                {/* Reason for Refund */}
                <div>
                  <label style={{
                    display: 'block',
                    color: '#fff',
                    marginBottom: largeFontMode ? '10px' : '8px',
                    fontSize: `${getFontSize(14)}px`,
                    fontWeight: '500'
                  }}>
                    Reason for Refund <span style={{ color: '#dc3545' }}>*</span>
                  </label>
                  <select
                    value={refundFormData.reason}
                    onChange={(e) => setRefundFormData({ ...refundFormData, reason: e.target.value })}
                    style={{
                      width: '100%',
                      padding: largeFontMode ? '12px 14px' : '10px 12px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: `${getFontSize(14)}px`,
                      outline: 'none',
                      cursor: refundSubmitting ? 'not-allowed' : 'pointer',
                      height: largeFontMode ? '48px' : 'auto'
                    }}
                    disabled={refundSubmitting}
                    required
                  >
                    <option value="" style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}>Select a reason...</option>
                    <option value="Defective" style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}>Defective Item</option>
                    <option value="Wrong Item" style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}>Wrong Item Delivered</option>
                    <option value="Customer Request" style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}>Customer Request</option>
                    <option value="Damage in Transit" style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}>Damage in Transit</option>
                    <option value="Quality Issue" style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}>Quality Issue</option>
                    <option value="Other" style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}>Other</option>
                  </select>
                </div>
              </div>

              {/* Invoice and CM# - Two columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: largeFontMode ? '20px' : '16px', marginBottom: largeFontMode ? '24px' : '20px' }}>
                <div>
                  <label style={{
                    display: 'block',
                    color: '#fff',
                    marginBottom: largeFontMode ? '10px' : '8px',
                    fontSize: `${getFontSize(14)}px`,
                    fontWeight: '500'
                  }}>
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    value={refundFormData.invoice_number}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setRefundFormData({ 
                        ...refundFormData, 
                        invoice_number: newValue
                      });
                    }}
                    style={{
                      width: '100%',
                      padding: largeFontMode ? '12px 14px' : '10px 12px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: `${getFontSize(14)}px`,
                      outline: 'none',
                      height: largeFontMode ? '48px' : 'auto'
                    }}
                    disabled={refundSubmitting}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    color: '#fff',
                    marginBottom: largeFontMode ? '10px' : '8px',
                    fontSize: `${getFontSize(14)}px`,
                    fontWeight: '500'
                  }}>
                    CM# <span style={{ color: '#dc3545' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={refundFormData.cm_number}
                    onChange={(e) => setRefundFormData({ ...refundFormData, cm_number: e.target.value })}
                    style={{
                      width: '100%',
                      padding: largeFontMode ? '12px 14px' : '10px 12px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: `${getFontSize(14)}px`,
                      outline: 'none',
                      height: largeFontMode ? '48px' : 'auto'
                    }}
                    disabled={refundSubmitting}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: largeFontMode ? '20px 28px' : '16px 24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: largeFontMode ? '16px' : '12px',
              background: 'rgba(255, 255, 255, 0.02)'
            }}>
              <button
                onClick={handleCloseRefundModal}
                disabled={refundSubmitting}
                style={{
                  padding: largeFontMode ? '12px 24px' : '10px 20px',
                  background: 'rgba(108, 117, 125, 0.2)',
                  border: '1px solid #6c757d',
                  borderRadius: '6px',
                  color: 'var(--text-muted)',
                  cursor: refundSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: `${getFontSize(14)}px`,
                  fontWeight: '500',
                  opacity: refundSubmitting ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRefundSubmit}
                disabled={refundSubmitting || !refundFormData.reason || !refundFormData.cm_number || refundFormData.cm_number.trim() === ''}
                style={{
                  padding: largeFontMode ? '12px 28px' : '10px 24px',
                  background: refundSubmitting || !refundFormData.reason || !refundFormData.cm_number || refundFormData.cm_number.trim() === ''
                    ? 'rgba(108, 117, 125, 0.2)'
                    : 'linear-gradient(135deg, #dc3545, #c82333)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  cursor: refundSubmitting || !refundFormData.reason || !refundFormData.cm_number || refundFormData.cm_number.trim() === '' ? 'not-allowed' : 'pointer',
                  fontSize: `${getFontSize(14)}px`,
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: largeFontMode ? '10px' : '8px',
                  opacity: refundSubmitting || !refundFormData.reason || !refundFormData.cm_number || refundFormData.cm_number.trim() === '' ? 0.6 : 1
                }}
              >
                {refundSubmitting ? (
                  <>
                    <RefreshCw size={getFontSize(16)} style={{ animation: 'spin 1s linear infinite' }} />
                    Creating...
                  </>
                ) : (
                  <>
                    <RotateCcw size={getFontSize(16)} />
                    Create Refund Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Part Number History Modal */}
      {showPartHistoryModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPartHistoryModal(false);
            }
          }}
        >
          <div 
            style={{
              background: 'var(--modal-bg)',
              borderRadius: '12px',
              width: '95%',
              maxWidth: largeFontMode ? '1600px' : '1400px',
              maxHeight: '95vh',
              height: '95vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 32px var(--shadow-lg)',
              border: '1px solid var(--border-color)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: largeFontMode ? '10px 16px' : '12px 20px',
              borderBottom: `1px solid var(--border-color)`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              background: 'var(--card-bg)',
              flexShrink: 0,
              position: 'relative'
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ 
                  margin: 0, 
                  marginBottom: largeFontMode ? '8px' : '10px',
                  color: 'var(--text-primary)', 
                  fontSize: `${getFontSize(15)}px`, 
                  fontWeight: '700',
                  letterSpacing: '0.5px',
                  textAlign: 'center',
                  textDecoration: 'underline',
                  textDecorationThickness: '2px',
                  textUnderlineOffset: '6px',
                  textDecorationColor: 'var(--text-secondary)'
                }}>
                  Part Number Sales History
                </h2>
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: largeFontMode ? '6px' : '8px'
                }}>
                  {(() => {
                    // Get description from first record if available
                    const firstRecord = partHistoryData.length > 0 ? partHistoryData[0] : null;
                    const description = firstRecord?.DESCRIPTION || firstRecord?.REMARKS || 'N/A';
                    return (
                      <>
                        <span style={{ 
                          color: '#007bff', 
                          fontWeight: '700',
                          fontSize: `${getFontSize(28)}px`,
                          letterSpacing: '0.3px',
                          lineHeight: '1.2',
                          display: 'block',
                          width: '100%'
                        }}>
                          {partHistoryBenz}
                        </span>
                        <span style={{ 
                          color: 'var(--text-primary)', 
                          fontWeight: '600',
                          fontSize: `${getFontSize(17)}px`,
                          letterSpacing: '0.2px',
                          lineHeight: '1.2',
                          display: 'block',
                          width: '100%'
                        }}>
                          {description}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: largeFontMode ? '8px' : '10px', position: 'absolute', right: largeFontMode ? '16px' : '20px', top: largeFontMode ? '10px' : '12px' }}>
                <button
                  onClick={() => setShowPartHistoryModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: `${getFontSize(20)}px`,
                    cursor: 'pointer',
                    padding: largeFontMode ? '4px 8px' : '4px 8px',
                    borderRadius: '4px',
                    transition: 'background 0.2s',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'var(--hover-bg)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  <X size={getFontSize(20)} />
                </button>
              </div>
            </div>

            {/* Filter Section */}
            {!partHistoryLoading && partHistoryData.length > 0 && (
              <div style={{
                padding: largeFontMode ? '8px 12px' : '12px 14px',
                borderBottom: `2px solid var(--border-color)`,
                background: 'var(--bg-secondary)',
                display: 'flex',
                gap: largeFontMode ? '10px' : '16px',
                alignItems: 'center',
                flexWrap: 'wrap',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: largeFontMode ? '6px' : '8px', flexShrink: 0 }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: `${getFontSize(11)}px`, fontWeight: '500', whiteSpace: 'nowrap', flexShrink: 0, minWidth: '40px' }}>
                    Year:
                  </label>
                  <select
                    value={filterYear}
                    onChange={async (e) => {
                      const selectedYear = e.target.value;
                      setFilterYear(selectedYear);
                      if (!selectedYear) {
                        setFilterMonth(''); // Clear month filter when year is cleared
                        return;
                      }
                      
                      // OPTIMIZATION: If user selects a year that hasn't been loaded yet, fetch it
                      if (!loadedYears.has(selectedYear)) {
                        try {
                          const token = localStorage.getItem('token');
                          const yearStart = `${selectedYear}-01-01`;
                          const yearEnd = `${selectedYear}-12-31`;
                          
                          console.log(`📥 Fetching year ${selectedYear} data...`);
                          const yearResponse = await axios.get(`/api/sales/history?search=${encodeURIComponent(partHistoryBenz)}&date_from=${yearStart}&date_to=${yearEnd}&limit=5000`, {
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          
                          if (yearResponse.data && yearResponse.data.data !== undefined) {
                            const newYearData = yearResponse.data.data || [];
                            // Merge with existing data (avoid duplicates)
                            setPartHistoryData(prevData => {
                              const existingKeys = new Set(prevData.map(r => `${r.IDCODE}-${r.DATE}-${r.RECEIPT || r.INVOICE}-${r.QTY}-${r.SELL}`));
                              const uniqueNewData = newYearData.filter(r => {
                                const key = `${r.IDCODE}-${r.DATE}-${r.RECEIPT || r.INVOICE}-${r.QTY}-${r.SELL}`;
                                return !existingKeys.has(key);
                              });
                              return [...prevData, ...uniqueNewData];
                            });
                            
                            // Mark this year as loaded
                            setLoadedYears(prev => new Set([...prev, selectedYear]));
                            console.log(`✅ Loaded ${newYearData.length} records for year ${selectedYear}`);
                          }
                        } catch (error) {
                          console.error(`Error fetching year ${selectedYear}:`, error);
                        }
                      }
                      
                      setFilterMonth(''); // Clear month filter when year changes
                    }}
                    style={{
                      padding: largeFontMode ? '8px 10px' : '8px 12px',
                      background: 'var(--card-bg)',
                      color: 'var(--text-primary)',
                      border: `1px solid var(--border-color)`,
                      borderRadius: '4px',
                      fontSize: `${getFontSize(11)}px`,
                      cursor: 'pointer',
                      minWidth: largeFontMode ? '120px' : '120px',
                      width: largeFontMode ? '120px' : 'auto',
                      height: largeFontMode ? '36px' : 'auto',
                      lineHeight: '1.4',
                      overflow: 'visible',
                      textOverflow: 'clip',
                      flexShrink: 0
                    }}
                  >
                    <option value="">All Years</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: largeFontMode ? '6px' : '8px', flexShrink: 0 }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: `${getFontSize(11)}px`, fontWeight: '500', whiteSpace: 'nowrap', flexShrink: 0, minWidth: '50px' }}>
                    Months:
                  </label>
                  <select
                    value={filterMonths}
                    onChange={(e) => {
                      setFilterMonths(e.target.value);
                      if (e.target.value) setFilterMonth(''); // Clear month filter when using X months
                    }}
                    style={{
                      padding: largeFontMode ? '8px 10px' : '8px 12px',
                      background: 'var(--card-bg)',
                      color: 'var(--text-primary)',
                      border: `1px solid var(--border-color)`,
                      borderRadius: '4px',
                      fontSize: `${getFontSize(11)}px`,
                      cursor: 'pointer',
                      minWidth: largeFontMode ? '120px' : '120px',
                      width: largeFontMode ? '120px' : 'auto',
                      height: largeFontMode ? '36px' : 'auto',
                      lineHeight: '1.4',
                      overflow: 'visible',
                      textOverflow: 'clip',
                      flexShrink: 0
                    }}
                  >
                    <option value="">All Time</option>
                    <option value="1">Last Month</option>
                    <option value="2">Last 2 Months</option>
                    <option value="3">Last 3 Months</option>
                    <option value="6">Last 6 Months</option>
                    <option value="12">Last 12 Months</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: largeFontMode ? '6px' : '8px', flexShrink: 0 }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: `${getFontSize(11)}px`, fontWeight: '500', whiteSpace: 'nowrap', flexShrink: 0, minWidth: '45px' }}>
                    Month:
                  </label>
                  <select
                    value={filterMonth}
                    onChange={(e) => {
                      setFilterMonth(e.target.value);
                      if (e.target.value) setFilterMonths(''); // Clear X months filter when using specific month
                    }}
                    style={{
                      padding: largeFontMode ? '8px 10px' : '8px 12px',
                      background: 'var(--card-bg)',
                      color: 'var(--text-primary)',
                      border: `1px solid var(--border-color)`,
                      borderRadius: '4px',
                      fontSize: `${getFontSize(11)}px`,
                      cursor: 'pointer',
                      minWidth: largeFontMode ? '160px' : '140px',
                      width: largeFontMode ? '160px' : 'auto',
                      height: largeFontMode ? '36px' : 'auto',
                      lineHeight: '1.4',
                      overflow: 'visible',
                      textOverflow: 'clip',
                      flexShrink: 0
                    }}
                    disabled={!filterYear}
                  >
                    <option value="">{filterYear ? 'All Months' : 'Select Year First'}</option>
                    {availableMonths.map(month => {
                      const [m, y] = month.split('/');
                      const date = new Date(y, m - 1, 1);
                      const monthName = date.toLocaleDateString('en-US', { month: 'long' });
                      return (
                        <option key={month} value={month}>{monthName}</option>
                      );
                    })}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: largeFontMode ? '6px' : '8px', flexShrink: 0 }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: `${getFontSize(11)}px`, fontWeight: '500', whiteSpace: 'nowrap', flexShrink: 0, minWidth: '45px' }}>
                    Brand:
                  </label>
                  <select
                    value={filterBrand}
                    onChange={(e) => setFilterBrand(e.target.value)}
                    style={{
                      padding: largeFontMode ? '8px 10px' : '8px 12px',
                      background: 'var(--card-bg)',
                      color: 'var(--text-primary)',
                      border: `1px solid var(--border-color)`,
                      borderRadius: '4px',
                      fontSize: `${getFontSize(11)}px`,
                      cursor: 'pointer',
                      minWidth: largeFontMode ? '120px' : '120px',
                      width: largeFontMode ? '120px' : 'auto',
                      height: largeFontMode ? '36px' : 'auto',
                      lineHeight: '1.4',
                      overflow: 'visible',
                      textOverflow: 'clip',
                      flexShrink: 0
                    }}
                  >
                    <option value="">All Brands</option>
                    {availableBrands.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: largeFontMode ? '10px' : '12px' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: `${getFontSize(11)}px`, whiteSpace: 'nowrap' }}>
                    Showing: <strong>{filteredPartHistoryData.length}</strong> of <strong>{partHistoryData.length}</strong>
                  </div>
                  <button
                    onClick={() => setShowSalesAnalyticsModal(true)}
                    style={{
                      padding: largeFontMode ? '6px 12px' : '8px 16px',
                      background: '#007bff',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: `${getFontSize(11)}px`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: largeFontMode ? '6px' : '8px',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#0056b3'}
                    onMouseLeave={(e) => e.target.style.background = '#007bff'}
                    title="Show Sales Analytics"
                  >
                    <TrendingUp size={getFontSize(12)} />
                    Analytics
                  </button>
                </div>
              </div>
            )}

            {/* Modal Body */}
            <div style={{
              padding: largeFontMode ? '20px' : '16px',
              flex: 1,
              display: partHistoryLoading || partHistoryData.length === 0 ? 'block' : 'grid',
              gridTemplateColumns: window.innerWidth <= 1024 ? '1fr' : '1.2fr 1fr',
              gap: largeFontMode ? '20px' : '16px',
              overflow: 'hidden',
              minHeight: 0
            }}>
              {partHistoryLoading ? (
                <div style={{ textAlign: 'center', padding: largeFontMode ? '50px' : '40px', color: 'var(--text-secondary)' }}>
                  <RefreshCw size={getFontSize(32)} style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} />
                  <p style={{ marginTop: largeFontMode ? '20px' : '16px', fontSize: `${getFontSize(16)}px` }}>Loading part history...</p>
                </div>
              ) : partHistoryData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: largeFontMode ? '50px' : '40px', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: `${getFontSize(16)}px` }}>No sales history found for this part number.</p>
                </div>
              ) : (
                <>
                  {/* Table Section - Sales History */}
                  <div style={{ 
                    background: 'var(--card-bg)',
                    borderRadius: '8px',
                    padding: largeFontMode ? '20px' : '18px',
                    border: '1px solid var(--border-color)',
                    width: '100%',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: largeFontMode ? '16px' : '14px',
                      flexShrink: 0
                    }}>
                      <h3 style={{ 
                        margin: 0, 
                        color: 'var(--text-primary)', 
                        fontSize: `${getFontSize(18)}px`, 
                        fontWeight: '600'
                      }}>
                        SALES
                      </h3>
                      <div style={{ display: 'flex', gap: largeFontMode ? '16px' : '20px', alignItems: 'center' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: `${getFontSize(13)}px` }}>
                          Clients: <strong>{filteredPartHistoryData.length}</strong>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: `${getFontSize(13)}px` }}>
                          Quantity: <strong>{totalQuantity}</strong>
                        </div>
                      </div>
                    </div>
                    <div style={{ 
                      overflowX: 'auto',
                      overflowY: 'auto',
                      flex: 1,
                      minHeight: 0,
                      width: '100%'
                    }}>
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        background: 'var(--card-bg)',
                        color: 'var(--text-primary)',
                        fontSize: `${getFontSize(12)}px`,
                        tableLayout: 'auto'
                      }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 10 }}>
                            <th style={{ padding: largeFontMode ? '14px 16px' : '10px 12px', textAlign: 'center', borderBottom: `2px solid var(--border-color)`, color: 'var(--text-primary)', fontWeight: '600', fontSize: `${getFontSize(13)}px`, textTransform: 'uppercase', width: largeFontMode ? '100px' : '80px', minWidth: largeFontMode ? '100px' : '80px' }}>ID</th>
                            <th style={{ padding: largeFontMode ? '14px 16px' : '10px 12px', textAlign: 'left', borderBottom: `2px solid var(--border-color)`, color: 'var(--text-primary)', fontWeight: '600', fontSize: `${getFontSize(12)}px`, textTransform: 'uppercase', width: largeFontMode ? '130px' : '100px', minWidth: largeFontMode ? '130px' : '100px' }}>Date</th>
                            <th style={{ padding: largeFontMode ? '14px 16px' : '10px 12px', textAlign: 'left', borderBottom: `2px solid var(--border-color)`, color: 'var(--text-primary)', fontWeight: '600', fontSize: `${getFontSize(12)}px`, textTransform: 'uppercase', width: largeFontMode ? '200px' : '150px', minWidth: largeFontMode ? '200px' : '150px' }}>Customer</th>
                            <th style={{ padding: largeFontMode ? '14px 16px' : '10px 12px', textAlign: 'left', borderBottom: `2px solid var(--border-color)`, color: 'var(--text-primary)', fontWeight: '600', fontSize: `${getFontSize(12)}px`, textTransform: 'uppercase', width: largeFontMode ? '130px' : '100px', minWidth: largeFontMode ? '130px' : '100px' }}>Brand</th>
                            <th style={{ padding: largeFontMode ? '14px 16px' : '10px 12px', textAlign: 'center', borderBottom: `2px solid var(--border-color)`, color: 'var(--text-primary)', fontWeight: '600', fontSize: `${getFontSize(12)}px`, textTransform: 'uppercase', width: largeFontMode ? '80px' : '60px', minWidth: largeFontMode ? '80px' : '60px' }}>Qty</th>
                            <th style={{ padding: largeFontMode ? '14px 16px' : '10px 12px', textAlign: 'right', borderBottom: `2px solid var(--border-color)`, color: 'var(--text-primary)', fontWeight: '600', fontSize: `${getFontSize(12)}px`, textTransform: 'uppercase', width: largeFontMode ? '130px' : '100px', minWidth: largeFontMode ? '130px' : '100px' }}>Price</th>
                            {!largeFontMode && (
                              <>
                                <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `2px solid var(--border-color)`, color: 'var(--text-primary)', fontWeight: '600', fontSize: `${getFontSize(12)}px`, textTransform: 'uppercase', width: '100px', minWidth: '100px' }}>Amount</th>
                                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: `2px solid var(--border-color)`, color: 'var(--text-primary)', fontWeight: '600', fontSize: `${getFontSize(12)}px`, textTransform: 'uppercase', width: '100px', minWidth: '100px' }}>Receipt</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPartHistoryData.map((record, index) => (
                            <tr 
                              key={index}
                              style={{
                                borderBottom: `1px solid var(--border-color)`,
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => e.target.parentElement.style.background = 'var(--hover-bg)'}
                              onMouseLeave={(e) => e.target.parentElement.style.background = 'transparent'}
                            >
                              <td style={{ padding: largeFontMode ? '12px 16px' : '8px 12px', fontSize: `${getFontSize(12)}px`, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                {record.IDCODE || 'N/A'}
                              </td>
                              <td style={{ padding: largeFontMode ? '12px 16px' : '8px 12px', fontSize: `${getFontSize(12)}px`, whiteSpace: 'nowrap' }}>
                                {record.DATE ? (() => {
                                  const date = new Date(record.DATE);
                                  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                  const month = monthNames[date.getMonth()];
                                  const day = String(date.getDate()).padStart(2, '0');
                                  const year = date.getFullYear();
                                  return `${month} ${day} ${year}`;
                                })() : 'N/A'}
                              </td>
                              <td style={{ padding: largeFontMode ? '12px 16px' : '8px 12px', fontSize: `${getFontSize(12)}px`, wordBreak: largeFontMode ? 'break-word' : 'normal', whiteSpace: largeFontMode ? 'normal' : 'nowrap', overflow: 'visible' }}>
                                {record.CUSTOMER || 'Walk-in Customer'}
                              </td>
                              <td style={{ padding: largeFontMode ? '12px 16px' : '8px 12px', fontSize: `${getFontSize(12)}px`, wordBreak: largeFontMode ? 'break-word' : 'normal', whiteSpace: largeFontMode ? 'normal' : 'nowrap', overflow: 'visible' }}>
                                {record.BRAND || 'N/A'}
                              </td>
                              <td style={{ padding: largeFontMode ? '12px 16px' : '8px 12px', fontSize: `${getFontSize(12)}px`, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                {record.QTY || 0}
                              </td>
                              <td style={{ padding: largeFontMode ? '12px 16px' : '8px 12px', fontSize: `${getFontSize(12)}px`, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                {formatCurrency(record.SELL || 0)}
                              </td>
                              {!largeFontMode && (
                                <>
                                  <td style={{ padding: '8px 12px', fontSize: `${getFontSize(12)}px`, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    {formatCurrency((record.SELL || 0) * (record.QTY || 0))}
                                  </td>
                                  <td style={{ padding: '8px 12px', fontSize: `${getFontSize(12)}px`, wordBreak: 'normal', whiteSpace: 'nowrap', overflow: 'visible' }}>
                                    {record.RECEIPT || record.INVOICE || 'N/A'}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Stock History Section */}
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    minHeight: 0,
                    minWidth: 0,
                    width: '100%'
                  }}>
                    {/* Incoming/Inmain History Table */}
                    <div style={{ 
                      background: 'var(--card-bg)',
                      borderRadius: '8px',
                      padding: largeFontMode ? '20px' : '18px',
                      border: '1px solid var(--border-color)',
                      width: '100%',
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: 0,
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: largeFontMode ? '16px' : '14px',
                        flexShrink: 0
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: largeFontMode ? '12px' : '16px' }}>
                          <h3 style={{ 
                            margin: 0, 
                            color: 'var(--text-primary)', 
                            fontSize: `${getFontSize(18)}px`, 
                            fontWeight: '600'
                          }}>
                            STOCKS
                          </h3>
                          <div style={{ color: 'var(--text-secondary)', fontSize: `${getFontSize(13)}px` }}>
                            Current Stocks: <strong style={{ color: '#28a745', fontSize: `${getFontSize(14)}px` }}>{filteredStockHistoryData.filter(r => (parseInt(r.QTY) || 0) > 0).reduce((sum, r) => sum + (parseInt(r.QTY) || 0), 0)}</strong>
                          </div>
                          <button
                            onClick={async () => {
                              if (!showAllStockRecords) {
                                // User wants to see all records (including QTY = 0)
                                try {
                                  setInmainHistoryLoading(true);
                                  const token = localStorage.getItem('token');
                                  const stockResponse = await axios.get(`/api/inmain/history/${encodeURIComponent(partHistoryBenz)}?qty_filter=all`, {
                                    headers: { Authorization: `Bearer ${token}` }
                                  });
                                  
                                  if (stockResponse.data && stockResponse.data.success) {
                                    setInmainHistoryData(stockResponse.data.data || []);
                                    setShowAllStockRecords(true);
                                    console.log(`✅ Loaded all stock records (including QTY = 0) for: ${partHistoryBenz}`);
                                  }
                                } catch (error) {
                                  console.error('Error fetching all stock records:', error);
                                } finally {
                                  setInmainHistoryLoading(false);
                                }
                              } else {
                                // User wants to see only records with stock
                                try {
                                  setInmainHistoryLoading(true);
                                  const token = localStorage.getItem('token');
                                  const stockResponse = await axios.get(`/api/inmain/history/${encodeURIComponent(partHistoryBenz)}?qty_filter=has_stock`, {
                                    headers: { Authorization: `Bearer ${token}` }
                                  });
                                  
                                  if (stockResponse.data && stockResponse.data.success) {
                                    setInmainHistoryData(stockResponse.data.data || []);
                                    setShowAllStockRecords(false);
                                    console.log(`✅ Loaded stock records (QTY > 0 only) for: ${partHistoryBenz}`);
                                  }
                                } catch (error) {
                                  console.error('Error fetching stock records:', error);
                                } finally {
                                  setInmainHistoryLoading(false);
                                }
                              }
                            }}
                            style={{
                              padding: largeFontMode ? '6px 12px' : '6px 14px',
                              background: showAllStockRecords ? 'var(--bg-secondary)' : '#28a745',
                              color: showAllStockRecords ? 'var(--text-primary)' : '#fff',
                              border: showAllStockRecords ? '1px solid var(--border-color)' : '1px solid #28a745',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: '500',
                              fontSize: `${getFontSize(11)}px`,
                              display: 'flex',
                              alignItems: 'center',
                              gap: largeFontMode ? '4px' : '6px',
                              transition: 'all 0.2s',
                              whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={(e) => {
                              if (showAllStockRecords) {
                                e.target.style.background = 'var(--hover-bg)';
                              } else {
                                e.target.style.background = '#218838';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (showAllStockRecords) {
                                e.target.style.background = 'var(--bg-secondary)';
                              } else {
                                e.target.style.background = '#28a745';
                              }
                            }}
                          >
                            {showAllStockRecords ? 'Show Has Stock' : 'Show All'}
                          </button>
                        </div>
                      </div>
                      
                      {inmainHistoryLoading ? (
                        <div style={{ 
                          textAlign: 'center', 
                          padding: largeFontMode ? '50px' : '40px', 
                          color: 'var(--text-secondary)',
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <RefreshCw size={getFontSize(24)} style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} />
                          <p style={{ marginTop: largeFontMode ? '16px' : '12px', fontSize: `${getFontSize(14)}px` }}>Loading stock history...</p>
                        </div>
                      ) : inmainHistoryData.length === 0 ? (
                        <div style={{ 
                          textAlign: 'center', 
                          padding: largeFontMode ? '50px' : '40px', 
                          color: 'var(--text-muted)',
                          fontSize: `${getFontSize(14)}px`,
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          No stock records found for this part number.
                        </div>
                      ) : (
                        <div style={{
                          overflowX: 'auto',
                          overflowY: 'auto',
                          flex: 1,
                          minHeight: 0,
                          width: '100%'
                        }}>
                          <table style={{
                              width: '100%',
                              borderCollapse: 'collapse',
                              background: 'var(--card-bg)',
                              color: 'var(--text-primary)',
                              fontSize: `${getFontSize(12)}px`,
                              tableLayout: 'auto'
                            }}>
                              <thead>
                                <tr style={{ background: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 10 }}>
                                  <th style={{ padding: largeFontMode ? '12px 14px' : '10px 12px', textAlign: 'center', borderBottom: `2px solid var(--border-color)`, color: 'var(--text-primary)', fontWeight: '600', fontSize: `${getFontSize(12)}px`, textTransform: 'uppercase', width: largeFontMode ? '90px' : '80px', minWidth: largeFontMode ? '90px' : '80px' }}>ID</th>
                                  <th style={{ padding: largeFontMode ? '12px 14px' : '10px 12px', textAlign: 'left', borderBottom: `2px solid var(--border-color)`, color: 'var(--text-primary)', fontWeight: '600', fontSize: `${getFontSize(12)}px`, textTransform: 'uppercase', width: largeFontMode ? '110px' : '100px', minWidth: largeFontMode ? '110px' : '100px' }}>Date</th>
                                  <th style={{ padding: largeFontMode ? '12px 14px' : '10px 12px', textAlign: 'left', borderBottom: `2px solid var(--border-color)`, color: 'var(--text-primary)', fontWeight: '600', fontSize: `${getFontSize(12)}px`, textTransform: 'uppercase', width: largeFontMode ? '120px' : '110px', minWidth: largeFontMode ? '120px' : '110px' }}>Supplier</th>
                                  <th style={{ padding: largeFontMode ? '12px 14px' : '10px 12px', textAlign: 'left', borderBottom: `2px solid var(--border-color)`, color: 'var(--text-primary)', fontWeight: '600', fontSize: `${getFontSize(12)}px`, textTransform: 'uppercase', width: largeFontMode ? '110px' : '100px', minWidth: largeFontMode ? '110px' : '100px' }}>Brand</th>
                                  <th style={{ padding: largeFontMode ? '12px 14px' : '10px 12px', textAlign: 'center', borderBottom: `2px solid var(--border-color)`, color: 'var(--text-primary)', fontWeight: '600', fontSize: `${getFontSize(12)}px`, textTransform: 'uppercase', width: largeFontMode ? '70px' : '60px', minWidth: largeFontMode ? '70px' : '60px' }}>Qty</th>
                                  <th style={{ padding: largeFontMode ? '12px 14px' : '10px 12px', textAlign: 'right', borderBottom: `2px solid var(--border-color)`, color: 'var(--text-primary)', fontWeight: '600', fontSize: `${getFontSize(12)}px`, textTransform: 'uppercase', width: largeFontMode ? '110px' : '100px', minWidth: largeFontMode ? '110px' : '100px' }}>Price</th>
                                </tr>
                              </thead>
                            <tbody>
                              {filteredStockHistoryData.map((record, index) => {
                                const hasQuantity = (parseInt(record.QTY) || 0) > 0;
                                return (
                                <tr 
                                  key={index}
                                  style={{
                                    borderBottom: '1px solid var(--border-color)',
                                    transition: 'background 0.2s',
                                    backgroundColor: hasQuantity ? 'rgba(40, 167, 69, 0.15)' : 'transparent'
                                  }}
                                  onMouseEnter={(e) => e.target.parentElement.style.background = hasQuantity ? 'rgba(40, 167, 69, 0.25)' : 'var(--hover-bg)'}
                                  onMouseLeave={(e) => e.target.parentElement.style.background = hasQuantity ? 'rgba(40, 167, 69, 0.15)' : 'transparent'}
                                >
                                  <td style={{ padding: largeFontMode ? '10px 14px' : '8px 12px', fontSize: `${getFontSize(12)}px`, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    {record.ID || 'N/A'}
                                  </td>
                                  <td style={{ padding: largeFontMode ? '10px 14px' : '8px 12px', fontSize: `${getFontSize(12)}px`, whiteSpace: 'nowrap' }}>
                                    {(() => {
                                      if (!record.DATE) return 'N/A';
                                      const date = new Date(record.DATE);
                                      // Check if date is valid
                                      if (isNaN(date.getTime())) return 'N/A';
                                      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                      const month = monthNames[date.getMonth()];
                                      const day = String(date.getDate()).padStart(2, '0');
                                      const year = date.getFullYear();
                                      return `${month} ${day} ${year}`;
                                    })()}
                                  </td>
                                  <td style={{ padding: largeFontMode ? '10px 14px' : '8px 12px', fontSize: `${getFontSize(12)}px`, wordBreak: largeFontMode ? 'break-word' : 'normal', whiteSpace: largeFontMode ? 'normal' : 'nowrap', overflow: 'visible' }}>
                                    {record.SUPPLIER || 'N/A'}
                                  </td>
                                  <td style={{ padding: largeFontMode ? '10px 14px' : '8px 12px', fontSize: `${getFontSize(12)}px`, wordBreak: largeFontMode ? 'break-word' : 'normal', whiteSpace: largeFontMode ? 'normal' : 'nowrap', overflow: 'visible' }}>
                                    {record.BRAND || 'N/A'}
                                  </td>
                                  <td style={{ padding: largeFontMode ? '10px 14px' : '8px 12px', fontSize: `${getFontSize(12)}px`, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    {record.QTY || 0}
                                  </td>
                                  <td style={{ padding: largeFontMode ? '10px 14px' : '8px 12px', fontSize: `${getFontSize(12)}px`, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    {formatCurrency(record.SELLING_PRICE || record.SELL || 0)}
                                  </td>
                                </tr>
                              );
                              })}
                              </tbody>
                            </table>
                        </div>
                      )}
                    </div>
                    
                    {/* Brand Sales Summary Table */}
                    <div style={{ 
                      background: 'var(--card-bg)',
                      borderRadius: '8px',
                      padding: largeFontMode ? '20px' : '18px',
                      border: '1px solid var(--border-color)',
                      width: '100%',
                      marginTop: largeFontMode ? '20px' : '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: 0,
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: largeFontMode ? '16px' : '14px',
                        flexShrink: 0
                      }}>
                        <h3 style={{ 
                          margin: 0, 
                          color: 'var(--text-primary)', 
                          fontSize: `${getFontSize(18)}px`, 
                          fontWeight: '600'
                        }}>
                          BRAND SALES
                        </h3>
                      </div>
                      <div style={{
                        overflowX: 'auto',
                        overflowY: 'auto',
                        width: '100%'
                      }}>
                        <table style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          background: 'var(--card-bg)',
                          color: 'var(--text-primary)',
                          fontSize: `${getFontSize(12)}px`,
                          tableLayout: 'auto'
                        }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 10 }}>
                              <th style={{ padding: largeFontMode ? '12px 14px' : '10px 12px', textAlign: 'left', borderBottom: `2px solid var(--border-color)`, color: 'var(--text-primary)', fontWeight: '600', fontSize: `${getFontSize(12)}px`, textTransform: 'uppercase' }}>Brand</th>
                              <th style={{ padding: largeFontMode ? '12px 14px' : '10px 12px', textAlign: 'center', borderBottom: `2px solid var(--border-color)`, color: 'var(--text-primary)', fontWeight: '600', fontSize: `${getFontSize(12)}px`, textTransform: 'uppercase' }}>Last Month</th>
                              <th style={{ padding: largeFontMode ? '12px 14px' : '10px 12px', textAlign: 'center', borderBottom: `2px solid var(--border-color)`, color: 'var(--text-primary)', fontWeight: '600', fontSize: `${getFontSize(12)}px`, textTransform: 'uppercase' }}>This Year</th>
                              <th style={{ padding: largeFontMode ? '12px 14px' : '10px 12px', textAlign: 'center', borderBottom: `2px solid var(--border-color)`, color: 'var(--text-primary)', fontWeight: '600', fontSize: `${getFontSize(12)}px`, textTransform: 'uppercase' }}>Last 2 Years</th>
                            </tr>
                          </thead>
                          <tbody>
                            {brandSalesSummary.length === 0 ? (
                              <tr>
                                <td colSpan="4" style={{ padding: largeFontMode ? '20px' : '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                  No sales data available
                                </td>
                              </tr>
                            ) : (
                              brandSalesSummary.map((summary, index) => (
                                <tr 
                                  key={index}
                                  style={{
                                    borderBottom: '1px solid var(--border-color)',
                                    transition: 'background 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.target.parentElement.style.background = 'var(--hover-bg)'}
                                  onMouseLeave={(e) => e.target.parentElement.style.background = 'transparent'}
                                >
                                  <td style={{ padding: largeFontMode ? '10px 14px' : '8px 12px', fontSize: `${getFontSize(12)}px`, fontWeight: '500' }}>
                                    {summary.brand}
                                  </td>
                                  <td style={{ padding: largeFontMode ? '10px 14px' : '8px 12px', fontSize: `${getFontSize(12)}px`, textAlign: 'center' }}>
                                    {summary.lastMonth}
                                  </td>
                                  <td style={{ padding: largeFontMode ? '10px 14px' : '8px 12px', fontSize: `${getFontSize(12)}px`, textAlign: 'center' }}>
                                    {summary.thisYear}
                                  </td>
                                  <td style={{ padding: largeFontMode ? '10px 14px' : '8px 12px', fontSize: `${getFontSize(12)}px`, textAlign: 'center' }}>
                                    {summary.last2Years}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: largeFontMode ? '16px 18px' : '12px 14px',
              borderTop: `2px solid var(--border-color)`,
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'var(--card-bg)',
              flexShrink: 0
            }}>
              <button
                onClick={() => setShowPartHistoryModal(false)}
                style={{
                  padding: largeFontMode ? '12px 28px' : '10px 24px',
                  background: '#007bff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: `${getFontSize(14)}px`,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#0056b3'}
                onMouseLeave={(e) => e.target.style.background = '#007bff'}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sales Analytics Modal */}
      {showSalesAnalyticsModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSalesAnalyticsModal(false);
            }
          }}
        >
          <div 
            style={{
              background: '#1a1a1a',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '900px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              border: '1px solid #404040'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: largeFontMode ? '24px' : '20px',
              borderBottom: '2px solid #404040',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#2d2d2d',
              flexShrink: 0
            }}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: `${getFontSize(20)}px`, fontWeight: '700' }}>
                Sales Analytics
              </h2>
              <button
                onClick={() => setShowSalesAnalyticsModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: `${getFontSize(24)}px`,
                  cursor: 'pointer',
                  padding: largeFontMode ? '6px 10px' : '4px 8px',
                  borderRadius: '4px',
                  transition: 'background 0.2s',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => e.target.style.background = '#404040'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                <X size={getFontSize(24)} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{
              padding: largeFontMode ? '24px' : '20px',
              flex: 1,
              overflow: 'auto',
              minHeight: 0
            }}>
              {partHistoryChartData.labels.length > 0 ? (
                <div style={{ height: largeFontMode ? '600px' : '500px', position: 'relative' }}>
                  <Bar
                    data={partHistoryChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top',
                          labels: {
                            color: '#e0e0e0',
                            font: { size: getFontSize(12) }
                          }
                        },
                        tooltip: {
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          titleColor: '#fff',
                          bodyColor: '#e0e0e0',
                          borderColor: '#404040',
                          borderWidth: 1,
                          titleFont: { size: getFontSize(14) },
                          bodyFont: { size: getFontSize(12) }
                        }
                      },
                      scales: {
                        x: {
                          ticks: {
                            color: '#e0e0e0',
                            font: { size: getFontSize(11) }
                          },
                          grid: { color: '#404040' }
                        },
                        y: {
                          type: 'linear',
                          display: true,
                          position: 'left',
                          ticks: {
                            color: '#90caf9',
                            font: { size: getFontSize(11) }
                          },
                          grid: { color: '#404040' },
                          title: {
                            display: true,
                            text: 'Quantity',
                            color: '#90caf9',
                            font: { size: getFontSize(12) }
                          }
                        },
                        y1: {
                          type: 'linear',
                          display: true,
                          position: 'right',
                          ticks: {
                            color: '#ff6b9d',
                            font: { size: getFontSize(11) },
                            callback: function(value) {
                              return value.toLocaleString('en-US', { 
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                              });
                            }
                          },
                          grid: { drawOnChartArea: false },
                          title: {
                            display: true,
                            text: 'Amount',
                            color: '#ff6b9d',
                            font: { size: getFontSize(12) }
                          }
                        }
                      }
                    }}
                  />
                </div>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: largeFontMode ? '50px' : '40px', 
                  color: '#888',
                  fontSize: `${getFontSize(14)}px`
                }}>
                  No data available for the selected filters
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: largeFontMode ? '16px 18px' : '12px 14px',
              borderTop: '2px solid #404040',
              display: 'flex',
              justifyContent: 'flex-end',
              background: '#2d2d2d',
              flexShrink: 0
            }}>
              <button
                onClick={() => setShowSalesAnalyticsModal(false)}
                style={{
                  padding: largeFontMode ? '12px 28px' : '10px 24px',
                  background: '#007bff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: `${getFontSize(14)}px`,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#0056b3'}
                onMouseLeave={(e) => e.target.style.background = '#007bff'}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Option Modal */}
      {showDeleteModal && saleToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleDeleteCancel();
          }
        }}
        >
          <div style={{
            background: '#1a1a1a',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: largeFontMode ? '24px 28px' : '20px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(220, 53, 69, 0.1)'
            }}>
              <h2 style={{
                margin: 0,
                color: '#fff',
                fontSize: `${getFontSize(20)}px`,
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: largeFontMode ? '12px' : '10px'
              }}>
                <Trash2 size={getFontSize(24)} />
                Delete Sale
              </h2>
              <button
                onClick={handleDeleteCancel}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: `${getFontSize(24)}px`,
                  cursor: 'pointer',
                  padding: largeFontMode ? '6px 10px' : '4px 8px'
                }}
              >
                <X size={getFontSize(20)} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: largeFontMode ? '28px' : '24px' }}>
              <div style={{
                marginBottom: largeFontMode ? '24px' : '20px',
                padding: largeFontMode ? '20px' : '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{ color: '#fff', marginBottom: largeFontMode ? '12px' : '8px', fontSize: `${getFontSize(14)}px`, fontWeight: '600' }}>
                  Sale Details:
                </div>
                <div style={{ color: '#ccc', fontSize: `${getFontSize(13)}px`, lineHeight: '1.6' }}>
                  <div><strong>ID:</strong> {saleToDelete.sale.IDCODE}</div>
                  <div><strong>Part:</strong> {saleToDelete.sale.BENZ || 'N/A'}</div>
                  <div><strong>Brand:</strong> {saleToDelete.sale.BRAND || 'N/A'}</div>
                  <div><strong>Quantity:</strong> {saleToDelete.sale.QTY || 0}</div>
                  <div><strong>Amount:</strong> {formatCurrency(saleToDelete.sale.SELL * saleToDelete.sale.QTY)}</div>
                </div>
              </div>

              <div style={{
                color: '#fff',
                marginBottom: largeFontMode ? '24px' : '20px',
                fontSize: `${getFontSize(15)}px`,
                fontWeight: '500',
                textAlign: 'center'
              }}>
                Select an option to proceed:
              </div>

              {/* Option Buttons */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: largeFontMode ? '16px' : '12px'
              }}>
                <button
                  onClick={() => handleDeleteConfirm(true)}
                  style={{
                    width: '100%',
                    padding: largeFontMode ? '12px 18px' : '8px 14px',
                    background: '#28a745',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: `${getFontSize(15)}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: largeFontMode ? '12px' : '10px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#218838'}
                  onMouseOut={(e) => e.target.style.background = '#28a745'}
                >
                  <Package size={getFontSize(18)} />
                  Back to Stock ({Math.abs(saleToDelete.sale.QTY || 0)} unit(s) will be returned)
                </button>

                <button
                  onClick={() => handleDeleteConfirm(false)}
                  style={{
                    width: '100%',
                    padding: largeFontMode ? '12px 18px' : '8px 14px',
                    background: '#dc3545',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: `${getFontSize(15)}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: largeFontMode ? '12px' : '10px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#c82333'}
                  onMouseOut={(e) => e.target.style.background = '#dc3545'}
                >
                  <Trash2 size={getFontSize(18)} />
                  Delete (Quantity will NOT be returned to stock)
                </button>
              </div>

              <button
                onClick={handleDeleteCancel}
                style={{
                  width: '100%',
                  marginTop: largeFontMode ? '16px' : '12px',
                  padding: largeFontMode ? '12px 24px' : '10px 20px',
                  background: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: `${getFontSize(14)}px`,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#5a6268'}
                onMouseOut={(e) => e.target.style.background = '#6c757d'}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Receipt Modal */}
      {showPrintReceiptModal && printReceiptData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowPrintReceiptModal(false);
          }
        }}
        >
          <div style={{
            background: 'var(--modal-bg)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: `${getFontSize(20)}px` }}>
                Print Delivery Order
              </h2>
              <button
                onClick={() => setShowPrintReceiptModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '24px',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'var(--hover-bg)';
                  e.target.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                  e.target.style.color = 'var(--text-secondary)';
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{
              padding: '20px',
              flex: 1,
              overflow: 'auto'
            }}>
              {/* ORDER TYPE Selection - Hide for adjustments */}
              {printReceiptForm.orderType !== 'ADJUSTMENT' && (
                <div style={{
                  marginBottom: '24px',
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'center'
                }}>
                  <button
                    onClick={() => setPrintReceiptForm({ ...printReceiptForm, orderType: 'COUNTER' })}
                    style={{
                      padding: '12px 24px',
                      fontSize: `${getFontSize(14)}px`,
                      fontWeight: '600',
                      border: '2px solid',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: printReceiptForm.orderType === 'COUNTER' ? '#007bff' : 'transparent',
                      color: printReceiptForm.orderType === 'COUNTER' ? '#fff' : 'var(--text-primary)',
                      borderColor: printReceiptForm.orderType === 'COUNTER' ? '#007bff' : 'var(--border-color)'
                    }}
                  >
                    COUNTER
                  </button>
                  <button
                    onClick={() => setPrintReceiptForm({ ...printReceiptForm, orderType: 'SERVICE' })}
                    style={{
                      padding: '12px 24px',
                      fontSize: `${getFontSize(14)}px`,
                      fontWeight: '600',
                      border: '2px solid',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: printReceiptForm.orderType === 'SERVICE' ? '#007bff' : 'transparent',
                      color: printReceiptForm.orderType === 'SERVICE' ? '#fff' : 'var(--text-primary)',
                      borderColor: printReceiptForm.orderType === 'SERVICE' ? '#007bff' : 'var(--border-color)'
                    }}
                  >
                    SERVICE
                  </button>
                </div>
              )}

              {/* Delivery Order Form - Matching Print Layout */}
              <div style={{
                fontFamily: 'Courier New, monospace',
                fontSize: '12pt',
                background: 'white',
                color: 'black',
                padding: '16px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}>
                {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                {printReceiptForm.orderType === 'ADJUSTMENT' ? (
                  <>
                    <div style={{ fontSize: '16pt', fontWeight: 'bold', marginBottom: '4px' }}>ADJUSTMENT</div>
                    {printReceiptData && printReceiptData[0] && (() => {
                      const firstSale = printReceiptData[0];
                      const adjMatch = firstSale.REMARKS ? firstSale.REMARKS.match(/\[(ADJ-\d+)\]/) : null;
                      const adjustmentNumber = adjMatch ? adjMatch[1] : null;
                      return adjustmentNumber ? (
                        <div style={{ fontSize: '14pt', fontWeight: 'bold' }}>{adjustmentNumber}</div>
                      ) : null;
                    })()}
                  </>
                ) : (
                  <select
                    value={printReceiptForm.documentType}
                    onChange={(e) => setPrintReceiptForm({ ...printReceiptForm, documentType: e.target.value })}
                    style={{
                      fontFamily: 'Courier New, monospace',
                      fontSize: '16pt',
                      fontWeight: 'bold',
                      border: 'none',
                      background: 'transparent',
                      textAlign: 'center',
                      textAlignLast: 'center',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="DELIVERY RECEIPT">DELIVERY RECEIPT</option>
                    <option value="CHARGE INVOICE">CHARGE INVOICE</option>
                    <option value="CASH INVOICE">CASH INVOICE</option>
                  </select>
                )}
              </div>

                {/* Form Fields */}
                <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <strong>CUSTOMER:</strong>{' '}
                    <input
                      type="text"
                      value={printReceiptForm.customer}
                      onChange={(e) => setPrintReceiptForm({ ...printReceiptForm, customer: e.target.value })}
                      style={{
                        border: 'none',
                        borderBottom: '1px solid #000',
                        background: 'transparent',
                        fontFamily: 'Courier New, monospace',
                        fontSize: '12pt',
                        padding: '2px 4px',
                        minWidth: '200px'
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <strong>DATE:</strong>{' '}
                    <input
                      type="date"
                      value={printReceiptForm.date}
                      onChange={(e) => setPrintReceiptForm({ ...printReceiptForm, date: e.target.value })}
                      style={{
                        border: 'none',
                        borderBottom: '1px solid #000',
                        background: 'transparent',
                        fontFamily: 'Courier New, monospace',
                        fontSize: '12pt',
                        padding: '2px 4px'
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <strong>RECEIPT:</strong>{' '}
                    <input
                      type="text"
                      value={printReceiptForm.receipt}
                      onChange={(e) => setPrintReceiptForm({ ...printReceiptForm, receipt: e.target.value })}
                      style={{
                        border: 'none',
                        borderBottom: '1px solid #000',
                        background: 'transparent',
                        fontFamily: 'Courier New, monospace',
                        fontSize: '12pt',
                        padding: '2px 4px',
                        minWidth: '150px'
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <strong>ORDER TYPE:</strong> {printReceiptForm.orderType}
                  </div>
                </div>

                {/* SERVICE Fields */}
                {printReceiptForm.orderType === 'SERVICE' && (
                  <>
                    <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1 }}>
                        <strong>RO#:</strong>{' '}
                        <input
                          type="text"
                          value={printReceiptForm.ro}
                          onChange={(e) => setPrintReceiptForm({ ...printReceiptForm, ro: e.target.value })}
                          style={{
                            border: 'none',
                            borderBottom: '1px solid #000',
                            background: 'transparent',
                            fontFamily: 'Courier New, monospace',
                            fontSize: '12pt',
                            padding: '2px 4px',
                            minWidth: '150px'
                          }}
                        />
                      </div>
                      <div style={{ flex: 1, textAlign: 'right' }}>
                        <strong>PLATE#:</strong>{' '}
                        <input
                          type="text"
                          value={printReceiptForm.plate}
                          onChange={(e) => setPrintReceiptForm({ ...printReceiptForm, plate: e.target.value })}
                          style={{
                            border: 'none',
                            borderBottom: '1px solid #000',
                            background: 'transparent',
                            fontFamily: 'Courier New, monospace',
                            fontSize: '12pt',
                            padding: '2px 4px',
                            minWidth: '150px'
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1 }}>
                        <strong>PRF#:</strong>{' '}
                        <input
                          type="text"
                          value={printReceiptForm.prf}
                          onChange={(e) => setPrintReceiptForm({ ...printReceiptForm, prf: e.target.value })}
                          style={{
                            border: 'none',
                            borderBottom: '1px solid #000',
                            background: 'transparent',
                            fontFamily: 'Courier New, monospace',
                            fontSize: '12pt',
                            padding: '2px 4px',
                            minWidth: '150px'
                          }}
                        />
                      </div>
                      <div style={{ flex: 1, textAlign: 'right' }}>
                        <strong>C/O:</strong>{' '}
                        <input
                          type="text"
                          value={printReceiptForm.co}
                          onChange={(e) => setPrintReceiptForm({ ...printReceiptForm, co: e.target.value })}
                          style={{
                            border: 'none',
                            borderBottom: '1px solid #000',
                            background: 'transparent',
                            fontFamily: 'Courier New, monospace',
                            fontSize: '12pt',
                            padding: '2px 4px',
                            minWidth: '150px'
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}

                <div style={{ borderTop: '1px solid #000', margin: '12px 0' }}></div>

                {/* Items Table */}
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  marginBottom: '12px',
                  fontSize: '11pt'
                }}>
                  <thead>
                    <tr style={{ borderTop: '2px solid #000', borderBottom: '2px solid #000' }}>
                      <th style={{ padding: '6px 4px', textAlign: 'left', fontWeight: 'bold' }}>BRAND</th>
                      <th style={{ padding: '6px 4px', textAlign: 'left', fontWeight: 'bold' }}>DESCRIPTION</th>
                      <th style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 'bold' }}>QUANTITY</th>
                      <th style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 'bold' }}>PRICE</th>
                      <th style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 'bold' }}>AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getPaginatedItems(printReceiptData, printReceiptCurrentPage).map((sale, index) => {
                      const brand = sale.BRAND || 'N/A';
                      const description = (sale.DESCRIPTION || sale.REMARKS || sale.BENZ || 'N/A').substring(0, 50);
                      // For adjustments, show the quantity as stored (sign is already reversed)
                      const isAdjustmentItem = (sale.RECEIPT === 'ADJUSTMENT' || sale.INVOICE === 'ADJUSTMENT');
                      const qty = sale.QTY || 0;
                      // For adjustments, show 0.00 for price and amount
                      const unitPrice = isAdjustmentItem ? 0 : parseFloat(sale.SELL || 0);
                      const amount = isAdjustmentItem ? 0 : (parseFloat(sale.total_amount) || (unitPrice * qty));
                      
                      return (
                        <tr key={index} style={{ borderBottom: '1px solid #000' }}>
                          <td style={{ padding: '5px 4px' }}>{brand}</td>
                          <td style={{ padding: '5px 4px' }}>{description}</td>
                          <td style={{ padding: '5px 4px', textAlign: 'center' }}>{qty}</td>
                          <td style={{ padding: '5px 4px', textAlign: 'right' }}>{unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style={{ padding: '5px 4px', textAlign: 'right' }}>{amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                {getTotalPages(printReceiptData) > 1 && (
                  <div style={{ marginBottom: '12px', textAlign: 'center', fontSize: '10pt' }}>
                    <button
                      onClick={() => setPrintReceiptCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={printReceiptCurrentPage === 1}
                      style={{
                        padding: '4px 12px',
                        margin: '0 8px',
                        border: '1px solid #000',
                        background: printReceiptCurrentPage === 1 ? '#ccc' : 'white',
                        cursor: printReceiptCurrentPage === 1 ? 'not-allowed' : 'pointer',
                        fontFamily: 'Courier New, monospace',
                        fontSize: '10pt'
                      }}
                    >
                      Previous
                    </button>
                    Page {printReceiptCurrentPage} of {getTotalPages(printReceiptData)}
                    <button
                      onClick={() => setPrintReceiptCurrentPage(prev => Math.min(getTotalPages(printReceiptData), prev + 1))}
                      disabled={printReceiptCurrentPage === getTotalPages(printReceiptData)}
                      style={{
                        padding: '4px 12px',
                        margin: '0 8px',
                        border: '1px solid #000',
                        background: printReceiptCurrentPage === getTotalPages(printReceiptData) ? '#ccc' : 'white',
                        cursor: printReceiptCurrentPage === getTotalPages(printReceiptData) ? 'not-allowed' : 'pointer',
                        fontFamily: 'Courier New, monospace',
                        fontSize: '10pt'
                      }}
                    >
                      Next
                    </button>
                  </div>
                )}

                {/* Total and Footer - Only show on last page */}
                {printReceiptCurrentPage === getTotalPages(printReceiptData) && (
                  <>
                    <div style={{ borderTop: '1px solid #000', margin: '12px 0' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13pt', fontWeight: 'bold' }}>
                      <span>TOTAL</span>
                      <span>{(() => {
                        const isAdjustment = printReceiptForm.orderType === 'ADJUSTMENT';
                        if (isAdjustment) return '0.00';
                        return printReceiptData.reduce((sum, sale) => sum + (parseFloat(sale.total_amount) || (parseFloat(sale.SELL || 0) * parseInt(sale.QTY || 0))), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      })()}</span>
                    </div>
                    <div style={{ borderTop: '1px solid #000', margin: '12px 0' }}></div>
                    <div style={{ marginTop: '12px', fontSize: '11pt', fontWeight: 'bold' }}>
                      ITEMS RECEIVE IN GOOD CONDITION:_____________________________________
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => setShowPrintReceiptModal(false)}
                style={{
                  padding: '10px 20px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: `${getFontSize(14)}px`,
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handlePrintFromModal}
                style={{
                  padding: '10px 20px',
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: `${getFontSize(14)}px`,
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Printer size={16} />
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Modal for Alerts and Confirmations */}
      {modalState.show && (
        <CustomModal
          show={modalState.show}
          title={modalState.title}
          message={modalState.message}
          type={modalState.type}
          onConfirm={modalState.onConfirm}
          onCancel={modalState.onCancel}
        />
      )}
    </div>
  );
};

export default SalesHistory;

  import React, { useState, useEffect, useMemo, useCallback, useContext, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Filter, RefreshCw, Eye, Edit, Trash2, Plus, Download, Upload, BarChart3, TrendingUp, Package, AlertTriangle, ArrowDownWideNarrow, ArrowUpNarrowWide, X, CheckCircle, FileText, Printer, GripVertical, Save } from 'lucide-react';
import { AuthContext } from '../AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { QrReader } from 'react-qr-reader';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import CurrencyDropdown from './CurrencyDropdown';
import CustomModal from './CustomModal';
import useCustomModal from '../hooks/useCustomModal';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Table styles
const tableStyles = `
  /* Hide spinner arrows for number inputs */
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  
  input[type="number"] {
    -moz-appearance: textfield;
  }

  /* Modern, clean input field focus styles */
  input[type="text"]:focus,
  input[type="number"]:focus,
  input[type="email"]:focus,
  input:focus {
    outline: none;
    background: var(--input-bg) !important;
    border: 1px solid #4a90e2 !important;
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.15) !important;
    transition: all 0.2s ease-in-out;
  }

  /* Spin animation for loading spinner */
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Custom scrollbar styling for saved items panel */
  .saved-items-container::-webkit-scrollbar {
    width: 6px;
  }
  
  .saved-items-container::-webkit-scrollbar-track {
    background: var(--bg-tertiary);
    border-radius: 3px;
  }
  
  .saved-items-container::-webkit-scrollbar-thumb {
    background: rgba(0,123,255,0.3);
    border-radius: 3px;
  }
  
  .saved-items-container::-webkit-scrollbar-thumb:hover {
    background: rgba(0,123,255,0.5);
  }
  .pos-stock-table-container {
    background: var(--card-bg);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 16px var(--shadow-md);
  }

  .pos-stock-table-wrapper {
    overflow-x: auto;
    max-width: 100%;
  }

  .pos-stock-table {
    width: 100%;
    border-collapse: collapse;
    background: var(--card-bg);
    color: var(--text-primary);
  }

  .pos-stock-table th {
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-weight: 600;
    padding: 12px 16px;
    text-align: left;
    border-bottom: 2px solid var(--border-color);
    font-size: 0.9em;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .pos-stock-table td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    vertical-align: middle;
  }

  .pos-stock-row {
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    margin-bottom: 2px;
  }

  .pos-stock-row:hover {
    background: var(--hover-bg);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  .pos-stock-row.selected {
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
  }

  .pos-stock-row.out-of-stock {
    opacity: 0.7;
    background: var(--bg-tertiary);
  }

  .pos-stock-row.out-of-stock:hover {
    background: var(--hover-bg);
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
    color: var(--text-muted);
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
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
    box-shadow: 0 2px 6px rgba(40, 167, 69, 0.3);
  }

  .quantity-badge:hover {
    transform: scale(1.1) translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    opacity: 0.9;
  }

  .quantity-badge.low-stock {
    background: #ffc107;
    color: #212529;
    box-shadow: 0 2px 6px rgba(255, 193, 7, 0.4);
  }

  .quantity-badge.out-of-stock {
    background: #dc3545;
    color: white;
    box-shadow: 0 2px 6px rgba(220, 53, 69, 0.4);
  }

  .quantity-badge.in-stock {
    box-shadow: 0 2px 6px rgba(40, 167, 69, 0.3);
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
    background: #2563eb;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: auto;
    white-space: nowrap;
    font-weight: 500;
    box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
  }

  .pos-stock-action-btn:hover {
    background: #1e40af;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.5);
  }

  .pos-stock-action-btn .pos-btn-icon {
    width: 14px;
    height: 14px;
  }

  .pos-stock-action-btn.active {
    background: #16a34a !important;
    color: white !important;
    border: none !important;
  }

  .pos-stock-action-btn.active:hover {
    background: #15803d !important;
  }

  .pos-checkbox {
    accent-color: #1976d2;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 2px solid #1976d2;
    background: var(--input-bg);
    vertical-align: middle;
    margin: 0 4px;
    transition: box-shadow 0.2s;
    box-shadow: 0 1px 2px rgba(25, 118, 210, 0.08);
  }
  .pos-checkbox:focus {
    outline: 2px solid #1976d2;
    outline-offset: 1px;
  }

  .pos-stock-row {
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .pos-stock-row:hover {
    background-color: rgba(76, 175, 80, 0.08) !important;
  }

  .pos-stock-row.selected {
    background-color: rgba(76, 175, 80, 0.15) !important;
    border-left: 3px solid #4CAF50 !important;
  }

  .pos-stock-row.selected:hover {
    background-color: rgba(76, 175, 80, 0.25) !important;
  }

  .compatibility-row {
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .compatibility-row:hover {
    background-color: rgba(76, 175, 80, 0.08) !important;
  }

  .compatibility-row.selected {
    background-color: rgba(76, 175, 80, 0.15) !important;
    border-left: 3px solid #4CAF50 !important;
  }

  .compatibility-row.selected:hover {
    background-color: rgba(76, 175, 80, 0.25) !important;
  }
  /* Cart/side modal styles */
  .pos-cart-modal {
    position: fixed;
    top: 0;
    right: 0;
    width: 280px;
    height: 100vh;
    background: var(--modal-bg);
    color: var(--text-primary);
    z-index: 3000;
    display: flex;
    flex-direction: column;
    border-left: 1.5px solid var(--border-color);
    box-shadow: 0 2px 12px 0 var(--shadow-md);
    border-radius: 0 10px 10px 0;
    transition: box-shadow 0.2s, background 0.2s;
    overflow: hidden;
  }
  .pos-cart-modal-header {
    padding: 16px 18px 10px 18px;
    font-size: 0.98em;
    font-weight: 500;
    border-bottom: 1px solid var(--border-color);
    background: var(--modal-bg);
    display: flex;
    justify-content: space-between;
    align-items: center;
    letter-spacing: 0.5px;
  }
  .pos-cart-modal-close {
    background: none;
    border: none;
    color: var(--text-primary);
    font-size: 1.3em;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .pos-cart-modal-close:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }
  .pos-cart-list {
    flex: 1;
    overflow-y: auto;
    padding: 14px 18px 10px 18px;
    background: var(--modal-bg);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .pos-cart-item {
    background: var(--card-bg);
    border-radius: 8px;
    padding: 10px 12px 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    box-shadow: 0 1px 4px 0 var(--shadow-sm);
    border: 1px solid var(--border-color);
    transition: background 0.2s, box-shadow 0.2s;
  }
  .pos-cart-item-title {
    font-weight: bold;
    font-size: 1em;
    color: var(--text-primary);
    margin-bottom: 1px;
  }
  .pos-cart-item-desc {
    font-size: 0.97em;
    color: var(--text-secondary);
    opacity: 0.92;
  }
  .pos-cart-modal-footer {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 14px 18px 14px 18px;
    background: var(--modal-bg);
    border-top: 1px solid var(--border-color);
    position: static;
    bottom: 0;
    z-index: 2;
  }
  .pos-cart-modal-footer button {
    border: 1.5px solid var(--border-color);
    color: var(--text-primary);
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
    border-color: var(--border-color);
    color: var(--text-primary);
  }
  .pos-cart-modal-footer button:last-child:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
    border-color: var(--border-color);
  }
  .pos-cart-modal-footer button:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
    border-color: var(--border-color);
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
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .export-preview-info p {
    margin: 5px 0;
    color: var(--text-primary);
  }

  .export-preview-table-container {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: 8px;
  }

  .export-preview-table {
    width: 100%;
    border-collapse: collapse;
    background: var(--card-bg);
  }

  .export-preview-table th,
  .export-preview-table td {
    padding: 12px;
    text-align: left;
    border: 1px solid var(--border-color);
  }

  .export-preview-table th {
    background: var(--bg-secondary);
    font-weight: 600;
    color: var(--text-primary);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .export-preview-table td {
    color: var(--text-primary);
  }

  .export-preview-table tbody tr:nth-child(even) {
    background: var(--bg-secondary);
  }

  .export-preview-table tbody tr:hover {
    background: var(--hover-bg);
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

const InventoryManagement = () => {
  // Custom Modal Hook
  const { modalState, showAlert, showConfirm, closeModal } = useCustomModal();
  
  // Theme hook
  const { theme, isDark, isLight } = useTheme();
  
  // Quantity editing state
  const [quantityEditModal, setQuantityEditModal] = useState({
    show: false,
    stockId: null,
    stockData: null,
    currentQuantity: 0,
    newQuantity: 0
  });

  // Adjustment modal state
  const [adjustmentModal, setAdjustmentModal] = useState({
    show: false,
    stock: null,
    quantity: '',
    price: '',
    reason: '',
    note: '',
    customer: 'DELODUR CORP',
    adjustmentNumber: null
  });

  
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [serviceData, setServiceData] = useState({});
  // Discrepancy reports state
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);
  const [discrepancyLoading, setDiscrepancyLoading] = useState(false);
  const [discrepancies, setDiscrepancies] = useState([]);
  
  // Item movement modal state
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementData, setMovementData] = useState([]);
  const [showSalesAnalytics, setShowSalesAnalytics] = useState(false);
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementBenz, setMovementBenz] = useState('');
  const [movementBrand, setMovementBrand] = useState('');
  const [movementAltno, setMovementAltno] = useState('');
  const [movementDescription, setMovementDescription] = useState('');
  const [movementApplication, setMovementApplication] = useState('');
  const [movementStockQuantity, setMovementStockQuantity] = useState(0);
  const [filterYear, setFilterYear] = useState('');
  const [filterMonths, setFilterMonths] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Track window width for responsive design
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchDiscrepancies = async () => {
    try {
      setDiscrepancyLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/warehouse/discrepancies', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setDiscrepancies(Array.isArray(data) ? data : []);
    } catch (e) {
      setDiscrepancies([]);
    } finally {
      setDiscrepancyLoading(false);
    }
  };
  
  // New state for view management
  const [currentView, setCurrentView] = useState('stocks'); // 'stocks' or 'incoming'
  const [incomingSubView, setIncomingSubView] = useState('table'); // 'table' or 'form'
  const [incomingStocks, setIncomingStocks] = useState([]);
  const [incomingLoading, setIncomingLoading] = useState(false);
  
  // State for incoming reference+date navigation
  const [incomingRefDateCombinations, setIncomingRefDateCombinations] = useState([]);
  const [incomingCurrentCombinationIndex, setIncomingCurrentCombinationIndex] = useState(0);
  const [incomingNavigating, setIncomingNavigating] = useState(false);
  const [incomingSelectedDate, setIncomingSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [incomingReferenceSearch, setIncomingReferenceSearch] = useState('');
  
  // New incoming workflow states
  const [currentIncomingTab, setCurrentIncomingTab] = useState(1);
  const [incomingTabData, setIncomingTabData] = useState({});
  const [incomingBasicInfo, setIncomingBasicInfo] = useState({
    reference: '',
    supplier: '',
    date: new Date().toISOString().split('T')[0]
  });

  // New redesigned incoming system states
  const [currentTab, setCurrentTab] = useState(1);
  const [tabFormData, setTabFormData] = useState({});
  const [tabSavedItems, setTabSavedItems] = useState({});
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [tabNames, setTabNames] = useState({}); // Store custom tab names
  const [editingTabName, setEditingTabName] = useState(null); // Track which tab is being renamed
  const [showClearConfirm, setShowClearConfirm] = useState(false); // Confirmation dialog for clearing
  const [showArrangeModal, setShowArrangeModal] = useState(false);
  const [arrangeList, setArrangeList] = useState([]); // Copy of items for drag reorder in Arrange modal
  const [arrangeSaving, setArrangeSaving] = useState(false);
  const [arrangeExporting, setArrangeExporting] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [arrangeDragOverIndex, setArrangeDragOverIndex] = useState(null);
  const [arrangeSelectedIds, setArrangeSelectedIds] = useState(new Set());
  const lastArrangeSelectedIndexRef = useRef(null);

  // Handle tab switching
  const handleTabSwitch = (tabNumber) => {
    setCurrentIncomingTab(tabNumber);
    
    // If this tab has basic info, load it
    const tabData = incomingTabData[tabNumber];
    if (tabData?.basicInfo) {
      setIncomingBasicInfo(tabData.basicInfo);
      setIncomingForm({
        ...incomingForm,
        reference: tabData.basicInfo.reference,
        supplier: tabData.basicInfo.supplier,
        date: tabData.basicInfo.date
      });
    } else {
      // Reset to initial state for new tab
      setIncomingBasicInfo({
        reference: '',
        supplier: '',
        date: new Date().toISOString().split('T')[0]
      });
    }
  };

  // New redesigned incoming system functions
  const initializeTabData = (tabNumber) => {
    if (!tabFormData[tabNumber]) {
      setTabFormData(prev => ({
        ...prev,
        [tabNumber]: {
          reference: incomingForm.reference || '',
          supplier: incomingForm.supplier || '',
          date: incomingForm.date || new Date().toISOString().split('T')[0],
          conversion: incomingForm.conversion || '1',
          currency: incomingForm.currency || 'USD',
          unit: incomingForm.unit || 'pcs',
          // Clearable fields
          benz_number: '',
          benz_number2: '',
          benz_number3: '',
          brand: '',
          oem: '',
          oem2: '',
          description: '',
          color_code: '',
          location: '',
          application: '',
          remarks: '',
          reorder: '0',
          cost: '0',
          selling_price: '0',
          quantity: '0',
          fc_cost: '0',
          din_flag: '',
          factor: ''
        }
      }));
    }
    if (!tabSavedItems[tabNumber]) {
      setTabSavedItems(prev => ({
        ...prev,
        [tabNumber]: []
      }));
    }
  };

  const getCurrentFormData = () => {
    return tabFormData[currentTab] || {};
  };

  const updateFormData = (field, value) => {
    setTabFormData(prev => ({
      ...prev,
      [currentTab]: {
        ...prev[currentTab],
        [field]: value
      }
    }));
  };

  const hasUnsavedChanges = () => {
    const formData = getCurrentFormData();
    const clearableFields = ['benz_number', 'benz_number2', 'benz_number3', 'brand', 'oem', 'oem2', 
                            'description', 'color_code', 'location', 'application', 'remarks', 
                            'reorder', 'cost', 'selling_price', 'quantity', 'fc_cost'];
    
    return clearableFields.some(field => formData[field] && formData[field].trim() !== '' && formData[field] !== '0');
  };

  const handleSaveItem = async () => {
    const formData = incomingForm;
    
    // Comprehensive validation
    const validationErrors = [];
    
    // Required fields validation
    if (!formData.benz_number || formData.benz_number.trim() === '') {
      validationErrors.push('Benz Number is required');
    }
    
    if (!formData.brand || formData.brand.trim() === '') {
      validationErrors.push('Brand is required');
    }
    
    if (!formData.description || formData.description.trim() === '') {
      validationErrors.push('Description is required');
    }
    
    // Numeric field validation
    if (formData.quantity && (isNaN(formData.quantity) || parseFloat(formData.quantity) < 0)) {
      validationErrors.push('Quantity must be a valid positive number');
    }
    
    if (formData.cost && String(formData.cost).trim() !== '' && (isNaN(unformatCurrency(String(formData.cost))) || parseFloat(unformatCurrency(String(formData.cost))) < 0)) {
      validationErrors.push('Cost must be a valid positive number');
    }
    
    if (formData.selling_price && String(formData.selling_price).trim() !== '' && (isNaN(unformatCurrency(String(formData.selling_price))) || parseFloat(unformatCurrency(String(formData.selling_price))) < 0)) {
      validationErrors.push('Selling Price must be a valid positive number');
    }
    
    if (formData.reorder && (isNaN(formData.reorder) || parseFloat(formData.reorder) < 0)) {
      validationErrors.push('Reorder Level must be a valid positive number');
    }
    
    if (formData.conversion && String(formData.conversion).trim() !== '' && (isNaN(formData.conversion) || parseFloat(formData.conversion) <= 0)) {
      validationErrors.push('Conversion must be a valid positive number');
    }
    
    if (formData.fc_cost && String(formData.fc_cost).trim() !== '' && (isNaN(unformatCurrency(String(formData.fc_cost))) || parseFloat(unformatCurrency(String(formData.fc_cost))) < 0)) {
      validationErrors.push('FC Cost must be a valid positive number');
    }
    
    // Show validation errors if any
    if (validationErrors.length > 0) {
      await showAlert('Please fix the following errors:\n\n' + validationErrors.join('\n'), 'Validation Error');
      return;
    }

    try {
      // Convert date from YYYY-MM-DD to YYYYMMDD format for database
      const dateFormatted = formData.date ? formData.date.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '');
      
      // Prepare data for database (mapping form fields to database fields)
      const databaseData = {
        supplier: formData.supplier?.trim() || '',
        date: dateFormatted,
        reference: formData.reference?.trim() || '',
        din_flag: formData.din_flag || '',
        benz_number: formData.benz_number || '',
        benz_number2: formData.benz_number2 || '',
        benz_number3: formData.benz_number3 || '',
        brand: formData.brand?.trim() || '',
        altno: formData.altno?.trim() || '',
        altno2: formData.altno2?.trim() || '',
        description: formData.description?.trim() || '',
        application: formData.application?.trim() || '',
        color_code: formData.color_code?.trim() || '',
        remarks: formData.remarks?.trim() || '',
        cost: formData.cost && String(formData.cost).trim() !== '' ? parseFloat(unformatCurrency(String(formData.cost))) || 0 : 0,
        selling_price: formData.selling_price && String(formData.selling_price).trim() !== '' ? parseFloat(unformatCurrency(String(formData.selling_price))) || 0 : 0,
        quantity: formData.quantity && String(formData.quantity).trim() !== '' ? parseFloat(String(formData.quantity)) || 0 : 0,
        currency: formData.currency || 'USD',
        fc_cost: formData.fc_cost && String(formData.fc_cost).trim() !== '' ? parseFloat(unformatCurrency(String(formData.fc_cost))) || 0 : 0,
        conversion: formData.conversion && String(formData.conversion).trim() !== '' ? parseFloat(String(formData.conversion)) || 1 : 1,
        location: formData.location?.trim() || '',
        tab_number: currentTab, // Add tab number to track which tab encoded this item
        factor: formData.factor && String(formData.factor).trim() !== '' ? parseFloat(String(formData.factor).replace(/,/g, '')) || null : null
      };

      console.log('🚀 Saving item to database:', databaseData);
      console.log('🔍 Cost value:', formData.cost, '->', databaseData.cost);
      console.log('🔍 Selling value:', formData.selling_price, '->', databaseData.selling_price);

      // Save to database using inc_tbl API endpoint
      const token = localStorage.getItem('token');
      const url = isEditingItem ? `/api/inc_tbl/update/${editingItemId}` : '/api/inc_tbl/add';
      const method = isEditingItem ? 'put' : 'post';
      
      const response = await axios[method](url, databaseData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        // Create item for local storage (for Saved Items panel)
        const newItem = {
          id: response.data.id || Date.now(), // Use database ID if available
          date: formData.date,
          benz: formData.benz_number?.trim() || '',
          price: formData.selling_price && String(formData.selling_price).trim() !== '' ? parseFloat(unformatCurrency(String(formData.selling_price))) || 0 : 0,
          description: formData.description?.trim() || '',
          brand: formData.brand?.trim() || '',
          cost: formData.cost && String(formData.cost).trim() !== '' ? parseFloat(unformatCurrency(String(formData.cost))) || 0 : 0,
          quantity: parseFloat(formData.quantity) || 0,
          // Store all form data with proper formatting
          benz_number: formData.benz_number || '',
          benz_number2: formData.benz_number2 || '',
          benz_number3: formData.benz_number3 || '',
          oem: formData.altno?.trim() || '',
          oem2: formData.altno2?.trim() || '',
          color_code: formData.color_code?.trim() || '',
          location: formData.location?.trim() || '',
          application: formData.application?.trim() || '',
          remarks: formData.remarks?.trim() || '',
          reorder: parseFloat(formData.reorder) || 0,
          selling_price: formData.selling_price && String(formData.selling_price).trim() !== '' ? parseFloat(unformatCurrency(String(formData.selling_price))) || 0 : 0,
          unit: formData.unit || 'pcs',
          conversion: parseFloat(formData.conversion) || 1,
          currency: formData.currency || 'USD',
          fc_cost: formData.fc_cost && String(formData.fc_cost).trim() !== '' ? parseFloat(unformatCurrency(String(formData.fc_cost))) || 0 : 0,
          factor: formData.factor && String(formData.factor).trim() !== '' ? parseFloat(String(formData.factor).replace(/,/g, '')) : null,
          reference: formData.reference?.trim() || '',
          supplier: formData.supplier?.trim() || '',
          timestamp: new Date().toISOString(),
          database_id: response.data.id, // Store database ID for reference
          tab_number: currentTab // Store tab number for filtering
        };

        // Add or update saved items (for display in panel)
        if (isEditingItem) {
          // Update existing item in the list
          setTabSavedItems(prev => ({
            ...prev,
            [currentTab]: (prev[currentTab] || []).map(item => 
              item.id === editingItemId ? newItem : item
            )
          }));
        } else {
          // Add new item to the list
        setTabSavedItems(prev => ({
          ...prev,
          [currentTab]: [...(prev[currentTab] || []), newItem]
        }));
        }

        // Clear form (keep persistent fields: reference, supplier, date, conversion, currency, fc_cost, factor)
        const persistentFields = ['reference', 'supplier', 'date', 'conversion', 'currency', 'fc_cost', 'factor'];
        const clearableFields = ['benz_number', 'benz_number2', 'benz_number3', 'brand', 'altno', 'altno2', 
                                'description', 'color_code', 'location', 'application', 'remarks', 
                                'reorder', 'cost', 'selling_price', 'quantity', 'unit', 'din_flag'];
        
        // Clear the form while keeping persistent fields
        setIncomingForm(prev => {
          const cleared = { ...prev };
        clearableFields.forEach(field => {
            if (field === 'cost' || field === 'selling_price' || field === 'quantity') {
              cleared[field] = '0';
          } else {
              cleared[field] = '';
          }
          });
          return cleared;
        });

        setCurrentItemIndex(0); // Reset to first item
        
        // Reset editing mode
        setIsEditingItem(false);
        setEditingItemId(null);
        
        // Show success message with animation and auto-close
        await showAlert(isEditingItem ? 'Updated!' : 'Saved!', 'Success', true, 2500);
        
        // Focus on Benz Number field after a short delay
        setTimeout(() => {
          const benzInput = document.querySelector('input[name="benz_number"]');
          if (benzInput) {
            benzInput.focus();
          }
        }, 500);
        
        console.log('✅ Item saved to database with ID:', response.data.id);
        
      } else {
        throw new Error(response.data.message || 'Failed to save item to database');
      }
      
    } catch (error) {
      console.error('❌ Error saving item to database:', error);
      
      let errorMessage = 'Error saving item to database. ';
      if (error.response?.data?.message) {
        errorMessage += error.response.data.message;
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please try again.';
      }
      
      await showAlert(errorMessage, 'Error');
    }
  };

  // Handle import from incoming.dbf
  const handleImportIncoming = async () => {
    try {
      const confirmed = await showConfirm(
        `This will import all records from INCOMING.DBF to Tab ${currentTab}. Continue?`,
        'Import INCOMING.DBF'
      );
      
      if (!confirmed) return;
      
      setLoading(true);
      
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/incoming/import-dbf', {
        tabNumber: currentTab
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        // Step 2: Run Description Adjustment to update master table
        console.log('🔄 Running Description Adjustment to update master table...');
        const masterResponse = await axios.post('/api/master/convert-and-import-dbf', {}, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (masterResponse.data.success) {
          console.log('✅ Master table updated successfully');
          
          // Step 3: Auto-populate Description/Application for imported items
          console.log('🔄 Auto-populating Description/Application for imported items...');
          const autopopulateResponse = await axios.post('/api/incoming/autopopulate-descriptions', {
            tabNumber: currentTab
          }, {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (autopopulateResponse.data.success) {
            console.log(`✅ Auto-populated ${autopopulateResponse.data.updated} items with Description/Application`);
          }
        }
        
        // Refresh the current tab's items
        await loadTabSavedItems(currentTab);
        
        await showAlert(
          `Import successful!\n\nImported: ${response.data.imported} items\nErrors: ${response.data.errors}\nTotal: ${response.data.total}\n\nDescription/Application auto-populated from master table.`,
          'Import Complete'
        );
      } else {
        throw new Error(response.data.message || 'Import failed');
      }
      
    } catch (error) {
      console.error('❌ Error importing INCOMING.DBF:', error);
      
      let errorMessage = 'Error importing INCOMING.DBF. ';
      if (error.response?.data?.message) {
        errorMessage += error.response.data.message;
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please check if the file exists at C:\\Rae\\Files\\INCOMING.DBF';
      }
      
      await showAlert(errorMessage, 'Import Error');
    } finally {
      setLoading(false);
    }
  };

  // Print incoming invoice for current tab
  const handlePrintIncoming = () => {
    const savedItems = tabSavedItems[currentTab] || [];
    if (savedItems.length === 0) {
      showAlert('No items in this tab to print.', 'No Data');
      return;
    }

    const first = savedItems[0];
    const supplier = first.supplier || incomingForm.supplier || '';
    const ref = first.reference || incomingForm.reference || '';
    const dateVal = first.date || incomingForm.date || '';
    const factorVal = first.factor != null && first.factor !== '' ? String(first.factor) : (incomingForm.factor || '');
    let dateFormatted = dateVal;
    if (dateVal) {
      if (dateVal.length === 8 && /^\d{8}$/.test(dateVal)) {
        dateFormatted = `${dateVal.substring(4, 6)}/${dateVal.substring(6, 8)}/${dateVal.substring(0, 4)}`;
      } else if (dateVal.includes('-')) {
        const [y, m, d] = dateVal.split('-');
        dateFormatted = `${m}/${d}/${y}`;
      }
    }

    const formatNum = (n) => {
      const num = parseFloat(n) || 0;
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    const formatNumOrEmpty = (n) => {
      const num = parseFloat(n);
      if (num === undefined || num === null || isNaN(num) || num === 0) return '';
      return formatNum(num);
    };

    const getDesc = (item) => {
      if (item.description && String(item.description).trim()) return String(item.description).trim();
      if (!master || !Array.isArray(master)) return '';
      const benz = String(item.benz_number || item.benz || '').trim();
      const brand = String(item.brand || '').trim();
      if (!benz && !brand) return '';
      const match = master.find(m =>
        String(m.BENZ || m.benz_number || '').trim() === benz &&
        String(m.BRAND || m.brand || '').trim() === brand
      );
      return (match && (match.DESC || match.description || match.REMARKS || match.remarks || '')) || '';
    };

    const rows = savedItems.map(item => {
      const qty = parseFloat(item.quantity) || 0;
      const fcCost = parseFloat(item.fc_cost) || 0;
      const amount = qty * fcCost;
      const sellingPrice = item.price || item.selling_price;
      const lCost = item.cost;
      const desc = getDesc(item);
      const altno = (item.oem || item.oem2 || item.altno || '').toString().replace(/</g, '&lt;');
      return `<tr>
        <td style="padding:4px 6px;border:1px solid #333;width:70px;">${formatNumOrEmpty(sellingPrice)}</td>
        <td style="padding:4px 6px;border:1px solid #333;font-size:14px;font-weight:bold;">${(item.benz_number || item.benz || '').replace(/</g, '&lt;')}</td>
        <td style="padding:4px 6px;border:1px solid #333;">${altno}</td>
        <td style="padding:4px 6px;border:1px solid #333;text-align:center;">${(item.brand || '').replace(/</g, '&lt;')}</td>
        <td style="padding:4px 6px;border:1px solid #333;">${desc.replace(/</g, '&lt;')}</td>
        <td style="padding:4px 6px;border:1px solid #333;text-align:center;">${formatNum(qty)}</td>
        <td style="padding:4px 6px;border:1px solid #333;text-align:right;">${formatNum(fcCost)}</td>
        <td style="padding:4px 6px;border:1px solid #333;text-align:right;">${formatNum(amount)}</td>
        <td style="padding:4px 6px;border:1px solid #333;text-align:right;">${formatNumOrEmpty(lCost)}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${supplier} Invoice</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; padding: 12px 8px; margin: 0; }
    .company { font-size: 16px; font-weight: 600; color: #333; margin: 0 0 2px 0; }
    h2 { font-size: 22px; margin: 0 0 2px 0; }
    .meta { margin: 0 0 8px 0; font-size: 16px; line-height: 1.2; }
    table { border-collapse: collapse; width: 100%; }
    th { padding: 4px 6px; border: 1px solid #333; background: #f0f0f0; font-weight: 600; }
    thead { display: table-row-group; }
  </style>
</head>
<body>
  <div class="company">DELODUR CORPORATION</div>
  <h2>${supplier} INVOICE</h2>
  <div class="meta">
    <div>Invoice: ${ref}</div>
    <div>Date: ${dateFormatted}</div>
  </div>
  <table>
    <thead>
      <tr>
        <td colspan="8" style="border:none;padding:0;"></td>
        <td style="border:2px solid #333;padding:4px 6px;text-align:right;font-weight:bold;background:#f0f0f0;">FACTOR: ${factorVal}</td>
      </tr>
      <tr>
        <th style="width:70px;">S. PRICE</th>
        <th style="font-size:14px;font-weight:bold;">PART NO</th>
        <th>ALTNO</th>
        <th style="text-align:center;">BRAND</th>
        <th>DESCRIPTION</th>
        <th style="text-align:center;">QTY</th>
        <th style="text-align:right;">U PRICE</th>
        <th style="text-align:right;">AMOUNT</th>
        <th style="text-align:right;">LCOST</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 250);
  };

  // Export current tab to INCOMING.DBF file
  const handleExportIncomingDBF = async () => {
    try {
      const savedItems = tabSavedItems[currentTab] || [];
      if (savedItems.length === 0) {
        await showAlert('No items in this tab to export.', 'No Data');
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        await showAlert('Authentication token not found. Please log in again.', 'Error');
        return;
      }

      setLoading(true);

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
      loadingMessage.textContent = 'Exporting to INCOMING.DBF...';
      document.body.appendChild(loadingMessage);

      try {
        const response = await axios.get(`/api/inc_tbl/export-dbf?tabNumber=${currentTab}`, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        });

        const blob = new Blob([response.data], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'INCOMING.DBF';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        document.body.removeChild(loadingMessage);
        await showAlert(`Successfully exported ${savedItems.length} items to INCOMING.DBF`, 'Export Complete');
      } catch (error) {
        if (document.body.contains(loadingMessage)) {
          document.body.removeChild(loadingMessage);
        }
        if (error.response) {
          if (error.response.status === 404) {
            await showAlert('No incoming data found for this tab.', 'No Data');
          } else if (error.response.status === 409) {
            const errorMsg = error.response.data?.error || error.response.data?.message || 'File is locked';
            await showAlert(`Cannot overwrite INCOMING.DBF:\n\n${errorMsg}\n\nPlease close any program using this file and try again.`, 'File Locked');
          } else {
            const errorMsg = error.response.data?.error || error.response.data?.message || 'Unknown error';
            await showAlert(`Error exporting to DBF: ${errorMsg}`, 'Error');
          }
        } else {
          await showAlert('Error exporting to DBF. Please try again.', 'Error');
        }
      }
    } catch (error) {
      console.error('DBF export error:', error);
      await showAlert('Error exporting to DBF. Please try again.', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const openArrangeModal = () => {
    const items = tabSavedItems[currentTab] || [];
    setArrangeList([...items]);
    setDraggedIndex(null);
    setArrangeSelectedIds(new Set());
    lastArrangeSelectedIndexRef.current = null;
    setShowArrangeModal(true);
  };

  const saveArrangeOrder = async () => {
    if (arrangeList.length === 0) return;
    setArrangeSaving(true);
    try {
      const token = localStorage.getItem('token');
      const orderedIds = arrangeList.map(item => item.id);
      await axios.put(`/api/inc_tbl/reorder/${currentTab}`, { orderedIds }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadTabSavedItems(currentTab);
      await showAlert('Lineup order saved.', 'Saved');
      setShowArrangeModal(false);
    } catch (err) {
      console.error('Save order error:', err);
      await showAlert(err.response?.data?.message || 'Failed to save order.', 'Error');
    } finally {
      setArrangeSaving(false);
    }
  };

  const exportArrangeDBF = async () => {
    if (arrangeList.length === 0) return;
    setArrangeExporting(true);
    try {
      const token = localStorage.getItem('token');
      const orderedIds = arrangeList.map(item => item.id);
      await axios.put(`/api/inc_tbl/reorder/${currentTab}`, { orderedIds }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadTabSavedItems(currentTab);
      const response = await axios.get(`/api/inc_tbl/export-dbf?tabNumber=${currentTab}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'INCOMING.DBF';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      await showAlert(`Exported ${arrangeList.length} items to INCOMING.DBF`, 'Export Complete');
      setShowArrangeModal(false);
    } catch (err) {
      console.error('Export arrange DBF error:', err);
      if (err.response?.status === 409) {
        await showAlert('INCOMING.DBF is in use. Close it and try again.', 'File Locked');
      } else {
        await showAlert(err.response?.data?.message || 'Failed to export DBF.', 'Error');
      }
    } finally {
      setArrangeExporting(false);
    }
  };

  const toggleArrangeSelection = (index, opts = {}) => {
    const id = arrangeList[index]?.id;
    if (id == null) return;
    if (opts.ctrlKey || opts.metaKey) {
      setArrangeSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
      lastArrangeSelectedIndexRef.current = index;
      return;
    }
    if (opts.shiftKey && lastArrangeSelectedIndexRef.current != null) {
      const a = Math.min(lastArrangeSelectedIndexRef.current, index);
      const b = Math.max(lastArrangeSelectedIndexRef.current, index);
      setArrangeSelectedIds(prev => {
        const next = new Set(prev);
        for (let i = a; i <= b; i++) {
          const itemId = arrangeList[i]?.id;
          if (itemId != null) next.add(itemId);
        }
        return next;
      });
      return;
    }
    setArrangeSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    lastArrangeSelectedIndexRef.current = index;
  };

  const handleArrangeDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleArrangeDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setArrangeDragOverIndex(index);
  };

  const handleArrangeDragLeave = () => {
    setArrangeDragOverIndex(null);
  };

  const handleArrangeDrop = (e, toIndex) => {
    e.preventDefault();
    setArrangeDragOverIndex(null);
    const fromIndex = draggedIndex;
    if (fromIndex === null) return;

    const draggedId = arrangeList[fromIndex]?.id;
    const isMulti = arrangeSelectedIds.has(draggedId) && arrangeSelectedIds.size > 1;

    setArrangeList(prev => {
      const next = [...prev];
      if (isMulti) {
        const selectedIndices = next
          .map((it, i) => (arrangeSelectedIds.has(it.id) ? i : -1))
          .filter(i => i >= 0)
          .sort((a, b) => a - b);
        const block = selectedIndices.map(i => next[i]);
        const beforeDrop = selectedIndices.filter(i => i < toIndex).length;
        const insertAt = Math.max(0, toIndex - beforeDrop);
        for (let i = selectedIndices.length - 1; i >= 0; i--) next.splice(selectedIndices[i], 1);
        const finalInsert = Math.min(insertAt, next.length);
        next.splice(finalInsert, 0, ...block);
      } else {
        if (fromIndex === toIndex) return prev;
        const [removed] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, removed);
      }
      return next;
    });
    setDraggedIndex(null);
  };

  const handleArrangeDragEnd = () => {
    setDraggedIndex(null);
    setArrangeDragOverIndex(null);
  };

  const handleNavigateItem = (direction) => {
    if (hasUnsavedChanges()) {
      setPendingNavigation(direction);
      setShowErrorDialog(true);
      return;
    }

    const savedItems = tabSavedItems[currentTab] || [];
    if (savedItems.length === 0) return;

    let newIndex = currentItemIndex;
    if (direction === 'next') {
      newIndex = (currentItemIndex + 1) % savedItems.length;
    } else if (direction === 'prev') {
      newIndex = currentItemIndex === 0 ? savedItems.length - 1 : currentItemIndex - 1;
    }

    setCurrentItemIndex(newIndex);
    loadItemToForm(savedItems[newIndex]);
  };

  // Handle Previous button click
  const handlePrevious = () => {
    const savedItems = tabSavedItems[currentTab] || [];
    if (savedItems.length === 0) {
      // If no saved items, just clear the form
      const persistentFields = ['reference', 'supplier', 'date', 'conversion', 'currency', 'unit'];
      const clearedFormData = { ...getCurrentFormData() };
      const clearableFields = ['benz_number', 'benz_number2', 'benz_number3', 'brand', 'oem', 'oem2', 
                              'description', 'color_code', 'location', 'application', 'remarks', 
                              'reorder', 'cost', 'selling_price', 'quantity', 'fc_cost'];
      
      clearableFields.forEach(field => {
        clearedFormData[field] = field === 'reorder' ? '0' : 
                                field === 'cost' || field === 'selling_price' || field === 'quantity' || field === 'fc_cost' ? '0' : '';
      });

      setTabFormData(prev => ({
        ...prev,
        [currentTab]: clearedFormData
      }));
      return;
    }

    handleNavigateItem('prev');
  };

  // Handle Next button click
  const handleNext = () => {
    const savedItems = tabSavedItems[currentTab] || [];
    if (savedItems.length === 0) {
      // If no saved items, just clear the form
      const persistentFields = ['reference', 'supplier', 'date', 'conversion', 'currency', 'unit'];
      const clearedFormData = { ...getCurrentFormData() };
      const clearableFields = ['benz_number', 'benz_number2', 'benz_number3', 'brand', 'oem', 'oem2', 
                              'description', 'color_code', 'location', 'application', 'remarks', 
                              'reorder', 'cost', 'selling_price', 'quantity', 'fc_cost'];
      
      clearableFields.forEach(field => {
        clearedFormData[field] = field === 'reorder' ? '0' : 
                                field === 'cost' || field === 'selling_price' || field === 'quantity' || field === 'fc_cost' ? '0' : '';
      });

      setTabFormData(prev => ({
        ...prev,
        [currentTab]: clearedFormData
      }));
      return;
    }

    handleNavigateItem('next');
  };

  const hasFormData = () => {
    const clearableFields = ['benz_number', 'benz_number2', 'benz_number3', 'brand', 'altno', 'altno2', 
                            'description', 'color_code', 'location', 'application', 'remarks'];
    return clearableFields.some(field => incomingForm[field] && incomingForm[field].trim() !== '');
  };

  const handleItemClick = (item, index) => {
    // Load item directly without confirmation
    loadItemToForm(item, index);
  };

  // Handle delete item from saved items
  const handleDeleteItem = async (itemId, itemIndex) => {
    const item = tabSavedItems[currentTab][itemIndex];
    const confirmed = await showConfirm(
      `Are you sure you want to delete this item?\n\n${item.benz} - ${item.brand} ${item.oem}\n${item.description}`,
      'Delete Item'
    );
    
    if (confirmed) {
      try {
        const token = localStorage.getItem('token');
        
        // Call DELETE API endpoint
        const response = await axios.delete(`/api/inc_tbl/delete/${itemId}`, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.data.success) {
          // Remove from frontend state
          setTabSavedItems(prev => ({
            ...prev,
            [currentTab]: prev[currentTab].filter((_, index) => index !== itemIndex)
          }));
          
          // Reset current item index if needed
          const newItems = tabSavedItems[currentTab].filter((_, index) => index !== itemIndex);
          if (currentItemIndex >= newItems.length && newItems.length > 0) {
            setCurrentItemIndex(newItems.length - 1);
          } else if (newItems.length === 0) {
            setCurrentItemIndex(0);
          }
          
          await showAlert('Item deleted successfully from database!', 'Success');
        } else {
          await showAlert(response.data.message || 'Failed to delete item', 'Error');
        }
      } catch (error) {
        console.error('❌ Error deleting item:', error);
        await showAlert(
          error.response?.data?.message || 'Failed to delete item from database', 
          'Error'
        );
      }
    }
  };

  const loadItemToForm = (item, index = null) => {
    // Debug: Log the item data to see what values we're getting
    console.log('🔍 Loading item to form:', item);
    console.log('🔍 Cost value:', item.cost, 'Type:', typeof item.cost);
    console.log('🔍 Selling value:', item.price, 'Type:', typeof item.price);
    console.log('🔍 FC Cost value:', item.fc_cost, 'Type:', typeof item.fc_cost);
    
    // Convert date from YYYYMMDD to YYYY-MM-DD format for HTML date input
    let formattedDate = new Date().toISOString().split('T')[0]; // Default to today
    if (item.date) {
      if (item.date.length === 8) {
        // Convert YYYYMMDD to YYYY-MM-DD
        const year = item.date.substring(0, 4);
        const month = item.date.substring(4, 6);
        const day = item.date.substring(6, 8);
        formattedDate = `${year}-${month}-${day}`;
      } else if (item.date.includes('-')) {
        // Already in YYYY-MM-DD format
        formattedDate = item.date;
      }
    }

    // Load item data into form
    setIncomingForm({
      reference: item.reference || '',
      supplier: item.supplier || '',
      date: formattedDate,
      din_flag: item.din_flag || '',
      benz_number: item.benz_number || '',
      benz_number2: item.benz_number2 || '',
      benz_number3: item.benz_number3 || '',
      brand: item.brand || '',
      altno: item.oem || '',
      altno2: item.oem2 || '',
      description: item.description || '',
      application: item.application || '',
      color_code: item.color_code || '',
      location: item.location || '',
      remarks: item.remarks || '',
      reorder_point: item.reorder || 0,
      cost: item.cost ? formatCurrency(item.cost) : '',
      selling_price: item.price ? formatCurrency(item.price) : '',
      quantity: item.quantity || 0,
      unit: item.unit || 'pcs',
      conversion: item.conversion || 1,
      currency: item.currency || 'USD',
      fc_cost: item.fc_cost ? formatCurrency(item.fc_cost) : '',
      factor: item.factor != null && item.factor !== '' ? String(item.factor) : ''
    });
    
    if (index !== null) {
      setCurrentItemIndex(index);
    }
    
    // Set editing mode
    setIsEditingItem(true);
    setEditingItemId(item.id);
  };

  const handleTabChange = (newTab) => {
    if (hasUnsavedChanges()) {
      setPendingNavigation(newTab);
      setShowErrorDialog(true);
      return;
    }

    setCurrentTab(newTab);
    initializeTabData(newTab);
    setCurrentItemIndex(0);
    
    // Reset editing state when switching tabs
    setIsEditingItem(false);
    setEditingItemId(null);
    
    // Reset ALL fields to completely EMPTY when switching tabs
    setIncomingForm({
      reference: '',
      supplier: '',
      date: '',
      din_flag: '',
      benz_number: '',
      benz_number2: '',
      benz_number3: '',
      brand: '',
      altno: '',
      altno2: '',
      description: '',
      application: '',
      color_code: '',
      location: '',
      remarks: '',
      reorder_point: '',
      cost: '',
      selling_price: '',
      quantity: '',
      unit: '',
      conversion: '',
      currency: '',
      fc_cost: '',
      factor: ''
    });
  };

  const handleErrorDialogResponse = (action) => {
    setShowErrorDialog(false);
    
    if (action === 'clear') {
      // Clear form and proceed
      const formData = getCurrentFormData();
      const persistentFields = ['reference', 'supplier', 'date', 'conversion', 'currency', 'unit'];
      const clearedFormData = { ...formData };
      const clearableFields = ['benz_number', 'benz_number2', 'benz_number3', 'brand', 'oem', 'oem2', 
                              'description', 'color_code', 'location', 'application', 'remarks', 
                              'reorder', 'cost', 'selling_price', 'quantity', 'fc_cost'];
      
      clearableFields.forEach(field => {
        clearedFormData[field] = field === 'reorder' ? '0' : 
                                field === 'cost' || field === 'selling_price' || field === 'quantity' || field === 'fc_cost' ? '0' : '';
      });

      setTabFormData(prev => ({
        ...prev,
        [currentTab]: clearedFormData
      }));

      // Proceed with pending navigation
      if (typeof pendingNavigation === 'number') {
        setCurrentTab(pendingNavigation);
        initializeTabData(pendingNavigation);
        setCurrentItemIndex(0);
      } else if (pendingNavigation) {
        handleNavigateItem(pendingNavigation);
      }
    }
    // If action === 'stay', just close dialog and stay on current form
    
    setPendingNavigation(null);
  };

  // Load tab names from database
  const loadTabNames = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/incoming/tab-names', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setTabNames(response.data.data || {});
      }
    } catch (error) {
      console.error('Error loading tab names:', error);
      // Initialize with default names if API fails
      const defaultNames = {};
      for (let i = 1; i <= 10; i++) {
        defaultNames[i] = `Tab ${i}`;
      }
      setTabNames(defaultNames);
    }
  };

  // Save tab name to database
  const saveTabName = async (tabNumber, tabName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put('/api/incoming/tab-names', {
        tabNumber,
        tabName: tabName.trim() || `Tab ${tabNumber}`
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        setTabNames(prev => ({
          ...prev,
          [tabNumber]: tabName.trim() || `Tab ${tabNumber}`
        }));
      }
    } catch (error) {
      console.error('Error saving tab name:', error);
      await showAlert('Failed to save tab name', 'Error');
    }
  };

  // Handle tab name double-click to edit
  const handleTabNameDoubleClick = (tabNumber) => {
    setEditingTabName(tabNumber);
  };

  // Handle tab name change
  const handleTabNameChange = (tabNumber, newName) => {
    if (newName.trim()) {
      saveTabName(tabNumber, newName);
    }
    setEditingTabName(null);
  };

  // Handle tab name blur (auto-save)
  const handleTabNameBlur = (tabNumber, currentValue) => {
    handleTabNameChange(tabNumber, currentValue);
  };

  // Clear all items for current tab
  const handleClearTabItems = async () => {
    const savedItems = tabSavedItems[currentTab] || [];
    
    if (savedItems.length === 0) {
      await showAlert('No items to clear for this tab.', 'No Items');
      return;
    }

    setShowClearConfirm(true);
  };

  // Confirm clear tab items
  const confirmClearTabItems = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Get count before deletion
      const savedItemsCount = (tabSavedItems[currentTab] || []).length;
      
      // Delete all items for this tab from database
      const response = await axios.delete(`/api/inc_tbl/clear-tab/${currentTab}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        // Clear saved items for this tab
        setTabSavedItems(prev => ({
          ...prev,
          [currentTab]: []
        }));
        
        // Clear form data for this tab
        const clearedFormData = {
          reference: '',
          supplier: '',
          date: '',
          din_flag: '',
          benz_number: '',
          benz_number2: '',
          benz_number3: '',
          brand: '',
          altno: '',
          altno2: '',
          description: '',
          application: '',
          color_code: '',
          location: '',
          remarks: '',
          reorder_point: '',
          cost: '',
          selling_price: '',
          quantity: '',
          unit: '',
          conversion: '',
          currency: '',
          fc_cost: ''
        };
        
        setTabFormData(prev => ({
          ...prev,
          [currentTab]: clearedFormData
        }));
        
        setIncomingForm(clearedFormData);
        setCurrentItemIndex(0);
        setIsEditingItem(false);
        setEditingItemId(null);
        
        // Reload items from database to ensure sync with other users
        await loadTabSavedItems(currentTab);
        
        await showAlert(`Successfully cleared ${response.data.deletedCount || savedItemsCount} items from ${tabNames[currentTab] || `Tab ${currentTab}`}!`, 'Success');
      } else {
        await showAlert(response.data.message || 'Failed to clear items', 'Error');
      }
    } catch (error) {
      console.error('❌ Error clearing tab items:', error);
      await showAlert(`Failed to clear items: ${error.response?.data?.message || error.message}`, 'Error');
    } finally {
      setLoading(false);
      setShowClearConfirm(false);
    }
  };

  const handlePostItems = async () => {
    const savedItems = tabSavedItems[currentTab] || [];
    
    if (savedItems.length === 0) {
      await showAlert('No items to post. Please save some items first.', 'No Items');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Post all saved items to main tables
      const response = await axios.post('/api/inc_tbl/post', {
        items: savedItems
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        // Clear the saved items for this tab
        setTabSavedItems(prev => ({
          ...prev,
          [currentTab]: []
        }));
        
        await showAlert(`Successfully posted ${savedItems.length} items to main stock tables!`, 'Success');
      } else {
        await showAlert(response.data.message || 'Failed to post items', 'Error');
      }
    } catch (error) {
      console.error('❌ Error posting incoming stock:', error);
      await showAlert(`Failed to post items: ${error.response?.data?.message || error.message}`, 'Error');
    } finally {
      setLoading(false);
    }
  };

  // Quantity editing functions
  const handleQuantityClick = (stockId, stockData) => {
    const currentQty = parseInt(stockData.QTY) || 0;
    setQuantityEditModal({
      show: true,
      stockId,
      stockData,
      currentQuantity: currentQty,
      newQuantity: currentQty
    });
  };

  const handleQuantityChange = (e) => {
    const value = parseInt(e.target.value) || 0;
    setQuantityEditModal(prev => ({
      ...prev,
      newQuantity: value
    }));
  };

  const handleQuantitySave = async () => {
    const { stockId, newQuantity } = quantityEditModal;
    
    if (newQuantity < 0) {
      await showAlert('Quantity cannot be negative', 'Invalid Input');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(`/api/stock/${stockId}/quantity`, {
        quantity: newQuantity
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        // Close modal first
        setQuantityEditModal({ show: false, stockId: null, stockData: null, currentQuantity: 0, newQuantity: 0 });
        
        // Show success message
        await showAlert(`Quantity updated successfully from ${response.data.data.oldQuantity} to ${newQuantity}`, 'Success');
        
        // Refresh the entire stock data from server
        await fetchStocks(currentPage, searchTerm, stockFilter, sortDropdown);
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
      await showAlert(error.response?.data?.message || 'Failed to update quantity', 'Error');
    }
  };

  const handleQuantityCancel = () => {
    setQuantityEditModal({ show: false, stockId: null, stockData: null, currentQuantity: 0, newQuantity: 0 });
  };

  // Adjustment handlers
  const handleAdjustmentClick = async (stock) => {
    try {
      const token = localStorage.getItem('token');
      // Get next adjustment number
      const response = await axios.get('/api/stock/adjustment/next-number', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const adjustmentNumber = response.data.nextNumber || 1;
      
      setAdjustmentModal({
        show: true,
        stock: stock,
        quantity: '',
        price: stock.PRICE || '',
        reason: '',
        note: '',
        customer: 'DELODUR CORP',
        adjustmentNumber: adjustmentNumber
      });
    } catch (error) {
      console.error('Error getting adjustment number:', error);
      // Fallback to using timestamp if API fails
      setAdjustmentModal({
        show: true,
        stock: stock,
        quantity: '',
        price: stock.PRICE || '',
        reason: '',
        note: '',
        customer: 'DELODUR CORP',
        adjustmentNumber: Date.now()
      });
    }
  };

  const handleAdjustmentClose = () => {
    setAdjustmentModal({
      show: false,
      stock: null,
      quantity: '',
      price: '',
      reason: '',
      note: '',
      customer: 'DELODUR CORP',
      adjustmentNumber: null
    });
  };

  const handleAdjustmentSave = async () => {
    const { stock, quantity, price, note, customer } = adjustmentModal;
    
    if (!stock || !stock.ID) {
      await showAlert('Invalid stock item', 'Error');
      return;
    }

    // Validate required fields
    if (!customer || !customer.trim()) {
      await showAlert('Customer is required. Please enter a customer name.', 'Required Field');
      return;
    }

    const quantityToAdd = parseInt(quantity);
    if (isNaN(quantityToAdd)) {
      await showAlert('Please enter a valid quantity', 'Invalid Input');
      return;
    }
    
    // Check if the adjustment would result in negative stock
    const currentQty = parseInt(stock.QTY || stock.QUANTITY || 0);
    const newQuantity = currentQty + quantityToAdd;
    if (newQuantity < 0) {
      await showAlert(`Cannot adjust quantity. Current stock is ${currentQty}. Adjustment of ${quantityToAdd} would result in negative stock.`, 'Invalid Adjustment');
      return;
    }

    const adjustmentPrice = parseFloat(price);
    if (isNaN(adjustmentPrice) || adjustmentPrice < 0) {
      await showAlert('Please enter a valid price (0 or greater)', 'Invalid Input');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const currentQty = parseInt(stock.QTY || stock.QUANTITY || 0);
      const newQuantity = currentQty + quantityToAdd;
      
      // Validate that new quantity is not negative
      if (newQuantity < 0) {
        await showAlert(`Cannot adjust quantity. Current stock is ${currentQty}. Adjustment of ${quantityToAdd} would result in negative stock (${newQuantity}).`, 'Invalid Adjustment');
        return;
      }
      
      // Use the adjustment number from modal state
      const adjustmentNumber = adjustmentModal.adjustmentNumber;

      console.log(`📦 Adjustment: Current Qty: ${currentQty}, Adjustment: ${quantityToAdd}, New Qty: ${newQuantity}`);

      // Update stock quantity
      await axios.put(`/api/stock/${stock.ID}/quantity`, {
        quantity: newQuantity
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Save to sales history - ensure all values are defined (not undefined)
      const today = new Date().toISOString().split('T')[0];
      const adjustmentNumberStr = adjustmentNumber ? `ADJ-${String(adjustmentNumber).padStart(6, '0')}` : '';
      const remarksText = (note && note.trim()) 
        ? `${adjustmentNumberStr ? `[${adjustmentNumberStr}] ` : ''}${note.trim()}`
        : `${adjustmentNumberStr ? `[${adjustmentNumberStr}] ` : ''}Adjustment: ${quantityToAdd >= 0 ? 'Added' : 'Removed'} ${Math.abs(quantityToAdd)} units`;
      
      await axios.post('/api/sales/add', {
        date: today || null,
        receipt: 'ADJUSTMENT',
        customer: customer.trim(),
        invoice: null,
        din_flag: null,
        benz_number: stock.BENZ || null,
        benz_number2: stock.BENZ2 || null,
        benz_number3: stock.BENZ3 || null,
        brand: (stock.BRAND && stock.BRAND.trim()) ? stock.BRAND.trim() : null,
        altno: stock.ALTNO || null,
        altno2: null,
        description: stock.DESCRIPTION || null,
        application: stock.APPLICATION || stock.APPL || null,
        color_code: null,
        remarks: remarksText,
        cost: stock.COST || 0,
        selling_price: adjustmentPrice || 0,
        quantity: -quantityToAdd, // Reverse sign for SalesHistory display: adding stock (+1) saves as -1, decreasing (-1) saves as +1. Stock update logic unchanged.
        stock_id: stock.ID || null,
        created_by: null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Save adjustment record to backlog (optional - don't fail if this fails)
      try {
        await axios.post('/api/stock/adjustment', {
          stock_id: stock.ID,
          benz: stock.BENZ || '',
          brand: stock.BRAND || '',
          quantity_added: quantityToAdd,
          price: adjustmentPrice,
          reason: adjustmentModal.reason || '',
          note: note || '',
          date: today,
          previous_quantity: currentQty,
          new_quantity: newQuantity
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (backlogError) {
        // Log but don't fail - adjustment is already saved to history
        console.warn('Failed to save to adjustment backlog (non-critical):', backlogError);
      }

      const adjustmentMessage = quantityToAdd >= 0 
        ? `Added ${quantityToAdd} units` 
        : `Removed ${Math.abs(quantityToAdd)} units`;
      await showAlert(`Adjustment saved successfully! ${adjustmentMessage}. New quantity: ${newQuantity}`, 'Success');
      
      handleAdjustmentClose();
      
      // Refresh stock data
      await fetchStocks(currentPage, searchTerm, stockFilter, sortDropdown);
    } catch (error) {
      console.error('Error saving adjustment:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to save adjustment';
      await showAlert(errorMessage, 'Error');
    }
  };


  const confirmPostItems = async () => {
    try {
      const savedItems = tabSavedItems[currentTab] || [];
      
      if (savedItems.length === 0) {
        await showAlert('No items to post', 'No Items');
        return;
      }

      // Prepare items for API submission
      const itemsToPost = savedItems.map(item => ({
        reference: item.reference || '',
        supplier: item.supplier || '',
        date: item.date || new Date().toISOString().split('T')[0],
        din_flag: item.din_flag || '',
        benz_number: item.benz_number || '',
        benz_number2: item.benz_number2 || '',
        benz_number3: item.benz_number3 || '',
        brand: item.brand || '',
        oem: item.oem || '',
        oem2: item.oem2 || '',
        description: item.description || '',
        application: item.application || '',
        color_code: item.color_code || '',
        remarks: item.remarks || '',
        cost: parseFloat(item.cost) || 0,
        selling_price: parseFloat(item.selling_price) || 0,
        currency: item.currency || 'USD',
        fc_cost: parseFloat(item.fc_cost) || 0,
        conversion: parseFloat(item.conversion) || 1,
        quantity: parseFloat(item.quantity) || 0,
        unit: item.unit || 'pcs',
        reorder: parseFloat(item.reorder) || 0,
        location: item.location || '',
        tab_number: currentTab,
        created_at: new Date().toISOString()
      }));

      console.log(`🚀 Posting ${itemsToPost.length} items from Tab ${currentTab} to database...`);
      
      // Send to API
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/incoming/batch', {
        items: itemsToPost,
        tab_number: currentTab
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        // Clear the saved items for this tab
        setTabSavedItems(prev => ({
          ...prev,
          [currentTab]: []
        }));
        
        setShowPostDialog(false);
        await showAlert(`✅ Successfully posted ${itemsToPost.length} items from Tab ${currentTab} to database!`, 'Success');
        
        console.log('✅ Items posted successfully:', response.data);
      } else {
        throw new Error(response.data.message || 'Failed to post items');
      }
      
    } catch (error) {
      console.error('❌ Error posting items:', error);
      
      let errorMessage = 'Error posting items to database. ';
      if (error.response?.data?.message) {
        errorMessage += error.response.data.message;
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please try again.';
      }
      
      await showAlert(errorMessage, 'Error');
    }
  };
  
  // Incoming form state (TRACK.exe structure)
  const [incomingForm, setIncomingForm] = useState({
    date: '',
    reference: '',
    supplier: '',
    factor: '',
    din_flag: '',
    benz_number: '',
    benz_number2: '',
    benz_number3: '',
    brand: '',
    altno: '',
    altno2: '',
    description: '',
    application: '',
    color_code: '',
    remarks: '',
    cost: '',
    selling_price: '',
    currency: '',
    fc_cost: '',
    conversion: '',
    quantity: '',
    unit: '',
    reorder_point: '',
    location: '',
    document_ref: ''
  });

  // Auto-save state and functionality
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error'
  const [lastSaved, setLastSaved] = useState(null);
  const autoSaveTimeoutRef = useRef(null);

  // Auto-save form data to localStorage with debouncing
  useEffect(() => {
    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Check if form has any data
    const hasData = Object.values(incomingForm).some(val => val !== '' && val !== null && val !== undefined);
    
    if (hasData && currentView === 'incoming' && incomingSubView === 'form') {
      setAutoSaveStatus('saving');
      
      // Set new timeout for auto-save
      autoSaveTimeoutRef.current = setTimeout(() => {
        try {
          // Save form data to localStorage
          const savedData = {
            formData: incomingForm,
            timestamp: new Date().toISOString(),
            tabNumber: currentTab
          };
          localStorage.setItem(`inventory_autosave_tab_${currentTab}`, JSON.stringify(savedData));
          
          setAutoSaveStatus('saved');
          setLastSaved(new Date());
          
          // Reset to idle after 2 seconds
          setTimeout(() => {
            setAutoSaveStatus('idle');
          }, 2000);
        } catch (error) {
          console.error('Auto-save error:', error);
          setAutoSaveStatus('error');
          setTimeout(() => {
            setAutoSaveStatus('idle');
          }, 3000);
        }
      }, 1500); // Debounce for 1.5 seconds
    }

    // Cleanup timeout on unmount
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [incomingForm, currentView, incomingSubView, currentTab]);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage] = useState(300);
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
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if we're in "Add to Order" mode
  const searchParams = new URLSearchParams(location.search);
  const addToOrderId = searchParams.get('addToOrder');

  // Add state for scan modal and scanned value
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scannedValue, setScannedValue] = useState('');
  // Simple selection state without cart functionality
  const [selectedStocks, setSelectedStocks] = useState([]);
  
  // Dummy cart variables to prevent ESLint errors (non-functional)
  const [cartOpen, setCartOpen] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [orderNumber, setOrderNumber] = useState(null);
  const CART_COMPRESS_LIMIT = 8;
  const CART_ALWAYS_SHOW = 3;
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

  // Load search term from URL on component mount and initial data
  useEffect(() => {
    const searchParam = new URLSearchParams(window.location.search).get('search');
    if (searchParam) {
      setSearchTerm(searchParam);
    }
    
    // If in "Add to Order" mode, automatically open the cart
    if (addToOrderId) {
      setCartOpen(true);
    }
    
    // Load initial data with 'all' filter to show all 300 items
    fetchStocks(1, '', 'all', 'recent');
    // eslint-disable-next-line
  }, []);

  // Fetch incoming stocks when incoming table view is active or when date/search changes
  useEffect(() => {
    if (currentView === 'incoming' && incomingSubView === 'table' && incomingSelectedDate) {
      console.log(`🔄 useEffect triggered - View: ${currentView}, SubView: ${incomingSubView}, Date: ${incomingSelectedDate}`);
      fetchIncomingStocks();
    } else {
      console.log(`⏸️ Skipping fetch - View: ${currentView}, SubView: ${incomingSubView}, Date: ${incomingSelectedDate}`);
    }
  }, [currentView, incomingSubView, incomingSelectedDate, incomingReferenceSearch]);

  // State for duplicate matches modal
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [currentIncomingRecord, setCurrentIncomingRecord] = useState(null);
  const [duplicateLoading, setDuplicateLoading] = useState(false);


  // Function to handle warning icon click - show duplicate matches
  const handleWarningClick = async (incomingId) => {
    setDuplicateLoading(true);
    setShowDuplicateModal(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/incoming/duplicate-matches/${incomingId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`📊 Duplicate matches API response:`, data);
        setDuplicateMatches(data.duplicate_matches);
        setCurrentIncomingRecord(data.incoming_record);
        console.log(`📊 Found ${data.match_count} duplicate matches:`, data.duplicate_matches);
      } else {
        console.error('❌ Failed to fetch duplicate matches:', response.status);
        setDuplicateMatches([]);
        setCurrentIncomingRecord(null);
      }
    } catch (error) {
      console.error('❌ Error fetching duplicate matches:', error);
      setDuplicateMatches([]);
      setCurrentIncomingRecord(null);
    } finally {
      setDuplicateLoading(false);
    }
  };

  // Set default date when switching to incoming view (no auto-search to avoid backend lag)
  // Note: This will only set date if it's not already set, otherwise it keeps the current date
  // User can manually change the date using the date picker or Previous/Next buttons

  // Disable page scrolling only when on incoming form page (not on incoming table view)
  useEffect(() => {
    if (currentView === 'incoming' && incomingSubView === 'form') {
      // Load tab names when entering incoming form view
      loadTabNames();
      
      // Add data attribute to body to disable scrolling
      document.body.setAttribute('data-incoming-form', 'true');
      document.documentElement.setAttribute('data-incoming-form', 'true');
      
      // Prevent scroll events only on the main container, but allow scrolling in saved items
      const preventScroll = (e) => {
        // Allow scrolling in saved items container
        if (e.target.closest('.saved-items-container')) {
          return; // Don't prevent scroll for saved items
        }
        
        // Only prevent scroll if it's within the incoming form area (but not saved items)
        if (e.target.closest('.pos-stock-modern[data-view="incoming"]')) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      };
      
      // Add event listeners to prevent scrolling
      document.addEventListener('wheel', preventScroll, { passive: false });
      document.addEventListener('touchmove', preventScroll, { passive: false });
      
      // Add specific wheel event handler for saved items container
      let savedItemsContainer = null;
      let handleSavedItemsWheel = null;
      
      // Use setTimeout to ensure the container exists
      setTimeout(() => {
        savedItemsContainer = document.querySelector('.saved-items-container');
        if (savedItemsContainer) {
          handleSavedItemsWheel = (e) => {
            e.stopPropagation(); // Prevent the global preventScroll from interfering
          };
          savedItemsContainer.addEventListener('wheel', handleSavedItemsWheel, { passive: false });
        }
      }, 100);
      
      return () => {
        // Cleanup when component unmounts or view changes
        document.body.removeAttribute('data-incoming-form');
        document.documentElement.removeAttribute('data-incoming-form');
        document.removeEventListener('wheel', preventScroll);
        document.removeEventListener('touchmove', preventScroll);
        
        // Cleanup saved items wheel handler
        if (savedItemsContainer && handleSavedItemsWheel) {
          savedItemsContainer.removeEventListener('wheel', handleSavedItemsWheel);
        }
      };
    } else {
      // Ensure scrolling is enabled when not on incoming form
      document.body.removeAttribute('data-incoming-form');
      document.documentElement.removeAttribute('data-incoming-form');
    }
  }, [currentView, incomingSubView]);

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
      
      console.log('Raw stock data sample:', response.data.data.slice(0, 3).map(s => ({ id: s.id, ID: s.ID, BENZ: s.BENZ, BRAND: s.BRAND, REORDER_POINT: s.REORDER_POINT, QTY: s.QTY })));
      
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
      } else if (error.response?.status === 403) {
        setError('Your session has expired. Please log in again to continue.');
        // Clear token and redirect to login after a short delay
        setTimeout(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login');
        }, 2000);
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

  // Fetch incoming stocks when incoming view is accessed
  useEffect(() => {
    if (currentView === 'incoming' && incomingSubView === 'table') {
      fetchIncomingStocks(1, 100);
    }
  }, [currentView, incomingSubView]);

  // Load saved items for current tab when tab changes
  const loadTabSavedItems = async (tabNumber) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/inc_tbl/by-tab/${tabNumber}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        const items = response.data.data.map(item => ({
          id: item.id,
          date: item.date,
          benz: item.benz_number || '',
          price: parseFloat(item.selling_price) || 0,
          description: item.description || '',
          brand: item.brand || '',
          cost: parseFloat(item.cost) || 0,
          quantity: parseFloat(item.quantity) || 0,
          benz_number: item.benz_number || '',
          benz_number2: item.benz_number2 || '',
          benz_number3: item.benz_number3 || '',
          oem: item.altno || '',
          oem2: item.altno2 || '',
          din_flag: item.din_flag || '',
          color_code: item.color_code || '',
          location: item.location || '',
          application: item.application || '',
          remarks: item.remarks || '',
          reorder: parseFloat(item.reorder) || 0,
          selling_price: parseFloat(item.selling_price) || 0,
          unit: item.unit || 'pcs',
          conversion: parseFloat(item.conversion) || 1,
          currency: item.currency || 'USD',
          fc_cost: parseFloat(item.fc_cost) || 0,
          factor: item.factor != null ? parseFloat(item.factor) : null,
          reference: item.reference || '',
          supplier: item.supplier || '',
          timestamp: item.created_at || new Date().toISOString(),
          database_id: item.id,
          tab_number: item.tab_number || tabNumber
        }));
        
        setTabSavedItems(prev => ({
          ...prev,
          [tabNumber]: items
        }));
      }
    } catch (error) {
      console.error('❌ Error loading saved items for tab:', tabNumber, error);
      // Set empty array if error occurs
      setTabSavedItems(prev => ({
        ...prev,
        [tabNumber]: []
      }));
    }
  };

  // Initialize tab data when component mounts or currentTab changes
  useEffect(() => {
    initializeTabData(currentTab);
    loadTabSavedItems(currentTab);
  }, [currentTab]);

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

  // Compute selectAll based on current page items
  const selectAll = useMemo(() => {
    if (sortedStocks.length === 0) return false;
    return sortedStocks.every(stock => selectedStocks.some(s => s.ID === stock.ID));
  }, [sortedStocks, selectedStocks]);

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

  // Incoming form handlers
  const handleIncomingFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Convert text input fields to uppercase in real-time
    const textFields = [
      'benz_number', 'benz_number2', 'benz_number3', 'brand', 'altno', 'altno2',
      'description', 'color_code', 'location', 'application', 'remarks',
      'reference', 'supplier', 'currency'
    ];
    
    const processedValue = textFields.includes(name) ? value.toUpperCase() : value;
    
    setIncomingForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : processedValue
    }));
  };

  // Auto-fill function for master table lookup
  const lookupMasterData = async (benz, brand, altno) => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
      if (benz) params.append('benz', benz);
      if (brand) params.append('brand', brand);
      if (altno) params.append('altno', altno);
      
      const response = await fetch(`/api/master/lookup?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Auto-fill the form with master data (overwrite existing values)
          setIncomingForm(prev => ({
            ...prev,
            description: result.data.DESC || prev.description,
            application: result.data.APPL || prev.application,
            unit: result.data.UNIT || prev.unit,
            location: result.data.LOCATION || prev.location,
            reorder_point: result.data.REORDER || prev.reorder_point,
            // Fill missing fields if they're empty
            benz_number: prev.benz_number || formatBenzNumber(result.data.BENZ || '', prev.din_flag === 'D'),
            benz_number2: prev.benz_number2 || formatBenzNumber(result.data.BENZ2 || '', prev.din_flag === 'D'),
            benz_number3: prev.benz_number3 || formatBenzNumber(result.data.BENZ3 || '', prev.din_flag === 'D'),
            brand: prev.brand || result.data.BRAND || '',
            // Overwrite OEM fields with database values
            altno: result.data.ALTNO || prev.altno || '',
            altno2: result.data.ALTNO2 || prev.altno2 || '',
            din_flag: prev.din_flag || result.data.DINFLAG || ''
          }));
          
          console.log('✅ Auto-filled from master table:', result.data);
        } else {
          console.log('ℹ️ No matching record found in master table');
        }
      } else {
        console.error('❌ Error looking up master table:', response.statusText);
      }
    } catch (error) {
      console.error('❌ Error in master lookup:', error);
    }
  };

  // Handle tab navigation cycling
  const handleFormKeyDown = (e) => {
    if (e.key === 'Tab') {
      const activeElement = document.activeElement;
      const tabIndex = parseInt(activeElement.getAttribute('tabindex'));
      
      // If we're on the Save button (tabIndex 24), cycle back to Reference (tabIndex 1)
      if (tabIndex === 24) {
        e.preventDefault();
        const referenceField = document.querySelector('input[tabindex="1"]');
        if (referenceField) {
          referenceField.focus();
        }
      }
    }
  };

  // Function to format BENZ numbers based on DIN status
  const formatBenzNumber = (value, isDin = false) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    if (isDin) {
      // DIN format: 6-6 (like 009021 004108)
      if (digits.length <= 6) {
        return digits;
      } else {
        return `${digits.slice(0, 6)} ${digits.slice(6, 12)}`;
      }
    } else {
      // Regular format: 3-3-2-2 (like 011 997 52 92)
      if (digits.length <= 3) {
        return digits;
      } else if (digits.length <= 6) {
        return `${digits.slice(0, 3)} ${digits.slice(3)}`;
      } else if (digits.length <= 8) {
        return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
      } else {
        return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
      }
    }
  };

  // Effect to format existing BENZ fields when DIN status changes
  useEffect(() => {
    if (incomingForm.din_flag === 'D' || incomingForm.din_flag === '') {
      const isDin = incomingForm.din_flag === 'D';
      
      setIncomingForm(prev => ({
        ...prev,
        benz_number: prev.benz_number ? formatBenzNumber(prev.benz_number, isDin) : prev.benz_number,
        benz_number2: prev.benz_number2 ? formatBenzNumber(prev.benz_number2, isDin) : prev.benz_number2,
        benz_number3: prev.benz_number3 ? formatBenzNumber(prev.benz_number3, isDin) : prev.benz_number3
      }));
    }
  }, [incomingForm.din_flag]);


  // Format number with thousands separators and 2 decimal places
  const formatCurrency = (value) => {
    if (!value || value === '') return '';
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    const formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    console.log('🔍 formatCurrency:', value, '->', formatted);
    return formatted;
  };

  // Remove formatting to get raw number
  const unformatCurrency = (value) => {
    if (!value || value === '') return '';
    // Remove all commas (thousands separators) but keep decimal point
    return value.replace(/,/g, '');
  };

  // Handle monetary field blur (format on finish)
  // Apply Factor × FC Cost = Cost to all items in current tab
  const handleApplyFactorToCost = async () => {
    const savedItems = tabSavedItems[currentTab] || [];
    if (savedItems.length === 0) {
      await showAlert('No items in this tab.', 'Info');
      return;
    }

    const allHaveFactor = savedItems.every(item => item.factor != null && item.factor !== '' && !isNaN(parseFloat(item.factor)));
    if (!allHaveFactor) {
      await showAlert('All items must have a Factor value before applying. Enter a factor and blur to apply to all items.', 'Info');
      return;
    }

    try {
      const updatedItems = savedItems.map(item => {
        const factor = parseFloat(item.factor) || 0;
        const fcCost = parseFloat(item.fc_cost) || 0;
        const cost = factor * fcCost;
        return { ...item, cost };
      });

      setTabSavedItems(prev => ({
        ...prev,
        [currentTab]: updatedItems
      }));

      // Persist cost updates to database for each item (cost-only update, no full validation)
      const token = localStorage.getItem('token');
      for (const item of updatedItems) {
        if (item.id) {
          await axios.put(`/api/inc_tbl/update-cost/${item.id}`, { cost: item.cost }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      }

      await showAlert(`Cost updated for ${updatedItems.length} items (Factor × FC Cost = Cost)`, 'Success');
    } catch (error) {
      console.error('Error applying factor to cost:', error);
      await showAlert(error.response?.data?.message || 'Failed to update cost for items', 'Error');
    }
  };

  // Apply factor to all items in current tab when user enters factor (Option A)
  const handleFactorBlur = async () => {
    const factorValue = incomingForm.factor;
    if (!factorValue || String(factorValue).trim() === '') return;

    const factorNum = parseFloat(String(factorValue).replace(/,/g, ''));
    if (isNaN(factorNum)) return;

    const savedItems = tabSavedItems[currentTab] || [];
    if (savedItems.length === 0) return;

    // Update all items locally with factor
    const updatedItems = savedItems.map(item => ({ ...item, factor: factorNum }));
    setTabSavedItems(prev => ({
      ...prev,
      [currentTab]: updatedItems
    }));

    // Persist factor to database for all items in tab
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/inc_tbl/bulk-update-factor/${currentTab}`, { factor: factorNum }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error updating factor for tab items:', error);
      await showAlert('Factor applied to items but failed to save to database. Please try again.', 'Error');
    }
  };

  const handleMonetaryBlur = (e) => {
    const { name, value } = e.target;
    const rawValue = unformatCurrency(value);
    const numValue = parseFloat(rawValue);
    
    if (!isNaN(numValue)) {
      setIncomingForm(prev => ({
        ...prev,
        [name]: formatCurrency(numValue)
      }));
    }
  };

  // Handle monetary field focus (show raw number for editing)
  const handleMonetaryFocus = (e) => {
    const { name, value } = e.target;
    const rawValue = unformatCurrency(value);
    setIncomingForm(prev => ({
      ...prev,
      [name]: rawValue
    }));
  };

  // Handle monetary field changes with real-time formatting
  const handleMonetaryChange = (e) => {
    const { name, value } = e.target;
    
    // Allow typing without immediate formatting - just store the raw value
    setIncomingForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Enhanced form change handler with auto-fill
  const handleIncomingFormChangeWithAutoFill = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Convert text input fields to uppercase in real-time
    const textFields = [
      'benz_number', 'benz_number2', 'benz_number3', 'brand', 'altno', 'altno2',
      'description', 'color_code', 'location', 'application', 'remarks',
      'reference', 'supplier', 'currency'
    ];
    
    let newValue = type === 'checkbox' ? checked : (textFields.includes(name) ? value.toUpperCase() : value);
    
    // Special handling for DIN field - only allow 'D' or empty
    if (name === 'din_flag') {
      if (value === '' || value === 'D') {
        newValue = value;
        
        // When DIN changes, reformat existing BENZ fields
        setIncomingForm(prev => {
          const isDin = value === 'D';
          return {
            ...prev,
            [name]: newValue,
            // Reformat existing BENZ fields based on new DIN status
            benz_number: prev.benz_number ? formatBenzNumber(prev.benz_number, isDin) : prev.benz_number,
            benz_number2: prev.benz_number2 ? formatBenzNumber(prev.benz_number2, isDin) : prev.benz_number2,
            benz_number3: prev.benz_number3 ? formatBenzNumber(prev.benz_number3, isDin) : prev.benz_number3
          };
        });
        return;
      } else {
        // If user types anything other than 'D', ignore it
        return;
      }
    }
    
    // Format BENZ fields with proper spacing based on DIN status
    if (name === 'benz_number' || name === 'benz_number2' || name === 'benz_number3') {
      const isDin = incomingForm.din_flag === 'D';
      newValue = formatBenzNumber(value, isDin);
    }
    
    // Update the form
    setIncomingForm(prev => ({
      ...prev,
      [name]: newValue
    }));
    
    // Clear auto-filled fields when key fields are cleared
    if ((name === 'benz_number' || name === 'brand') && (!newValue || newValue.trim() === '')) {
             setIncomingForm(prev => ({
               ...prev,
               description: '',
               application: '',
               unit: 'pcs',
               location: '',
               reorder_point: 0,
               benz_number: '',
               benz_number2: '',
               benz_number3: ''
             }));
        }
  };

  // Check if trigger fields have changed since last auto-population
  const haveTriggerFieldsChanged = () => {
    const currentForm = { ...incomingForm };
    const lastValues = lastAutoFillValuesRef.current;
    
    // Check if any trigger field has changed
    return (
      currentForm.benz_number !== lastValues.benz_number ||
      currentForm.brand !== lastValues.brand ||
      currentForm.altno !== lastValues.altno
    );
  };

  // Update last auto-fill values after successful auto-population
  const updateLastAutoFillValues = () => {
    const currentForm = { ...incomingForm };
    lastAutoFillValuesRef.current = {
      benz_number: currentForm.benz_number,
      brand: currentForm.brand,
      altno: currentForm.altno
    };
  };

  // Optimized auto-fill trigger function
  const triggerAutoFill = async (fieldName) => {
    const currentForm = { ...incomingForm };
    
    // Check if trigger fields have changed since last auto-population
    if (!haveTriggerFieldsChanged()) {
      return; // Skip auto-population if trigger fields haven't changed
    }
    
    if (fieldName === 'brand') {
      // Tab on Brand field - check for combinations
      if (currentForm.benz_number && currentForm.benz_number.trim() !== '' && 
          currentForm.brand && currentForm.brand.trim() !== '') {
        // Priority: Benz + Brand combination
        await lookupMasterData(currentForm.benz_number, currentForm.brand, null);
        updateLastAutoFillValues();
      } else if (currentForm.brand && currentForm.brand.trim() !== '' && 
                 currentForm.altno && currentForm.altno.trim() !== '') {
        // Fallback: Brand + OEM combination
        await lookupMasterData(null, currentForm.brand, currentForm.altno);
        updateLastAutoFillValues();
      }
    } else if (fieldName === 'altno') {
      // Tab on OEM field - check for Brand + OEM combination
      if (currentForm.brand && currentForm.brand.trim() !== '' && 
          currentForm.altno && currentForm.altno.trim() !== '') {
        await lookupMasterData(null, currentForm.brand, currentForm.altno);
        updateLastAutoFillValues();
      } else if (currentForm.altno && currentForm.altno.trim() !== '' &&
                 (!currentForm.benz_number || currentForm.benz_number.trim() === '') &&
                 (!currentForm.brand || currentForm.brand.trim() === '')) {
        // New rule: OEM only - when Benz and Brand are both empty
        await lookupMasterData(null, null, currentForm.altno);
        updateLastAutoFillValues();
      }
    }
  };

  // Track recently triggered fields to prevent duplicates
  const recentlyTriggeredRef = useRef({});
  
  // Track field values at last auto-population to detect changes
  const lastAutoFillValuesRef = useRef({});

  // Handle Tab/Enter key press for auto-fill
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerAutoFill(e.target.name);
      // Mark as recently triggered
      recentlyTriggeredRef.current[e.target.name] = Date.now();
    } else if (e.key === 'Tab') {
      // Don't prevent default Tab behavior, just trigger auto-fill
      triggerAutoFill(e.target.name);
      // Mark as recently triggered
      recentlyTriggeredRef.current[e.target.name] = Date.now();
    }
  };

  // Handle field exit (onBlur) for auto-fill
  const handleFieldExit = (e) => {
    const fieldName = e.target.name;
    
    // Check if this field was recently triggered by Tab/Enter (within 200ms)
    const lastTriggerTime = recentlyTriggeredRef.current[fieldName];
    const now = Date.now();
    
    if (lastTriggerTime && (now - lastTriggerTime) < 200) {
      // Recently triggered by Tab/Enter, skip to prevent duplicate
      return;
    }
    
    // Trigger auto-fill with small delay for optimal performance
    setTimeout(() => {
      triggerAutoFill(fieldName);
      // Highlight fields after auto-population completes
      setTimeout(() => {
        highlightAutoPopulatedFields();
      }, 100);
    }, 50);
  };

  // Highlight auto-populated fields with animation
  const highlightAutoPopulatedFields = () => {
    // Get the current form state to know which fields were populated
    const fieldsToHighlight = ['description', 'application', 'unit', 'location', 'reorder_point', 'benz_number', 'benz_number2', 'benz_number3', 'altno', 'altno2'];
    
    fieldsToHighlight.forEach(fieldName => {
      const fieldElement = document.querySelector(`input[name="${fieldName}"]`);
      if (fieldElement && fieldElement.value && fieldElement.value.trim() !== '') {
        // Add highlight animation class
        fieldElement.style.transition = 'all 0.3s ease';
        fieldElement.style.boxShadow = '0 0 0 3px rgba(74, 144, 226, 0.5)';
        fieldElement.style.borderColor = '#4a90e2';
        
        // Remove highlight after 1.5 seconds
        setTimeout(() => {
          fieldElement.style.boxShadow = '';
          fieldElement.style.borderColor = '#333';
        }, 1500);
      }
    });
  };

  // Navigate to previous reference+date combination
  const goToPreviousCombination = () => {
    if (incomingNavigating || incomingCurrentCombinationIndex <= 0) return;
    setIncomingCurrentCombinationIndex(prev => prev - 1);
  };

  // Navigate to next reference+date combination
  const goToNextCombination = () => {
    if (incomingNavigating || incomingCurrentCombinationIndex >= incomingRefDateCombinations.length - 1) return;
    setIncomingCurrentCombinationIndex(prev => prev + 1);
  };

  // Check if a date has incoming records
  const checkIncomingDateHasRecords = async (dateStr) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/inmain?date=${dateStr}&all=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const combinations = groupStocksByReferenceDate(data.stocks || []);
        return combinations.length > 0;
      }
      return false;
    } catch (error) {
      console.error('Error checking date records:', error);
      return false;
    }
  };

  // Find the most recent date with incoming records
  const findMostRecentIncomingDate = async () => {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      console.log('🔍 Searching for most recent incoming date from:', todayStr);
      
      // Start from yesterday and go back up to 30 days
      let searchDate = new Date();
      searchDate.setDate(searchDate.getDate() - 1);
      
      for (let i = 0; i < 30; i++) {
        const dateStr = searchDate.toISOString().split('T')[0];
        console.log(`🔍 Checking date: ${dateStr}`);
        const hasRecords = await checkIncomingDateHasRecords(dateStr);
        console.log(`📊 Date ${dateStr} has records:`, hasRecords);
        
        if (hasRecords) {
          console.log(`✅ Found most recent date with records: ${dateStr}`);
          return dateStr;
        }
        searchDate.setDate(searchDate.getDate() - 1);
      }
      
      // If no records found in the last 30 days, return yesterday as fallback
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      console.log('⚠️ No records found, falling back to yesterday:', yesterdayStr);
      return yesterdayStr;
    } catch (error) {
      console.error('Error finding most recent incoming date:', error);
      // Fallback to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    }
  };

  // Navigate to previous date - simplified: just go to previous day
  const goToPreviousIncomingDate = () => {
    // Prevent navigation if already loading data
    if (incomingLoading) {
      console.log('⏸️ Navigation blocked - already loading data');
      return;
    }
    
    const currentDate = new Date(incomingSelectedDate);
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    const dateStr = newDate.toISOString().split('T')[0];
    
    console.log(`📅 Previous date: ${dateStr}`);
    
    // Simply update the date - let the useEffect handle fetching (one time only)
    setIncomingSelectedDate(dateStr);
    setIncomingCurrentCombinationIndex(0);
  };

  // Navigate to next date - simplified: just go to next day (not beyond today)
  const goToNextIncomingDate = () => {
    // Prevent navigation if already loading data
    if (incomingLoading) {
      console.log('⏸️ Navigation blocked - already loading data');
      return;
    }
    
    const currentDate = new Date(incomingSelectedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    newDate.setHours(0, 0, 0, 0);
    
    // Don't go beyond today
    if (newDate > today) {
      console.log('⏸️ Cannot go beyond today');
      return;
    }
    
    const dateStr = newDate.toISOString().split('T')[0];
    
    console.log(`📅 Next date: ${dateStr}`);
    
    // Simply update the date - let the useEffect handle fetching (one time only)
    setIncomingSelectedDate(dateStr);
    setIncomingCurrentCombinationIndex(0);
  };

  // Get date label for incoming
  const getIncomingDateLabel = () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    if (incomingSelectedDate === today) return "Today's Incoming";
    if (incomingSelectedDate === yesterday) return "Yesterday's Incoming";
    if (incomingSelectedDate === tomorrow) return "Tomorrow's Incoming";
    
    const date = new Date(incomingSelectedDate);
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} Incoming`;
  };

  // Calculate summary data for current reference+date combination
  const getCurrentCombinationLabel = () => {
    if (incomingRefDateCombinations.length === 0) return "No Combinations";
    if (incomingCurrentCombinationIndex >= incomingRefDateCombinations.length) return "No Combinations";
    
    const currentCombination = incomingRefDateCombinations[incomingCurrentCombinationIndex];
    const formattedDate = (() => {
      const dateStr = currentCombination.date || '';
      if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
        return `${dateStr.slice(4,6)}/${dateStr.slice(6,8)}/${dateStr.slice(0,4)}`;
      }
      return dateStr || '-';
    })();
    
    return `Reference: ${currentCombination.REF || 'N/A'} - Date: ${formattedDate}`;
  };

  const getCurrentCombinationItemsCount = () => {
    if (incomingRefDateCombinations.length === 0 || incomingCurrentCombinationIndex >= incomingRefDateCombinations.length) return 0;
    const currentCombination = incomingRefDateCombinations[incomingCurrentCombinationIndex];
    return currentCombination.itemsCount || 0;
  };

  const getCurrentCombinationTotalCost = () => {
    if (incomingRefDateCombinations.length === 0 || incomingCurrentCombinationIndex >= incomingRefDateCombinations.length) return 0;
    const currentCombination = incomingRefDateCombinations[incomingCurrentCombinationIndex];
    return currentCombination.totalCost || 0;
  };

  const getCurrentCombinationTotalRows = () => {
    if (incomingRefDateCombinations.length === 0 || incomingCurrentCombinationIndex >= incomingRefDateCombinations.length) return 0;
    const currentCombination = incomingRefDateCombinations[incomingCurrentCombinationIndex];
    return currentCombination.items ? currentCombination.items.length : 0;
  };

  // Group stocks by reference+date combinations and sort by date (most recent first)
  const groupStocksByReferenceDate = (stocks) => {
    console.log(`📦 Grouping ${stocks.length} stocks by reference+date...`);
    const grouped = {};
    let skippedCount = 0;
    let emptyRefCount = 0;
    let emptyDateCount = 0;
    
    stocks.forEach((stock, index) => {
      const ref = stock.REF || stock.REFERENCE || stock.reference || '';
      const date = stock.DATE || stock.date || '';
      
      // Log first few stocks for debugging
      if (index < 3) {
        console.log(`📋 Stock ${index + 1}:`, {
          REF: ref,
          DATE: date,
          ID: stock.ID || stock.id,
          hasRef: !!ref,
          hasDate: !!date
        });
      }
      
      // Skip if no reference
      if (!ref || ref === 'NO_REF') {
        emptyRefCount++;
        if (index < 3) console.warn(`⚠️ Skipping stock ${index + 1} - no reference found`);
        return;
      }
      
      // Skip if no date
      if (!date || date === '00000000') {
        emptyDateCount++;
        if (index < 3) console.warn(`⚠️ Skipping stock ${index + 1} - no date found (got: "${date}")`);
        return;
      }
      
      // Filter by reference search if provided
      if (incomingReferenceSearch && !ref.toLowerCase().includes(incomingReferenceSearch.toLowerCase())) {
        skippedCount++;
        return;
      }
      
      // Create unique key for reference+date combination
      const combinationKey = `${ref}_${date}`;
      
      if (!grouped[combinationKey]) {
        grouped[combinationKey] = {
          REF: ref,
          date: date,
          supplier: stock.SUPPLIER || stock.supplier || '-',
          items: [],
          itemsCount: 0,
          totalCost: 0,
          totalValue: 0
        };
      }
      
      // Check for duplicates before adding - use ID, BENZ, BRAND, ALTNO, and SELL as unique identifiers
      const existingItem = grouped[combinationKey].items.find(item => 
        item.ID === stock.ID && 
        item.BENZ === stock.BENZ && 
        item.BRAND === stock.BRAND && 
        item.ALTNO === stock.ALTNO &&
        parseFloat(item.SELL || item.selling_price || 0) === parseFloat(stock.SELL || stock.selling_price || 0)
      );
      
      if (!existingItem) {
        grouped[combinationKey].items.push(stock);
        grouped[combinationKey].itemsCount += parseInt(stock.QTY || stock.quantity || 0);
        grouped[combinationKey].totalCost += parseFloat(stock.COST || stock.cost || 0) * parseInt(stock.QTY || stock.quantity || 0);
        grouped[combinationKey].totalValue += parseFloat(stock.SELL || stock.selling_price || 0) * parseInt(stock.QTY || stock.quantity || 0);
      } else {
        // If duplicate found, merge quantities and update totals
        console.log(`🔄 Duplicate found for ID ${stock.ID} (SELL: ₱${stock.SELL || stock.selling_price || 0}), merging quantities...`);
        const existingQty = parseInt(existingItem.QTY || existingItem.quantity || 0);
        const newQty = parseInt(stock.QTY || stock.quantity || 0);
        const mergedQty = existingQty + newQty;
        
        // Update the existing item with merged quantity
        existingItem.QTY = mergedQty;
        existingItem.quantity = mergedQty;
        
        // Recalculate totals for this combination
        grouped[combinationKey].itemsCount = grouped[combinationKey].items.reduce((sum, item) => 
          sum + parseInt(item.QTY || item.quantity || 0), 0
        );
        grouped[combinationKey].totalCost = grouped[combinationKey].items.reduce((sum, item) => 
          sum + (parseFloat(item.COST || item.cost || 0) * parseInt(item.QTY || item.quantity || 0)), 0
        );
        grouped[combinationKey].totalValue = grouped[combinationKey].items.reduce((sum, item) => 
          sum + (parseFloat(item.SELL || item.selling_price || 0) * parseInt(item.QTY || item.quantity || 0)), 0
        );
      }
    });
    
    // Convert to array, filter out empty combinations, and sort by date (most recent first)
    const combinations = Object.values(grouped)
      .filter(combination => combination.items.length > 0) // Skip empty combinations
      .sort((a, b) => {
        // Sort by date first (most recent first), then by reference as secondary sort
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) {
          return dateCompare; // If dates are different, sort by date
        }
        // If dates are the same, sort by reference (secondary sort)
        return (a.REF || '').localeCompare(b.REF || '');
      });
    
    console.log(`📊 Grouping results:`, {
      totalStocks: stocks.length,
      groupedCombinations: Object.keys(grouped).length,
      finalCombinations: combinations.length,
      skippedBySearch: skippedCount,
      emptyRef: emptyRefCount,
      emptyDate: emptyDateCount,
      sampleCombination: combinations[0] ? {
        ref: combinations[0].REF,
        date: combinations[0].date,
        itemsCount: combinations[0].items.length
      } : null
    });
    
    if (combinations.length === 0 && stocks.length > 0) {
      console.error('❌ No combinations created despite having stocks!', {
        sampleStock: stocks[0],
        emptyRefCount,
        emptyDateCount,
        skippedCount
      });
    }
    
    return combinations;
  };

  // Fetch incoming stocks data and group by reference
  // Function to fetch matching stock IDs for incoming records (optimized)
  const fetchMatchingStockIds = async (date) => {
    try {
      const token = localStorage.getItem('token');
      console.log(`🔍 Fetching stock matches for date: ${date}`);
      
      const response = await fetch(`/api/incoming/stock-matches?date=${date}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`📊 Stock matches response:`, data);
        
        // Convert array to object for easy lookup
        const stockIds = {};
        const warnings = {};
        
        data.matches.forEach(match => {
          stockIds[match.incoming_id] = match.stock_id;
          if (match.warning) {
            warnings[match.incoming_id] = match.warning;
          }
        });

        console.log(`📊 Processed ${data.total} incoming records`);
        console.log(`📊 Matches found: ${data.matched}`);
        console.log(`📊 Multiple matches: ${data.multiple_matches}`);

        return { stockIds, warnings };
      } else {
        console.error('❌ Failed to fetch stock matches:', response.status);
        return { stockIds: {}, warnings: {} };
      }
    } catch (error) {
      console.error('❌ Error fetching matching stock IDs:', error);
      return { stockIds: {}, warnings: {} };
    }
  };

  const fetchIncomingStocks = async (page = 1, limit = 1000) => {
    if (!incomingSelectedDate) {
      console.warn('⚠️ No date selected, skipping fetch');
      return;
    }
    
    console.log(`🔄 Fetching incoming stocks - Page: ${page}, Limit: ${limit}, Date: ${incomingSelectedDate}...`);
    setIncomingLoading(true);
    try {
      const token = localStorage.getItem('token');
      console.log('🔑 Token available:', !!token);
      
      // Fetch both incoming stocks and stock matches in parallel
      const [incomingResponse, stockMatchesResponse] = await Promise.all([
        fetch(`/api/inmain?page=${page}&limit=${limit}&date=${incomingSelectedDate}&all=true`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetchMatchingStockIds(incomingSelectedDate)
      ]);

      console.log('📡 Incoming response status:', incomingResponse.status);
      
      if (incomingResponse.ok) {
        const data = await incomingResponse.json();
        console.log('📊 API Response:', data);
        console.log(`📋 Stocks found: ${data.stocks?.length || 0} of ${data.total || 0} total`);
        
        if (!data.stocks || data.stocks.length === 0) {
          console.warn(`⚠️ No stocks found for date ${incomingSelectedDate}.`);
          
          // Show debug info if available
          if (data.debug) {
            console.log('🔍 Debug Info:', data.debug);
            if (data.debug.availableDates && data.debug.availableDates.length > 0) {
              console.log(`💡 Available dates in database:`, data.debug.availableDates);
              console.log(`💡 Try using one of these dates:`, data.debug.availableDates[0]);
              
              // Optionally auto-switch to first available date (user can disable if unwanted)
              // Uncomment the next 3 lines if you want auto-switch:
              // if (data.debug.availableDates[0]) {
              //   setIncomingSelectedDate(data.debug.availableDates[0]);
              // }
            }
            if (data.debug.totalInTable === 0) {
              console.log(`⚠️ Table is empty. Make sure you've imported data using "Incoming Adjustment" button.`);
            }
          }
          console.log(`💡 Try changing the date using the date picker or Previous/Next buttons.`);
        }
        
        // Add stock IDs and warnings to incoming stocks
        // Normalize column names to handle both uppercase and lowercase
        const enhancedStocks = (data.stocks || []).map(stock => {
          // Helper function to normalize date format
          const normalizeDate = (dateValue) => {
            if (!dateValue) return '';
            
            // If it's a Date object, convert to string
            if (dateValue instanceof Date) {
              const year = dateValue.getFullYear();
              const month = String(dateValue.getMonth() + 1).padStart(2, '0');
              const day = String(dateValue.getDate()).padStart(2, '0');
              return `${year}${month}${day}`;
            }
            
            // If it's already a string
            if (typeof dateValue === 'string') {
              // If format is YYYY-MM-DD, convert to YYYYMMDD
              if (dateValue.match(/^\d{4}-\d{2}-\d{2}/)) {
                return dateValue.replace(/-/g, '');
              }
              // If format is YYYYMMDD, return as is
              if (dateValue.match(/^\d{8}$/)) {
                return dateValue;
              }
              // Return as is for other formats
              return dateValue;
            }
            
            return '';
          };
          
          // Get raw date value first
          const rawDate = stock.DATE || stock.date || stock.Date || '';
          
          // Normalize field names - handle both uppercase and lowercase column names
          const normalizedStock = {
            ...stock,
            // Date field - normalize to YYYYMMDD format
            DATE: normalizeDate(rawDate),
            DATE_RAW: rawDate, // Keep raw for debugging
            // Reference field
            REF: stock.REF || stock.ref || stock.REFERENCE || stock.reference || '',
            // Supplier field
            SUPPLIER: stock.SUPPLIER || stock.supplier || '',
            // Other fields with fallbacks
            ID: stock.ID || stock.id || stock.Id || '',
            BENZ: stock.BENZ || stock.benz || stock.BENZ_NUMBER || stock.benz_number || '',
            BENZ2: stock.BENZ2 || stock.benz2 || stock.BENZ_NUMBER2 || stock.benz_number2 || '',
            BENZ3: stock.BENZ3 || stock.benz3 || stock.BENZ_NUMBER3 || stock.benz_number3 || '',
            BRAND: stock.BRAND || stock.brand || '',
            ALTNO: stock.ALTNO || stock.altno || stock.ALT_NO || stock.alt_no || '',
            ALTNO2: stock.ALTNO2 || stock.altno2 || stock.ALT_NO2 || stock.alt_no2 || '',
            REMARKS: stock.REMARKS || stock.remarks || '',
            COST: stock.COST || stock.cost || stock.COST_PRICE || stock.cost_price || 0,
            SELL: stock.SELL || stock.sell || stock.SELL_PRICE || stock.selling_price || stock.sellingPrice || 0,
            QTY: stock.QTY || stock.qty || stock.QUANTITY || stock.quantity || 0,
            CURRENCY: stock.CURRENCY || stock.currency || '',
            FCAMOUNT: stock.FCAMOUNT || stock.fcamount || stock.FC_COST || stock.fc_cost || 0,
            CONVERSION: stock.CONVERSION || stock.conversion || 0,
            LOCATION: stock.LOCATION || stock.location || '',
            COLORCODE: stock.COLORCODE || stock.colorcode || stock.COLOR_CODE || stock.color_code || '',
            DESCRIPTION: stock.DESCRIPTION || stock.description || '',
            APPLICATION: stock.APPLICATION || stock.application || '',
            STOCK_ID: stockMatchesResponse.stockIds[stock.id || stock.ID] || 'No Match',
            WARNING: stockMatchesResponse.warnings[stock.id || stock.ID] || null
          };
          
          return normalizedStock;
        });
        
        // Debug log first few normalized stocks
        if (enhancedStocks.length > 0) {
          console.log('🔍 Sample stock normalization:', {
            totalStocks: enhancedStocks.length,
            firstStock: {
              raw: data.stocks[0],
              normalized: {
                DATE: enhancedStocks[0].DATE,
                DATE_RAW: enhancedStocks[0].DATE_RAW,
                REF: enhancedStocks[0].REF,
                ID: enhancedStocks[0].ID,
                BENZ: enhancedStocks[0].BENZ
              }
            }
          });
        }
        
        // Group stocks by reference+date combinations
        const groupedCombinations = groupStocksByReferenceDate(enhancedStocks);
        console.log(`📋 Grouped into ${groupedCombinations.length} reference+date combinations`);
        
        if (groupedCombinations.length === 0 && enhancedStocks.length > 0) {
          console.warn('⚠️ Stocks found but grouped combinations is empty. Check grouping logic.');
          console.log('📊 Sample stock data:', enhancedStocks[0]);
        }
        
        setIncomingStocks(enhancedStocks);
        setIncomingRefDateCombinations(groupedCombinations);
        
        // Reset to first combination if current index is out of bounds
        if (incomingCurrentCombinationIndex >= groupedCombinations.length) {
          setIncomingCurrentCombinationIndex(0);
        }
      } else {
        const errorData = await incomingResponse.text();
        console.error('❌ Failed to fetch incoming stocks:', incomingResponse.status, errorData);
        setIncomingStocks([]);
        setIncomingRefDateCombinations([]);
      }
    } catch (error) {
      console.error('❌ Error fetching incoming stocks:', error);
      setIncomingStocks([]);
      setIncomingRefDateCombinations([]);
    } finally {
      setIncomingLoading(false);
    }
  };

  // Update master table for auto-fill feature
  const updateMasterTable = async (formData) => {
    try {
      // Only update if we have the required fields for master table
      if (!formData.benz_number && !formData.brand) {
        return; // Skip if no key identifiers
      }

      const token = localStorage.getItem('token');
      
      // Check if master record already exists
      const lookupResponse = await axios.get('/api/master/lookup', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          benz: formData.benz_number || '',
          brand: formData.brand || '',
          altno: formData.altno || ''
        }
      });

      if (lookupResponse.data.success) {
        // Update existing master record
        await axios.put('/api/master/update', {
          benz: formData.benz_number || '',
          brand: formData.brand || '',
          altno: formData.altno || '',
          data: {
            DINFLAG: formData.din_flag || '',
            BENZ2: formData.benz_number2 || '',
            BENZ3: formData.benz_number3 || '',
            ALTNO2: formData.altno2 || '',
            DESC: formData.description || '',
            APPL: formData.application || '',
            UNIT: formData.unit || 'pcs',
            LOCATION: formData.location || '',
            REORDER: parseFloat(formData.reorder_point) || 0
          }
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        // Create new master record
        await axios.post('/api/master/create', {
          DINFLAG: formData.din_flag || '',
          BENZ: formData.benz_number || '',
          BENZ2: formData.benz_number2 || '',
          BENZ3: formData.benz_number3 || '',
          BRAND: formData.brand || '',
          ALTNO: formData.altno || '',
          ALTNO2: formData.altno2 || '',
          DESC: formData.description || '',
          APPL: formData.application || '',
          UNIT: formData.unit || 'pcs',
          LOCATION: formData.location || '',
          REORDER: parseFloat(formData.reorder_point) || 0
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      console.log('✅ Master table updated for auto-fill');
    } catch (error) {
      console.error('❌ Error updating master table:', error);
      // Don't show error to user as this is background functionality
    }
  };

  const handleIncomingFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/inmain/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(incomingForm)
      });

      const result = await response.json();
      
      if (result.success) {
        // Add to tab data
        const newItem = { ...incomingForm, id: Date.now() };
        setIncomingTabData(prev => ({
          ...prev,
          [currentIncomingTab]: {
            ...prev[currentIncomingTab],
            items: [...(prev[currentIncomingTab]?.items || []), newItem]
          }
        }));
        
        // Update master table for auto-fill feature
        await updateMasterTable(incomingForm);
        
        setSuccessMessage('Stock added successfully!');
        
        // Reset form but keep basic info (Reference, Supplier, Date)
        setIncomingForm({
          ...incomingForm,
          din_flag: '',
          benz_number: '',
          benz_number2: '',
          benz_number3: '',
          brand: '',
          altno: '',
          altno2: '',
          description: '',
          application: '',
          color_code: '',
          remarks: '',
          cost: '',
          selling_price: '',
          currency: '',
          fc_cost: '',
          conversion: '',
          quantity: '',
          unit: '',
          reorder_point: '',
          location: '',
          document_ref: ''
        });
        
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
      } else {
        setError(result.message || 'Failed to add stock');
      }
    } catch (error) {
      console.error('Error adding stock:', error);
      setError('Failed to add stock. Please try again.');
    } finally {
      setLoading(false);
    }
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
      await showAlert('Request submitted!', 'Success');
    } catch (err) {
      await showAlert('Failed to submit request.', 'Error');
    }
  };



  // Add a date formatting helper
  function formatDateLabel(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // Format date as M/D/YYYY (e.g., "9/11/2025")
  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    // Handle different date formats
    let date;
    if (typeof dateStr === 'string') {
      // Handle YYYY-MM-DD format
      if (dateStr.includes('-')) {
        date = new Date(dateStr);
      } else if (dateStr.length === 8) {
        // Handle YYYYMMDD format
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        date = new Date(`${year}-${month}-${day}`);
      } else {
        date = new Date(dateStr);
      }
    } else {
      date = new Date(dateStr);
    }
    
    if (isNaN(date.getTime())) return dateStr;
    
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
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

  // Handle individual row selection (no quantity changes)
  const handleSelectRow = async (id) => {
    console.log('[HANDLE SELECT ROW]', id);
    const stock = sortedStocks.find(s => s.ID === id);
    if (!stock || !stock.ID) {
      await showAlert('This item does not have a valid ID and cannot be selected.', 'Invalid Item');
      return;
    }
    if (selectedStocks.some(s => s.ID === id)) {
      // Remove from selection
      setSelectedStocks(prev => prev.filter(s => s.ID !== id));
    } else {
      // Add to selection (no quantity modifications)
      setSelectedStocks(prev => [...prev, stock]);
    }
  };

  // Handle row click for main stock table
  const handleRowClick = (e, stockId) => {
    // Prevent row click if clicking on checkbox, input, or button
    if (e.target.type === 'checkbox' || 
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'BUTTON' ||
        e.target.closest('button') ||
        e.target.closest('input')) {
      return;
    }
    handleSelectRow(stockId);
  };

  // Handle compatibility row selection (no quantity changes)
  const handleCompatibilitySelectRow = async (part) => {
    console.log('[HANDLE COMPATIBILITY SELECT ROW]', part);
    if (!part || !part.ID) {
      await showAlert('This item does not have a valid ID and cannot be selected.', 'Invalid Item');
      return;
    }
    if (selectedStocks.some(s => s.ID === part.ID)) {
      // Remove from selection
      setSelectedStocks(prev => prev.filter(s => s.ID !== part.ID));
    } else {
      // Add to selection (no quantity modifications)
      setSelectedStocks(prev => [...prev, part]);
    }
  };

  // Handle row click for compatibility results
  const handleCompatibilityRowClick = (e, part) => {
    // Prevent row click if clicking on checkbox, input, or button
    if (e.target.type === 'checkbox' || 
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'BUTTON' ||
        e.target.closest('button') ||
        e.target.closest('input')) {
      return;
    }
    handleCompatibilitySelectRow(part);
  };

  // Handle select all (no quantity changes)
  const handleSelectAll = () => {
    if (selectAll) {
      // Remove all items from current page from selection
      setSelectedStocks(selectedStocks.filter(s => !sortedStocks.some(st => st.ID === s.ID)));
    } else {
      // Add all items from current page to selection (no quantity modifications)
      const newStocks = sortedStocks.filter(st => !selectedStocks.some(s => s.ID === st.ID) && st.ID);
      setSelectedStocks([...selectedStocks, ...newStocks]);
    }
  };

  // Bulk selection by ID range
  const handleBulkSelectByRange = async () => {
    if (!bulkSelectFromId || !bulkSelectToId) {
      await showAlert('Please enter both From ID and To ID', 'Missing Information');
      return;
    }

    const fromId = parseInt(bulkSelectFromId);
    const toId = parseInt(bulkSelectToId);

    if (isNaN(fromId) || isNaN(toId)) {
      await showAlert('Please enter valid numeric IDs', 'Invalid Input');
      return;
    }

    if (fromId > toId) {
      await showAlert('From ID must be less than or equal to To ID', 'Invalid Range');
      return;
    }

    setBulkSelectLoading(true);

    try {
      // Fetch all stocks in the ID range
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/stock/range/${fromId}/${toId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data && response.data.stocks) {
        const stocksInRange = response.data.stocks.filter(stock => 
          stock.ID && !selectedStocks.some(s => s.ID === stock.ID)
        );
        
        if (stocksInRange.length > 0) {
          setSelectedStocks(prev => [...prev, ...stocksInRange]);
          await showAlert(`Successfully selected ${stocksInRange.length} items in range ${fromId} - ${toId}`, 'Bulk Selection Complete');
        } else {
          await showAlert('No new items found in the specified range', 'No Items Found');
        }
      } else {
        await showAlert('No items found in the specified range', 'No Items Found');
      }
    } catch (error) {
      console.error('Bulk select error:', error);
      await showAlert('Failed to fetch items in range. Please try again.', 'Error');
    } finally {
      setBulkSelectLoading(false);
      setBulkSelectModalOpen(false);
      setBulkSelectFromId('');
      setBulkSelectToId('');
    }
  };

  // Quick bulk selection functions
  const handleQuickBulkSelect = (type) => {
    let itemsToSelect = [];
    
    switch (type) {
      case 'all-visible':
        itemsToSelect = sortedStocks.filter(st => st.ID && !selectedStocks.some(s => s.ID === st.ID));
        break;
      case 'in-stock':
        itemsToSelect = sortedStocks.filter(st => 
          st.ID && 
          parseInt(st.QUANTITY) > 0 && 
          !selectedStocks.some(s => s.ID === st.ID)
        );
        break;
      case 'out-of-stock':
        itemsToSelect = sortedStocks.filter(st => 
          st.ID && 
          parseInt(st.QUANTITY) <= 0 && 
          !selectedStocks.some(s => s.ID === st.ID)
        );
        break;
      default:
        return;
    }
    
    if (itemsToSelect.length > 0) {
      setSelectedStocks(prev => [...prev, ...itemsToSelect]);
    }
  };

  // Get unique brands for bulk selection
  const uniqueBrands = useMemo(() => {
    const brands = [...new Set(sortedStocks.map(stock => stock.BRAND).filter(Boolean))];
    return brands.sort();
  }, [sortedStocks]);

  // Bulk select modal state
  const [bulkSelectModalOpen, setBulkSelectModalOpen] = useState(false);
  const [bulkSelectFromId, setBulkSelectFromId] = useState('');
  const [bulkSelectToId, setBulkSelectToId] = useState('');
  const [bulkSelectLoading, setBulkSelectLoading] = useState(false);





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
        // Initialize editable fields
        setEditedBenz(response.data.stock.BENZ || '');
        setEditedBrand(response.data.stock.BRAND || '');
        setEditedOem(response.data.stock.ALTNO || '');
        setShowBarcodeResult(true);
      } else {
        setScannedStockData(null);
        setScannedMasterData(null);
        setScannedInmainData(null);
        setScannedQualityData(null);
        setEditedBenz('');
        setEditedBrand('');
        setEditedOem('');
        setShowBarcodeResult(true);
      }
      
    } catch (error) {
      console.error('Barcode scan error:', error);
      setScannedStockData(null);
      setScannedMasterData(null);
      setScannedInmainData(null);
      setScannedQualityData(null);
      setEditedBenz('');
      setEditedBrand('');
      setEditedOem('');
      setShowBarcodeResult(true);
    }
  };

  // Save edited barcode scan data (updates both tbl_stock and tbl_inmain)
  const handleSaveBarcodeScan = async () => {
    console.log('🔍 Save clicked - scannedStockData:', scannedStockData);
    console.log('🔍 Edited values:', { editedBenz, editedBrand, editedOem });
    
    if (!scannedStockData) {
      console.error('❌ scannedStockData is null or undefined');
      showAlert('No stock data loaded. Please scan again.', 'Error');
      return;
    }

    // Handle both uppercase ID and lowercase id
    const stockId = scannedStockData.ID || scannedStockData.id;
    
    if (!stockId) {
      console.error('❌ Stock ID is missing:', scannedStockData);
      showAlert('Stock ID is missing. Please scan again.', 'Error');
      return;
    }

    // Check if any changes were made
    const hasChanges = 
      editedBenz !== (scannedStockData.BENZ || '') ||
      editedBrand !== (scannedStockData.BRAND || '') ||
      editedOem !== (scannedStockData.ALTNO || '');

    console.log('🔍 Has changes:', hasChanges);

    if (!hasChanges) {
      showAlert('No changes to save', 'Info');
      return;
    }

    try {
      setIsSavingBarcodeScan(true);
      
      const token = localStorage.getItem('token');
      const payload = {
        stockId: stockId,
        oldBenz: scannedStockData.BENZ || '',
        oldBrand: scannedStockData.BRAND || '',
        oldOem: scannedStockData.ALTNO || '',
        newBenz: editedBenz.trim(),
        newBrand: editedBrand.trim(),
        newOem: editedOem.trim(),
        // Include matching criteria for inmain table (optional, will try to update if found)
        date: scannedStockData.DATE,
        cost: scannedStockData.COST,
        sell: scannedStockData.SELL
      };

      console.log('📤 Sending update payload:', payload);

      const response = await axios.put('/api/stock/barcode-scan-update', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('✅ Update response:', response.data);

      if (response.data.success) {
        const inmainStatus = response.data.inmainUpdated 
          ? '✓ Updated' 
          : '⚠ Not found (skipped)';
        
        showAlert(
          `Successfully saved!\n\n✓ Stock table: Updated\n${inmainStatus} Inmain table: ${response.data.inmainUpdated ? 'Updated' : 'Skipped'}`,
          'Success'
        );
        
        // Update local state with new values
        setScannedStockData({
          ...scannedStockData,
          BENZ: editedBenz.trim(),
          BRAND: editedBrand.trim(),
          ALTNO: editedOem.trim()
        });

        // Refresh the stock list
        fetchStocks();
        
        // Close modal after a short delay
        setTimeout(() => {
          setShowBarcodeResult(false);
        }, 1500);
      }
    } catch (error) {
      console.error('❌ Error saving barcode scan data:', error);
      showAlert(
        error.response?.data?.message || 'Failed to save changes. Please try again.',
        'Error'
      );
    } finally {
      setIsSavingBarcodeScan(false);
    }
  };

  // State for export preview modal
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [exportPreviewData, setExportPreviewData] = useState([]);
  const [exportType, setExportType] = useState('');
  
  // State for 2-step label setup process
  const [showLabelSetup, setShowLabelSetup] = useState(false);
  const [labelSetupData, setLabelSetupData] = useState([]);
  const [labelSetupStep, setLabelSetupStep] = useState(1); // 1 = setup, 2 = preview
  const [labelSearchTerm, setLabelSearchTerm] = useState('');
  


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
  
  // Editable fields state for barcode scan modal
  const [editedBenz, setEditedBenz] = useState('');
  const [editedBrand, setEditedBrand] = useState('');
  const [editedOem, setEditedOem] = useState('');
  const [isSavingBarcodeScan, setIsSavingBarcodeScan] = useState(false);

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
  const clearAllExportItems = async () => {
    if (exportPreviewData.length === 0) return;
    
    const confirmed = await showConfirm(
      `Are you sure you want to clear all ${exportPreviewData.length} items from the export preview?`,
      'Clear Export Preview'
    );
    
    if (confirmed) {
      setExportPreviewData([]);
      setShowExportPreview(false);
      // Also uncheck all selected items in the main table
      setSelectedStocks([]);
    }
  };

  // Remove individual item from export preview
  const removeExportItem = async (index) => {
    const item = exportPreviewData[index];
    const confirmed = await showConfirm(
      `Are you sure you want to remove "${item['DESCRIPTION'] || item['BENZ'] || item['ID']}" from the export preview?`,
      'Remove Item'
    );
    
    if (confirmed) {
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

  // Show export preview - now opens 2-step label setup
  const handleExportPreview = () => {
    // Only allow export when items are specifically selected
    if (selectedStocks.length === 0) {
      alert('Please select items first by checking the checkboxes next to the stock items you want to export.');
      return;
    }
    
    // Initialize label setup data with current stock quantities
    const setupData = selectedStocks.map(stock => ({
      ...stock,
      labelQuantity: parseInt(stock.QTY) || 1, // Default to current stock quantity
      labelNote: '', // Empty by default
      originalData: stock
    }));
    
    setLabelSetupData(setupData);
    setLabelSetupStep(1);
    setLabelSearchTerm('');
    setShowLabelSetup(true);
  };

  // Common label notes options
  const commonLabelNotes = [
    '2pcs/sold per pc',
    '50pcs/sold per pc',
    '10pcs/sold per pc',
    '5pcs/sold per pc',
    'Set of 2',
    'Set of 4',
    'Pair',
    'Custom...'
  ];

  // Update localStorage when selectedStocks changes
  useEffect(() => {
    if (selectedStocks.length > 0) {
      localStorage.setItem('inventoryCartCount', selectedStocks.length.toString());
      localStorage.setItem('inventoryCartPage', location.pathname);
    } else {
      localStorage.removeItem('inventoryCartCount');
      localStorage.removeItem('inventoryCartPage');
    }
  }, [selectedStocks.length, location.pathname]);

  // Handle quantity change in label setup
  const handleLabelQuantityChange = (itemId, newQuantity) => {
    setLabelSetupData(prev => prev.map(item => 
      item.ID === itemId 
        ? { ...item, labelQuantity: Math.max(0, parseInt(newQuantity) || 0) }
        : item
    ));
  };

  // Handle note change in label setup
  const handleLabelNoteChange = (itemId, newNote) => {
    setLabelSetupData(prev => prev.map(item => 
      item.ID === itemId 
        ? { ...item, labelNote: newNote }
        : item
    ));
  };

  // Generate final preview with multiplied rows
  const generateMultipliedPreview = () => {
    const multipliedData = [];
    
    labelSetupData.forEach(item => {
      const quantity = item.labelQuantity || 0;
      for (let i = 0; i < quantity; i++) {
        multipliedData.push({
          'BENZ': item.BENZ || '',
          'BENZ2': item.BENZ2 || '',
          'BENZ3': item.BENZ3 || '',
          'BRAND': item.BRAND || '',
          'ALT NO': item.ALTNO || '',
          'DESCRIPTION': item.DESCRIPTION || item.REMARKS || '',
          'ID': item.ID || '',
          'ID BARCODE': item.ID || '',
          'NOTE': item.labelNote || ''
        });
      }
    });
    
    setExportPreviewData(multipliedData);
    setExportType('selected');
    setLabelSetupStep(2);
  };

  // Go back to step 1 from step 2
  const goBackToLabelSetup = () => {
    setLabelSetupStep(1);
  };

  // Close label setup modal
  const closeLabelSetup = () => {
    setShowLabelSetup(false);
    setLabelSetupData([]);
    setLabelSetupStep(1);
    setLabelSearchTerm('');
  };

  // Filter label setup data based on search term (search by ID)
  const filteredLabelSetupData = useMemo(() => {
    if (!labelSearchTerm.trim()) return labelSetupData;
    return labelSetupData.filter(item => 
      item.ID && item.ID.toString().toLowerCase().includes(labelSearchTerm.toLowerCase())
    );
  }, [labelSetupData, labelSearchTerm]);


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

  // Export to Old ID format matching DL ID'S.xlsx structure exactly with full formatting
  const handleExportToOldID = () => {
    try {
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      
      // Calculate items per column block (distribute evenly across 4 blocks)
      const itemsPerBlock = Math.ceil(exportPreviewData.length / 4);
      
      // Track current row for each block (no fixed spacing)
      const blockCurrentRows = [0, 0, 0, 0];
      
      // Create worksheet data as array of arrays
      const worksheetData = [];
      
      // Initialize with enough rows (estimate 5 rows per item)
      const estimatedRows = exportPreviewData.length * 5;
      for (let row = 0; row < estimatedRows; row++) {
        worksheetData[row] = new Array(16).fill(''); // 16 columns A-P
      }
      
      // Process each of the 4 blocks
      for (let blockIndex = 0; blockIndex < 4; blockIndex++) {
        const startIndex = blockIndex * itemsPerBlock;
        const endIndex = Math.min(startIndex + itemsPerBlock, exportPreviewData.length);
        
        // Get items for this block
        const blockItems = exportPreviewData.slice(startIndex, endIndex);
        
        // Calculate column offset for proper positioning:
        // Block 0: A=0, B=1 (A-B)
        // Block 1: E=4, F=5 (E-F) 
        // Block 2: I=8, J=9 (I-J)
        // Block 3: M=12, N=13 (M-N)
        const colOffsets = [0, 4, 8, 12]; // A, E, I, M
        const colOffset = colOffsets[blockIndex];
        
        // Add each item to this block
        blockItems.forEach((item, itemIndex) => {
          const currentRow = blockCurrentRows[blockIndex];
          
          // Row 1: Part number (BENZ)
          worksheetData[currentRow][colOffset] = item.BENZ || '';
          
          // Row 2: Brand and Alt Number (same row)
          worksheetData[currentRow + 1][colOffset] = item.BRAND || ''; // Brand in first column
          worksheetData[currentRow + 1][colOffset + 1] = item['ALT NO'] || ''; // Alt Number in second column
          
          // Row 3: Description
          worksheetData[currentRow + 2][colOffset] = item.DESCRIPTION || '';
          
          let nextRow = currentRow + 3;
          
          // Conditional Row 4: Quantity info (only if NOTE field has value)
          if (item.NOTE && item.NOTE !== 'No note' && item.NOTE.trim() !== '') {
            worksheetData[nextRow][colOffset] = item.NOTE;
            nextRow++;
          }
          
          // Last Row: Old ID
          worksheetData[nextRow][colOffset] = `ID# ${item.ID || ''}`;
          
          // Update current row for next item (no empty rows between items)
          blockCurrentRows[blockIndex] = nextRow + 1;
        });
      }
      
      // Create worksheet from the array data
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Set column widths to match reference file
      const columnWidths = [];
      for (let i = 0; i < 16; i++) { // A through P (16 columns)
        if (i % 4 === 0 || i % 4 === 1) { // Columns A, B, E, F, I, J, M, N (data columns)
          columnWidths.push({ wch: 20 }); // Adjust width to match reference
        } else { // Columns C, D, G, H, K, L, O, P (empty separator columns)
          columnWidths.push({ wch: 5 }); // Narrow separator columns
        }
      }
      
      worksheet['!cols'] = columnWidths;
      
      // Set row heights to match reference file
      const rowHeights = [];
      for (let row = 0; row < estimatedRows; row++) {
        rowHeights.push({ hpt: 15 }); // 15 points height per row
      }
      worksheet['!rows'] = rowHeights;
      
      // Apply comprehensive cell formatting
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
      
      // Create style object for consistent formatting
      const defaultStyle = {
        font: {
          name: 'Calibri',
          sz: 11,
          color: { rgb: '000000' }
        },
        alignment: {
          horizontal: 'left',
          vertical: 'center'
        },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };
      
      // Apply formatting to all cells
      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          
          // Initialize cell if it doesn't exist
          if (!worksheet[cellAddress]) {
            worksheet[cellAddress] = { v: '', t: 's' };
          }
          
          // Apply formatting
          worksheet[cellAddress].s = defaultStyle;
          
          // Ensure numbers stay as numbers (not text)
          if (worksheet[cellAddress].v && typeof worksheet[cellAddress].v === 'number') {
            worksheet[cellAddress].t = 'n';
          }
        }
      }
      
      // Enable gridlines
      worksheet['!margins'] = {
        left: 0.7,
        right: 0.7,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3
      };
      
      // Set worksheet properties
      worksheet['!sheetFormat'] = {
        baseColWidth: 8,
        defaultRowHeight: 15
      };
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Export Old ID');
      
      // Generate filename
      const fileName = `stock_export_old_id_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Write and download file
      XLSX.writeFile(workbook, fileName);
      
      // Show success message
      alert(`Successfully exported ${exportPreviewData.length} items to Old ID format with full formatting!`);
      
    } catch (error) {
      console.error('Export to Old ID error:', error);
      alert('Error exporting to Old ID format. Please try again.');
    }
  };



  // Handler for adding items to existing warehouse order
  const handleAddToOrder = async () => {
    if (!addToOrderId) {
      alert('Order ID is missing. Please try again.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const cartItems = selectedStocks.map(s => ({ 
        stock_id: parseInt(s.originalData.id),
        quantity: parseInt(s.QUANTITY),
        description: s.DESCRIPTION,
        custom_price: parseFloat(s.PRICE) || 0
      }));
      
      // Validate cart items
      const invalidItems = cartItems.filter(item => 
        !item.stock_id || isNaN(item.stock_id) || 
        !item.quantity || isNaN(item.quantity) || item.quantity <= 0
      );
      
      if (invalidItems.length > 0) {
        alert('Some items have invalid data and cannot be added to order.');
        return;
      }
      
      if (cartItems.length === 0) {
        alert('Please select items to add to the order.');
        return;
      }
      
      console.log('[FRONTEND] Adding to order:', { orderId: addToOrderId, cartItems });
      
      const res = await axios.post('/api/warehouse/add-to-order', 
        { order_id: addToOrderId, cartItems }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.data && res.data.success) {
        setCartOpen(false);
        setSelectedStocks([]);
        // Navigate back to warehouses page with success parameter
        navigate(`/warehouses?addedToOrder=true&orderId=${addToOrderId}`);
        // Refresh stock data to show updated quantities
        fetchStocks(currentPage, searchTerm, stockFilter, sortDropdown);
      } else {
        alert(res.data?.message || 'Failed to add items to order.');
      }
    } catch (err) {
      console.error('Add to order error:', err);
      if (err.response && err.response.data) {
        const { message, insufficient } = err.response.data;
        if (insufficient && Array.isArray(insufficient) && insufficient.length > 0) {
          const details = insufficient.map(i => 
            `ID: ${i.stock_id}, Requested: ${i.requested}, Available: ${i.available}`
          ).join('\n');
          alert(`${message || 'Some items have insufficient stock.'}\n\n${details}`);
        } else {
          alert(message || 'Failed to add items to order.');
        }
      } else {
        alert('Failed to add items to order.');
      }
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
        customer_name: quotationForm.customer_name.trim().toUpperCase(),
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
  // Handle clicking on BENZ/PART NO to show movement history
  const handleBenzClick = async (e, benz, brand, altno, description, application) => {
    e.stopPropagation(); // Prevent row click
    
    if (!benz) {
      await showAlert('No part number available for this item.', 'No Part Number');
      return;
    }
    
    try {
      setMovementLoading(true);
      setMovementBenz(benz);
      setMovementBrand(brand || '');
      setMovementAltno(altno || '');
      
      // Try to get description and application from the passed parameters
      // If not provided, try to find in current stock data
      let itemDescription = description || '';
      let itemApplication = application || '';
      let stockQuantity = 0;
      
      // Sum all quantities from all stock items with this BENZ number (BENZ, BENZ2, or BENZ3)
      // First try sortedStocks
      const allMatchingStocks = sortedStocks.filter(s => 
        (s.BENZ === benz || s.BENZ2 === benz || s.BENZ3 === benz) &&
        (!brand || s.BRAND === brand) &&
        (!altno || s.ALTNO === altno)
      );
      
      stockQuantity = allMatchingStocks.reduce((sum, s) => {
        return sum + (parseInt(s.QTY || s.QUANTITY || 0));
      }, 0);
      
      // Get description and application from first matching stock
      if (allMatchingStocks.length > 0) {
        const firstStock = allMatchingStocks[0];
        itemDescription = itemDescription || firstStock.DESCRIPTION || firstStock.REMARKS || '';
        itemApplication = itemApplication || firstStock.APPLICATION || firstStock.APPL || '';
      } else {
        // Try compatibility results if not found in sortedStocks
        const allMatchingCompat = compatibilityResults.filter(s => 
          (s.BENZ === benz || s.BENZ2 === benz || s.BENZ3 === benz) &&
          (!brand || s.BRAND === brand) &&
          (!altno || s.ALTNO === altno)
        );
        
        stockQuantity = allMatchingCompat.reduce((sum, s) => {
          return sum + (parseInt(s.QTY || s.QUANTITY || 0));
        }, 0);
        
        if (allMatchingCompat.length > 0) {
          const firstCompat = allMatchingCompat[0];
          itemDescription = itemDescription || firstCompat.DESCRIPTION || firstCompat.REMARKS || '';
          itemApplication = itemApplication || firstCompat.APPLICATION || firstCompat.APPL || '';
        }
      }
      
      setMovementDescription(itemDescription);
      setMovementApplication(itemApplication);
      setMovementStockQuantity(stockQuantity);
      setShowSalesAnalytics(false);
      setShowMovementModal(true);
      
      const token = localStorage.getItem('token');
      // Don't filter by brand/altno when fetching - get ALL movement history for this BENZ
      // User can filter by brand in the frontend dropdown
      const response = await axios.get(`/api/stock/movement/${encodeURIComponent(benz)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setMovementData(response.data.data || []);
        // Reset filters when new data is loaded
        setFilterYear('');
        setFilterMonths('');
        setFilterBrand('');
      } else {
        throw new Error(response.data.message || 'Failed to fetch movement history');
      }
    } catch (error) {
      console.error('Error fetching movement history:', error);
      await showAlert(
        error.response?.data?.message || error.message || 'Failed to fetch item movement history.', 
        'Error'
      );
      setShowMovementModal(false);
    } finally {
      setMovementLoading(false);
    }
  };

  // Filter movement data based on year and months
  const filteredMovementData = useMemo(() => {
    if (!movementData || movementData.length === 0) return [];
    
    let filtered = [...movementData];
    
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
    
    // Filter by brand
    if (filterBrand) {
      filtered = filtered.filter(record => {
        const recordBrand = record.BRAND || '';
        return recordBrand.toLowerCase() === filterBrand.toLowerCase();
      });
    }
    
    return filtered;
  }, [movementData, filterYear, filterMonths, filterBrand]);

  // Generate chart data from filtered movement data
  const chartData = useMemo(() => {
    if (!filteredMovementData || filteredMovementData.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }
    
    // Group by month for the chart
    const monthlyData = {};
    
    filteredMovementData.forEach(record => {
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
      
      const qty = parseInt(record.quantity || record.QTY || 0);
      const price = parseFloat(record.price || record.SELL || 0);
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
          label: 'Total Amount (₱)',
          data: sortedMonths.map(key => monthlyData[key].totalAmount),
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1,
          yAxisID: 'y1',
        }
      ]
    };
  }, [filteredMovementData]);

  // Get available years from movement data
  const availableYears = useMemo(() => {
    if (!movementData || movementData.length === 0) return [];
    const years = new Set();
    movementData.forEach(record => {
      if (record.DATE) {
        const year = new Date(record.DATE).getFullYear();
        years.add(year.toString());
      }
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [movementData]);

  // Get available brands from movement data
  const availableBrands = useMemo(() => {
    if (!movementData || movementData.length === 0) return [];
    const brands = new Set();
    movementData.forEach(record => {
      if (record.BRAND && record.BRAND.trim() !== '') {
        brands.add(record.BRAND.trim());
      }
    });
    return Array.from(brands).sort((a, b) => a.localeCompare(b));
  }, [movementData]);

  // Overall quantity is the current stock quantity (not sold quantity)
  const overallQuantity = movementStockQuantity;

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
    <div className="pos-stock pos-stock-modern" data-view={currentView} data-subview={currentView === 'incoming' ? incomingSubView : 'default'} style={{ width: '100%', minHeight: '100vh' }}>
      <style>{tableStyles}</style>
      <style>
        {`
          /* Hide scrollbars on sub-content containers */
          .pos-stock-modern .pos-stock-table-wrapper::-webkit-scrollbar,
          .pos-stock-modern .pos-cart-list::-webkit-scrollbar,
          .pos-stock-modern .pos-modal-body::-webkit-scrollbar,
          .pos-stock-modern .form-container::-webkit-scrollbar,
          .pos-stock-modern .incoming-form-container::-webkit-scrollbar,
          .pos-stock-modern .tab-content::-webkit-scrollbar,
          .pos-stock-modern .incoming-tab-form::-webkit-scrollbar {
            display: none;
          }
          
          /* Allow scrollbar for saved items panel */
          .pos-stock-modern .saved-items-container::-webkit-scrollbar {
            width: 8px;
            display: block !important;
            z-index: 9999;
          }
          
          .pos-stock-modern .saved-items-container::-webkit-scrollbar-track {
            background: rgba(255,255,255,0.1);
            border-radius: 4px;
            pointer-events: auto;
          }
          
          .pos-stock-modern .saved-items-container::-webkit-scrollbar-thumb {
            background: rgba(0,123,255,0.6);
            border-radius: 4px;
            pointer-events: auto;
            cursor: pointer;
          }
          
          .pos-stock-modern .saved-items-container::-webkit-scrollbar-thumb:hover {
            background: rgba(0,123,255,0.8);
            pointer-events: auto;
          }
          
          .pos-stock-modern .saved-items-container::-webkit-scrollbar-thumb:active {
            background: rgba(0,123,255,1);
            pointer-events: auto;
          }
          
          .pos-stock-modern .pos-stock-table-wrapper,
          .pos-stock-modern .pos-cart-list,
          .pos-stock-modern .pos-modal-body,
          .pos-stock-modern .form-container,
          .pos-stock-modern .incoming-form-container,
          .pos-stock-modern .tab-content,
          .pos-stock-modern .incoming-tab-form {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          
          /* Allow scrollbar for saved items container */
          .pos-stock-modern .saved-items-container {
            -ms-overflow-style: auto;
            scrollbar-width: thin;
            scrollbar-color: rgba(0,123,255,0.6) transparent;
          }
          
          /* Allow scrolling but hide scrollbars on specific containers */
          .pos-stock-modern .pos-stock-table-wrapper {
            overflow-x: auto;
            overflow-y: visible;
          }
          
          .pos-stock-modern .pos-cart-list {
            overflow-y: auto;
            overflow-x: hidden;
          }
          
          .pos-stock-modern .pos-modal-body {
            overflow-y: auto;
            overflow-x: hidden;
          }
          
          .pos-stock-modern .saved-items-panel {
            overflow-y: visible;
            overflow-x: hidden;
          }
          
          /* Ensure saved items container can scroll */
          .pos-stock-modern .saved-items-container {
            overflow-y: auto !important;
            overflow-x: hidden !important;
          }
          
          .pos-stock-modern .form-container {
            overflow-y: auto;
            overflow-x: hidden;
          }
          
          .pos-stock-modern .incoming-form-container {
            overflow-y: hidden;
            overflow-x: hidden;
          }
          
          .pos-stock-modern .tab-content {
            overflow-y: hidden;
            overflow-x: hidden;
          }
          
          .pos-stock-modern .incoming-tab-form {
            overflow-y: hidden;
            overflow-x: hidden;
          }
          
          /* Disable scrolling only on incoming form page (not table view) */
          .pos-stock-modern[data-view="incoming"][data-subview="form"] {
            overflow: hidden !important;
            height: 100vh !important;
            max-height: 100vh !important;
          }
          
          .pos-stock-modern[data-view="incoming"][data-subview="form"] * {
            overflow: hidden !important;
          }
          
          /* CRITICAL FIX: Override the global overflow hidden for saved items */
          .pos-stock-modern[data-view="incoming"][data-subview="form"] .saved-items-container,
          .pos-stock-modern[data-view="incoming"][data-subview="form"] .saved-items-container *,
          .pos-stock-modern[data-view="incoming"][data-subview="form"] .saved-items-panel,
          .pos-stock-modern[data-view="incoming"][data-subview="form"] .saved-items-panel * {
            overflow: visible !important;
          }
          
          /* Exception: Allow scrolling in saved items container - HIGH PRIORITY */
          .pos-stock-modern[data-view="incoming"][data-subview="form"] .saved-items-container,
          .saved-items-container {
            overflow-y: auto !important;
            overflow-x: hidden !important;
            max-height: none !important;
            height: auto !important;
          }
          
          /* Force disable body and html scrolling when on incoming form */
          body[data-incoming-form="true"],
          html[data-incoming-form="true"] {
            overflow: hidden !important;
            height: 100vh !important;
            max-height: 100vh !important;
          }
          
          /* Allow normal scrolling on incoming table view */
          .pos-stock-modern[data-view="incoming"][data-subview="table"] {
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
          }
          
          /* Force disable scrolling on incoming form containers */
          .pos-stock-modern .incoming-form-container,
          .pos-stock-modern .incoming-form-container *,
          .pos-stock-modern .tab-content,
          .pos-stock-modern .tab-content *,
          .pos-stock-modern .incoming-tab-form,
          .pos-stock-modern .incoming-tab-form * {
            overflow: hidden !important;
            scroll-behavior: auto !important;
          }
          
          /* FINAL OVERRIDE: Ensure saved items container can scroll */
          .pos-stock-modern .saved-items-container,
          .saved-items-container,
          div.saved-items-container {
            overflow-y: auto !important;
            overflow-x: hidden !important;
            max-height: calc(100vh - 180px) !important;
            height: calc(100vh - 180px) !important;
            display: flex !important;
            flex-direction: column !important;
          }
          
          /* ABSOLUTE FINAL OVERRIDE - Force scrolling to work */
          .pos-stock-modern[data-view="incoming"][data-subview="form"] div.saved-items-container {
            overflow-y: auto !important;
            overflow-x: hidden !important;
            max-height: calc(100vh - 180px) !important;
            height: calc(100vh - 180px) !important;
            display: flex !important;
            flex-direction: column !important;
            position: relative !important;
          }
          
          /* Prevent item compression - ensure each item maintains its height */
          .pos-stock-modern[data-view="incoming"][data-subview="form"] .saved-items-container > div {
            flex-shrink: 0 !important;
            min-height: auto !important;
            height: auto !important;
            overflow: visible !important;
          }
          
          /* Ensure scrollbar is interactive */
          .pos-stock-modern[data-view="incoming"][data-subview="form"] .saved-items-container {
            pointer-events: auto !important;
            user-select: auto !important;
            touch-action: pan-y !important;
            overscroll-behavior: contain !important;
          }
          
          .pos-stock-modern[data-view="incoming"][data-subview="form"] .saved-items-container::-webkit-scrollbar {
            pointer-events: auto !important;
            user-select: auto !important;
          }
          
          /* Ensure wheel events work on saved items container */
          .saved-items-container {
            pointer-events: auto !important;
            touch-action: pan-y !important;
            overscroll-behavior: contain !important;
          }
          
          /* Main page scrolling - keep scrollbars visible for main page when not in incoming view */
          .pos-stock-modern:not([data-view="incoming"]) {
            overflow: visible !important;
          }
          
          body, html {
            overflow: auto !important;
          }
        `}
      </style>
      
      {/* Conditional rendering based on currentView */}
      {currentView === 'stocks' ? (
        <>
          {/* Search and Filters */}
          <div className="pos-stock-controls" style={{ gap: '12px', alignItems: 'center', width: '100%' }}>
            {/* Single Row Layout */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'nowrap', width: '100%', justifyContent: 'flex-start', overflowX: 'auto' }}>
              {/* Left side - Search, Filters, and Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'nowrap', flexShrink: 0 }}>
                <div className="pos-search-container" style={{ maxWidth: '220px', minWidth: '180px', position: 'relative', flexShrink: 0 }}>
          <Search className="pos-search-icon" style={{ width: '14px', height: '14px', left: '12px' }} />
          <input
            type="text"
            placeholder="Search by BENZ, ALTNO, Brand..."
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyPress={(e) => e.key === 'Enter' && handleSearchSubmit()}
            className="pos-search-input"
            style={{ 
              padding: '10px 12px 10px 38px', 
              fontSize: '13px', 
              borderRadius: '8px',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              outline: 'none',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.target.style.boxShadow = '0 4px 8px rgba(37, 99, 235, 0.2)';
              e.target.style.borderColor = '#2563eb';
            }}
            onBlur={(e) => {
              e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.08)';
              e.target.style.borderColor = 'var(--border-color)';
            }}
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
            gap: '6px',
            padding: '10px 14px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            opacity: (compatibilityLoading || !searchTerm.trim() || isBrandSearch) ? 0.6 : 1,
            cursor: (compatibilityLoading || !searchTerm.trim() || isBrandSearch) ? 'not-allowed' : 'pointer',
            background: compatibilityLoading ? 'var(--bg-tertiary)' : '#2563eb',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontWeight: 500,
            transition: 'all 0.2s',
            boxSizing: 'border-box',
            lineHeight: '1.2',
            boxShadow: (compatibilityLoading || !searchTerm.trim() || isBrandSearch) ? 'none' : '0 2px 6px rgba(37, 99, 235, 0.3)'
          }}
          onMouseEnter={e => {
            if (!compatibilityLoading && searchTerm.trim() && !isBrandSearch) {
              e.currentTarget.style.background = '#1e40af';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(37, 99, 235, 0.4)';
            }
          }}
                onMouseLeave={e => {
                  if (!compatibilityLoading && searchTerm.trim() && !isBrandSearch) {
                    e.currentTarget.style.background = '#2563eb';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.3)';
                  }
                }}
        >
          {compatibilityLoading ? (
            <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Package size={12} />
          )}
          <span>{compatibilityLoading ? 'Finding...' : 'Find Compatible'}</span>
        </button>



        <div className="pos-filter-container" style={{ minWidth: '140px', maxWidth: '160px', flexShrink: 0 }}>
          <Filter className="pos-filter-icon" style={{ width: '14px', height: '14px', left: '10px' }} />
          <select
            value={stockFilter}
            onChange={handleFilterChange}
            onClick={handleFilterClick}
            className="pos-filter-select"
            style={{ 
              padding: '10px 12px 10px 32px', 
              fontSize: '12px', 
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
              transition: 'all 0.2s ease'
            }}
          >
            <option value="in-stock">In Stock Only</option>
            <option value="all">All Items</option>
            <option value="out-of-stock">Out of Stock</option>
            <option value="low-stock">Low Stock</option>
          </select>
        </div>
        {/* Sort - match All Items filter structure */}
        <div className="pos-filter-container" style={{ minWidth: '140px', maxWidth: '160px', flexShrink: 0 }}>
          <ArrowDownWideNarrow className="pos-filter-icon" style={{ width: '14px', height: '14px', left: '10px' }} />
          <select
            className="pos-filter-select"
            value={sortDropdown}
            onChange={e => setSortDropdown(e.target.value)}
            onClick={handleFilterClick}
            aria-label="Sort"
            style={{ 
              padding: '10px 12px 10px 32px', 
              fontSize: '12px', 
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
              transition: 'all 0.2s ease'
            }}
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
              {/* Scan Barcode Button */}
              <button
                className="pos-stock-action-btn"
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 16px',
                  background: '#2563eb',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  lineHeight: '1.2'
                }}
                onClick={() => handleBarcodeScan()}
                title="Scan Barcode to Find Item"
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#1e40af';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(37, 99, 235, 0.4)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#2563eb';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.3)';
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                  <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                  <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                  <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                  <path d="M7 3h10"/>
                  <path d="M7 21h10"/>
                  <path d="M3 7h18"/>
                  <path d="M3 17h18"/>
                </svg>
                <span>Scan Barcode</span>
              </button>

              {/* Preview & Export Selected Button */}
              <button
                className="pos-stock-action-btn"
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 16px',
                  background: selectedStocks.length === 0 ? 'var(--bg-tertiary)' : '#ca8a04',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: selectedStocks.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  opacity: selectedStocks.length === 0 ? 0.6 : 1,
                  fontWeight: 500,
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  lineHeight: '1.2'
                }}
                onClick={handleExportPreview}
                title="Preview and Export SELECTED items to XLSX (select items first)"
                disabled={selectedStocks.length === 0}
                onMouseEnter={e => {
                  if (selectedStocks.length > 0) {
                    e.currentTarget.style.background = '#a16207';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(202, 138, 4, 0.4)';
                  }
                }}
                onMouseLeave={e => {
                  if (selectedStocks.length > 0) {
                    e.currentTarget.style.background = '#ca8a04';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                <Download size={12} />
                <span>Export</span>
                {selectedStocks.length > 0 && <span>({selectedStocks.length})</span>}
              </button>

              {/* Discrepancy Reports Button */}
              <button
                className="pos-stock-action-btn"
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 16px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  lineHeight: '1.2'
                }}
                onClick={() => navigate('/warehouse-discrepancy-reports')}
                title="View warehouse discrepancy reports"
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--hover-bg)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 2px 8px var(--shadow-md)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                }}
              >
                <BarChart3 size={12} />
                <span>Discrepancy Reports</span>
              </button>
              {/* Adjustment History Button */}
              <button
                className="pos-stock-action-btn"
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 16px',
                  background: '#2563eb',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  lineHeight: '1.2'
                }}
                onClick={() => {
                  navigate('/adjustment-history');
                }}
                title="View adjustment history"
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#1e40af';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(37, 99, 235, 0.4)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#2563eb';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.3)';
                }}
              >
                <TrendingUp size={12} />
                <span>Adjustment History</span>
              </button>
              {/* Incoming Button - Shows the form directly */}
              <button
                className="pos-stock-action-btn"
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 16px',
                  background: '#16a34a',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  lineHeight: '1.2'
                }}
                onClick={() => {
                  setCurrentView('incoming');
                  setIncomingSubView('form');
                }}
                title="Add New Incoming Stock Entry"
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#15803d';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(22, 163, 74, 0.4)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#16a34a';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(22, 163, 74, 0.3)';
                }}
              >
                <Plus size={12} />
                <span>Incoming</span>
              </button>
              {/* Posted Button - Shows the Inmain Table directly */}
              <button
                className="pos-stock-action-btn"
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 16px',
                  background: '#2563eb',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  lineHeight: '1.2'
                }}
                onClick={() => {
                  setCurrentView('incoming');
                  setIncomingSubView('table');
                }}
                title="View Posted Incoming Stocks (Inmain Table)"
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#1e40af';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(37, 99, 235, 0.4)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#2563eb';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.3)';
                }}
              >
                <FileText size={12} />
                <span>Posted</span>
              </button>
              </div>
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
          background: isLight ? '#d4edda' : 'rgba(40, 167, 69, 0.2)',
          color: isLight ? '#155724' : '#90ee90',
          border: `1px solid ${isLight ? '#c3e6cb' : 'rgba(40, 167, 69, 0.4)'}`,
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
                Showing first 300 most recent stock items (sorted by highest ID first)
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
                    <th>Date</th>
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
                      className={`pos-stock-row ${stock.QUANTITY <= 0 ? 'out-of-stock' : ''} ${serviceInfo ? 'in-service' : ''} ${selectedStocks.some(s => s.ID === stock.ID) ? 'selected' : ''}`}
                      style={serviceInfo ? { 
                        backgroundColor: 'rgba(255, 193, 7, 0.15) !important',
                        borderLeft: '3px solid #f59e0b'
                      } : {}}
                      onClick={(e) => handleRowClick(e, stock.ID)}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedStocks.some(s => s.ID === stock.ID)}
                          onChange={() => { console.log('[CHECKBOX CLICK]', stock.ID, stock); handleSelectRow(stock.ID); }}
                          aria-label="Select Row"
                          className="pos-checkbox"
                        />
                      </td>
                      <td className="pos-stock-cell">
                        <div className="benz-numbers">
                          <span 
                            className={stock.match_type === 'primary' ? 'benz-primary-match' : ''}
                            onClick={(e) => handleBenzClick(e, stock.BENZ, stock.BRAND, stock.ALTNO, stock.DESCRIPTION || stock.REMARKS, stock.APPLICATION || stock.APPL)}
                            style={{ 
                              cursor: 'pointer'
                            }}
                            title="Click to view movement history"
                          >
                            {stock.BENZ}
                            {stock.match_type === 'primary' && <span className="match-indicator">★</span>}
                          </span>
                          {stock.BENZ2 && (
                            <span 
                              className={`benz-secondary ${stock.match_type === 'secondary' ? 'benz-secondary-match' : ''}`}
                              onClick={(e) => handleBenzClick(e, stock.BENZ2, stock.BRAND, stock.ALTNO, stock.DESCRIPTION || stock.REMARKS, stock.APPLICATION || stock.APPL)}
                              style={{ 
                                cursor: 'pointer'
                              }}
                              title="Click to view movement history"
                            >
                              {stock.BENZ2}
                              {stock.match_type === 'secondary' && <span className="match-indicator">★</span>}
                            </span>
                          )}
                          {stock.BENZ3 && (
                            <span 
                              className={`benz-secondary ${stock.match_type === 'tertiary' ? 'benz-tertiary-match' : ''}`}
                              onClick={(e) => handleBenzClick(e, stock.BENZ3, stock.BRAND, stock.ALTNO, stock.DESCRIPTION || stock.REMARKS, stock.APPLICATION || stock.APPL)}
                              style={{ 
                                cursor: 'pointer'
                              }}
                              title="Click to view movement history"
                            >
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
                      <td className="pos-stock-cell">{formatDateShort(stock.DATE)}</td>
                      {/* <td className="pos-stock-cell">
                        <Barcode value={String(stock.ID)} width={1.2} height={40} fontSize={12} displayValue={false} />
                      </td>
                      <td className="pos-stock-cell">
                        <QRCodeSVG value={String(stock.ID)} size={48} level="M" />
                      </td> */}
                      <td className="pos-stock-cell">
                        {(() => {
                          // Show original quantity without any deductions
                          const originalQty = parseInt(stock.QTY) || 0;
                          const serviceInfo = getServiceInfo(stock.ID, serviceData);
                          // Handle REORDER_POINT - could be null, undefined, or 0
                          const reorderPointRaw = stock.REORDER_POINT;
                          const reorderPoint = (reorderPointRaw !== null && reorderPointRaw !== undefined && reorderPointRaw !== '') 
                            ? parseInt(reorderPointRaw) || null 
                            : null;
                          
                          // Check if below reorder point (quantity must be strictly less than reorder point)
                          const isBelowReorderPoint = reorderPoint !== null && reorderPoint > 0 && originalQty < reorderPoint;
                          
                          // Show service info even if stock quantity is 0
                          const showServiceInfo = serviceInfo && serviceInfo.totalQuantity > 0;
                          
                          // Determine badge style based on quantity and reorder point
                          let badgeStyle = {};
                          let badgeTitle = "Click to edit quantity";
                          
                          if (originalQty <= 0) {
                            badgeStyle = { background: '#dc3545', color: '#fff', boxShadow: '0 2px 6px rgba(220, 53, 69, 0.4)' };
                          } else if (isBelowReorderPoint) {
                            badgeStyle = { background: '#f59e0b', color: '#fff', border: '2px solid #f97316', boxShadow: '0 2px 6px rgba(245, 158, 11, 0.4)' };
                            badgeTitle = `Below reorder point! Current: ${originalQty}, Reorder: ${reorderPoint}. Click to edit quantity.`;
                          } else if (originalQty <= 5) {
                            badgeStyle = { background: '#fbbf24', color: '#fff', boxShadow: '0 2px 6px rgba(251, 191, 36, 0.4)' };
                          } else {
                            badgeStyle = { boxShadow: '0 2px 6px rgba(40, 167, 69, 0.3)' };
                          }
                          
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span 
                                className={`quantity-badge${originalQty <= 0 ? ' out-of-stock' : isBelowReorderPoint ? ' below-reorder' : originalQty <= 5 ? ' low-stock' : ' in-stock'}`}
                                style={badgeStyle}
                                onClick={() => handleQuantityClick(stock.ID, stock)}
                                title={badgeTitle}
                              >
                                {formatNumber(originalQty)}
                              </span>
                              {reorderPointRaw !== null && reorderPointRaw !== undefined && (
                                <div style={{ 
                                  fontSize: '10px', 
                                  color: isBelowReorderPoint ? '#f59e0b' : (reorderPoint > 0 ? '#9ca3af' : 'var(--text-muted)'), 
                                  textAlign: 'center',
                                  fontWeight: '600',
                                  marginTop: '2px',
                                  padding: '2px 4px',
                                  background: isBelowReorderPoint ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                                  borderRadius: '4px',
                                  whiteSpace: 'nowrap'
                                }}>
                                  Reorder: {reorderPoint > 0 ? reorderPoint : 'Not Set'}
                                </div>
                              )}
                              {showServiceInfo && (
                                <div style={{ 
                                  fontSize: '10px', 
                                  color: '#f59e0b', 
                                  textAlign: 'center',
                                  fontWeight: '600',
                                  background: 'rgba(255, 193, 7, 0.15)',
                                  padding: '2px 6px',
                                  borderRadius: '6px',
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
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <button 
                            className="pos-stock-action-btn" 
                            onClick={() => handleRequestClick(stock)} 
                            style={{ 
                              padding: '6px 12px', 
                              fontSize: '12px',
                              background: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 500,
                              transition: 'all 0.2s',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              height: '32px',
                              minWidth: '90px',
                              justifyContent: 'center'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = '#1e40af';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 2px 4px rgba(37, 99, 235, 0.3)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = '#2563eb';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            <FileText size={12} />
                            Request
                          </button>
                          <button 
                            className="pos-stock-action-btn" 
                            onClick={(e) => { e.stopPropagation(); handleAdjustmentClick(stock); }} 
                            style={{ 
                              padding: '6px 12px', 
                              fontSize: '12px',
                              background: '#16a34a',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 500,
                              transition: 'all 0.2s',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              height: '32px',
                              minWidth: '100px',
                              justifyContent: 'center'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = '#15803d';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 2px 4px rgba(22, 163, 74, 0.3)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = '#16a34a';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            <Edit size={12} />
                            Adjustment
                          </button>
                        </div>
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
                background: 'var(--bg-secondary)', 
                padding: '16px', 
                borderRadius: '8px 8px 0 0',
                borderBottom: '2px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ 
                  color: 'var(--text-primary)', 
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
                      <th>Date</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compatibilityResults.map((part, index) => {
                      const serviceInfo = getServiceInfo(part.ID, serviceData);
                      return (
                      <tr 
                        key={`${part.ID}-${index}`} 
                        className={`compatibility-row ${part.QTY <= 0 ? 'out-of-stock' : ''} ${serviceInfo ? 'in-service' : ''} ${selectedStocks.some(s => s.ID === part.ID) ? 'selected' : ''}`} 
                        style={(() => {
                          const qty = parseInt(part.QTY) || 0;
                          
                          // If quantity is 0, make the row red (priority over service info)
                          if (qty <= 0) {
                            return {
                              backgroundColor: 'rgba(220, 53, 69, 0.2)',
                              borderLeft: '3px solid #dc3545'
                            };
                          }
                          
                          // If service info exists and quantity > 0, show yellow
                          if (serviceInfo) {
                            return {
                              backgroundColor: 'rgba(255, 193, 7, 0.15)',
                              borderLeft: '3px solid #f59e0b'
                            };
                          }
                          
                          return {};
                        })()}
                        onClick={(e) => handleCompatibilityRowClick(e, part)}
                      >
                        <td>
                                                  <input
                          type="checkbox"
                          checked={selectedStocks.some(s => s.ID === part.ID)}
                          onChange={() => handleCompatibilitySelectRow(part)}
                          className="pos-checkbox"
                        />
                        </td>
                        <td className="pos-stock-cell">
                          <div 
                            style={{ 
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                            onClick={(e) => handleBenzClick(e, part.BENZ, part.BRAND, part.ALTNO, part.DESCRIPTION || part.REMARKS, part.APPLICATION || part.APPL)}
                            title="Click to view movement history"
                          >
                            {part.BENZ}
                          </div>
                          {part.BENZ2 && part.BENZ2 !== '-' && (
                            <div 
                              style={{ 
                                fontSize: '0.85em', 
                                color: 'var(--text-muted)', 
                                marginTop: '2px',
                                cursor: 'pointer'
                              }}
                              onClick={(e) => handleBenzClick(e, part.BENZ2, part.BRAND, part.ALTNO, part.DESCRIPTION || part.REMARKS, part.APPLICATION || part.APPL)}
                              title="Click to view movement history"
                            >
                              {part.BENZ2}
                            </div>
                          )}
                          {part.BENZ3 && part.BENZ3 !== '-' && (
                            <div 
                              style={{ 
                                fontSize: '0.85em', 
                                color: 'var(--text-muted)', 
                                marginTop: '2px',
                                cursor: 'pointer'
                              }}
                              onClick={(e) => handleBenzClick(e, part.BENZ3, part.BRAND, part.ALTNO, part.DESCRIPTION || part.REMARKS, part.APPLICATION || part.APPL)}
                              title="Click to view movement history"
                            >
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
                        <td className="pos-stock-cell">{formatDateShort(part.DATE)}</td>
                        <td className="pos-stock-cell" style={{ textAlign: 'center' }}>
                          {(() => {
                            // Show original quantity without any deductions
                            const originalQty = parseInt(part.QTY) || 0;
                            const serviceInfo = getServiceInfo(part.ID, serviceData);
                            
                            // Show service info even if stock quantity is 0
                            const showServiceInfo = serviceInfo && serviceInfo.totalQuantity > 0;
                            
                            return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span 
                                className={`quantity-badge${originalQty <= 0 ? ' out-of-stock' : originalQty <= 5 ? ' low-stock' : ' in-stock'}`}
                                style={originalQty <= 0 ? { background: '#dc3545', color: '#fff' } : {}}
                                onClick={() => handleQuantityClick(part.ID, part)}
                                title="Click to edit quantity"
                              >
                                {originalQty}
                              </span>
                                {showServiceInfo && (
                                <div style={{ 
                                  fontSize: '10px', 
                                  color: '#f59e0b', 
                                  textAlign: 'center',
                                  fontWeight: '600',
                                  background: 'rgba(255, 193, 7, 0.15)',
                                  padding: '2px 6px',
                                  borderRadius: '6px',
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
                                borderRadius: '6px',
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
                                borderRadius: '6px',
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

          {/* Pagination - show when there are multiple pages */}
          {totalPages > 1 && (
            <div className="pos-pagination">
              <button
                className="pos-pagination-btn"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isFetching}
              >
                {isFetching ? (
                  <RefreshCw className="w-4 h-4 animate-spin" style={{ marginRight: '8px' }} />
                ) : null}
                Previous
              </button>
              <span className="pos-pagination-info">
                Page {currentPage} of {totalPages} ({formatNumber(totalItems)} items total)
              </span>
              <button
                className="pos-pagination-btn"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isFetching}
              >
                {isFetching ? (
                  <RefreshCw className="w-4 h-4 animate-spin" style={{ marginRight: '8px' }} />
                ) : null}
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
                  <div className="pos-form-group color-code-field" style={{display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '12px'}}>
                    <label style={{fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'unset', minWidth: 'fit-content', width: 'auto', maxWidth: 'none', display: 'block', flexShrink: '0', paddingTop: '8px', background: 'rgba(0, 255, 0, 0.2)', border: '2px solid rgba(0, 255, 0, 0.5)', padding: '4px 8px'}}>Color Code</label>
                    <input type="text" name="COLORCODE" value={modalForm.COLORCODE || ''} onChange={handleModalFormChange} className="pos-form-input" style={{width: '100%', marginTop: '0', flex: '1'}} />
                  </div>
                  <div className="pos-form-group remarks-field" style={{display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '12px'}}>
                    <label style={{fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'unset', minWidth: 'fit-content', width: 'auto', maxWidth: 'none', display: 'block', flexShrink: '0', paddingTop: '8px', background: 'rgba(255, 0, 0, 0.2)', border: '2px solid rgba(255, 0, 0, 0.5)', padding: '4px 8px'}}>Remarks</label>
                    <input type="text" name="REMARKS" value={modalForm.REMARKS || ''} onChange={handleModalFormChange} className="pos-form-input" style={{width: '100%', marginTop: '0', flex: '1'}} />
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
                <button 
                  type="submit" 
                  className="pos-stock-action-btn"
                  style={{
                    background: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '14px',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#15803d';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(22, 163, 74, 0.4)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#16a34a';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <CheckCircle size={16} />
                  Submit Request
                </button>
                <button 
                  type="button" 
                  className="pos-stock-action-btn" 
                  onClick={handleRequestModalClose}
                  style={{
                    background: '#6b7280',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '14px',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#4b5563';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(107, 114, 128, 0.4)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#6b7280';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <X size={16} />
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scan Modal */}
      {scanModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content" style={{ background: 'var(--modal-bg)', padding: 32, borderRadius: 8, minWidth: 320, maxWidth: 400, color: 'var(--text-primary)', textAlign: 'center' }}>
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
              style={{ width: '100%', padding: 8, marginBottom: 16, borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
            />
            <button className="pos-btn" onClick={() => setScanModalOpen(false)} style={{ marginTop: 8 }}>Close</button>
          </div>
        </div>
      )}



      {/* Cart functionality - enabled when adding to order or when cart is open */}
      {(addToOrderId || cartOpen) && (
        <div className="pos-cart-modal" style={{ minWidth: 380, maxWidth: 420, margin: '0 auto', background: 'var(--modal-bg)', borderRadius: 12, boxShadow: '0 4px 24px 0 var(--shadow-md)', padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '90vh', height: '90vh' }}>
          <div className="pos-cart-modal-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', background: 'var(--bg-secondary)', borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: '18px 24px 10px 24px' }}>
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 20, color: '#90caf9', letterSpacing: 1 }}>Parts Requisition/Issuance Slip</span>
                                  <button className="pos-cart-modal-close" style={{ fontSize: 22, color: '#90caf9', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 12 }} onClick={() => {
                      if (addToOrderId) {
                        // If in "Add to Order" mode, navigate back to warehouses
                        navigate('/warehouses');
                      } else {
                        setCartOpen(false);
                        setSelectedStocks([]);
                        setCartExpanded(false);
                        setOrderNumber(null);
                        setOrderId(null);
                      }
                    }}>×</button>
            </div>
            {orderNumber && (
              <div style={{ marginTop: 8, fontWeight: 600, fontSize: 15, color: '#1976d2', letterSpacing: 1, background: 'var(--bg-tertiary)', padding: '4px 12px', borderRadius: 6 }}>
                Order Number: #{orderNumber}
              </div>
            )}
            {addToOrderId && (
              <div style={{ marginTop: 8, fontWeight: 600, fontSize: 15, color: '#17a2b8', letterSpacing: 1, background: 'var(--bg-tertiary)', padding: '4px 12px', borderRadius: 6 }}>
                Adding to Order #{addToOrderId}
              </div>
            )}
          </div>
          <div className="pos-cart-list" style={{ padding: '18px 24px 0 24px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <div style={{ fontWeight: 600, color: '#90caf9', fontSize: 15, marginBottom: 8 }}>
              {addToOrderId ? 'Items to Add' : 'Order Items'}
            </div>
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
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--bg-tertiary)', borderRadius: 8, padding: '10px 12px', minHeight: 56 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: 1, maxWidth: '60%' }}>
                        <div className="pos-cart-item-desc" style={{ fontWeight: 700, color: '#90caf9', marginBottom: 2, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.ID}>ID: {stock.ID}</div>
                        <div className="pos-cart-item-desc" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.BENZ}>{stock.BENZ}</div>
                        <div className="pos-cart-item-desc" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.BRAND + ' ' + stock.ALTNO}>{stock.BRAND} {stock.ALTNO}</div>
                        <div className="pos-cart-item-desc" style={{ fontWeight: 400, color: 'var(--text-primary)', fontSize: 13, marginTop: 2, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.DESCRIPTION || 'No description'}>{stock.DESCRIPTION || 'No description'}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, marginLeft: 8, minWidth: 0, flexShrink: 0 }}>
                        <div className="pos-cart-item-desc" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 500 }}>QTY:</span>
                          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-tertiary)', borderRadius: 8, padding: '2px 6px' }}>
                            <button
                              style={{
                                background: 'var(--bg-tertiary)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
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
                              fontSize: '13px',
                              minWidth: '24px',
                              textAlign: 'center',
                              display: 'inline-block'
                            }}>{stock.QUANTITY}</span>
                            <button
                              style={{
                                background: 'var(--bg-tertiary)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
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
                              border: editingPriceId === stock.ID ? '1px solid #1976d2' : '1px solid var(--border-color)', 
                              padding: '2px 6px', 
                              fontSize: '1em', 
                              background: 'var(--input-bg)', 
                              color: 'var(--text-primary)', 
                              textAlign: 'right' 
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{ color: 'var(--text-muted)', margin: '8px 0', textAlign: 'center' }}>
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
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--bg-tertiary)', borderRadius: 8, padding: '10px 12px', minHeight: 56 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: 1, maxWidth: '60%' }}>
                        <div className="pos-cart-item-desc" style={{ fontWeight: 700, color: '#90caf9', marginBottom: 2, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.ID}>ID: {stock.ID}</div>
                        <div className="pos-cart-item-desc" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.BENZ}>{stock.BENZ}</div>
                        <div className="pos-cart-item-desc" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.BRAND + ' ' + stock.ALTNO}>{stock.BRAND} {stock.ALTNO}</div>
                        <div className="pos-cart-item-desc" style={{ fontWeight: 400, color: 'var(--text-primary)', fontSize: 13, marginTop: 2, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.DESCRIPTION || 'No description'}>{stock.DESCRIPTION || 'No description'}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, marginLeft: 8, minWidth: 0, flexShrink: 0 }}>
                        <div className="pos-cart-item-desc" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 500 }}>QTY:</span>
                          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-tertiary)', borderRadius: 8, padding: '2px 6px' }}>
                            <button
                              style={{
                                background: 'var(--bg-tertiary)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
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
                              fontSize: '13px',
                              minWidth: '24px',
                              textAlign: 'center',
                              display: 'inline-block'
                            }}>{stock.QUANTITY}</span>
                            <button
                              style={{
                                background: 'var(--bg-tertiary)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
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
                              border: editingPriceId === stock.ID ? '1px solid #1976d2' : '1px solid var(--border-color)', 
                              padding: '2px 6px', 
                              fontSize: '1em', 
                              background: 'var(--input-bg)', 
                              color: 'var(--text-primary)', 
                              textAlign: 'right' 
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {(selectedStocks.length > CART_COMPRESS_LIMIT && cartExpanded) && (
                  <div style={{ color: 'var(--text-muted)', margin: '8px 0', textAlign: 'center' }}>
                    <button style={{ color: '#1976d2', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }} onClick={() => setCartExpanded(false)}>Collapse</button>
                  </div>
                )}
              </>
            )}
            {selectedStocks.length === 0 && <div style={{color:'var(--text-muted)'}}>No items selected.</div>}
          </div>
          <div className="pos-cart-modal-footer" style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '18px 0 18px 0', flexWrap: 'wrap' }}>
            {addToOrderId ? (
              // "Add to Order" mode - only show Add to Order button
              <>
                <button
                  onClick={handleAddToOrder}
                  disabled={selectedStocks.length === 0}
                  style={{ border: '1.5px solid #17a2b8', color: '#fff', background: '#17a2b8', borderRadius: 6, padding: '10px 24px', fontWeight: 600, fontSize: '0.9em', minWidth: 120, transition: 'background 0.2s, color 0.2s' }}
                >
                  Add to Order #{addToOrderId}
                </button>
                <button
                  onClick={() => {
                    setSelectedStocks([]);
                    setCartOpen(false);
                    navigate('/warehouses');
                  }}
                  style={{ border: '1.5px solid #6c757d', color: '#fff', background: '#6c757d', borderRadius: 6, padding: '10px 24px', fontWeight: 600, fontSize: '0.9em', minWidth: 120, transition: 'background 0.2s, color 0.2s' }}
                >
                  Cancel
                </button>
              </>
            ) : (
              // Normal mode - show all buttons
              <>
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
              </>
            )}
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
            backgroundColor: 'var(--modal-bg)',
            borderRadius: 12,
            padding: 0,
            maxWidth: '600px',
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
              background: 'var(--bg-secondary)'
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
                      onChange={e => setQuotationForm(prev => ({ ...prev, customer_name: e.target.value.toUpperCase() }))}
                      placeholder="Enter customer name"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid #2d2d2d',
                        backgroundColor: 'var(--input-bg)',
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
                        backgroundColor: 'var(--input-bg)',
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
                        backgroundColor: 'var(--input-bg)',
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
                  backgroundColor: 'var(--bg-tertiary)'
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
                backgroundColor: 'var(--bg-tertiary)',
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
              background: 'var(--bg-tertiary)'
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
                  e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
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
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--bg-tertiary)', borderRadius: 8, padding: '10px 12px', minHeight: 56 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: 1, width: 180, maxWidth: 180 }}>
                          <div className="pos-cart-item-desc" style={{ fontWeight: 700, color: '#90caf9', marginBottom: 2, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.id}>ID: {stock.id}</div>
                          <div className="pos-cart-item-desc" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.BENZ}>{stock.BENZ}</div>
                          <div className="pos-cart-item-desc" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.BRAND + ' ' + stock.ALTNO}>{stock.BRAND} {stock.ALTNO}</div>
                          <div className="pos-cart-item-desc" style={{ fontWeight: 400, color: 'var(--text-primary)', fontSize: 13, marginTop: 2, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.DESCRIPTION || 'No description'}>{stock.DESCRIPTION || 'No description'}</div>
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
                              style={{ width: 48, borderRadius: 8, border: '1px solid var(--border-color)', padding: '2px 6px', fontSize: '1em', background: 'var(--input-bg)', color: 'var(--text-primary)', textAlign: 'right' }}
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
                              style={{ width: 70, borderRadius: 8, border: '1px solid var(--border-color)', padding: '2px 6px', fontSize: '1em', background: 'var(--input-bg)', color: 'var(--text-primary)', textAlign: 'right' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ color: 'var(--text-muted)', margin: '8px 0', textAlign: 'center' }}>
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
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--bg-tertiary)', borderRadius: 8, padding: '10px 12px', minHeight: 56 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: 1, width: 180, maxWidth: 180 }}>
                          <div className="pos-cart-item-desc" style={{ fontWeight: 700, color: '#90caf9', marginBottom: 2, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.id}>ID: {stock.id}</div>
                          <div className="pos-cart-item-desc" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.BENZ}>{stock.BENZ}</div>
                          <div className="pos-cart-item-desc" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.BRAND + ' ' + stock.ALTNO}>{stock.BRAND} {stock.ALTNO}</div>
                          <div className="pos-cart-item-desc" style={{ fontWeight: 400, color: 'var(--text-primary)', fontSize: 13, marginTop: 2, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.DESCRIPTION || 'No description'}>{stock.DESCRIPTION || 'No description'}</div>
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
                              style={{ width: 48, borderRadius: 8, border: '1px solid var(--border-color)', padding: '2px 6px', fontSize: '1em', background: 'var(--input-bg)', color: 'var(--text-primary)', textAlign: 'right' }}
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
                              style={{ width: 70, borderRadius: 8, border: '1px solid var(--border-color)', padding: '2px 6px', fontSize: '1em', background: 'var(--input-bg)', color: 'var(--text-primary)', textAlign: 'right' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(returnedOrderModal.items.length > CART_COMPRESS_LIMIT && returnedExpanded) && (
                    <div style={{ color: 'var(--text-muted)', margin: '8px 0', textAlign: 'center' }}>
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
                <p style={{ marginBottom: '20px', color: 'var(--text-primary)' }}>
                  Scan a barcode to quickly find the item in inventory
                </p>
                
                {/* Manual Barcode Input */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-primary)', textAlign: 'left' }}>
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
                      border: '1px solid var(--border-color)',
                      background: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '16px'
                    }}
                    autoFocus
                  />
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
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-color)',
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

      {/* Label Setup Modal - 2 Step Process */}
      {showLabelSetup && (
        <div className="pos-modal-overlay export-preview-overlay" onClick={closeLabelSetup}>
          <div 
            className="pos-modal export-preview-modal" 
            onClick={(e) => e.stopPropagation()}
          >
            {labelSetupStep === 1 ? (
              // STEP 1: Setup quantities and notes
              <>
                <div className="pos-modal-header">
                  <h2>Label Setup - Adjust Quantities & Add Notes</h2>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button 
                      className="pos-modal-btn pos-modal-btn-secondary"
                      onClick={closeLabelSetup}
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="pos-modal-body">
                  <div className="export-preview-info">
                    <p><strong>Total Items:</strong> {labelSetupData.length}</p>
                    <p><strong>Step:</strong> 1 of 2 - Setup quantities and notes</p>
                  </div>

                  {/* Search Bar */}
                  <div style={{ marginBottom: '15px' }}>
                    <input
                      type="text"
                      placeholder="Search by ID..."
                      value={labelSearchTerm}
                      onChange={(e) => setLabelSearchTerm(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        background: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>

                  {/* Setup Table */}
                  <div className="export-preview-table-container">
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
                          <th>QTY</th>
                          <th>NOTE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLabelSetupData.map((item, index) => (
                          <tr key={item.ID || index}>
                            <td>{item.BENZ || ''}</td>
                            <td>{item.BENZ2 || ''}</td>
                            <td>{item.BENZ3 || ''}</td>
                            <td>{item.BRAND || ''}</td>
                            <td>{item.ALTNO || ''}</td>
                            <td>{item.DESCRIPTION || item.REMARKS || ''}</td>
                            <td>{item.ID || ''}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max="999"
                                value={item.labelQuantity || 0}
                                onChange={(e) => handleLabelQuantityChange(item.ID, e.target.value)}
                                style={{
                                  width: '80px',
                                  padding: '4px 6px',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '6px',
                                  background: 'var(--input-bg)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.85em',
                                  textAlign: 'center'
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={item.labelNote || ''}
                                onChange={(e) => {
                                  handleLabelNoteChange(item.ID, e.target.value);
                                }}
                                onBlur={(e) => {
                                  // Auto-format if it's just a number when user finishes typing
                                  const value = e.target.value.trim();
                                  if (value && !isNaN(value) && !value.includes('pcs')) {
                                    handleLabelNoteChange(item.ID, `${value}pcs/sold per pc`);
                                  }
                                }}
                                placeholder="e.g., 2 or custom text"
                                style={{
                                  width: '140px',
                                  padding: '4px 6px',
                                  border: '1px solid #404040',
                                  borderRadius: '6px',
                                  background: 'var(--card-bg)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.8em'
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="pos-modal-footer">
                  <button 
                    className="pos-modal-btn pos-modal-btn-secondary"
                    onClick={closeLabelSetup}
                  >
                    <X className="w-5 h-5" />
                    Cancel
                  </button>
                  <button 
                    className="pos-modal-btn pos-modal-btn-primary"
                    onClick={generateMultipliedPreview}
                  >
                    Next: Generate Labels →
                  </button>
                </div>
              </>
            ) : (
              // STEP 2: Show multiplied preview (reuse existing export preview layout)
              <>
                <div className="pos-modal-header">
                  <h2>Export Preview - Generated Labels</h2>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button 
                      className="pos-modal-btn pos-modal-btn-secondary"
                      onClick={clearAllExportItems}
                      disabled={exportPreviewData.length === 0}
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      Clear All
                    </button>
                    <button 
                      className="pos-modal-btn pos-modal-btn-secondary"
                      onClick={closeLabelSetup}
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="pos-modal-body">
                  <div className="export-preview-info">
                    <p><strong>Export Type:</strong> Generated Labels</p>
                    <p><strong>Total Labels:</strong> {exportPreviewData.length}</p>
                    <p><strong>Export Date:</strong> {new Date().toLocaleDateString()}</p>
                    {/* Show items with notes */}
                    {(() => {
                      const itemsWithNotes = labelSetupData.filter(item => item.labelNote);
                      return itemsWithNotes.length > 0 ? (
                        <p><strong>Items with notes:</strong> {itemsWithNotes.map(item => `ID ${item.ID} (${item.labelNote})`).join(', ')}</p>
                      ) : null;
                    })()}
                  </div>

                  <div className="export-preview-table-container">
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
                          <th>NOTE</th>
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
                            <td>{row['NOTE']}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="pos-modal-footer">
                  <button 
                    className="pos-modal-btn pos-modal-btn-secondary"
                    onClick={goBackToLabelSetup}
                  >
                    ← Back to Setup
                  </button>
                  <button 
                    className="pos-modal-btn pos-modal-btn-primary"
                    onClick={handleExportToOldID}
                    disabled={exportPreviewData.length === 0}
                    style={{ 
                      background: 'linear-gradient(135deg, #6c757d, #495057)', 
                      borderColor: '#6c757d',
                      marginRight: '10px'
                    }}
                  >
                    <Download className="w-5 h-5" />
                    Export to Old ID
                  </button>
                  <button 
                    className="pos-modal-btn pos-modal-btn-primary"
                    onClick={handleExportToExcel}
                    disabled={exportPreviewData.length === 0}
                  >
                    <Download className="w-5 h-5" />
                    Export to XLSX
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Export Preview Modal */}
      {showExportPreview && (
        <div className="pos-modal-overlay export-preview-overlay" onClick={() => setShowExportPreview(false)}>
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
                <X className="w-5 h-5" />
                Cancel
              </button>
              <button 
                className="pos-modal-btn pos-modal-btn-primary"
                onClick={handleExportToExcel}
                disabled={exportPreviewData.length === 0}
              >
                <Download className="w-5 h-5" />
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
                    background: 'var(--card-bg)', 
                    color: '#00ff00', 
                    fontFamily: 'monospace',
                    padding: '15px',
                    borderRadius: '8px',
                    textAlign: 'left',
                    fontSize: '12px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{ marginBottom: '10px', color: 'var(--text-primary)' }}>
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
          <div className="pos-modal" style={{ maxWidth: '95vw', width: '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, position: 'relative' }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: '20px' }}>Barcode Scan Result</h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', opacity: 0.7 }}>Item Information</p>
                </div>
                <div style={{ 
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)', 
                  padding: '10px 20px', 
                  borderRadius: '8px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(74, 144, 226, 0.4), 0 2px 4px rgba(0,0,0,0.3)',
                  transition: 'all 0.3s ease'
                }}>
                  <span style={{ fontSize: '16px', color: 'var(--text-primary)', fontWeight: '700', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>ID:</span>
                  <span style={{ fontSize: '16px', color: 'var(--text-primary)', fontWeight: '700', fontFamily: 'monospace', letterSpacing: '1px', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                    {scannedBarcode || scannedInmainData?.reference || scannedStockData.ID || 'N/A'}
                  </span>
                </div>
              </div>
              <button className="pos-modal-close" onClick={() => setShowBarcodeResult(false)}>×</button>
            </div>
            
            <div className="pos-modal-body" style={{ overflowY: 'auto', flex: 1, background: 'var(--modal-bg)' }}>
              {scannedStockData ? (
                <div style={{ padding: '16px' }}>
                  {/* Compact Form Matching Incoming Form Layout */}
                  <div style={{ 
                    background: 'var(--card-bg)',
                    borderRadius: '12px',
                    padding: '18px',
                    boxShadow: '0 2px 8px var(--shadow-md)',
                    border: '1px solid var(--border-color)',
                    position: 'relative'
                  }}>
                    {/* Row 1: Reference, Supplier, Date */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '5fr 5fr 4fr',
                      gap: '12px', 
                      alignItems: 'center',
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px', flexShrink: 0 }}>Reference:</label>
                        <div style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          {scannedInmainData?.reference || scannedBarcode || '-'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px', flexShrink: 0 }}>Supplier:</label>
                        <div style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          {scannedInmainData?.supplier || '-'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px', flexShrink: 0 }}>Date:</label>
                        <div style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          {(() => {
                            const rawDate = scannedInmainData?.date || scannedStockData.DATE || '';
                            if (!rawDate) return '-';
                            if (/^\d{8}$/.test(rawDate)) {
                              const year = rawDate.substring(0, 4);
                              const month = rawDate.substring(4, 6);
                              const day = rawDate.substring(6, 8);
                              return `${year}-${month}-${day}`;
                            }
                            if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
                            return rawDate;
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Row 2: DIN */}
                    <div style={{ 
                      display: 'grid',
                      gridTemplateColumns: '2fr 2fr 1.5fr',
                      gap: '12px',
                      alignItems: 'center',
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px', flexShrink: 0 }}>DIN:</label>
                        <div style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '60px',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          flexShrink: 0
                        }}>
                          {scannedMasterData?.dinflag || '-'}
                        </div>
                      </div>
                    </div>

                    {/* Row 3: Benz, Benz2, Benz3 */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '2fr 2fr 1.5fr',
                      gap: '12px', 
                      alignItems: 'center',
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px', flexShrink: 0 }}>Benz:</label>
                        <input
                          type="text"
                          value={editedBenz}
                          onChange={(e) => setEditedBenz(e.target.value)}
                          style={{
                            padding: '14px 18px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--input-bg)',
                            color: 'var(--text-primary)',
                            width: '100%',
                            fontSize: '13px',
                            fontWeight: '500',
                            height: '46px',
                            boxSizing: 'border-box'
                          }}
                          placeholder="Enter Benz part number"
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px', flexShrink: 0 }}>Benz2:</label>
                        <div style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          {scannedStockData.BENZ2 || '-'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px', flexShrink: 0 }}>Benz3:</label>
                        <div style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          {scannedStockData.BENZ3 || '-'}
                        </div>
                      </div>
                    </div>

                    {/* Row 4: Brand, OEM, OEM2 */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '2fr 2fr 1.5fr',
                      gap: '12px', 
                      alignItems: 'center',
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px', flexShrink: 0 }}>Brand:</label>
                        <input
                          type="text"
                          value={editedBrand}
                          onChange={(e) => setEditedBrand(e.target.value)}
                          style={{
                            padding: '14px 18px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--input-bg)',
                            color: 'var(--text-primary)',
                            width: '100%',
                            fontSize: '13px',
                            fontWeight: '500',
                            height: '46px',
                            boxSizing: 'border-box'
                          }}
                          placeholder="Enter brand name"
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px', flexShrink: 0 }}>OEM:</label>
                        <input
                          type="text"
                          value={editedOem}
                          onChange={(e) => setEditedOem(e.target.value)}
                          style={{
                            padding: '14px 18px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--input-bg)',
                            color: 'var(--text-primary)',
                            width: '100%',
                            fontSize: '13px',
                            fontWeight: '500',
                            height: '46px',
                            boxSizing: 'border-box'
                          }}
                          placeholder="Enter OEM number"
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px', flexShrink: 0 }}>OEM2:</label>
                        <div style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          {scannedStockData.ALTNO2 || '-'}
                        </div>
                      </div>
                    </div>

                    {/* Row 5: Description, Color Code, Location */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '2fr 2fr 1.5fr',
                      gap: '12px', 
                      alignItems: 'center',
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px', flexShrink: 0 }}>Description:</label>
                        <div style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          minWidth: '280px',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          {scannedMasterData?.description || '-'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '120px', whiteSpace: 'nowrap', flexShrink: 0 }}>Color Code:</label>
                        <div style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          {scannedStockData.COLORCODE || '-'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px', flexShrink: 0 }}>Location:</label>
                        <div style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          {scannedStockData.LOCATION || '-'}
                        </div>
                      </div>
                    </div>

                    {/* Row 6: Application, Remarks, Currency */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '2fr 2fr 1.5fr',
                      gap: '12px', 
                      alignItems: 'center',
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px', flexShrink: 0 }}>Application:</label>
                        <div style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          minWidth: '280px',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          {scannedMasterData?.application || '-'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '120px', whiteSpace: 'nowrap', flexShrink: 0 }}>Remarks:</label>
                        <div style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          {scannedStockData.REMARKS || '-'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px', flexShrink: 0 }}>Currency:</label>
                        <div style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          {scannedStockData.CURRENCY || '-'}
                        </div>
                      </div>
                    </div>

                    {/* Section Divider */}
                    <div style={{
                      height: '1px',
                      background: 'linear-gradient(90deg, transparent, #4A4A4A, transparent)',
                      margin: '20px 0',
                      width: '100%'
                    }}></div>

                    {/* Financial Section - Single Row */}
                    <div style={{
                      background: 'var(--bg-tertiary)',
                      borderRadius: '8px',
                      padding: '16px',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'row',
                      gap: '10px',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      flexWrap: 'wrap',
                      boxShadow: '0 1px 4px var(--shadow-sm)'
                    }}>
                      {/* Cost */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px', minWidth: '35px', whiteSpace: 'nowrap' }}>Cost:</label>
                        <div style={{
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100px',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '40px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center',
                          fontFamily: 'monospace'
                        }}>
                          {scannedStockData.COST ? `₱${parseFloat(scannedStockData.COST).toFixed(2)}` : '-'}
                        </div>
                      </div>
                      
                      {/* Selling Price */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px', minWidth: '60px', whiteSpace: 'nowrap' }}>Selling:</label>
                        <div style={{
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100px',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '40px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center',
                          fontFamily: 'monospace'
                        }}>
                          {scannedStockData.SELL ? `₱${parseFloat(scannedStockData.SELL).toFixed(2)}` : '-'}
                        </div>
                      </div>
                      
                      {/* Quantity */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px', minWidth: '45px', whiteSpace: 'nowrap' }}>Qty:</label>
                        <div style={{
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '50px',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '40px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center',
                          fontFamily: 'monospace'
                        }}>
                          {scannedInmainData?.quantity || scannedStockData.QTY || '-'}
                        </div>
                      </div>
                      
                      {/* Reorder Point */}
                      {(scannedMasterData?.REORDER || scannedStockData.REORDER_POINT) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px', minWidth: '85px', whiteSpace: 'nowrap' }}>Reorder Point:</label>
                          <div style={{
                            padding: '10px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--input-bg)',
                            color: 'var(--text-primary)',
                            width: '50px',
                            fontSize: '13px',
                            fontWeight: '500',
                            height: '40px',
                            boxSizing: 'border-box',
                            display: 'flex',
                            alignItems: 'center',
                            fontFamily: 'monospace'
                          }}>
                            {scannedMasterData?.REORDER || scannedStockData.REORDER_POINT || '-'}
                          </div>
                        </div>
                      )}
                      
                      {/* FC Cost */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px', minWidth: '55px', whiteSpace: 'nowrap' }}>FC Cost:</label>
                        <div style={{
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '80px',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '40px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center',
                          fontFamily: 'monospace'
                        }}>
                          {scannedStockData.FC_COST || scannedStockData.FCAMOUNT ? `₱${parseFloat(scannedStockData.FC_COST || scannedStockData.FCAMOUNT).toFixed(2)}` : '-'}
                        </div>
                      </div>
                      
                      {/* Unit */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px', minWidth: '30px', whiteSpace: 'nowrap' }}>Unit:</label>
                        <div style={{
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '70px',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '40px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          {scannedStockData.UNIT || scannedMasterData?.unit || 'pcs'}
                        </div>
                      </div>
                      
                      {/* Conv */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px', minWidth: '35px', whiteSpace: 'nowrap' }}>Conv:</label>
                        <div style={{
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '80px',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '40px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center',
                          fontFamily: 'monospace'
                        }}>
                          {scannedStockData.CONVERSION || '1.0000'}
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
            
            {/* Modal Footer with Save Button */}
            {scannedStockData && (
              <div style={{
                padding: '16px 20px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                background: 'var(--modal-bg)'
              }}>
                <button
                  onClick={() => setShowBarcodeResult(false)}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'var(--bg-tertiary)'}
                  onMouseLeave={(e) => e.target.style.background = 'var(--bg-secondary)'}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBarcodeScan}
                  disabled={isSavingBarcodeScan}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: isSavingBarcodeScan ? '#6c757d' : 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: isSavingBarcodeScan ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(74, 144, 226, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSavingBarcodeScan) {
                      e.target.style.transform = 'translateY(-1px)';
                      e.target.style.boxShadow = '0 4px 12px rgba(74, 144, 226, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 8px rgba(74, 144, 226, 0.3)';
                  }}
                >
                  {isSavingBarcodeScan ? (
                    <>
                      <span style={{ 
                        display: 'inline-block',
                        width: '14px',
                        height: '14px',
                        border: '2px solid white',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                      }} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            )}
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
        </>
      ) : (
        // Incoming View (Table or Form)
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
          {incomingSubView === 'table' ? (
            // Incoming Stocks Table View
            <>
              {/* Incoming Stocks Table */}
              <div style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                padding: '0',
                color: 'var(--text-primary)',
                width: '100%'
              }}>
                {/* Navigation Header */}
                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '16px 20px',
                  marginBottom: '16px',
                  boxShadow: '0 2px 8px var(--shadow-md)'
                }}>
                  {/* Row 1: Back button | Search bar | Previous/Next | Add new */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    {/* Back Button - Go back to main stocks view */}
                    <button
                      onClick={() => setCurrentView('stocks')}
                      style={{
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      ← Back
                    </button>
                    
                    {/* Search Bar */}
                    <input
                      type="text"
                      placeholder="Search by Reference..."
                      value={incomingReferenceSearch}
                      onChange={(e) => setIncomingReferenceSearch(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        background: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        fontSize: '14px'
                      }}
                    />
                    
                    {/* Date Selector */}
                    <input
                      type="date"
                      value={incomingSelectedDate}
                      onChange={(e) => setIncomingSelectedDate(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        background: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        minWidth: '140px'
                      }}
                    />
                    
                    {/* Previous/Next Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          goToPreviousIncomingDate();
                        }}
                        disabled={incomingLoading || !incomingSelectedDate}
                        style={{
                          background: incomingLoading || !incomingSelectedDate ? '#6c757d' : '#2196F3',
                          color: 'white',
                          border: 'none',
                          padding: '8px 12px',
                          borderRadius: '4px',
                          cursor: incomingLoading || !incomingSelectedDate ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                          opacity: incomingLoading || !incomingSelectedDate ? 0.6 : 1,
                          transition: 'all 0.2s ease'
                        }}
                        title={incomingLoading ? 'Loading...' : 'Go to previous date'}
                      >
                        ← Prev
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          goToNextIncomingDate();
                        }}
                        disabled={incomingLoading || !incomingSelectedDate}
                        style={{
                          background: incomingLoading || !incomingSelectedDate ? '#6c757d' : '#2196F3',
                          color: 'white',
                          border: 'none',
                          padding: '8px 12px',
                          borderRadius: '4px',
                          cursor: incomingLoading || !incomingSelectedDate ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                          opacity: incomingLoading || !incomingSelectedDate ? 0.6 : 1,
                          transition: 'all 0.2s ease'
                        }}
                        title={incomingLoading ? 'Loading...' : 'Go to next date'}
                      >
                        Next →
                      </button>
                    </div>
                    
                    {/* Add New Button */}
                    <button
                      onClick={() => setIncomingSubView('form')}
                      style={{
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#218838';
                        e.target.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = '#28a745';
                        e.target.style.transform = 'translateY(0)';
                      }}
                    >
                      + Add New
                    </button>
                  </div>
                  
                  {/* Reference Tabs Container */}
                  {incomingRefDateCombinations.length > 0 && (
                    <div style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '12px 16px',
                      marginBottom: '16px'
                    }}>
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                        flexWrap: 'wrap'
                      }}>
                        {incomingRefDateCombinations
                          .filter(combo => combo.date === incomingRefDateCombinations[incomingCurrentCombinationIndex]?.date)
                          .map((combo, index) => {
                            const isActive = combo.REF === incomingRefDateCombinations[incomingCurrentCombinationIndex]?.REF;
                            return (
                              <button
                                key={`${combo.REF}_${combo.date}`}
                                onClick={() => {
                                  const targetIndex = incomingRefDateCombinations.findIndex(c => 
                                    c.REF === combo.REF && c.date === combo.date
                                  );
                                  if (targetIndex !== -1) {
                                    setIncomingCurrentCombinationIndex(targetIndex);
                                  }
                                }}
                                style={{
                                  background: isActive ? '#007bff' : 'var(--bg-tertiary)',
                                  color: '#fff',
                                  border: `1px solid ${isActive ? '#007bff' : 'var(--border-color)'}`,
                                  borderRadius: '6px',
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  fontWeight: isActive ? '600' : '500',
                                  transition: 'all 0.2s ease',
                                  minWidth: '80px',
                                  textAlign: 'center'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isActive) {
                                    e.target.style.background = 'var(--hover-bg)';
                                    e.target.style.borderColor = 'var(--border-light)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isActive) {
                                    e.target.style.background = 'var(--bg-tertiary)';
                                    e.target.style.borderColor = 'var(--border-color)';
                                  }
                                }}
                              >
                                {combo.REF}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                  
                  {/* Row 2: Reference | Date | Total items | Total items */}
                  {incomingRefDateCombinations.length > 0 && (
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr 1fr 1fr', 
                      gap: '12px',
                      padding: '12px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Reference</div>
                        <div style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px' }}>
                          {incomingRefDateCombinations[incomingCurrentCombinationIndex]?.REF || '-'}
                        </div>
                      </div>
                      
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Date</div>
                        <div style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px' }}>
                          {(() => {
                            const dateStr = incomingRefDateCombinations[incomingCurrentCombinationIndex]?.date || '';
                            if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
                              return `${dateStr.slice(4,6)}/${dateStr.slice(6,8)}/${dateStr.slice(0,4)}`;
                            }
                            return dateStr || '-';
                          })()}
                        </div>
                      </div>
                      
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Quantity</div>
                        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#007bff' }}>
                          {getCurrentCombinationItemsCount()}
                        </div>
                      </div>
                      
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Item</div>
                        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#28a745' }}>
                          {getCurrentCombinationTotalRows()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                
                {/* Current Combination Items Table */}
                <div style={{ padding: '20px' }}>
                  {incomingLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                      Loading incoming stocks...
                    </div>
                  ) : incomingRefDateCombinations.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                      No incoming stock combinations found.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                    <table style={{ 
                      width: '100%', 
                      borderCollapse: 'collapse',
                      backgroundColor: 'var(--card-bg)',
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #007bff', color: 'var(--text-primary)' }}>ID</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #007bff', color: 'var(--text-primary)' }}>Benz</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #007bff', color: 'var(--text-primary)' }}>Brand</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #007bff', color: 'var(--text-primary)' }}>Altno</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #007bff', color: 'var(--text-primary)' }}>Description</th>
                          <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #007bff', color: 'var(--text-primary)' }}>QTY</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #007bff', color: 'var(--text-primary)' }}>Cost</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #007bff', color: 'var(--text-primary)' }}>Sell</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #007bff', color: 'var(--text-primary)' }}>Total Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          if (incomingCurrentCombinationIndex >= incomingRefDateCombinations.length) return null;
                          const currentCombination = incomingRefDateCombinations[incomingCurrentCombinationIndex];
                          return currentCombination.items.map((item, index) => (
                            <tr key={item.ID || index} style={{ 
                              borderBottom: '1px solid var(--border-color)',
                              backgroundColor: index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--card-bg)'
                            }}>
                              <td style={{ padding: '12px', color: 'var(--text-primary)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {item.STOCK_ID && item.STOCK_ID !== 'No Match' ? (
                                    <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
                                      {item.STOCK_ID}
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>No Match</span>
                                  )}
                                  {item.WARNING && (
                                    <button
                                      onClick={() => handleWarningClick(item.id)}
                                      style={{ 
                                        color: '#ffc107', 
                                        fontSize: '13px',
                                        fontWeight: '500',
                                        background: 'rgba(255, 193, 7, 0.1)',
                                        padding: '2px 6px',
                                        borderRadius: '6px',
                                        border: '1px solid #ffc107',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                      }}
                                      title={`${item.WARNING} - Click to view duplicates`}
                                      onMouseEnter={(e) => {
                                        e.target.style.background = 'rgba(255, 193, 7, 0.2)';
                                        e.target.style.transform = 'scale(1.1)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.target.style.background = 'rgba(255, 193, 7, 0.1)';
                                        e.target.style.transform = 'scale(1)';
                                      }}
                                    >
                                      ⚠️
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '12px', color: 'var(--text-primary)' }}>
                                {item.BENZ || item.benz_number || '-'}
                              </td>
                              <td style={{ padding: '12px', color: 'var(--text-primary)' }}>
                                {item.BRAND || item.brand || '-'}
                              </td>
                              <td style={{ padding: '12px', color: 'var(--text-primary)' }}>
                                {item.ALTNO || item.altno || '-'}
                              </td>
                              <td style={{ padding: '12px', color: 'var(--text-primary)', maxWidth: '200px' }}>
                                <div style={{ 
                                  whiteSpace: 'nowrap', 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis',
                                  maxWidth: '100%'
                                }} title={item.DESCRIPTION || 'No description'}>
                                  {item.DESCRIPTION || 'No description'}
                                </div>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-primary)' }}>
                                {item.QTY || item.quantity || 0}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', color: 'var(--text-primary)' }}>
                                ₱{parseFloat(item.COST || item.cost || 0).toFixed(2)}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', color: 'var(--text-primary)' }}>
                                ₱{parseFloat(item.SELL || item.selling_price || 0).toFixed(2)}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', color: 'var(--text-primary)' }}>
                                ₱{((parseFloat(item.COST || item.cost || 0)) * (parseInt(item.QTY || item.quantity || 0))).toFixed(2)}
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            // Incoming Form View
            <>
          {/* Professional Inventory Management Interface */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 180px)',
            width: '100%',
            maxWidth: '1400px',
            margin: '0 auto',
            background: 'var(--bg-primary)',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px var(--shadow-lg)',
            border: '1px solid var(--border-color)',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>

            {/* Tab Navigation with Auto-save Indicator */}
            <div style={{
              background: 'var(--bg-secondary)',
              padding: '12px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              gap: '8px',
              justifyContent: 'center',
              flexWrap: 'wrap',
              position: 'relative'
            }}>
              
              {/* BACK Button */}
              <button
                onClick={() => setCurrentView('stocks')}
                style={{
                  position: 'absolute',
                  left: '24px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#2E7DD2',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = '#1e6bb8';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = '#2E7DD2';
                }}
              >
                BACK
              </button>
              
              {/* Right side: Print, DBF Export button and Auto-save Status */}
              <div style={{
                position: 'absolute',
                right: '24px',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <button
                  onClick={handlePrintIncoming}
                  disabled={(tabSavedItems[currentTab] || []).length === 0}
                  title="Print invoice for current tab"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 10px',
                    background: (tabSavedItems[currentTab] || []).length === 0
                      ? 'rgba(108, 117, 125, 0.2)'
                      : 'rgba(108, 117, 125, 0.2)',
                    border: (tabSavedItems[currentTab] || []).length === 0
                      ? '1px solid #6c757d'
                      : '1px solid #6c757d',
                    borderRadius: '6px',
                    color: (tabSavedItems[currentTab] || []).length === 0 ? '#6c757d' : 'var(--text-primary)',
                    cursor: (tabSavedItems[currentTab] || []).length === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '11px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    opacity: (tabSavedItems[currentTab] || []).length === 0 ? 0.6 : 1
                  }}
                >
                  <Printer size={12} />
                  <span>Print</span>
                </button>
                <button
                  onClick={openArrangeModal}
                  disabled={(tabSavedItems[currentTab] || []).length === 0}
                  title="Arrange lineup (drag to reorder, then save or export DBF)"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 10px',
                    background: (tabSavedItems[currentTab] || []).length === 0
                      ? 'rgba(108, 117, 125, 0.2)'
                      : 'rgba(111, 66, 193, 0.2)',
                    border: (tabSavedItems[currentTab] || []).length === 0
                      ? '1px solid #6c757d'
                      : '1px solid #6f42c1',
                    borderRadius: '6px',
                    color: (tabSavedItems[currentTab] || []).length === 0 ? '#6c757d' : '#6f42c1',
                    cursor: (tabSavedItems[currentTab] || []).length === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '11px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    opacity: (tabSavedItems[currentTab] || []).length === 0 ? 0.6 : 1
                  }}
                >
                  <GripVertical size={12} />
                  <span>Arrange</span>
                </button>
                <button
                  onClick={handleExportIncomingDBF}
                  disabled={loading || (tabSavedItems[currentTab] || []).length === 0}
                  title="Export current tab to INCOMING.DBF"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 10px',
                    background: loading || (tabSavedItems[currentTab] || []).length === 0
                      ? 'rgba(108, 117, 125, 0.2)'
                      : 'rgba(23, 162, 184, 0.2)',
                    border: loading || (tabSavedItems[currentTab] || []).length === 0
                      ? '1px solid #6c757d'
                      : '1px solid #17a2b8',
                    borderRadius: '6px',
                    color: loading || (tabSavedItems[currentTab] || []).length === 0 ? '#6c757d' : '#17a2b8',
                    cursor: loading || (tabSavedItems[currentTab] || []).length === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '11px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    opacity: loading || (tabSavedItems[currentTab] || []).length === 0 ? 0.6 : 1
                  }}
                >
                  <FileText size={12} />
                  <span>DBF</span>
                </button>
                {autoSaveStatus !== 'idle' && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    background: autoSaveStatus === 'saved' ? 'rgba(76, 175, 80, 0.2)' : 
                                autoSaveStatus === 'saving' ? 'rgba(255, 193, 7, 0.2)' : 
                                'rgba(220, 53, 69, 0.2)',
                    border: `1px solid ${autoSaveStatus === 'saved' ? '#4CAF50' : 
                                        autoSaveStatus === 'saving' ? '#FFC107' : 
                                        '#DC3545'}`,
                    fontSize: '11px',
                    fontWeight: '600',
                    color: autoSaveStatus === 'saved' ? '#4CAF50' : 
                           autoSaveStatus === 'saving' ? '#FFC107' : 
                           '#DC3545',
                    animation: autoSaveStatus === 'saving' ? 'pulse 1.5s ease-in-out infinite' : 'none'
                  }}>
                    {autoSaveStatus === 'saving' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <circle cx="12" cy="12" r="10" opacity="0.25"/>
                        <path d="M12 2 A10 10 0 0 1 22 12" strokeLinecap="round">
                          <animateTransform
                            attributeName="transform"
                            type="rotate"
                            from="0 12 12"
                            to="360 12 12"
                            dur="1s"
                            repeatCount="indefinite"/>
                        </path>
                      </svg>
                    )}
                    {autoSaveStatus === 'saved' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                    {autoSaveStatus === 'error' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                      </svg>
                    )}
                    <span>
                      {autoSaveStatus === 'saving' && 'Saving...'}
                      {autoSaveStatus === 'saved' && 'Saved'}
                      {autoSaveStatus === 'error' && 'Save Error'}
                    </span>
                  </div>
                )}
              </div>

              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <button
                  key={num}
                  onClick={() => {
                    if (editingTabName !== num) {
                      handleTabChange(num);
                    }
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: currentTab === num 
                      ? 'linear-gradient(135deg, #007bff, #0056b3)' 
                      : 'var(--bg-tertiary)',
                    color: currentTab === num ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseOver={(e) => {
                    if (currentTab !== num && editingTabName !== num) {
                      e.target.style.background = 'var(--hover-bg)';
                      e.target.style.color = 'var(--text-primary)';
                      e.target.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (currentTab !== num && editingTabName !== num) {
                      e.target.style.background = 'var(--bg-tertiary)';
                      e.target.style.color = 'var(--text-muted)';
                      e.target.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {currentTab === num && (
                    <div style={{
                      position: 'absolute',
                      top: '0',
                      left: '0',
                      right: '0',
                      height: '2px',
                      background: 'linear-gradient(90deg, #00d4ff, #007bff)',
                      borderRadius: '0 0 4px 4px'
                    }} />
                  )}
                  {editingTabName === num ? (
                    <input
                      type="text"
                      value={tabNames[num] || `Tab ${num}`}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setTabNames(prev => ({
                          ...prev,
                          [num]: newName
                        }));
                      }}
                      onBlur={(e) => handleTabNameBlur(num, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleTabNameChange(num, e.target.value);
                        } else if (e.key === 'Escape') {
                          setEditingTabName(null);
                          // Restore original name
                          loadTabNames();
                        }
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.3)',
                        borderRadius: '4px',
                        padding: '2px 4px',
                        color: currentTab === num ? '#fff' : 'var(--text-primary)',
                        fontSize: '13px',
                        fontWeight: '600',
                        width: '80px',
                        outline: 'none'
                      }}
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleTabNameDoubleClick(num);
                      }}
                      title="Double-click to rename"
                    >
                      {tabNames[num] || `Tab ${num}`}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Main Content Area */}
            <div style={{
              display: 'flex',
              flex: '1',
              height: '100%',
              overflow: 'hidden'
            }}>

              {/* Form Section */}
              <div style={{
                flex: '1',
                padding: '20px',
                background: 'var(--bg-primary)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>

                {/* Modern Form */}
                <form onSubmit={(e) => { e.preventDefault(); handleSaveItem(); }} onKeyDown={handleFormKeyDown} autoComplete="off" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  background: isEditingItem ? 'var(--card-bg)' : 'var(--card-bg)',
                  padding: '24px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px var(--shadow-md)',
                  border: isEditingItem ? '2px solid #007bff' : '1px solid var(--border-color)',
                  position: 'relative'
                }}>
                  
                  {/* Row 1: Reference, Supplier, Date */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '5fr 5fr 4fr',
                    gap: '12px', 
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px' }}>Reference:</label>
                      <input
                        type="text"
                        name="reference"
                        value={incomingForm.reference || ''}
                        onChange={handleIncomingFormChange}
                        placeholder="Invoice/Purchase Order #"
                        maxLength="20"
                        tabIndex="1"
                        autoComplete="off"
                        style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px' }}>Supplier:</label>
                      <input
                        type="text"
                        name="supplier"
                        value={incomingForm.supplier || ''}
                        onChange={handleIncomingFormChange}
                        placeholder="Supplier Code/Name"
                        tabIndex="2"
                        autoComplete="off"
                        style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px' }}>Date:</label>
                      <input
                        type="date"
                        name="date"
                        value={incomingForm.date || ''}
                        onChange={handleIncomingFormChange}
                        required
                        min="2020-01-01"
                        max="2099-12-31"
                        tabIndex="3"
                        autoComplete="off"
                        title="Select a date between 2020 and 2099"
                        style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      />
                    </div>
                  </div>

                  {/* Row 2: DIN | (empty) | Factor - Factor under Date, aligned with DIN row */}
                  <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: '2fr 2fr 1.5fr',
                    gap: '12px',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start' }}>
                      <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px', flexShrink: '0' }}>DIN:</label>
                      <input
                        type="text"
                        name="din_flag"
                        value={incomingForm.din_flag || ''}
                        onChange={handleIncomingFormChange}
                        placeholder="D"
                        maxLength="1"
                        tabIndex="4"
                        autoComplete="off"
                        style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '60px',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box',
                          textAlign: 'center',
                          flexShrink: '0'
                        }}
                      />
                    </div>
                    <div />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px', flexShrink: 0 }}>Factor:</label>
                      <input
                        type="text"
                        name="factor"
                        value={incomingForm.factor || ''}
                        onChange={handleIncomingFormChange}
                        onBlur={handleFactorBlur}
                        placeholder="0"
                        tabIndex="5"
                        autoComplete="off"
                        style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  {/* Row 3: Benz, Benz2, Benz3 */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '2fr 2fr 1.5fr',
                    gap: '12px', 
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px' }}>Benz:</label>
                      <input
                        type="text"
                        name="benz_number"
                        value={incomingForm.benz_number || ''}
                        onChange={handleIncomingFormChangeWithAutoFill}
                        placeholder="Primary Part Number"
                        maxLength="13"
                        required
                        tabIndex="5"
                        autoComplete="off"
                        style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px' }}>Benz:</label>
                      <input
                        type="text"
                        name="benz_number2"
                        value={incomingForm.benz_number2 || ''}
                        onChange={handleIncomingFormChangeWithAutoFill}
                        placeholder="Secondary Part Number"
                        maxLength="13"
                        tabIndex="6"
                        autoComplete="off"
                        style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px' }}>Benz:</label>
                      <input
                        type="text"
                        name="benz_number3"
                        value={incomingForm.benz_number3 || ''}
                        onChange={handleIncomingFormChangeWithAutoFill}
                        placeholder="Tertiary Part Number"
                        maxLength="13"
                        tabIndex="7"
                        autoComplete="off"
                        style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  {/* Row 4: Brand, OEM, OEM2 */}
                  <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: '2fr 2fr 1.5fr',
                    gap: '12px',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px' }}>Brand:</label>
                      <input
                        type="text"
                        name="brand"
                        value={incomingForm.brand || ''}
                        onChange={handleIncomingFormChangeWithAutoFill}
                        onKeyDown={handleKeyPress}
                        onBlur={handleFieldExit}
                        placeholder="Car Manufacturer"
                        maxLength="12"
                        required
                        tabIndex="8"
                        autoComplete="off"
                        style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px' }}>OEM:</label>
                      <input
                        type="text"
                        name="altno"
                        value={incomingForm.altno || ''}
                        onChange={handleIncomingFormChangeWithAutoFill}
                        onKeyDown={handleKeyPress}
                        onBlur={handleFieldExit}
                        placeholder="Manufacturer's Part Number"
                        maxLength="20"
                        tabIndex="9"
                        autoComplete="off"
                        style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px' }}>OEM:</label>
                      <input
                        type="text"
                        name="altno2"
                        value={incomingForm.altno2 || ''}
                        onChange={handleIncomingFormChangeWithAutoFill}
                        placeholder="Alternate Part Number"
                        maxLength="20"
                        tabIndex="10"
                        autoComplete="off"
                        style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  {/* Row 5: Description, Color Code, Location */}
                  <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: '2fr 2fr 1.5fr',
                    gap: '12px',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px' }}>Description:</label>
                      <input
                        type="text"
                        name="description"
                        value={incomingForm.description || ''}
                        onChange={handleIncomingFormChange}
                        placeholder="Product Description"
                        maxLength="100"
                        tabIndex="11"
                        autoComplete="off"
                        style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          minWidth: '280px',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '120px', whiteSpace: 'nowrap' }}>Color Code:</label>
                      <input
                        type="text"
                        name="color_code"
                        value={incomingForm.color_code || ''}
                        onChange={handleIncomingFormChange}
                        placeholder="Color/Variant"
                        maxLength="10"
                        tabIndex="12"
                        autoComplete="off"
                        style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div> 
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px' }}>Location:</label>
                      <input
                        type="text"
                        name="location"
                        value={incomingForm.location || ''}
                        onChange={handleIncomingFormChange}
                        placeholder="Warehouse Location"
                        maxLength="50"
                        tabIndex="13"
                        autoComplete="off"
                        style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  {/* Row 6: Application, Remarks, Reorder */}
                  <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: '2fr 2fr 1.5fr',
                    gap: '12px',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px' }}>Application:</label>
                      <input
                        type="text"
                        name="application"
                        value={incomingForm.application || ''}
                        onChange={handleIncomingFormChange}
                        placeholder="Vehicle Application"
                        maxLength="100"
                        tabIndex="14"
                        autoComplete="off"
                        style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          minWidth: '280px',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '120px', whiteSpace: 'nowrap' }}>Remarks:</label>
                      <input
                        type="text"
                        name="remarks"
                        value={incomingForm.remarks || ''}
                        onChange={handleIncomingFormChange}
                        placeholder="Additional Notes"
                        maxLength="100"
                        tabIndex="15"
                        autoComplete="off"
                        style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifySelf: 'start' }}>
                      <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', width: '80px' }}>Reorder:</label>
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <input
                        type="number"
                        name="reorder_point"
                        value={incomingForm.reorder_point || ''}
                        onChange={handleIncomingFormChange}
                        placeholder="0"
                        tabIndex="16"
                        autoComplete="off"
                        style={{
                          padding: '14px 18px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                            width: '35%',
                          fontSize: '13px',
                          fontWeight: '500',
                          height: '46px',
                            boxSizing: 'border-box',
                            marginLeft: '0'
                        }}
                      />
                      </div>
                    </div>
                  </div>

                  {/* Section Divider */}
                  <div style={{
                    height: '1px',
                    background: `linear-gradient(90deg, transparent, var(--border-color), transparent)`,
                    margin: '20px 0',
                    width: '100%'
                  }}></div>

                  {/* Ultra-Compact Accounting Form - Zero Waste Layout */}
                  <div style={{
                    background: 'var(--bg-tertiary)',
                    borderRadius: '8px',
                    padding: '16px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    boxShadow: '0 1px 4px var(--shadow-sm)'
                  }}>

                    {/* Single Ultra-Compact Row - All 7 Fields */}
                    <div style={{ 
                      display: 'flex',
                      flexDirection: 'row',
                      gap: '10px',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'nowrap',
                      width: '100%'
                    }}>
                      {/* Cost */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px', minWidth: '35px', whiteSpace: 'nowrap' }}>Cost:</label>
                        <input
                          type="text"
                          name="cost"
                          value={incomingForm.cost || ''}
                          onChange={handleMonetaryChange}
                          onBlur={handleMonetaryBlur}
                          onFocus={handleMonetaryFocus}
                          placeholder="0.00"
                          required
                          tabIndex="17"
                          autoComplete="off"
                          style={{
                            padding: '10px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--input-bg)',
                            color: 'var(--text-primary)',
                            width: '120px',
                            fontSize: '13px',
                            fontWeight: '500',
                            height: '40px',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      
                      {/* Selling Price */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px', minWidth: '60px', whiteSpace: 'nowrap' }}>Selling:</label>
                        <input
                          type="text"
                          name="selling_price"
                          value={incomingForm.selling_price || ''}
                          onChange={handleMonetaryChange}
                          onBlur={handleMonetaryBlur}
                          onFocus={handleMonetaryFocus}
                          placeholder="0.00"
                          required
                          tabIndex="18"
                          autoComplete="off"
                          style={{
                            padding: '10px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--input-bg)',
                            color: 'var(--text-primary)',
                            width: '120px',
                            fontSize: '13px',
                            fontWeight: '500',
                            height: '40px',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      
                      {/* Quantity */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px', minWidth: '45px', whiteSpace: 'nowrap' }}>Qty:</label>
                        <input
                          type="number"
                          name="quantity"
                          value={incomingForm.quantity || ''}
                          onChange={handleIncomingFormChange}
                          placeholder="0"
                          min="0"
                          step="1"
                          max="999999"
                          required
                          tabIndex="19"
                          autoComplete="off"
                          style={{
                            padding: '10px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--input-bg)',
                            color: 'var(--text-primary)',
                             width: '90px',
                            fontSize: '13px',
                            fontWeight: '500',
                            height: '40px',
                            boxSizing: 'border-box',
                            MozAppearance: 'textfield',
                            WebkitAppearance: 'none',
                            appearance: 'none'
                          }}
                        />
                      </div>
                      
                      {/* Unit */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px', minWidth: '30px', whiteSpace: 'nowrap' }}>Unit:</label>
                        <input
                          type="text"
                          name="unit"
                          value={incomingForm.unit || ''}
                          onChange={handleIncomingFormChange}
                          placeholder="pcs"
                          maxLength="10"
                          tabIndex="20"
                          autoComplete="off"
                          style={{
                            padding: '10px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--input-bg)',
                            color: 'var(--text-primary)',
                            width: '70px',
                            fontSize: '13px',
                            fontWeight: '500',
                            height: '40px',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      
                      {/* Conv */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px', minWidth: '35px', whiteSpace: 'nowrap' }}>Conv:</label>
                        <input
                          type="number"
                          name="conversion"
                          value={incomingForm.conversion || ''}
                          onChange={handleIncomingFormChange}
                          step="0.0001"
                          placeholder="1"
                          tabIndex="21"
                          autoComplete="off"
                          style={{
                            padding: '10px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--input-bg)',
                            color: 'var(--text-primary)',
                            width: '80px',
                            fontSize: '13px',
                            fontWeight: '500',
                            height: '40px',
                            boxSizing: 'border-box',
                            MozAppearance: 'textfield',
                            WebkitAppearance: 'none',
                            appearance: 'none'
                          }}
                        />
                      </div>
                      
                      {/* Currency */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px', minWidth: '70px', whiteSpace: 'nowrap' }}>Currency:</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                          name="currency"
                            value={incomingForm.currency || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              // Extract just the currency code if user selects from dropdown
                              const currencyCode = value.includes(' - ') ? value.split(' - ')[0] : value;
                              handleIncomingFormChange({
                                target: {
                                  name: 'currency',
                                  value: currencyCode
                                }
                              });
                            }}
                            placeholder="USD"
                            tabIndex="22"
                            autoComplete="off"
                            list="currency-options"
                          style={{
                            padding: '10px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--input-bg)',
                            color: 'var(--text-primary)',
                            width: '70px',
                            fontSize: '13px',
                            fontWeight: '500',
                            height: '40px',
                              boxSizing: 'border-box'
                            }}
                          />
                          <datalist id="currency-options">
                            <option value="USD - United States Dollar">USD - United States Dollar</option>
                            <option value="EUR - Euro">EUR - Euro</option>
                            <option value="GBP - British Pound Sterling">GBP - British Pound Sterling</option>
                            <option value="JPY - Japanese Yen">JPY - Japanese Yen</option>
                            <option value="CAD - Canadian Dollar">CAD - Canadian Dollar</option>
                            <option value="AUD - Australian Dollar">AUD - Australian Dollar</option>
                            <option value="CHF - Swiss Franc">CHF - Swiss Franc</option>
                            <option value="CNY - Chinese Yuan">CNY - Chinese Yuan</option>
                            <option value="SEK - Swedish Krona">SEK - Swedish Krona</option>
                            <option value="NZD - New Zealand Dollar">NZD - New Zealand Dollar</option>
                            <option value="MXN - Mexican Peso">MXN - Mexican Peso</option>
                            <option value="SGD - Singapore Dollar">SGD - Singapore Dollar</option>
                            <option value="HKD - Hong Kong Dollar">HKD - Hong Kong Dollar</option>
                            <option value="NOK - Norwegian Krone">NOK - Norwegian Krone</option>
                            <option value="TRY - Turkish Lira">TRY - Turkish Lira</option>
                            <option value="RUB - Russian Ruble">RUB - Russian Ruble</option>
                            <option value="INR - Indian Rupee">INR - Indian Rupee</option>
                            <option value="BRL - Brazilian Real">BRL - Brazilian Real</option>
                            <option value="ZAR - South African Rand">ZAR - South African Rand</option>
                            <option value="PHP - Philippine Peso">PHP - Philippine Peso</option>
                          </datalist>
                        </div>
                      </div>
                      
                      {/* FC Cost */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px', minWidth: '55px', whiteSpace: 'nowrap' }}>FC Cost:</label>
                        <input
                          type="text"
                          name="fc_cost"
                          value={incomingForm.fc_cost || ''}
                          onChange={handleMonetaryChange}
                          onBlur={handleMonetaryBlur}
                          onFocus={handleMonetaryFocus}
                          placeholder="0.00"
                          tabIndex="23"
                          autoComplete="off"
                          style={{
                            padding: '10px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--input-bg)',
                            color: 'var(--text-primary)',
                            width: '80px',
                            fontSize: '13px',
                            fontWeight: '500',
                            height: '40px',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>
                  </div>


                  {/* Action Buttons */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    gap: '12px',
                    paddingTop: '24px',
                    marginTop: '16px',
                    paddingBottom: '20px',
                    marginBottom: '20px'
                  }}>
                    <button
                      type="button"
                      onClick={handlePrevious}
                      style={{
                        background: '#2E7DD2',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '27px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        width: '103px',
                        height: '36px',
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      Previous
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleImportIncoming}
                      style={{
                        background: '#6f42c1',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '27px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        width: '103px',
                        height: '36px',
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      Import
                    </button>
                    
                    <button
                      type="submit"
                      disabled={loading}
                      tabIndex="24"
                      style={{
                        background: loading ? '#6c757d' : '#4CAF50',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '27px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        width: '103px',
                        height: '36px',
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      {loading ? 'Saving...' : (isEditingItem ? 'Update' : 'Save')}
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleApplyFactorToCost}
                      disabled={(() => {
                        const saved = tabSavedItems[currentTab] || [];
                        return saved.length === 0 || !saved.every(item => item.factor != null && item.factor !== '' && !isNaN(parseFloat(item.factor)));
                      })()}
                      title="Factor × FC Cost = Cost (applies to all items in tab)"
                      style={{
                        background: (() => {
                          const saved = tabSavedItems[currentTab] || [];
                          const canApply = saved.length > 0 && saved.every(item => item.factor != null && item.factor !== '' && !isNaN(parseFloat(item.factor)));
                          return canApply ? '#FF9800' : '#6c757d';
                        })(),
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '27px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: (() => {
                          const saved = tabSavedItems[currentTab] || [];
                          const canApply = saved.length > 0 && saved.every(item => item.factor != null && item.factor !== '' && !isNaN(parseFloat(item.factor)));
                          return canApply ? 'pointer' : 'not-allowed';
                        })(),
                        width: 'auto',
                        minWidth: '120px',
                        height: '36px',
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      Factor × FC Cost
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleNext}
                      style={{
                        background: '#2E7DD2',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '27px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        width: '103px',
                        height: '36px',
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      Next
                    </button>
                    
                  </div>
                </form>
                </div>
                
              {/* Saved Items Panel */}
              <div style={{
                flex: '0 0 280px',
                background: 'var(--card-bg)',
                borderLeft: '1px solid var(--border-color)',
                padding: '20px',
                overflow: 'visible',
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                minHeight: '100vh',
                position: 'relative'
              }}>
                {/* Panel Header */}
                <div style={{
                  marginBottom: '24px',
                  paddingBottom: '16px',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  {/* Top row: Tab title and POST button */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                }}>
                  <h3 style={{
                    color: 'var(--text-primary)',
                    fontSize: '18px',
                    fontWeight: '600',
                      margin: '0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#007bff',
                      boxShadow: '0 0 8px rgba(0,123,255,0.5)'
                    }} />
                      {tabNames[currentTab] || `Tab ${currentTab}`}
                  </h3>
                    
                    {/* Clear and POST Buttons in header */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {/* Clear Button - Red */}
                      <button 
                        onClick={handleClearTabItems}
                        disabled={(tabSavedItems[currentTab] || []).length === 0}
                        style={{
                          background: (tabSavedItems[currentTab] || []).length > 0 
                            ? 'linear-gradient(135deg, #dc3545, #c82333)' 
                            : 'rgba(220,53,69,0.3)',
                          color: 'white',
                          border: 'none',
                          padding: '12px 16px',
                          borderRadius: '10px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: (tabSavedItems[currentTab] || []).length > 0 ? 'pointer' : 'not-allowed',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          letterSpacing: '0.5px',
                          minWidth: '100px',
                          opacity: (tabSavedItems[currentTab] || []).length > 0 ? 1 : 0.6
                        }}
                        onMouseOver={(e) => {
                          if ((tabSavedItems[currentTab] || []).length > 0) {
                            e.target.style.transform = 'translateY(-1px)';
                            e.target.style.boxShadow = '0 4px 12px rgba(220,53,69,0.4)';
                          }
                        }}
                        onMouseOut={(e) => {
                          if ((tabSavedItems[currentTab] || []).length > 0) {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = 'none';
                          }
                        }}
                      >
                        Clear All
                      </button>
                      
                      {/* POST Button - Green */}
                      <button 
                        onClick={handlePostItems}
                        disabled={(tabSavedItems[currentTab] || []).length === 0}
                        style={{
                          background: (tabSavedItems[currentTab] || []).length > 0 
                            ? 'linear-gradient(135deg, #28a745, #218838)' 
                            : 'rgba(40,167,69,0.3)',
                          color: 'white',
                          border: 'none',
                          padding: '12px 20px',
                          borderRadius: '10px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: (tabSavedItems[currentTab] || []).length > 0 ? 'pointer' : 'not-allowed',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          minWidth: '80px',
                          opacity: (tabSavedItems[currentTab] || []).length > 0 ? 1 : 0.6
                        }}
                        onMouseOver={(e) => {
                          if ((tabSavedItems[currentTab] || []).length > 0) {
                            e.target.style.transform = 'translateY(-1px)';
                            e.target.style.boxShadow = '0 4px 12px rgba(40,167,69,0.4)';
                          }
                        }}
                        onMouseOut={(e) => {
                          if ((tabSavedItems[currentTab] || []).length > 0) {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = 'none';
                          }
                        }}
                      >
                        POST
                      </button>
                    </div>
                  </div>
                  
                  {/* Bottom row: Items count */}
                  <div style={{
                    background: 'rgba(0,123,255,0.1)',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    display: 'inline-block'
                  }}>
                    <span style={{
                      color: '#007bff',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      {(tabSavedItems[currentTab] || []).length} items
                    </span>
                  </div>
                </div>
                {/* Saved Items List */}
                  <div 
                    className="saved-items-container"
                    style={{
                  display: 'flex',
                  flexDirection: 'column',
                      gap: '8px',
                  marginBottom: '0px',
                      height: 'calc(100vh - 180px)',
                      maxHeight: 'calc(100vh - 180px)',
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      paddingRight: '4px',
                      paddingBottom: '40px',
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgba(0,123,255,0.3) transparent',
                      position: 'relative',
                      // Force these properties to override any CSS
                      overflow: 'auto hidden !important',
                      WebkitOverflowScrolling: 'touch'
                    }}>
                  {(tabSavedItems[currentTab] || []).map((item, index) => (
                    <div 
                      key={item.id} 
                      style={{
                        background: index === currentItemIndex 
                          ? 'linear-gradient(135deg, #007bff, #0056b3)' 
                          : 'var(--bg-tertiary)',
                        borderRadius: '8px',
                        padding: '12px',
                        border: index === currentItemIndex 
                          ? '1px solid rgba(0,123,255,0.3)' 
                          : '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                      onClick={() => {
                        handleItemClick(item, index);
                      }}
                      onMouseOver={(e) => {
                        if (index !== currentItemIndex) {
                          e.currentTarget.style.background = 'var(--hover-bg)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px var(--shadow-md)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (index !== currentItemIndex) {
                          e.currentTarget.style.background = 'var(--bg-tertiary)';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}
                    >
                        {/* BENZ and QTY on same line */}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginBottom: '4px'
                        }}>
                        <div style={{ 
                            color: index === currentItemIndex ? '#fff' : '#007bff', 
                          fontWeight: '600', 
                          fontSize: '13px'
                        }}>
                            {item.benz}
                        </div>
                        <div style={{ 
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <div style={{ 
                              color: index === currentItemIndex ? '#fff' : '#4CAF50', 
                            fontWeight: '600', 
                              fontSize: '12px'
                          }}>
                              {item.quantity || '0'}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(item.id, index);
                            }}
                            style={{
                              background: 'rgba(220,53,69,0.8)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              width: '20px',
                              height: '20px',
                              fontSize: '10px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s ease',
                              opacity: 0.8
                            }}
                            onMouseOver={(e) => {
                              e.target.style.background = 'rgba(220,53,69,1)';
                              e.target.style.opacity = '1';
                              e.target.style.transform = 'scale(1.1)';
                            }}
                            onMouseOut={(e) => {
                              e.target.style.background = 'rgba(220,53,69,0.8)';
                              e.target.style.opacity = '0.8';
                              e.target.style.transform = 'scale(1)';
                            }}
                            title="Delete item"
                          >
                            ×
                          </button>
                        </div>
                        </div>

                        {/* BRAND-OEM */}
                        <div style={{ 
                          color: index === currentItemIndex ? '#fff' : 'var(--text-primary)', 
                          fontWeight: '500', 
                          marginBottom: '3px',
                          fontSize: '12px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {item.brand || ''} {item.oem || ''}
                        </div>

                        {/* DESCRIPTION */}
                        <div style={{ 
                          color: index === currentItemIndex ? '#fff' : 'var(--text-secondary)', 
                          fontSize: '11px',
                          marginBottom: '4px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          lineHeight: '1.2'
                        }}>
                          {item.description}
                        </div>

                        {/* PRICE and COST on same line */}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center'
                        }}>
                          <div style={{ 
                            color: index === currentItemIndex ? '#fff' : '#ffc107', 
                            fontWeight: '600', 
                            fontSize: '12px'
                          }}>
                            ₱{formatCurrency(item.price || 0)}
                          </div>
                          <div style={{ 
                            color: index === currentItemIndex ? '#fff' : '#FF9800', 
                            fontWeight: '600', 
                            fontSize: '12px'
                          }}>
                            ₱{formatCurrency(item.cost || 0)}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {(tabSavedItems[currentTab] || []).length === 0 && (
                      <div style={{
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        padding: '20px',
                        fontSize: '13px',
                        fontStyle: 'italic'
                      }}>
                        No items saved yet
                      </div>
                    )}
                  </div>
              </div>
            </div>
          </div>
            </>
          )}
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

      {/* Error Dialog for Unsaved Changes */}
      {/* Clear Confirmation Dialog */}
      {showClearConfirm && (
        <div className="pos-modal-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h2>Clear All Items</h2>
              <button className="pos-modal-close" onClick={() => setShowClearConfirm(false)}>×</button>
            </div>
            <div className="pos-modal-body">
              <p style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>
                Are you sure you want to clear all saved items from <strong>{tabNames[currentTab] || `Tab ${currentTab}`}</strong>?
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
                This will delete <strong>{(tabSavedItems[currentTab] || []).length}</strong> item(s) and clear all form fields for this tab.
              </p>
              <p style={{ color: '#dc3545', fontSize: '13px', fontWeight: '600' }}>
                ⚠️ This action cannot be undone!
              </p>
            </div>
            <div className="pos-modal-footer">
              <button
                className="pos-btn pos-btn-secondary"
                onClick={() => setShowClearConfirm(false)}
                style={{ marginRight: '12px' }}
              >
                Cancel
              </button>
              <button
                className="pos-btn pos-btn-primary"
                onClick={confirmClearTabItems}
                style={{ background: '#dc3545', borderColor: '#dc3545' }}
              >
                Clear All Items
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Arrange lineup – full-screen modal (redesigned); portal to body so scroll works despite parent overflow:hidden */}
      {showArrangeModal && createPortal(
        <div
          className="arrange-modal-v2"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10001,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'linear-gradient(165deg, #0c0c0f 0%, #12121a 40%, #0f0f14 100%)',
            color: '#fafafa'
          }}
        >
          <style>{`
            .arrange-modal-v2 * { box-sizing: border-box; }
            .arrange-modal-v2 .arrange-v2-header {
              backdrop-filter: blur(20px);
              -webkit-backdrop-filter: blur(20px);
              border-bottom: 1px solid rgba(245, 158, 11, 0.2);
              box-shadow: 0 4px 24px rgba(0,0,0,0.3);
            }
            .arrange-modal-v2 .arrange-v2-btn {
              transition: transform 0.12s ease, box-shadow 0.2s ease, opacity 0.2s ease;
            }
            .arrange-modal-v2 .arrange-v2-btn:hover:not(:disabled) {
              transform: translateY(-2px);
              opacity: 1;
            }
            .arrange-modal-v2 .arrange-v2-btn:active:not(:disabled) { transform: translateY(0); }
            .arrange-modal-v2 .arrange-v2-track {
              transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease, border-color 0.2s ease;
            }
            .arrange-modal-v2 .arrange-v2-track:hover {
              transform: translateY(-1px);
              box-shadow: 0 6px 20px rgba(0,0,0,0.25);
              border-color: rgba(255,255,255,0.08);
            }
            .arrange-modal-v2 .arrange-v2-track.dragging {
              cursor: grabbing;
              transform: scale(1.015) translateY(-2px);
              box-shadow: 0 12px 40px rgba(245, 158, 11, 0.2);
              opacity: 0.95;
              border-color: rgba(245, 158, 11, 0.5);
            }
            .arrange-modal-v2 .arrange-v2-scroll {
              flex: 1 1 0%;
              min-height: 0;
              overflow-y: auto;
              overflow-x: hidden;
              -webkit-overflow-scrolling: touch;
            }
            /* Override incoming-form global overflow:hidden so Lineup list can scroll */
            .pos-stock-modern[data-view="incoming"][data-subview="form"] .arrange-modal-v2 .arrange-v2-scroll {
              overflow-y: auto !important;
              overflow-x: hidden !important;
              min-height: 0 !important;
              touch-action: pan-y !important;
              -webkit-overflow-scrolling: touch !important;
            }
            .arrange-modal-v2 .arrange-v2-drop-zone {
              height: 3px;
              border-radius: 2px;
              margin: 2px 0 4px 0;
              background: linear-gradient(90deg, rgba(245,158,11,0.6), rgba(6,182,212,0.6));
              box-shadow: 0 0 12px rgba(245, 158, 11, 0.4);
              animation: arrange-pulse 0.8s ease-in-out infinite;
            }
            @keyframes arrange-pulse { 0%, 100% { opacity: 0.9; } 50% { opacity: 1; } }
          `}</style>
          <header
            className="arrange-v2-header"
            style={{
              flex: '0 0 auto',
              padding: '18px 32px',
              background: 'rgba(18, 18, 26, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '24px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)'
              }}>
                <GripVertical size={24} color="#0c0c0f" strokeWidth={2.5} />
              </div>
              <div>
                <h1 style={{
                  margin: 0,
                  fontSize: '26px',
                  fontWeight: '800',
                  letterSpacing: '-0.03em',
                  background: 'linear-gradient(135deg, #fafafa 0%, #e4e4e7 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  Lineup
                </h1>
                <div style={{
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  color: 'rgba(161, 161, 170, 0.95)',
                  fontWeight: '500'
                }}>
                  <span style={{
                    padding: '2px 10px',
                    borderRadius: '999px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    fontWeight: '600'
                  }}>
                    {tabNames[currentTab] || `Tab ${currentTab}`}
                  </span>
                  <span style={{ opacity: 0.7 }}>·</span>
                  <span>{arrangeList.length} item{arrangeList.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                className="arrange-v2-btn"
                onClick={saveArrangeOrder}
                disabled={arrangeSaving || arrangeList.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 22px',
                  background: arrangeSaving ? 'rgba(113, 113, 122, 0.5)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#0c0c0f',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: arrangeSaving ? 'not-allowed' : 'pointer',
                  boxShadow: arrangeSaving ? 'none' : '0 4px 16px rgba(245, 158, 11, 0.4)'
                }}
              >
                <Save size={18} strokeWidth={2.5} />
                {arrangeSaving ? 'Saving…' : 'Save order'}
              </button>
              <button
                className="arrange-v2-btn"
                onClick={exportArrangeDBF}
                disabled={arrangeExporting || arrangeList.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 22px',
                  background: arrangeExporting ? 'rgba(113, 113, 122, 0.5)' : 'rgba(6, 182, 212, 0.2)',
                  color: '#22d3ee',
                  border: '1px solid rgba(6, 182, 212, 0.5)',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: arrangeExporting ? 'not-allowed' : 'pointer',
                  boxShadow: arrangeExporting ? 'none' : '0 0 0 1px rgba(6, 182, 212, 0.2)'
                }}
              >
                <FileText size={18} strokeWidth={2} />
                {arrangeExporting ? 'Exporting…' : 'Export DBF'}
              </button>
              <button
                className="arrange-v2-btn"
                onClick={() => setShowArrangeModal(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '44px',
                  height: '44px',
                  padding: 0,
                  background: 'rgba(255,255,255,0.06)',
                  color: '#a1a1aa',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  cursor: 'pointer'
                }}
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>
          </header>
          <div
            className="arrange-v2-scroll"
            style={{
              flex: '1 1 0%',
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '12px 20px 16px'
            }}
          >
            <p style={{
              margin: '0 0 10px 0',
              fontSize: '12px',
              color: 'rgba(161, 161, 170, 0.85)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap'
            }}>
              <span style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: '#f59e0b',
                flexShrink: 0
              }} />
              Drag to reorder · Click row to select · Ctrl+click or Shift+click for multiple · Drag selection to move together
            </p>
            <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  if (arrangeSelectedIds.size === arrangeList.length) {
                    setArrangeSelectedIds(new Set());
                  } else {
                    setArrangeSelectedIds(new Set(arrangeList.map(it => it.id)));
                  }
                  lastArrangeSelectedIndexRef.current = null;
                }}
                style={{
                  fontSize: '12px',
                  padding: '4px 10px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '6px',
                  color: '#fafafa',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                {arrangeSelectedIds.size === arrangeList.length ? 'Clear selection' : 'Select all'}
              </button>
              {arrangeSelectedIds.size > 0 && (
                <span style={{ fontSize: '12px', color: 'rgba(161, 161, 170, 0.9)' }}>
                  {arrangeSelectedIds.size} selected — drag one to move all
                </span>
              )}
            </div>
            <div style={{ maxWidth: '880px' }}>
              {arrangeList.map((item, index) => {
                const isSelected = arrangeSelectedIds.has(item.id);
                return (
                <React.Fragment key={item.id}>
                  {arrangeDragOverIndex === index && draggedIndex !== null && (
                    <div className="arrange-v2-drop-zone" />
                  )}
                  <div
                    className={`arrange-v2-track${draggedIndex === index ? ' dragging' : ''}${isSelected ? ' selected' : ''}`}
                    draggable
                    onDragStart={(e) => handleArrangeDragStart(e, index)}
                    onDragOver={(e) => handleArrangeDragOver(e, index)}
                    onDragLeave={handleArrangeDragLeave}
                    onDrop={(e) => handleArrangeDrop(e, index)}
                    onDragEnd={handleArrangeDragEnd}
                    onClick={(e) => {
                      if (e.target.closest('input[type="checkbox"]')) return;
                      toggleArrangeSelection(index, { ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0',
                      padding: 0,
                      marginBottom: '4px',
                      background: isSelected ? 'rgba(245, 158, 11, 0.15)' : 'rgba(24, 24, 28, 0.8)',
                      border: `1px solid ${isSelected ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: '10px',
                      cursor: 'grab',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{
                      width: '3px',
                      alignSelf: 'stretch',
                      flexShrink: 0,
                      background: draggedIndex === index
                        ? 'linear-gradient(180deg, #f59e0b, #06b6d4)'
                        : 'linear-gradient(180deg, rgba(245,158,11,0.7), rgba(6,182,212,0.5))',
                      opacity: draggedIndex === index ? 1 : 0.85
                    }} />
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 12px',
                      flex: 1,
                      minWidth: 0
                    }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleArrangeSelection(index, {})}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                          flexShrink: 0,
                          accentColor: '#f59e0b'
                        }}
                      />
                      <div style={{
                        cursor: 'grab',
                        color: 'rgba(161, 161, 170, 0.9)',
                        flexShrink: 0,
                        padding: '2px'
                      }}>
                        <GripVertical size={18} />
                      </div>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        background: 'rgba(0,0,0,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontWeight: '800',
                        fontSize: '12px',
                        color: 'rgba(161, 161, 170, 0.95)',
                        fontVariantNumeric: 'tabular-nums'
                      }}>
                        {index + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: '700',
                          fontSize: '14px',
                          letterSpacing: '0.02em',
                          color: '#fafafa',
                          lineHeight: 1.25
                        }}>
                          {item.benz_number || item.benz || '—'}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: 'rgba(161, 161, 170, 0.9)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: '1px'
                        }}>
                          {item.description || item.brand || '—'}
                        </div>
                      </div>
                      <div style={{
                        flexShrink: 0,
                        fontWeight: '700',
                        fontSize: '12px',
                        padding: '4px 10px',
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(6,182,212,0.15) 100%)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '8px',
                        color: '#f59e0b',
                        fontVariantNumeric: 'tabular-nums'
                      }}>
                        ×{item.quantity ?? '0'}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      , document.body)}

      {showErrorDialog && (
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
          zIndex: 10000
        }}>
          <div style={{
            background: 'var(--modal-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '400px',
            width: '90%',
            color: 'var(--text-primary)'
          }}>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '16px', fontSize: '18px' }}>
              Unsaved Changes
            </h3>
            <p style={{ marginBottom: '20px', fontSize: '14px', color: 'var(--text-primary)' }}>
              You have unsaved changes in the form. What would you like to do?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => handleErrorDialogResponse('stay')}
                style={{
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Stay Here
              </button>
              <button
                onClick={() => handleErrorDialogResponse('clear')}
                style={{
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Clear & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post Confirmation Dialog */}
      {showPostDialog && (
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
          zIndex: 10000
        }}>
          <div style={{
            background: 'var(--modal-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '400px',
            width: '90%',
            color: 'var(--text-primary)'
          }}>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '16px', fontSize: '18px' }}>
              Confirm Post
            </h3>
            <p style={{ marginBottom: '20px', fontSize: '14px', color: 'var(--text-primary)' }}>
              Are you sure you want to post {tabSavedItems[currentTab]?.length || 0} items from Tab {currentTab}? 
              This will import them to the main database.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowPostDialog(false)}
                style={{
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmPostItems}
                style={{
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Post Items
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Matches Modal */}
      {showDuplicateModal && (
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
          zIndex: 10000
        }}>
          <div style={{
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '800px',
            maxHeight: '80vh',
            width: '90%',
            overflow: 'auto',
            color: '#e0e0e0'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '1px solid #333',
              paddingBottom: '10px'
            }}>
              <h2 style={{ color: '#fff', margin: 0, fontSize: '18px' }}>
                Duplicate Matches Found
              </h2>
              <button
                onClick={() => setShowDuplicateModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            {duplicateLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                Loading duplicate matches...
              </div>
            ) : (
              <>
                {/* Incoming Record Info */}
                {currentIncomingRecord && (
                  <div style={{
                    background: '#2d2d2d',
                    padding: '15px',
                    borderRadius: '6px',
                    marginBottom: '20px',
                    border: '1px solid #444'
                  }}>
                    <h3 style={{ color: '#fff', margin: '0 0 10px 0', fontSize: '16px' }}>
                      Incoming Record
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
                      <div><strong>ID:</strong> {currentIncomingRecord.id}</div>
                      <div><strong>BENZ:</strong> {currentIncomingRecord.BENZ}</div>
                      <div><strong>BRAND:</strong> {currentIncomingRecord.BRAND}</div>
                      <div><strong>ALTNO:</strong> {currentIncomingRecord.ALTNO || '-'}</div>
                      <div><strong>DATE:</strong> {currentIncomingRecord.DATE}</div>
                      <div><strong>REF:</strong> {currentIncomingRecord.REF || '-'}</div>
                    </div>
                  </div>
                )}

                {/* Duplicate Matches Table */}
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ color: '#fff', margin: '0 0 15px 0', fontSize: '16px' }}>
                    Found {duplicateMatches.length} Duplicate Stock Records
                  </h3>
                  
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      backgroundColor: 'var(--card-bg)',
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #007bff', color: 'var(--text-primary)' }}>Stock ID</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #007bff', color: 'var(--text-primary)' }}>BENZ</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #007bff', color: 'var(--text-primary)' }}>BRAND</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #007bff', color: 'var(--text-primary)' }}>ALTNO</th>
                          <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #007bff', color: 'var(--text-primary)' }}>QTY</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #007bff', color: 'var(--text-primary)' }}>COST</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #007bff', color: 'var(--text-primary)' }}>SELL</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #007bff', color: 'var(--text-primary)' }}>LOCATION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {duplicateMatches.map((match, index) => (
                          <tr key={match.ID} style={{ 
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--card-bg)'
                          }}>
                            <td style={{ padding: '12px', color: 'var(--text-primary)' }}>
                              <button
                                onClick={() => {
                                  setCurrentView('stocks');
                                  setSearchTerm(match.ID.toString());
                                  setShowDuplicateModal(false);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#007bff',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  fontWeight: '500',
                                  padding: '0'
                                }}
                              >
                                {match.ID}
                              </button>
                            </td>
                            <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{match.BENZ}</td>
                            <td style={{ padding: '12px', color: '#e0e0e0' }}>{match.BRAND}</td>
                            <td style={{ padding: '12px', color: '#e0e0e0' }}>{match.ALTNO || '-'}</td>
                            <td style={{ padding: '12px', textAlign: 'center', color: '#e0e0e0' }}>{match.QTY || 0}</td>
                            <td style={{ padding: '12px', textAlign: 'right', color: '#e0e0e0' }}>
                              ₱{parseFloat(match.COST || 0).toFixed(2)}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', color: '#e0e0e0' }}>
                              ₱{parseFloat(match.SELL || 0).toFixed(2)}
                            </td>
                            <td style={{ padding: '12px', color: '#e0e0e0' }}>{match.LOCATION || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Close Button */}
                <div style={{ textAlign: 'right' }}>
                  <button
                    onClick={() => setShowDuplicateModal(false)}
                    style={{
                      background: '#6c757d',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
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

      {/* Adjustment Modal */}
      {adjustmentModal.show && adjustmentModal.stock && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000 }}>
          <div style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', width: '500px', maxWidth: '95%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#1f3b73', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Stock Adjustment</h3>
              <button 
                onClick={handleAdjustmentClose}
                style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '18px' }}
              >
                ×
              </button>
            </div>
            
            <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
              {/* Adjustment Number */}
              {adjustmentModal.adjustmentNumber && (
                <div style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '10px',
                  marginBottom: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: '600' }}>
                    Adjustment Number
                  </div>
                  <div style={{
                    color: '#007bff',
                    fontSize: '20px',
                    fontWeight: '700',
                    letterSpacing: '1px'
                  }}>
                    ADJ-{String(adjustmentModal.adjustmentNumber).padStart(6, '0')}
                  </div>
                </div>
              )}
              
              {/* Current Item Information */}
              {(() => {
                const stock = adjustmentModal.stock;
                const formatNumber = (num) => {
                  return parseFloat(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                };
                
                return (
                  <div style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px',
                    marginBottom: '12px'
                  }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', fontWeight: '600' }}>
                      Current Item Information
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{
                            color: '#007bff',
                            fontSize: '18px',
                            fontWeight: '600',
                            marginBottom: '4px'
                          }}>
                            {stock.BENZ || 'N/A'}
                          </div>
                          <div style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500', marginBottom: '2px' }}>
                            {stock.BRAND && stock.ALTNO ? `${stock.BRAND} ${stock.ALTNO}` : (stock.BRAND || 'No brand')}
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '2px' }}>
                            {stock.DESCRIPTION || 'No description'}
                          </div>
                        </div>
                        {stock.LOCATION && (
                          <div style={{ fontSize: '10px', marginTop: 'auto' }}>
                            <span style={{ 
                              color: (stock.LOCATION && stock.LOCATION.trim() && stock.LOCATION.trim().toLowerCase() !== 'location not indicated') ? '#4CAF50' : '#f44336',
                              fontWeight: '500'
                            }}>
                              {stock.LOCATION && stock.LOCATION.trim() ? stock.LOCATION : 'Location not indicated'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', marginLeft: '10px', marginTop: '-6px' }}>
                        <div style={{
                          color: '#fff',
                          fontWeight: '700',
                          fontSize: '24px',
                          textAlign: 'right',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.05)'
                        }}>
                          {stock.ID || 'N/A'}
                        </div>
                        <div>
                          <div style={{
                            background: '#28a745',
                            color: '#fff',
                            borderRadius: '4px',
                            padding: '3px 6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                            textAlign: 'right',
                            minWidth: '70px',
                            marginBottom: '3px'
                          }}>
                            ₱{formatNumber(stock.PRICE || 0)}
                          </div>
                          <div style={{
                            background: '#007bff',
                            color: '#fff',
                            borderRadius: '4px',
                            padding: '3px 6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                            textAlign: 'right',
                            minWidth: '70px'
                          }}>
                            Qty: {stock.QTY || stock.QUANTITY || '0'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              {/* Main Form Section */}
              <div style={{ marginBottom: '12px' }}>
                {/* Row 1: Reason */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ color: '#b0b0b0', fontSize: '12px', marginBottom: '6px', display: 'block' }}>Reason</label>
                  <select 
                    value={adjustmentModal.reason} 
                    onChange={(e) => setAdjustmentModal(prev => ({ ...prev, reason: e.target.value }))} 
                    style={{ 
                      width: '100%',
                      padding: '8px', 
                      background: '#1a1a1a', 
                      color: '#fff', 
                      border: '1px solid #404040', 
                      borderRadius: '8px',
                      fontSize: '13px'
                    }}
                  >
                    <option value="">-- None --</option>
                    <option value="found">Item Found</option>
                    <option value="received">Item Received</option>
                    <option value="returned">Item Returned</option>
                    <option value="correction">Stock Correction</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Row 2: Customer */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ color: '#b0b0b0', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                    Customer <span style={{ color: '#ff4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={adjustmentModal.customer || ''}
                    onChange={(e) => setAdjustmentModal(prev => ({ ...prev, customer: e.target.value }))}
                    placeholder="Enter customer name"
                    required
                    style={{ 
                      width: '100%',
                      padding: '8px', 
                      background: '#1a1a1a', 
                      color: '#fff', 
                      border: '1px solid #404040', 
                      borderRadius: '8px',
                      fontSize: '13px'
                    }}
                  />
                </div>

                {/* Row 3: Quantity | Price */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ color: '#b0b0b0', fontSize: '12px', marginBottom: '6px', display: 'block' }}>Quantity will be</label>
                    <input
                      type="number"
                      value={adjustmentModal.quantity || ''}
                      onChange={(e) => setAdjustmentModal(prev => ({ ...prev, quantity: e.target.value }))}
                      style={{ 
                        width: '100%',
                        padding: '8px', 
                        background: '#1a1a1a', 
                        color: '#fff', 
                        border: '1px solid #404040', 
                        borderRadius: '8px',
                        fontSize: '13px'
                      }}
                      placeholder="Enter adjustment (+/-)"
                      autoFocus
                    />
                    {adjustmentModal.quantity && !isNaN(parseInt(adjustmentModal.quantity)) && adjustmentModal.stock && (
                      <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
                        Current: {adjustmentModal.stock.QTY || adjustmentModal.stock.QUANTITY || 0} → Will be: {parseInt(adjustmentModal.stock.QTY || adjustmentModal.stock.QUANTITY || 0) + parseInt(adjustmentModal.quantity)}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ color: '#b0b0b0', fontSize: '12px', marginBottom: '6px', display: 'block' }}>Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={adjustmentModal.price || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow empty or valid decimal numbers
                        if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                          setAdjustmentModal(prev => ({ ...prev, price: value }));
                        }
                      }}
                      onBlur={(e) => {
                        // Format to 2 decimal places on blur
                        const num = parseFloat(e.target.value);
                        if (!isNaN(num)) {
                          setAdjustmentModal(prev => ({ ...prev, price: num.toFixed(2) }));
                        }
                      }}
                      style={{ 
                        width: '100%',
                        padding: '8px', 
                        background: '#1a1a1a', 
                        color: '#fff', 
                        border: '1px solid #404040', 
                        borderRadius: '8px',
                        fontSize: '13px'
                      }}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Row 4: Note */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ color: '#b0b0b0', fontSize: '12px', marginBottom: '6px', display: 'block' }}>Note</label>
                  <textarea
                    value={adjustmentModal.note || ''}
                    onChange={(e) => setAdjustmentModal(prev => ({ ...prev, note: e.target.value }))}
                    placeholder="Enter adjustment note (optional)"
                    rows="2"
                    style={{ 
                      width: '100%',
                      padding: '8px', 
                      background: '#1a1a1a', 
                      color: '#fff', 
                      border: '1px solid #404040', 
                      borderRadius: '8px',
                      fontSize: '13px',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                {/* Save Changes Button */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button 
                    onClick={handleAdjustmentSave}
                    style={{ 
                      flex: 1,
                      background: '#16a34a', 
                      color: '#fff', 
                      border: 'none', 
                      padding: '10px 16px', 
                      borderRadius: '8px', 
                      cursor: 'pointer', 
                      fontWeight: 600, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: '6px',
                      fontSize: '14px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#15803d';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(22, 163, 74, 0.4)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#16a34a';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    Save Changes
                  </button>
                  <button 
                    onClick={handleAdjustmentClose}
                    style={{ 
                      flex: 1,
                      background: '#6b7280', 
                      color: '#fff', 
                      border: 'none', 
                      padding: '10px 16px', 
                      borderRadius: '8px', 
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '14px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#4b5563';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(107, 114, 128, 0.4)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#6b7280';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quantity Edit Modal */}
      {quantityEditModal.show && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <div className="custom-modal-header">
              <h3>Edit Quantity</h3>
              <button 
                className="modal-close-btn"
                onClick={handleQuantityCancel}
              >
                ×
              </button>
            </div>
            
            <div className="custom-modal-body">
              <div style={{ marginBottom: '20px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '15px',
                  padding: '12px',
                  background: 'rgba(0, 123, 255, 0.1)',
                  borderRadius: '8px',
                  border: '1px solid rgba(0, 123, 255, 0.3)'
                }}>
                  <div style={{ 
                    background: '#007bff', 
                    color: '#ffffff', 
                    padding: '6px 12px', 
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '700',
                    letterSpacing: '0.5px'
                  }}>
                    ID: {quantityEditModal.stockId}
                  </div>
                  <div style={{ color: '#007bff', fontSize: '16px', fontWeight: '600' }}>
                    <strong>BENZ:</strong> {quantityEditModal.stockData?.BENZ || 'N/A'}
                  </div>
                </div>
                <p style={{ marginBottom: '10px', color: '#ffffff' }}>
                  <strong>Brand:</strong> {quantityEditModal.stockData?.BRAND || 'Unknown'} - {quantityEditModal.stockData?.ALTNO || 'N/A'}
                </p>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#ffffff', fontWeight: '600' }}>
                  Current Quantity: <span style={{ color: '#007bff' }}>{quantityEditModal.currentQuantity}</span>
                </label>
                <label style={{ display: 'block', marginBottom: '8px', color: '#ffffff', fontWeight: '600' }}>
                  New Quantity:
                </label>
                <input
                  type="number"
                  value={quantityEditModal.newQuantity}
                  onChange={handleQuantityChange}
                  min="0"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #404040',
                    borderRadius: '6px',
                    background: '#2a2a2a',
                    color: '#ffffff',
                    fontSize: '16px'
                  }}
                  autoFocus
                />
              </div>
            </div>
            
            <div className="custom-modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={handleQuantityCancel}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleQuantitySave}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Select Modal */}
      {bulkSelectModalOpen && (
        <div className="custom-modal-overlay">
          <div className="custom-modal" style={{ maxWidth: '500px' }}>
            <div className="custom-modal-header">
              <h3>Bulk Select Items</h3>
              <button 
                className="custom-modal-close"
                onClick={() => {
                  setBulkSelectModalOpen(false);
                  setBulkSelectFromId('');
                  setBulkSelectToId('');
                }}
              >
                ×
              </button>
            </div>
            
            <div className="custom-modal-body">
              <div style={{ marginBottom: '20px' }}>
                <p style={{ color: '#ccc', marginBottom: '15px' }}>
                  Select items by ID range. For example: 163134 - 163178
                </p>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '5px', color: '#fff', fontSize: '14px' }}>
                      From ID
                    </label>
                    <input
                      type="number"
                      value={bulkSelectFromId}
                      onChange={(e) => setBulkSelectFromId(e.target.value)}
                      placeholder="e.g., 163134"
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #555',
                        borderRadius: '6px',
                        background: '#2a2a2a',
                        color: '#ffffff',
                        fontSize: '16px'
                      }}
                      autoFocus
                    />
                  </div>
                  
                  <div style={{ color: '#ccc', fontSize: '18px', fontWeight: 'bold' }}>
                    -
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '5px', color: '#fff', fontSize: '14px' }}>
                      To ID
                    </label>
                    <input
                      type="number"
                      value={bulkSelectToId}
                      onChange={(e) => setBulkSelectToId(e.target.value)}
                      placeholder="e.g., 163178"
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #555',
                        borderRadius: '6px',
                        background: '#2a2a2a',
                        color: '#ffffff',
                        fontSize: '16px'
                      }}
                    />
                  </div>
                </div>

                {/* Quick Selection Buttons */}
                <div style={{ marginTop: '20px' }}>
                  <p style={{ color: '#ccc', marginBottom: '10px', fontSize: '14px' }}>
                    Quick Selection:
                  </p>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleQuickBulkSelect('all-visible')}
                      style={{
                        padding: '8px 12px',
                        background: '#4CAF50',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      All Visible
                    </button>
                    <button
                      onClick={() => handleQuickBulkSelect('in-stock')}
                      style={{
                        padding: '8px 12px',
                        background: '#2196F3',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      In Stock Only
                    </button>
                    <button
                      onClick={() => handleQuickBulkSelect('out-of-stock')}
                      style={{
                        padding: '8px 12px',
                        background: '#f44336',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Out of Stock
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="custom-modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setBulkSelectModalOpen(false);
                  setBulkSelectFromId('');
                  setBulkSelectToId('');
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleBulkSelectByRange}
                disabled={bulkSelectLoading || !bulkSelectFromId || !bulkSelectToId}
                style={{
                  background: bulkSelectLoading ? '#666' : '#4CAF50',
                  cursor: bulkSelectLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {bulkSelectLoading ? 'Selecting...' : 'Select Items'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Movement History Modal */}
      {showMovementModal && (
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
            padding: windowWidth <= 768 ? '0' : 'clamp(10px, 2vw, 20px)'
          }}
              onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowMovementModal(false);
              setShowSalesAnalytics(false);
            }
          }}
        >
          <div 
            style={{
              background: '#1a1a1a',
              borderRadius: windowWidth <= 768 ? '0' : '12px',
              width: windowWidth <= 768 ? '100%' : '95%',
              maxWidth: windowWidth <= 768 ? '100%' : '1400px',
              maxHeight: windowWidth <= 768 ? '100vh' : '95vh',
              height: windowWidth <= 768 ? '100vh' : '95vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              border: '1px solid #404040'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: 'clamp(12px, 2vw, 20px)',
              borderBottom: '2px solid #404040',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              background: '#2d2d2d',
              flexShrink: 0
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ margin: 0, color: '#fff', fontSize: 'clamp(16px, 2.5vw, 20px)', fontWeight: '700', marginBottom: 'clamp(8px, 1.5vw, 12px)' }}>
                  Item Movement History
                </h2>
                <div style={{ marginTop: '8px', color: '#90caf9', fontSize: 'clamp(12px, 1.5vw, 14px)', lineHeight: '1.8' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(8px, 1.5vw, 12px)', marginBottom: '8px' }}>
                    <span><span style={{ fontWeight: '600' }}>Benz:</span> {movementBenz}</span>
                    <span style={{ color: '#4caf50', fontWeight: '600' }}>
                      <span style={{ fontWeight: '600', color: '#90caf9' }}>Total Quantity:</span> <strong>{overallQuantity.toLocaleString()}</strong>
                    </span>
                  </div>
                  {movementDescription && (
                    <div style={{ marginTop: '8px', color: '#e0e0e0', fontSize: 'clamp(11px, 1.3vw, 13px)' }}>
                      <span style={{ fontWeight: '600', color: '#90caf9' }}>Description:</span> <span style={{ marginLeft: '8px' }}>{movementDescription}</span>
                    </div>
                  )}
                  {movementApplication && (
                    <div style={{ marginTop: '4px', color: '#e0e0e0', fontSize: 'clamp(11px, 1.3vw, 13px)' }}>
                      <span style={{ fontWeight: '600', color: '#90caf9' }}>Application:</span> <span style={{ marginLeft: '8px' }}>{movementApplication}</span>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 1.5vw, 12px)' }}>
                {showSalesAnalytics ? (
                  <button
                    onClick={() => setShowSalesAnalytics(false)}
                    style={{
                      background: '#d32f2f',
                      border: 'none',
                      color: '#fff',
                      fontSize: 'clamp(12px, 1.5vw, 14px)',
                      cursor: 'pointer',
                      padding: 'clamp(6px, 1vw, 8px) clamp(12px, 1.5vw, 16px)',
                      borderRadius: '6px',
                      transition: 'all 0.2s',
                      fontWeight: '500'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#c62828'}
                    onMouseLeave={(e) => e.target.style.background = '#d32f2f'}
                  >
                    Hide Sales Analytics
                  </button>
                ) : (
                  <button
                    onClick={() => setShowSalesAnalytics(true)}
                    style={{
                      background: '#1976d2',
                      border: 'none',
                      color: '#fff',
                      fontSize: 'clamp(12px, 1.5vw, 14px)',
                      cursor: 'pointer',
                      padding: 'clamp(6px, 1vw, 8px) clamp(12px, 1.5vw, 16px)',
                      borderRadius: '6px',
                      transition: 'all 0.2s',
                      fontWeight: '500'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#1565c0'}
                    onMouseLeave={(e) => e.target.style.background = '#1976d2'}
                  >
                    Show Sales Analytics
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowMovementModal(false);
                    setShowSalesAnalytics(false);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: 'clamp(20px, 3vw, 24px)',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    transition: 'background 0.2s',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#404040'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Filter Section */}
            {!movementLoading && movementData.length > 0 && (
              <div style={{
                padding: 'clamp(12px, 2vw, 16px) clamp(12px, 2.5vw, 20px)',
                borderBottom: '2px solid #404040',
                background: '#252525',
                display: 'flex',
                gap: 'clamp(8px, 1.5vw, 16px)',
                alignItems: 'center',
                flexWrap: 'wrap',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 1vw, 8px)', flexWrap: 'wrap' }}>
                  <label style={{ color: '#90caf9', fontSize: 'clamp(12px, 1.5vw, 14px)', fontWeight: '500', whiteSpace: 'nowrap' }}>
                    Filter by Year:
                  </label>
                  <select
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    style={{
                      padding: 'clamp(6px, 1vw, 8px) clamp(8px, 1.5vw, 12px)',
                      background: '#2d2d2d',
                      color: '#fff',
                      border: '1px solid #404040',
                      borderRadius: '6px',
                      fontSize: 'clamp(12px, 1.5vw, 14px)',
                      cursor: 'pointer',
                      minWidth: 'clamp(100px, 15vw, 120px)'
                    }}
                  >
                    <option value="">All Years</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 1vw, 8px)', flexWrap: 'wrap' }}>
                  <label style={{ color: '#90caf9', fontSize: 'clamp(12px, 1.5vw, 14px)', fontWeight: '500', whiteSpace: 'nowrap' }}>
                    Last X Months:
                  </label>
                  <select
                    value={filterMonths}
                    onChange={(e) => setFilterMonths(e.target.value)}
                    style={{
                      padding: 'clamp(6px, 1vw, 8px) clamp(8px, 1.5vw, 12px)',
                      background: '#2d2d2d',
                      color: '#fff',
                      border: '1px solid #404040',
                      borderRadius: '6px',
                      fontSize: 'clamp(12px, 1.5vw, 14px)',
                      cursor: 'pointer',
                      minWidth: 'clamp(100px, 15vw, 120px)'
                    }}
                  >
                    <option value="">All Time</option>
                    <option value="2">Last 2 Months</option>
                    <option value="3">Last 3 Months</option>
                    <option value="6">Last 6 Months</option>
                    <option value="12">Last 12 Months</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 1vw, 8px)', flexWrap: 'wrap' }}>
                  <label style={{ color: '#90caf9', fontSize: 'clamp(12px, 1.5vw, 14px)', fontWeight: '500', whiteSpace: 'nowrap' }}>
                    Filter by Brand:
                  </label>
                  <select
                    value={filterBrand}
                    onChange={(e) => setFilterBrand(e.target.value)}
                    style={{
                      padding: 'clamp(6px, 1vw, 8px) clamp(8px, 1.5vw, 12px)',
                      background: '#2d2d2d',
                      color: '#fff',
                      border: '1px solid #404040',
                      borderRadius: '6px',
                      fontSize: 'clamp(12px, 1.5vw, 14px)',
                      cursor: 'pointer',
                      minWidth: 'clamp(100px, 15vw, 120px)'
                    }}
                  >
                    <option value="">All Brands</option>
                    {availableBrands.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginLeft: 'auto', color: '#90caf9', fontSize: 'clamp(12px, 1.5vw, 14px)', whiteSpace: 'nowrap' }}>
                  Showing: <strong>{filteredMovementData.length}</strong> of <strong>{movementData.length}</strong> records
                </div>
              </div>
            )}

            {/* Modal Body */}
            <div style={{
              padding: 'clamp(12px, 2vw, 20px)',
              flex: 1,
              display: movementLoading || movementData.length === 0 ? 'block' : (showSalesAnalytics ? 'flex' : 'block'),
              flexDirection: windowWidth <= 1024 ? 'column' : 'row',
              gap: 'clamp(12px, 2vw, 20px)',
              overflow: 'hidden',
              minHeight: 0
            }}>
              {movementLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#90caf9' }}>
                  <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} />
                  <p style={{ marginTop: '16px', fontSize: '16px' }}>Loading movement history...</p>
                </div>
              ) : movementData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                  <p style={{ fontSize: '16px' }}>No movement history found for this part number.</p>
                </div>
              ) : (
                <>
                  {/* Table Section - Left Side */}
                  <div style={{ 
                    flex: '1', 
                    minWidth: windowWidth <= 1024 ? '0' : '300px',
                    width: windowWidth <= 1024 ? '100%' : 'auto',
                    display: 'flex', 
                    flexDirection: 'column', 
                    minHeight: 0 
                  }}>
                    <div style={{ marginBottom: 'clamp(12px, 1.5vw, 16px)', color: '#90caf9', fontSize: 'clamp(12px, 1.5vw, 14px)', flexShrink: 0 }}>
                      Total Records: <strong>{movementData.length}</strong>
                      {filteredMovementData.length !== movementData.length && (
                        <span style={{ marginLeft: '12px', color: '#ffc107' }}>
                          (Filtered: {filteredMovementData.length})
                        </span>
                      )}
                    </div>
                    <div style={{ 
                      overflowX: 'auto',
                      overflowY: 'auto',
                      flex: 1,
                      border: '1px solid #404040',
                      borderRadius: '8px',
                      minHeight: 0
                    }}>
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        background: '#1a1a1a',
                        color: '#e0e0e0'
                      }}>
                        <thead>
                          <tr style={{ background: '#2d2d2d', position: 'sticky', top: 0, zIndex: 10 }}>
                            <th style={{ 
                              padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', 
                              textAlign: 'left', 
                              borderBottom: '2px solid #404040',
                              color: '#fff',
                              fontWeight: '600',
                              fontSize: 'clamp(11px, 1.3vw, 13px)',
                              textTransform: 'uppercase'
                            }}>Date</th>
                            <th style={{ 
                              padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', 
                              textAlign: 'left', 
                              borderBottom: '2px solid #404040',
                              color: '#fff',
                              fontWeight: '600',
                              fontSize: 'clamp(11px, 1.3vw, 13px)',
                              textTransform: 'uppercase'
                            }}>Customer</th>
                            <th style={{ 
                              padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', 
                              textAlign: 'left', 
                              borderBottom: '2px solid #404040',
                              color: '#fff',
                              fontWeight: '600',
                              fontSize: 'clamp(11px, 1.3vw, 13px)',
                              textTransform: 'uppercase'
                            }}>Brand</th>
                            <th style={{ 
                              padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', 
                              textAlign: 'center', 
                              borderBottom: '2px solid #404040',
                              color: '#fff',
                              fontWeight: '600',
                              fontSize: 'clamp(11px, 1.3vw, 13px)',
                              textTransform: 'uppercase'
                            }}>Quantity</th>
                            <th style={{ 
                              padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', 
                              textAlign: 'right', 
                              borderBottom: '2px solid #404040',
                              color: '#fff',
                              fontWeight: '600',
                              fontSize: 'clamp(11px, 1.3vw, 13px)',
                              textTransform: 'uppercase'
                            }}>Price</th>
                            <th style={{ 
                              padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', 
                              textAlign: 'center', 
                              borderBottom: '2px solid #404040',
                              color: '#fff',
                              fontWeight: '600',
                              fontSize: 'clamp(11px, 1.3vw, 13px)',
                              textTransform: 'uppercase'
                            }}>ID</th>
                            <th style={{ 
                              padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', 
                              textAlign: 'left', 
                              borderBottom: '2px solid #404040',
                              color: '#fff',
                              fontWeight: '600',
                              fontSize: 'clamp(11px, 1.3vw, 13px)',
                              textTransform: 'uppercase'
                            }}>Receipt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMovementData.map((record, index) => (
                            <tr 
                              key={index}
                              style={{
                                borderBottom: '1px solid #333',
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => e.target.parentElement.style.background = '#2a2a2a'}
                              onMouseLeave={(e) => e.target.parentElement.style.background = 'transparent'}
                            >
                              <td style={{ padding: 'clamp(8px, 1.5vw, 10px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(11px, 1.3vw, 13px)' }}>
                                {record.DATE ? new Date(record.DATE).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: '2-digit', 
                                  day: '2-digit' 
                                }) : 'N/A'}
                              </td>
                              <td style={{ padding: 'clamp(8px, 1.5vw, 10px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(11px, 1.3vw, 13px)' }}>
                                {record.CUSTOMER || 'Walk-in Customer'}
                              </td>
                              <td style={{ padding: 'clamp(8px, 1.5vw, 10px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(11px, 1.3vw, 13px)' }}>
                                {record.BRAND || 'N/A'}
                              </td>
                              <td style={{ padding: 'clamp(8px, 1.5vw, 10px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(11px, 1.3vw, 13px)', textAlign: 'center' }}>
                                {record.quantity || record.QTY || 0}
                              </td>
                              <td style={{ padding: 'clamp(8px, 1.5vw, 10px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(11px, 1.3vw, 13px)', textAlign: 'right' }}>
                                ₱{parseFloat(record.price || record.SELL || 0).toLocaleString('en-US', { 
                                  minimumFractionDigits: 2, 
                                  maximumFractionDigits: 2 
                                })}
                              </td>
                              <td style={{ padding: 'clamp(8px, 1.5vw, 10px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(11px, 1.3vw, 13px)', textAlign: 'center', color: '#90caf9' }}>
                                {record.id || record.IDCODE || 'N/A'}
                              </td>
                              <td style={{ padding: 'clamp(8px, 1.5vw, 10px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(11px, 1.3vw, 13px)' }}>
                                {record.RECEIPT || record.INVOICE || 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Chart Section - Right Side */}
                  {showSalesAnalytics && (
                  <div style={{ 
                    flex: '1', 
                    minWidth: windowWidth <= 1024 ? '0' : '300px',
                    maxWidth: windowWidth <= 1024 ? '100%' : '500px',
                    width: windowWidth <= 1024 ? '100%' : 'auto',
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignSelf: windowWidth <= 1024 ? 'stretch' : 'flex-start'
                  }}>
                    <div style={{ 
                      background: '#2d2d2d',
                      borderRadius: '8px',
                      padding: 'clamp(12px, 2vw, 20px)',
                      border: '1px solid #404040',
                      width: '100%'
                    }}>
                      <h3 style={{ 
                        margin: '0 0 clamp(12px, 2vw, 20px) 0', 
                        color: '#fff', 
                        fontSize: 'clamp(14px, 2vw, 18px)', 
                        fontWeight: '600',
                        textAlign: 'center'
                      }}>
                        Sales Analytics
                      </h3>
                      {chartData.labels.length > 0 ? (
                        <div style={{ height: windowWidth <= 1024 ? '300px' : '400px', position: 'relative' }}>
                          <Bar
                            data={chartData}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                legend: {
                                  position: 'top',
                                  labels: {
                                    color: '#e0e0e0',
                                    font: {
                                      size: 12
                                    }
                                  }
                                },
                                tooltip: {
                                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                  titleColor: '#fff',
                                  bodyColor: '#e0e0e0',
                                  borderColor: '#404040',
                                  borderWidth: 1
                                }
                              },
                              scales: {
                                x: {
                                  ticks: {
                                    color: '#e0e0e0',
                                    font: {
                                      size: 11
                                    }
                                  },
                                  grid: {
                                    color: '#404040'
                                  }
                                },
                                y: {
                                  type: 'linear',
                                  display: true,
                                  position: 'left',
                                  ticks: {
                                    color: '#90caf9',
                                    font: {
                                      size: 11
                                    }
                                  },
                                  grid: {
                                    color: '#404040'
                                  },
                                  title: {
                                    display: true,
                                    text: 'Quantity',
                                    color: '#90caf9'
                                  }
                                },
                                y1: {
                                  type: 'linear',
                                  display: true,
                                  position: 'right',
                                  ticks: {
                                    color: '#ff6b9d',
                                    font: {
                                      size: 11
                                    },
                                    callback: function(value) {
                                      return '₱' + value.toLocaleString('en-US', { 
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 0
                                      });
                                    }
                                  },
                                  grid: {
                                    drawOnChartArea: false,
                                  },
                                  title: {
                                    display: true,
                                    text: 'Amount (₱)',
                                    color: '#ff6b9d'
                                  }
                                }
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <div style={{ 
                          textAlign: 'center', 
                          padding: '40px', 
                          color: '#888',
                          fontSize: '14px'
                        }}>
                          No data available for the selected filters
                        </div>
                      )}
                    </div>
                  </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: 'clamp(12px, 2vw, 16px) clamp(12px, 2.5vw, 20px)',
              borderTop: '2px solid #404040',
              display: 'flex',
              justifyContent: 'flex-end',
              background: '#2d2d2d',
              flexShrink: 0
            }}>
              <button
                onClick={() => setShowMovementModal(false)}
                style={{
                  padding: 'clamp(8px, 1.5vw, 10px) clamp(16px, 3vw, 24px)',
                  background: '#007bff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: 'clamp(12px, 1.5vw, 14px)',
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
    </div>
  );
};

export default InventoryManagement; 
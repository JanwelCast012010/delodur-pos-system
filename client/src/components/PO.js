import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Search, Upload, RefreshCw, FileText, X, Package, ArrowUp, ArrowDown } from 'lucide-react';
import { AuthContext } from '../AuthContext';
import * as XLSX from 'xlsx';

const PO = () => {
  const { user } = useContext(AuthContext);
  const [poData, setPoData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('all'); // all, part_number, benz2, benz3, oem, description
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [compatibilityLoading, setCompatibilityLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  useEffect(() => {
    fetchPOData();
  }, []);

  // Reset filtered data when poData changes (but don't auto-filter on searchTerm change)
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredData(poData);
    } else {
      filterData();
    }
  }, [poData]);

  // Re-apply sorting when sortConfig changes
  useEffect(() => {
    if (poData.length > 0) {
      filterData();
    }
  }, [sortConfig]);

  const fetchPOData = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/po', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.success) {
        setPoData(response.data.data || []);
      } else {
        setError(response.data.error || 'Failed to fetch P.O data');
      }
    } catch (err) {
      setError('Error fetching P.O data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced search function (like Stock page handleSearchSubmit)
  const handleSearchSubmit = () => {
    if (searchTerm.trim()) {
      const cleanSearchTerm = searchTerm.trim();
      filterData(cleanSearchTerm);
    } else {
      setFilteredData(poData);
    }
  };

  // Handle search input change (like Stock page handleSearchChange)
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    // Auto-filter as user types (optional - can remove if you want search only on Enter)
    // filterData(e.target.value);
  };

  // Compatibility search function (like Stock page handleCompatibilitySearch)
  const handleCompatibilitySearch = async () => {
    if (!searchTerm.trim()) {
      return;
    }

    try {
      setCompatibilityLoading(true);
      // For P.O, compatibility search is the same as regular search
      // but we can add additional logic here if needed
      handleSearchSubmit();
    } catch (error) {
      console.error('Error in compatibility search:', error);
    } finally {
      setCompatibilityLoading(false);
    }
  };

  // Handle column sorting
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filterData = (term = null) => {
    const searchTermToUse = term !== null ? term : searchTerm;
    
    let filtered = [];

    if (!searchTermToUse.trim()) {
      filtered = [...poData];
    } else {
      const searchTermLower = searchTermToUse.toLowerCase().trim();

      switch (searchType) {
        case 'part_number':
          filtered = poData.filter(item => 
            item.part_number && item.part_number.toLowerCase().includes(searchTermLower)
          );
          break;
        case 'benz2':
          filtered = poData.filter(item => 
            item.benz2 && item.benz2.toLowerCase().includes(searchTermLower)
          );
          break;
        case 'benz3':
          filtered = poData.filter(item => 
            item.benz3 && item.benz3.toLowerCase().includes(searchTermLower)
          );
          break;
        case 'oem':
          filtered = poData.filter(item => 
            item.oem && item.oem.toLowerCase().includes(searchTermLower)
          );
          break;
        case 'description':
          filtered = poData.filter(item => 
            item.description && item.description.toLowerCase().includes(searchTermLower)
          );
          break;
        default:
          filtered = poData.filter(item => 
            (item.part_number && item.part_number.toLowerCase().includes(searchTermLower)) ||
            (item.benz2 && item.benz2.toLowerCase().includes(searchTermLower)) ||
            (item.benz3 && item.benz3.toLowerCase().includes(searchTermLower)) ||
            (item.oem && item.oem.toLowerCase().includes(searchTermLower)) ||
            (item.description && item.description.toLowerCase().includes(searchTermLower))
          );
      }
    }

    // Apply sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Handle null/undefined values
        if (aVal === null || aVal === undefined) aVal = '';
        if (bVal === null || bVal === undefined) bVal = '';

        // Handle numeric columns
        if (sortConfig.key === 'qty' || sortConfig.key === 'ts' || sortConfig.key === 'dl' || sortConfig.key === 'others') {
          aVal = parseFloat(aVal) || 0;
          bVal = parseFloat(bVal) || 0;
        } else {
          // String comparison
          aVal = String(aVal).toLowerCase();
          bVal = String(bVal).toLowerCase();
        }

        if (aVal < bVal) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    setFilteredData(filtered);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    const inputElement = e.target;
    
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File selected:', file.name, file.type, file.size);

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      const errorMsg = 'Please select a valid Excel file (.xlsx or .xls)';
      setError(errorMsg);
      console.error(errorMsg);
      return;
    }

    setImportFile(file);
    setError('');
    setSuccess('');
    
    const reader = new FileReader();
    
    reader.onload = (readerEvent) => {
      try {
        console.log('File read successfully, size:', readerEvent.target.result.byteLength);
        const data = new Uint8Array(readerEvent.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        console.log('Workbook sheets:', workbook.SheetNames);
        
        // Look for "Sheet1" specifically, fall back to first sheet if not found
        let sheetName = 'Sheet1';
        if (!workbook.SheetNames.includes('Sheet1')) {
          console.log('Sheet1 not found, using first sheet:', workbook.SheetNames[0]);
          sheetName = workbook.SheetNames[0];
        } else {
          console.log('Using Sheet1');
        }
        
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          throw new Error(`Sheet "${sheetName}" not found in workbook`);
        }
        
        // Check worksheet range
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        console.log('Worksheet range:', worksheet['!ref'], 'Rows:', range.e.r + 1, 'Cols:', range.e.c + 1);
        
        // Parse Excel - standard way: first row = headers, rest = data objects
        // By default, sheet_to_json uses first row as headers automatically
        let jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          defval: '', // Default value for empty cells
          raw: false, // Parse numbers and dates
          blankrows: false // Skip blank rows
        });
        
        console.log('Parsed rows (first row as headers):', jsonData.length);
        
        // If no data, try manual conversion from array format as fallback
        if (jsonData.length === 0) {
          console.log('No data with default parsing, trying manual array conversion...');
          const arrayData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,  // Returns array of arrays
            defval: '',
            raw: false,
            blankrows: false
          });
          
          console.log('Array format total rows:', arrayData.length);
          if (arrayData.length > 0) {
            console.log('First row (should be headers):', arrayData[0]);
            if (arrayData.length > 1) {
              console.log('Second row (sample data):', arrayData[1]);
            }
          }
          
          if (arrayData.length > 1) {
            // First row is headers, rest is data
            const headers = arrayData[0].map(h => h ? String(h).trim() : '').filter(h => h);
            console.log('Headers extracted:', headers);
            
            jsonData = arrayData.slice(1)
              .filter(row => row && Array.isArray(row) && row.some(cell => cell !== '' && cell !== null && cell !== undefined)) // Skip empty rows
              .map(row => {
                const obj = {};
                headers.forEach((header, colIndex) => {
                  if (header) {
                    obj[header] = row[colIndex] !== undefined && row[colIndex] !== null ? row[colIndex] : '';
                  }
                });
                return obj;
              });
            
            console.log('Converted to object format:', jsonData.length, 'rows');
          }
        }
        
        console.log('Final parsed rows:', jsonData.length);
        
        if (jsonData.length === 0) {
          setError('Excel file appears to be empty or has no data rows. Please check that the file contains data in the first sheet.');
          setImportPreview([]);
          inputElement.value = '';
          return;
        }

        // Log first row to see column names
        if (jsonData.length > 0) {
          console.log('First row columns:', Object.keys(jsonData[0]));
          console.log('First row data:', jsonData[0]);
          console.log('Sample column values:', {
            'PART NUMBER': jsonData[0]['PART NUMBER'] || jsonData[0]['Part Number'] || 'NOT FOUND',
            'BRAND': jsonData[0]['BRAND'] || jsonData[0]['Brand'] || 'NOT FOUND',
            'DESCRIPTION': jsonData[0]['DESCRIPTION'] || jsonData[0]['Description'] || 'NOT FOUND'
          });
        }

        // Helper function to find column by multiple possible names (case-insensitive, handles whitespace)
        const findColumn = (row, possibleNames) => {
          // First, normalize all keys in the row (trim whitespace)
          const normalizedRow = {};
          for (const key in row) {
            if (key) {
              normalizedRow[key.trim()] = row[key];
            }
          }
          
          for (const name of possibleNames) {
            const trimmedName = name.trim();
            // Try exact match first (with trimmed key)
            const exactValue = normalizedRow[trimmedName];
            if (exactValue !== undefined && exactValue !== null && exactValue !== '') {
              return exactValue;
            }
            // Try case-insensitive match
            const lowerName = trimmedName.toLowerCase();
            for (const key in normalizedRow) {
              if (key && key.toLowerCase() === lowerName) {
                const value = normalizedRow[key];
                if (value !== undefined && value !== null && value !== '') {
                  return value;
                }
              }
            }
          }
          return null; // Return null for not found
        };
        
        // Helper function to parse numeric value, handling commas, dollar signs, etc.
        const parseNumeric = (value) => {
          if (value === null || value === undefined || value === '') {
            return null;
          }
          // Handle numbers that might already be parsed
          if (typeof value === 'number') {
            return isNaN(value) ? null : value;
          }
          // Convert to string and remove currency symbols, commas, and whitespace
          const cleaned = String(value).replace(/[$,\s]/g, '').trim();
          if (cleaned === '' || cleaned === '-') {
            return null;
          }
          const parsed = parseFloat(cleaned);
          return isNaN(parsed) ? null : parsed;
        };

        // Map Excel columns to our database fields
        const mappedData = jsonData.map((row, index) => {
          try {
            // Get all column names for debugging
            if (index === 0) {
              console.log('Available columns in Excel:', Object.keys(row));
            }
            
            // Log first row to debug column names
            if (index === 0) {
              console.log('Available columns in first data row:', Object.keys(row));
              console.log('Raw row values:', row);
              console.log('Sample values:', {
                'TS': row['TS'],
                'DL': row['DL'],
                'Others': row['Others'],
                'QTY.': row['QTY.']
              });
            }
            
            // Try to find TS, DL, Others columns - check all possible variations
            let tsVal = findColumn(row, ['TS', 'ts', 'Ts']);
            let dlVal = findColumn(row, ['DL', 'dl', 'Dl']);
            let othersVal = findColumn(row, ['Others', 'others', 'OTHER', 'Other', 'OTHERS']);
            
            // If not found, try direct access (in case column names have extra spaces)
            if (tsVal === null && index === 0) {
              console.log('TS not found, trying direct access...');
              for (const key in row) {
                if (key && key.trim().toUpperCase() === 'TS') {
                  tsVal = row[key];
                  console.log('Found TS with key:', key, 'value:', tsVal);
                  break;
                }
              }
            }
            if (dlVal === null && index === 0) {
              console.log('DL not found, trying direct access...');
              for (const key in row) {
                if (key && key.trim().toUpperCase() === 'DL') {
                  dlVal = row[key];
                  console.log('Found DL with key:', key, 'value:', dlVal);
                  break;
                }
              }
            }
            if (othersVal === null && index === 0) {
              console.log('Others not found, trying direct access...');
              for (const key in row) {
                if (key && key.trim().toUpperCase() === 'OTHERS') {
                  othersVal = row[key];
                  console.log('Found Others with key:', key, 'value:', othersVal);
                  break;
                }
              }
            }
            
            if (index === 0) {
              console.log('Found values after all attempts:', {
                'TS': tsVal,
                'DL': dlVal,
                'Others': othersVal
              });
            }
            
            return {
              part_number: findColumn(row, ['PART NUMBER', 'Part Number', 'Part No', 'PART NO', 'PART NO.', 'PartNo', 'Part_Number']) || '',
              brand: findColumn(row, ['BRAND', 'Brand', 'BRAND NAME', 'Brand Name']) || '',
              description: findColumn(row, ['DESCRIPTION', 'Description', 'DESC', 'Desc', 'DESCRIPT', 'Descript']) || '',
              qty: (() => {
                const val = findColumn(row, ['QTY.', 'QTY', 'Quantity', 'QUANTITY', 'Qty', 'qty']);
                return val ? parseInt(val) || 0 : 0;
              })(),
              ts: parseNumeric(tsVal),
              dl: parseNumeric(dlVal),
              others: parseNumeric(othersVal),
              po_no: findColumn(row, ['P.O. NO.', 'P.O. NO', 'PO NO', 'PO Number', 'P.O NO.', 'PO_NO', 'PO_NO.', 'PONO', 'P.O.NO.']) || '',
              remarks: findColumn(row, ['REMARKS', 'Remarks', 'REMARK', 'Remark', 'NOTES', 'Notes']) || '',
              benz2: findColumn(row, ['BENZ 2', 'Benz 2', 'BENZ2', 'Benz2', 'BENZ_2', 'Benz_2']),
              benz3: findColumn(row, ['BENZ 3', 'Benz 3', 'BENZ3', 'Benz3', 'BENZ_3', 'Benz_3']),
              oem: findColumn(row, ['OEM', 'oem', 'Oem'])
            };
          } catch (rowError) {
            console.error(`Error processing row ${index}:`, rowError);
            return null;
          }
        }).filter(item => item !== null);

        console.log('Mapped data rows:', mappedData.length);
        setImportPreview(mappedData);
        setSuccess(`File loaded successfully! Found ${mappedData.length} rows.`);
      } catch (error) {
        const errorMsg = 'Error reading Excel file: ' + error.message;
        setError(errorMsg);
        console.error('Excel read error:', error);
        setImportPreview([]);
      } finally {
        // Reset the input so the same file can be selected again
        inputElement.value = '';
      }
    };
    
    reader.onerror = (error) => {
      const errorMsg = 'Error reading file: ' + error.message;
      setError(errorMsg);
      console.error('FileReader error:', error);
      setImportPreview([]);
      // Reset the input
      inputElement.value = '';
      e.target.value = '';
    };
    
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!importPreview.length) {
      setError('No data to import. Please select and load an Excel file first.');
      return;
    }

    console.log('Starting import with', importPreview.length, 'rows');
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please log in again.');
        setLoading(false);
        return;
      }

      console.log('Sending import request...');
      const response = await axios.post('/api/po/import', 
        { data: importPreview },
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Import response:', response.data);

      if (response.data.success) {
        const successMsg = `Successfully imported ${response.data.count} records${response.data.errors > 0 ? ` (${response.data.errors} errors)` : ''}`;
        setSuccess(successMsg);
        setTimeout(() => {
          setShowImportModal(false);
          setImportFile(null);
          setImportPreview([]);
          fetchPOData();
        }, 1500);
      } else {
        setError(response.data.error || 'Failed to import data');
      }
    } catch (err) {
      console.error('Import error:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Error importing data';
      setError('Error importing data: ' + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '';
    return parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="pos-container" style={{ padding: '20px' }}>
      <style>{`
        .po-container {
          background: var(--card-bg);
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 16px var(--shadow-md);
        }

        .po-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .po-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .po-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .po-search-container {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
          align-items: center;
        }

        .po-search-input-group {
          display: flex;
          flex: 1;
          min-width: 300px;
          gap: 8px;
        }

        .po-search-input {
          flex: 1;
          padding: 12px 16px;
          border: 2px solid var(--border-color);
          border-radius: 8px;
          font-size: 16px;
          background: var(--bg-primary);
          color: var(--text-primary);
        }

        .po-search-select {
          padding: 12px 16px;
          border: 2px solid var(--border-color);
          border-radius: 8px;
          font-size: 16px;
          background: var(--bg-primary);
          color: var(--text-primary);
          cursor: pointer;
        }

        .po-btn {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .po-btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .po-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .po-btn-secondary {
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 2px solid var(--border-color);
        }

        .po-btn-secondary:hover {
          background: var(--hover-bg);
        }

        .po-table-container {
          background: var(--card-bg);
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 16px var(--shadow-md);
        }

        :root[data-theme="light"] .po-table-container {
          background: var(--bg-secondary);
          box-shadow: 0 4px 16px var(--shadow-md);
        }

        :root[data-theme="dark"] .po-table-container {
          background: #1a1a1a;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        }

        .po-table-wrapper {
          overflow-x: auto;
          max-width: 100%;
          background: var(--bg-primary);
        }

        :root[data-theme="light"] .po-table-wrapper {
          background: var(--bg-primary);
        }

        :root[data-theme="dark"] .po-table-wrapper {
          background: transparent;
        }

        .po-table-wrapper::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .po-table-wrapper::-webkit-scrollbar-track {
          background: var(--bg-secondary);
        }

        :root[data-theme="light"] .po-table-wrapper::-webkit-scrollbar-track {
          background: #e9ecef;
        }

        :root[data-theme="dark"] .po-table-wrapper::-webkit-scrollbar-track {
          background: #1a1a1a;
        }

        .po-table-wrapper::-webkit-scrollbar-thumb {
          background: var(--border-color);
          border-radius: 4px;
        }

        :root[data-theme="light"] .po-table-wrapper::-webkit-scrollbar-thumb {
          background: #adb5bd;
        }

        :root[data-theme="dark"] .po-table-wrapper::-webkit-scrollbar-thumb {
          background: #444;
        }

        .po-table-wrapper::-webkit-scrollbar-thumb:hover {
          background: var(--text-muted);
        }

        .po-table {
          width: 100%;
          border-collapse: collapse;
          background: var(--card-bg);
          color: var(--text-primary);
          table-layout: auto;
          display: table;
        }

        :root[data-theme="light"] .po-table {
          background: var(--bg-secondary);
        }

        :root[data-theme="dark"] .po-table {
          background: #1a1a1a;
          color: #e0e0e0;
        }

        .po-table thead {
          display: table-header-group;
        }

        .po-table tbody {
          display: table-row-group;
        }

        .po-table tr {
          display: table-row;
        }

        .po-table th {
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-weight: 600;
          padding: 16px 20px;
          text-align: left;
          border-bottom: 2px solid var(--border-color);
          font-size: 1em;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          position: sticky;
          top: 0;
          z-index: 10;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
          cursor: pointer;
          user-select: none;
          transition: all 0.2s ease;
          display: table-cell;
          vertical-align: middle;
        }

        :root[data-theme="light"] .po-table th {
          background: #e9ecef;
          color: #212529;
          border-bottom: 2px solid #dee2e6;
        }

        :root[data-theme="dark"] .po-table th {
          background: #2d2d2d;
          color: #ffffff;
          border-bottom: 2px solid #404040;
        }

        .po-table th:hover {
          background: var(--hover-bg);
        }

        :root[data-theme="dark"] .po-table th:hover {
          background: #3a3a3a;
        }

        .po-table th.sortable {
          white-space: nowrap;
        }

        .po-table th.sortable > span:first-child {
          display: inline-block;
          margin-right: 8px;
          vertical-align: middle;
        }

        .po-table th .sort-icon {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          opacity: 0.5;
          transition: opacity 0.2s ease;
          min-width: 20px;
          vertical-align: middle;
          margin-left: 4px;
        }

        .po-table th.active .sort-icon {
          opacity: 1;
        }

        .po-table th.active {
          background: var(--hover-bg);
        }

        :root[data-theme="dark"] .po-table th.active {
          background: #3a3a3a;
        }

        .po-table td {
          padding: 14px 20px;
          border-bottom: 1px solid var(--border-color);
          vertical-align: middle;
          display: table-cell;
        }

        :root[data-theme="dark"] .po-table td {
          border-bottom: 1px solid #333;
        }

        .po-table tr {
          transition: all 0.2s ease;
        }

        .po-table tbody tr:hover {
          background: var(--hover-bg);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          transform: translateY(-1px);
        }

        :root[data-theme="dark"] .po-table tbody tr:hover {
          background: #2a2a2a;
        }

        .po-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .po-modal-content {
          background: var(--card-bg);
          border-radius: 12px;
          padding: 24px;
          max-width: 90vw;
          max-height: 90vh;
          overflow: auto;
          position: relative;
        }

        .po-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .po-modal-title {
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .po-alert {
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .po-alert-error {
          background: #fee;
          color: #c33;
          border: 1px solid #fcc;
        }

        .po-alert-success {
          background: #efe;
          color: #3c3;
          border: 1px solid #cfc;
        }
      `}</style>

      <div className="po-container">
        <div className="po-header">
          <h1 className="po-title">
            <FileText size={32} />
            P.O (Purchase Orders)
          </h1>
          <div className="po-actions">
            <button 
              className="po-btn po-btn-primary"
              onClick={() => setShowImportModal(true)}
            >
              <Upload size={20} />
              Import Excel
            </button>
            <button 
              className="po-btn po-btn-secondary"
              onClick={fetchPOData}
              disabled={loading}
            >
              <RefreshCw size={20} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="po-alert po-alert-error">{error}</div>
        )}

        {success && (
          <div className="po-alert po-alert-success">{success}</div>
        )}

        <div className="po-search-container">
          <div className="po-search-input-group">
            <Search size={20} style={{ marginTop: '12px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="po-search-input"
              placeholder="Search by Part Number, BENZ 2, BENZ 3, OEM, or Description..."
              value={searchTerm}
              onChange={handleSearchChange}
              onKeyPress={async (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  // First perform the search
                  handleSearchSubmit();
                  // Then trigger Find Compatible if conditions are met
                  if (searchTerm.trim() && !compatibilityLoading) {
                    await handleCompatibilitySearch();
                  }
                }
              }}
            />
          </div>
          
          {/* Find Compatible Button (like Stock page) */}
          <button
            onClick={handleCompatibilitySearch}
            disabled={compatibilityLoading || !searchTerm.trim()}
            className="po-btn po-btn-primary"
            style={{ 
              opacity: (compatibilityLoading || !searchTerm.trim()) ? 0.6 : 1,
              cursor: (compatibilityLoading || !searchTerm.trim()) ? 'not-allowed' : 'pointer',
              background: compatibilityLoading ? '#6c757d' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: (compatibilityLoading || !searchTerm.trim()) ? 'none' : '0 2px 6px rgba(102, 126, 234, 0.3)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!compatibilityLoading && searchTerm.trim()) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              if (!compatibilityLoading && searchTerm.trim()) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(102, 126, 234, 0.3)';
              }
            }}
          >
            {compatibilityLoading ? (
              <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Search size={20} />
            )}
            {compatibilityLoading ? 'Finding...' : 'Find'}
          </button>

          <select
            className="po-search-select"
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
          >
            <option value="all">All Fields</option>
            <option value="part_number">Part Number</option>
            <option value="benz2">BENZ 2</option>
            <option value="benz3">BENZ 3</option>
            <option value="oem">OEM</option>
            <option value="description">Description</option>
          </select>
        </div>

        {loading && !poData.length ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite' }} />
            <p>Loading...</p>
          </div>
        ) : (
          <div className="po-table-container">
            <div className="po-table-wrapper">
              <table className="po-table">
              <thead>
                <tr>
                  <th 
                    className={`sortable ${sortConfig.key === 'part_number' ? 'active' : ''}`}
                    onClick={() => handleSort('part_number')}
                  >
                    <span>PART NUMBER</span>
                    <span className="sort-icon">
                      {sortConfig.key === 'part_number' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '0.8', gap: '2px' }}>
                          <ArrowUp size={10} style={{ opacity: 0.3 }} />
                          <ArrowDown size={10} style={{ opacity: 0.3 }} />
                        </span>
                      )}
                    </span>
                  </th>
                  <th 
                    className={`sortable ${sortConfig.key === 'brand' ? 'active' : ''}`}
                    onClick={() => handleSort('brand')}
                  >
                    <span>BRAND</span>
                    <span className="sort-icon">
                      {sortConfig.key === 'brand' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '0.8', gap: '2px' }}>
                          <ArrowUp size={10} style={{ opacity: 0.3 }} />
                          <ArrowDown size={10} style={{ opacity: 0.3 }} />
                        </span>
                      )}
                    </span>
                  </th>
                  <th 
                    className={`sortable ${sortConfig.key === 'description' ? 'active' : ''}`}
                    onClick={() => handleSort('description')}
                  >
                    <span>DESCRIPTION</span>
                    <span className="sort-icon">
                      {sortConfig.key === 'description' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '0.8', gap: '2px' }}>
                          <ArrowUp size={10} style={{ opacity: 0.3 }} />
                          <ArrowDown size={10} style={{ opacity: 0.3 }} />
                        </span>
                      )}
                    </span>
                  </th>
                  <th 
                    className={`sortable ${sortConfig.key === 'qty' ? 'active' : ''}`}
                    onClick={() => handleSort('qty')}
                  >
                    <span>QTY.</span>
                    <span className="sort-icon">
                      {sortConfig.key === 'qty' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '0.8', gap: '2px' }}>
                          <ArrowUp size={10} style={{ opacity: 0.3 }} />
                          <ArrowDown size={10} style={{ opacity: 0.3 }} />
                        </span>
                      )}
                    </span>
                  </th>
                  <th 
                    className={`sortable ${sortConfig.key === 'ts' ? 'active' : ''}`}
                    onClick={() => handleSort('ts')}
                  >
                    <span>TS</span>
                    <span className="sort-icon">
                      {sortConfig.key === 'ts' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '0.8', gap: '2px' }}>
                          <ArrowUp size={10} style={{ opacity: 0.3 }} />
                          <ArrowDown size={10} style={{ opacity: 0.3 }} />
                        </span>
                      )}
                    </span>
                  </th>
                  <th 
                    className={`sortable ${sortConfig.key === 'dl' ? 'active' : ''}`}
                    onClick={() => handleSort('dl')}
                  >
                    <span>DL</span>
                    <span className="sort-icon">
                      {sortConfig.key === 'dl' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '0.8', gap: '2px' }}>
                          <ArrowUp size={10} style={{ opacity: 0.3 }} />
                          <ArrowDown size={10} style={{ opacity: 0.3 }} />
                        </span>
                      )}
                    </span>
                  </th>
                  <th 
                    className={`sortable ${sortConfig.key === 'others' ? 'active' : ''}`}
                    onClick={() => handleSort('others')}
                  >
                    <span>Others</span>
                    <span className="sort-icon">
                      {sortConfig.key === 'others' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '0.8', gap: '2px' }}>
                          <ArrowUp size={10} style={{ opacity: 0.3 }} />
                          <ArrowDown size={10} style={{ opacity: 0.3 }} />
                        </span>
                      )}
                    </span>
                  </th>
                  <th 
                    className={`sortable ${sortConfig.key === 'po_no' ? 'active' : ''}`}
                    onClick={() => handleSort('po_no')}
                  >
                    <span>P.O. NO.</span>
                    <span className="sort-icon">
                      {sortConfig.key === 'po_no' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '0.8', gap: '2px' }}>
                          <ArrowUp size={10} style={{ opacity: 0.3 }} />
                          <ArrowDown size={10} style={{ opacity: 0.3 }} />
                        </span>
                      )}
                    </span>
                  </th>
                  <th 
                    className={`sortable ${sortConfig.key === 'remarks' ? 'active' : ''}`}
                    onClick={() => handleSort('remarks')}
                  >
                    <span>REMARKS</span>
                    <span className="sort-icon">
                      {sortConfig.key === 'remarks' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '0.8', gap: '2px' }}>
                          <ArrowUp size={10} style={{ opacity: 0.3 }} />
                          <ArrowDown size={10} style={{ opacity: 0.3 }} />
                        </span>
                      )}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>
                      {searchTerm ? 'No results found' : 'No P.O data available'}
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, index) => (
                    <tr key={item.id || index}>
                      <td>{item.part_number || ''}</td>
                      <td>{item.brand || ''}</td>
                      <td>{item.description || ''}</td>
                      <td>{item.qty || 0}</td>
                      <td>{item.ts ? formatCurrency(item.ts) : ''}</td>
                      <td>{item.dl ? formatCurrency(item.dl) : ''}</td>
                      <td>{item.others ? `$${formatCurrency(item.others)}` : ''}</td>
                      <td>{item.po_no || ''}</td>
                      <td>{item.remarks || ''}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {showImportModal && (
          <div className="po-modal" onClick={() => setShowImportModal(false)}>
            <div className="po-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="po-modal-header">
                <h2 className="po-modal-title">Import Excel File</h2>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setImportPreview([]);
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <X size={24} />
                </button>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'block',
                    padding: '12px 16px',
                    border: '2px dashed var(--border-color)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    background: 'var(--bg-secondary)',
                    marginBottom: '8px'
                  }}>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                      id="po-file-input"
                      style={{ display: 'none' }}
                    />
                    <span style={{ color: 'var(--text-primary)' }}>
                      {importFile ? `📄 ${importFile.name}` : '📁 Click to select Excel file (.xlsx or .xls)'}
                    </span>
                  </label>
                  {importFile && (
                    <p style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '14px' }}>
                      Selected: {importFile.name} ({(importFile.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                </div>
                {importPreview.length > 0 && (
                  <div>
                    <p style={{ marginBottom: '12px', fontWeight: '600' }}>
                      Preview ({importPreview.length} rows):
                    </p>
                    <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                      <table className="po-table" style={{ fontSize: '14px' }}>
                        <thead>
                          <tr>
                            <th>Part Number</th>
                            <th>Brand</th>
                            <th>Description</th>
                            <th>QTY</th>
                            <th>P.O. NO.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.slice(0, 10).map((item, idx) => (
                            <tr key={idx}>
                              <td>{item.part_number}</td>
                              <td>{item.brand}</td>
                              <td>{item.description}</td>
                              <td>{item.qty}</td>
                              <td>{item.po_no}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {importPreview.length > 10 && (
                        <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>
                          ... and {importPreview.length - 10} more rows
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  className="po-btn po-btn-secondary"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setImportPreview([]);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="po-btn po-btn-primary"
                  onClick={handleImport}
                  disabled={!importPreview.length || loading}
                >
                  {loading ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PO;


import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import './InventoryAudit.css';
import CustomModal from './CustomModal';
import useCustomModal from '../hooks/useCustomModal';
import rateLimitManager from '../utils/rateLimitManager';

const InventoryAudit = () => {
  // Utilities
  const formatDateYmd = (value) => {
    if (!value) return '';
    const s = String(value).replace(/[^0-9]/g, '');
    if (s.length === 8) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
    return value;
  };

  // Custom Modal Hook
  const { modalState, showAlert, showConfirm, closeModal } = useCustomModal();

  // State management
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard, scanning, comparison, report
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [scannedItems, setScannedItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [physicalCount, setPhysicalCount] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [varianceReport, setVarianceReport] = useState(null);
  const [sortOption, setSortOption] = useState('recent'); // recent | id_desc | date_desc | qty_desc
  const [editingPhysicalCount, setEditingPhysicalCount] = useState(null); // { stock_id, value }
  
  // Refs
  const barcodeInputRef = useRef(null);
  const physicalCountRef = useRef(null);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef(null);

  // Load audit sessions on component mount
  useEffect(() => {
    loadAuditSessions();
  }, []);

  // Focus barcode input when scanning starts
  useEffect(() => {
    if (isScanning && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [isScanning]);


  // Load audit sessions
  const loadAuditSessions = async () => {
    if (isFetchingRef.current) return;
    if (!rateLimitManager.canMakeRequest()) {
      const waitTime = rateLimitManager.getTimeUntilCooldownEnds();
      rateLimitManager.queueRequest(() => loadAuditSessions());
      return;
    }
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      isFetchingRef.current = true;
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/audit/sessions', {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortController.signal
      });
      if (abortController.signal.aborted) return;
      rateLimitManager.handleSuccess();
      
      if (response.data.success) {
        setSessions(response.data.sessions);
      }
    } catch (error) {
      if (axios.isCancel(error) || error.name === 'AbortError' || abortController.signal.aborted) return;
      if (error.response?.status === 429) {
        const backoffDelay = rateLimitManager.handle429Error();
        const waitSeconds = Math.ceil(backoffDelay / 1000);
        showAlert(`Rate limit exceeded. Retrying in ${waitSeconds} seconds...`, 'Rate Limit');
        rateLimitManager.queueRequest(() => loadAuditSessions());
        return;
      }
      console.error('Error loading audit sessions:', error);
      showAlert('Failed to load audit sessions', 'Error');
    } finally {
      isFetchingRef.current = false;
      abortControllerRef.current = null;
    }
  };

  // Sorted items for table rendering (only for scanning view)
  const sortedScannedItems = useMemo(() => {
    const arr = [...scannedItems];
    switch (sortOption) {
      case 'id_desc':
        return arr.sort((a, b) => (b.stock_id ?? b.id ?? 0) - (a.stock_id ?? a.id ?? 0));
      case 'date_desc':
        return arr.sort((a, b) => String(b.DATE || '').localeCompare(String(a.DATE || '')));
      case 'qty_desc':
        return arr.sort((a, b) => (b.system_quantity ?? b.QTY ?? 0) - (a.system_quantity ?? a.QTY ?? 0));
      case 'recent':
      default:
        // Most recently scanned first (based on scanned_at timestamp)
        return arr.sort((a, b) => {
          const timeA = new Date(a.scanned_at || 0).getTime();
          const timeB = new Date(b.scanned_at || 0).getTime();
          return timeB - timeA;
        });
    }
  }, [scannedItems, sortOption]);

  // Create new audit session
  const createNewSession = async () => {
    if (!sessionName.trim()) {
      showAlert('Please enter a session name', 'Required Field');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/audit/sessions', {
        session_name: sessionName,
        notes: sessionNotes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const newSession = {
          id: response.data.session_id,
          session_name: sessionName,
          status: 'draft',
          created_at: new Date().toISOString(),
          total_items: 0,
          matched_items: 0,
          discrepancy_items: 0,
          notes: sessionNotes
        };
        
        setSessions([newSession, ...sessions]);
        setCurrentSession(newSession);
        setScannedItems([]); // Clear any old scanned items
        setCurrentView('scanning');
        setSessionName('');
        setSessionNotes('');
        showAlert('New audit session created successfully!', 'Success');
      }
    } catch (error) {
      console.error('Error creating audit session:', error);
      showAlert('Failed to create audit session', 'Error');
    }
  };

  // Load session details
  const loadSessionDetails = async (sessionId) => {
    try {
      // Clear existing items FIRST to prevent duplicates
      setScannedItems([]);
      
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/audit/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        console.log('📥 Loaded session items from API:', response.data.items.length, 'items');
        console.log('📥 Items:', response.data.items);
        
        setCurrentSession(response.data.session);
        setScannedItems(response.data.items);
        setCurrentView('scanning');
      }
    } catch (error) {
      console.error('Error loading session details:', error);
      showAlert('Failed to load session details', 'Error');
    }
  };

  // Search stock items
  const searchStockItems = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/audit/search-stock?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setSearchResults(response.data.items);
      }
    } catch (error) {
      console.error('Error searching stock items:', error);
    }
  };

  // Handle barcode input
  const handleBarcodeInput = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
  };

  // Handle Enter key press - auto scan like Stock page
  const handleBarcodeKeyPress = async (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();
      
      const scannedId = searchQuery.trim();
      
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`/api/audit/search-stock?q=${encodeURIComponent(scannedId)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success && response.data.items.length > 0) {
          // Auto-select first item (exact ID match)
          await selectItem(response.data.items[0]);
        } else {
          await showAlert(`Item not found: ${searchQuery}`, 'Not Found');
          setSearchQuery('');
          if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
          }
        }
      } catch (error) {
        console.error('Error searching item:', error);
        await showAlert('Failed to search item', 'Error');
      }
    }
  };

  // Select item from search results - auto scan and increment count
  const selectItem = async (item) => {
    // Check if this item was already scanned in this session
    const existingItem = scannedItems.find(scanned => 
      scanned.stock_id === item.id || scanned.id === item.id
    );
    
    const newPhysicalCount = existingItem ? existingItem.physical_count + 1 : 1;
    
    console.log('🔍 Scanning item:', item.id, 'Existing:', existingItem ? 'Yes' : 'No', 'New count:', newPhysicalCount);
    
    // Immediately save to database with incremented count
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/audit/scan', {
        session_id: currentSession.id,
        stock_id: item.id,
        physical_count: newPhysicalCount
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        // Update scanned items with new count
        const newItem = {
          ...response.data.item,
          stock_id: item.id, // Ensure stock_id is set
          id: item.id,
          scanned_at: new Date().toISOString()
        };
        
        console.log('✅ Response item:', newItem);
        
        setScannedItems(prev => {
          console.log('📋 Current scanned items:', prev.length, 'items');
          console.log('🔍 Looking for item with id:', item.id);
          
          // Replace if already exists, otherwise add
          const existingIndex = prev.findIndex(scanned => 
            scanned.stock_id === item.id || scanned.id === item.id
          );
          
          if (existingIndex >= 0) {
            console.log('🔄 Updating existing item at index:', existingIndex);
            const updated = [...prev];
            updated[existingIndex] = newItem;
            return updated;
          } else {
            console.log('➕ Adding new item to array');
            return [newItem, ...prev];
          }
        });

        // Clear search
        setSearchQuery('');
        setSearchResults([]);
        
        // Focus barcode input for next scan
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus();
        }
      }
    } catch (error) {
      console.error('Error scanning item:', error);
      showAlert('Failed to scan item', 'Error');
    }
  };

  // Scan item
  const scanItem = async () => {
    if (!selectedItem || !physicalCount) {
      showAlert('Please select an item and enter physical count', 'Required Fields');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/audit/scan', {
        session_id: currentSession.id,
        stock_id: selectedItem.id,
        physical_count: parseInt(physicalCount)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        // Add to scanned items
        const newItem = {
          ...response.data.item,
          id: Date.now(), // Temporary ID for UI
          scanned_at: new Date().toISOString()
        };
        
        setScannedItems(prev => {
          // Replace if already exists, otherwise add
          const existingIndex = prev.findIndex(item => item.stock_id === selectedItem.id);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = newItem;
            return updated;
          } else {
            return [newItem, ...prev];
          }
        });

        // Clear form
        setSelectedItem(null);
        setSearchQuery('');
        setPhysicalCount('');
        setSearchResults([]);
        
        // Focus barcode input for next scan
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus();
        }

		// Silent success; keep scanning flow uninterrupted
      }
    } catch (error) {
      console.error('Error scanning item:', error);
      showAlert('Failed to scan item', 'Error');
    }
  };

  // Complete audit session
  const completeAudit = async () => {
    if (!currentSession) return;

    const confirmed = await showConfirm(
      'Are you sure you want to complete this audit session? This action cannot be undone.',
      'Complete Audit'
    );

    if (confirmed) {
      try {
        const token = localStorage.getItem('token');
        await axios.put(`/api/audit/sessions/${currentSession.id}`, {
          status: 'completed'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Reload sessions
        await loadAuditSessions();
        setCurrentView('dashboard');
        setCurrentSession(null);
        setScannedItems([]);
        await showAlert('Audit session completed successfully!', 'Success');
      } catch (error) {
        console.error('Error completing audit:', error);
        await showAlert('Failed to complete audit session', 'Error');
      }
    }
  };

  // Generate variance report
  const generateVarianceReport = async () => {
    if (!currentSession) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/audit/sessions/${currentSession.id}/report?type=detailed`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setVarianceReport(response.data.report);
        setCurrentView('report');
      }
    } catch (error) {
      console.error('Error generating variance report:', error);
      showAlert('Failed to generate variance report', 'Error');
    }
  };

  // Print variance report (table only)
  const printVarianceReport = () => {
    if (!varianceReport) {
      showAlert('No report data to print. Please generate a report first.', 'No Data');
      return;
    }

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=1000,height=700');
    
    if (!printWindow) {
      showAlert('Please allow popups for this site to enable printing.', 'Popup Blocked');
      return;
    }

    // Prepare data for printing
    const printData = varianceReport.items.map(item => {
      // Extract only the DESC part from the concatenated DESCRIPTION
      let descOnly = item.DESCRIPTION || item.description || 'N/A';
      if (descOnly && descOnly.includes(' - ')) {
        // Format is "BRAND - ALTNO - DESC", get the last part
        const parts = descOnly.split(' - ');
        descOnly = parts[parts.length - 1] || descOnly;
      }
      
      return {
        'ID': item.stock_id || item.id,
        'BENZ': item.BENZ || item.benz_number || 'N/A',
        'BRAND': item.BRAND || item.brand || 'N/A',
        'ALTNO': item.ALTNO || '-',
        'DESCRIPTION': descOnly,
        'DATE': formatDateYmd(item.DATE) || 'N/A',
        'QTY (System)': item.system_quantity || 0,
        'Physical Count': item.physical_count || 0,
        'Variance': item.variance > 0 ? `+${item.variance}` : item.variance.toString()
      };
    });

    // Create HTML content for printing
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Inventory Audit Variance Report - ${currentSession?.session_name}</title>
        <style>
          @page {
            size: letter portrait;
            margin: 0.5in 0.4in;
          }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #333;
            font-size: 10px;
          }
          .header {
            text-align: center;
            margin-bottom: 14px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          .header h1 {
            margin: 0 0 6px 0;
            color: #333;
            font-size: 18px;
            font-weight: bold;
          }
          .header p {
            margin: 0;
            font-size: 11px;
          }
          .summary {
            margin-bottom: 14px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 4px;
          }
          .summary h3 {
            margin: 0 0 8px 0;
            color: #333;
            font-size: 12px;
            font-weight: bold;
          }
          .summary-stats {
            display: flex;
            justify-content: space-around;
            flex-wrap: wrap;
            gap: 6px;
          }
          .summary-stat {
            text-align: center;
            margin: 3px;
          }
          .summary-stat .label {
            font-weight: bold;
            color: #666;
            font-size: 10px;
          }
          .summary-stat .value {
            font-size: 14px;
            font-weight: bold;
            margin-top: 3px;
          }
          .summary-stat .value.matched { color: #28a745; }
          .summary-stat .value.discrepancy { color: #dc3545; }
          .summary-stat .value.positive { color: #28a745; }
          .summary-stat .value.negative { color: #dc3545; }
          .summary-stat .value.zero { color: #6c757d; }
          h3 {
            font-size: 12px;
            margin: 10px 0 6px 0;
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            font-size: 9px;
          }
          th, td {
            border: 1px solid #ccc;
            padding: 4px 5px;
            text-align: left;
            line-height: 1.3;
          }
          th {
            background-color: #e9ecef;
            font-weight: bold;
            color: #333;
            font-size: 9px;
          }
          /* Make number columns smaller */
          th:nth-child(7), td:nth-child(7),  /* QTY (System) */
          th:nth-child(8), td:nth-child(8),  /* Physical Count */
          th:nth-child(9), td:nth-child(9) { /* Variance */
            width: 50px;
            text-align: center;
            padding: 4px 3px;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          tr.discrepancy {
            background-color: #ffeaea !important;
          }
          tr.matched {
            background-color: #e8f5e9 !important;
          }
          .variance-positive { color: #28a745; font-weight: bold; }
          .variance-negative { color: #dc3545; font-weight: bold; }
          .variance-zero { color: #6c757d; }
          .print-date {
            text-align: right;
            margin-top: 12px;
            color: #666;
            font-size: 9px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Inventory Audit Variance Report</h1>
          <p><strong>Session:</strong> ${currentSession?.session_name}</p>
        </div>
        
        <div class="summary">
          <h3>Summary</h3>
          <div class="summary-stats">
            <div class="summary-stat">
              <div class="label">Total Items</div>
              <div class="value">${varianceReport.summary.total_items}</div>
            </div>
            <div class="summary-stat">
              <div class="label">Matched Items</div>
              <div class="value matched">${varianceReport.summary.matched_items}</div>
            </div>
            <div class="summary-stat">
              <div class="label">Discrepancy Items</div>
              <div class="value discrepancy">${varianceReport.summary.discrepancy_items}</div>
            </div>
            <div class="summary-stat">
              <div class="label">Total Variance</div>
              <div class="value ${varianceReport.summary.total_variance > 0 ? 'positive' : varianceReport.summary.total_variance < 0 ? 'negative' : 'zero'}">
                ${varianceReport.summary.total_variance > 0 ? '+' : ''}${varianceReport.summary.total_variance}
              </div>
            </div>
          </div>
        </div>

        <h3>Discrepancy Items</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>BENZ</th>
              <th>BRAND</th>
              <th>ALTNO</th>
              <th>DESCRIPTION</th>
              <th>DATE</th>
              <th>QTY (System)</th>
              <th>Physical Count</th>
              <th>Variance</th>
            </tr>
          </thead>
          <tbody>
            ${printData.map(item => `
              <tr class="discrepancy">
                <td>${item['ID']}</td>
                <td>${item['BENZ']}</td>
                <td>${item['BRAND']}</td>
                <td>${item['ALTNO']}</td>
                <td>${item['DESCRIPTION']}</td>
                <td>${item['DATE']}</td>
                <td>${item['QTY (System)']}</td>
                <td>${item['Physical Count']}</td>
                <td class="variance-${item['Variance'].startsWith('+') ? 'positive' : item['Variance'].startsWith('-') ? 'negative' : 'zero'}">
                  ${item['Variance']}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="print-date">
          Printed on: ${new Date().toLocaleString()}
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
      
      // Close window after printing
      setTimeout(() => {
        printWindow.close();
      }, 1000);
    }, 500);
    
    console.log('✅ Variance report printed successfully');
  };

  // Resume audit session
  const resumeAudit = (session) => {
    setCurrentSession(session);
    loadSessionDetails(session.id);
  };

  // Delete audit session
  const deleteSession = async (sessionId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this audit session? This action cannot be undone.',
      'Delete Session'
    );

    if (confirmed) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`/api/audit/sessions/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        await loadAuditSessions();
        await showAlert('Audit session deleted successfully', 'Success');
      } catch (error) {
        console.error('Error deleting session:', error);
        await showAlert('Failed to delete audit session', 'Error');
      }
    }
  };

  // Handle physical count edit
  const handlePhysicalCountClick = (item) => {
    setEditingPhysicalCount({ stock_id: item.stock_id, value: item.physical_count.toString() });
  };

  const handlePhysicalCountChange = (e) => {
    setEditingPhysicalCount(prev => ({ ...prev, value: e.target.value }));
  };

  const handlePhysicalCountSave = async () => {
    if (!editingPhysicalCount) return;

    const newCount = parseInt(editingPhysicalCount.value);
    if (isNaN(newCount) || newCount < 0) {
      await showAlert('Please enter a valid positive number', 'Invalid Input');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/audit/scan', {
        session_id: currentSession.id,
        stock_id: editingPhysicalCount.stock_id,
        physical_count: newCount
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        // Update scanned items
        setScannedItems(prev => prev.map(item => 
          item.stock_id === editingPhysicalCount.stock_id 
            ? { ...item, ...response.data.item }
            : item
        ));
        setEditingPhysicalCount(null);
      }
    } catch (error) {
      console.error('Error updating physical count:', error);
      await showAlert('Failed to update physical count', 'Error');
    }
  };

  const handlePhysicalCountCancel = () => {
    setEditingPhysicalCount(null);
  };

  const handlePhysicalCountKeyPress = (e) => {
    if (e.key === 'Enter') {
      handlePhysicalCountSave();
    } else if (e.key === 'Escape') {
      handlePhysicalCountCancel();
    }
  };

  // Render dashboard view
  const renderDashboard = () => (
    <div className="audit-dashboard">
      <div className="audit-header">
        <h2>Inventory Audit</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setCurrentView('create-session')}
        >
          New Audit Session
        </button>
      </div>

      <div className="sessions-grid">
        {sessions.map(session => (
          <div key={session.id} className="session-card">
            <div className="session-header">
              <h3>{session.session_name}</h3>
              <span className={`status-badge ${session.status}`}>
                {session.status}
              </span>
            </div>
            
            <div className="session-stats">
              <div className="stat">
                <span className="label">Total Items:</span>
                <span className="value">{session.total_items || 0}</span>
              </div>
              <div className="stat">
                <span className="label">Matched:</span>
                <span className="value matched">{session.matched_items || 0}</span>
              </div>
              <div className="stat">
                <span className="label">Discrepancies:</span>
                <span className="value discrepancy">{session.discrepancy_items || 0}</span>
              </div>
            </div>

            <div className="session-actions">
              {session.status === 'draft' ? (
                <button 
                  className="btn btn-secondary"
                  onClick={() => resumeAudit(session)}
                >
                  Resume
                </button>
              ) : (
                <button 
                  className="btn btn-info"
                  onClick={() => {
                    setCurrentSession(session);
                    loadSessionDetails(session.id);
                    generateVarianceReport();
                  }}
                >
                  View Report
                </button>
              )}
              
              <button 
                className="btn btn-danger"
                onClick={() => deleteSession(session.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render create session view
  const renderCreateSession = () => (
    <div className="create-session">
      <div className="create-session-header">
        <h2>Create New Audit Session</h2>
        <button 
          className="btn btn-secondary"
          onClick={() => setCurrentView('dashboard')}
        >
          Back to Dashboard
        </button>
      </div>

      <div className="create-session-form">
        <div className="form-group">
          <label>Session Name *</label>
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="Enter session name (e.g., 'Monthly Stock Audit')"
            className="form-control"
          />
        </div>

        <div className="form-group">
          <label>Notes</label>
          <textarea
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            placeholder="Optional notes for this audit session"
            className="form-control"
            rows="3"
          />
        </div>

        <div className="form-actions">
          <button 
            className="btn btn-primary"
            onClick={createNewSession}
          >
            Start Audit Session
          </button>
        </div>
      </div>
    </div>
  );

  // Render scanning view
  const renderScanning = () => (
    <div className="audit-scanning">
      <div className="scanning-header">
        <h2>Scanning Items - {currentSession?.session_name}</h2>
        <div className="barcode-input-container">
          <input
            ref={barcodeInputRef}
            type="text"
            value={searchQuery}
            onChange={handleBarcodeInput}
            onKeyPress={handleBarcodeKeyPress}
            placeholder="Scan ID"
            className="form-control barcode-input-header"
            autoFocus
          />
        </div>
        <div className="scanning-sort">
          <select className="form-control" value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
            <option value="recent">Recently Scanned First</option>
            <option value="id_desc">ID: High → Low</option>
            <option value="date_desc">Date: Recent → Oldest</option>
            <option value="qty_desc">QTY: Highest → Lowest</option>
          </select>
        </div>
        <div className="scanning-actions">
          <button 
            className="btn btn-info"
            onClick={() => setCurrentView('comparison')}
          >
            View Comparison
          </button>
          <button 
            className="btn btn-success"
            onClick={completeAudit}
          >
            Complete Audit
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => {
              setCurrentView('dashboard');
              setScannedItems([]);
              setCurrentSession(null);
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="scanned-items-full">
          <h3>{currentSession?.session_name}</h3>
          <div className="scanned-items-table">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>BENZ</th>
                  <th>BRAND</th>
                  <th>ALTNO</th>
                  <th>DESCRIPTION</th>
                  <th>DATE</th>
                  <th>QTY (System)</th>
                  <th>Physical Count</th>
                </tr>
              </thead>
              <tbody>
                {sortedScannedItems.map((item, index) => (
                  <tr 
                    key={item.stock_id || index} 
                    className={item.variance === 0 ? 'row-matched' : 'row-discrepancy'}
                  >
                    <td>{item.stock_id || item.id}</td>
                    <td>{item.BENZ}</td>
                    <td>{item.BRAND}</td>
                    <td>{item.ALTNO || '-'}</td>
                    <td>{item.DESCRIPTION}</td>
                    <td>{formatDateYmd(item.DATE)}</td>
                    <td>{item.system_quantity || item.QTY}</td>
                    <td className="physical-count-cell">
                      {editingPhysicalCount && editingPhysicalCount.stock_id === item.stock_id ? (
                        <input
                          type="number"
                          className="physical-count-input"
                          value={editingPhysicalCount.value}
                          onChange={handlePhysicalCountChange}
                          onKeyDown={handlePhysicalCountKeyPress}
                          onBlur={handlePhysicalCountSave}
                          autoFocus
                          min="0"
                        />
                      ) : (
                        <span 
                          className={`count-badge ${item.variance === 0 ? 'matched' : 'discrepancy'} editable`}
                          onClick={() => handlePhysicalCountClick(item)}
                          title="Click to edit"
                        >
                          {item.physical_count}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  );

  // Render comparison view
  const renderComparison = () => (
    <div className="audit-comparison">
      <div className="comparison-header">
        <h2>Audit Comparison - {currentSession?.session_name}</h2>
        <div className="comparison-actions">
          <button 
            className="btn btn-primary"
            onClick={() => setCurrentView('scanning')}
          >
            Continue Scanning
          </button>
          <button 
            className="btn btn-success"
            onClick={generateVarianceReport}
          >
            Generate Report
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => {
              setCurrentView('dashboard');
              setScannedItems([]);
              setCurrentSession(null);
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="comparison-content">
        <div className="comparison-stats">
          <div className="stat-card">
            <h3>Total Items</h3>
            <span className="stat-value">{scannedItems.length}</span>
          </div>
          <div className="stat-card matched">
            <h3>Matched</h3>
            <span className="stat-value">{scannedItems.filter(item => item.variance === 0).length}</span>
          </div>
          <div className="stat-card discrepancy">
            <h3>Discrepancies</h3>
            <span className="stat-value">{scannedItems.filter(item => item.variance !== 0).length}</span>
          </div>
        </div>

        <div className="comparison-table">
          <table className="audit-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>BENZ</th>
                <th>BRAND</th>
                <th>ALTNO</th>
                <th>DESCRIPTION</th>
                <th>DATE</th>
                <th>QTY (System)</th>
                <th>Physical Count</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedScannedItems.map((item, index) => (
                <tr 
                  key={item.stock_id || index}
                  className={item.variance === 0 ? 'row-matched' : 'row-discrepancy'}
                >
                  <td>{item.stock_id || item.id}</td>
                  <td>{item.BENZ}</td>
                  <td>{item.BRAND}</td>
                  <td>{item.ALTNO || '-'}</td>
                  <td>{item.DESCRIPTION}</td>
                  <td>{formatDateYmd(item.DATE)}</td>
                  <td>{item.system_quantity || item.QTY}</td>
                  <td className="physical-count-cell">
                    {editingPhysicalCount && editingPhysicalCount.stock_id === item.stock_id ? (
                      <input
                        type="number"
                        className="physical-count-input"
                        value={editingPhysicalCount.value}
                        onChange={handlePhysicalCountChange}
                        onKeyDown={handlePhysicalCountKeyPress}
                        onBlur={handlePhysicalCountSave}
                        autoFocus
                        min="0"
                      />
                    ) : (
                      <span 
                        className={`count-badge ${item.variance === 0 ? 'matched' : 'discrepancy'} editable`}
                        onClick={() => handlePhysicalCountClick(item)}
                        title="Click to edit"
                      >
                        {item.physical_count}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`status ${item.variance === 0 ? 'matched' : 'discrepancy'}`}>
                      {item.variance === 0 ? 'Matched' : 'Discrepancy'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Render report view
  const renderReport = () => (
    <div className="audit-report">
      <div className="report-header">
        <h2>Variance Report - {currentSession?.session_name}</h2>
        <div className="report-actions">
          <button 
            className="btn btn-info"
            onClick={printVarianceReport}
          >
            Print Report
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => setCurrentView('scanning')}
          >
            Back to Scanning
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => {
              setCurrentView('dashboard');
              setScannedItems([]);
              setCurrentSession(null);
              setVarianceReport(null);
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {varianceReport && (
        <div className="report-content">
          <div className="report-summary">
            <h3>Summary</h3>
            <div className="summary-stats">
              <div className="summary-stat">
                <span className="label">Total Items:</span>
                <span className="value">{varianceReport.summary.total_items}</span>
              </div>
              <div className="summary-stat">
                <span className="label">Matched Items:</span>
                <span className="value matched">{varianceReport.summary.matched_items}</span>
              </div>
              <div className="summary-stat">
                <span className="label">Discrepancy Items:</span>
                <span className="value discrepancy">{varianceReport.summary.discrepancy_items}</span>
              </div>
              <div className="summary-stat">
                <span className="label">Total Variance:</span>
                <span className={`value ${varianceReport.summary.total_variance > 0 ? 'positive' : varianceReport.summary.total_variance < 0 ? 'negative' : 'zero'}`}>
                  {varianceReport.summary.total_variance > 0 ? '+' : ''}{varianceReport.summary.total_variance}
                </span>
              </div>
            </div>
          </div>

          <div className="report-items">
            <h3>Discrepancy Items</h3>
            <div className="discrepancy-table">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>BENZ</th>
                    <th>BRAND</th>
                    <th>ALTNO</th>
                    <th>DESCRIPTION</th>
                    <th>DATE</th>
                    <th>QTY (System)</th>
                    <th>Physical Count</th>
                  </tr>
                </thead>
                <tbody>
                  {varianceReport.items.map((item, index) => (
                    <tr 
                      key={item.id || index}
                      className={item.variance === 0 ? 'row-matched' : 'row-discrepancy'}
                    >
                      <td>{item.stock_id || item.id}</td>
                      <td>{item.BENZ || item.benz_number}</td>
                      <td>{item.BRAND || item.brand}</td>
                      <td>{item.ALTNO || '-'}</td>
                      <td>{item.DESCRIPTION || item.description}</td>
                      <td>{formatDateYmd(item.DATE)}</td>
                      <td>{item.system_quantity}</td>
                      <td className="physical-count-cell">
                        <span className={`count-badge ${item.variance === 0 ? 'matched' : 'discrepancy'}`}>
                          {item.physical_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="inventory-audit">
      {currentView === 'dashboard' && renderDashboard()}
      {currentView === 'create-session' && renderCreateSession()}
      {currentView === 'scanning' && renderScanning()}
      {currentView === 'comparison' && renderComparison()}
      {currentView === 'report' && renderReport()}

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

export default InventoryAudit;


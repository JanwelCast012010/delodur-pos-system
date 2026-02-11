import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import rateLimitManager from '../utils/rateLimitManager';
import { useNavigate } from 'react-router-dom';
import { 
  RotateCcw, 
  Printer, 
  RefreshCw, 
  Search, 
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  Calendar,
  DollarSign,
  Package,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import useCustomModal from '../hooks/useCustomModal';
import CustomModal from './CustomModal';

const Refunds = () => {
  const navigate = useNavigate();
  const { modalState, showAlert, showConfirm, closeModal } = useCustomModal();
  
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedRefunds, setExpandedRefunds] = useState(new Set());
  const [selectedRefunds, setSelectedRefunds] = useState(new Set());
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef(null);
  
  // Fetch refunds
  const fetchRefunds = async () => {
    if (isFetchingRef.current) return;
    if (!rateLimitManager.canMakeRequest()) {
      const waitTime = rateLimitManager.getTimeUntilCooldownEnds();
      rateLimitManager.queueRequest(() => fetchRefunds());
      return;
    }
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      isFetchingRef.current = true;
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/sales/refunds', {
        params: {
          status: statusFilter !== 'all' ? statusFilter : undefined,
          page: currentPage,
          limit: itemsPerPage,
          search: searchTerm || undefined
        },
        headers: { Authorization: `Bearer ${token}` },
        signal: abortController.signal
      });
      if (abortController.signal.aborted) return;
      rateLimitManager.handleSuccess();
      
      if (response.data.success) {
        setRefunds(response.data.data);
        setTotalPages(response.data.pagination.pages);
        setTotalRecords(response.data.pagination.total);
      }
    } catch (err) {
      if (axios.isCancel(err) || err.name === 'AbortError' || abortController.signal.aborted) return;
      if (err.response?.status === 429) {
        const backoffDelay = rateLimitManager.handle429Error();
        const waitSeconds = Math.ceil(backoffDelay / 1000);
        setError(`Rate limit exceeded. Retrying in ${waitSeconds} seconds...`);
        rateLimitManager.queueRequest(() => fetchRefunds());
        return;
      }
      console.error('Error fetching refunds:', err);
      setError('Failed to fetch refunds.');
      await showAlert('Failed to fetch refunds. Please try again.', 'Error');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      abortControllerRef.current = null;
    }
  };
  
  useEffect(() => {
    fetchRefunds();
  }, [currentPage, statusFilter]);
  
  const toggleRefundExpansion = (refundId) => {
    setExpandedRefunds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(refundId)) {
        newSet.delete(refundId);
      } else {
        newSet.add(refundId);
      }
      return newSet;
    });
  };
  
  const handleSelectRefund = (refundId) => {
    setSelectedRefunds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(refundId)) {
        newSet.delete(refundId);
      } else {
        newSet.add(refundId);
      }
      return newSet;
    });
  };
  
  const handleSelectAll = () => {
    if (selectedRefunds.size === refunds.length) {
      setSelectedRefunds(new Set());
    } else {
      setSelectedRefunds(new Set(refunds.map(r => r.id)));
    }
  };
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  const getStatusColor = (status) => {
    // Check if light mode
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    
    switch (status) {
      case 'CONFIRMED':
        return { 
          bg: isLight ? 'rgba(40, 167, 69, 0.15)' : 'rgba(40, 167, 69, 0.2)', 
          border: '#28a745', 
          color: '#28a745' 
        };
      case 'PENDING':
        return { 
          bg: isLight ? 'rgba(255, 193, 7, 0.15)' : 'rgba(255, 193, 7, 0.2)', 
          border: '#ffc107', 
          color: '#ffc107' 
        };
      case 'CANCELLED':
        return { 
          bg: isLight ? 'rgba(220, 53, 69, 0.15)' : 'rgba(220, 53, 69, 0.2)', 
          border: '#dc3545', 
          color: '#dc3545' 
        };
      default:
        return { 
          bg: isLight ? 'rgba(108, 117, 125, 0.15)' : 'rgba(108, 117, 125, 0.2)', 
          border: '#6c757d', 
          color: '#6c757d' 
        };
    }
  };
  
  const getStatusIcon = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return <CheckCircle size={16} />;
      case 'PENDING':
        return <AlertCircle size={16} />;
      case 'CANCELLED':
        return <XCircle size={16} />;
      default:
        return null;
    }
  };
  
  const handleConfirmRefund = async (refundId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`/api/sales/refunds/${refundId}/confirm`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        await showAlert('Refund confirmed successfully! Items returned to stock.', 'Success');
        await fetchRefunds(); // Refresh the list
        // Trigger a refresh of sales history if on that page
        window.dispatchEvent(new CustomEvent('refreshSalesHistory'));
      }
    } catch (error) {
      console.error('Error confirming refund:', error);
      await showAlert(
        error.response?.data?.message || 'Failed to confirm refund. Please try again.',
        'Error'
      );
    }
  };
  
  const handleCancelRefund = async (refundId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`/api/sales/refunds/${refundId}/cancel`, {
        reason: 'Cancelled by user'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        await showAlert('Refund cancelled successfully.', 'Success');
        await fetchRefunds(); // Refresh the list
        // Trigger a refresh of sales history if on that page
        window.dispatchEvent(new CustomEvent('refreshSalesHistory'));
      }
    } catch (error) {
      console.error('Error cancelling refund:', error);
      await showAlert(
        error.response?.data?.message || 'Failed to cancel refund. Please try again.',
        'Error'
      );
    }
  };
  
  const handlePrintRefund = async (refund) => {
    try {
      const printWindow = window.open('', '_blank', 'width=600,height=800');
      if (!printWindow) {
        await showAlert('Please allow popups to print.', 'Error');
        return;
      }
      const refundNumber = refund.cm_number || 'N/A';
      const customerName = refund.customer_name || 'N/A';
      const formattedDate = refund.refund_date
        ? (() => {
            const d = new Date(refund.refund_date);
            return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
          })()
        : 'N/A';
      const receiptNumber = refund.receipt_number || 'N/A';
      const totalAmount = -Math.abs(parseFloat(refund.total_amount) || 0);

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Credit Memo - ${refundNumber}</title>
          <meta charset="UTF-8">
          <style>
            @media print {
              @page { size: 8.5in 11in; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              body { margin: 0; padding: 0; width: 8.5in; max-width: 8.5in; height: 11in; display: flex; justify-content: center; align-items: flex-start; }
              .no-print { display: none !important; }
              * { font-family: 'Courier New', 'Lucida Console', 'Consolas', monospace !important; font-weight: bold !important; }
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: 'Courier New', 'Lucida Console', 'Consolas', monospace;
              font-size: 13pt;
              font-weight: bold;
              line-height: 1.4;
              color: #000;
              background: white;
              padding: 0;
              margin: 0;
              width: 8.5in;
              max-width: 8.5in;
              min-height: 11in;
              display: flex;
              justify-content: center;
              align-items: flex-start;
            }
            .receipt {
              width: 8.3in;
              max-width: 8.3in;
              margin: 0 auto;
              padding: 8px;
              display: flex;
              flex-direction: column;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 8px 0;
              border: none;
              table-layout: fixed;
              font-size: 11pt;
              font-weight: bold;
            }
            .items-table th {
              border-top: 2px solid #000;
              border-bottom: 2px solid #000;
              padding: 6px 4px;
              text-align: left;
              font-size: 10pt;
              font-weight: bold;
              text-transform: uppercase;
            }
            .items-table td {
              border-bottom: 1px solid #000;
              padding: 5px 4px;
              font-size: 11pt;
              font-weight: bold;
              word-wrap: break-word;
              overflow-wrap: break-word;
              line-height: 1.3;
            }
            .items-table tbody tr:last-child td { border-bottom: 2px solid #000; }
            .col-brand { width: 15%; }
            .col-desc { width: 45%; }
            .col-qty { width: 8%; text-align: center; }
            .col-price { width: 16%; text-align: right; }
            .col-amount { width: 16%; text-align: right; }
            .total-section { margin-top: 10px; padding-top: 6px; border-top: 2px solid #000; }
            .total-line { display: block; text-align: right; font-size: 13pt; font-weight: bold; margin: 6px 0; width: 100%; padding: 4px 0; }
            .total-label { float: left; }
            .total-value { float: right; }
            .footer { margin-top: 10px; padding-top: 6px; clear: both; }
            .footer-text { font-size: 11pt; font-weight: bold; margin-bottom: 8px; }
            .refund-info { margin-top: 8px; padding-top: 6px; border-top: 1px solid #000; font-size: 10pt; }
            .refund-info-line { margin-bottom: 4px; font-weight: bold; }
            .print-instructions { font-size: 9pt; color: #666; margin-top: 10px; padding: 8px; background: #f0f0f0; border: 1px solid #ccc; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div style="text-align: center; margin-bottom: 12px;">
              <div style="font-size: 16pt; font-weight: bold; margin-bottom: 8px;">CREDIT MEMO</div>
            </div>
            <div style="margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: bold;">
                <div>CUSTOMER: ${customerName}</div>
                <div>DATE: ${formattedDate}</div>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: bold;">
                <div>CM#: ${refundNumber}</div>
                <div>RECEIPT: ${receiptNumber}</div>
              </div>
              ${refund.invoice_number ? `<div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: bold;"><div>INVOICE: ${refund.invoice_number}</div><div></div></div>` : ''}
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
                ${(refund.items || []).map((item) => {
                  const brand = item.brand || 'N/A';
                  const description = (item.benz || item.idcode || item.description || 'N/A').toString().substring(0, 50);
                  const qty = item.quantity || 0;
                  const unitPrice = parseFloat(item.unit_price || 0);
                  const amount = -Math.abs(parseFloat(item.amount || 0));
                  const displayPrice = unitPrice;
                  return `<tr>
                    <td class="col-brand">${brand}</td>
                    <td class="col-desc">${description}</td>
                    <td class="col-qty">${qty}</td>
                    <td class="col-price">${displayPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td class="col-amount">${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>`;
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
            ${refund.reason ? `<div class="refund-info"><div class="refund-info-line">REASON FOR RETURN: ${refund.reason}</div></div>` : ''}
            ${refund.notes ? `<div class="refund-info"><div class="refund-info-line">NOTES: ${refund.notes}</div></div>` : ''}
            <div class="footer">
              <div class="footer-text">ITEMS RECEIVE IN GOOD CONDITION:_____________________________________</div>
            </div>
          </div>
          <div class="no-print">
            <div class="print-instructions">
              <strong>Print settings (receipt style):</strong> Paper Letter 8.5" × 11" portrait, scale 100%, margins minimum. Content area 8.3" × 5.5" at top center.
            </div>
            <div style="margin-top: 20px; text-align: center;">
              <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">Print Credit Memo</button>
              <button onclick="window.close()" style="padding: 10px 20px; font-size: 14px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
            </div>
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(printContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);
    } catch (error) {
      console.error('Print error:', error);
      await showAlert('Failed to print refund form.', 'Error');
    }
  };
  
  const handlePrintSelected = async () => {
    if (selectedRefunds.size === 0) {
      await showAlert('Please select at least one refund to print.', 'No Selection');
      return;
    }
    
    const refundsToPrint = refunds.filter(r => selectedRefunds.has(r.id));
    
    for (const refund of refundsToPrint) {
      await handlePrintRefund(refund);
      // Small delay between prints
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    await showAlert(`Printed ${refundsToPrint.length} refund form(s).`, 'Success');
  };
  
  const filteredRefunds = refunds.filter(refund => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        refund.cm_number?.toLowerCase().includes(search) ||
        refund.customer_name?.toLowerCase().includes(search) ||
        refund.receipt_number?.toLowerCase().includes(search) ||
        refund.reason?.toLowerCase().includes(search)
      );
    }
    return true;
  });
  
  return (
    <div style={{
      padding: '24px',
      background: 'transparent',
      minHeight: '100vh',
      color: 'var(--text-primary)'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{
            margin: '0 0 8px 0',
            fontSize: '28px',
            fontWeight: '700',
            color: 'var(--text-primary)'
          }}>
            Refunds Management
          </h1>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: 'var(--text-muted)'
          }}>
            View and manage all refund requests grouped by CM#
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => navigate('/sales-history')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--hover-bg)';
              e.currentTarget.style.borderColor = 'var(--text-muted)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-secondary)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <RotateCcw size={16} />
            Back to Sales History
          </button>
          
          <button
            onClick={fetchRefunds}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: loading ? 'var(--bg-secondary)' : '#007bff',
              border: '1px solid #007bff',
              borderRadius: '8px',
              color: loading ? '#007bff' : '#ffffff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              opacity: loading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#0056b3';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#007bff';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            <RefreshCw size={16} style={{ 
              animation: loading ? 'spin 1s linear infinite' : 'none' 
            }} />
            Refresh
          </button>
          
          <button
            onClick={handlePrintSelected}
            disabled={selectedRefunds.size === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: selectedRefunds.size === 0 
                ? 'var(--bg-secondary)' 
                : '#dc3545',
              border: '1px solid #dc3545',
              borderRadius: '8px',
              color: selectedRefunds.size === 0 ? 'var(--text-muted)' : '#ffffff',
              cursor: selectedRefunds.size === 0 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: selectedRefunds.size === 0 ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (selectedRefunds.size > 0) {
                e.currentTarget.style.background = '#c82333';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedRefunds.size > 0) {
                e.currentTarget.style.background = '#dc3545';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            <Printer size={16} />
            Print Selected ({selectedRefunds.size})
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 2px 8px var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
            <Search 
              size={20} 
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none'
              }}
            />
            <input
              type="text"
              placeholder="Search by CM#, customer, receipt..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 44px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#007bff';
                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0, 123, 255, 0.15)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: '10px 12px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
              cursor: 'pointer',
              minWidth: '150px',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#007bff';
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0, 123, 255, 0.15)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <option value="all">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{
              padding: '10px 12px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#007bff';
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0, 123, 255, 0.15)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>
      
      {/* Refunds List */}
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        boxShadow: '0 2px 8px var(--shadow-sm)'
      }}>
        {loading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '60px',
            color: 'var(--text-muted)'
          }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginRight: '12px' }} />
            Loading refunds...
          </div>
        ) : filteredRefunds.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '60px',
            color: 'var(--text-muted)',
            textAlign: 'center'
          }}>
            <Package size={48} style={{ marginBottom: '16px', opacity: 0.5, color: 'var(--text-muted)' }} />
            <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>No refunds found</h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your filters' 
                : 'No refund requests recorded yet'}
            </p>
          </div>
        ) : (
          <div>
            {filteredRefunds.map((refund) => {
              const isExpanded = expandedRefunds.has(refund.id);
              const statusColors = getStatusColor(refund.status);
              const StatusIcon = getStatusIcon(refund.status);
              
              return (
                <div
                  key={refund.id}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    background: isExpanded ? 'var(--bg-secondary)' : 'transparent',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!isExpanded) {
                      e.currentTarget.style.background = 'var(--hover-bg)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isExpanded) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  {/* Refund Header */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 1fr 200px 150px 120px 150px auto',
                      gap: '12px',
                      padding: '16px 20px',
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}
                    onClick={() => toggleRefundExpansion(refund.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedRefunds.has(refund.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectRefund(refund.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          cursor: 'pointer',
                          width: '18px',
                          height: '18px'
                        }}
                      />
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isExpanded ? 
                        <ChevronUp size={16} style={{ color: '#007bff' }} /> : 
                        <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
                      }
                      <div>
                        <div style={{
                          fontFamily: 'monospace',
                          color: '#007bff',
                          fontWeight: '600',
                          fontSize: '16px'
                        }}>
                          {refund.cm_number}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          marginTop: '2px'
                        }}>
                          {refund.items_count} item(s)
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500' }}>
                      {refund.customer_name || 'N/A'}
                    </div>
                    
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {formatDate(refund.refund_date)}
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      background: statusColors.bg,
                      border: `1px solid ${statusColors.border}`,
                      borderRadius: '6px',
                      color: statusColors.color,
                      fontSize: '12px',
                      fontWeight: '600',
                      justifyContent: 'center'
                    }}>
                      {StatusIcon}
                      {refund.status}
                    </div>
                    
                    <div style={{
                      fontFamily: 'monospace',
                      color: '#28a745',
                      fontWeight: '600',
                      fontSize: '14px',
                      textAlign: 'right'
                    }}>
                      {formatCurrency(refund.total_amount)}
                    </div>
                    
                    <div style={{ 
                      display: 'flex', 
                      gap: '6px', 
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      flexWrap: 'nowrap',
                      whiteSpace: 'nowrap'
                    }}>
                      {refund.status === 'PENDING' && (
                        <>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const confirmed = await showConfirm(
                                `Are you sure you want to confirm this refund?\n\nThis will:\n- Return items to stock\n- Mark refund as confirmed\n- Update sales history with negative values`,
                                'Confirm Refund'
                              );
                              if (confirmed) {
                                await handleConfirmRefund(refund.id);
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 10px',
                              background: '#28a745',
                              border: '1px solid #28a745',
                              borderRadius: '6px',
                              color: '#ffffff',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: '500',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#218838';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#28a745';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            <CheckCircle size={12} />
                            <span>Confirm</span>
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const confirmed = await showConfirm(
                                `Are you sure you want to cancel this refund?`,
                                'Cancel Refund'
                              );
                              if (confirmed) {
                                await handleCancelRefund(refund.id);
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 10px',
                              background: '#dc3545',
                              border: '1px solid #dc3545',
                              borderRadius: '6px',
                              color: '#ffffff',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: '500',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#c82333';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#dc3545';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            <XCircle size={12} />
                            <span>Cancel</span>
                          </button>
                        </>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrintRefund(refund);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 10px',
                          background: '#dc3545',
                          border: '1px solid #dc3545',
                          borderRadius: '6px',
                          color: '#ffffff',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '500',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#c82333';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#dc3545';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <Printer size={12} />
                        <span>Print</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Expanded Items */}
                  {isExpanded && (
                    <div style={{
                      padding: '20px',
                      background: 'var(--bg-tertiary)',
                      borderTop: '1px solid var(--border-color)'
                    }}>
                      <div style={{ marginBottom: '16px' }}>
                        <h4 style={{
                          margin: '0 0 12px 0',
                          color: '#007bff',
                          fontSize: '14px',
                          fontWeight: '600'
                        }}>
                          Refund Details
                        </h4>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '16px',
                          color: 'var(--text-secondary)',
                          fontSize: '13px'
                        }}>
                          <div>
                            <strong>Reason:</strong> <span style={{ color: 'var(--text-primary)' }}>{refund.reason || 'N/A'}</span>
                          </div>
                          {refund.notes && (
                            <div>
                              <strong>Notes:</strong> <span style={{ color: 'var(--text-primary)' }}>{refund.notes}</span>
                            </div>
                          )}
                          <div>
                            <strong>Receipt:</strong> <span style={{ color: 'var(--text-primary)' }}>{refund.receipt_number || 'N/A'}</span>
                          </div>
                          <div>
                            <strong>Invoice:</strong> <span style={{ color: 'var(--text-primary)' }}>{refund.invoice_number || 'N/A'}</span>
                          </div>
                          <div>
                            <strong>Created By:</strong> <span style={{ color: 'var(--text-primary)' }}>{refund.created_by || 'N/A'}</span>
                          </div>
                          {refund.confirmed_by && (
                            <div>
                              <strong>Confirmed By:</strong> <span style={{ color: '#28a745', fontWeight: '600' }}>{refund.confirmed_by}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h4 style={{
                          margin: '0 0 12px 0',
                          color: '#28a745',
                          fontSize: '14px',
                          fontWeight: '600'
                        }}>
                          Refunded Items ({refund.items.length})
                        </h4>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                          gap: '12px'
                        }}>
                          {refund.items.map((item, idx) => (
                            <div
                              key={idx}
                              style={{
                                padding: '12px',
                                background: 'var(--card-bg)',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                boxShadow: '0 1px 3px var(--shadow-sm)'
                              }}
                            >
                              <div style={{ color: 'var(--text-primary)', fontWeight: '500', marginBottom: '8px' }}>
                                {item.brand || 'N/A'} - {item.benz || 'N/A'}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                                <div><strong>ID Code:</strong> {item.idcode || 'N/A'}</div>
                                <div><strong>OEM:</strong> {item.altno || 'N/A'}</div>
                                <div><strong>Quantity:</strong> {item.quantity}</div>
                                <div><strong>Unit Price:</strong> {formatCurrency(item.unit_price)}</div>
                                <div style={{ color: '#28a745', fontWeight: '600' }}>
                                  <strong>Amount:</strong> {formatCurrency(item.amount)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          marginTop: '16px',
          background: 'var(--card-bg)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 2px 8px var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalRecords)} of {totalRecords} refunds
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '8px 12px',
                background: currentPage === 1 ? 'var(--bg-secondary)' : '#007bff',
                border: `1px solid ${currentPage === 1 ? 'var(--border-color)' : '#007bff'}`,
                borderRadius: '6px',
                color: currentPage === 1 ? 'var(--text-muted)' : '#ffffff',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s ease',
                opacity: currentPage === 1 ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (currentPage !== 1) {
                  e.currentTarget.style.background = '#0056b3';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== 1) {
                  e.currentTarget.style.background = '#007bff';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              Previous
            </button>
            
            <span style={{
              padding: '8px 16px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: '8px 12px',
                background: currentPage === totalPages ? 'var(--bg-secondary)' : '#007bff',
                border: `1px solid ${currentPage === totalPages ? 'var(--border-color)' : '#007bff'}`,
                borderRadius: '6px',
                color: currentPage === totalPages ? 'var(--text-muted)' : '#ffffff',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s ease',
                opacity: currentPage === totalPages ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (currentPage !== totalPages) {
                  e.currentTarget.style.background = '#0056b3';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== totalPages) {
                  e.currentTarget.style.background = '#007bff';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
      
      {/* Custom Modal */}
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
      
      {/* Spinning animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Refunds;


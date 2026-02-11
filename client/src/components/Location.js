import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { RefreshCw, Save, Search, X } from 'lucide-react';
import useCustomModal from '../hooks/useCustomModal';

// Table styles
const tableStyles = `
  .location-table-container {
    background: var(--card-bg);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px var(--shadow-sm);
  }

  .location-table-wrapper {
    overflow-x: auto;
    max-width: 100%;
  }

  .location-table {
    width: 100%;
    border-collapse: collapse;
    background: var(--card-bg);
    color: var(--text-primary);
  }

  .location-table th {
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-weight: 600;
    padding: 12px 16px;
    text-align: left;
    border-bottom: 2px solid var(--border-color);
    font-size: 0.9em;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .location-table td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    vertical-align: middle;
  }

  .location-row {
    transition: background-color 0.2s ease;
  }

  .location-row:hover {
    background: var(--hover-bg);
  }

  .location-input {
    width: 100%;
    padding: 8px 12px;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 0.9em;
    transition: all 0.2s;
  }

  .location-input:focus {
    outline: none;
    border-color: #4a90e2;
    background: var(--input-bg);
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.15);
  }

  .save-btn {
    background: #16a34a;
    color: #fff;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
  }

  .save-btn:hover:not(:disabled) {
    background: #15803d;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(22, 163, 74, 0.4);
  }

  .save-btn:disabled {
    background: #6b7280;
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const Location = () => {
  const { showAlert } = useCustomModal();
  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]); // Store all items for filtering
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationChanges, setLocationChanges] = useState({});
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState(''); // Only updates on Enter
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      // Handle YYYYMMDD format
      if (/^\d{8}$/.test(dateStr)) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        return `${year}-${month}-${day}`;
      }
      // Handle YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  // Format number
  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0);
  };

  // Fetch items with quantity > 0 and no location
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found. Please log in again.');
        return;
      }

      const response = await axios.get('/api/location/items', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data && Array.isArray(response.data)) {
        setAllItems(response.data);
        setItems(response.data);
        setLocationChanges({}); // Reset changes
      } else {
        setError('Invalid response from server');
      }
    } catch (error) {
      console.error('Error fetching location items:', error);
      setError(error.response?.data?.message || 'Failed to fetch items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Handle location input change
  const handleLocationChange = (id, value) => {
    setLocationChanges(prev => ({
      ...prev,
      [id]: value
    }));
  };

  // Get item ID (handle both ID and id)
  const getItemId = (item) => {
    return item.ID || item.id;
  };

  // Save locations
  const handleSave = async () => {
    if (Object.keys(locationChanges).length === 0) {
      await showAlert('No changes to save', 'Info');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found. Please log in again.');
        return;
      }

      // Prepare updates - filter out empty locations and convert to null
      const updates = Object.entries(locationChanges)
        .filter(([id, location]) => {
          const trimmed = location.trim();
          // Only include if location has a value (not empty)
          return trimmed.length > 0;
        })
        .map(([id, location]) => ({
          id: parseInt(id),
          location: location.trim() || null
        }));
      
      if (updates.length === 0) {
        await showAlert('Please enter at least one location before saving', 'Info');
        setSaving(false);
        return;
      }

      console.log('📍 Sending location updates:', updates);
      
      const response = await axios.put('/api/location/update', 
        { updates },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('📍 Location update response:', response.data);

      if (response.data && response.data.success) {
        await showAlert(`Successfully updated ${response.data.updated || updates.length} item(s)`, 'Success');
        setLocationChanges({});
        // Refresh the list to show updated items are removed (since they now have locations)
        await fetchItems();
      } else {
        setError(response.data?.message || 'Failed to save locations');
        await showAlert(response.data?.message || 'Failed to save locations', 'Error');
      }
    } catch (error) {
      console.error('Error saving locations:', error);
      setError(error.response?.data?.message || 'Failed to save locations');
      await showAlert(error.response?.data?.message || 'Failed to save locations', 'Error');
    } finally {
      setSaving(false);
    }
  };

  // Get location value (from changes or original)
  const getLocationValue = (item) => {
    const itemId = getItemId(item);
    if (locationChanges[itemId] !== undefined) {
      return locationChanges[itemId];
    }
    return item.LOCATION || '';
  };

  // Handle search input - only filter on Enter key
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      setActiveSearchQuery(searchQuery);
    }
  };

  // Handle search clear
  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveSearchQuery('');
    setCurrentPage(1);
  };

  // Filter items based on active search query
  const filteredItems = useMemo(() => {
    if (!activeSearchQuery.trim()) {
      return allItems;
    }

    const query = activeSearchQuery.toLowerCase().trim();
    
    return allItems.filter(item => {
      const brand = (item.BRAND || '').toLowerCase();
      const partNo = (item.BENZ || '').toLowerCase();
      const oem = (item.ALTNO || '').toLowerCase();
      const description = ((item.DESCRIPTION || item.REMARKS || '')).toLowerCase();
      const id = String(item.ID || item.id || '').toLowerCase();

      return (
        brand.includes(query) ||
        partNo.includes(query) ||
        oem.includes(query) ||
        description.includes(query) ||
        id.includes(query)
      );
    });
  }, [allItems, activeSearchQuery]);

  // Calculate pagination
  const totalItems = filteredItems.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  // Update displayed items when paginated items change
  useEffect(() => {
    setItems(paginatedItems);
  }, [paginatedItems]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchQuery]);

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // Scroll to top of table
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div style={{ padding: '20px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <style>{tableStyles}</style>
      
      {/* Header */}
      <div style={{ 
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', margin: '0 0 8px 0', fontSize: '1.8rem' }}>
            Location Management
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
            Assign locations to items with quantity and no location
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={fetchItems}
            disabled={loading}
            style={{
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              opacity: loading ? 0.6 : 1
            }}
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={saving || Object.keys(locationChanges).length === 0}
            className="save-btn"
          >
            <Save size={16} />
            Save {Object.keys(locationChanges).length > 0 && `(${Object.keys(locationChanges).length})`}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{
        marginBottom: '20px',
        position: 'relative'
      }}>
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center'
        }}>
          <Search 
            size={18} 
            style={{
              position: 'absolute',
              left: '14px',
                      color: 'var(--text-muted)',
              pointerEvents: 'none'
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search by Brand, Part No, OEM, Description, or ID (Press Enter to search)..."
            style={{
              width: '100%',
              padding: '12px 16px 12px 44px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#4a90e2';
              e.target.style.background = 'var(--input-bg)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border-color)';
              e.target.style.background = 'var(--input-bg)';
            }}
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              style={{
                position: 'absolute',
                right: '12px',
                background: 'transparent',
                border: 'none',
                      color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.color = '#fff';
                e.target.style.background = '#333';
              }}
              onMouseLeave={(e) => {
                e.target.style.color = '#666';
                e.target.style.background = 'transparent';
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
        {activeSearchQuery && (
          <div style={{
            marginTop: '8px',
            fontSize: '0.85rem',
            color: '#999',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>Searching for: "{activeSearchQuery}"</span>
            <span style={{ color: '#666' }}>•</span>
            <span>{filteredItems.length} result(s) found</span>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          background: '#dc3545',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '0',
              width: '24px',
              height: '24px'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#999'
        }}>
          <RefreshCw size={32} className="spinning" style={{ 
            animation: 'spin 1s linear infinite',
            marginBottom: '16px'
          }} />
          <p>Loading items...</p>
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="location-table-container">
          <div className="location-table-wrapper">
            <table className="location-table">
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Part No</th>
                  <th>Brand</th>
                  <th>OEM</th>
                  <th>Description</th>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ 
                      textAlign: 'center', 
                      padding: '40px 20px',
                      color: 'var(--text-secondary)',
                      fontStyle: 'italic'
                    }}>
                      No items found with quantity and no location
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.ID || item.id || Math.random()} className="location-row">
                      <td>
                        <input
                          type="text"
                          className="location-input"
                          value={getLocationValue(item)}
                          onChange={(e) => handleLocationChange(getItemId(item), e.target.value)}
                          placeholder="Enter location..."
                          maxLength={100}
                        />
                      </td>
                      <td>{item.BENZ || '-'}</td>
                      <td>{item.BRAND || '-'}</td>
                      <td>{item.ALTNO || '-'}</td>
                      <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.DESCRIPTION || item.REMARKS || '-'}
                      </td>
                      <td>{item.ID || item.id || '-'}</td>
                      <td>{formatDate(item.DATE)}</td>
                      <td>{formatNumber(item.QTY)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={{
          marginTop: '20px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px',
          padding: '16px',
          background: 'var(--card-bg)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            style={{
              padding: '10px 20px',
              background: currentPage === 1 ? 'var(--bg-tertiary)' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              opacity: currentPage === 1 ? 0.5 : 1,
              transition: 'all 0.2s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (currentPage !== 1) {
                e.target.style.background = '#2563eb';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage !== 1) {
                e.target.style.background = '#3b82f6';
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            Previous
          </button>
          
          <span style={{
            color: '#e0e0e0',
            fontSize: '14px',
            fontWeight: 500,
            padding: '0 16px',
            minWidth: '200px',
            textAlign: 'center'
          }}>
            Page {currentPage} of {totalPages}
            <span style={{ color: '#999', marginLeft: '8px' }}>
              ({formatNumber(startIndex + 1)}-{formatNumber(Math.min(endIndex, totalItems))} of {formatNumber(totalItems)})
            </span>
          </span>
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{
              padding: '10px 20px',
              background: currentPage === totalPages ? 'var(--bg-tertiary)' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              opacity: currentPage === totalPages ? 0.5 : 1,
              transition: 'all 0.2s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (currentPage !== totalPages) {
                e.target.style.background = '#2563eb';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage !== totalPages) {
                e.target.style.background = '#3b82f6';
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            Next
          </button>
        </div>
      )}

      {/* Items Count */}
      {!loading && (
        <div style={{
          marginTop: '20px',
          padding: '12px 16px',
          background: 'var(--card-bg)',
          borderRadius: '8px',
          color: 'var(--text-secondary)',
          fontSize: '0.9rem',
          textAlign: 'center'
        }}>
          {activeSearchQuery ? (
            <>
              {totalItems > 0 ? (
                <>
                  Showing {formatNumber(startIndex + 1)}-{formatNumber(Math.min(endIndex, totalItems))} of {formatNumber(totalItems)} item(s) {items.length === 0 && '- No matches found'}
                </>
              ) : (
                <>No matches found</>
              )}
            </>
          ) : (
            <>
              Showing {formatNumber(startIndex + 1)}-{formatNumber(Math.min(endIndex, allItems.length))} of {formatNumber(allItems.length)} item(s) with quantity and no location
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spinning {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Location;


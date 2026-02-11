import React, { useState, useEffect, useRef, useContext } from 'react';
import ReactDOM from 'react-dom';
import * as XLSX from 'xlsx';
import { Search, Plus, Check, X, Trash2, FileDown } from 'lucide-react';
import { AuthContext } from '../AuthContext';

const ShipmentChecking = () => {
  const { user } = useContext(AuthContext);
  const token = localStorage.getItem('token');
  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lookupCache, setLookupCache] = useState({});
  const [dropdownFor, setDropdownFor] = useState(null);
  const [dropdownOptions, setDropdownOptions] = useState([]);
  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState(null);
  const dropdownRef = useRef(null);
  const dropdownAnchorRef = useRef(null);

  const parseJsonOrThrow = async (res) => {
    const text = await res.text();
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      throw new Error('Server returned an invalid response. Make sure the backend is running (e.g. node server.js on port 5000).');
    }
    try {
      return text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error('Server returned an invalid response. Make sure the backend is running.');
    }
  };

  const fetchRows = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/shipment-checking', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await parseJsonOrThrow(res);
      if (data.success) {
        const list = (data.data || []).map(r => ({
          ...r,
          quantity: r.quantity ?? r.Quantity ?? '',
          description: r.description ?? r.DESCRIPTION ?? ''
        }));
        setRows(list);
      } else setError(data.message || 'Failed to load');
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  // Position dropdown in viewport so it's not clipped by scroll container
  useEffect(() => {
    if (!dropdownFor) {
      setDropdownPosition(null);
      return;
    }
    const el = dropdownAnchorRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setDropdownPosition({ top: rect.bottom + 2, left: rect.left });
    };
    const raf = requestAnimationFrame(update);
    const onScrollOrResize = () => update();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [dropdownFor]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredRows(rows);
      return;
    }
    const s = searchTerm.toLowerCase().trim();
    setFilteredRows(rows.filter(r =>
      (r.brand && r.brand.toLowerCase().includes(s)) ||
      (r.brand_number && r.brand_number.toLowerCase().includes(s)) ||
      (r.part_no && r.part_no.toLowerCase().includes(s)) ||
      (r.altno && String(r.altno).toLowerCase().includes(s))
    ));
  }, [searchTerm, rows]);

  const fetchLookup = async (q) => {
    if (!q || q.length < 1) return [];
    const cacheKey = q.trim().toLowerCase();
    if (lookupCache[cacheKey]) return lookupCache[cacheKey];
    try {
      const res = await fetch(
        `/api/stock-items/lookup-brand-number?q=${encodeURIComponent(q.trim())}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await parseJsonOrThrow(res);
      const list = data.data || [];
      setLookupCache(prev => ({ ...prev, [cacheKey]: list }));
      return list;
    } catch (e) {
      return [];
    }
  };

  const handleBrandNumberFocus = (rowIndex, isNewRow) => {
    const row = isNewRow ? rows[rows.length - 1] : filteredRows[rowIndex];
    const key = isNewRow ? 'new' : row.id;
    const q = (row && row.brand_number) ? row.brand_number : '';
    setDropdownFor({ key, rowIndex, isNewRow });
    if (q) {
      setDropdownLoading(true);
      fetchLookup(q).then(list => {
        setDropdownOptions(list);
        setDropdownLoading(false);
      });
    } else {
      setDropdownOptions([]);
    }
  };

  const handleBrandNumberChange = (rowIndex, isNewRow, value) => {
    if (isNewRow) {
      setRows(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && !last.id) {
          next[next.length - 1] = { ...last, brand_number: value, brand: '', part_no: '', stock_id: null };
          return next;
        }
        return prev;
      });
    } else {
      const row = filteredRows[rowIndex];
      if (!row || row.id == null) return;
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, brand_number: value, brand: '', part_no: '', stock_id: null } : r));
    }
    setDropdownFor({ key: `${rowIndex}-${isNewRow}`, rowIndex, isNewRow });
    setDropdownLoading(true);
    fetchLookup(value).then(list => {
      setDropdownOptions(list);
      setDropdownLoading(false);
    });
  };

  const saveNewRow = async (payload) => {
    try {
      const res = await fetch('/api/shipment-checking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...payload, status: 'incomplete' })
      });
      const data = await parseJsonOrThrow(res);
      if (data.success && data.data && data.data.id) {
        const d = data.data;
        const quantity = d.quantity ?? d.Quantity ?? '';
        setRows(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.id == null) {
            next[next.length - 1] = { ...last, ...d, quantity };
          }
          return next;
        });
      }
    } catch (e) {
      setError(e.message || 'Failed to save row');
    }
  };

  const selectOption = async (rowIndex, isNewRow, option) => {
    const part_no = option.part_no || option.BENZ;
    const brand = option.brand || option.BRAND;
    const stock_id = option.stock_id || option.ID;
    const brand_number = option.ALTNO || option.ALTNO2 || option.brand_number;
    const description = option.description ?? option.DESCRIPTION ?? '';
    if (isNewRow) {
      const last = rows[rows.length - 1];
      const updated = last && !last.id
        ? { ...last, brand, part_no, stock_id, brand_number: brand_number || last.brand_number, description }
        : null;
      setRows(prev => {
        const next = [...prev];
        const lastItem = next[next.length - 1];
        if (lastItem && !lastItem.id && updated) {
          next[next.length - 1] = updated;
          return next;
        }
        return prev;
      });
      if (updated) {
        setDropdownFor(null);
        setDropdownOptions([]);
        await saveNewRow({
          quantity: updated.quantity,
          brand_number: updated.brand_number,
          brand: updated.brand,
          part_no: updated.part_no,
          stock_id: updated.stock_id
        });
      }
    } else {
      const row = filteredRows[rowIndex];
      if (!row) return;
      setRows(prev => prev.map(r =>
        r.id === row.id
          ? { ...r, brand, part_no, stock_id, brand_number: brand_number || r.brand_number, description }
          : r
      ));
      setDropdownFor(null);
      setDropdownOptions([]);
    }
  };

  const addRow = () => {
    setRows(prev => [...prev, { quantity: '', brand_number: '', brand: '', part_no: '', status: 'incomplete', stock_id: null }]);
  };

  const saveQuantityOnBlur = async (row, quantityValue) => {
    if (row.id == null) return;
    try {
      const res = await fetch(`/api/shipment-checking/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: row.status, quantity: quantityValue ?? '' })
      });
      const data = await parseJsonOrThrow(res);
      if (data.success && data.data) {
        const qty = data.data.quantity ?? data.data.Quantity ?? '';
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, quantity: qty } : r));
      }
    } catch (e) {
      setError(e.message || 'Failed to save quantity');
    }
  };

  const setStatus = async (row, status) => {
    const payload = { quantity: row.quantity, brand_number: row.brand_number, brand: row.brand, part_no: row.part_no, status, stock_id: row.stock_id };
    try {
      if (row.id != null) {
        const res = await fetch(`/api/shipment-checking/${row.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status, quantity: row.quantity ?? '' })
        });
        const data = await parseJsonOrThrow(res);
        if (data.success) setRows(prev => prev.map(r => r.id === row.id ? { ...r, status } : r));
      } else {
        const res = await fetch('/api/shipment-checking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        const data = await parseJsonOrThrow(res);
        if (data.success) {
          setRows(prev => prev.map(r => r === row ? { ...r, id: data.data.id, status } : r));
        }
      }
    } catch (e) {
      setError(e.message || 'Failed to update');
    }
  };

  const deleteRow = async (row) => {
    if (row.id == null) {
      setRows(prev => prev.filter(r => r !== row));
      return;
    }
    try {
      const res = await fetch(`/api/shipment-checking/${row.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await parseJsonOrThrow(res);
      if (data.success) setRows(prev => prev.filter(r => r.id !== row.id));
    } catch (e) {
      setError(e.message || 'Failed to delete');
    }
  };

  const hasNewRow = rows.length > 0 && rows[rows.length - 1] && rows[rows.length - 1].id == null;
  const newRow = hasNewRow ? rows[rows.length - 1] : null;
  const displayRows = searchTerm.trim()
    ? (newRow && !filteredRows.some(r => r === newRow) ? [...filteredRows, newRow] : filteredRows)
    : rows;

  const exportToExcel = () => {
    const dataToExport = (searchTerm.trim() ? filteredRows : rows)
      .filter(r => r.id != null)
      .map(r => ({
        Quantity: r.quantity ?? '',
        'Brand number': r.brand_number ?? '',
        Brand: r.brand ?? '',
        'Part no': r.part_no ?? '',
        Description: r.description ?? r.DESCRIPTION ?? '',
        Status: r.status ?? ''
      }));
    if (dataToExport.length === 0) {
      setError('No saved rows to export. Add and save rows first.');
      return;
    }
    setError('');
    try {
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Shipment Checking');
      const fileName = `shipment_checking_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (e) {
      setError(e.message || 'Failed to export to Excel');
    }
  };

  return (
    <div className="shipment-checking" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>Shipment Checking</h1>
        <button
          type="button"
          onClick={exportToExcel}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
            background: 'var(--primary, #1976d2)', color: '#fff', border: 'none', borderRadius: '8px',
            cursor: 'pointer', fontWeight: 600
          }}
        >
          <FileDown size={18} /> Save to Excel
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', marginBottom: '16px', background: '#fee', color: '#c00', borderRadius: '8px' }}>{error}</div>
      )}

      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Search size={20} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Search by brand, OEM/alt no, or part no..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            flex: 1, maxWidth: '400px', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '8px',
            background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: '1rem'
          }}
        />
      </div>

      {loading && !rows.length ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--card-bg)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Quantity</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Brand number</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Brand</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Part no</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Description</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px', width: '48px' }} />
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, idx) => {
                const isNewRow = !row.id && hasNewRow && row === rows[rows.length - 1];
                const showDropdown = dropdownFor && (
                  (isNewRow && dropdownFor.isNewRow) ||
                  (!isNewRow && dropdownFor.rowIndex === idx && !dropdownFor.isNewRow)
                );
                return (
                  <tr
                    key={row.id != null ? row.id : `new-${idx}`}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: idx % 2 === 1 ? 'var(--bg-secondary)' : undefined
                    }}
                  >
                    <td style={{ padding: '8px' }}>
                      <input
                        type="text"
                        value={row.quantity ?? ''}
                        onChange={e => {
                          if (isNewRow) {
                            setRows(prev => {
                              const next = [...prev];
                              next[next.length - 1] = { ...next[next.length - 1], quantity: e.target.value };
                              return next;
                            });
                          } else {
                            setRows(prev => prev.map(r => r.id === row.id ? { ...r, quantity: e.target.value } : r));
                          }
                        }}
                        onBlur={e => {
                          if (row.id != null) saveQuantityOnBlur(row, e.target.value);
                        }}
                        placeholder="Quantity"
                        style={{ width: '80px', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--card-bg)' }}
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="text"
                        value={row.brand_number ?? ''}
                        onFocus={() => handleBrandNumberFocus(idx, isNewRow)}
                        onChange={e => handleBrandNumberChange(idx, isNewRow, e.target.value)}
                        placeholder="Type to search..."
                        style={{ width: '100%', minWidth: '140px', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--card-bg)' }}
                      />
                    </td>
                    <td style={{ padding: '8px', color: 'var(--text-primary)' }}>{row.brand || '—'}</td>
                    <td
                      ref={showDropdown ? dropdownAnchorRef : null}
                      style={{ padding: '8px', color: 'var(--text-primary)' }}
                    >
                      {row.part_no || '—'}
                    </td>
                    <td style={{ padding: '8px', color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.description ?? row.DESCRIPTION ?? ''}>
                      {(row.description ?? row.DESCRIPTION ?? '') || '—'}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setStatus(row, 'complete')}
                          title="Complete"
                          style={{
                            padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: '6px',
                            background: row.status === 'complete' ? 'var(--primary, #1976d2)' : 'var(--card-bg)',
                            color: row.status === 'complete' ? '#fff' : 'var(--text-primary)', cursor: 'pointer'
                          }}
                        >
                          <Check size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatus(row, 'incomplete')}
                          title="Incomplete"
                          style={{
                            padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: '6px',
                            background: row.status === 'incomplete' ? '#c62828' : 'var(--card-bg)',
                            color: row.status === 'incomplete' ? '#fff' : 'var(--text-primary)', cursor: 'pointer'
                          }}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <button
                        type="button"
                        onClick={() => deleteRow(row)}
                        title="Delete"
                        style={{ padding: '6px', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!displayRows.length && (
            <p style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No rows yet. Click “Add row” to add one.</p>
          )}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={addRow}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                background: 'var(--primary, #1976d2)', color: '#fff', border: 'none', borderRadius: '8px',
                cursor: 'pointer', fontWeight: 600
              }}
            >
              <Plus size={18} /> Add row
            </button>
          </div>
        </div>
      )}

      {dropdownFor && dropdownPosition && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 10000,
            maxHeight: '280px',
            overflowY: 'auto',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            minWidth: '280px'
          }}
        >
          {dropdownLoading ? (
            <div style={{ padding: '12px', color: 'var(--text-muted)' }}>Loading...</div>
          ) : dropdownOptions.length === 0 ? (
            <div style={{ padding: '12px', color: 'var(--text-muted)' }}>No matches</div>
          ) : (
            dropdownOptions.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectOption(dropdownFor.rowIndex, dropdownFor.isNewRow, opt)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 12px',
                  textAlign: 'left',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                {opt.brand || opt.BRAND} — {opt.part_no || opt.BENZ}
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default ShipmentChecking;

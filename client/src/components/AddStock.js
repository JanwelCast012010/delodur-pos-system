import React, { useState, useEffect, useContext } from 'react';
import { Container, Row, Col, Form, Button, Alert, Card, InputGroup, Modal, Table, Badge } from 'react-bootstrap';
import { AuthContext } from '../AuthContext';
import { Plus, Upload, Download, Save, Eye, Trash2, FileText, Package, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import axios from 'axios';

const AddStock = () => {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showRefreshModal, setShowRefreshModal] = useState(false);
    const [availableDbfFiles, setAvailableDbfFiles] = useState([]);
    const [selectedDbfFile, setSelectedDbfFile] = useState('');
    const [refreshLoading, setRefreshLoading] = useState(false);
    const [suppliers, setSuppliers] = useState([]);
    const [showPreview, setShowPreview] = useState(false);
    const [bulkData, setBulkData] = useState([]);

    // Form data state (exactly like TRACK.EXE form)
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        reference: '',
        supplier: '',
        document_ref: '',
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
        cost: 0,
        selling_price: 0,
        currency: 'PHP',
        fc_cost: 0,
        conversion: 1,
        quantity: 0,
        unit: 'pcs',
        reorder_point: 0,
        location: ''
    });

    // Load suppliers on component mount
    useEffect(() => {
        fetchSuppliers();
    }, []);

    // Fetch DBF files when refresh modal opens
    useEffect(() => {
        if (showRefreshModal) {
            fetchAvailableDbfFiles();
        }
    }, [showRefreshModal]);

    const fetchSuppliers = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/suppliers', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.success) {
                setSuppliers(result.data);
            }
        } catch (error) {
            console.error('Error fetching suppliers:', error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/incoming', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            if (result.success) {
                setSuccess('Stock added successfully! It is now pending review.');
                // Reset form
                setFormData({
                    date: new Date().toISOString().split('T')[0],
                    reference: '',
                    supplier: '',
                    document_ref: '',
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
                    cost: 0,
                    selling_price: 0,
                    currency: 'PHP',
                    fc_cost: 0,
                    conversion: 1,
                    quantity: 0,
                    unit: 'pcs',
                    reorder_point: 0,
                    location: ''
                });
            } else {
                setError(result.error || 'Failed to add stock');
            }
        } catch (error) {
            setError('Error adding stock: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                // Map Excel columns to our form fields
                const mappedData = jsonData.map(row => ({
                    date: row['Date'] || new Date().toISOString().split('T')[0],
                    reference: row['Reference'] || '',
                    supplier: row['Supplier'] || '',
                    document_ref: row['Document Ref'] || '',
                    din_flag: row['DIN Flag'] || '',
                    benz_number: row['Benz Number'] || '',
                    benz_number2: row['Benz Number 2'] || '',
                    benz_number3: row['Benz Number 3'] || '',
                    brand: row['Brand'] || '',
                    altno: row['Alt No'] || '',
                    altno2: row['Alt No 2'] || '',
                    description: row['Description'] || '',
                    application: row['Application'] || '',
                    color_code: row['Color Code'] || '',
                    remarks: row['Remarks'] || '',
                    cost: parseFloat(row['Cost']) || 0,
                    selling_price: parseFloat(row['Selling Price']) || 0,
                    currency: row['Currency'] || 'PHP',
                    fc_cost: parseFloat(row['FC Cost']) || 0,
                    conversion: parseFloat(row['Conversion']) || 1,
                    quantity: parseInt(row['Quantity']) || 0,
                    unit: row['Unit'] || 'pcs',
                    reorder_point: parseInt(row['Reorder Point']) || 0,
                    location: row['Location'] || ''
                }));

                setBulkData(mappedData);
                setShowPreview(true);
            } catch (error) {
                setError('Error reading file: ' + error.message);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleBulkImport = async () => {
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/incoming/bulk-import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    items: bulkData,
                    created_by: user?.username || 'system'
                })
            });

            const result = await response.json();
            if (result.success) {
                setSuccess(`${bulkData.length} items imported successfully! They are now pending review.`);
                setShowPreview(false);
                setBulkData([]);
            } else {
                setError(result.error || 'Failed to import items');
            }
        } catch (error) {
            setError('Error importing items: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const downloadTemplate = () => {
        const templateData = [{
            'Date': '2024-01-15',
            'Reference': 'PO-2024-001',
            'Supplier': 'SUP001',
            'Document Ref': 'INV-12345',
            'DIN Flag': 'D',
            'Benz Number': '1234567890',
            'Benz Number 2': '1234567891',
            'Benz Number 3': '1234567892',
            'Brand': 'MERCEDES',
            'Alt No': 'A123456',
            'Alt No 2': 'A123457',
            'Description': 'Brake Pad Set',
            'Application': 'C-Class W204',
            'Color Code': 'BLK',
            'Remarks': 'Front',
            'Cost': 1500.00,
            'Selling Price': 2000.00,
            'Currency': 'PHP',
            'FC Cost': 30.00,
            'Conversion': 50.00,
            'Quantity': 10,
            'Unit': 'pcs',
            'Reorder Point': 5,
            'Location': 'A1-B2'
        }];

        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Stock Template');
        XLSX.writeFile(wb, 'stock_import_template.xlsx');
    };

    // Fetch available DBF files
    const fetchAvailableDbfFiles = async () => {
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
    };

    // Handle refresh from DBF
    const handleRefreshFromDbf = async () => {
        try {
            setRefreshLoading(true);
            setError('');
            
            const token = localStorage.getItem('token');
            const response = await axios.post('/api/inmain/refresh-from-dbf', {
                dbfPath: selectedDbfFile
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setShowRefreshModal(false);
                setSuccess(`Inmain data refreshed successfully! Imported ${response.data.imported} records.`);
            }
        } catch (error) {
            console.error('Error refreshing from DBF:', error);
            setError(error.response?.data?.message || 'Failed to refresh inmain data from DBF');
        } finally {
            setRefreshLoading(false);
        }
    };

    return (
        <div className="add-stock-page">
            <div className="add-stock-header">
                <div className="header-content">
                    <div className="header-left">
                        <h1><Package className="header-icon" />Add Stock</h1>
                        <p className="header-subtitle">Import new stock items (like TRACK.EXE "Update New Incoming Stocks File")</p>
                    </div>
                </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div className="add-stock-content">
                {/* Single Item Entry Form */}
                <div className="main-form-section">
                    <div className="form-card">
                        <div className="form-card-header">
                            <h3><Plus className="me-2" />Add Single Stock Item</h3>
                        </div>
                        <div className="form-card-body">
                            <form onSubmit={handleSubmit} className="stock-form">
                                {/* Two column layout like original TRACK */}
                                <div className="form-columns">
                                    <div className="form-column-left">
                                        <div className="form-field-row">
                                            <label className="form-label">Date :</label>
                                            <input
                                                type="date"
                                                name="date"
                                                value={formData.date}
                                                onChange={handleInputChange}
                                                required
                                                className="form-input"
                                            />
                                        </div>

                                        <div className="form-field-row">
                                            <label className="form-label">[D]IN :</label>
                                            <input
                                                type="text"
                                                name="din_flag"
                                                value={formData.din_flag}
                                                onChange={handleInputChange}
                                                placeholder="D for DIN standard"
                                                maxLength={1}
                                                className="form-input"
                                            />
                                        </div>

                                        <div className="form-field-row">
                                            <label className="form-label">Benz Number :</label>
                                            <input
                                                type="text"
                                                name="benz_number"
                                                value={formData.benz_number}
                                                onChange={handleInputChange}
                                                placeholder="1234567890"
                                                required
                                                className="form-input"
                                            />
                                        </div>

                                        <div className="form-field-row">
                                            <label className="form-label">Brand :</label>
                                            <input
                                                type="text"
                                                name="brand"
                                                value={formData.brand}
                                                onChange={handleInputChange}
                                                placeholder="MERCEDES"
                                                required
                                                className="form-input"
                                            />
                                        </div>

                                        <div className="form-field-row">
                                            <label className="form-label">OEM# :</label>
                                            <input
                                                type="text"
                                                name="altno"
                                                value={formData.altno}
                                                onChange={handleInputChange}
                                                placeholder="A123456"
                                                className="form-input"
                                            />
                                        </div>

                                        <div className="form-field-row">
                                            <label className="form-label">Description :</label>
                                            <input
                                                type="text"
                                                name="description"
                                                value={formData.description}
                                                onChange={handleInputChange}
                                                placeholder="Brake Pad Set"
                                                className="form-input"
                                            />
                                        </div>

                                        <div className="form-field-row">
                                            <label className="form-label">Application :</label>
                                            <input
                                                type="text"
                                                name="application"
                                                value={formData.application}
                                                onChange={handleInputChange}
                                                placeholder="C-Class W204"
                                                className="form-input"
                                            />
                                        </div>

                                        <div className="form-field-row">
                                            <label className="form-label">Color Code :</label>
                                            <input
                                                type="text"
                                                name="color_code"
                                                value={formData.color_code}
                                                onChange={handleInputChange}
                                                placeholder="BLK"
                                                className="form-input"
                                            />
                                        </div>

                                        {/* Pricing Section - Compact Layout */}
                                        <div className="pricing-section">
                                            <div className="pricing-row">
                                                <div className="form-field-row">
                                                    <label className="form-label">Cost :</label>
                                                    <div className="input-group">
                                                        <span className="input-group-text">₱</span>
                                                        <input
                                                            type="number"
                                                            name="cost"
                                                            value={formData.cost}
                                                            onChange={handleInputChange}
                                                            step="0.01"
                                                            min="0"
                                                            className="form-input"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="form-field-row">
                                                    <label className="form-label">Selling Price :</label>
                                                    <div className="input-group">
                                                        <span className="input-group-text">₱</span>
                                                        <input
                                                            type="number"
                                                            name="selling_price"
                                                            value={formData.selling_price}
                                                            onChange={handleInputChange}
                                                            step="0.01"
                                                            min="0"
                                                            className="form-input"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="form-field-row">
                                                    <label className="form-label">Quantity :</label>
                                                    <input
                                                        type="number"
                                                        name="quantity"
                                                        value={formData.quantity}
                                                        onChange={handleInputChange}
                                                        min="0"
                                                        required
                                                        className="form-input"
                                                    />
                                                </div>

                                                <div className="form-field-row">
                                                    <label className="form-label">Unit :</label>
                                                    <select
                                                        name="unit"
                                                        value={formData.unit}
                                                        onChange={handleInputChange}
                                                        className="form-select"
                                                    >
                                                        <option value="pcs">Pieces</option>
                                                        <option value="box">Box</option>
                                                        <option value="set">Set</option>
                                                        <option value="kg">Kilogram</option>
                                                        <option value="liter">Liter</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="pricing-row">
                                                <div className="form-field-row">
                                                    <label className="form-label">Conversion :</label>
                                                    <input
                                                        type="number"
                                                        name="conversion"
                                                        value={formData.conversion}
                                                        onChange={handleInputChange}
                                                        step="0.0001"
                                                        min="0"
                                                        className="form-input"
                                                    />
                                                </div>

                                                <div className="form-field-row">
                                                    <label className="form-label">Currency :</label>
                                                    <select
                                                        name="currency"
                                                        value={formData.currency}
                                                        onChange={handleInputChange}
                                                        className="form-select"
                                                    >
                                                        <option value="PHP">PHP</option>
                                                        <option value="USD">USD</option>
                                                        <option value="EUR">EUR</option>
                                                    </select>
                                                </div>

                                                <div className="form-field-row">
                                                    <label className="form-label">FC Cost :</label>
                                                    <div className="input-group">
                                                        <span className="input-group-text">$</span>
                                                        <input
                                                            type="number"
                                                            name="fc_cost"
                                                            value={formData.fc_cost}
                                                            onChange={handleInputChange}
                                                            step="0.01"
                                                            min="0"
                                                            className="form-input"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="form-field-row">
                                            <label className="form-label">Location :</label>
                                            <input
                                                type="text"
                                                name="location"
                                                value={formData.location}
                                                onChange={handleInputChange}
                                                placeholder="A1-B2, Warehouse 1, etc."
                                                className="form-input"
                                            />
                                        </div>

                                        <div className="form-field-row">
                                            <label className="form-label">Document Reference :</label>
                                            <input
                                                type="text"
                                                name="document_ref"
                                                value={formData.document_ref}
                                                onChange={handleInputChange}
                                                placeholder="INV-12345"
                                                className="form-input"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-column-right">
                                        <div className="form-field-row">
                                            <label className="form-label">Reference :</label>
                                            <input
                                                type="text"
                                                name="reference"
                                                value={formData.reference}
                                                onChange={handleInputChange}
                                                placeholder="PO-2024-001"
                                                className="form-input"
                                            />
                                        </div>

                                        <div className="form-field-row">
                                            <label className="form-label">Supplier :</label>
                                            <select
                                                name="supplier"
                                                value={formData.supplier}
                                                onChange={handleInputChange}
                                                className="form-select"
                                            >
                                                <option value="">Select Supplier</option>
                                                {suppliers.map(supplier => (
                                                    <option key={supplier.id} value={supplier.supplier_code}>
                                                        {supplier.supplier_name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="form-field-row">
                                            <label className="form-label">Remarks :</label>
                                            <input
                                                type="text"
                                                name="remarks"
                                                value={formData.remarks}
                                                onChange={handleInputChange}
                                                placeholder="Front, Rear, etc."
                                                className="form-input"
                                            />
                                        </div>


                                        <div className="form-field-row">
                                            <label className="form-label">Reorder Point :</label>
                                            <input
                                                type="number"
                                                name="reorder_point"
                                                value={formData.reorder_point}
                                                onChange={handleInputChange}
                                                min="0"
                                                className="form-input"
                                            />
                                        </div>
                                    </div>
                                </div>


                                <div className="form-actions">
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={loading}
                                    >
                                        {loading ? 'Adding...' : <><Save className="me-2" />Add Stock</>}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setFormData({
                                            ...formData,
                                            reference: '',
                                            supplier: '',
                                            document_ref: '',
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
                                            cost: 0,
                                            selling_price: 0,
                                            fc_cost: 0,
                                            conversion: 1,
                                            quantity: 0,
                                            reorder_point: 0,
                                            location: ''
                                        })}
                                    >
                                        Clear Form
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                {/* Bulk Import Section */}
                <div className="bulk-import-section">
                    <div className="import-card">
                        <div className="import-card-header">
                            <h3><Upload className="me-2" />Bulk Import</h3>
                        </div>
                        <div className="import-card-body">
                            <div className="form-group">
                                <label className="form-label">Upload Excel/CSV File</label>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={handleFileUpload}
                                    className="form-input"
                                />
                                <div className="form-help">
                                    Upload a file with stock data to import multiple items at once.
                                </div>
                            </div>

                            <div className="import-actions">
                                <button
                                    className="btn btn-outline-info"
                                    onClick={downloadTemplate}
                                >
                                    <Download className="me-2" />Download Template
                                </button>
                            </div>

                            <div className="alert alert-info">
                                <strong>Note:</strong> All imported items will be saved with "pending" status and need to be reviewed before being added to inventory.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bulk Import Preview Modal */}
            {showPreview && (
                <div className="modal-overlay" onClick={() => setShowPreview(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><Eye className="me-2" />Import Preview</h3>
                            <button className="modal-close" onClick={() => setShowPreview(false)}>×</button>
                        </div>
                        <div className="modal-body">
                    <p>Review the data before importing. <strong>{bulkData.length}</strong> items will be imported.</p>
                            <div className="preview-table-container">
                                <table className="preview-table">
                            <thead>
                                <tr>
                                    <th>Benz #</th>
                                    <th>Brand</th>
                                    <th>Description</th>
                                    <th>Quantity</th>
                                    <th>Cost</th>
                                    <th>Price</th>
                                    <th>Supplier</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bulkData.slice(0, 10).map((item, index) => (
                                    <tr key={index}>
                                        <td>{item.benz_number}</td>
                                        <td>{item.brand}</td>
                                        <td>{item.description}</td>
                                        <td>{item.quantity}</td>
                                        <td>₱{item.cost}</td>
                                        <td>₱{item.selling_price}</td>
                                        <td>{item.supplier}</td>
                                    </tr>
                                ))}
                            </tbody>
                                </table>
                        {bulkData.length > 10 && (
                                    <p className="preview-more">... and {bulkData.length - 10} more items</p>
                        )}
                    </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowPreview(false)}>
                        Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleBulkImport} disabled={loading}>
                        {loading ? 'Importing...' : `Import ${bulkData.length} Items`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .add-stock-page {
                    padding: 0;
                    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
                    min-height: 100vh;
                    color: #ffffff;
                    width: 100%;
                }

                .add-stock-header {
                    background: linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%);
                    padding: 2rem;
                    border-bottom: 2px solid #404040;
                    margin-bottom: 2rem;
                }

                .header-content {
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .header-left h1 {
                    margin: 0;
                    font-size: 2rem;
                    font-weight: 700;
                    color: #ffffff;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .header-icon {
                    width: 32px;
                    height: 32px;
                    color: #007bff;
                }

                .header-subtitle {
                    margin: 0.5rem 0 0 0;
                    color: #adb5bd;
                    font-size: 1rem;
                }

                .add-stock-content {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 2rem;
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 2rem;
                }

                .main-form-section {
                    width: 100%;
                }

                .form-card {
                    background: linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%);
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    border: 1px solid #404040;
                    overflow: hidden;
                }

                .form-card-header {
                    background: #2d2d2d;
                    padding: 1.5rem;
                    border-bottom: 2px solid #404040;
                }

                .form-card-header h3 {
                    margin: 0;
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: #ffffff;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .form-card-body {
                    padding: 2rem;
                }

                .stock-form {
                    width: 100%;
                }

                .form-columns {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.5rem;
                }

                .form-column-left,
                .form-column-right {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .form-field-row {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }

                .form-field-row .form-label {
                    min-width: 80px;
                    text-align: right;
                    margin-bottom: 0;
                    font-weight: 600;
                    color: #ffffff;
                    font-size: 0.85rem;
                    flex-shrink: 0;
                }

                /* Smart field sizing based on content type */
                .form-field-row .form-input,
                .form-field-row .form-select {
                    flex: 1;
                }

                /* Ultra-narrow fields for small values */
                .form-field-row input[name="quantity"],
                .form-field-row input[name="conversion"],
                .form-field-row input[name="reorder_point"] {
                    max-width: 60px;
                }

                /* Compact fields for currency values */
                .form-field-row input[name="cost"],
                .form-field-row input[name="selling_price"],
                .form-field-row input[name="fc_cost"] {
                    max-width: 90px;
                }

                /* Ultra-compact fields for short text */
                .form-field-row select[name="unit"],
                .form-field-row select[name="currency"] {
                    max-width: 70px;
                }

                /* Standard width for other fields */
                .form-field-row .form-input:not([name="quantity"]):not([name="conversion"]):not([name="reorder_point"]):not([name="cost"]):not([name="selling_price"]):not([name="fc_cost"]),
                .form-field-row .form-select:not([name="unit"]):not([name="currency"]) {
                    max-width: 150px;
                }

                .form-field-row .input-group {
                    flex: 1;
                }

                /* Special styling for pricing section grouping */
                .pricing-section {
                    background: rgba(45, 45, 45, 0.3);
                    border-radius: 8px;
                    padding: 0.75rem;
                    margin: 0.5rem 0;
                    border: 1px solid #404040;
                }

                .pricing-row {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 0.25rem;
                    align-items: center;
                }

                .pricing-row:last-child {
                    margin-bottom: 0;
                }

                .pricing-row .form-field-row {
                    flex: 1;
                    margin-bottom: 0;
                    gap: 0.25rem;
                }

                .pricing-row .form-field-row .form-label {
                    min-width: 70px;
                    font-size: 0.8rem;
                }

                .form-label {
                    font-weight: 600;
                    color: #ffffff;
                    font-size: 0.9rem;
                    margin-bottom: 0.25rem;
                }

                .form-input, .form-select {
                    padding: 0.75rem 1rem;
                    border: 1px solid #444;
                    border-radius: 6px;
                    background: #1a1a1a;
                    color: #ffffff;
                    font-size: 0.9rem;
                    transition: all 0.2s ease;
                }

                .form-input:focus, .form-select:focus {
                    outline: none;
                    border-color: #007bff;
                    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
                }

                .form-input::placeholder {
                    color: #6c757d;
                }

                .input-group {
                    display: flex;
                    align-items: center;
                }

                .input-group-text {
                    background: #2d2d2d;
                    border: 1px solid #444;
                    border-right: none;
                    padding: 0.75rem 0.75rem;
                    color: #ffffff;
                    font-weight: 600;
                    border-radius: 6px 0 0 6px;
                }

                .input-group .form-input {
                    border-radius: 0 6px 6px 0;
                    border-left: none;
                }

                .form-actions {
                    display: flex;
                    gap: 1rem;
                    margin-top: 2rem;
                    padding-top: 1.5rem;
                    border-top: 1px solid #404040;
                }

                .btn {
                    padding: 0.75rem 1.5rem;
                    border: none;
                    border-radius: 6px;
                    font-weight: 600;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .btn-primary {
                    background: #007bff;
                    color: white;
                }

                .btn-primary:hover:not(:disabled) {
                    background: #0056b3;
                    transform: translateY(-1px);
                }

                .btn-secondary {
                    background: #6c757d;
                    color: white;
                }

                .btn-secondary:hover:not(:disabled) {
                    background: #545b62;
                    transform: translateY(-1px);
                }

                .btn-outline-info {
                    background: transparent;
                    color: #17a2b8;
                    border: 1px solid #17a2b8;
                }

                .btn-outline-info:hover:not(:disabled) {
                    background: #17a2b8;
                    color: white;
                }

                .bulk-import-section {
                    width: 100%;
                }

                .import-card {
                    background: linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%);
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    border: 1px solid #404040;
                    overflow: hidden;
                }

                .import-card-header {
                    background: #2d2d2d;
                    padding: 1.5rem;
                    border-bottom: 2px solid #404040;
                }

                .import-card-header h3 {
                    margin: 0;
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: #ffffff;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .import-card-body {
                    padding: 2rem;
                }

                .import-actions {
                    margin: 1.5rem 0;
                }

                .form-help {
                    font-size: 0.8rem;
                    color: #6c757d;
                    margin-top: 0.25rem;
                }

                .alert {
                    padding: 1rem;
                    border-radius: 6px;
                    margin: 1rem 0;
                    border: 1px solid;
                }

                .alert-danger {
                    background: rgba(220, 53, 69, 0.1);
                    border-color: #dc3545;
                    color: #dc3545;
                }

                .alert-success {
                    background: rgba(40, 167, 69, 0.1);
                    border-color: #28a745;
                    color: #28a745;
                }

                .alert-info {
                    background: rgba(23, 162, 184, 0.1);
                    border-color: #17a2b8;
                    color: #17a2b8;
                }

                /* Modal Styles */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }

                .modal-content {
                    background: linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%);
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                    border: 1px solid #404040;
                    max-width: 90vw;
                    max-height: 90vh;
                    width: 800px;
                    display: flex;
                    flex-direction: column;
                }

                .modal-header {
                    padding: 1.5rem;
                    border-bottom: 2px solid #404040;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .modal-header h3 {
                    margin: 0;
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: #ffffff;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .modal-close {
                    background: none;
                    border: none;
                    color: #ffffff;
                    font-size: 1.5rem;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                    transition: background 0.2s ease;
                }

                .modal-close:hover {
                    background: #404040;
                }

                .modal-body {
                    padding: 1.5rem;
                    flex: 1;
                    overflow-y: auto;
                }

                .modal-body p {
                    margin-bottom: 1rem;
                    color: #e0e0e0;
                }

                .preview-table-container {
                    max-height: 400px;
                    overflow-y: auto;
                    border: 1px solid #404040;
                    border-radius: 6px;
                }

                .preview-table {
                    width: 100%;
                    border-collapse: collapse;
                    background: #1a1a1a;
                    color: #e0e0e0;
                }

                .preview-table th {
                    background: #2d2d2d;
                    color: #ffffff;
                    font-weight: 600;
                    padding: 12px 16px;
                    text-align: left;
                    border-bottom: 2px solid #404040;
                    font-size: 0.9em;
                    position: sticky;
                    top: 0;
                }

                .preview-table td {
                    padding: 12px 16px;
                    border-bottom: 1px solid #333;
                    vertical-align: middle;
                }

                .preview-table tbody tr:hover {
                    background: #2a2a2a;
                }

                .preview-more {
                    padding: 1rem;
                    text-align: center;
                    color: #6c757d;
                    font-style: italic;
                    margin: 0;
                }

                .modal-footer {
                    padding: 1.5rem;
                    border-top: 2px solid #404040;
                    display: flex;
                    gap: 1rem;
                    justify-content: flex-end;
                }

                @media (max-width: 768px) {
                    .add-stock-content {
                        grid-template-columns: 1fr;
                        padding: 0 1rem;
                    }

                    .form-columns {
                        grid-template-columns: 1fr;
                        gap: 0.5rem;
                    }

                    .form-field-row {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 0.25rem;
                    }

                    .form-field-row .form-label {
                        min-width: auto;
                        text-align: left;
                        margin-bottom: 0.25rem;
                        font-size: 0.85rem;
                    }

                    .form-field-row .form-input,
                    .form-field-row .form-select,
                    .form-field-row .input-group {
                        max-width: 100%;
                        width: 100%;
                    }

                    /* Mobile: Make all fields full width but keep smart sizing for small screens */
                    .form-field-row input[name="quantity"],
                    .form-field-row input[name="conversion"],
                    .form-field-row input[name="reorder_point"] {
                        max-width: 120px;
                    }

                    .form-field-row input[name="cost"],
                    .form-field-row input[name="selling_price"],
                    .form-field-row input[name="fc_cost"] {
                        max-width: 150px;
                    }

                    .form-field-row select[name="unit"],
                    .form-field-row select[name="currency"] {
                        max-width: 120px;
                    }

                    .modal-content {
                        width: 95vw;
                        margin: 1rem;
                    }
                }

                @media (max-width: 480px) {
                    .form-columns {
                        gap: 0.25rem;
                    }

                    .form-field-row {
                        gap: 0.25rem;
                    }

                    .form-field-row .form-label {
                        font-size: 0.8rem;
                    }

                    /* Extra small screens: Even more compact */
                    .form-field-row input[name="quantity"],
                    .form-field-row input[name="conversion"],
                    .form-field-row input[name="reorder_point"] {
                        max-width: 100px;
                    }

                    .form-field-row input[name="cost"],
                    .form-field-row input[name="selling_price"],
                    .form-field-row input[name="fc_cost"] {
                        max-width: 130px;
                    }

                    .form-field-row select[name="unit"],
                    .form-field-row select[name="currency"] {
                        max-width: 100px;
                    }
                }
            `}</style>
        </div>
    );
};

export default AddStock;

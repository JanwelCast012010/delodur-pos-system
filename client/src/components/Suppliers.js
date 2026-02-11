import React, { useState, useEffect, useContext } from 'react';
import { Container, Row, Col, Card, Table, Button, Alert, Modal, Form, InputGroup, Badge } from 'react-bootstrap';
import { AuthContext } from '../AuthContext';
import { Plus, Edit, Trash2, Building, Phone, Mail, MapPin, Save, X, Search } from 'lucide-react';

const Suppliers = () => {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [suppliers, setSuppliers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Form data state
    const [formData, setFormData] = useState({
        supplier_code: '',
        supplier_name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        terms: '',
        currency: 'PHP',
        is_active: true
    });

    // Load suppliers on component mount
    useEffect(() => {
        fetchSuppliers();
    }, []);

    const fetchSuppliers = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const params = new URLSearchParams({
                search: searchTerm
            });

            const response = await fetch(`/api/suppliers?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const result = await response.json();
            if (result.success) {
                setSuppliers(result.data);
            } else {
                setError(result.error || 'Failed to fetch suppliers');
            }
        } catch (error) {
            setError('Error fetching suppliers: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Refetch when search term changes
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchSuppliers();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const token = localStorage.getItem('token');
            const url = editingSupplier ? `/api/suppliers/${editingSupplier.id}` : '/api/suppliers';
            const method = editingSupplier ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            if (result.success) {
                setSuccess(editingSupplier ? 'Supplier updated successfully' : 'Supplier added successfully');
                setShowModal(false);
                setEditingSupplier(null);
                resetForm();
                fetchSuppliers();
            } else {
                setError(result.error || 'Failed to save supplier');
            }
        } catch (error) {
            setError('Error saving supplier: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (supplier) => {
        setEditingSupplier(supplier);
        setFormData({
            supplier_code: supplier.supplier_code,
            supplier_name: supplier.supplier_name,
            contact_person: supplier.contact_person || '',
            phone: supplier.phone || '',
            email: supplier.email || '',
            address: supplier.address || '',
            terms: supplier.terms || '',
            currency: supplier.currency || 'PHP',
            is_active: supplier.is_active
        });
        setShowModal(true);
    };

    const handleDelete = async (supplier) => {
        if (!window.confirm(`Are you sure you want to delete supplier "${supplier.supplier_name}"?`)) {
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/suppliers/${supplier.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const result = await response.json();
            if (result.success) {
                setSuccess('Supplier deleted successfully');
                fetchSuppliers();
            } else {
                setError(result.error || 'Failed to delete supplier');
            }
        } catch (error) {
            setError('Error deleting supplier: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            supplier_code: '',
            supplier_name: '',
            contact_person: '',
            phone: '',
            email: '',
            address: '',
            terms: '',
            currency: 'PHP',
            is_active: true
        });
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingSupplier(null);
        resetForm();
    };

    const filteredSuppliers = suppliers.filter(supplier =>
        supplier.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.supplier_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (supplier.contact_person && supplier.contact_person.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <Container fluid className="component-wrapper">
            <div className="component-header mb-4">
                <h2><Building className="me-2" />Suppliers</h2>
                <p className="text-muted">Manage supplier information (like TRACK.EXE "Update Supplier Codes File")</p>
            </div>

            {error && <Alert variant="danger">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}

            {/* Header with Add Button and Search */}
            <Row className="mb-3">
                <Col md={6}>
                    <Button
                        variant="primary"
                        onClick={() => setShowModal(true)}
                    >
                        <Plus className="me-2" size={16} />
                        Add Supplier
                    </Button>
                </Col>
                <Col md={6}>
                    <InputGroup>
                        <InputGroup.Text><Search /></InputGroup.Text>
                        <Form.Control
                            type="text"
                            placeholder="Search suppliers..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </InputGroup>
                </Col>
            </Row>

            {/* Suppliers Table */}
            <Card>
                <Card.Header>
                    <h5>Supplier List ({filteredSuppliers.length} suppliers)</h5>
                </Card.Header>
                <Card.Body>
                    {loading ? (
                        <div className="text-center p-4">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <p className="mt-2">Loading suppliers...</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <Table striped bordered hover size="sm">
                                <thead>
                                    <tr>
                                        <th>Code</th>
                                        <th>Supplier Name</th>
                                        <th>Contact Person</th>
                                        <th>Phone</th>
                                        <th>Email</th>
                                        <th>Terms</th>
                                        <th>Currency</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSuppliers.map((supplier) => (
                                        <tr key={supplier.id}>
                                            <td>
                                                <Badge bg="secondary">{supplier.supplier_code}</Badge>
                                            </td>
                                            <td>
                                                <div>
                                                    <div className="fw-bold">{supplier.supplier_name}</div>
                                                    {supplier.address && (
                                                        <small className="text-muted">
                                                            <MapPin size={12} className="me-1" />
                                                            {supplier.address}
                                                        </small>
                                                    )}
                                                </div>
                                            </td>
                                            <td>{supplier.contact_person || '-'}</td>
                                            <td>
                                                {supplier.phone ? (
                                                    <div>
                                                        <Phone size={12} className="me-1" />
                                                        {supplier.phone}
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td>
                                                {supplier.email ? (
                                                    <div>
                                                        <Mail size={12} className="me-1" />
                                                        {supplier.email}
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td>{supplier.terms || '-'}</td>
                                            <td>{supplier.currency}</td>
                                            <td>
                                                <Badge bg={supplier.is_active ? 'success' : 'danger'}>
                                                    {supplier.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                            <td>
                                                <div className="btn-group-vertical btn-group-sm">
                                                    <Button
                                                        variant="outline-primary"
                                                        size="sm"
                                                        onClick={() => handleEdit(supplier)}
                                                    >
                                                        <Edit size={12} />
                                                    </Button>
                                                    <Button
                                                        variant="outline-danger"
                                                        size="sm"
                                                        onClick={() => handleDelete(supplier)}
                                                    >
                                                        <Trash2 size={12} />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>

                            {filteredSuppliers.length === 0 && (
                                <div className="text-center p-4">
                                    <Building className="mb-2" size={48} />
                                    <p>No suppliers found.</p>
                                    <Button variant="primary" onClick={() => setShowModal(true)}>
                                        <Plus className="me-2" size={16} />
                                        Add First Supplier
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </Card.Body>
            </Card>

            {/* Add/Edit Supplier Modal */}
            <Modal show={showModal} onHide={handleCloseModal} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        {editingSupplier ? (
                            <>
                                <Edit className="me-2" size={20} />
                                Edit Supplier
                            </>
                        ) : (
                            <>
                                <Plus className="me-2" size={20} />
                                Add New Supplier
                            </>
                        )}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleSubmit}>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Supplier Code *</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="supplier_code"
                                        value={formData.supplier_code}
                                        onChange={handleInputChange}
                                        placeholder="SUP001"
                                        required
                                        disabled={editingSupplier}
                                    />
                                    <Form.Text className="text-muted">
                                        Unique code for the supplier
                                    </Form.Text>
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Supplier Name *</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="supplier_name"
                                        value={formData.supplier_name}
                                        onChange={handleInputChange}
                                        placeholder="Mercedes-Benz Philippines"
                                        required
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Contact Person</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="contact_person"
                                        value={formData.contact_person}
                                        onChange={handleInputChange}
                                        placeholder="John Smith"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Phone</Form.Label>
                                    <Form.Control
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        placeholder="+63-2-123-4567"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Email</Form.Label>
                                    <Form.Control
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        placeholder="contact@supplier.com"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Currency</Form.Label>
                                    <Form.Select
                                        name="currency"
                                        value={formData.currency}
                                        onChange={handleInputChange}
                                    >
                                        <option value="PHP">PHP - Philippine Peso</option>
                                        <option value="USD">USD - US Dollar</option>
                                        <option value="EUR">EUR - Euro</option>
                                        <option value="JPY">JPY - Japanese Yen</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>

                        <Row>
                            <Col md={12}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Address</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={2}
                                        name="address"
                                        value={formData.address}
                                        onChange={handleInputChange}
                                        placeholder="123 Business Street, Makati City, Philippines"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Payment Terms</Form.Label>
                                    <Form.Select
                                        name="terms"
                                        value={formData.terms}
                                        onChange={handleInputChange}
                                    >
                                        <option value="">Select Terms</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Net 15">Net 15</option>
                                        <option value="Net 30">Net 30</option>
                                        <option value="Net 45">Net 45</option>
                                        <option value="Net 60">Net 60</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Status</Form.Label>
                                    <Form.Check
                                        type="switch"
                                        name="is_active"
                                        label="Active"
                                        checked={formData.is_active}
                                        onChange={handleInputChange}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseModal}>
                        <X className="me-2" size={16} />
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <div className="spinner-border spinner-border-sm me-2" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="me-2" size={16} />
                                {editingSupplier ? 'Update' : 'Save'} Supplier
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default Suppliers;

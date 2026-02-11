import React, { useState, useEffect, useContext } from 'react';
import { Container, Row, Col, Card, Table, Button, Alert, Modal, Form, InputGroup, Badge } from 'react-bootstrap';
import { AuthContext } from '../AuthContext';
import { Plus, Edit, Trash2, User, Phone, Mail, MapPin, Save, X, Search } from 'lucide-react';

const Customers = () => {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [customers, setCustomers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Form data state
    const [formData, setFormData] = useState({
        customer_code: '',
        customer_name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        credit_limit: 0,
        payment_terms: 'Cash',
        is_active: true
    });

    // Load customers on component mount
    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/customers', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            setCustomers(data);
        } catch (error) {
            console.error('Error fetching customers:', error);
            setError('Failed to fetch customers: ' + error.message);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const url = editingCustomer 
                ? `/api/customers/${editingCustomer.id}`
                : '/api/customers';
            
            const method = editingCustomer ? 'PUT' : 'POST';

            const token = localStorage.getItem('token');
            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                setSuccess(editingCustomer ? 'Customer updated successfully' : 'Customer added successfully');
                setShowModal(false);
                resetForm();
                fetchCustomers();
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to save customer');
            }
        } catch (error) {
            setError('Failed to save customer');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (customer) => {
        setEditingCustomer(customer);
        setFormData({
            customer_code: customer.customer_code,
            customer_name: customer.customer_name,
            contact_person: customer.contact_person || '',
            phone: customer.phone || '',
            email: customer.email || '',
            address: customer.address || '',
            credit_limit: customer.credit_limit || 0,
            payment_terms: customer.payment_terms || 'Cash',
            is_active: customer.is_active
        });
        setShowModal(true);
    };

    const handleDelete = async (customer) => {
        if (window.confirm(`Are you sure you want to deactivate ${customer.customer_name}?`)) {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/customers/${customer.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    setSuccess('Customer deactivated successfully');
                    fetchCustomers();
                } else {
                    const errorData = await response.json();
                    setError(errorData.error || 'Failed to deactivate customer');
                }
            } catch (error) {
                setError('Failed to deactivate customer');
            }
        }
    };

    const resetForm = () => {
        setFormData({
            customer_code: '',
            customer_name: '',
            contact_person: '',
            phone: '',
            email: '',
            address: '',
            credit_limit: 0,
            payment_terms: 'Cash',
            is_active: true
        });
        setEditingCustomer(null);
    };

    const handleModalClose = () => {
        setShowModal(false);
        resetForm();
    };

    const filteredCustomers = customers.filter(customer =>
        customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.customer_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.contact_person && customer.contact_person.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP'
        }).format(amount);
    };

    return (
        <Container fluid className="component-wrapper">
            <div className="component-header mb-4">
                <h2><User className="me-2" />Customers</h2>
                <p className="text-muted">Manage customer information (like TRACK.EXE CUSTINFO.DBF)</p>
            </div>

            {error && <Alert variant="danger">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}

            <Card>
                <Card.Header>
                    <Row className="align-items-center">
                        <Col>
                            <h5 className="mb-0">Customer List</h5>
                        </Col>
                        <Col md={4}>
                            <InputGroup>
                                <InputGroup.Text>
                                    <Search size={16} />
                                </InputGroup.Text>
                                <Form.Control
                                    type="text"
                                    placeholder="Search customers..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </InputGroup>
                        </Col>
                        <Col md="auto">
                            <Button 
                                variant="primary" 
                                onClick={() => setShowModal(true)}
                            >
                                <Plus className="me-2" size={16} />
                                Add Customer
                            </Button>
                        </Col>
                    </Row>
                </Card.Header>
                <Card.Body>
                    {filteredCustomers.length === 0 ? (
                        <div className="text-center p-4">
                            <User className="mb-2" size={48} />
                            <p>No customers found.</p>
                            <Button variant="primary" onClick={() => setShowModal(true)}>
                                <Plus className="me-2" size={16} />
                                Add First Customer
                            </Button>
                        </div>
                    ) : (
                        <Table responsive hover>
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Customer Name</th>
                                    <th>Contact Person</th>
                                    <th>Phone</th>
                                    <th>Email</th>
                                    <th>Address</th>
                                    <th>Credit Limit</th>
                                    <th>Payment Terms</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.map(customer => (
                                    <tr key={customer.id}>
                                        <td>
                                            <Badge bg="secondary">{customer.customer_code}</Badge>
                                        </td>
                                        <td>
                                            <strong>{customer.customer_name}</strong>
                                        </td>
                                        <td>{customer.contact_person || '-'}</td>
                                        <td>
                                            {customer.phone ? (
                                                <a href={`tel:${customer.phone}`} className="text-decoration-none">
                                                    <Phone size={14} className="me-1" />
                                                    {customer.phone}
                                                </a>
                                            ) : '-'}
                                        </td>
                                        <td>
                                            {customer.email ? (
                                                <a href={`mailto:${customer.email}`} className="text-decoration-none">
                                                    <Mail size={14} className="me-1" />
                                                    {customer.email}
                                                </a>
                                            ) : '-'}
                                        </td>
                                        <td>
                                            <div style={{ maxWidth: '200px' }}>
                                                {customer.address ? (
                                                    <span title={customer.address}>
                                                        <MapPin size={14} className="me-1" />
                                                        {customer.address.length > 30 
                                                            ? `${customer.address.substring(0, 30)}...` 
                                                            : customer.address
                                                        }
                                                    </span>
                                                ) : '-'}
                                            </div>
                                        </td>
                                        <td>
                                            {customer.credit_limit > 0 ? formatCurrency(customer.credit_limit) : '-'}
                                        </td>
                                        <td>
                                            <Badge bg="info">{customer.payment_terms}</Badge>
                                        </td>
                                        <td>
                                            <Badge bg={customer.is_active ? 'success' : 'danger'}>
                                                {customer.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </td>
                                        <td>
                                            <div className="d-flex gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="outline-primary"
                                                    onClick={() => handleEdit(customer)}
                                                >
                                                    <Edit size={14} />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline-danger"
                                                    onClick={() => handleDelete(customer)}
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </Card.Body>
            </Card>

            {/* Customer Modal */}
            <Modal show={showModal} onHide={handleModalClose} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleSubmit}>
                    <Modal.Body>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Customer Code *</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={formData.customer_code}
                                        onChange={(e) => setFormData(prev => ({ ...prev, customer_code: e.target.value.toUpperCase() }))}
                                        placeholder="e.g., CUST001"
                                        required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Customer Name *</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={formData.customer_name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value.toUpperCase() }))}
                                        placeholder="Enter customer name"
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
                                        value={formData.contact_person}
                                        onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                                        placeholder="Enter contact person name"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Phone</Form.Label>
                                    <Form.Control
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        placeholder="Enter phone number"
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
                                        value={formData.email}
                                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                        placeholder="Enter email address"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Credit Limit</Form.Label>
                                    <Form.Control
                                        type="number"
                                        step="0.01"
                                        value={formData.credit_limit}
                                        onChange={(e) => setFormData(prev => ({ ...prev, credit_limit: parseFloat(e.target.value) || 0 }))}
                                        placeholder="Enter credit limit"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Payment Terms</Form.Label>
                                    <Form.Select
                                        value={formData.payment_terms}
                                        onChange={(e) => setFormData(prev => ({ ...prev, payment_terms: e.target.value }))}
                                    >
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
                                    <Form.Select
                                        value={formData.is_active ? '1' : '0'}
                                        onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.value === '1' }))}
                                    >
                                        <option value="1">Active</option>
                                        <option value="0">Inactive</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>

                        <Form.Group className="mb-3">
                            <Form.Label>Address</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                value={formData.address}
                                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                placeholder="Enter customer address"
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleModalClose}>
                            <X className="me-2" size={16} />
                            Cancel
                        </Button>
                        <Button variant="primary" type="submit" disabled={loading}>
                            <Save className="me-2" size={16} />
                            {loading ? 'Saving...' : (editingCustomer ? 'Update Customer' : 'Add Customer')}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </Container>
    );
};

export default Customers;

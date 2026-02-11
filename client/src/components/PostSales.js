import React, { useState, useEffect, useContext } from 'react';
import { Container, Row, Col, Card, Table, Button, Alert, Badge, Modal, Form, Tabs, Tab } from 'react-bootstrap';
import { AuthContext } from '../AuthContext';
import { CheckCircle, XCircle, Clock, ShoppingCart, DollarSign, User, Calendar, Package } from 'lucide-react';

const PostSales = () => {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [pendingSales, setPendingSales] = useState([]);
    const [approvedSales, setApprovedSales] = useState([]);
    const [postedSales, setPostedSales] = useState([]);
    const [selectedSales, setSelectedSales] = useState([]);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectingSale, setRejectingSale] = useState(null);

    // Load data on component mount
    useEffect(() => {
        fetchPendingSales();
        fetchApprovedSales();
        fetchPostedSales();
    }, []);

    const fetchPendingSales = async () => {
        try {
            const response = await fetch('/api/sales/pending');
            const data = await response.json();
            setPendingSales(data);
        } catch (error) {
            console.error('Error fetching pending sales:', error);
        }
    };

    const fetchApprovedSales = async () => {
        try {
            const response = await fetch('/api/sales/approved');
            const data = await response.json();
            setApprovedSales(data);
        } catch (error) {
            console.error('Error fetching approved sales:', error);
        }
    };

    const fetchPostedSales = async () => {
        try {
            const response = await fetch('/api/sales/posted');
            const data = await response.json();
            setPostedSales(data);
        } catch (error) {
            console.error('Error fetching posted sales:', error);
        }
    };

    const approveSale = async (saleId) => {
        try {
            const response = await fetch(`/api/sales/approve/${saleId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ approved_by: user.username })
            });

            if (response.ok) {
                setSuccess('Sale approved successfully');
                fetchPendingSales();
                fetchApprovedSales();
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to approve sale');
            }
        } catch (error) {
            setError('Failed to approve sale');
        }
    };

    const rejectSale = async (saleId, reason) => {
        try {
            const response = await fetch(`/api/sales/reject/${saleId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    rejected_by: user.username,
                    rejection_reason: reason
                })
            });

            if (response.ok) {
                setSuccess('Sale rejected successfully');
                fetchPendingSales();
                setShowRejectModal(false);
                setRejectReason('');
                setRejectingSale(null);
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to reject sale');
            }
        } catch (error) {
            setError('Failed to reject sale');
        }
    };

    const postSales = async () => {
        if (selectedSales.length === 0) {
            setError('Please select sales to post');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/sales/post', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    sale_ids: selectedSales,
                    posted_by: user.username
                })
            });

            if (response.ok) {
                setSuccess(`Successfully posted ${selectedSales.length} sales`);
                setSelectedSales([]);
                fetchApprovedSales();
                fetchPostedSales();
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to post sales');
            }
        } catch (error) {
            setError('Failed to post sales');
        } finally {
            setLoading(false);
        }
    };

    const toggleSaleSelection = (saleId) => {
        setSelectedSales(prev => 
            prev.includes(saleId) 
                ? prev.filter(id => id !== saleId)
                : [...prev, saleId]
        );
    };

    const selectAllSales = () => {
        if (selectedSales.length === approvedSales.length) {
            setSelectedSales([]);
        } else {
            setSelectedSales(approvedSales.map(sale => sale.id));
        }
    };

    const openRejectModal = (sale) => {
        setRejectingSale(sale);
        setShowRejectModal(true);
    };

    const handleReject = () => {
        if (rejectingSale && rejectReason.trim()) {
            rejectSale(rejectingSale.id, rejectReason);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP'
        }).format(amount);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-PH');
    };

    const getTotalValue = (sales) => {
        return sales.reduce((total, sale) => total + (sale.amount || 0), 0);
    };

    return (
        <Container fluid className="component-wrapper">
            <div className="component-header mb-4">
                <h2><CheckCircle className="me-2" />Post Sales</h2>
                <p className="text-muted">Review and post sales (like TRACK.EXE "Post New Outgoing Stocks")</p>
            </div>

            {error && <Alert variant="danger">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}

            <Tabs defaultActiveKey="pending" className="mb-4">
                {/* Pending Sales Tab */}
                <Tab eventKey="pending" title={
                    <span>
                        <Clock className="me-1" size={16} />
                        Pending ({pendingSales.length})
                    </span>
                }>
                    <Card>
                        <Card.Header>
                            <h5><Clock className="me-2" />Pending Sales Review</h5>
                            <p className="mb-0 text-muted">
                                Total Value: {formatCurrency(getTotalValue(pendingSales))}
                            </p>
                        </Card.Header>
                        <Card.Body>
                            {pendingSales.length === 0 ? (
                                <div className="text-center py-4">
                                    <Clock size={48} className="text-muted mb-3" />
                                    <p className="text-muted">No pending sales to review</p>
                                </div>
                            ) : (
                                <Table responsive hover>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Receipt</th>
                                            <th>Customer</th>
                                            <th>Product</th>
                                            <th>Description</th>
                                            <th>Qty</th>
                                            <th>Price</th>
                                            <th>Amount</th>
                                            <th>Stock</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingSales.map(sale => (
                                            <tr key={sale.id}>
                                                <td>{formatDate(sale.date)}</td>
                                                <td>
                                                    <Badge bg="secondary">{sale.receipt}</Badge>
                                                    {sale.invoice === 'Y' && (
                                                        <Badge bg="info" className="ms-1">Invoice</Badge>
                                                    )}
                                                </td>
                                                <td>
                                                    <div>
                                                        <strong>{sale.customer}</strong>
                                                        {sale.customer_name && (
                                                            <>
                                                                <br />
                                                                <small className="text-muted">{sale.customer_name}</small>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div>
                                                        <strong>{sale.benz_number}</strong>
                                                        <br />
                                                        <small className="text-muted">{sale.brand} - {sale.altno}</small>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ maxWidth: '200px' }}>
                                                        {sale.description}
                                                    </div>
                                                </td>
                                                <td>
                                                    <Badge bg="primary">{sale.quantity}</Badge>
                                                </td>
                                                <td>{formatCurrency(sale.selling_price)}</td>
                                                <td>
                                                    <strong>{formatCurrency(sale.amount)}</strong>
                                                </td>
                                                <td>
                                                    <Badge bg={sale.stock_quantity > 0 ? 'success' : 'danger'}>
                                                        {sale.stock_quantity}
                                                    </Badge>
                                                </td>
                                                <td>
                                                    <div className="d-flex gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="success"
                                                            onClick={() => approveSale(sale.id)}
                                                            disabled={sale.stock_quantity < sale.quantity}
                                                        >
                                                            <CheckCircle size={14} />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="danger"
                                                            onClick={() => openRejectModal(sale)}
                                                        >
                                                            <XCircle size={14} />
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
                </Tab>

                {/* Approved Sales Tab */}
                <Tab eventKey="approved" title={
                    <span>
                        <CheckCircle className="me-1" size={16} />
                        Approved ({approvedSales.length})
                    </span>
                }>
                    <Card>
                        <Card.Header>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h5><CheckCircle className="me-2" />Approved Sales Ready to Post</h5>
                                    <p className="mb-0 text-muted">
                                        Total Value: {formatCurrency(getTotalValue(approvedSales))}
                                    </p>
                                </div>
                                <div>
                                    <Button
                                        variant="outline-primary"
                                        onClick={selectAllSales}
                                        className="me-2"
                                    >
                                        {selectedSales.length === approvedSales.length ? 'Deselect All' : 'Select All'}
                                    </Button>
                                    <Button
                                        variant="success"
                                        onClick={postSales}
                                        disabled={loading || selectedSales.length === 0}
                                    >
                                        <ShoppingCart className="me-2" size={16} />
                                        {loading ? 'Posting...' : `Post ${selectedSales.length} Sales`}
                                    </Button>
                                </div>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {approvedSales.length === 0 ? (
                                <div className="text-center py-4">
                                    <CheckCircle size={48} className="text-muted mb-3" />
                                    <p className="text-muted">No approved sales ready to post</p>
                                </div>
                            ) : (
                                <Table responsive hover>
                                    <thead>
                                        <tr>
                                            <th>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedSales.length === approvedSales.length && approvedSales.length > 0}
                                                    onChange={selectAllSales}
                                                />
                                            </th>
                                            <th>Date</th>
                                            <th>Receipt</th>
                                            <th>Customer</th>
                                            <th>Product</th>
                                            <th>Description</th>
                                            <th>Qty</th>
                                            <th>Price</th>
                                            <th>Amount</th>
                                            <th>Approved By</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {approvedSales.map(sale => (
                                            <tr key={sale.id}>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedSales.includes(sale.id)}
                                                        onChange={() => toggleSaleSelection(sale.id)}
                                                    />
                                                </td>
                                                <td>{formatDate(sale.date)}</td>
                                                <td>
                                                    <Badge bg="secondary">{sale.receipt}</Badge>
                                                    {sale.invoice === 'Y' && (
                                                        <Badge bg="info" className="ms-1">Invoice</Badge>
                                                    )}
                                                </td>
                                                <td>
                                                    <div>
                                                        <strong>{sale.customer}</strong>
                                                        {sale.customer_name && (
                                                            <>
                                                                <br />
                                                                <small className="text-muted">{sale.customer_name}</small>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div>
                                                        <strong>{sale.benz_number}</strong>
                                                        <br />
                                                        <small className="text-muted">{sale.brand} - {sale.altno}</small>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ maxWidth: '200px' }}>
                                                        {sale.description}
                                                    </div>
                                                </td>
                                                <td>
                                                    <Badge bg="primary">{sale.quantity}</Badge>
                                                </td>
                                                <td>{formatCurrency(sale.selling_price)}</td>
                                                <td>
                                                    <strong>{formatCurrency(sale.amount)}</strong>
                                                </td>
                                                <td>
                                                    <small className="text-muted">
                                                        {sale.approved_by}
                                                        <br />
                                                        {formatDate(sale.approved_at)}
                                                    </small>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            )}
                        </Card.Body>
                    </Card>
                </Tab>

                {/* Posted Sales Tab */}
                <Tab eventKey="posted" title={
                    <span>
                        <Package className="me-1" size={16} />
                        Posted ({postedSales.length})
                    </span>
                }>
                    <Card>
                        <Card.Header>
                            <h5><Package className="me-2" />Posted Sales History</h5>
                            <p className="mb-0 text-muted">
                                Total Value: {formatCurrency(getTotalValue(postedSales))}
                            </p>
                        </Card.Header>
                        <Card.Body>
                            {postedSales.length === 0 ? (
                                <div className="text-center py-4">
                                    <Package size={48} className="text-muted mb-3" />
                                    <p className="text-muted">No posted sales yet</p>
                                </div>
                            ) : (
                                <Table responsive hover>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Receipt</th>
                                            <th>Customer</th>
                                            <th>Product</th>
                                            <th>Description</th>
                                            <th>Qty</th>
                                            <th>Price</th>
                                            <th>Amount</th>
                                            <th>Posted By</th>
                                            <th>Posted At</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {postedSales.map(sale => (
                                            <tr key={sale.id}>
                                                <td>{formatDate(sale.date)}</td>
                                                <td>
                                                    <Badge bg="secondary">{sale.receipt}</Badge>
                                                    {sale.invoice === 'Y' && (
                                                        <Badge bg="info" className="ms-1">Invoice</Badge>
                                                    )}
                                                </td>
                                                <td>
                                                    <div>
                                                        <strong>{sale.customer}</strong>
                                                        {sale.customer_name && (
                                                            <>
                                                                <br />
                                                                <small className="text-muted">{sale.customer_name}</small>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div>
                                                        <strong>{sale.benz_number}</strong>
                                                        <br />
                                                        <small className="text-muted">{sale.brand} - {sale.altno}</small>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ maxWidth: '200px' }}>
                                                        {sale.description}
                                                    </div>
                                                </td>
                                                <td>
                                                    <Badge bg="success">{sale.quantity}</Badge>
                                                </td>
                                                <td>{formatCurrency(sale.selling_price)}</td>
                                                <td>
                                                    <strong>{formatCurrency(sale.amount)}</strong>
                                                </td>
                                                <td>
                                                    <small className="text-muted">{sale.posted_by}</small>
                                                </td>
                                                <td>
                                                    <small className="text-muted">
                                                        {formatDate(sale.posted_at)}
                                                    </small>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            )}
                        </Card.Body>
                    </Card>
                </Tab>
            </Tabs>

            {/* Reject Modal */}
            <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Reject Sale</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {rejectingSale && (
                        <div className="mb-3">
                            <h6>Sale Details:</h6>
                            <p>
                                <strong>Receipt:</strong> {rejectingSale.receipt}<br />
                                <strong>Customer:</strong> {rejectingSale.customer}<br />
                                <strong>Product:</strong> {rejectingSale.benz_number} - {rejectingSale.brand}<br />
                                <strong>Amount:</strong> {formatCurrency(rejectingSale.amount)}
                            </p>
                        </div>
                    )}
                    <Form.Group>
                        <Form.Label>Rejection Reason</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Enter reason for rejection..."
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
                        Cancel
                    </Button>
                    <Button 
                        variant="danger" 
                        onClick={handleReject}
                        disabled={!rejectReason.trim()}
                    >
                        Reject Sale
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default PostSales;

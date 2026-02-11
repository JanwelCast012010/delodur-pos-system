import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Container, Row, Col, Card, Table, Button, Alert, Badge, Modal, Form, InputGroup, Pagination } from 'react-bootstrap';
import { AuthContext } from '../AuthContext';
import { CheckCircle, XCircle, Eye, Package, Clock, AlertTriangle, CheckSquare, Square } from 'lucide-react';

const PostStocks = () => {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [incomingStock, setIncomingStock] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [itemsPerPage] = useState(25);
    const [filter, setFilter] = useState('pending'); // pending, approved, all
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [itemToReject, setItemToReject] = useState(null);

    // Fetch incoming stock data
    const fetchIncomingStock = useCallback(async (page = 1, status = 'pending') => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const params = new URLSearchParams({
                page: page.toString(),
                limit: itemsPerPage.toString(),
                status: status
            });

            const response = await fetch(`/api/incoming?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const result = await response.json();
            if (result.success) {
                setIncomingStock(result.data);
                setTotalPages(result.pagination.pages);
                setCurrentPage(result.pagination.page);
            } else {
                setError(result.error || 'Failed to fetch incoming stock');
            }
        } catch (error) {
            setError('Error fetching incoming stock: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, [itemsPerPage]);

    useEffect(() => {
        fetchIncomingStock(1, filter);
    }, [fetchIncomingStock, filter]);

    const handleFilterChange = (newFilter) => {
        setFilter(newFilter);
        setCurrentPage(1);
        setSelectedItems([]);
    };

    const handlePageChange = (page) => {
        setCurrentPage(page);
        fetchIncomingStock(page, filter);
    };

    const handleSelectItem = (itemId) => {
        setSelectedItems(prev => {
            if (prev.includes(itemId)) {
                return prev.filter(id => id !== itemId);
            } else {
                return [...prev, itemId];
            }
        });
    };

    const handleSelectAll = () => {
        if (selectedItems.length === incomingStock.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(incomingStock.map(item => item.id));
        }
    };

    const handleApprove = async (itemId) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/incoming/${itemId}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    approved_by: user?.username || 'system'
                })
            });

            const result = await response.json();
            if (result.success) {
                setSuccess('Item approved successfully');
                fetchIncomingStock(currentPage, filter);
                setSelectedItems(prev => prev.filter(id => id !== itemId));
            } else {
                setError(result.error || 'Failed to approve item');
            }
        } catch (error) {
            setError('Error approving item: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        if (!itemToReject || !rejectReason.trim()) {
            setError('Please provide a rejection reason');
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/incoming/${itemToReject.id}/reject`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    rejected_by: user?.username || 'system',
                    rejection_reason: rejectReason
                })
            });

            const result = await response.json();
            if (result.success) {
                setSuccess('Item rejected successfully');
                fetchIncomingStock(currentPage, filter);
                setShowRejectModal(false);
                setRejectReason('');
                setItemToReject(null);
                setSelectedItems(prev => prev.filter(id => id !== itemToReject.id));
            } else {
                setError(result.error || 'Failed to reject item');
            }
        } catch (error) {
            setError('Error rejecting item: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBulkApprove = async () => {
        if (selectedItems.length === 0) {
            setError('Please select items to approve');
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            // Approve each selected item
            const approvePromises = selectedItems.map(itemId => 
                fetch(`/api/incoming/${itemId}/approve`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        approved_by: user?.username || 'system'
                    })
                })
            );

            await Promise.all(approvePromises);
            setSuccess(`${selectedItems.length} items approved successfully`);
            fetchIncomingStock(currentPage, filter);
            setSelectedItems([]);
        } catch (error) {
            setError('Error approving items: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePostToInventory = async () => {
        const approvedItems = incomingStock.filter(item => 
            item.status === 'approved' && selectedItems.includes(item.id)
        );

        if (approvedItems.length === 0) {
            setError('Please select approved items to post to inventory');
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch('/api/incoming/post', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    incoming_ids: approvedItems.map(item => item.id),
                    posted_by: user?.username || 'system'
                })
            });

            const result = await response.json();
            if (result.success) {
                setSuccess(`${approvedItems.length} items posted to inventory successfully`);
                fetchIncomingStock(currentPage, filter);
                setSelectedItems([]);
            } else {
                setError(result.error || 'Failed to post items to inventory');
            }
        } catch (error) {
            setError('Error posting items to inventory: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'pending':
                return <Badge bg="warning"><Clock className="me-1" size={12} />Pending</Badge>;
            case 'approved':
                return <Badge bg="success"><CheckCircle className="me-1" size={12} />Approved</Badge>;
            case 'rejected':
                return <Badge bg="danger"><XCircle className="me-1" size={12} />Rejected</Badge>;
            default:
                return <Badge bg="secondary">{status}</Badge>;
        }
    };

    const getDaysPending = (createdAt) => {
        const created = new Date(createdAt);
        const now = new Date();
        const diffTime = Math.abs(now - created);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    return (
        <Container fluid className="component-wrapper">
            <div className="component-header mb-4">
                <h2><Package className="me-2" />Post Stocks</h2>
                <p className="text-muted">Review and post incoming stock to inventory (like TRACK.EXE "Post New Incoming Stocks")</p>
            </div>

            {error && <Alert variant="danger">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}

            {/* Filter and Action Buttons */}
            <Row className="mb-3">
                <Col md={6}>
                    <div className="btn-group" role="group">
                        <Button
                            variant={filter === 'pending' ? 'primary' : 'outline-primary'}
                            onClick={() => handleFilterChange('pending')}
                        >
                            <Clock className="me-2" size={16} />
                            Pending ({incomingStock.filter(item => item.status === 'pending').length})
                        </Button>
                        <Button
                            variant={filter === 'approved' ? 'primary' : 'outline-primary'}
                            onClick={() => handleFilterChange('approved')}
                        >
                            <CheckCircle className="me-2" size={16} />
                            Approved ({incomingStock.filter(item => item.status === 'approved').length})
                        </Button>
                        <Button
                            variant={filter === 'all' ? 'primary' : 'outline-primary'}
                            onClick={() => handleFilterChange('all')}
                        >
                            <Eye className="me-2" size={16} />
                            All
                        </Button>
                    </div>
                </Col>
                <Col md={6} className="text-end">
                    {selectedItems.length > 0 && (
                        <div className="btn-group">
                            {filter === 'pending' && (
                                <Button
                                    variant="success"
                                    onClick={handleBulkApprove}
                                    disabled={loading}
                                >
                                    <CheckCircle className="me-2" size={16} />
                                    Approve Selected ({selectedItems.length})
                                </Button>
                            )}
                            {filter === 'approved' && (
                                <Button
                                    variant="primary"
                                    onClick={handlePostToInventory}
                                    disabled={loading}
                                >
                                    <Package className="me-2" size={16} />
                                    Post to Inventory ({selectedItems.length})
                                </Button>
                            )}
                        </div>
                    )}
                </Col>
            </Row>

            {/* Incoming Stock Table */}
            <Card>
                <Card.Header>
                    <Row className="align-items-center">
                        <Col>
                            <h5>Incoming Stock Items</h5>
                        </Col>
                        <Col className="text-end">
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={handleSelectAll}
                            >
                                {selectedItems.length === incomingStock.length ? 
                                    <CheckSquare className="me-1" size={16} /> : 
                                    <Square className="me-1" size={16} />
                                }
                                Select All
                            </Button>
                        </Col>
                    </Row>
                </Card.Header>
                <Card.Body>
                    {loading ? (
                        <div className="text-center p-4">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <p className="mt-2">Loading incoming stock...</p>
                        </div>
                    ) : (
                        <>
                            <div className="table-responsive">
                                <Table striped bordered hover size="sm">
                                    <thead>
                                        <tr>
                                            <th width="50">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.length === incomingStock.length && incomingStock.length > 0}
                                                    onChange={handleSelectAll}
                                                />
                                            </th>
                                            <th>Date</th>
                                            <th>Reference</th>
                                            <th>Supplier</th>
                                            <th>Benz #</th>
                                            <th>Brand</th>
                                            <th>Description</th>
                                            <th>Quantity</th>
                                            <th>Cost</th>
                                            <th>Price</th>
                                            <th>Status</th>
                                            <th>Days</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {incomingStock.map((item) => (
                                            <tr key={item.id}>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedItems.includes(item.id)}
                                                        onChange={() => handleSelectItem(item.id)}
                                                    />
                                                </td>
                                                <td>{new Date(item.date).toLocaleDateString()}</td>
                                                <td>{item.reference}</td>
                                                <td>
                                                    <div>
                                                        <div>{item.supplier}</div>
                                                        <small className="text-muted">{item.supplier_name}</small>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div>
                                                        <div>{item.benz_number}</div>
                                                        {item.benz_number2 && <small className="text-muted">{item.benz_number2}</small>}
                                                        {item.benz_number3 && <small className="text-muted">{item.benz_number3}</small>}
                                                    </div>
                                                </td>
                                                <td>{item.brand}</td>
                                                <td>
                                                    <div className="text-truncate" style={{ maxWidth: '200px' }} title={item.description}>
                                                        {item.description}
                                                    </div>
                                                </td>
                                                <td>{item.quantity}</td>
                                                <td>₱{parseFloat(item.cost).toLocaleString()}</td>
                                                <td>₱{parseFloat(item.selling_price).toLocaleString()}</td>
                                                <td>{getStatusBadge(item.status)}</td>
                                                <td>
                                                    <span className={getDaysPending(item.created_at) > 7 ? 'text-danger' : 'text-muted'}>
                                                        {getDaysPending(item.created_at)}d
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="btn-group-vertical btn-group-sm">
                                                        {item.status === 'pending' && (
                                                            <>
                                                                <Button
                                                                    variant="success"
                                                                    size="sm"
                                                                    onClick={() => handleApprove(item.id)}
                                                                    disabled={loading}
                                                                >
                                                                    <CheckCircle size={12} />
                                                                </Button>
                                                                <Button
                                                                    variant="danger"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setItemToReject(item);
                                                                        setShowRejectModal(true);
                                                                    }}
                                                                    disabled={loading}
                                                                >
                                                                    <XCircle size={12} />
                                                                </Button>
                                                            </>
                                                        )}
                                                        {item.status === 'approved' && (
                                                            <Button
                                                                variant="primary"
                                                                size="sm"
                                                                onClick={() => handlePostToInventory()}
                                                                disabled={loading}
                                                            >
                                                                <Package size={12} />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </div>

                            {incomingStock.length === 0 && (
                                <div className="text-center p-4">
                                    <AlertTriangle className="mb-2" size={48} />
                                    <p>No incoming stock items found.</p>
                                </div>
                            )}

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="d-flex justify-content-center mt-3">
                                    <Pagination>
                                        <Pagination.First 
                                            onClick={() => handlePageChange(1)}
                                            disabled={currentPage === 1}
                                        />
                                        <Pagination.Prev 
                                            onClick={() => handlePageChange(currentPage - 1)}
                                            disabled={currentPage === 1}
                                        />
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            const page = i + 1;
                                            return (
                                                <Pagination.Item
                                                    key={page}
                                                    active={page === currentPage}
                                                    onClick={() => handlePageChange(page)}
                                                >
                                                    {page}
                                                </Pagination.Item>
                                            );
                                        })}
                                        <Pagination.Next 
                                            onClick={() => handlePageChange(currentPage + 1)}
                                            disabled={currentPage === totalPages}
                                        />
                                        <Pagination.Last 
                                            onClick={() => handlePageChange(totalPages)}
                                            disabled={currentPage === totalPages}
                                        />
                                    </Pagination>
                                </div>
                            )}
                        </>
                    )}
                </Card.Body>
            </Card>

            {/* Reject Modal */}
            <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title><XCircle className="me-2" />Reject Item</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Are you sure you want to reject this item?</p>
                    {itemToReject && (
                        <div className="mb-3">
                            <strong>Item:</strong> {itemToReject.benz_number} - {itemToReject.brand}
                            <br />
                            <strong>Description:</strong> {itemToReject.description}
                        </div>
                    )}
                    <Form.Group>
                        <Form.Label>Rejection Reason *</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Please provide a reason for rejection..."
                            required
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={handleReject} disabled={loading || !rejectReason.trim()}>
                        {loading ? 'Rejecting...' : 'Reject Item'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default PostStocks;

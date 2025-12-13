// =====================================================
// STOCK WORKFLOW API ENDPOINTS
// Implements TRACK.EXE workflow in modern API
// =====================================================

const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

// Database connection (adjust to your existing connection)
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'inventory_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// =====================================================
// INCOMING STOCK API ENDPOINTS
// =====================================================

// 1. Get all incoming stock (pending, approved, rejected)
router.get('/api/incoming', async (req, res) => {
    try {
        const { status, page = 1, limit = 25, search = '' } = req.query;
        const offset = (page - 1) * limit;
        
        let whereClause = '1=1';
        let params = [];
        
        if (status) {
            whereClause += ' AND i.status = ?';
            params.push(status);
        }
        
        if (search) {
            whereClause += ' AND (i.benz_number LIKE ? OR i.brand LIKE ? OR i.description LIKE ? OR i.supplier LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM tbl_incoming i 
            LEFT JOIN tbl_suppliers s ON i.supplier = s.supplier_code 
            WHERE ${whereClause}
        `;
        const [countResult] = await pool.execute(countQuery, params);
        const total = countResult[0].total;
        
        // Get data - create separate params array for data query
        const dataParams = [...params]; // Copy the original params
        dataParams.push(parseInt(limit), parseInt(offset));
        
        const dataQuery = `
            SELECT 
                i.*,
                s.supplier_name,
                DATEDIFF(CURDATE(), i.created_at) as days_pending
            FROM tbl_incoming i
            LEFT JOIN tbl_suppliers s ON i.supplier = s.supplier_code
            WHERE ${whereClause}
            ORDER BY i.created_at DESC
            LIMIT ? OFFSET ?
        `;
        
        const [rows] = await pool.execute(dataQuery, dataParams);
        
        res.json({
            success: true,
            data: rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching incoming stock:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Add new incoming stock
router.post('/api/incoming', async (req, res) => {
    try {
        const {
            date, reference, supplier, document_ref,
            din_flag, benz_number, benz_number2, benz_number3, brand, altno, altno2,
            description, application, color_code, remarks,
            cost, selling_price, currency, fc_cost, conversion,
            quantity, unit, reorder_point, location
        } = req.body;
        
        const query = `
            INSERT INTO tbl_incoming (
                date, reference, supplier, document_ref,
                din_flag, benz_number, benz_number2, benz_number3, brand, altno, altno2,
                description, application, color_code, remarks,
                cost, selling_price, currency, fc_cost, conversion,
                quantity, unit, reorder_point, location,
                created_by, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `;
        
        const params = [
            date, reference, supplier, document_ref,
            din_flag || '', benz_number, benz_number2 || '', benz_number3 || '', brand, altno || '', altno2 || '',
            description || '', application || '', color_code || '', remarks || '',
            cost || 0, selling_price || 0, currency || 'PHP', fc_cost || 0, conversion || 1,
            quantity || 0, unit || 'pcs', reorder_point || 0, location || '',
            req.user?.username || 'system'
        ];
        
        const [result] = await pool.execute(query, params);
        
        res.json({
            success: true,
            message: 'Incoming stock added successfully',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Error adding incoming stock:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Update incoming stock
router.put('/api/incoming/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        // Build dynamic update query
        const fields = [];
        const values = [];
        
        Object.keys(updateData).forEach(key => {
            if (key !== 'id' && updateData[key] !== undefined) {
                fields.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });
        
        if (fields.length === 0) {
            return res.status(400).json({ success: false, error: 'No fields to update' });
        }
        
        values.push(id);
        
        const query = `UPDATE tbl_incoming SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await pool.execute(query, values);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Incoming stock not found' });
        }
        
        res.json({
            success: true,
            message: 'Incoming stock updated successfully'
        });
    } catch (error) {
        console.error('Error updating incoming stock:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. Approve incoming stock
router.post('/api/incoming/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { approved_by } = req.body;
        
        const query = `
            UPDATE tbl_incoming 
            SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP 
            WHERE id = ? AND status = 'pending'
        `;
        
        const [result] = await pool.execute(query, [approved_by, id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Incoming stock not found or already processed' });
        }
        
        res.json({
            success: true,
            message: 'Incoming stock approved successfully'
        });
    } catch (error) {
        console.error('Error approving incoming stock:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. Reject incoming stock
router.post('/api/incoming/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const { rejected_by, rejection_reason } = req.body;
        
        const query = `
            UPDATE tbl_incoming 
            SET status = 'rejected', rejected_by = ?, rejected_at = CURRENT_TIMESTAMP, rejection_reason = ?
            WHERE id = ? AND status = 'pending'
        `;
        
        const [result] = await pool.execute(query, [rejected_by, rejection_reason, id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Incoming stock not found or already processed' });
        }
        
        res.json({
            success: true,
            message: 'Incoming stock rejected successfully'
        });
    } catch (error) {
        console.error('Error rejecting incoming stock:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. Post approved incoming stock to inventory
router.post('/api/incoming/post', async (req, res) => {
    try {
        const { incoming_ids, posted_by } = req.body;
        
        if (!Array.isArray(incoming_ids) || incoming_ids.length === 0) {
            return res.status(400).json({ success: false, error: 'No incoming stock IDs provided' });
        }
        
        // Use the stored procedure
        const query = 'CALL PostIncomingStock(?, ?)';
        const [result] = await pool.execute(query, [JSON.stringify(incoming_ids), posted_by]);
        
        res.json({
            success: true,
            message: `${incoming_ids.length} incoming stock items posted to inventory successfully`
        });
    } catch (error) {
        console.error('Error posting incoming stock:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// SUPPLIERS API ENDPOINTS
// =====================================================

// 7. Get all suppliers
router.get('/api/suppliers', async (req, res) => {
    try {
        const { search = '', active_only = true } = req.query;
        
        let whereClause = '1=1';
        let params = [];
        
        if (active_only === 'true') {
            whereClause += ' AND is_active = 1';
        }
        
        if (search) {
            whereClause += ' AND (supplier_code LIKE ? OR supplier_name LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }
        
        const query = `
            SELECT * FROM tbl_suppliers 
            WHERE ${whereClause}
            ORDER BY supplier_name
        `;
        
        const [rows] = await pool.execute(query, params);
        
        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching suppliers:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 8. Add new supplier
router.post('/api/suppliers', async (req, res) => {
    try {
        const {
            supplier_code, supplier_name, contact_person, phone, email,
            address, terms, currency
        } = req.body;
        
        const query = `
            INSERT INTO tbl_suppliers (
                supplier_code, supplier_name, contact_person, phone, email,
                address, terms, currency
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            supplier_code, supplier_name, contact_person, phone, email,
            address, terms, currency || 'PHP'
        ];
        
        const [result] = await pool.execute(query, params);
        
        res.json({
            success: true,
            message: 'Supplier added successfully',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Error adding supplier:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// PURCHASE HISTORY API ENDPOINTS
// =====================================================

// 9. Get purchase history (posted incoming stock)
router.get('/api/purchase-history', async (req, res) => {
    try {
        const { page = 1, limit = 25, start_date, end_date, supplier } = req.query;
        const offset = (page - 1) * limit;
        
        let whereClause = '1=1';
        let params = [];
        
        if (start_date) {
            whereClause += ' AND im.date >= ?';
            params.push(start_date);
        }
        
        if (end_date) {
            whereClause += ' AND im.date <= ?';
            params.push(end_date);
        }
        
        if (supplier) {
            whereClause += ' AND im.supplier = ?';
            params.push(supplier);
        }
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM inmain im 
            LEFT JOIN tbl_suppliers s ON im.supplier = s.supplier_code 
            WHERE ${whereClause}
        `;
        const [countResult] = await pool.execute(countQuery, params);
        const total = countResult[0].total;
        
        // Get data - create separate params array for data query
        const dataParams = [...params]; // Copy the original params
        dataParams.push(parseInt(limit), parseInt(offset));
        
        const dataQuery = `
            SELECT 
                im.*,
                s.supplier_name,
                i.created_at as original_created_at,
                i.created_by as original_created_by
            FROM inmain im
            LEFT JOIN tbl_suppliers s ON im.supplier = s.supplier_code
            LEFT JOIN tbl_incoming i ON im.incoming_id = i.id
            WHERE ${whereClause}
            ORDER BY im.posted_at DESC
            LIMIT ? OFFSET ?
        `;
        
        const [rows] = await pool.execute(dataQuery, dataParams);
        
        res.json({
            success: true,
            data: rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching purchase history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// DASHBOARD STATS API ENDPOINTS
// =====================================================

// 10. Get stock workflow statistics
router.get('/api/dashboard/stock-workflow-stats', async (req, res) => {
    try {
        const queries = [
            // Pending incoming stock count
            'SELECT COUNT(*) as pending_count FROM tbl_incoming WHERE status = "pending"',
            // Approved incoming stock count
            'SELECT COUNT(*) as approved_count FROM tbl_incoming WHERE status = "approved"',
            // Total pending value
            'SELECT COALESCE(SUM(quantity * cost), 0) as pending_value FROM tbl_incoming WHERE status = "pending"',
            // Recent incoming stock (last 7 days)
            'SELECT COUNT(*) as recent_count FROM tbl_incoming WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
            // Top suppliers by pending stock
            `SELECT s.supplier_name, COUNT(i.id) as pending_items, SUM(i.quantity * i.cost) as pending_value
             FROM tbl_incoming i
             LEFT JOIN tbl_suppliers s ON i.supplier = s.supplier_code
             WHERE i.status = 'pending'
             GROUP BY s.supplier_name
             ORDER BY pending_value DESC
             LIMIT 5`
        ];
        
        const [pendingResult, approvedResult, valueResult, recentResult, suppliersResult] = await Promise.all(
            queries.map(query => pool.execute(query))
        );
        
        res.json({
            success: true,
            data: {
                pending_count: pendingResult[0][0].pending_count,
                approved_count: approvedResult[0][0].approved_count,
                pending_value: valueResult[0][0].pending_value,
                recent_count: recentResult[0][0].recent_count,
                top_suppliers: suppliersResult[0]
            }
        });
    } catch (error) {
        console.error('Error fetching stock workflow stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// BULK IMPORT API ENDPOINTS
// =====================================================

// 11. Bulk import incoming stock from CSV/Excel
router.post('/api/incoming/bulk-import', async (req, res) => {
    try {
        const { items, created_by } = req.body;
        
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'No items provided for import' });
        }
        
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        
        try {
            const insertQuery = `
                INSERT INTO tbl_incoming (
                    date, reference, supplier, document_ref,
                    din_flag, benz_number, benz_number2, benz_number3, brand, altno, altno2,
                    description, application, color_code, remarks,
                    cost, selling_price, currency, fc_cost, conversion,
                    quantity, unit, reorder_point, location,
                    created_by, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            `;
            
            const insertedIds = [];
            
            for (const item of items) {
                const params = [
                    item.date || new Date().toISOString().split('T')[0],
                    item.reference || '',
                    item.supplier || '',
                    item.document_ref || '',
                    item.din_flag || '',
                    item.benz_number || '',
                    item.benz_number2 || '',
                    item.benz_number3 || '',
                    item.brand || '',
                    item.altno || '',
                    item.altno2 || '',
                    item.description || '',
                    item.application || '',
                    item.color_code || '',
                    item.remarks || '',
                    parseFloat(item.cost) || 0,
                    parseFloat(item.selling_price) || 0,
                    item.currency || 'PHP',
                    parseFloat(item.fc_cost) || 0,
                    parseFloat(item.conversion) || 1,
                    parseInt(item.quantity) || 0,
                    item.unit || 'pcs',
                    parseInt(item.reorder_point) || 0,
                    item.location || '',
                    created_by || 'system'
                ];
                
                const [result] = await connection.execute(insertQuery, params);
                insertedIds.push(result.insertId);
            }
            
            await connection.commit();
            
            res.json({
                success: true,
                message: `${items.length} items imported successfully`,
                data: { inserted_ids: insertedIds }
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error bulk importing incoming stock:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

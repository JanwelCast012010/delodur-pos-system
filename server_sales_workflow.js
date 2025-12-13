const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

// Database connection
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'inventory_system'
};

// =====================================================
// SALES WORKFLOW API ENDPOINTS
// Implements TRACK.EXE sales/cashier functionality
// =====================================================

// 1. SALES MANAGEMENT (Like TRACK.EXE "Update New Outgoing Stocks File")

// Get all pending sales
router.get('/api/sales/pending', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(`
            SELECT o.*, c.customer_name, s.BENZ, s.BRAND, s.ALTNO, s.QTY as stock_quantity
            FROM tbl_outgoing o
            LEFT JOIN tbl_customers c ON o.customer = c.customer_code
            LEFT JOIN tbl_stock s ON o.stock_id = s.id
            WHERE o.status = 'pending'
            ORDER BY o.created_at DESC
        `);
        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error('Error fetching pending sales:', error);
        res.status(500).json({ error: 'Failed to fetch pending sales' });
    }
});

// Get all approved sales ready to post
router.get('/api/sales/approved', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(`
            SELECT o.*, c.customer_name, s.BENZ, s.BRAND, s.ALTNO, s.QTY as stock_quantity
            FROM tbl_outgoing o
            LEFT JOIN tbl_customers c ON o.customer = c.customer_code
            LEFT JOIN tbl_stock s ON o.stock_id = s.id
            WHERE o.status = 'approved'
            ORDER BY o.approved_at DESC
        `);
        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error('Error fetching approved sales:', error);
        res.status(500).json({ error: 'Failed to fetch approved sales' });
    }
});

// Get all posted sales
router.get('/api/sales/posted', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(`
            SELECT om.*, c.customer_name, o.created_at as original_created_at
            FROM tbl_outmain om
            LEFT JOIN tbl_customers c ON om.customer = c.customer_code
            LEFT JOIN tbl_outgoing o ON om.outgoing_id = o.id
            ORDER BY om.posted_at DESC
            LIMIT 100
        `);
        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error('Error fetching posted sales:', error);
        res.status(500).json({ error: 'Failed to fetch posted sales' });
    }
});

// Add new sale (like TRACK.EXE sales entry)
router.post('/api/sales/add', async (req, res) => {
    try {
        const {
            date, receipt, customer, invoice, din_flag,
            benz_number, benz_number2, benz_number3, brand, altno, altno2,
            description, application, color_code, remarks,
            cost, selling_price, quantity, stock_id, created_by
        } = req.body;

        const connection = await mysql.createConnection(dbConfig);
        
        // For adjustments, we insert directly into history table
        // Check if stock exists (but don't validate quantity for adjustments - they can be negative)
        const [stockRows] = await connection.execute(
            'SELECT QTY, BENZ, BRAND, ALTNO, COLORCODE, REMARKS FROM tbl_stock WHERE id = ?',
            [stock_id]
        );
        
        if (stockRows.length === 0) {
            await connection.end();
            return res.status(400).json({ error: 'Stock item not found' });
        }
        
        const stock = stockRows[0];
        
        // Use stock data if not provided in request
        const finalBenz = benz_number || stock.BENZ || null;
        const finalBrand = brand || stock.BRAND || null;
        const finalAltno = altno || stock.ALTNO || null;
        const finalColorCode = color_code || stock.COLORCODE || null;
        const finalRemarks = remarks || stock.REMARKS || null;
        const finalCost = cost || 0;
        const finalSell = selling_price || 0;
        
        // Insert into history table (the actual sales history table)
        const [result] = await connection.execute(`
            INSERT INTO history (
                CUSTOMER, DATE, RECEIPT, INVOICE, IDCODE,
                SELL, QTY, BENZ, BRAND, ALTNO,
                COLORCODE, REMARKS, COST
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            customer || 'Walk-in Customer',  // CUSTOMER
            date || new Date().toISOString().split('T')[0],  // DATE
            receipt || null,                  // RECEIPT
            invoice || null,                   // INVOICE
            stock_id,                          // IDCODE
            finalSell,                        // SELL
            quantity,                          // QTY (can be negative for adjustments)
            finalBenz,                        // BENZ
            finalBrand,                       // BRAND
            finalAltno,                       // ALTNO
            finalColorCode,                   // COLORCODE
            finalRemarks,                     // REMARKS
            finalCost                         // COST
        ]);

        await connection.end();
        res.json({ 
            success: true, 
            id: result.insertId,
            message: 'Sale added successfully' 
        });
    } catch (error) {
        console.error('Error adding sale:', error);
        res.status(500).json({ error: 'Failed to add sale', details: error.message });
    }
});

// Approve sale
router.put('/api/sales/approve/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { approved_by } = req.body;

        const connection = await mysql.createConnection(dbConfig);
        await connection.execute(`
            UPDATE tbl_outgoing 
            SET status = 'approved', approved_by = ?, approved_at = NOW()
            WHERE id = ? AND status = 'pending'
        `, [approved_by, id]);

        await connection.end();
        res.json({ success: true, message: 'Sale approved successfully' });
    } catch (error) {
        console.error('Error approving sale:', error);
        res.status(500).json({ error: 'Failed to approve sale' });
    }
});

// Reject sale
router.put('/api/sales/reject/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { rejected_by, rejection_reason } = req.body;

        const connection = await mysql.createConnection(dbConfig);
        await connection.execute(`
            UPDATE tbl_outgoing 
            SET status = 'rejected', rejected_by = ?, rejected_at = NOW(), rejection_reason = ?
            WHERE id = ? AND status = 'pending'
        `, [rejected_by, rejection_reason, id]);

        await connection.end();
        res.json({ success: true, message: 'Sale rejected successfully' });
    } catch (error) {
        console.error('Error rejecting sale:', error);
        res.status(500).json({ error: 'Failed to reject sale' });
    }
});

// Post approved sales (like TRACK.EXE "Post New Outgoing Stocks")
router.post('/api/sales/post', async (req, res) => {
    try {
        const { sale_ids, posted_by } = req.body;

        if (!sale_ids || !Array.isArray(sale_ids) || sale_ids.length === 0) {
            return res.status(400).json({ error: 'No sales selected for posting' });
        }

        const connection = await mysql.createConnection(dbConfig);
        
        // Use the stored procedure to post sales
        const saleIdsJson = JSON.stringify(sale_ids);
        await connection.execute('CALL PostOutgoingSales(?, ?)', [saleIdsJson, posted_by]);

        await connection.end();
        res.json({ 
            success: true, 
            message: `${sale_ids.length} sales posted successfully` 
        });
    } catch (error) {
        console.error('Error posting sales:', error);
        res.status(500).json({ error: 'Failed to post sales' });
    }
});

// 2. CUSTOMER MANAGEMENT (Like TRACK.EXE CUSTINFO.DBF)

// Get all customers
router.get('/api/customers', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(`
            SELECT * FROM tbl_customers 
            WHERE is_active = 1 
            ORDER BY customer_name
        `);
        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// Add new customer
router.post('/api/customers', async (req, res) => {
    try {
        const {
            customer_code, customer_name, contact_person, phone, email,
            address, credit_limit, payment_terms
        } = req.body;

        const connection = await mysql.createConnection(dbConfig);
        const [result] = await connection.execute(`
            INSERT INTO tbl_customers (
                customer_code, customer_name, contact_person, phone, email,
                address, credit_limit, payment_terms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [customer_code, customer_name, contact_person, phone, email, address, credit_limit, payment_terms]);

        await connection.end();
        res.json({ 
            success: true, 
            id: result.insertId,
            message: 'Customer added successfully' 
        });
    } catch (error) {
        console.error('Error adding customer:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'Customer code already exists' });
        } else {
            res.status(500).json({ error: 'Failed to add customer' });
        }
    }
});

// Update customer
router.put('/api/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            customer_code, customer_name, contact_person, phone, email,
            address, credit_limit, payment_terms, is_active
        } = req.body;

        const connection = await mysql.createConnection(dbConfig);
        await connection.execute(`
            UPDATE tbl_customers 
            SET customer_code = ?, customer_name = ?, contact_person = ?, 
                phone = ?, email = ?, address = ?, credit_limit = ?, 
                payment_terms = ?, is_active = ?, updated_at = NOW()
            WHERE id = ?
        `, [customer_code, customer_name, contact_person, phone, email, address, credit_limit, payment_terms, is_active, id]);

        await connection.end();
        res.json({ success: true, message: 'Customer updated successfully' });
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

// Delete customer
router.delete('/api/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const connection = await mysql.createConnection(dbConfig);
        await connection.execute(`
            UPDATE tbl_customers 
            SET is_active = 0, updated_at = NOW()
            WHERE id = ?
        `, [id]);

        await connection.end();
        res.json({ success: true, message: 'Customer deactivated successfully' });
    } catch (error) {
        console.error('Error deleting customer:', error);
        res.status(500).json({ error: 'Failed to delete customer' });
    }
});

// 3. PRODUCT SEARCH (Like TRACK.EXE product lookup)

// Search products for sales (by Benz, Brand, Altno)
router.get('/api/sales/search-products', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.length < 2) {
            return res.json([]);
        }

        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(`
            SELECT id, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, 
                   \`DESC\`, APPL, COLORCODE, REMARKS, COST, SELL, QTY, UNIT, REORDER, LOCATION
            FROM tbl_stock 
            WHERE (BENZ LIKE ? OR BRAND LIKE ? OR ALTNO LIKE ? OR \`DESC\` LIKE ?)
              AND QTY > 0
            ORDER BY BENZ, BRAND, ALTNO
            LIMIT 50
        `, [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]);

        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error('Error searching products:', error);
        res.status(500).json({ error: 'Failed to search products' });
    }
});

// 4. SALES REPORTS (Like TRACK.EXE sales reports)

// Get sales statistics for dashboard
router.get('/api/dashboard/sales-stats', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // Pending sales count
        const [pendingRows] = await connection.execute(`
            SELECT COUNT(*) as count FROM tbl_outgoing WHERE status = 'pending'
        `);
        
        // Approved sales count
        const [approvedRows] = await connection.execute(`
            SELECT COUNT(*) as count FROM tbl_outgoing WHERE status = 'approved'
        `);
        
        // Today's sales value
        const [todayRows] = await connection.execute(`
            SELECT COALESCE(SUM(amount), 0) as value 
            FROM tbl_outgoing 
            WHERE DATE(created_at) = CURDATE() AND status IN ('approved', 'posted')
        `);
        
        // This week's sales count
        const [weekRows] = await connection.execute(`
            SELECT COUNT(*) as count 
            FROM tbl_outgoing 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND status IN ('approved', 'posted')
        `);
        
        // Top customers (by sales value)
        const [topCustomersRows] = await connection.execute(`
            SELECT c.customer_name, COALESCE(SUM(o.amount), 0) as total_value
            FROM tbl_customers c
            LEFT JOIN tbl_outgoing o ON c.customer_code = o.customer 
                AND o.status IN ('approved', 'posted') 
                AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY c.id, c.customer_name
            ORDER BY total_value DESC
            LIMIT 5
        `);

        await connection.end();
        
        res.json({
            pending: pendingRows[0].count,
            approved: approvedRows[0].count,
            todayValue: todayRows[0].value,
            weekCount: weekRows[0].count,
            topCustomers: topCustomersRows
        });
    } catch (error) {
        console.error('Error fetching sales stats:', error);
        res.status(500).json({ error: 'Failed to fetch sales statistics' });
    }
});

// Get sales history report - DISABLED: Using main server.js implementation
// router.get('/api/sales/history', async (req, res) => {
//     try {
//         const { start_date, end_date, customer, limit = 100 } = req.query;
//         
//         let query = `
//             SELECT sh.*, c.customer_name
//             FROM tbl_sales_history sh
//             LEFT JOIN tbl_customers c ON sh.customer = c.customer_code
//             WHERE 1=1
//         `;
//         const params = [];
//         
//         if (start_date) {
//             query += ' AND sh.date >= ?';
//             params.push(start_date);
//         }
//         
//         if (end_date) {
//             query += ' AND sh.date <= ?';
//             params.push(end_date);
//         }
//         
//         if (customer) {
//             query += ' AND sh.customer = ?';
//             params.push(customer);
//         }
//         
//         query += ' ORDER BY sh.archived_at DESC LIMIT ?';
//         params.push(parseInt(limit));

//         const connection = await mysql.createConnection(dbConfig);
//         const [rows] = await connection.execute(query, params);
//         await connection.end();
//         
//         res.json(rows);
//     } catch (error) {
//         console.error('Error fetching sales history:', error);
//         res.status(500).json({ error: 'Failed to fetch sales history' });
//     }
// });

module.exports = router;

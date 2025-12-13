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
// SERVICE WORKFLOW API ENDPOINTS
// Supports Warehouse → Service → Cashier/Stock workflow
// =====================================================

// 1. Send warehouse order to service
router.post('/api/warehouse/send-to-service', async (req, res) => {
    try {
        const { order_id, items, sent_by } = req.body;
        
        console.log('🔍 Service API Request:', { order_id, items, sent_by });
        
        if (!order_id) {
            return res.status(400).json({ error: 'Order ID is required' });
        }

        const connection = await mysql.createConnection(dbConfig);
        
        // Start transaction
        await connection.beginTransaction();
        
        try {
            // Get warehouse items for this order
            const [warehouseItems] = await connection.execute(
                'SELECT * FROM warehouse WHERE order_id = ?',
                [order_id]
            );
            
            if (warehouseItems.length === 0) {
                await connection.rollback();
                await connection.end();
                return res.status(404).json({ error: 'No items found for this order' });
            }
            
            // Create service order
            const [serviceOrderResult] = await connection.execute(
                `INSERT INTO tbl_service_orders (
                    order_id, customer_name, customer_phone, customer_address, 
                    status, sent_to_service_at, sent_to_service_by
                ) VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
                [order_id, 'Customer', 'N/A', 'N/A', 'in_service', sent_by || 'system']
            );
            
            const serviceOrderId = serviceOrderResult.insertId;
            
            // Copy warehouse items to service items
            for (const item of warehouseItems) {
                await connection.execute(
                    `INSERT INTO tbl_service_items (
                        service_order_id, warehouse_item_id, part_no, id_number, description,
                        brand, altno, location, quantity, unit_price, status, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        serviceOrderId, item.no, item.part_no, item.id_number, item.description,
                        '', '', item.location, item.qty, item.unit_price,
                        'in_service', sent_by || 'system'
                    ]
                );
            }
            
            // Remove items from warehouse
            await connection.execute(
                'DELETE FROM warehouse WHERE order_id = ?',
                [order_id]
            );
            
            // Commit transaction
            await connection.commit();
            await connection.end();
            
            res.json({ 
                success: true, 
                message: 'Order sent to service successfully',
                service_order_id: serviceOrderId
            });
            
        } catch (error) {
            await connection.rollback();
            await connection.end();
            throw error;
        }
        
    } catch (error) {
        console.error('Error sending order to service:', error);
        res.status(500).json({ error: 'Failed to send order to service' });
    }
});

// 2. Get service orders (grouped by order_id like warehouse)
router.get('/api/service/orders', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // Get service orders with item counts
        const [orders] = await connection.execute(`
            SELECT * FROM vw_service_orders_with_items 
            WHERE status IN ('pending', 'in_service')
            ORDER BY created_at DESC
        `);
        
        // Get service items for each order
        const [items] = await connection.execute(`
            SELECT * FROM vw_service_items_with_orders 
            WHERE order_status IN ('pending', 'in_service')
            ORDER BY created_at DESC
        `);
        
        await connection.end();
        
        // Group items by order_id
        const groupedOrders = {};
        orders.forEach(order => {
            groupedOrders[order.order_id] = {
                ...order,
                items: items.filter(item => item.order_id === order.order_id)
            };
        });
        
        res.json(Object.values(groupedOrders));
    } catch (error) {
        console.error('Error fetching service orders:', error);
        res.status(500).json({ error: 'Failed to fetch service orders' });
    }
});

// 3. Get service items (for backward compatibility)
router.get('/api/service/items', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        
        const [rows] = await connection.execute(`
            SELECT 
                si.id,
                si.order_id,
                si.part_no as BENZ,
                si.brand as BRAND,
                si.altno as ALTNO,
                si.quantity,
                si.unit_price,
                si.status,
                si.created_at,
                so.customer_name,
                so.customer_phone
            FROM tbl_service_items si
            LEFT JOIN tbl_service_orders so ON si.service_order_id = so.id
            WHERE si.status IN ('pending', 'in_service')
            ORDER BY si.created_at DESC
        `);
        
        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error('Error fetching service items:', error);
        res.status(500).json({ error: 'Failed to fetch service items' });
    }
});

// 4. Send service item to cashier
router.post('/api/service/send-to-cashier', async (req, res) => {
    try {
        const { service_item_id, sent_by } = req.body;
        
        if (!service_item_id) {
            return res.status(400).json({ error: 'Service item ID is required' });
        }

        const connection = await mysql.createConnection(dbConfig);
        
        // Start transaction
        await connection.beginTransaction();
        
        try {
            // Get service item details
            const [serviceItems] = await connection.execute(
                'SELECT * FROM tbl_service_items WHERE id = ?',
                [service_item_id]
            );
            
            if (serviceItems.length === 0) {
                await connection.rollback();
                await connection.end();
                return res.status(404).json({ error: 'Service item not found' });
            }
            
            const serviceItem = serviceItems[0];
            
            // Update service item status
            await connection.execute(
                'UPDATE tbl_service_items SET status = ?, sent_to_cashier_at = NOW(), sent_to_cashier_by = ? WHERE id = ?',
                ['sent_to_cashier', sent_by || 'system', service_item_id]
            );
            
            // Check if all items in the order are processed
            const [remainingItems] = await connection.execute(
                'SELECT COUNT(*) as count FROM tbl_service_items WHERE service_order_id = ? AND status NOT IN (?, ?)',
                [serviceItem.service_order_id, 'sent_to_cashier', 'returned_to_stock']
            );
            
            if (remainingItems[0].count === 0) {
                await connection.execute(
                    'UPDATE tbl_service_orders SET status = ?, completed_at = NOW(), completed_by = ? WHERE id = ?',
                    ['completed', sent_by || 'system', serviceItem.service_order_id]
                );
            }
            
            // Commit transaction
            await connection.commit();
            await connection.end();
            
            res.json({ 
                success: true, 
                message: 'Item sent to cashier successfully' 
            });
            
        } catch (error) {
            await connection.rollback();
            await connection.end();
            throw error;
        }
        
    } catch (error) {
        console.error('Error sending item to cashier:', error);
        res.status(500).json({ error: 'Failed to send item to cashier' });
    }
});

// 5. Return service item to stock
router.post('/api/service/return-to-stock', async (req, res) => {
    try {
        const { service_item_id, returned_by } = req.body;
        
        if (!service_item_id) {
            return res.status(400).json({ error: 'Service item ID is required' });
        }

        const connection = await mysql.createConnection(dbConfig);
        
        // Start transaction
        await connection.beginTransaction();
        
        try {
            // Get service item details
            const [serviceItems] = await connection.execute(
                'SELECT * FROM tbl_service_items WHERE id = ?',
                [service_item_id]
            );
            
            if (serviceItems.length === 0) {
                await connection.rollback();
                await connection.end();
                return res.status(404).json({ error: 'Service item not found' });
            }
            
            const serviceItem = serviceItems[0];
            
            // Return to warehouse/stock
            if (serviceItem.warehouse_item_id) {
                await connection.execute(
                    'UPDATE warehouse SET qty = qty + ? WHERE no = ?',
                    [serviceItem.quantity, serviceItem.warehouse_item_id]
                );
            } else {
                // If no warehouse_item_id, create new entry
                await connection.execute(
                    `INSERT INTO warehouse (part_no, id_number, description, location, qty, unit_price, order_id, user_id) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        serviceItem.part_no, serviceItem.id_number, serviceItem.description,
                        serviceItem.location, serviceItem.quantity, serviceItem.unit_price, 
                        serviceItem.order_id, 1 // Default user_id
                    ]
                );
            }
            
            // Update service item status
            await connection.execute(
                'UPDATE tbl_service_items SET status = ?, returned_to_stock_at = NOW(), returned_to_stock_by = ? WHERE id = ?',
                ['returned_to_stock', returned_by || 'system', service_item_id]
            );
            
            // Check if all items in the order are processed
            const [remainingItems] = await connection.execute(
                'SELECT COUNT(*) as count FROM tbl_service_items WHERE service_order_id = ? AND status NOT IN (?, ?)',
                [serviceItem.service_order_id, 'sent_to_cashier', 'returned_to_stock']
            );
            
            if (remainingItems[0].count === 0) {
                await connection.execute(
                    'UPDATE tbl_service_orders SET status = ?, completed_at = NOW(), completed_by = ? WHERE id = ?',
                    ['completed', returned_by || 'system', serviceItem.service_order_id]
                );
            }
            
            // Commit transaction
            await connection.commit();
            await connection.end();
            
            res.json({ 
                success: true, 
                message: 'Item returned to stock successfully' 
            });
            
        } catch (error) {
            await connection.rollback();
            await connection.end();
            throw error;
        }
        
    } catch (error) {
        console.error('Error returning item to stock:', error);
        res.status(500).json({ error: 'Failed to return item to stock' });
    }
});

// 6. Get service statistics for dashboard
router.get('/api/dashboard/service-stats', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // Pending service orders count
        const [pendingRows] = await connection.execute(`
            SELECT COUNT(*) as count FROM tbl_service_orders WHERE status = 'in_service'
        `);
        
        // Items in service count
        const [itemsRows] = await connection.execute(`
            SELECT COUNT(*) as count FROM tbl_service_items WHERE status = 'in_service'
        `);
        
        // Today's service completions
        const [todayRows] = await connection.execute(`
            SELECT COUNT(*) as count 
            FROM tbl_service_orders 
            WHERE DATE(completed_at) = CURDATE() AND status = 'completed'
        `);
        
        // This week's service activity
        const [weekRows] = await connection.execute(`
            SELECT COUNT(*) as count 
            FROM tbl_service_orders 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `);

        await connection.end();
        
        res.json({
            pendingOrders: pendingRows[0].count,
            itemsInService: itemsRows[0].count,
            todayCompletions: todayRows[0].count,
            weekActivity: weekRows[0].count
        });
    } catch (error) {
        console.error('Error fetching service stats:', error);
        res.status(500).json({ error: 'Failed to fetch service statistics' });
    }
});

// 7. Get service order details
router.get('/api/service/order/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const connection = await mysql.createConnection(dbConfig);
        
        // Get order details
        const [orderRows] = await connection.execute(`
            SELECT * FROM tbl_service_orders WHERE order_id = ?
        `, [orderId]);
        
        if (orderRows.length === 0) {
            await connection.end();
            return res.status(404).json({ error: 'Service order not found' });
        }
        
        // Get order items
        const [itemRows] = await connection.execute(`
            SELECT * FROM tbl_service_items 
            WHERE service_order_id = ?
            ORDER BY created_at DESC
        `, [orderRows[0].id]);
        
        await connection.end();
        
        res.json({
            order: orderRows[0],
            items: itemRows
        });
    } catch (error) {
        console.error('Error fetching service order details:', error);
        res.status(500).json({ error: 'Failed to fetch service order details' });
    }
});

module.exports = router;

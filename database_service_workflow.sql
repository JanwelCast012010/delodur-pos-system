-- =====================================================
-- SERVICE WORKFLOW DATABASE SETUP
-- Supports Warehouse → Service → Cashier/Stock workflow
-- =====================================================

-- 1. Create tbl_service_orders (Service workflow orders)
-- This table stores orders that are sent from Warehouse to Service
CREATE TABLE tbl_service_orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id VARCHAR(100) NOT NULL,
    warehouse_id INT, -- Reference to original warehouse order
    
    -- Order Information
    customer_name VARCHAR(200),
    customer_phone VARCHAR(50),
    customer_address TEXT,
    order_notes TEXT,
    
    -- Status Tracking
    status ENUM('pending', 'in_service', 'completed', 'cancelled') DEFAULT 'pending',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_to_service_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    
    -- User tracking
    created_by VARCHAR(100),
    sent_to_service_by VARCHAR(100),
    completed_by VARCHAR(100),
    
    -- Indexes
    INDEX idx_service_orders_order_id (order_id),
    INDEX idx_service_orders_status (status),
    INDEX idx_service_orders_created_at (created_at),
    INDEX idx_service_orders_warehouse_id (warehouse_id),
    
    -- Foreign key
    FOREIGN KEY (warehouse_id) REFERENCES warehouse(no) ON DELETE SET NULL
);

-- 2. Create tbl_service_items (Individual items in service orders)
-- This table stores individual items that are being serviced
CREATE TABLE tbl_service_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    service_order_id INT NOT NULL,
    warehouse_item_id INT, -- Reference to original warehouse item
    
    -- Item Information (copied from warehouse for reference)
    part_no VARCHAR(100),
    id_number VARCHAR(100),
    description TEXT,
    brand VARCHAR(100),
    altno VARCHAR(100),
    location VARCHAR(100),
    
    -- Quantities
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) DEFAULT 0.00,
    
    -- Status
    status ENUM('pending', 'in_service', 'sent_to_cashier', 'returned_to_stock', 'completed') DEFAULT 'pending',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_to_cashier_at TIMESTAMP NULL,
    returned_to_stock_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    
    -- User tracking
    created_by VARCHAR(100),
    sent_to_cashier_by VARCHAR(100),
    returned_to_stock_by VARCHAR(100),
    completed_by VARCHAR(100),
    
    -- Indexes
    INDEX idx_service_items_service_order_id (service_order_id),
    INDEX idx_service_items_status (status),
    INDEX idx_service_items_warehouse_item_id (warehouse_item_id),
    INDEX idx_service_items_created_at (created_at),
    
    -- Foreign keys
    FOREIGN KEY (service_order_id) REFERENCES tbl_service_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_item_id) REFERENCES warehouse(no) ON DELETE SET NULL
);

-- 3. Create view for service orders with items
CREATE VIEW vw_service_orders_with_items AS
SELECT 
    so.*,
    COUNT(si.id) as item_count,
    SUM(si.quantity * si.unit_price) as total_value,
    GROUP_CONCAT(DISTINCT si.status) as item_statuses
FROM tbl_service_orders so
LEFT JOIN tbl_service_items si ON so.id = si.service_order_id
GROUP BY so.id
ORDER BY so.created_at DESC;

-- 4. Create view for service items with order details
CREATE VIEW vw_service_items_with_orders AS
SELECT 
    si.*,
    so.order_id,
    so.customer_name,
    so.customer_phone,
    so.status as order_status,
    so.created_at as order_created_at
FROM tbl_service_items si
LEFT JOIN tbl_service_orders so ON si.service_order_id = so.id
ORDER BY si.created_at DESC;

-- 5. Create stored procedure to send warehouse order to service
DELIMITER //
CREATE PROCEDURE SendWarehouseOrderToService(
    IN p_order_id VARCHAR(100),
    IN p_sent_by VARCHAR(100)
)
BEGIN
    DECLARE v_service_order_id INT;
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_warehouse_id INT;
    DECLARE v_part_no VARCHAR(100);
    DECLARE v_id_number VARCHAR(100);
    DECLARE v_description TEXT;
    DECLARE v_brand VARCHAR(100);
    DECLARE v_altno VARCHAR(100);
    DECLARE v_location VARCHAR(100);
    DECLARE v_qty INT;
    DECLARE v_unit_price DECIMAL(10,2);
    
    DECLARE warehouse_cursor CURSOR FOR 
        SELECT id, part_no, id_number, description, brand, altno, LOCATION, qty, unit_price
        FROM warehouse 
        WHERE order_id = p_order_id;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    START TRANSACTION;
    
    -- Create service order
    INSERT INTO tbl_service_orders (
        order_id, customer_name, customer_phone, customer_address, 
        status, sent_to_service_at, sent_to_service_by
    )
    SELECT 
        p_order_id,
        'Customer', -- You can modify this to get from actual customer data
        'N/A',
        'N/A',
        'in_service',
        NOW(),
        p_sent_by
    FROM warehouse 
    WHERE order_id = p_order_id 
    LIMIT 1;
    
    SET v_service_order_id = LAST_INSERT_ID();
    
    -- Copy warehouse items to service items
    OPEN warehouse_cursor;
    read_loop: LOOP
        FETCH warehouse_cursor INTO v_warehouse_id, v_part_no, v_id_number, v_description, v_brand, v_altno, v_location, v_qty, v_unit_price;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        INSERT INTO tbl_service_items (
            service_order_id, warehouse_item_id, part_no, id_number, description,
            brand, altno, location, quantity, unit_price, status, created_by
        ) VALUES (
            v_service_order_id, v_warehouse_id, v_part_no, v_id_number, v_description,
            v_brand, v_altno, v_location, v_qty, v_unit_price, 'in_service', p_sent_by
        );
    END LOOP;
    CLOSE warehouse_cursor;
    
    -- Remove items from warehouse (delete them since they're sent to service)
    DELETE FROM warehouse 
    WHERE order_id = p_order_id;
    
    COMMIT;
    
    SELECT v_service_order_id as service_order_id;
END //
DELIMITER ;

-- 6. Create stored procedure to send service item to cashier
DELIMITER //
CREATE PROCEDURE SendServiceItemToCashier(
    IN p_service_item_id INT,
    IN p_sent_by VARCHAR(100)
)
BEGIN
    UPDATE tbl_service_items 
    SET status = 'sent_to_cashier',
        sent_to_cashier_at = NOW(),
        sent_to_cashier_by = p_sent_by
    WHERE id = p_service_item_id;
    
    -- Check if all items in the order are sent to cashier
    UPDATE tbl_service_orders 
    SET status = 'completed',
        completed_at = NOW(),
        completed_by = p_sent_by
    WHERE id = (SELECT service_order_id FROM tbl_service_items WHERE id = p_service_item_id)
    AND NOT EXISTS (
        SELECT 1 FROM tbl_service_items 
        WHERE service_order_id = (SELECT service_order_id FROM tbl_service_items WHERE id = p_service_item_id)
        AND status NOT IN ('sent_to_cashier', 'completed')
    );
END //
DELIMITER ;

-- 7. Create stored procedure to return service item to stock
DELIMITER //
CREATE PROCEDURE ReturnServiceItemToStock(
    IN p_service_item_id INT,
    IN p_returned_by VARCHAR(100)
)
BEGIN
    DECLARE v_warehouse_item_id INT;
    DECLARE v_quantity INT;
    
    -- Get warehouse item details
    SELECT warehouse_item_id, quantity 
    INTO v_warehouse_item_id, v_quantity
    FROM tbl_service_items 
    WHERE id = p_service_item_id;
    
    -- Update service item status
    UPDATE tbl_service_items 
    SET status = 'returned_to_stock',
        returned_to_stock_at = NOW(),
        returned_to_stock_by = p_returned_by
    WHERE id = p_service_item_id;
    
    -- Return to warehouse/stock
    IF v_warehouse_item_id IS NOT NULL THEN
        UPDATE warehouse 
        SET status = 'available',
            qty = qty + v_quantity,
            updated_at = NOW()
        WHERE no = v_warehouse_item_id;
    END IF;
    
    -- Check if all items in the order are processed
    UPDATE tbl_service_orders 
    SET status = 'completed',
        completed_at = NOW(),
        completed_by = p_returned_by
    WHERE id = (SELECT service_order_id FROM tbl_service_items WHERE id = p_service_item_id)
    AND NOT EXISTS (
        SELECT 1 FROM tbl_service_items 
        WHERE service_order_id = (SELECT service_order_id FROM tbl_service_items WHERE id = p_service_item_id)
        AND status NOT IN ('sent_to_cashier', 'returned_to_stock', 'completed')
    );
END //
DELIMITER ;

-- =====================================================
-- SERVICE WORKFLOW DATABASE SETUP COMPLETE
-- 
-- Workflow:
-- 1. Warehouse → Service: Call SendWarehouseOrderToService()
-- 2. Service → Cashier: Call SendServiceItemToCashier()
-- 3. Service → Stock: Call ReturnServiceItemToStock()
-- 
-- Views:
-- - vw_service_orders_with_items: Orders with item counts and totals
-- - vw_service_items_with_orders: Items with order details
-- =====================================================

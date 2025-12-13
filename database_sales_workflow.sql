-- =====================================================
-- SALES WORKFLOW DATABASE SETUP
-- Implements TRACK.EXE sales/cashier workflow in modern database
-- =====================================================

-- 1. Create tbl_outgoing (Like TRACK.EXE OUTGOING.DBF)
-- This table stores pending sales that need to be reviewed before posting
CREATE TABLE tbl_outgoing (
    id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Basic Information (like TRACK.EXE sales form)
    date DATE NOT NULL,
    receipt VARCHAR(100),
    customer VARCHAR(100),
    invoice CHAR(1) DEFAULT 'N',
    
    -- Product Information (exactly like TRACK.EXE)
    din_flag CHAR(1) DEFAULT '',
    benz_number VARCHAR(50),
    benz_number2 VARCHAR(50),
    benz_number3 VARCHAR(50),
    brand VARCHAR(50),
    altno VARCHAR(50),
    altno2 VARCHAR(50),
    
    -- Product Details
    description VARCHAR(200),
    application VARCHAR(200),
    color_code VARCHAR(20),
    remarks VARCHAR(200),
    
    -- Pricing Information
    cost DECIMAL(10,2) DEFAULT 0.00,
    selling_price DECIMAL(10,2) DEFAULT 0.00,
    quantity INT DEFAULT 0,
    amount DECIMAL(10,2) DEFAULT 0.00,
    
    -- Stock Reference (like TRACK.EXE idcode)
    stock_id INT,
    
    -- Workflow Status
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    
    -- Audit Trail
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by VARCHAR(100),
    approved_at TIMESTAMP NULL,
    rejected_by VARCHAR(100),
    rejected_at TIMESTAMP NULL,
    rejection_reason TEXT,
    
    -- Indexes for performance (replaces NTX files)
    INDEX idx_outgoing_date (date),
    INDEX idx_outgoing_customer (customer),
    INDEX idx_outgoing_status (status),
    INDEX idx_outgoing_benz (benz_number, brand, altno),
    INDEX idx_outgoing_receipt (receipt),
    INDEX idx_outgoing_created_at (created_at),
    INDEX idx_outgoing_stock_id (stock_id),
    
    -- Foreign key constraint
    FOREIGN KEY (stock_id) REFERENCES tbl_stock(id) ON DELETE SET NULL
);

-- 2. Create tbl_outmain (Like TRACK.EXE OUTMAIN.DBF)
-- This table stores posted sales history
CREATE TABLE tbl_outmain (
    id INT PRIMARY KEY AUTO_INCREMENT,
    outgoing_id INT, -- Reference to original tbl_outgoing record
    
    -- Basic Information
    date DATE NOT NULL,
    receipt VARCHAR(100),
    customer VARCHAR(100),
    invoice CHAR(1),
    
    -- Product Information
    din_flag CHAR(1),
    benz_number VARCHAR(50),
    benz_number2 VARCHAR(50),
    benz_number3 VARCHAR(50),
    brand VARCHAR(50),
    altno VARCHAR(50),
    altno2 VARCHAR(50),
    
    -- Product Details
    description VARCHAR(200),
    application VARCHAR(200),
    color_code VARCHAR(20),
    remarks VARCHAR(200),
    
    -- Pricing Information
    cost DECIMAL(10,2),
    selling_price DECIMAL(10,2),
    quantity INT,
    amount DECIMAL(10,2),
    
    -- Stock Reference
    stock_id INT,
    
    -- Posting Information
    posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    posted_by VARCHAR(100),
    
    -- Indexes for performance
    INDEX idx_outmain_date (date),
    INDEX idx_outmain_customer (customer),
    INDEX idx_outmain_benz (benz_number, brand, altno),
    INDEX idx_outmain_receipt (receipt),
    INDEX idx_outmain_posted_at (posted_at),
    INDEX idx_outmain_outgoing_id (outgoing_id),
    INDEX idx_outmain_stock_id (stock_id),
    
    -- Foreign key constraints
    FOREIGN KEY (outgoing_id) REFERENCES tbl_outgoing(id) ON DELETE SET NULL,
    FOREIGN KEY (stock_id) REFERENCES tbl_stock(id) ON DELETE SET NULL
);

-- 3. Create tbl_customers (Like TRACK.EXE CUSTINFO.DBF)
-- This table stores customer information
CREATE TABLE tbl_customers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_code VARCHAR(20) UNIQUE NOT NULL,
    customer_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    credit_limit DECIMAL(10,2) DEFAULT 0.00,
    payment_terms VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_customers_code (customer_code),
    INDEX idx_customers_name (customer_name),
    INDEX idx_customers_active (is_active)
);

-- 4. Create tbl_sales_history (Like TRACK.EXE HISTORY.DBF)
-- This table stores complete sales history for reporting
CREATE TABLE tbl_sales_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    outgoing_id INT,
    outmain_id INT,
    
    -- Basic Information
    date DATE NOT NULL,
    receipt VARCHAR(100),
    customer VARCHAR(100),
    invoice CHAR(1),
    
    -- Product Information
    din_flag CHAR(1),
    benz_number VARCHAR(50),
    benz_number2 VARCHAR(50),
    benz_number3 VARCHAR(50),
    brand VARCHAR(50),
    altno VARCHAR(50),
    altno2 VARCHAR(50),
    
    -- Product Details
    description VARCHAR(200),
    application VARCHAR(200),
    color_code VARCHAR(20),
    remarks VARCHAR(200),
    
    -- Pricing Information
    cost DECIMAL(10,2),
    selling_price DECIMAL(10,2),
    quantity INT,
    amount DECIMAL(10,2),
    
    -- Stock Reference
    stock_id INT,
    
    -- History Information
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_by VARCHAR(100),
    
    -- Indexes for performance
    INDEX idx_sales_history_date (date),
    INDEX idx_sales_history_customer (customer),
    INDEX idx_sales_history_benz (benz_number, brand, altno),
    INDEX idx_sales_history_receipt (receipt),
    INDEX idx_sales_history_archived_at (archived_at),
    INDEX idx_sales_history_outgoing_id (outgoing_id),
    INDEX idx_sales_history_outmain_id (outmain_id),
    INDEX idx_sales_history_stock_id (stock_id),
    
    -- Foreign key constraints
    FOREIGN KEY (outgoing_id) REFERENCES tbl_outgoing(id) ON DELETE SET NULL,
    FOREIGN KEY (outmain_id) REFERENCES tbl_outmain(id) ON DELETE SET NULL,
    FOREIGN KEY (stock_id) REFERENCES tbl_stock(id) ON DELETE SET NULL
);

-- 5. Insert sample customers (like TRACK.EXE had)
INSERT INTO tbl_customers (customer_code, customer_name, contact_person, phone, address, payment_terms) VALUES
('CUST001', 'Walk-in Customer', 'N/A', 'N/A', 'Walk-in', 'Cash'),
('CUST002', 'ABC Auto Repair', 'John Smith', '+63-2-123-4567', 'Quezon City, Philippines', 'Net 30'),
('CUST003', 'XYZ Motors', 'Maria Garcia', '+63-2-234-5678', 'Makati City, Philippines', 'Net 15'),
('CUST004', 'DEF Garage', 'Robert Johnson', '+63-2-345-6789', 'Manila, Philippines', 'Cash'),
('CUST005', 'GHI Service Center', 'Anna Mueller', '+63-2-456-7890', 'Taguig City, Philippines', 'Net 45');

-- 6. Create views for easy reporting (like TRACK.EXE reports)
-- View for pending sales
CREATE VIEW vw_pending_sales AS
SELECT 
    o.*,
    c.customer_name,
    s.BENZ, s.BRAND, s.ALTNO, s.QTY as stock_quantity,
    DATEDIFF(CURDATE(), o.created_at) as days_pending
FROM tbl_outgoing o
LEFT JOIN tbl_customers c ON o.customer = c.customer_code
LEFT JOIN tbl_stock s ON o.stock_id = s.id
WHERE o.status = 'pending'
ORDER BY o.created_at DESC;

-- View for approved sales ready to post
CREATE VIEW vw_approved_sales AS
SELECT 
    o.*,
    c.customer_name,
    s.BENZ, s.BRAND, s.ALTNO, s.QTY as stock_quantity
FROM tbl_outgoing o
LEFT JOIN tbl_customers c ON o.customer = c.customer_code
LEFT JOIN tbl_stock s ON o.stock_id = s.id
WHERE o.status = 'approved'
ORDER BY o.approved_at DESC;

-- View for posted sales history
CREATE VIEW vw_posted_sales AS
SELECT 
    om.*,
    c.customer_name,
    o.created_at as original_created_at,
    o.created_by as original_created_by
FROM tbl_outmain om
LEFT JOIN tbl_customers c ON om.customer = c.customer_code
LEFT JOIN tbl_outgoing o ON om.outgoing_id = o.id
ORDER BY om.posted_at DESC;

-- 7. Create stored procedures for common operations
-- Procedure to post approved sales to main inventory
DELIMITER //
CREATE PROCEDURE PostOutgoingSales(IN outgoing_ids JSON, IN posted_by VARCHAR(100))
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE outgoing_id INT;
    DECLARE outgoing_cursor CURSOR FOR 
        SELECT JSON_UNQUOTE(JSON_EXTRACT(outgoing_ids, CONCAT('$[', idx, ']')))
        FROM JSON_TABLE(outgoing_ids, '$[*]' COLUMNS (idx FOR ORDINALITY)) AS t;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    START TRANSACTION;
    
    OPEN outgoing_cursor;
    read_loop: LOOP
        FETCH outgoing_cursor INTO outgoing_id;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Insert into tbl_outmain (posted sales)
        INSERT INTO tbl_outmain (
            outgoing_id, date, receipt, customer, invoice,
            din_flag, benz_number, benz_number2, benz_number3, brand, altno, altno2,
            description, application, color_code, remarks,
            cost, selling_price, quantity, amount, stock_id, posted_by
        )
        SELECT 
            id, date, receipt, customer, invoice,
            din_flag, benz_number, benz_number2, benz_number3, brand, altno, altno2,
            description, application, color_code, remarks,
            cost, selling_price, quantity, amount, stock_id, posted_by
        FROM tbl_outgoing 
        WHERE id = outgoing_id AND status = 'approved';
        
        -- Update stock quantity (like TRACK.EXE: repl qty with qty-xqty)
        UPDATE tbl_stock s
        INNER JOIN tbl_outgoing o ON s.id = o.stock_id
        SET s.QTY = s.QTY - o.quantity,
            s.last_updated_at = CURRENT_TIMESTAMP,
            s.last_updated_by = posted_by
        WHERE o.id = outgoing_id AND o.status = 'approved';
        
        -- Insert into sales history
        INSERT INTO tbl_sales_history (
            outgoing_id, outmain_id, date, receipt, customer, invoice,
            din_flag, benz_number, benz_number2, benz_number3, brand, altno, altno2,
            description, application, color_code, remarks,
            cost, selling_price, quantity, amount, stock_id, archived_by
        )
        SELECT 
            o.id, om.id, o.date, o.receipt, o.customer, o.invoice,
            o.din_flag, o.benz_number, o.benz_number2, o.benz_number3, o.brand, o.altno, o.altno2,
            o.description, o.application, o.color_code, o.remarks,
            o.cost, o.selling_price, o.quantity, o.amount, o.stock_id, posted_by
        FROM tbl_outgoing o
        INNER JOIN tbl_outmain om ON om.outgoing_id = o.id
        WHERE o.id = outgoing_id AND o.status = 'approved';
        
        -- Update status in tbl_outgoing
        UPDATE tbl_outgoing 
        SET status = 'posted', posted_at = CURRENT_TIMESTAMP, posted_by = posted_by
        WHERE id = outgoing_id;
        
    END LOOP;
    CLOSE outgoing_cursor;
    
    COMMIT;
END //
DELIMITER ;

-- 8. Create triggers for audit trail
-- Trigger to log stock adjustments from sales
DELIMITER //
CREATE TRIGGER trg_sales_stock_adjustment_log
AFTER UPDATE ON tbl_stock
FOR EACH ROW
BEGIN
    IF OLD.QTY != NEW.QTY AND NEW.last_updated_by IS NOT NULL THEN
        INSERT INTO tbl_stock_adjustments (
            stock_id, adjustment_type, quantity_before, quantity_after,
            adjustment_reason, adjusted_by
        ) VALUES (
            NEW.id,
            CASE 
                WHEN NEW.QTY > OLD.QTY THEN 'increase'
                WHEN NEW.QTY < OLD.QTY THEN 'decrease'
                ELSE 'set'
            END,
            OLD.QTY,
            NEW.QTY,
            'Sales transaction',
            NEW.last_updated_by
        );
    END IF;
END //
DELIMITER ;

-- 9. Create indexes for better performance (replaces NTX files)
-- Additional indexes for common queries (only if they don't exist)
-- Note: These indexes may already exist from stock workflow setup

-- =====================================================
-- SALES WORKFLOW DATABASE SETUP COMPLETE
-- Your system now supports the complete TRACK.EXE sales workflow:
-- 1. Sales Entry → tbl_outgoing (pending)
-- 2. Review & approve → status change
-- 3. Post sales → tbl_outmain (posted) + tbl_sales_history (archive) + stock update
-- 4. Track adjustments → tbl_stock_adjustments
-- =====================================================

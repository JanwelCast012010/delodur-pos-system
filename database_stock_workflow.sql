-- =====================================================
-- STOCK WORKFLOW DATABASE SETUP
-- Implements TRACK.EXE workflow in modern database
-- =====================================================

-- 1. Create tbl_incoming (Like TRACK.EXE INCOMING.DBF)
-- This table stores pending stock that needs to be reviewed before posting
CREATE TABLE tbl_incoming (
    id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Basic Information (like TRACK.EXE form)
    date DATE NOT NULL,
    reference VARCHAR(100),
    supplier VARCHAR(100),
    document_ref VARCHAR(100),
    
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
    currency VARCHAR(10) DEFAULT 'PHP',
    fc_cost DECIMAL(10,2) DEFAULT 0.00,
    conversion DECIMAL(10,4) DEFAULT 1.0000,
    
    -- Inventory Information
    quantity INT DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'pcs',
    reorder_point INT DEFAULT 0,
    location VARCHAR(100),
    
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
    INDEX idx_incoming_date (date),
    INDEX idx_incoming_supplier (supplier),
    INDEX idx_incoming_status (status),
    INDEX idx_incoming_benz (benz_number, brand, altno),
    INDEX idx_incoming_reference (reference),
    INDEX idx_incoming_created_at (created_at)
);

-- 2. Create tbl_inmain (Like TRACK.EXE INMAIN.DBF)
-- This table stores posted incoming stock history
CREATE TABLE tbl_inmain (
    id INT PRIMARY KEY AUTO_INCREMENT,
    incoming_id INT, -- Reference to original tbl_incoming record
    
    -- Basic Information
    date DATE NOT NULL,
    reference VARCHAR(100),
    supplier VARCHAR(100),
    document_ref VARCHAR(100),
    
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
    currency VARCHAR(10),
    fc_cost DECIMAL(10,2),
    conversion DECIMAL(10,4),
    
    -- Inventory Information
    quantity INT,
    unit VARCHAR(20),
    reorder_point INT,
    location VARCHAR(100),
    
    -- Posting Information
    posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    posted_by VARCHAR(100),
    
    -- Indexes for performance
    INDEX idx_inmain_date (date),
    INDEX idx_inmain_supplier (supplier),
    INDEX idx_inmain_benz (benz_number, brand, altno),
    INDEX idx_inmain_reference (reference),
    INDEX idx_inmain_posted_at (posted_at),
    INDEX idx_inmain_incoming_id (incoming_id),
    
    -- Foreign key constraint
    FOREIGN KEY (incoming_id) REFERENCES tbl_incoming(id) ON DELETE SET NULL
);

-- 3. Create tbl_suppliers (Like TRACK.EXE SUPPLIER.DBF)
-- This table stores supplier information
CREATE TABLE tbl_suppliers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    supplier_code VARCHAR(20) UNIQUE NOT NULL,
    supplier_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    terms VARCHAR(100),
    currency VARCHAR(10) DEFAULT 'PHP',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_suppliers_code (supplier_code),
    INDEX idx_suppliers_name (supplier_name),
    INDEX idx_suppliers_active (is_active)
);

-- 4. Update existing tbl_stock to support the workflow
-- Add fields to track the source of stock entries
ALTER TABLE tbl_stock 
ADD COLUMN source_type ENUM('manual', 'incoming', 'adjustment') DEFAULT 'manual',
ADD COLUMN source_id INT NULL,
ADD COLUMN last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
ADD COLUMN last_updated_by VARCHAR(100);

-- Add indexes for the new fields
ALTER TABLE tbl_stock 
ADD INDEX idx_stock_source (source_type, source_id),
ADD INDEX idx_stock_updated_at (last_updated_at);

-- 5. Create tbl_stock_adjustments for inventory adjustments
CREATE TABLE tbl_stock_adjustments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    stock_id INT,
    adjustment_type ENUM('increase', 'decrease', 'set') NOT NULL,
    quantity_before INT NOT NULL,
    quantity_after INT NOT NULL,
    adjustment_reason VARCHAR(200),
    reference_number VARCHAR(100),
    adjusted_by VARCHAR(100),
    adjusted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_adjustments_stock_id (stock_id),
    INDEX idx_adjustments_date (adjusted_at),
    INDEX idx_adjustments_type (adjustment_type),
    
    -- Foreign key
    FOREIGN KEY (stock_id) REFERENCES tbl_stock(id) ON DELETE CASCADE
);

-- 6. Insert sample suppliers (like TRACK.EXE had)
INSERT INTO tbl_suppliers (supplier_code, supplier_name, contact_person, phone, address, terms) VALUES
('SUP001', 'Mercedes-Benz Philippines', 'John Smith', '+63-2-123-4567', 'Makati City, Philippines', 'Net 30'),
('SUP002', 'BMW Philippines', 'Maria Garcia', '+63-2-234-5678', 'Quezon City, Philippines', 'Net 15'),
('SUP003', 'Auto Parts Supply Co.', 'Robert Johnson', '+63-2-345-6789', 'Manila, Philippines', 'Cash'),
('SUP004', 'German Parts Direct', 'Anna Mueller', '+63-2-456-7890', 'Taguig City, Philippines', 'Net 45'),
('SUP005', 'Local Parts Distributor', 'Jose Santos', '+63-2-567-8901', 'Pasig City, Philippines', 'Net 30');

-- 7. Create views for easy reporting (like TRACK.EXE reports)
-- View for pending incoming stock
CREATE VIEW vw_pending_incoming AS
SELECT 
    i.*,
    s.supplier_name,
    DATEDIFF(CURDATE(), i.created_at) as days_pending
FROM tbl_incoming i
LEFT JOIN tbl_suppliers s ON i.supplier = s.supplier_code
WHERE i.status = 'pending'
ORDER BY i.created_at DESC;

-- View for approved incoming stock ready to post
CREATE VIEW vw_approved_incoming AS
SELECT 
    i.*,
    s.supplier_name
FROM tbl_incoming i
LEFT JOIN tbl_suppliers s ON i.supplier = s.supplier_code
WHERE i.status = 'approved'
ORDER BY i.approved_at DESC;

-- View for posted incoming stock history
CREATE VIEW vw_posted_incoming AS
SELECT 
    im.*,
    s.supplier_name,
    i.created_at as original_created_at,
    i.created_by as original_created_by
FROM tbl_inmain im
LEFT JOIN tbl_suppliers s ON im.supplier = s.supplier_code
LEFT JOIN tbl_incoming i ON im.incoming_id = i.id
ORDER BY im.posted_at DESC;

-- 8. Create stored procedures for common operations
-- Procedure to post approved incoming stock to main inventory
DELIMITER //
CREATE PROCEDURE PostIncomingStock(IN incoming_ids JSON, IN posted_by VARCHAR(100))
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE incoming_id INT;
    DECLARE incoming_cursor CURSOR FOR 
        SELECT JSON_UNQUOTE(JSON_EXTRACT(incoming_ids, CONCAT('$[', idx, ']')))
        FROM JSON_TABLE(incoming_ids, '$[*]' COLUMNS (idx FOR ORDINALITY)) AS t;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    START TRANSACTION;
    
    OPEN incoming_cursor;
    read_loop: LOOP
        FETCH incoming_cursor INTO incoming_id;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Insert into tbl_inmain (history)
        INSERT INTO tbl_inmain (
            incoming_id, date, reference, supplier, document_ref,
            din_flag, benz_number, benz_number2, benz_number3, brand, altno, altno2,
            description, application, color_code, remarks,
            cost, selling_price, currency, fc_cost, conversion,
            quantity, unit, reorder_point, location, posted_by
        )
        SELECT 
            id, date, reference, supplier, document_ref,
            din_flag, benz_number, benz_number2, benz_number3, brand, altno, altno2,
            description, application, color_code, remarks,
            cost, selling_price, currency, fc_cost, conversion,
            quantity, unit, reorder_point, location, posted_by
        FROM tbl_incoming 
        WHERE id = incoming_id AND status = 'approved';
        
        -- Update or insert into tbl_stock (main inventory)
        INSERT INTO tbl_stock (
            BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, `DESC`, APPL,
            COLORCODE, REMARKS, COST, SELL, QTY, UNIT, REORDER,
            LOCATION, DINFLAG, source_type, source_id, last_updated_by
        )
        SELECT 
            benz_number, benz_number2, benz_number3, brand, altno, altno2, 
            description, application, color_code, remarks, cost, selling_price, 
            quantity, unit, reorder_point, location, din_flag,
            'incoming', id, posted_by
        FROM tbl_incoming 
        WHERE id = incoming_id AND status = 'approved'
        ON DUPLICATE KEY UPDATE
            QTY = QTY + VALUES(QTY),
            COST = VALUES(COST),
            SELL = VALUES(SELL),
            last_updated_at = CURRENT_TIMESTAMP,
            last_updated_by = posted_by;
        
        -- Update status in tbl_incoming
        UPDATE tbl_incoming 
        SET status = 'posted', posted_at = CURRENT_TIMESTAMP, posted_by = posted_by
        WHERE id = incoming_id;
        
    END LOOP;
    CLOSE incoming_cursor;
    
    COMMIT;
END //
DELIMITER ;

-- 9. Create triggers for audit trail
-- Trigger to log stock adjustments
DELIMITER //
CREATE TRIGGER trg_stock_adjustment_log
AFTER UPDATE ON tbl_stock
FOR EACH ROW
BEGIN
    IF OLD.QTY != NEW.QTY THEN
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
            'Inventory adjustment',
            NEW.last_updated_by
        );
    END IF;
END //
DELIMITER ;

-- 10. Create indexes for better performance (replaces NTX files)
-- Additional indexes for common queries
CREATE INDEX idx_stock_benz_brand_altno ON tbl_stock(BENZ, BRAND, ALTNO);
CREATE INDEX idx_stock_quantity ON tbl_stock(QTY);
CREATE INDEX idx_stock_sell ON tbl_stock(SELL);
CREATE INDEX idx_stock_reorder ON tbl_stock(REORDER);

-- =====================================================
-- DATABASE SETUP COMPLETE
-- Your system now supports the complete TRACK.EXE workflow:
-- 1. Import stock → tbl_incoming (pending)
-- 2. Review & approve → status change
-- 3. Post to inventory → tbl_stock (active) + tbl_inmain (history)
-- 4. Track adjustments → tbl_stock_adjustments
-- =====================================================

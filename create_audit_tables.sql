-- Create audit tables for Inventory Audit feature
-- Run this script to set up the database structure

-- 1. Audit Sessions Table
CREATE TABLE IF NOT EXISTS audit_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_name VARCHAR(100) NOT NULL,
    status ENUM('draft', 'completed', 'cancelled') DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    total_items INT DEFAULT 0,
    matched_items INT DEFAULT 0,
    discrepancy_items INT DEFAULT 0,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Audit Items Table
CREATE TABLE IF NOT EXISTS audit_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    stock_id INT NOT NULL,
    system_quantity INT NOT NULL,
    physical_count INT DEFAULT 0,
    variance INT DEFAULT 0,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (session_id) REFERENCES audit_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (stock_id) REFERENCES tbl_stock(id) ON DELETE CASCADE,
    UNIQUE KEY unique_session_stock (session_id, stock_id)
);

-- 3. Audit Variance Reports Table
CREATE TABLE IF NOT EXISTS audit_variance_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    report_type ENUM('summary', 'detailed', 'discrepancy') NOT NULL,
    report_data JSON,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES audit_sessions(id) ON DELETE CASCADE
);

-- Add indexes for better performance
CREATE INDEX idx_audit_sessions_user_id ON audit_sessions(user_id);
CREATE INDEX idx_audit_sessions_status ON audit_sessions(status);
CREATE INDEX idx_audit_items_session_id ON audit_items(session_id);
CREATE INDEX idx_audit_items_stock_id ON audit_items(stock_id);
CREATE INDEX idx_audit_variance_reports_session_id ON audit_variance_reports(session_id);

-- Insert sample data for testing (optional)
INSERT INTO audit_sessions (user_id, session_name, status, total_items, matched_items, discrepancy_items, notes) 
VALUES (1, 'Test Audit Session', 'draft', 0, 0, 0, 'Sample audit session for testing');

-- Show table structure
DESCRIBE audit_sessions;
DESCRIBE audit_items;
DESCRIBE audit_variance_reports;

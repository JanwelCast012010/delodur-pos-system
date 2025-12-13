-- Inventory Audit and Bulk Scanner Tables
-- Add these tables to your existing database

USE inventory_system;

-- Inventory Audits table
CREATE TABLE IF NOT EXISTS inventory_audits (
  id VARCHAR(50) PRIMARY KEY,
  session_name VARCHAR(255) NOT NULL,
  total_items INT DEFAULT 0,
  discrepancies INT DEFAULT 0,
  accuracy_percentage DECIMAL(5,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at)
);

-- Inventory Audit Items table
CREATE TABLE IF NOT EXISTS inventory_audit_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  audit_id VARCHAR(50) NOT NULL,
  product_id INT NOT NULL,
  barcode VARCHAR(50),
  system_quantity INT DEFAULT 0,
  scanned_quantity INT DEFAULT 0,
  discrepancy INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (audit_id) REFERENCES inventory_audits(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_audit_id (audit_id),
  INDEX idx_product_id (product_id)
);

-- Bulk Scan Sessions table
CREATE TABLE IF NOT EXISTS bulk_scan_sessions (
  id VARCHAR(50) PRIMARY KEY,
  session_name VARCHAR(255) NOT NULL,
  total_items INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at)
);

-- Bulk Scan Items table
CREATE TABLE IF NOT EXISTS bulk_scan_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(50) NOT NULL,
  product_id INT NOT NULL,
  barcode VARCHAR(50),
  quantity INT DEFAULT 0,
  mode ENUM('add', 'remove', 'count') DEFAULT 'add',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES bulk_scan_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_session_id (session_id),
  INDEX idx_product_id (product_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_stock_items_product_id ON stock_items(product_id);


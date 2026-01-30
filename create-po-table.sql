-- Create P.O (Purchase Order) table
-- MySQL Database

CREATE DATABASE IF NOT EXISTS inventory_system;
USE inventory_system;

-- P.O table for purchase order data
CREATE TABLE IF NOT EXISTS po_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  part_number VARCHAR(100),
  brand VARCHAR(100),
  description TEXT,
  qty INT DEFAULT 0,
  ts DECIMAL(10,2) DEFAULT NULL,
  dl DECIMAL(10,2) DEFAULT NULL,
  others DECIMAL(10,2) DEFAULT NULL,
  po_no VARCHAR(100),
  remarks TEXT,
  benz2 VARCHAR(50) DEFAULT NULL,
  benz3 VARCHAR(50) DEFAULT NULL,
  oem VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_part_number (part_number),
  INDEX idx_brand (brand),
  INDEX idx_po_no (po_no),
  INDEX idx_description (description(255)),
  INDEX idx_benz2 (benz2),
  INDEX idx_benz3 (benz3),
  INDEX idx_oem (oem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


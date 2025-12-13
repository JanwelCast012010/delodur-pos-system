-- Refunds System Database Schema
-- This script creates tables for managing refunds in the inventory system

USE inventory_system;

-- Refunds table - Main refund requests
CREATE TABLE IF NOT EXISTS refunds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cm_number VARCHAR(50) UNIQUE NOT NULL COMMENT 'Credit Memo Number (e.g., CM-2025-001)',
  status ENUM('PENDING', 'CONFIRMED', 'CANCELLED') DEFAULT 'PENDING',
  customer_name VARCHAR(255),
  receipt_number VARCHAR(100),
  invoice_number VARCHAR(100),
  refund_date DATE NOT NULL,
  reason VARCHAR(255),
  notes TEXT,
  total_amount DECIMAL(10,2) DEFAULT 0,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmed_by VARCHAR(255),
  confirmed_at TIMESTAMP NULL,
  cancelled_by VARCHAR(255),
  cancelled_at TIMESTAMP NULL,
  cancellation_reason VARCHAR(255),
  INDEX idx_cm_number (cm_number),
  INDEX idx_status (status),
  INDEX idx_customer (customer_name),
  INDEX idx_receipt (receipt_number),
  INDEX idx_date (refund_date),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Refund items table - Individual items in a refund
CREATE TABLE IF NOT EXISTS refund_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  refund_id INT NOT NULL,
  -- Reference to original sale (from history table)
  history_id INT COMMENT 'Reference to history table record (if available)',
  idcode VARCHAR(50) COMMENT 'Stock ID from original sale',
  benz VARCHAR(50) COMMENT 'Part number',
  brand VARCHAR(100),
  altno VARCHAR(50),
  colorcode VARCHAR(50),
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2),
  amount DECIMAL(10,2),
  reason VARCHAR(255) COMMENT 'Item-specific reason if different from main refund reason',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (refund_id) REFERENCES refunds(id) ON DELETE CASCADE,
  INDEX idx_refund_id (refund_id),
  INDEX idx_idcode (idcode),
  INDEX idx_history_id (history_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table to track which history items have refunds (for quick status lookup)
CREATE TABLE IF NOT EXISTS history_refund_status (
  id INT AUTO_INCREMENT PRIMARY KEY,
  history_idcode VARCHAR(50) NOT NULL COMMENT 'IDCODE from history table',
  history_date DATE NOT NULL,
  history_receipt VARCHAR(100) NOT NULL,
  refund_id INT,
  refund_item_id INT,
  status ENUM('PENDING', 'CONFIRMED', 'CANCELLED') DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (refund_id) REFERENCES refunds(id) ON DELETE SET NULL,
  FOREIGN KEY (refund_item_id) REFERENCES refund_items(id) ON DELETE SET NULL,
  UNIQUE KEY unique_history_refund (history_idcode, history_date, history_receipt),
  INDEX idx_history_lookup (history_idcode, history_date, history_receipt),
  INDEX idx_status (status),
  INDEX idx_refund_id (refund_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CM Number sequence table for auto-generating CM numbers
CREATE TABLE IF NOT EXISTS cm_sequence (
  id INT PRIMARY KEY DEFAULT 1,
  year INT NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initialize CM sequence for current year
INSERT INTO cm_sequence (id, year, last_number) 
VALUES (1, YEAR(CURDATE()), 0)
ON DUPLICATE KEY UPDATE year = year;


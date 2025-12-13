-- Drop and recreate history table to match DBF structure
-- Based on C:/rea/files/history.DBF structure

USE inventory_system;

-- Drop existing history table
DROP TABLE IF EXISTS history;

-- Create new history table matching exact DBF structure from screenshot
CREATE TABLE history (
  CUSTOMER VARCHAR(50) DEFAULT NULL,
  DATE DATE DEFAULT NULL,
  RECEIPT VARCHAR(20) DEFAULT NULL,
  INVOICE VARCHAR(20) DEFAULT NULL,
  IDCODE INT DEFAULT NULL,
  SELL DECIMAL(12,2) DEFAULT NULL,
  QTY INT DEFAULT NULL,
  BENZ VARCHAR(30) DEFAULT NULL,
  BRAND VARCHAR(20) DEFAULT NULL,
  ALTNO VARCHAR(50) DEFAULT NULL,
  COLORCODE VARCHAR(20) DEFAULT NULL,
  REMARKS VARCHAR(100) DEFAULT NULL,
  COST DECIMAL(12,2) DEFAULT NULL,
  
  -- Add indexes for performance (matching Sales History API usage)
  INDEX idx_date (DATE),
  INDEX idx_customer (CUSTOMER),
  INDEX idx_benz (BENZ),
  INDEX idx_brand (BRAND),
  INDEX idx_invoice (INVOICE)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Verify the table structure
DESCRIBE history;

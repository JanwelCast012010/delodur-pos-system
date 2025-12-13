-- Add stock_requests table if it doesn't exist
-- Run this script to fix the request button functionality in the stock page

USE inventory_system;

CREATE TABLE IF NOT EXISTS stock_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  username VARCHAR(50),
  stock_id VARCHAR(50),
  stock_description TEXT,
  reason TEXT,
  status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  part_no VARCHAR(50),
  oem VARCHAR(50),
  brand VARCHAR(50),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- Verify the table was created
SHOW TABLES LIKE 'stock_requests';
DESCRIBE stock_requests;


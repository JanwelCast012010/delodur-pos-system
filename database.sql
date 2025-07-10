-- Inventory Tracking System Database Schema
-- MySQL Database

CREATE DATABASE IF NOT EXISTS inventory_system;
USE inventory_system;

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table (master catalog)
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barcode VARCHAR(50) UNIQUE,
  benz_number VARCHAR(20),
  brand VARCHAR(50) NOT NULL,
  alt_number VARCHAR(50),
  description TEXT,
  application TEXT,
  unit VARCHAR(20),
  reorder_point INT DEFAULT 0,
  location VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_barcode (barcode),
  INDEX idx_brand (brand),
  INDEX idx_benz_number (benz_number)
);

-- Stock items table (inventory with variations)
CREATE TABLE IF NOT EXISTS stock_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  color_code VARCHAR(20),
  remarks VARCHAR(100),
  cost DECIMAL(10,2) DEFAULT 0,
  selling_price DECIMAL(10,2) DEFAULT 0,
  quantity INT DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'USD',
  fc_cost DECIMAL(10,2) DEFAULT 0,
  conversion_rate DECIMAL(10,4) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_color (product_id, color_code)
);

-- Incoming stocks table
CREATE TABLE IF NOT EXISTS incoming_stocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  reference VARCHAR(50) NOT NULL,
  supplier_id INT,
  product_id INT NOT NULL,
  stock_item_id INT NOT NULL,
  quantity INT NOT NULL,
  cost DECIMAL(10,2),
  selling_price DECIMAL(10,2),
  currency VARCHAR(10),
  fc_cost DECIMAL(10,2),
  conversion_rate DECIMAL(10,4),
  document_ref VARCHAR(50),
  status ENUM('new', 'posted') DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (stock_item_id) REFERENCES stock_items(id),
  INDEX idx_date (date),
  INDEX idx_reference (reference),
  INDEX idx_status (status)
);

-- Outgoing stocks table
CREATE TABLE IF NOT EXISTS outgoing_stocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  receipt_number VARCHAR(50) NOT NULL,
  customer VARCHAR(100),
  product_id INT NOT NULL,
  stock_item_id INT NOT NULL,
  quantity INT NOT NULL,
  selling_price DECIMAL(10,2),
  invoice BOOLEAN DEFAULT FALSE,
  status ENUM('new', 'posted') DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (stock_item_id) REFERENCES stock_items(id),
  INDEX idx_date (date),
  INDEX idx_receipt (receipt_number),
  INDEX idx_status (status)
);

-- Sales history table
CREATE TABLE IF NOT EXISTS sales_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  receipt_number VARCHAR(50) NOT NULL,
  customer VARCHAR(100),
  product_id INT NOT NULL,
  stock_item_id INT NOT NULL,
  quantity INT NOT NULL,
  selling_price DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  invoice BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (stock_item_id) REFERENCES stock_items(id),
  INDEX idx_date (date),
  INDEX idx_customer (customer)
);

-- Create default admin user (password: admin123)
INSERT INTO users (username, password, role) VALUES 
('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
ON DUPLICATE KEY UPDATE username=username;

-- Insert sample suppliers
INSERT INTO suppliers (code, name, address, phone, email) VALUES
('SUP001', 'Mercedes-Benz Parts', '123 Auto Parts St, City', '+1-555-0101', 'parts@mercedes.com'),
('SUP002', 'BMW Components', '456 German Ave, Town', '+1-555-0102', 'components@bmw.com'),
('SUP003', 'Audi Supplies', '789 Luxury Blvd, Village', '+1-555-0103', 'supplies@audi.com')
ON DUPLICATE KEY UPDATE code=code;

-- Insert sample products
INSERT INTO products (barcode, benz_number, brand, alt_number, description, application, unit, reorder_point, location) VALUES
('1234567890123', 'A123456789', 'Mercedes', 'MB001', 'Brake Pad Set', 'Front Brakes', 'Set', 10, 'A1-01'),
('1234567890124', 'A123456790', 'Mercedes', 'MB002', 'Oil Filter', 'Engine Oil', 'Piece', 20, 'A1-02'),
('1234567890125', 'B123456789', 'BMW', 'BMW001', 'Air Filter', 'Engine Air', 'Piece', 15, 'B1-01'),
('1234567890126', 'B123456790', 'BMW', 'BMW002', 'Spark Plug', 'Engine Ignition', 'Set', 25, 'B1-02'),
('1234567890127', 'C123456789', 'Audi', 'AUD001', 'Timing Belt', 'Engine Timing', 'Piece', 5, 'C1-01')
ON DUPLICATE KEY UPDATE barcode=barcode;

-- Insert sample stock items
INSERT INTO stock_items (product_id, color_code, remarks, cost, selling_price, quantity, currency, fc_cost, conversion_rate) VALUES
(1, 'BLACK', 'Standard', 50.00, 75.00, 25, 'USD', 45.00, 1.10),
(1, 'RED', 'Performance', 60.00, 90.00, 15, 'USD', 55.00, 1.10),
(2, 'WHITE', 'Standard', 15.00, 25.00, 50, 'USD', 13.00, 1.10),
(3, 'BLUE', 'High Flow', 20.00, 35.00, 30, 'USD', 18.00, 1.10),
(4, 'SILVER', 'Iridium', 8.00, 15.00, 100, 'USD', 7.00, 1.10),
(5, 'BLACK', 'Reinforced', 120.00, 180.00, 8, 'USD', 110.00, 1.10)
ON DUPLICATE KEY UPDATE product_id=product_id; 
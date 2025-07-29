-- Cashier table for items sent from warehouse to cashier
CREATE TABLE IF NOT EXISTS cashier (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(32) NOT NULL,
  user_id INT,
  stock_id INT NOT NULL,
  quantity INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending', 'sold', 'cancelled') DEFAULT 'pending',
  sold_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (stock_id) REFERENCES tbl_stock(ID) ON DELETE CASCADE,
  INDEX idx_user_stock (user_id, stock_id),
  INDEX idx_order_id (order_id)
);

-- Service table for items sent from warehouse to service
CREATE TABLE IF NOT EXISTS service (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(32) NOT NULL,
  user_id INT,
  stock_id INT NOT NULL,
  quantity INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending', 'used', 'returned_to_stock', 'sent_to_cashier') DEFAULT 'pending',
  returned_at TIMESTAMP NULL,
  sent_to_cashier_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (stock_id) REFERENCES tbl_stock(ID) ON DELETE CASCADE,
  INDEX idx_user_stock (user_id, stock_id),
  INDEX idx_order_id (order_id)
); 
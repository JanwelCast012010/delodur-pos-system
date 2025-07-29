CREATE TABLE warehouse (
  no INT AUTO_INCREMENT PRIMARY KEY,
  qty INT NOT NULL,
  part_no VARCHAR(100),
  id_number INT NOT NULL,
  description TEXT,
  unit_price DECIMAL(10,2),
  remarks TEXT,
  location VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  order_id VARCHAR(36),
  user_id INT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
); 
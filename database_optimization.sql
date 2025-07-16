-- Database Optimization Script for Inventory System
-- This script adds indexes and optimizations for better performance

USE inventory_system;

-- Add composite indexes for frequently searched columns in master table
CREATE INDEX IF NOT EXISTS idx_master_brand_benz ON master(BRAND, BENZ);
CREATE INDEX IF NOT EXISTS idx_master_search ON master(BRAND, BENZ, ALTNO, ALTNO2, `DESC`);
CREATE INDEX IF NOT EXISTS idx_master_brand_only ON master(BRAND);

-- Add indexes for stock table
CREATE INDEX IF NOT EXISTS idx_stock_brand_benz ON tbl_stock(BRAND, BENZ);
CREATE INDEX IF NOT EXISTS idx_stock_search ON tbl_stock(BRAND, BENZ, ALTNO, ALTNO2);
CREATE INDEX IF NOT EXISTS idx_stock_qty ON tbl_stock(QTY);
CREATE INDEX IF NOT EXISTS idx_stock_date ON tbl_stock(DATE);
CREATE INDEX IF NOT EXISTS idx_stock_brand_qty ON tbl_stock(BRAND, QTY);

-- Add indexes for suppliers table
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(NAME);
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(CODE);
CREATE INDEX IF NOT EXISTS idx_suppliers_search ON suppliers(NAME, CODE, EMAIL);

-- Add indexes for history table
CREATE INDEX IF NOT EXISTS idx_history_date ON history(DATE);
CREATE INDEX IF NOT EXISTS idx_history_customer ON history(CUSTOMER);
CREATE INDEX IF NOT EXISTS idx_history_invoice ON history(INVOICE);
CREATE INDEX IF NOT EXISTS idx_history_brand ON history(BRAND);
CREATE INDEX IF NOT EXISTS idx_history_date_customer ON history(DATE, CUSTOMER);

-- Add indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Add indexes for chat functionality
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver ON chat_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON chat_messages(receiver_id, is_read);

-- Add indexes for user activity
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_online ON user_activity(is_online);
CREATE INDEX IF NOT EXISTS idx_user_activity_last ON user_activity(last_activity);

-- Add indexes for customers table
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_name);
CREATE INDEX IF NOT EXISTS idx_customers_search ON customers(name, email, company_name);

-- Optimize table settings for better performance
ALTER TABLE master ENGINE=InnoDB;
ALTER TABLE tbl_stock ENGINE=InnoDB;
ALTER TABLE suppliers ENGINE=InnoDB;
ALTER TABLE history ENGINE=InnoDB;
ALTER TABLE users ENGINE=InnoDB;
ALTER TABLE chat_messages ENGINE=InnoDB;
ALTER TABLE user_activity ENGINE=InnoDB;
ALTER TABLE customers ENGINE=InnoDB;

-- Set proper character set and collation
ALTER TABLE master CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE tbl_stock CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE suppliers CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE history CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE chat_messages CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE user_activity CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE customers CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Analyze tables for better query optimization
ANALYZE TABLE master;
ANALYZE TABLE tbl_stock;
ANALYZE TABLE suppliers;
ANALYZE TABLE history;
ANALYZE TABLE users;
ANALYZE TABLE chat_messages;
ANALYZE TABLE user_activity;
ANALYZE TABLE customers;

-- Show created indexes for verification
SHOW INDEX FROM master;
SHOW INDEX FROM tbl_stock;
SHOW INDEX FROM suppliers;
SHOW INDEX FROM history; 
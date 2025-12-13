-- Migration script to add unit_price column to cashier and service tables
-- This ensures price locking works properly throughout the workflow

-- Add unit_price column to cashier table
ALTER TABLE cashier ADD COLUMN unit_price DECIMAL(10,2) DEFAULT 0.00 AFTER quantity;

-- Add unit_price column to service table  
ALTER TABLE service ADD COLUMN unit_price DECIMAL(10,2) DEFAULT 0.00 AFTER quantity;

-- Update existing records to use current stock prices as fallback
-- This is a one-time migration for existing data
UPDATE cashier c 
JOIN tbl_stock ts ON c.stock_id = ts.ID 
SET c.unit_price = ts.SELL 
WHERE c.unit_price = 0.00;

UPDATE service s 
JOIN tbl_stock ts ON s.stock_id = ts.ID 
SET s.unit_price = ts.SELL 
WHERE s.unit_price = 0.00;

-- Add indexes for better performance
CREATE INDEX idx_cashier_unit_price ON cashier(unit_price);
CREATE INDEX idx_service_unit_price ON service(unit_price);

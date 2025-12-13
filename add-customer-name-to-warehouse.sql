-- Add customer_name column to warehouse table
-- This allows tracking which customer each warehouse order belongs to

ALTER TABLE warehouse 
ADD COLUMN customer_name VARCHAR(255) NULL AFTER order_id;

-- Add index for faster customer lookups
CREATE INDEX idx_warehouse_customer_name ON warehouse(customer_name);

-- Update existing records (optional - set to NULL or a default value)
-- UPDATE warehouse SET customer_name = 'Walk-in Customer' WHERE customer_name IS NULL;

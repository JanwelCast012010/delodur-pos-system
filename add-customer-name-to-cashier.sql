-- Add customer_name column to cashier table
-- This allows tracking which customer each cashier order belongs to

ALTER TABLE cashier 
ADD COLUMN customer_name VARCHAR(255) NULL AFTER order_id;

-- Add index for faster customer lookups
CREATE INDEX idx_cashier_customer_name ON cashier(customer_name);

-- Update existing records (optional - set to NULL or a default value)
-- UPDATE cashier SET customer_name = 'Walk-in Customer' WHERE customer_name IS NULL;


-- Add repair_order_number column to service table
ALTER TABLE service ADD COLUMN repair_order_number VARCHAR(255) NULL AFTER requisition_number;

-- Verify the column was added
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'service' 
AND COLUMN_NAME = 'repair_order_number';


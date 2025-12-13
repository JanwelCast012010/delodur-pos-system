-- Add missing columns to master table
USE inventory_system;

-- Add LOCATION column if it doesn't exist
ALTER TABLE master ADD COLUMN IF NOT EXISTS LOCATION CHAR(10) DEFAULT NULL;

-- Add REORDER column if it doesn't exist  
ALTER TABLE master ADD COLUMN IF NOT EXISTS REORDER INT(5) DEFAULT NULL;

-- Add BALANCE column if it doesn't exist
ALTER TABLE master ADD COLUMN IF NOT EXISTS BALANCE INT(5) DEFAULT NULL;

-- Add indexes for better performance
ALTER TABLE master ADD INDEX IF NOT EXISTS idx_benz (BENZ);
ALTER TABLE master ADD INDEX IF NOT EXISTS idx_brand (BRAND);
ALTER TABLE master ADD INDEX IF NOT EXISTS idx_altno (ALTNO);

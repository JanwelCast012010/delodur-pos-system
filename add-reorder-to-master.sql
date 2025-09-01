-- Add REORDER and BALANCE columns to master table
ALTER TABLE master ADD COLUMN REORDER INT DEFAULT NULL;
ALTER TABLE master ADD COLUMN BALANCE INT DEFAULT 0;

-- Verify the columns were added
DESCRIBE master;

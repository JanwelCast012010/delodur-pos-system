-- Add requisition_number column to service table
-- This script adds the requisition_number column to store Part Requisition Form numbers

ALTER TABLE service 
ADD COLUMN requisition_number VARCHAR(255) NULL 
AFTER status;

-- Add index for better query performance
CREATE INDEX idx_service_requisition ON service(requisition_number);

-- Update existing records to have empty requisition_number (optional)
-- UPDATE service SET requisition_number = '' WHERE requisition_number IS NULL;

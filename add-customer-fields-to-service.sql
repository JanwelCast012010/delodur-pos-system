-- Migration script to add customer_name and plate_number columns to service table
-- This allows tracking customer information for service orders

-- Add customer_name column to service table
ALTER TABLE service ADD COLUMN customer_name VARCHAR(255) DEFAULT NULL AFTER unit_price;

-- Add plate_number column to service table  
ALTER TABLE service ADD COLUMN plate_number VARCHAR(50) DEFAULT NULL AFTER customer_name;

-- Add indexes for better performance
CREATE INDEX idx_service_customer_name ON service(customer_name);
CREATE INDEX idx_service_plate_number ON service(plate_number);

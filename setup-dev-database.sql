-- Development Database Setup Script
-- Run this in MySQL to create your development database

-- Create development database
CREATE DATABASE IF NOT EXISTS inventory_system_dev;

-- Use the development database
USE inventory_system_dev;

-- Copy your production schema here
-- You can export your current database structure with:
-- mysqldump -u root -p inventory_system --no-data > schema.sql
-- Then import it to the development database

-- Example: Import your current schema
-- mysql -u root -p inventory_system_dev < schema.sql

SELECT 'Development database setup complete!' as status;

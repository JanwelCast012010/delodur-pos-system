-- Quick Performance Check Script
-- Run this to see if you have basic indexes and check query performance

USE inventory_system;

-- 1. Check existing indexes on critical tables
SHOW INDEX FROM tbl_stock WHERE Key_name = 'PRIMARY' OR Column_name IN ('ID', 'BENZ', 'BRAND', 'DATE');
SHOW INDEX FROM history WHERE Column_name IN ('DATE', 'IDCODE', 'CUSTOMER', 'BENZ', 'BRAND');
SHOW INDEX FROM master WHERE Column_name IN ('BENZ', 'BRAND');

-- 2. Test query performance (run these and note the time)
-- Replace 'YOUR_SEARCH_TERM' with an actual search
-- 
-- Test 1: Stock search by BENZ
-- EXPLAIN SELECT * FROM tbl_stock WHERE BENZ LIKE '%205 240 33 00%' LIMIT 20;
--
-- Test 2: History search by date
-- EXPLAIN SELECT * FROM history WHERE DATE = '2025-11-07' LIMIT 20;
--
-- Test 3: Join performance (stock + master)
-- EXPLAIN SELECT h.*, ts.BENZ, ts.BRAND 
-- FROM history h 
-- LEFT JOIN tbl_stock ts ON h.IDCODE = ts.ID 
-- WHERE h.DATE = '2025-11-07' 
-- LIMIT 20;

-- 3. Check table sizes (larger tables benefit more from indexes)
SELECT 
    table_name AS 'Table',
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)',
    table_rows AS 'Rows'
FROM information_schema.TABLES 
WHERE table_schema = 'inventory_system'
    AND table_name IN ('tbl_stock', 'history', 'master', 'inmain')
ORDER BY (data_length + index_length) DESC;

-- 4. If you see "Using filesort" or "Using temporary" in EXPLAIN results,
--    or if table sizes are > 50MB, consider adding indexes.


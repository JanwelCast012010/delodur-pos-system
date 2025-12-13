-- MySQL Query Cache Configuration
-- Run this in MySQL to enable query cache (MySQL 5.7 and earlier only)

-- Check MySQL version first
SELECT VERSION();

-- If MySQL 5.7 or earlier, enable query cache:

-- 1. Check current query cache settings
SHOW VARIABLES LIKE 'query_cache%';

-- 2. Enable query cache (if not already enabled)
SET GLOBAL query_cache_type = 1;  -- 1 = ON, 0 = OFF, 2 = ON_DEMAND
SET GLOBAL query_cache_size = 67108864;  -- 64 MB cache (adjust based on RAM)

-- 3. Set query cache limit (max size per query result to cache)
SET GLOBAL query_cache_limit = 1048576;  -- 1 MB per query

-- 4. Verify settings
SHOW VARIABLES LIKE 'query_cache%';

-- 5. Check cache status
SHOW STATUS LIKE 'Qcache%';

-- ============================================
-- RECOMMENDED SETTINGS:
-- ============================================
-- query_cache_type = 1 (ON)
-- query_cache_size = 64MB (for 8GB RAM server)
-- query_cache_size = 128MB (for 16GB RAM server)
-- query_cache_limit = 1MB

-- ============================================
-- TO MAKE PERMANENT (add to my.ini or my.cnf):
-- ============================================
-- [mysqld]
-- query_cache_type = 1
-- query_cache_size = 67108864
-- query_cache_limit = 1048576

-- ============================================
-- FOR MYSQL 8.0+ (Query Cache Removed):
-- ============================================
-- MySQL 8.0 removed query cache because:
-- - It had performance issues
-- - Modern applications use application-level caching (which you already have!)
-- 
-- Your system already uses NodeCache for caching, which is better!
-- No action needed for MySQL 8.0+


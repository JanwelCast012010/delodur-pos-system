-- OPTIONAL: Only run this IF you notice slowness
-- This adds indexes that help with common searches
-- Safe to run multiple times (uses IF NOT EXISTS)

USE inventory_system;

-- ============================================
-- CRITICAL INDEXES (Only if searches are slow)
-- ============================================

-- History table - for joining with stock
CREATE INDEX IF NOT EXISTS idx_history_idcode ON history(IDCODE);

-- Stock table - for searches by part number and brand
CREATE INDEX IF NOT EXISTS idx_stock_benz ON tbl_stock(BENZ);
CREATE INDEX IF NOT EXISTS idx_stock_brand ON tbl_stock(BRAND);
CREATE INDEX IF NOT EXISTS idx_stock_benz_brand ON tbl_stock(BENZ, BRAND);

-- Master table - for description lookups
CREATE INDEX IF NOT EXISTS idx_master_benz_brand ON master(BENZ, BRAND);

-- ============================================
-- OPTIONAL INDEXES (Only if specific features are slow)
-- ============================================

-- Only add if stock quantity filtering is slow
-- CREATE INDEX IF NOT EXISTS idx_stock_qty ON tbl_stock(QTY);

-- Only add if date-based stock queries are slow
-- CREATE INDEX IF NOT EXISTS idx_stock_date ON tbl_stock(DATE);

-- ============================================
-- Verify indexes were created
-- ============================================
SHOW INDEX FROM history WHERE Column_name = 'IDCODE';
SHOW INDEX FROM tbl_stock WHERE Column_name IN ('BENZ', 'BRAND');
SHOW INDEX FROM master WHERE Column_name IN ('BENZ', 'BRAND');

-- ============================================
-- Analyze tables (helps MySQL optimize queries)
-- ============================================
ANALYZE TABLE history;
ANALYZE TABLE tbl_stock;
ANALYZE TABLE master;

SELECT 'Optimization complete! If queries are still slow, check with EXPLAIN.' AS Status;


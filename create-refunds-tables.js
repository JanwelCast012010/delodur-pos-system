const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_system'
};

async function createRefundsTables() {
  let connection;
  
  try {
    console.log('🚀 Creating refunds system tables...');
    
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
    
    // Create refunds table
    console.log('\n📋 Creating refunds table...');
    const createRefundsTable = `
      CREATE TABLE IF NOT EXISTS refunds (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cm_number VARCHAR(50) UNIQUE NOT NULL COMMENT 'Credit Memo Number (e.g., CM-2025-001)',
        status ENUM('PENDING', 'CONFIRMED', 'CANCELLED') DEFAULT 'PENDING',
        customer_name VARCHAR(255),
        receipt_number VARCHAR(100),
        invoice_number VARCHAR(100),
        refund_date DATE NOT NULL,
        reason VARCHAR(255),
        notes TEXT,
        total_amount DECIMAL(10,2) DEFAULT 0,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        confirmed_by VARCHAR(255),
        confirmed_at TIMESTAMP NULL,
        cancelled_by VARCHAR(255),
        cancelled_at TIMESTAMP NULL,
        cancellation_reason VARCHAR(255),
        INDEX idx_cm_number (cm_number),
        INDEX idx_status (status),
        INDEX idx_customer (customer_name),
        INDEX idx_receipt (receipt_number),
        INDEX idx_date (refund_date),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.execute(createRefundsTable);
    console.log('✅ refunds table created successfully');
    
    // Create refund_items table
    console.log('\n📋 Creating refund_items table...');
    const createRefundItemsTable = `
      CREATE TABLE IF NOT EXISTS refund_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        refund_id INT NOT NULL,
        history_id INT COMMENT 'Reference to history table record (if available)',
        idcode VARCHAR(50) COMMENT 'Stock ID from original sale',
        benz VARCHAR(50) COMMENT 'Part number',
        brand VARCHAR(100),
        altno VARCHAR(50),
        colorcode VARCHAR(50),
        quantity INT NOT NULL,
        unit_price DECIMAL(10,2),
        amount DECIMAL(10,2),
        reason VARCHAR(255) COMMENT 'Item-specific reason if different from main refund reason',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (refund_id) REFERENCES refunds(id) ON DELETE CASCADE,
        INDEX idx_refund_id (refund_id),
        INDEX idx_idcode (idcode),
        INDEX idx_history_id (history_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.execute(createRefundItemsTable);
    console.log('✅ refund_items table created successfully');
    
    // Create history_refund_status table
    console.log('\n📋 Creating history_refund_status table...');
    const createHistoryRefundStatusTable = `
      CREATE TABLE IF NOT EXISTS history_refund_status (
        id INT AUTO_INCREMENT PRIMARY KEY,
        history_idcode VARCHAR(50) NOT NULL COMMENT 'IDCODE from history table',
        history_date DATE NOT NULL,
        history_receipt VARCHAR(100) NOT NULL,
        refund_id INT,
        refund_item_id INT,
        status ENUM('PENDING', 'CONFIRMED', 'CANCELLED') DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (refund_id) REFERENCES refunds(id) ON DELETE SET NULL,
        FOREIGN KEY (refund_item_id) REFERENCES refund_items(id) ON DELETE SET NULL,
        INDEX idx_history_lookup (history_idcode, history_date, history_receipt),
        INDEX idx_status (status),
        INDEX idx_refund_id (refund_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.execute(createHistoryRefundStatusTable);
    console.log('✅ history_refund_status table created successfully');
    
    // Create cm_sequence table
    console.log('\n📋 Creating cm_sequence table...');
    const createCmSequenceTable = `
      CREATE TABLE IF NOT EXISTS cm_sequence (
        id INT PRIMARY KEY DEFAULT 1,
        year INT NOT NULL,
        last_number INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_year (year)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.execute(createCmSequenceTable);
    console.log('✅ cm_sequence table created successfully');
    
    // Initialize CM sequence for current year
    console.log('\n📋 Initializing CM sequence...');
    const currentYear = new Date().getFullYear();
    await connection.execute(
      `INSERT INTO cm_sequence (id, year, last_number) 
       VALUES (1, ?, 0)
       ON DUPLICATE KEY UPDATE year = year`,
      [currentYear]
    );
    console.log(`✅ CM sequence initialized for year ${currentYear}`);
    
    // Verify tables were created
    console.log('\n🔍 Verifying tables...');
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME IN ('refunds', 'refund_items', 'history_refund_status', 'cm_sequence')
    `, [dbConfig.database]);
    
    if (tables.length === 4) {
      console.log('✅ All tables verified successfully:');
      tables.forEach(table => {
        console.log(`   - ${table.TABLE_NAME}`);
      });
    } else {
      console.warn('⚠️  Warning: Not all tables were created. Found:', tables.length);
    }
    
    console.log('\n✅ Refunds system tables created successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Test the API endpoint: POST /api/sales/refund/create');
    console.log('   2. Create the refund form modal in the frontend');
    console.log('   3. Update Sales History to show PENDING status');
    
  } catch (error) {
    console.error('❌ Error creating refunds tables:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Database connection closed');
    }
  }
}

// Run the script
createRefundsTables();


const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: 'password', // Your MySQL password
  database: process.env.DB_NAME || 'inventory_system'
};

async function createIncTbl() {
  let connection;
  
  try {
    console.log('🚀 Creating inc_tbl table...');
    
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
    
    // Create the inc_tbl table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS inc_tbl (
        id INT AUTO_INCREMENT PRIMARY KEY,
        SUPPLIER VARCHAR(100),
        DATE VARCHAR(8),
        REF VARCHAR(50),
        DINFLAG VARCHAR(1) DEFAULT 'D',
        BENZ VARCHAR(16),
        BENZ2 VARCHAR(16),
        BENZ3 VARCHAR(16),
        BRAND VARCHAR(50),
        ALTNO VARCHAR(20),
        ALTNO2 VARCHAR(20),
        \`DESC\` VARCHAR(100),
        APPL VARCHAR(100),
        COLORCODE VARCHAR(20),
        REMARKS TEXT,
        COST DECIMAL(10,2) DEFAULT 0,
        SELL DECIMAL(10,2) DEFAULT 0,
        QTY INT DEFAULT 0,
        CURRENCY VARCHAR(10) DEFAULT 'PHP',
        FCAMOUNT DECIMAL(10,2) DEFAULT 0,
        CONVERSION DECIMAL(10,4) DEFAULT 1,
        LOCATION VARCHAR(50),
        factor DECIMAL(10,4) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_benz (BENZ),
        INDEX idx_brand (BRAND),
        INDEX idx_date (DATE),
        INDEX idx_supplier (SUPPLIER)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.execute(createTableSQL);
    console.log('✅ inc_tbl table created successfully');
    
    // Check if table exists
    const [tables] = await connection.execute('SHOW TABLES LIKE "inc_tbl"');
    if (tables.length > 0) {
      console.log('✅ Table verification successful');
    } else {
      throw new Error('Table was not created properly');
    }
    
  } catch (error) {
    console.error('❌ Error creating inc_tbl table:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createIncTbl();

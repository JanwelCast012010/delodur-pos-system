const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_system'
};

async function createFinalDataTable() {
  let connection;
  
  try {
    console.log('🚀 Creating final_Data_For_Stock table...');
    
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
    
    // Create the final_Data_For_Stock table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS final_Data_For_Stock (
        id INT AUTO_INCREMENT PRIMARY KEY,
        DINFLAG VARCHAR(50),
        BENZ VARCHAR(100),
        BENZ2 VARCHAR(100),
        BENZ3 VARCHAR(100),
        BRAND VARCHAR(100),
        ALTNO VARCHAR(100),
        ALTNO2 VARCHAR(100),
        COLORCODE VARCHAR(50),
        REMARKS TEXT,
        DATE VARCHAR(50),
        COST DECIMAL(10,2) DEFAULT 0,
        SELL DECIMAL(10,2) DEFAULT 0,
        QTY INT DEFAULT 0,
        CURRENCY VARCHAR(10) DEFAULT 'USD',
        FCAMOUNT DECIMAL(10,2) DEFAULT 0,
        CONVERSION DECIMAL(10,4) DEFAULT 1,
        LOCATION VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_benz (BENZ),
        INDEX idx_brand (BRAND),
        INDEX idx_location (LOCATION)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.execute(createTableSQL);
    console.log('✅ final_Data_For_Stock table created successfully');
    
    // Check if table exists
    const [tables] = await connection.execute('SHOW TABLES LIKE "final_Data_For_Stock"');
    if (tables.length > 0) {
      console.log('✅ Table verification successful');
    } else {
      throw new Error('Table was not created properly');
    }
    
  } catch (error) {
    console.error('❌ Failed to create table:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the script
if (require.main === module) {
  createFinalDataTable()
    .then(() => {
      console.log('🎯 Table creation completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Table creation failed:', error);
      process.exit(1);
    });
}

module.exports = { createFinalDataTable }; 
const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_system'
};

async function createPOTable() {
  let connection;
  
  try {
    console.log('🚀 Creating po_data table...');
    
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
    
    // Create the po_data table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS po_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        part_number VARCHAR(100),
        brand VARCHAR(100),
        description TEXT,
        qty INT DEFAULT 0,
        ts DECIMAL(10,2) DEFAULT NULL,
        dl DECIMAL(10,2) DEFAULT NULL,
        others DECIMAL(10,2) DEFAULT NULL,
        po_no VARCHAR(100),
        remarks TEXT,
        benz2 VARCHAR(50) DEFAULT NULL,
        benz3 VARCHAR(50) DEFAULT NULL,
        oem VARCHAR(100) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_part_number (part_number),
        INDEX idx_brand (brand),
        INDEX idx_po_no (po_no),
        INDEX idx_description (description(255)),
        INDEX idx_benz2 (benz2),
        INDEX idx_benz3 (benz3),
        INDEX idx_oem (oem)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.execute(createTableSQL);
    console.log('✅ po_data table created successfully');
    
    // Check if table exists
    const [tables] = await connection.execute('SHOW TABLES LIKE "po_data"');
    if (tables.length > 0) {
      console.log('✅ Verified: po_data table exists');
    } else {
      console.log('⚠️ Warning: po_data table may not exist');
    }
    
  } catch (error) {
    console.error('❌ Error creating po_data table:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

// Run if called directly
if (require.main === module) {
  createPOTable()
    .then(() => {
      console.log('🎉 P.O table setup completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { createPOTable };


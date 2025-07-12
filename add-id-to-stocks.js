const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_system'
};

async function addIdToStocksTable() {
  let connection;
  
  try {
    console.log('🔧 Checking stocks table structure...');
    
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
    
    // Check if ID column exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'inventory_system' 
      AND TABLE_NAME = 'stocks' 
      AND COLUMN_NAME = 'id'
    `);
    
    if (columns.length === 0) {
      console.log('📝 Adding ID column to stocks table...');
      
      // Add ID column as first column
      await connection.execute(`
        ALTER TABLE stocks 
        ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST
      `);
      
      console.log('✅ ID column added successfully');
    } else {
      console.log('ℹ️ ID column already exists in stocks table');
    }
    
    // Show table structure
    const [structure] = await connection.execute('DESCRIBE stocks');
    console.log('\n📋 Current stocks table structure:');
    structure.forEach(col => {
      console.log(`  ${col.Field} - ${col.Type} ${col.Key ? `(${col.Key})` : ''}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
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
  addIdToStocksTable()
    .then(() => {
      console.log('🎯 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { addIdToStocksTable }; 
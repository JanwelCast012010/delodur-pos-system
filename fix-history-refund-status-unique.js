const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_system'
};

async function fixHistoryRefundStatusUnique() {
  let connection;
  
  try {
    console.log('🔧 Adding unique constraint to history_refund_status table...');
    
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
    
    // Check if unique constraint already exists
    const [constraints] = await connection.execute(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'history_refund_status' 
      AND CONSTRAINT_TYPE = 'UNIQUE'
      AND CONSTRAINT_NAME = 'unique_history_refund'
    `, [dbConfig.database]);
    
    if (constraints.length > 0) {
      console.log('✅ Unique constraint already exists');
      return;
    }
    
    // Add unique constraint
    await connection.execute(`
      ALTER TABLE history_refund_status 
      ADD UNIQUE KEY unique_history_refund (history_idcode, history_date, history_receipt)
    `);
    
    console.log('✅ Unique constraint added successfully');
    
  } catch (error) {
    console.error('❌ Error adding unique constraint:', error.message);
    if (error.code === 'ER_DUP_KEYNAME') {
      console.log('ℹ️  Constraint already exists with a different name');
    } else {
      throw error;
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

// Run the script
fixHistoryRefundStatusUnique();


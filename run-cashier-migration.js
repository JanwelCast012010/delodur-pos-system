// Script to add customer_name column to cashier table
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

async function runMigration() {
  let connection;
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('✅ Connected to database');
    console.log('📝 Running migration: Adding customer_name column to cashier table...');
    
    // Check if column already exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'cashier' 
      AND COLUMN_NAME = 'customer_name'
    `, [dbConfig.database]);
    
    if (columns.length > 0) {
      console.log('ℹ️  Column customer_name already exists in cashier table. Skipping...');
    } else {
      // Add customer_name column
      await connection.execute(`
        ALTER TABLE cashier 
        ADD COLUMN customer_name VARCHAR(255) NULL AFTER order_id
      `);
      console.log('✅ Added customer_name column to cashier table');
      
      // Add index
      try {
        await connection.execute(`
          CREATE INDEX idx_cashier_customer_name ON cashier(customer_name)
        `);
        console.log('✅ Created index on customer_name');
      } catch (indexError) {
        if (indexError.code === 'ER_DUP_KEYNAME') {
          console.log('ℹ️  Index already exists. Skipping...');
        } else {
          throw indexError;
        }
      }
    }
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

runMigration();


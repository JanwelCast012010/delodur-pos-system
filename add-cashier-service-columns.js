const mysql = require('mysql2/promise');
require('dotenv').config();

async function addCashierServiceColumns() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'inventory_system'
    });

    console.log('🔍 Checking cashier table columns...');
    
    // Check existing columns
    const [existingColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'cashier'
    `);
    
    const columnNames = existingColumns.map(col => col.COLUMN_NAME);
    console.log('📋 Existing columns:', columnNames);

    // Add customer_name if it doesn't exist
    if (!columnNames.includes('customer_name')) {
      console.log('➕ Adding customer_name column...');
      await connection.query(`
        ALTER TABLE cashier 
        ADD COLUMN customer_name VARCHAR(255) NULL
      `);
      console.log('✅ Added customer_name column');
    } else {
      console.log('✅ customer_name column already exists');
    }

    // Add plate_number if it doesn't exist
    if (!columnNames.includes('plate_number')) {
      console.log('➕ Adding plate_number column...');
      await connection.query(`
        ALTER TABLE cashier 
        ADD COLUMN plate_number VARCHAR(255) NULL
      `);
      console.log('✅ Added plate_number column');
    } else {
      console.log('✅ plate_number column already exists');
    }

    // Add repair_order_number if it doesn't exist
    if (!columnNames.includes('repair_order_number')) {
      console.log('➕ Adding repair_order_number column...');
      await connection.query(`
        ALTER TABLE cashier 
        ADD COLUMN repair_order_number VARCHAR(255) NULL
      `);
      console.log('✅ Added repair_order_number column');
    } else {
      console.log('✅ repair_order_number column already exists');
    }

    // Add source column if it doesn't exist (to identify 'service' or 'counter')
    if (!columnNames.includes('source')) {
      console.log('➕ Adding source column...');
      await connection.query(`
        ALTER TABLE cashier 
        ADD COLUMN source VARCHAR(50) NULL DEFAULT 'counter'
      `);
      console.log('✅ Added source column');
    } else {
      console.log('✅ source column already exists');
    }

    console.log('✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Error adding columns:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addCashierServiceColumns()
  .then(() => {
    console.log('✅ All columns added successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });


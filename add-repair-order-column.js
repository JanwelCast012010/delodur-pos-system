const mysql = require('mysql2/promise');
require('dotenv').config();

async function addRepairOrderColumn() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'inventory_system'
    });

    console.log('🔍 Checking if repair_order_number column exists...');
    
    // Check if column exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'service' 
      AND COLUMN_NAME = 'repair_order_number'
    `);

    if (columns.length > 0) {
      console.log('✅ Column repair_order_number already exists!');
      return;
    }

    console.log('➕ Adding repair_order_number column to service table...');
    
    // Add the column
    await connection.query(`
      ALTER TABLE service 
      ADD COLUMN repair_order_number VARCHAR(255) NULL 
      AFTER requisition_number
    `);

    console.log('✅ Successfully added repair_order_number column to service table!');

    // Verify
    const [verifyColumns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'service' 
      AND COLUMN_NAME = 'repair_order_number'
    `);

    if (verifyColumns.length > 0) {
      console.log('✅ Verification successful:', verifyColumns[0]);
    }

  } catch (error) {
    console.error('❌ Error adding column:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addRepairOrderColumn()
  .then(() => {
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });


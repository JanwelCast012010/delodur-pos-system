const mysql = require('mysql2/promise');
require('dotenv').config();

async function addRequisitionToCashier() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'inventory_system'
    });

    console.log('🔍 Checking if requisition_number column exists in cashier table...');
    
    // Check if column exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'cashier' 
      AND COLUMN_NAME = 'requisition_number'
    `);

    if (columns.length > 0) {
      console.log('✅ Column requisition_number already exists!');
      return;
    }

    console.log('➕ Adding requisition_number column to cashier table...');
    
    // Add the column
    await connection.query(`
      ALTER TABLE cashier 
      ADD COLUMN requisition_number VARCHAR(255) NULL
    `);

    console.log('✅ Successfully added requisition_number column to cashier table!');

  } catch (error) {
    console.error('❌ Error adding column:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addRequisitionToCashier()
  .then(() => {
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });


const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabaseStructure() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'inventory_system'
  };

  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to inventory_system database');

    // Check master table structure
    console.log('\n📋 MASTER table structure:');
    const [masterFields] = await connection.execute('DESCRIBE master');
    masterFields.forEach(field => {
      console.log(`  ${field.Field} (${field.Type})`);
    });

    // Check tbl_stock table structure
    console.log('\n📋 TBL_STOCK table structure:');
    const [tblStockFields] = await connection.execute('DESCRIBE tbl_stock');
    tblStockFields.forEach(field => {
      console.log(`  ${field.Field} (${field.Type})`);
    });

    // Check history table structure
    console.log('\n📋 HISTORY table structure:');
    const [historyFields] = await connection.execute('DESCRIBE history');
    historyFields.forEach(field => {
      console.log(`  ${field.Field} (${field.Type})`);
    });

    // Show sample data from master
    console.log('\n📦 Sample data from MASTER table:');
    const [masterSample] = await connection.execute('SELECT * FROM master LIMIT 2');
    masterSample.forEach((row, index) => {
      console.log(`  Record ${index + 1}:`, JSON.stringify(row, null, 2));
    });

    // Show sample data from tbl_stock
    console.log('\n📦 Sample data from TBL_STOCK table:');
    const [tblStockSample] = await connection.execute('SELECT * FROM tbl_stock LIMIT 2');
    tblStockSample.forEach((row, index) => {
      console.log(`  Record ${index + 1}:`, JSON.stringify(row, null, 2));
    });

    await connection.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDatabaseStructure(); 
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

    // Check stocks table structure
    console.log('\n📋 STOCKS table structure:');
    const [stocksFields] = await connection.execute('DESCRIBE stocks');
    stocksFields.forEach(field => {
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

    // Show sample data from stocks
    console.log('\n📦 Sample data from STOCKS table:');
    const [stocksSample] = await connection.execute('SELECT * FROM stocks LIMIT 2');
    stocksSample.forEach((row, index) => {
      console.log(`  Record ${index + 1}:`, JSON.stringify(row, null, 2));
    });

    await connection.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDatabaseStructure(); 
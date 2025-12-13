const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupInventoryFeatures() {
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'inventory_system'
    });

    console.log('🔗 Connected to database');

    // Read and execute the SQL file
    const fs = require('fs');
    const sqlContent = fs.readFileSync('./create_inventory_audit_tables.sql', 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sqlContent.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.execute(statement);
        console.log('✅ Executed SQL statement');
      }
    }

    console.log('🎉 Inventory audit and bulk scanner tables created successfully!');
    console.log('\n📋 New features available:');
    console.log('   • Inventory Audit - Compare physical vs system inventory');
    console.log('   • Bulk Scanner - Scan multiple items quickly');
    console.log('\n🚀 You can now access these features from the navigation menu!');

  } catch (error) {
    console.error('❌ Error setting up inventory features:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

setupInventoryFeatures();


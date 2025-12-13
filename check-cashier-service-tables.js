const mysql = require('mysql2/promise');

async function checkCashierServiceTables() {
  try {
    console.log('🔍 Checking cashier and service tables...');
    
    // Create connection
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'inventory_system'
    });
    
    // Check if cashier table exists
    console.log('\n💰 Checking cashier table...');
    try {
      const [cashierRows] = await connection.execute('DESCRIBE cashier');
      console.log('✅ Cashier table exists with columns:');
      cashierRows.forEach(row => {
        console.log(`   - ${row.Field} (${row.Type})`);
      });
      
      // Check row count
      const [cashierCount] = await connection.execute('SELECT COUNT(*) as count FROM cashier');
      console.log(`   Row count: ${cashierCount[0].count}`);
      
    } catch (error) {
      console.log('❌ Cashier table error:', error.message);
    }
    
    // Check if service table exists
    console.log('\n🔧 Checking service table...');
    try {
      const [serviceRows] = await connection.execute('DESCRIBE service');
      console.log('✅ Service table exists with columns:');
      serviceRows.forEach(row => {
        console.log(`   - ${row.Field} (${row.Type})`);
      });
      
      // Check row count
      const [serviceCount] = await connection.execute('SELECT COUNT(*) as count FROM service');
      console.log(`   Row count: ${serviceCount[0].count}`);
      
    } catch (error) {
      console.log('❌ Service table error:', error.message);
    }
    
    // Check all tables in the database
    console.log('\n📋 All tables in inventory_system:');
    const [tables] = await connection.execute('SHOW TABLES');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`   - ${tableName}`);
    });
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
  }
}

checkCashierServiceTables();

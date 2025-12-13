const mysql = require('mysql2/promise');

async function checkMasterDuplicates() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'inventory_system'
  });

  try {
    console.log('🔍 Checking master table for duplicates...\n');

    const [totalMaster] = await connection.execute('SELECT COUNT(*) as total FROM master');
    console.log(`📊 Master table total records: ${totalMaster[0].total}`);

    const [duplicates] = await connection.execute(`
      SELECT BENZ, BRAND, COUNT(*) as count 
      FROM master 
      GROUP BY BENZ, BRAND 
      HAVING COUNT(*) > 1 
      ORDER BY count DESC 
      LIMIT 10
    `);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found in master table');
    } else {
      console.log('⚠️ Master table duplicates found:');
      console.log('BENZ | BRAND | Count');
      console.log('-------------------');
      duplicates.forEach(row => {
        console.log(`${row.BENZ} | ${row.BRAND} | ${row.count}`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking master duplicates:', error);
  } finally {
    await connection.end();
  }
}

checkMasterDuplicates();

const mysql = require('mysql2/promise');

async function checkDuplicates() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'inventory_system'
  });

  try {
    console.log('🔍 Checking for duplicate records in tbl_stock...\n');

    // Check total records
    const [totalResult] = await connection.execute('SELECT COUNT(*) as total FROM tbl_stock');
    console.log(`📊 Total records in tbl_stock: ${totalResult[0].total}`);

    // Check for duplicates based on BENZ + BRAND combination
    const [duplicateResult] = await connection.execute(`
      SELECT BENZ, BRAND, COUNT(*) as duplicate_count 
      FROM tbl_stock 
      GROUP BY BENZ, BRAND 
      HAVING COUNT(*) > 1 
      ORDER BY duplicate_count DESC 
      LIMIT 10
    `);

    console.log('\n🔍 Top 10 duplicate combinations:');
    console.log('BENZ Number | Brand | Count');
    console.log('--------------------------------');
    
    let totalDuplicates = 0;
    duplicateResult.forEach(row => {
      console.log(`${row.BENZ} | ${row.BRAND} | ${row.duplicate_count}`);
      totalDuplicates += (row.duplicate_count - 1); // Subtract 1 to get actual duplicates
    });

    console.log(`\n📊 Total duplicate records: ${totalDuplicates}`);
    console.log(`📊 Unique records: ${totalResult[0].total - totalDuplicates}`);

    // Show some examples of the duplicates
    if (duplicateResult.length > 0) {
      console.log('\n🔍 Example of duplicates:');
      const [exampleResult] = await connection.execute(`
        SELECT ID, BENZ, BRAND, QTY, COST, SELL 
        FROM tbl_stock 
        WHERE BENZ = ? AND BRAND = ? 
        ORDER BY ID
        LIMIT 5
      `, [duplicateResult[0].BENZ, duplicateResult[0].BRAND]);

      console.log(`\nFirst 5 records for ${duplicateResult[0].BENZ} (${duplicateResult[0].BRAND}):`);
      console.log('ID | BENZ | BRAND | QTY | COST | SELL');
      console.log('----------------------------------------');
      exampleResult.forEach(row => {
        console.log(`${row.ID} | ${row.BENZ} | ${row.BRAND} | ${row.QTY} | ${row.COST} | ${row.SELL}`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking duplicates:', error);
  } finally {
    await connection.end();
  }
}

checkDuplicates();

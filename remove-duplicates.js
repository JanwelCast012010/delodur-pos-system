const mysql = require('mysql2/promise');

async function removeDuplicates() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'inventory_system'
  });

  try {
    console.log('🧹 Starting duplicate removal process...\n');

    // First, let's see the current state
    const [totalBefore] = await connection.execute('SELECT COUNT(*) as total FROM tbl_stock');
    console.log(`📊 Records before cleanup: ${totalBefore[0].total}`);

    // Create a backup table first
    const backupTableName = `tbl_stock_backup_before_dedup_${Date.now()}`;
    console.log(`📦 Creating backup table: ${backupTableName}`);
    await connection.execute(`CREATE TABLE ${backupTableName} AS SELECT * FROM tbl_stock`);

    // Start transaction
    await connection.beginTransaction();

    try {
      // Remove duplicates by keeping only the record with the highest ID for each BENZ+BRAND combination
      console.log('🗑️ Removing duplicate records...');
      
      const [deleteResult] = await connection.execute(`
        DELETE t1 FROM tbl_stock t1
        INNER JOIN tbl_stock t2 
        WHERE t1.ID < t2.ID 
        AND (
          (t1.BENZ = t2.BENZ AND t1.BRAND = t2.BRAND) OR
          (t1.BENZ IS NULL AND t2.BENZ IS NULL AND t1.BRAND = t2.BRAND)
        )
      `);

      console.log(`✅ Removed ${deleteResult.affectedRows} duplicate records`);

      // Check the results
      const [totalAfter] = await connection.execute('SELECT COUNT(*) as total FROM tbl_stock');
      console.log(`📊 Records after cleanup: ${totalAfter[0].total}`);
      console.log(`📊 Records removed: ${totalBefore[0].total - totalAfter[0].total}`);

      // Commit the transaction
      await connection.commit();
      console.log('✅ Transaction committed successfully');

      // Show some statistics
      const [duplicateCheck] = await connection.execute(`
        SELECT BENZ, BRAND, COUNT(*) as count 
        FROM tbl_stock 
        GROUP BY BENZ, BRAND 
        HAVING COUNT(*) > 1 
        ORDER BY count DESC 
        LIMIT 5
      `);

      if (duplicateCheck.length === 0) {
        console.log('🎉 No more duplicates found!');
      } else {
        console.log('⚠️ Still some duplicates remaining:');
        duplicateCheck.forEach(row => {
          console.log(`  ${row.BENZ || 'NULL'} | ${row.BRAND} | ${row.count}`);
        });
      }

      console.log(`\n📦 Backup table created: ${backupTableName}`);
      console.log('💡 You can restore from backup if needed using:');
      console.log(`   DROP TABLE tbl_stock; RENAME TABLE ${backupTableName} TO tbl_stock;`);

    } catch (error) {
      await connection.rollback();
      console.error('❌ Error during cleanup, transaction rolled back:', error);
      throw error;
    }

  } catch (error) {
    console.error('❌ Error removing duplicates:', error);
  } finally {
    await connection.end();
  }
}

removeDuplicates();

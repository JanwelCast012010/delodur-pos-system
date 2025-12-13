// Script to check stock date for specific ID
// Run with: node check-stock-date.js

const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkStockDate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'inventory_system'
  });

  try {
    const stockId = 164384;
    const benzNumber = '246 500 13 03'; // From the image

    console.log('🔍 Checking stock record ID:', stockId);
    console.log('🔍 Part Number (BENZ):', benzNumber);
    console.log('');

    // Check tbl_stock
    console.log('📋 Checking tbl_stock table...');
    const [stockRows] = await connection.execute(
      `SELECT ID, DATE, BENZ, BRAND, QTY, SELL 
       FROM tbl_stock 
       WHERE ID = ? OR BENZ = ? 
       LIMIT 10`,
      [stockId, benzNumber]
    );

    if (stockRows.length > 0) {
      console.log(`✅ Found ${stockRows.length} record(s) in tbl_stock:`);
      stockRows.forEach((row, idx) => {
        console.log(`\n  Record ${idx + 1}:`);
        console.log(`    ID: ${row.ID}`);
        console.log(`    DATE: ${row.DATE} (type: ${typeof row.DATE}, isNull: ${row.DATE === null})`);
        console.log(`    BENZ: ${row.BENZ}`);
        console.log(`    BRAND: ${row.BRAND}`);
        console.log(`    QTY: ${row.QTY}`);
        console.log(`    SELL: ${row.SELL}`);
      });
    } else {
      console.log('❌ No records found in tbl_stock');
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Check inmain table
    console.log('📋 Checking inmain table...');
    
    // First, check what columns exist in inmain
    const [inmainColumns] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'inmain'
       ORDER BY ORDINAL_POSITION`,
      [process.env.DB_NAME || 'inventory_system']
    );

    console.log('📊 inmain table columns:');
    inmainColumns.forEach(col => {
      console.log(`    ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });

    // Try to find matching records in inmain
    // Check both BENZ and benz_number column names
    const benzCol = inmainColumns.find(c => c.COLUMN_NAME.toUpperCase() === 'BENZ')?.COLUMN_NAME || 
                    inmainColumns.find(c => c.COLUMN_NAME.toUpperCase() === 'BENZ_NUMBER')?.COLUMN_NAME ||
                    'BENZ';
    
    const brandCol = inmainColumns.find(c => c.COLUMN_NAME.toUpperCase() === 'BRAND')?.COLUMN_NAME || 'BRAND';
    const dateCol = inmainColumns.find(c => c.COLUMN_NAME.toUpperCase() === 'DATE')?.COLUMN_NAME || 'DATE';
    const supplierCol = inmainColumns.find(c => c.COLUMN_NAME.toUpperCase() === 'SUPPLIER')?.COLUMN_NAME || 'SUPPLIER';

    console.log(`\n🔍 Using columns: ${benzCol}, ${brandCol}, ${dateCol}, ${supplierCol}`);

    const [inmainRows] = await connection.execute(
      `SELECT ID, \`${dateCol}\` as DATE, \`${benzCol}\` as BENZ, \`${brandCol}\` as BRAND, \`${supplierCol}\` as SUPPLIER
       FROM inmain 
       WHERE \`${benzCol}\` = ? OR \`${benzCol}\` LIKE ?
       ORDER BY \`${dateCol}\` DESC
       LIMIT 10`,
      [benzNumber, `%${benzNumber.replace(/\s/g, '')}%`]
    );

    if (inmainRows.length > 0) {
      console.log(`✅ Found ${inmainRows.length} record(s) in inmain:`);
      inmainRows.forEach((row, idx) => {
        console.log(`\n  Record ${idx + 1}:`);
        console.log(`    ID: ${row.ID}`);
        console.log(`    DATE: ${row.DATE} (type: ${typeof row.DATE}, isNull: ${row.DATE === null})`);
        console.log(`    BENZ: ${row.BENZ}`);
        console.log(`    BRAND: ${row.BRAND}`);
        console.log(`    SUPPLIER: ${row.SUPPLIER}`);
      });
    } else {
      console.log('❌ No records found in inmain');
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Check if there's a relationship between tbl_stock and inmain
    if (stockRows.length > 0 && inmainRows.length > 0) {
      console.log('🔗 Checking relationships...');
      const stockRow = stockRows[0];
      const matchingInmain = inmainRows.filter(im => 
        im.BENZ === stockRow.BENZ && 
        im.BRAND === stockRow.BRAND
      );

      if (matchingInmain.length > 0) {
        console.log(`✅ Found ${matchingInmain.length} matching inmain record(s) with same BENZ and BRAND:`);
        matchingInmain.forEach((im, idx) => {
          console.log(`\n  Match ${idx + 1}:`);
          console.log(`    inmain DATE: ${im.DATE}`);
          console.log(`    tbl_stock DATE: ${stockRow.DATE}`);
          console.log(`    Dates match: ${im.DATE === stockRow.DATE || (im.DATE && stockRow.DATE && im.DATE.toString() === stockRow.DATE.toString())}`);
        });
      } else {
        console.log('⚠️  No matching inmain records found with same BENZ and BRAND');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await connection.end();
  }
}

checkStockDate();


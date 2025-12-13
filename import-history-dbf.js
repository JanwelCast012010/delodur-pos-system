const mysql = require('mysql2/promise');
const DBFReader = require('./dbf-reader');
const fs = require('fs');
require('dotenv').config();

// Helper function to format date from YYYYMMDD to YYYY-MM-DD
function formatDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return null;
  
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  
  // Validate date
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return null;
  
  return `${year}-${month}-${day}`;
}

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_system'
};

async function importHistoryDBF() {
  let connection;
  
  try {
    console.log('🚀 Starting HISTORY.DBF import process...');
    
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
    
    // Step 1: Read and parse the DBF file
    console.log('📖 Reading HISTORY.DBF file...');
    const dbfPath = './CSV FILES/HISTORY.DBF';
    
    if (!fs.existsSync(dbfPath)) {
      throw new Error(`HISTORY.DBF file not found at: ${dbfPath}`);
    }
    
    const dbfReader = new DBFReader(dbfPath);
    const records = await dbfReader.read();
    
    if (records.length === 0) {
      console.log('⚠️ No records found in HISTORY.DBF file');
      return;
    }
    
    console.log(`📊 Found ${records.length} records in HISTORY.DBF`);
    
    // Step 2: Show sample data structure
    console.log('\n📋 Sample record structure:');
    console.log(JSON.stringify(records[0], null, 2));
    
    // Step 3: Create backup of existing history table
    const backupTableName = `history_backup_${new Date().toISOString().replace(/[:.]/g, '_').slice(0, 19).replace(/-/g, '_')}`;
    console.log(`\n💾 Creating backup table: ${backupTableName}`);
    
    await connection.execute(`CREATE TABLE ${backupTableName} AS SELECT * FROM history`);
    console.log('✅ Backup table created');
    
    // Step 4: Clear existing data from history table
    console.log('\n🗑️ Clearing existing data from history table...');
    await connection.execute('DELETE FROM history');
    await connection.execute('ALTER TABLE history AUTO_INCREMENT = 1');
    console.log('✅ Cleared existing data');
    
    // Step 5: Import data with proper field mapping
    console.log('\n📥 Importing HISTORY.DBF data...');
    
    let successCount = 0;
    let errorCount = 0;
    const batchSize = 100;
    let batch = [];
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 1;
      
      try {
        // Map DBF fields to database fields
        const mappedRecord = {
          CUSTOMER: record['CUSTOMER^#'] || null,
          DATE: record['DATEMER^#'] ? formatDate(record['DATEMER^#']) : null,
          INVOICE: record['INVOICE^#'] ? 'Y' : 'N',
          FLAG: null, // Not available in DBF
          CODE: record['IDCODE^#'] || null,
          AMOUNT: record['SELLE^#'] || null,
          QTY: record['QTYE^#'] || null,
          PARTNO: record['ALTNO^#'] || null,
          BRAND: record['BRAND^#'] || null,
          DESCRIPTION: record['ALTNO^#'] || null, // Use ALTNO as description
          APPL: null, // Not available in DBF
          LOCATION: null, // Not available in DBF
          COST: record['COSTKSE#'] || null
        };
        
        batch.push(mappedRecord);
        
        // Process batch when it reaches batchSize or at the end
        if (batch.length >= batchSize || i === records.length - 1) {
          await processBatch(connection, batch);
          successCount += batch.length;
          batch = [];
          
          // Progress indicator
          if (i % 500 === 0 || i === records.length - 1) {
            console.log(`📊 Processed ${i + 1}/${records.length} records (${Math.round(((i + 1) / records.length) * 100)}%)`);
          }
        }
        
      } catch (error) {
        console.error(`❌ Error processing record ${rowNumber}:`, error.message);
        errorCount++;
      }
    }
    
    // Step 6: Verify import
    console.log('\n🔍 Verifying import...');
    const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM history');
    const importedCount = countResult[0].count;
    
    console.log('\n📊 Import Summary:');
    console.log(`✅ Successfully imported: ${successCount} records`);
    console.log(`❌ Errors: ${errorCount} records`);
    console.log(`📋 Total in database: ${importedCount} records`);
    console.log(`💾 Backup table: ${backupTableName}`);
    
    // Step 7: Show sample imported data
    console.log('\n📋 Sample imported data:');
    const [sampleData] = await connection.execute('SELECT * FROM history LIMIT 3');
    sampleData.forEach((row, index) => {
      console.log(`Record ${index + 1}:`, JSON.stringify(row, null, 2));
    });
    
    console.log('\n🎉 HISTORY.DBF import completed successfully!');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function processBatch(connection, batch) {
  if (batch.length === 0) return;
  
  const values = batch.map(record => [
    record.CUSTOMER,
    record.DATE,
    record.INVOICE,
    record.FLAG,
    record.CODE,
    record.AMOUNT,
    record.QTY,
    record.PARTNO,
    record.BRAND,
    record.DESCRIPTION,
    record.APPL,
    record.LOCATION,
    record.COST
  ]);
  
  const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  
  const sql = `
    INSERT INTO history (
      CUSTOMER, DATE, INVOICE, FLAG, CODE, AMOUNT, QTY, 
      PARTNO, BRAND, DESCRIPTION, APPL, LOCATION, COST
    ) VALUES ${placeholders}
  `;
  
  await connection.execute(sql, values.flat());
}

// Run the import
if (require.main === module) {
  importHistoryDBF()
    .then(() => {
      console.log('✅ Import process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Import process failed:', error);
      process.exit(1);
    });
}

module.exports = importHistoryDBF;

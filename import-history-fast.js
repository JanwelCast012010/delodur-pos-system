const mysql = require('mysql2/promise');
const DBFReader = require('./dbf-reader');
const fs = require('fs');
const path = require('path');
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
  database: process.env.DB_NAME || 'inventory_system',
  charset: 'utf8mb4',
  supportBigNumbers: true,
  bigNumberStrings: true,
  multipleStatements: true
};

async function importHistoryFast() {
  let connection;
  
  try {
    console.log('🚀 Starting FAST history.DBF import...');
    
    // Step 1: Read DBF file
    const dbfPath = './CSV FILES/HISTORY.DBF';
    if (!fs.existsSync(dbfPath)) {
      console.error(`❌ DBF file not found: ${dbfPath}`);
      return;
    }

    console.log('📖 Reading DBF file...');
    const dbfReader = new DBFReader(dbfPath);
    const records = await dbfReader.read();
    
    if (!records || records.length === 0) {
      console.log('⚠️ No records found in DBF file');
      return;
    }

    console.log(`📊 Found ${records.length} records in DBF file`);

    // Step 2: Convert to CSV
    const convertDir = path.join(__dirname, 'convert');
    const csvPath = path.join(convertDir, 'HISTORY_TEMP.csv');
    
    // Ensure convert directory exists
    if (!fs.existsSync(convertDir)) {
      fs.mkdirSync(convertDir, { recursive: true });
    }

    console.log('🔄 Converting DBF to CSV...');
    
    // Create CSV header
    const csvHeader = 'CUSTOMER,DATE,RECEIPT,INVOICE,IDCODE,SELL,QTY,BENZ,BRAND,ALTNO,COLORCODE,REMARKS,COST\n';
    let csvContent = csvHeader;
    
    // Convert records to CSV
    for (const record of records) {
      const row = [
        escapeCSV(record['CUSTOMER^#'] || ''),
        formatDate(record['DATEMER^#']) || '',
        escapeCSV(record['RECEIPT^#'] || ''),
        record['INVOICE^#'] !== null ? (record['INVOICE^#'] ? 'T' : 'F') : '',
        record['IDCODE^#'] || '',
        record['SELLE^#'] ? (parseFloat(record['SELLE^#']) / 100).toFixed(2) : '0.00',
        record['QTYE^#'] || '0',
        escapeCSV(record['BENZE^#'] || ''),
        escapeCSV(record['BRAND^#'] || ''),
        escapeCSV(record['ALTNO^#'] || ''),
        escapeCSV(record['COLORCODE#'] || ''),
        escapeCSV(record['REMARKSE#'] || ''),
        record['COSTKSE#'] ? (parseFloat(record['COSTKSE#']) / 100).toFixed(2) : '0.00'
      ];
      csvContent += row.join(',') + '\n';
    }
    
    // Write CSV file
    fs.writeFileSync(csvPath, csvContent, 'utf8');
    console.log(`✅ CSV created: ${csvPath}`);

    // Step 3: Connect to database and import
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');

    // Create backup and clear table
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupTableName = `history_backup_${timestamp}`;
    
    try {
      await connection.execute(`CREATE TABLE ${backupTableName} AS SELECT * FROM history`);
      console.log(`✅ Backup created: ${backupTableName}`);
    } catch (error) {
      console.log('ℹ️ No existing history table to backup');
    }

    // Drop and recreate table
    console.log('🔄 Recreating history table...');
    await connection.execute('DROP TABLE IF EXISTS history');
    await connection.execute(`
      CREATE TABLE history (
        CUSTOMER VARCHAR(50) DEFAULT NULL,
        DATE DATE DEFAULT NULL,
        RECEIPT VARCHAR(20) DEFAULT NULL,
        INVOICE VARCHAR(20) DEFAULT NULL,
        IDCODE INT DEFAULT NULL,
        SELL DECIMAL(12,2) DEFAULT NULL,
        QTY INT DEFAULT NULL,
        BENZ VARCHAR(30) DEFAULT NULL,
        BRAND VARCHAR(20) DEFAULT NULL,
        ALTNO VARCHAR(50) DEFAULT NULL,
        COLORCODE VARCHAR(20) DEFAULT NULL,
        REMARKS VARCHAR(100) DEFAULT NULL,
        COST DECIMAL(12,2) DEFAULT NULL,
        
        INDEX idx_date (DATE),
        INDEX idx_customer (CUSTOMER),
        INDEX idx_benz (BENZ),
        INDEX idx_brand (BRAND),
        INDEX idx_invoice (INVOICE)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    console.log('✅ History table recreated');

    // Step 4: Use ultra-optimized batch insert (as fast as possible without LOAD DATA)
    console.log('⚡ Starting ULTRA-FAST batch insert...');
    
    // Disable autocommit and constraints for maximum speed
    await connection.execute('SET autocommit = 0');
    await connection.execute('SET unique_checks = 0');
    await connection.execute('SET foreign_key_checks = 0');
    
    // Prepare ultra-large batch insert
    const batchSize = 5000; // Very large batch size
    let totalInserted = 0;
    
    // Build the insert statement
    const insertSQL = `
      INSERT INTO history (
        CUSTOMER, DATE, RECEIPT, INVOICE, IDCODE, SELL, QTY, 
        BENZ, BRAND, ALTNO, COLORCODE, REMARKS, COST
      ) VALUES 
    `;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      // Build values array for this batch
      const values = [];
      const placeholders = [];
      
      for (const record of batch) {
        placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        values.push(
          record['CUSTOMER^#'] || null,
          formatDate(record['DATEMER^#']) || null,
          record['RECEIPT^#'] || null,
          record['INVOICE^#'] !== null ? (record['INVOICE^#'] ? 'T' : 'F') : null,
          record['IDCODE^#'] ? parseInt(record['IDCODE^#']) : null,
          record['SELLE^#'] ? parseFloat(record['SELLE^#']) / 100 : null,
          record['QTYE^#'] ? parseInt(record['QTYE^#']) : null,
          record['BENZE^#'] || null,
          record['BRAND^#'] || null,
          record['ALTNO^#'] || null,
          record['COLORCODE#'] || null,
          record['REMARKSE#'] || null,
          record['COSTKSE#'] ? parseFloat(record['COSTKSE#']) / 100 : null
        );
      }
      
      // Execute batch insert
      const batchSQL = insertSQL + placeholders.join(', ');
      await connection.execute(batchSQL, values);
      
      totalInserted += batch.length;
      const progress = ((totalInserted / records.length) * 100).toFixed(1);
      console.log(`⚡ Ultra-fast batch: ${totalInserted}/${records.length} (${progress}%)`);
    }
    
    // Commit and restore settings
    await connection.execute('COMMIT');
    await connection.execute('SET autocommit = 1');
    await connection.execute('SET unique_checks = 1');
    await connection.execute('SET foreign_key_checks = 1');
    
    console.log('⚡ ULTRA-FAST batch import completed!');

    // Get final count
    const [result] = await connection.execute('SELECT COUNT(*) as total FROM history');
    console.log(`🎉 Successfully imported ${result[0].total} records!`);

    // Show sample data
    const [sample] = await connection.execute('SELECT * FROM history LIMIT 3');
    console.log('📋 Sample imported data:');
    console.table(sample);

    // Clean up CSV file
    fs.unlinkSync(csvPath);
    console.log('🧹 Temporary CSV file cleaned up');

    return result[0].total;

  } catch (error) {
    console.error('❌ Fast import failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Helper function to escape CSV values
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Run the import
if (require.main === module) {
  importHistoryFast();
}

module.exports = importHistoryFast;

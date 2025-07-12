const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_system',
  charset: 'utf8mb4',
  supportBigNumbers: true,
  bigNumberStrings: true
};

async function importStocksFromCSV() {
  let connection;
  
  try {
    console.log('🚀 Starting Final_Data_For_Stock.csv import to tbl_stock table...');
    
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
    
    // Read the CSV file
    const csvPath = path.join(__dirname, 'CSV FILES', 'New data', 'Final_Data_For_Stock.csv');
    console.log(`📁 Reading CSV file: ${csvPath}`);
    
    if (!fs.existsSync(csvPath)) {
      throw new Error('Final_Data_For_Stock.csv file not found in CSV FILES/New data directory');
    }
    
    // Read file with explicit encoding
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    
    console.log(`📊 Found ${lines.length} lines in CSV file`);
    
    // Get header (first line)
    const header = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));
    console.log('📋 CSV Headers:', header);
    console.log(`📋 Total columns in CSV: ${header.length}`);
    
    // Clear existing data from tbl_stock table
    console.log('🗑️ Clearing existing data from tbl_stock table...');
    await connection.execute('DELETE FROM tbl_stock');
    await connection.execute('ALTER TABLE tbl_stock AUTO_INCREMENT = 1');
    console.log('✅ Cleared existing data');
    
    // Process each line (skip header)
    let successCount = 0;
    let errorCount = 0;
    const batchSize = 100; // Smaller batch size for better error handling
    let batch = [];
    let skippedLines = [];
    
    console.log('📥 Processing CSV data...');
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const rowNumber = i + 1; // Row number for display (1-based)
      
      try {
        // Parse CSV line (handle quoted values)
        const values = parseCSVLine(line);
        
        if (values.length !== header.length) {
          if (skippedLines.length < 5) {
            console.log(`⚠️ Line ${rowNumber}: Column count mismatch. Expected ${header.length}, got ${values.length}`);
          }
          skippedLines.push(rowNumber);
          errorCount++;
          continue;
        }
        
        // Clean and validate values
        const cleanedValues = cleanValues(values);
        
        // Map CSV values to database columns (skip ID column at index 0)
        const dbValues = [
          cleanedValues[1] || null,  // DINFLAG
          cleanedValues[2] || null,  // BENZ
          cleanedValues[3] || null,  // BENZ2
          cleanedValues[4] || null,  // BENZ3
          cleanedValues[5] || null,  // BRAND
          cleanedValues[6] || null,  // ALTNO
          cleanedValues[7] || null,  // ALTNO2
          cleanedValues[8] || null,  // COLORCODE
          cleanedValues[9] || null,  // REMARKS
          cleanedValues[10] || null, // DATE
          parseFloat(cleanedValues[11]) || 0,  // COST
          parseFloat(cleanedValues[12]) || 0,  // SELL
          parseInt(cleanedValues[13]) || 0,    // QTY
          cleanedValues[14] || null, // CURRENCY
          parseFloat(cleanedValues[15]) || 0,  // FCAMOUNT
          parseFloat(cleanedValues[16]) || 0,  // CONVERSION
          cleanedValues[17] || null  // LOCATION
        ];
        
        // Verify we have exactly 17 values
        if (dbValues.length !== 17) {
          console.log(`⚠️ Line ${rowNumber}: Invalid value count after mapping. Expected 17, got ${dbValues.length}`);
          errorCount++;
          continue;
        }
        
        batch.push(dbValues);
        
        // Insert batch when it reaches the batch size
        if (batch.length >= batchSize) {
          const batchSuccess = await insertBatch(connection, batch);
          successCount += batchSuccess;
          console.log(`✅ Processed ${successCount} rows...`);
          batch = [];
        }
        
      } catch (error) {
        console.log(`❌ Error processing line ${rowNumber}: ${error.message}`);
        errorCount++;
      }
    }
    
    // Insert remaining batch
    if (batch.length > 0) {
      const batchSuccess = await insertBatch(connection, batch);
      successCount += batchSuccess;
    }
    
    console.log('\n🎉 Import completed!');
    console.log(`✅ Successfully imported: ${successCount} rows`);
    console.log(`❌ Errors: ${errorCount} rows`);
    console.log(`📊 Total processed: ${successCount + errorCount} rows`);
    
    if (skippedLines.length > 0) {
      console.log(`\n⚠️ Skipped ${skippedLines.length} lines due to column mismatch. Example lines:`, skippedLines.slice(0, 5));
    }
    
    // Verify the import
    const [result] = await connection.execute('SELECT COUNT(*) as count FROM tbl_stock');
    console.log(`🔍 Database now contains: ${result[0].count} stock items`);
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

async function insertBatch(connection, batch) {
  try {
    // Build the insert statement dynamically
    const insertSQL = `
      INSERT INTO tbl_stock (
        DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, 
        COLORCODE, REMARKS, DATE, COST, SELL, QTY, 
        CURRENCY, FCAMOUNT, CONVERSION, LOCATION
      ) VALUES ?
    `;
    
    await connection.query(insertSQL, [batch]);
    return batch.length;
  } catch (error) {
    console.error('❌ Batch insert error:', error.message);
    
    // If batch insert fails, try inserting each row individually
    let successCount = 0;
    for (let i = 0; i < batch.length; i++) {
      try {
        const insertSQL = `
          INSERT INTO tbl_stock (
            DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, 
            COLORCODE, REMARKS, DATE, COST, SELL, QTY, 
            CURRENCY, FCAMOUNT, CONVERSION, LOCATION
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await connection.execute(insertSQL, batch[i]);
        successCount++;
      } catch (rowError) {
        console.error(`❌ Row insert error at batch index ${i}:`, rowError.message);
      }
    }
    return successCount;
  }
}

function cleanValues(values) {
  return values.map(value => {
    if (value === null || value === undefined) return null;
    
    // Convert to string and clean
    let cleaned = String(value).trim();
    
    // Remove quotes
    cleaned = cleaned.replace(/^"|"$/g, '');
    
    // Handle special characters that might cause MySQL issues
    cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
    
    // Limit length to prevent overflow
    if (cleaned.length > 255) {
      cleaned = cleaned.substring(0, 255);
    }
    
    return cleaned === '' ? null : cleaned;
  });
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last value
  values.push(current.trim());
  
  // Remove quotes from values
  return values.map(value => value.replace(/^"|"$/g, ''));
}

// Run the import
if (require.main === module) {
  importStocksFromCSV()
    .then(() => {
      console.log('🎯 Import script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Import script failed:', error);
      process.exit(1);
    });
}

module.exports = { importStocksFromCSV }; 
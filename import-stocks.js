const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_system'
};

async function importStocksFromCSV() {
  let connection;
  
  try {
    console.log('🚀 Starting Final_Data_For_Stock.csv import...');
    
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
    
    // Read the CSV file
    const csvPath = path.join(__dirname, 'CSV FILES', 'New data', 'Final_Data_For_Stock.csv');
    console.log(`📁 Reading CSV file: ${csvPath}`);
    
    if (!fs.existsSync(csvPath)) {
      throw new Error('Final_Data_For_Stock.csv file not found in CSV FILES/New data directory');
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    
    console.log(`📊 Found ${lines.length} lines in CSV file`);
    
    // Get header (first line)
    const header = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));
    console.log('📋 CSV Headers:', header);
    console.log(`📋 Total columns in CSV: ${header.length}`);
    
    // Clear existing data from final_Data_For_Stock table
    console.log('🗑️ Clearing existing data from final_Data_For_Stock table...');
    await connection.execute('DELETE FROM final_Data_For_Stock');
    await connection.execute('ALTER TABLE final_Data_For_Stock AUTO_INCREMENT = 1');
    console.log('✅ Cleared existing data');
    
    // Prepare the insert statement (17 columns, excluding ID)
    const insertSQL = `
      INSERT INTO final_Data_For_Stock (
        DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, 
        COLORCODE, REMARKS, DATE, COST, SELL, QTY, 
        CURRENCY, FCAMOUNT, CONVERSION, LOCATION
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    console.log('📝 Insert SQL prepared with 17 columns');
    
    // Process each line (skip header)
    let successCount = 0;
    let errorCount = 0;
    const batchSize = 500; // Reduced batch size for better error handling
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
        
        // Map CSV values to database columns (skip ID column at index 0)
        const dbValues = [
          values[1] || null,  // DINFLAG
          values[2] || null,  // BENZ
          values[3] || null,  // BENZ2
          values[4] || null,  // BENZ3
          values[5] || null,  // BRAND
          values[6] || null,  // ALTNO
          values[7] || null,  // ALTNO2
          values[8] || null,  // COLORCODE
          values[9] || null,  // REMARKS
          values[10] || null, // DATE
          parseFloat(values[11]) || 0,  // COST
          parseFloat(values[12]) || 0,  // SELL
          parseInt(values[13]) || 0,    // QTY
          values[14] || null, // CURRENCY
          parseFloat(values[15]) || 0,  // FCAMOUNT
          parseFloat(values[16]) || 0,  // CONVERSION
          values[17] || null  // LOCATION
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
          const batchSuccess = await insertBatch(connection, insertSQL, batch);
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
      const batchSuccess = await insertBatch(connection, insertSQL, batch);
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
    const [result] = await connection.execute('SELECT COUNT(*) as count FROM final_Data_For_Stock');
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

async function insertBatch(connection, sql, batch) {
  try {
    // Use execute instead of query for better parameter handling
    await connection.execute(sql, batch);
    return batch.length;
  } catch (error) {
    console.error('❌ Batch insert error:', error.message);
    
    // If batch insert fails, try inserting each row individually
    let successCount = 0;
    for (let i = 0; i < batch.length; i++) {
      try {
        await connection.execute(sql, [batch[i]]);
        successCount++;
      } catch (rowError) {
        console.error(`❌ Row insert error at batch index ${i}:`, rowError.message);
      }
    }
    return successCount;
  }
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
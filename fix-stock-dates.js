const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_system'
};

async function fixStockDates() {
  let connection;
  
  try {
    console.log('🔍 Checking and fixing date issues in tbl_stock...');
    
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
    
    // Step 1: Check current date format and values
    console.log('\n📅 Step 1: Analyzing current date data...');
    const [dateAnalysis] = await connection.execute(`
      SELECT 
        ID,
        DATE,
        DATE_FORMAT(DATE, '%Y-%m-%d') as formatted_date,
        DATE_FORMAT(DATE, '%Y') as year,
        DATE_FORMAT(DATE, '%m') as month,
        DATE_FORMAT(DATE, '%d') as day
      FROM tbl_stock 
      WHERE DATE IS NOT NULL 
      ORDER BY DATE DESC 
      LIMIT 10
    `);
    
    console.log('📊 Date analysis results:');
    dateAnalysis.forEach(record => {
      console.log(`ID: ${record.ID} | Original: ${record.DATE} | Formatted: ${record.formatted_date} | Year: ${record.year}`);
    });
    
    // Step 2: Check for problematic dates (like 1989)
    console.log('\n⚠️ Step 2: Checking for problematic dates...');
    const [problemDates] = await connection.execute(`
      SELECT ID, DATE, DATE_FORMAT(DATE, '%Y') as year
      FROM tbl_stock 
      WHERE DATE IS NOT NULL 
      AND (YEAR(DATE) < 2000 OR YEAR(DATE) > 2030)
      ORDER BY DATE
    `);
    
    if (problemDates.length > 0) {
      console.log(`❌ Found ${problemDates.length} records with problematic dates:`);
      problemDates.forEach(record => {
        console.log(`ID: ${record.ID} | Date: ${record.DATE} | Year: ${record.year}`);
      });
      
      // Step 3: Fix problematic dates
      console.log('\n🔧 Step 3: Fixing problematic dates...');
      
      // Option 1: Set to current date
      const [updateResult] = await connection.execute(`
        UPDATE tbl_stock 
        SET DATE = CURRENT_DATE()
        WHERE DATE IS NOT NULL 
        AND (YEAR(DATE) < 2000 OR YEAR(DATE) > 2030)
      `);
      
      console.log(`✅ Updated ${updateResult.affectedRows} records with current date`);
      
      // Option 2: Set to a reasonable default date (2020-01-01)
      // Uncomment if you prefer a specific default date
      /*
      const [updateResult2] = await connection.execute(`
        UPDATE tbl_stock 
        SET DATE = '2020-01-01'
        WHERE DATE IS NOT NULL 
        AND (YEAR(DATE) < 2000 OR YEAR(DATE) > 2030)
      `);
      console.log(`✅ Updated ${updateResult2.affectedRows} records with default date 2020-01-01`);
      */
      
    } else {
      console.log('✅ No problematic dates found!');
    }
    
    // Step 4: Verify the fix
    console.log('\n✅ Step 4: Verifying the fix...');
    const [verifyDates] = await connection.execute(`
      SELECT 
        ID,
        DATE,
        DATE_FORMAT(DATE, '%Y-%m-%d') as formatted_date
      FROM tbl_stock 
      WHERE DATE IS NOT NULL 
      ORDER BY DATE DESC 
      LIMIT 5
    `);
    
    console.log('📊 Updated date results:');
    verifyDates.forEach(record => {
      console.log(`ID: ${record.ID} | Date: ${record.DATE} | Formatted: ${record.formatted_date}`);
    });
    
    // Step 5: Check date column type
    console.log('\n🔍 Step 5: Checking DATE column structure...');
    const [columnInfo] = await connection.execute(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'tbl_stock' 
      AND COLUMN_NAME = 'DATE'
    `, [dbConfig.database]);
    
    if (columnInfo.length > 0) {
      const column = columnInfo[0];
      console.log(`📋 DATE column info:`);
      console.log(`   Type: ${column.DATA_TYPE}`);
      console.log(`   Nullable: ${column.IS_NULLABLE}`);
      console.log(`   Default: ${column.COLUMN_DEFAULT}`);
    }
    
    console.log('\n🎉 Date fix completed!');
    
  } catch (error) {
    console.error('❌ Error fixing dates:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the fix
fixStockDates();

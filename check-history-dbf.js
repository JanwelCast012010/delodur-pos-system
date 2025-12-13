const DBFReader = require('./dbf-reader');
const fs = require('fs');

async function checkHistoryDBF() {
  try {
    console.log('🔍 Checking HISTORY.DBF file structure...');
    
    const dbfPath = './CSV FILES/HISTORY.DBF';
    
    if (!fs.existsSync(dbfPath)) {
      console.error(`❌ HISTORY.DBF file not found at: ${dbfPath}`);
      return;
    }
    
    console.log(`📁 File found: ${dbfPath}`);
    console.log(`📏 File size: ${(fs.statSync(dbfPath).size / 1024).toFixed(2)} KB`);
    
    // Read and parse the DBF file
    const dbfReader = new DBFReader(dbfPath);
    const records = await dbfReader.read();
    
    console.log(`\n📊 File contains ${records.length} records`);
    
    if (records.length > 0) {
      console.log('\n📋 Field structure:');
      const firstRecord = records[0];
      Object.keys(firstRecord).forEach(field => {
        const value = firstRecord[field];
        const type = typeof value;
        console.log(`  ${field}: ${type} (${value})`);
      });
      
      console.log('\n📋 Sample records (first 3):');
      records.slice(0, 3).forEach((record, index) => {
        console.log(`\nRecord ${index + 1}:`);
        Object.entries(record).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      });
      
      // Check for common sales-related fields
      console.log('\n🔍 Checking for sales-related data:');
      const salesFields = ['CUSTOMER^#', 'DATEMER^#', 'INVOICE^#', 'SELLE^#', 'QTYE^#', 'BRAND^#', 'ALTNO^#'];
      salesFields.forEach(field => {
        const hasField = firstRecord.hasOwnProperty(field);
        console.log(`  ${field}: ${hasField ? '✅' : '❌'}`);
      });
      
      // Check date range
      const dates = records
        .map(r => r['DATEMER^#'])
        .filter(d => d && d !== '')
        .sort();
      
      if (dates.length > 0) {
        console.log(`\n📅 Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
      }
      
      // Check for unique customers
      const customers = [...new Set(records.map(r => r['CUSTOMER^#']).filter(c => c && c !== ''))];
      console.log(`👥 Unique customers: ${customers.length}`);
      
      // Check for unique brands
      const brands = [...new Set(records.map(r => r['BRAND^#']).filter(b => b && b !== ''))];
      console.log(`🏷️ Unique brands: ${brands.length}`);
      
      // Check total sales amount
      const totalAmount = records
        .map(r => parseFloat(r['SELLE^#']) || 0)
        .reduce((sum, amount) => sum + amount, 0);
      console.log(`💰 Total sales amount: ${totalAmount.toFixed(2)}`);
      
      // Check total quantity sold
      const totalQty = records
        .map(r => parseInt(r['QTYE^#']) || 0)
        .reduce((sum, qty) => sum + qty, 0);
      console.log(`📦 Total quantity sold: ${totalQty}`);
      
    } else {
      console.log('⚠️ No records found in the DBF file');
    }
    
  } catch (error) {
    console.error('❌ Error checking HISTORY.DBF:', error);
  }
}

// Run the check
if (require.main === module) {
  checkHistoryDBF();
}

module.exports = checkHistoryDBF;

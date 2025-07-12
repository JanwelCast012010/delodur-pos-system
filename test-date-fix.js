const axios = require('axios');

// Test the date fix in purchase history
async function testDateFix() {
  try {
    console.log('🧪 Testing date fix in purchase history...');
    
    // Test 1: Get purchase history records
    console.log('\n📝 Test 1: Fetching purchase history records');
    const response = await axios.get('http://localhost:5000/api/history?limit=3');
    
    console.log(`Found ${response.data.data.length} records`);
    
    if (response.data.data.length > 0) {
      console.log('✅ Purchase history API is working!');
      
      // Check the first record's date format
      const firstRecord = response.data.data[0];
      console.log('\n📅 First record date analysis:');
      console.log('Customer:', firstRecord.CUSTOMER);
      console.log('Date:', firstRecord.DATE);
      console.log('Date type:', typeof firstRecord.DATE);
      
      // Check if date is in YYYY-MM-DD format
      if (firstRecord.DATE && /^\d{4}-\d{2}-\d{2}$/.test(firstRecord.DATE)) {
        console.log('✅ Date is in correct YYYY-MM-DD format!');
        
        // Test if this date can be used directly in HTML date input
        const testDateInput = document.createElement('input');
        testDateInput.type = 'date';
        testDateInput.value = firstRecord.DATE;
        
        if (testDateInput.value === firstRecord.DATE) {
          console.log('✅ Date is compatible with HTML date input!');
        } else {
          console.log('❌ Date is NOT compatible with HTML date input');
        }
      } else {
        console.log('❌ Date is NOT in YYYY-MM-DD format');
        console.log('Expected format: YYYY-MM-DD');
        console.log('Actual format:', firstRecord.DATE);
      }
      
      // Show sample records
      console.log('\n📋 Sample records:');
      response.data.data.slice(0, 3).forEach((record, index) => {
        console.log(`${index + 1}. ${record.CUSTOMER} - ${record.DATE} - ${record.INVOICE}`);
      });
    } else {
      console.log('❌ No records found');
    }
    
    console.log('\n🎉 Date fix testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the server is running on port 5000');
    }
  }
}

// Run the test
testDateFix(); 
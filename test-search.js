const axios = require('axios');

// Test the space-insensitive search functionality
async function testSearch() {
  try {
    console.log('🧪 Testing space-insensitive search...');
    
    // Test 1: Search for "1231231212" should find "123 123 12 12"
    console.log('\n📝 Test 1: Searching for "1231231212" (without spaces)');
    const response1 = await axios.get('http://localhost:5000/api/products?search=1231231212&limit=5');
    console.log(`Found ${response1.data.data.length} results`);
    if (response1.data.data.length > 0) {
      console.log('✅ Space-insensitive search is working!');
      console.log('Sample result:', response1.data.data[0]);
    } else {
      console.log('❌ No results found - search might not be working');
    }
    
    // Test 2: Search for "123 123 12 12" (with spaces)
    console.log('\n📝 Test 2: Searching for "123 123 12 12" (with spaces)');
    const response2 = await axios.get('http://localhost:5000/api/products?search=123 123 12 12&limit=5');
    console.log(`Found ${response2.data.data.length} results`);
    if (response2.data.data.length > 0) {
      console.log('✅ Regular search with spaces is working!');
      console.log('Sample result:', response2.data.data[0]);
    } else {
      console.log('❌ No results found for search with spaces');
    }
    
    // Test 3: Search for "123" (partial match)
    console.log('\n📝 Test 3: Searching for "123" (partial match)');
    const response3 = await axios.get('http://localhost:5000/api/products?search=123&limit=5');
    console.log(`Found ${response3.data.data.length} results`);
    if (response3.data.data.length > 0) {
      console.log('✅ Partial search is working!');
      console.log('Sample result:', response3.data.data[0]);
    } else {
      console.log('❌ No results found for partial search');
    }
    
    console.log('\n🎉 Search testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the server is running on port 5000');
    }
  }
}

// Run the test
testSearch(); 
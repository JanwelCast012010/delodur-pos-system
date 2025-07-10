const axios = require('axios');

async function testAPI() {
  try {
    console.log('🔍 Testing API endpoints...');
    
    // First, get a token by logging in
    console.log('\n1. Testing login...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful, token received');
    
    // Test products API
    console.log('\n2. Testing products API...');
    const productsResponse = await axios.get('http://localhost:5000/api/products?limit=5', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Products API response:');
    console.log(`   Total products: ${productsResponse.data.pagination.total}`);
    console.log(`   Returned: ${productsResponse.data.data.length} products`);
    
    if (productsResponse.data.data.length > 0) {
      console.log('   Sample product:', JSON.stringify(productsResponse.data.data[0], null, 2));
    }
    
    // Test brands API
    console.log('\n3. Testing brands API...');
    const brandsResponse = await axios.get('http://localhost:5000/api/products/brands', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Brands API response:');
    console.log(`   Total brands: ${brandsResponse.data.length}`);
    console.log('   Sample brands:', brandsResponse.data.slice(0, 5));
    
    // Test stock items API
    console.log('\n4. Testing stock items API...');
    const stocksResponse = await axios.get('http://localhost:5000/api/stock-items?limit=5', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Stock items API response:');
    console.log(`   Total stock items: ${stocksResponse.data.pagination.total}`);
    console.log(`   Returned: ${stocksResponse.data.data.length} items`);
    
    if (stocksResponse.data.data.length > 0) {
      console.log('   Sample stock item:', JSON.stringify(stocksResponse.data.data[0], null, 2));
    }
    
    // Test search functionality
    console.log('\n5. Testing search functionality...');
    const searchResponse = await axios.get('http://localhost:5000/api/products?search=DB&limit=3', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Search API response:');
    console.log(`   Search results for "DB": ${searchResponse.data.data.length} products`);
    
    if (searchResponse.data.data.length > 0) {
      console.log('   Sample search result:', JSON.stringify(searchResponse.data.data[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ API test failed:', error.response?.data || error.message);
  }
}

testAPI(); 
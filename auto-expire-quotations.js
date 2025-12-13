const mysql = require('mysql2/promise');
require('dotenv').config();

async function autoExpireQuotations() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'inventory_system'
    });

    console.log('🔗 Connected to database for auto-expiry check');

    // Update expired quotations
    const [result] = await connection.execute(
      'UPDATE quotations SET status = "expired" WHERE status != "expired" AND expiry_date < NOW()'
    );

    if (result.affectedRows > 0) {
      console.log(`✅ Auto-expired ${result.affectedRows} quotations`);
    } else {
      console.log('ℹ️ No quotations to expire');
    }

  } catch (error) {
    console.error('❌ Auto-expiry error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the auto-expiry function
autoExpireQuotations();

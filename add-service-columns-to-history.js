const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

async function runMigration() {
  let connection;
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('✅ Connected to database');
    console.log('📝 Running migration: Adding service columns to history table...');
    
    // Check existing columns
    const [existingColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'history'
    `, [dbConfig.database]);
    
    const columnNames = existingColumns.map(col => col.COLUMN_NAME);
    console.log('📋 Existing columns in history table:', columnNames.join(', '));
    
    // Add source column if it doesn't exist
    if (!columnNames.includes('source')) {
      console.log('➕ Adding source column...');
      await connection.execute(`
        ALTER TABLE history 
        ADD COLUMN source VARCHAR(50) DEFAULT NULL AFTER COST
      `);
      console.log('✅ Added source column');
    } else {
      console.log('✅ source column already exists');
    }
    
    // Add requisition_number column if it doesn't exist
    if (!columnNames.includes('requisition_number')) {
      console.log('➕ Adding requisition_number column...');
      await connection.execute(`
        ALTER TABLE history 
        ADD COLUMN requisition_number VARCHAR(100) DEFAULT NULL AFTER source
      `);
      console.log('✅ Added requisition_number column');
    } else {
      console.log('✅ requisition_number column already exists');
    }
    
    // Add repair_order_number column if it doesn't exist
    if (!columnNames.includes('repair_order_number')) {
      console.log('➕ Adding repair_order_number column...');
      await connection.execute(`
        ALTER TABLE history 
        ADD COLUMN repair_order_number VARCHAR(100) DEFAULT NULL AFTER requisition_number
      `);
      console.log('✅ Added repair_order_number column');
    } else {
      console.log('✅ repair_order_number column already exists');
    }
    
    // Add plate_number column if it doesn't exist
    if (!columnNames.includes('plate_number')) {
      console.log('➕ Adding plate_number column...');
      await connection.execute(`
        ALTER TABLE history 
        ADD COLUMN plate_number VARCHAR(50) DEFAULT NULL AFTER repair_order_number
      `);
      console.log('✅ Added plate_number column');
    } else {
      console.log('✅ plate_number column already exists');
    }
    
    // Add indexes for better performance
    try {
      if (!columnNames.includes('source')) {
        await connection.execute(`
          CREATE INDEX idx_history_source ON history(source)
        `);
        console.log('✅ Created index on source');
      }
    } catch (indexError) {
      if (indexError.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  Index on source already exists. Skipping...');
      } else {
        console.warn('⚠️  Could not create index on source:', indexError.message);
      }
    }
    
    try {
      if (!columnNames.includes('requisition_number')) {
        await connection.execute(`
          CREATE INDEX idx_history_requisition ON history(requisition_number)
        `);
        console.log('✅ Created index on requisition_number');
      }
    } catch (indexError) {
      if (indexError.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  Index on requisition_number already exists. Skipping...');
      } else {
        console.warn('⚠️  Could not create index on requisition_number:', indexError.message);
      }
    }
    
    console.log('✅ Migration completed successfully!');
    console.log('📊 Service columns have been added to history table:');
    console.log('   - source (VARCHAR(50))');
    console.log('   - requisition_number (VARCHAR(100))');
    console.log('   - repair_order_number (VARCHAR(100))');
    console.log('   - plate_number (VARCHAR(50))');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();


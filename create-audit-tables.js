const mysql = require('mysql2/promise');
require('dotenv').config();

async function createAuditTables() {
    let connection;
    
    try {
        console.log('🔄 Connecting to database...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'password',
            database: process.env.DB_NAME || 'inventory_system'
        });

        console.log('✅ Database connected successfully');

        // Read and execute the SQL file
        const fs = require('fs');
        const sqlContent = fs.readFileSync('create_audit_tables.sql', 'utf8');
        
        // Split by semicolon and execute each statement
        const statements = sqlContent.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await connection.execute(statement);
                    console.log('✅ Executed:', statement.substring(0, 50) + '...');
                } catch (error) {
                    if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
                        console.log('⚠️  Warning:', error.message);
                    }
                }
            }
        }

        console.log('🎉 Audit tables created successfully!');
        
        // Verify tables exist
        const [tables] = await connection.execute("SHOW TABLES LIKE 'audit_%'");
        console.log('📋 Created tables:', tables.map(t => Object.values(t)[0]));

    } catch (error) {
        console.error('❌ Error creating audit tables:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

createAuditTables();

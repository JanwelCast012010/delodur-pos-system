const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' })); // Limit request size
app.use(express.static(path.join(__dirname, 'client/build')));

// Database connection with optimized settings
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_system',
  waitForConnections: true,
  connectionLimit: 5, // Reduced from 10
  queueLimit: 0
};

console.log('Database config:', { 
  host: dbConfig.host, 
  user: dbConfig.user, 
  database: dbConfig.database 
});

const pool = mysql.createPool(dbConfig);

// Test database connection
async function testDatabaseConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connection successful');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Database connection test only - no table creation
async function testDatabaseConnection() {
  try {
    console.log('🔄 Testing database connection...');
    const connection = await pool.getConnection();
    console.log('✅ Database connection successful');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Helper function for pagination
const getPaginationParams = (req) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100 items per page
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

// API Routes

// Authentication
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const [users] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
    
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Debug endpoint to check users
app.get('/api/debug/users', async (req, res) => {
  try {
    const [users] = await pool.execute('SELECT id, username, role, created_at FROM users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Products API with pagination and search - reads from master table
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    console.log('📦 Fetching products from master table...');
    const { page, limit, offset } = getPaginationParams(req);
    const search = req.query.search || '';
    const brand = req.query.brand || '';
    
    let whereClause = 'WHERE 1=1';
    let params = [];
    
    if (search) {
      whereClause += ' AND (BENZ LIKE ? OR BRAND LIKE ? OR ALTNO LIKE ? OR ALTNO2 LIKE ? OR DESCRIPTION LIKE ?)';
      const searchParam = `%${search}%`;
      params = [searchParam, searchParam, searchParam, searchParam, searchParam];
    }
    
    if (brand) {
      whereClause += ' AND BRAND = ?';
      params.push(brand);
    }
    
    // Get total count for pagination
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM master ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    console.log(`📊 Found ${total} products`);
    
    // Interpolate LIMIT and OFFSET directly
    const sql = `
      SELECT *
      FROM master
      ${whereClause}
      ORDER BY BRAND, BENZ
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    const [rows] = await pool.execute(sql, params);
    
    console.log(`📦 Returning ${rows.length} products`);
    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('❌ Products API error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get brands for filtering - reads from master table
app.get('/api/products/brands', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT DISTINCT BRAND FROM master WHERE BRAND IS NOT NULL AND BRAND != "" ORDER BY BRAND');
    res.json(rows.map(row => row.BRAND));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST endpoint removed - using existing master table data only

// Stock Items API with pagination - reads from stocks table
app.get('/api/stock-items', authenticateToken, async (req, res) => {
  try {
    console.log('📦 Fetching stock items from stocks table...');
    const { page, limit, offset } = getPaginationParams(req);
    const search = req.query.search || '';
    
    let whereClause = 'WHERE 1=1';
    let params = [];
    
    if (search) {
      whereClause += ' AND (COLORCODE LIKE ? OR REMARKS LIKE ? OR BRAND LIKE ? OR BENZ LIKE ? OR BENZ2 LIKE ? OR BENZ3 LIKE ? OR ALTNO LIKE ? OR ALTNO2 LIKE ?)';
      const searchParam = `%${search}%`;
      params = [searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam];
    }
    
    // Get total count
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM stocks ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    console.log(`📊 Found ${total} stock items`);
    
    // Interpolate LIMIT and OFFSET directly
    const sql = `
      SELECT *
      FROM stocks
      ${whereClause}
      ORDER BY BRAND, BENZ
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    const [rows] = await pool.execute(sql, params);
    
    console.log(`📦 Returning ${rows.length} stock items`);
    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('❌ Stock items API error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST endpoint removed - using existing stocks table data only

// Incoming/Outgoing stocks endpoints removed - using existing data only

// Outgoing stocks endpoints removed - using existing data only

// Suppliers endpoints removed - using existing data only

// Reports API removed - using existing data only

// Low stock reports API removed - using existing data only

// AI Chat endpoint (OpenAI + report logic)
app.post('/api/ai-chat', async (req, res) => {
  const { message } = req.body;
  try {
    // Check for report request
    if (/monthly sales report|sales this month|report for this month/i.test(message)) {
      // Use HISTORY table for sales report
      const [rows] = await pool.query(`
        SELECT DATE_FORMAT(DATE, '%Y-%m') as month, SUM(SELL * QTY) as total_sales, COUNT(*) as num_sales
        FROM HISTORY
        WHERE MONTH(DATE) = MONTH(CURRENT_DATE()) AND YEAR(DATE) = YEAR(CURRENT_DATE())
        GROUP BY month
      `);
      if (rows.length === 0) {
        return res.json({ reply: 'No sales data found for this month.' });
      }
      const row = rows[0];
      return res.json({ reply: `Monthly Sales Report for ${row.month}:\nTotal Sales: $${row.total_sales}\nNumber of Sales: ${row.num_sales}` });
    }

    // Otherwise, use OpenAI for general questions
    const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
    const openai = new OpenAIApi(configuration);
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are an AI assistant for an inventory system. You can answer questions about inventory, sales, and reports.' },
        { role: 'user', content: message }
      ]
    });
    const reply = completion.data.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error('AI chat error:', err.message);
    res.json({ reply: 'Sorry, there was an error processing your request.' });
  }
});

// Duplicate APIs removed - using existing authenticated endpoints

// Serve React app in development mode
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// Initialize database and start server
async function startServer() {
  try {
    console.log('🚀 Starting server...');
    
    // Test database connection first
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      console.error('❌ Cannot start server without database connection');
      process.exit(1);
    }
    
    // Initialize database
    await testDatabaseConnection();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌐 Frontend: http://localhost:3000`);
      console.log(`🔧 Backend API: http://localhost:${PORT}`);
      console.log(`📊 Database: ${dbConfig.host}/${dbConfig.database}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 
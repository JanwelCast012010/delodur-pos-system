const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
require('dotenv').config();
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for rate limiting behind reverse proxies
app.set('trust proxy', 1);

// Security and Performance Middleware
app.use(helmet()); // Security headers
app.use(compression()); // Response compression
app.use(cors());
app.use(express.json({ limit: '1mb' })); // Limit request size

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // increased from 100 to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Static files
app.use(express.static(path.join(__dirname, 'client/build')));

// Database connection with optimized settings
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_system',
  waitForConnections: true,
  connectionLimit: 15, // Increased for production load
  queueLimit: 0
};

console.log('Database config:', { 
  host: dbConfig.host, 
  user: dbConfig.user, 
  database: dbConfig.database 
});

const pool = mysql.createPool(dbConfig);

// Initialize caching system
const cache = new NodeCache({ 
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false // Better performance
});

// Cache middleware
const cacheMiddleware = (duration = 300) => {
  return (req, res, next) => {
    const key = `__express__${req.originalUrl || req.url}`;
    const cachedResponse = cache.get(key);
    
    if (cachedResponse) {
      res.send(cachedResponse);
      return;
    }
    
    res.sendResponse = res.send;
    res.send = (body) => {
      cache.set(key, body, duration);
      res.sendResponse(body);
    };
    next();
  };
};

// Cache invalidation helper
const invalidateCache = (pattern) => {
  const keys = cache.keys();
  const matchingKeys = keys.filter(key => key.includes(pattern));
  matchingKeys.forEach(key => cache.del(key));
};

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
  let limit = parseInt(req.query.limit) || 50;
  
  // Allow fetching all data when limit is set to 'all' or a very high number
  if (req.query.limit === 'all' || limit > 100000) {
    limit = 1000000; // Very high limit to get all data
  } else {
    limit = Math.min(limit, 100); // Max 100 items per page for normal requests
  }
  
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
app.get('/api/products', authenticateToken, cacheMiddleware(180), async (req, res) => {
  try {
    console.log('📦 Fetching products from master table...');
    const { page, limit, offset } = getPaginationParams(req);
    const search = req.query.search || '';
    const brand = req.query.brand || '';
    let whereClause = 'WHERE 1=1';
    let params = [];
    if (search) {
      const searchWithoutSpaces = search.replace(/\s+/g, '');
      whereClause += ' AND (BRAND LIKE ? OR BENZ LIKE ? OR ALTNO LIKE ? OR DESCRIPTION LIKE ? OR REPLACE(BRAND, " ", "") LIKE ? OR REPLACE(BENZ, " ", "") LIKE ? OR REPLACE(ALTNO, " ", "") LIKE ? OR REPLACE(DESCRIPTION, " ", "") LIKE ?)';
      const searchParam = `%${search}%`;
      const searchParamNoSpaces = `%${searchWithoutSpaces}%`;
      params = [searchParam, searchParam, searchParam, searchParam, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces];
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
    // Always include LIMIT and OFFSET directly in the SQL string
    const sql = `
      SELECT *
      FROM master
      ${whereClause}
      ORDER BY BRAND, BENZ
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [rows] = await pool.execute({ sql, timeout: 15000 }, params);
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
app.get('/api/products/brands', authenticateToken, cacheMiddleware(600), async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT DISTINCT BRAND FROM master WHERE BRAND IS NOT NULL AND BRAND != "" ORDER BY BRAND');
    res.json(rows.map(row => row.BRAND));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST endpoint removed - using existing master table data only

// Stock Items API with pagination - reads from tbl_stock table
app.get('/api/stock-items', authenticateToken, cacheMiddleware(120), async (req, res) => {
  try {
    console.log('📦 Fetching stock items from tbl_stock table...');
    const { page, limit, offset } = getPaginationParams(req);
    const search = req.query.search || '';
    const filter = req.query.filter || 'all';
    const sort = req.query.sort || '';
    
    let whereClause = 'WHERE 1=1';
    let params = [];
    
    if (search) {
      // Remove spaces from search term for better matching
      const searchWithoutSpaces = search.replace(/\s+/g, '');
      
      // Check if search is a number (for ID search)
      const isNumericSearch = !isNaN(search) && search.trim() !== '';
      
      if (isNumericSearch) {
        // For numeric searches, try exact ID match first, then LIKE for other fields
        whereClause += ' AND (ID = ? OR BRAND LIKE ? OR BENZ LIKE ? OR BENZ2 LIKE ? OR BENZ3 LIKE ? OR ALTNO LIKE ? OR ALTNO2 LIKE ? OR REPLACE(BRAND, " ", "") LIKE ? OR REPLACE(BENZ, " ", "") LIKE ? OR REPLACE(BENZ2, " ", "") LIKE ? OR REPLACE(BENZ3, " ", "") LIKE ? OR REPLACE(ALTNO, " ", "") LIKE ? OR REPLACE(ALTNO2, " ", "") LIKE ? )';
        const searchParam = `%${search}%`;
        const searchParamNoSpaces = `%${searchWithoutSpaces}%`;
        params = [parseInt(search), searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces];
      } else {
        // For text searches, use LIKE for all fields
        whereClause += ' AND (ID LIKE ? OR BRAND LIKE ? OR BENZ LIKE ? OR BENZ2 LIKE ? OR BENZ3 LIKE ? OR ALTNO LIKE ? OR ALTNO2 LIKE ? OR REPLACE(BRAND, " ", "") LIKE ? OR REPLACE(BENZ, " ", "") LIKE ? OR REPLACE(BENZ2, " ", "") LIKE ? OR REPLACE(BENZ3, " ", "") LIKE ? OR REPLACE(ALTNO, " ", "") LIKE ? OR REPLACE(ALTNO2, " ", "") LIKE ? )';
        const searchParam = `%${search}%`;
        const searchParamNoSpaces = `%${searchWithoutSpaces}%`;
        params = [searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces];
      }
    }
    
    // Apply stock filters
    if (filter === 'in-stock') {
      whereClause += ' AND QTY > 0';
    } else if (filter === 'out-of-stock') {
      whereClause += ' AND QTY <= 0';
    } else if (filter === 'low-stock') {
      whereClause += ' AND QTY > 0 AND QTY <= 5';
    }
    
    // Determine ORDER BY clause based on sort
    let orderByClause = 'ORDER BY ID DESC';
    switch (sort) {
      case 'az':
        orderByClause = 'ORDER BY BRAND ASC';
        break;
      case 'za':
        orderByClause = 'ORDER BY BRAND DESC';
        break;
      case 'price-low':
        orderByClause = 'ORDER BY SELL ASC';
        break;
      case 'price-high':
        orderByClause = 'ORDER BY SELL DESC';
        break;
      case 'date-old':
        orderByClause = 'ORDER BY DATE ASC';
        break;
      case 'date-new':
        orderByClause = 'ORDER BY DATE DESC';
        break;
      // 'featured' and 'best' can default to ID DESC for now
      default:
        orderByClause = 'ORDER BY ID DESC';
    }
    
    // Get total count
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM tbl_stock ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    console.log(`📊 Found ${total} stock items`);
    
    // Ensure limit and offset are numbers
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 50;
    const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
    
    // Always include LIMIT and OFFSET directly in the SQL string
    const sql = `
      SELECT *
      FROM tbl_stock
      ${whereClause}
      ${orderByClause}
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;
    console.log('SQL:', sql);
    console.log('Params:', params);
    const [rows] = await pool.execute({ sql, timeout: 15000 }, params);
    
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

// POST endpoint removed - using existing tbl_stock table data only

// Incoming/Outgoing stocks endpoints removed - using existing data only

// Outgoing stocks endpoints removed - using existing data only

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

// --- Purchase History API ---

// List all purchase history records (with pagination and search)
app.get('/api/history', cacheMiddleware(60), async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req);
    const search = req.query.search || '';
    let whereClause = 'WHERE 1=1';
    let params = [];
    if (search) {
      // Remove spaces from search term for better matching
      const searchWithoutSpaces = search.replace(/\s+/g, '');
      whereClause += ' AND (CUSTOMER LIKE ? OR INVOICE LIKE ? OR PARTNO LIKE ? OR BRAND LIKE ? OR DESCRIPTION LIKE ? OR APPL LIKE ? OR DATE LIKE ? OR REPLACE(CUSTOMER, " ", "") LIKE ? OR REPLACE(INVOICE, " ", "") LIKE ? OR REPLACE(PARTNO, " ", "") LIKE ? OR REPLACE(BRAND, " ", "") LIKE ? OR REPLACE(DESCRIPTION, " ", "") LIKE ? OR REPLACE(APPL, " ", "") LIKE ? OR REPLACE(DATE, " ", "") LIKE ?)';
      const searchParam = `%${search}%`;
      const searchParamNoSpaces = `%${searchWithoutSpaces}%`;
      params = [searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces];
    }
    // Get total count for pagination
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM history ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    // Fetch paginated data
    // Always include LIMIT and OFFSET directly in the SQL string
    const sql = `
      SELECT CUSTOMER, DATE_FORMAT(DATE, '%Y-%m-%d') as DATE, INVOICE, FLAG, CODE, AMOUNT, QTY, PARTNO, BRAND, DESCRIPTION, APPL, COST
      FROM history
      ${whereClause}
      ORDER BY DATE DESC, INVOICE DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [rows] = await pool.execute({ sql, timeout: 15000 }, [...params]);
    console.log(`[DEBUG] /api/history fetched ${rows.length} rows`, rows.slice(0, 3));
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
    console.error('❌ History API error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a new purchase history record
app.post('/api/history', async (req, res) => {
  try {
    const { CUSTOMER, DATE, INVOICE, FLAG, CODE, AMOUNT, QTY, PARTNO, BRAND, DESCRIPTION, APPL, COST } = req.body;
    const sql = `INSERT INTO history (CUSTOMER, DATE, INVOICE, FLAG, CODE, AMOUNT, QTY, PARTNO, BRAND, DESCRIPTION, APPL, COST)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [CUSTOMER, DATE, INVOICE, FLAG, CODE, AMOUNT, QTY, PARTNO, BRAND, DESCRIPTION, APPL, COST];
    const [result] = await pool.execute(sql, params);
    
    // Invalidate history cache
    invalidateCache('history');
    
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error('❌ Create History error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update a purchase history record
app.put('/api/history/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { CUSTOMER, DATE, INVOICE, FLAG, CODE, AMOUNT, QTY, PARTNO, BRAND, DESCRIPTION, APPL, COST } = req.body;
    const sql = `UPDATE history SET CUSTOMER=?, DATE=?, INVOICE=?, FLAG=?, CODE=?, AMOUNT=?, QTY=?, PARTNO=?, BRAND=?, DESCRIPTION=?, APPL=?, COST=? WHERE CODE=?`;
    const params = [CUSTOMER, DATE, INVOICE, FLAG, CODE, AMOUNT, QTY, PARTNO, BRAND, DESCRIPTION, APPL, COST, id];
    const [result] = await pool.execute(sql, params);
    
    // Invalidate history cache
    invalidateCache('history');
    
    res.json({ affectedRows: result.affectedRows });
  } catch (error) {
    console.error('❌ Update History error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a purchase history record
app.delete('/api/history/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const sql = `DELETE FROM history WHERE CODE=?`;
    const [result] = await pool.execute(sql, [id]);
    
    // Invalidate history cache
    invalidateCache('history');
    
    res.json({ affectedRows: result.affectedRows });
  } catch (error) {
    console.error('❌ Delete History error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Duplicate APIs removed - using existing authenticated endpoints

// Chat API endpoints
app.get('/api/chat/users', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.execute(`
      SELECT u.id, u.username, u.role, u.created_at, 
             ua.is_online, ua.last_activity
      FROM users u 
      LEFT JOIN user_activity ua ON u.id = ua.user_id 
      ORDER BY ua.is_online DESC, u.username ASC
    `);
    
    // Add display names and determine status
    const usersWithDetails = users.map(user => {
      const lastActivity = user.last_activity ? new Date(user.last_activity) : null;
      const now = new Date();
      const timeDiff = lastActivity ? (now - lastActivity) / 1000 / 60 : null; // minutes
      
      let status = 'offline';
      if (user.is_online && timeDiff !== null && timeDiff < 5) {
        status = 'online';
      } else if (user.is_online && timeDiff !== null && timeDiff < 15) {
        status = 'away';
      }
      
      return {
        id: user.id,
        username: user.username,
        name: user.username === 'admin' ? 'Administrator' : user.username.charAt(0).toUpperCase() + user.username.slice(1),
        status: status,
        role: user.role,
        lastActivity: user.last_activity,
        isCurrentUser: user.username === req.user.username
      };
    });
    
    res.json(usersWithDetails);
  } catch (error) {
    console.error('❌ Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/chat/messages/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;
    
    // Get messages between current user and selected user
    const [messages] = await pool.execute(`
      SELECT * FROM chat_messages 
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at ASC
    `, [currentUserId, userId, userId, currentUserId]);
    
    res.json(messages);
  } catch (error) {
    console.error('❌ Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/chat/send', authenticateToken, async (req, res) => {
  try {
    const { receiver_id, message } = req.body;
    const sender_id = req.user.id;
    
    const [result] = await pool.execute(`
      INSERT INTO chat_messages (sender_id, receiver_id, message, created_at) 
      VALUES (?, ?, ?, NOW())
    `, [sender_id, receiver_id, message]);
    
    // Get the created message with full details
    const [newMessage] = await pool.execute(`
      SELECT cm.*, u.username as sender_username 
      FROM chat_messages cm 
      JOIN users u ON cm.sender_id = u.id 
      WHERE cm.id = ?
    `, [result.insertId]);
    
    res.status(201).json(newMessage[0]);
  } catch (error) {
    console.error('❌ Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/chat/messages/read/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;
    
    // Mark messages as read
    const [result] = await pool.execute(`
      UPDATE chat_messages 
      SET is_read = 1 
      WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
    `, [userId, currentUserId]);
    
    res.json({ affectedRows: result.affectedRows });
  } catch (error) {
    console.error('❌ Mark read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/chat/unread-count', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    
    const [unreadCounts] = await pool.execute(`
      SELECT sender_id, COUNT(*) as count 
      FROM chat_messages 
      WHERE receiver_id = ? AND is_read = 0 
      GROUP BY sender_id
    `, [currentUserId]);
    
    res.json(unreadCounts);
  } catch (error) {
    console.error('❌ Get unread count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user activity (called when user is active)
app.post('/api/chat/activity', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    await pool.execute(`
      INSERT INTO user_activity (user_id, is_online, last_activity) 
      VALUES (?, TRUE, NOW())
      ON DUPLICATE KEY UPDATE 
        is_online = TRUE, 
        last_activity = NOW()
    `, [userId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Update activity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark user as offline (called when user logs out or closes browser)
app.post('/api/chat/offline', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    await pool.execute(`
      UPDATE user_activity 
      SET is_online = FALSE, last_activity = NOW()
      WHERE user_id = ?
    `, [userId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Mark offline error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



// Get customers
app.get('/api/customers', authenticateToken, async (req, res) => {
  try {
    const { search = '' } = req.query;
    
    let whereClause = '';
    let params = [];
    
    if (search) {
      whereClause = 'WHERE name LIKE ? OR email LIKE ? OR company_name LIKE ?';
      const searchParam = `%${search}%`;
      params = [searchParam, searchParam, searchParam];
    }
    
    const [customers] = await pool.execute(`
      SELECT * FROM customers ${whereClause} ORDER BY name
    `, params);
    
    res.json(customers);
  } catch (error) {
    console.error('❌ Get customers error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create customer
app.post('/api/customers', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      address,
      company_name,
      tax_id,
      contact_person
    } = req.body;
    
    const [result] = await pool.execute(`
      INSERT INTO customers (name, email, phone, address, company_name, tax_id, contact_person)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [name, email, phone, address, company_name, tax_id, contact_person]);
    
    res.status(201).json({ 
      id: result.insertId,
      message: 'Customer created successfully' 
    });
  } catch (error) {
    console.error('❌ Create customer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a new stock request
app.post('/api/stock-requests', authenticateToken, async (req, res) => {
  try {
    const { stockId, stockDescription, reason, userId, username, partNo, oem, brand } = req.body;
    const sql = `
      INSERT INTO stock_requests (user_id, username, stock_id, stock_description, reason, part_no, oem, brand)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [userId, username, stockId, stockDescription, reason, partNo, oem, brand];
    const [result] = await pool.execute(sql, params);
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error('❌ Create stock request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// List all stock requests (with pagination and search)
app.get('/api/stock-requests', authenticateToken, cacheMiddleware(60), async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req);
    const search = req.query.search || '';
    let whereClause = 'WHERE 1=1';
    let params = [];
    if (search) {
      whereClause += ' AND (stock_id LIKE ? OR stock_description LIKE ? OR part_no LIKE ? OR oem LIKE ? OR brand LIKE ?)';
      const searchParam = `%${search}%`;
      params = [searchParam, searchParam, searchParam, searchParam, searchParam];
    }
    // Get total count for pagination
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM stock_requests ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    // Fetch paginated data
    const sql = `
      SELECT sr.*, u.username as user_username
      FROM stock_requests sr
      JOIN users u ON sr.user_id = u.id
      ${whereClause}
      ORDER BY sr.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [rows] = await pool.execute({ sql, timeout: 15000 }, params);
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
    console.error('❌ Stock requests API error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update a stock request status
app.put('/api/stock-requests/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    const sql = `UPDATE stock_requests SET status = ? WHERE id = ?`;
    const params = [status, id];
    const [result] = await pool.execute(sql, params);
    res.json({ affectedRows: result.affectedRows });
  } catch (error) {
    console.error('❌ Update stock request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a stock request
app.delete('/api/stock-requests/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const sql = `DELETE FROM stock_requests WHERE id = ?`;
    const [result] = await pool.execute(sql, [id]);
    res.json({ affectedRows: result.affectedRows });
  } catch (error) {
    console.error('❌ Delete stock request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Serve React app in production mode
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
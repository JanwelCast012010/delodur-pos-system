const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
require('dotenv').config();

// Cache for notification counts (5 second TTL to reduce database load)
const notificationCache = new NodeCache({ stdTTL: 5, checkperiod: 1 });

// Helper function to invalidate notification cache when orders change
const invalidateNotificationCache = () => {
  notificationCache.del('order-counts');
};

const { Configuration, OpenAIApi } = require('openai');
const { v4: uuidv4 } = require('uuid');
const DBFReader = require('./dbf-reader');
const { DBFFile } = require('dbffile');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || true, // Allow all origins in development, set specific in production
    methods: ["GET", "POST"],
    credentials: true
  }
});
const PORT = process.env.PORT || 5000;

// Trust proxy for rate limiting behind reverse proxies
app.set('trust proxy', 1);

// Security and Performance Middleware
app.use(helmet()); // Security headers
app.use(compression()); // Response compression
app.use(cors());
app.use(express.json({ limit: '1mb' })); // Limit request size

// Rate limiting - Smart rate limiter that gives higher limits to authenticated users
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    // Much higher limit for authenticated users (they're actively using the system)
    // With powerful server (i7-12700, 32GB RAM), we can handle much more
    // Most API routes require authentication anyway
    return req.user ? 100000 : 1000; // 100000 for authenticated (10x increase for testing), 1000 for unauthenticated
  },
  keyGenerator: (req) => {
    // Use user ID if authenticated (per-user limit), otherwise use IP
    return req.user?.id ? `user:${req.user.id}` : req.ip;
  },
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

// Apply rate limiter to all API routes
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

// Throttle WebSocket emits to prevent overload (max 1 emit per 500ms)
let emitThrottleTimer = null;
let pendingEmit = false;

// Helper function to emit order count updates via WebSocket (optimized with cache)
const emitOrderCountsUpdate = async () => {
  // Throttle: if called multiple times quickly, batch them
  if (emitThrottleTimer) {
    pendingEmit = true;
    return; // Already scheduled, skip this call
  }

  emitThrottleTimer = setTimeout(async () => {
    try {
      // Try to use cached data first (from notification cache)
      const cacheKey = 'order-counts';
      const cached = notificationCache.get(cacheKey);
      
      let cashierCount, warehouseCount, serviceCount;

      if (cached) {
        // Use cached data (faster, no DB query)
        cashierCount = cached.cashierCount || 0;
        warehouseCount = cached.warehouseCount || 0;
        serviceCount = cached.serviceCount || 0;
      } else {
        // Cache miss - fetch from database (but this should be rare)
        const [cashierResult] = await pool.query(`
          SELECT COUNT(DISTINCT order_id) as count 
          FROM cashier 
          WHERE status = 'pending'
        `);
        cashierCount = cashierResult[0]?.count || 0;

        const [warehouseResult] = await pool.query(`
          SELECT COUNT(DISTINCT order_id) as count 
          FROM warehouse
        `);
        warehouseCount = warehouseResult[0]?.count || 0;

        const [serviceResult] = await pool.query(`
          SELECT COUNT(DISTINCT order_id) as count 
          FROM service 
          WHERE status = 'pending'
        `);
        serviceCount = serviceResult[0]?.count || 0;
      }

      // Emit to all connected clients
      io.emit('order-counts-updated', {
        success: true,
        cashierCount,
        warehouseCount,
        serviceCount
      });
    } catch (error) {
      console.error('Error emitting order counts update:', error);
    } finally {
      emitThrottleTimer = null;
      
      // If there was a pending emit while we were processing, do it now
      if (pendingEmit) {
        pendingEmit = false;
        emitOrderCountsUpdate();
      }
    }
  }, 500); // Throttle to max 1 emit per 500ms
};

// Global maintenance mode state (stored in memory, can be persisted to DB if needed)
let globalMaintenanceMode = false;

// Helper function to get maintenance mode status
const getMaintenanceMode = () => {
  // Check if stored in a file or database (for persistence across restarts)
  // For now, using in-memory storage. Can be enhanced to use DB.
  return globalMaintenanceMode;
};

// Helper function to set maintenance mode and broadcast to all clients
const setMaintenanceMode = (enabled) => {
  globalMaintenanceMode = enabled;
  
  // Broadcast to ALL connected clients via WebSocket
  io.emit('maintenance-mode-changed', {
    enabled: enabled,
    message: enabled 
      ? 'Maintenance mode enabled. All users will be logged out.' 
      : 'Maintenance mode disabled. System is accessible.'
  });
  
  console.log(`🔧 Maintenance mode ${enabled ? 'ENABLED' : 'DISABLED'} - Broadcasting to all clients`);
  
  return enabled;
};

// Socket.io connection handling
io.use((socket, next) => {
  // Allow all connections (can add JWT auth later if needed)
  next();
});

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  // Send initial order counts when client connects
  emitOrderCountsUpdate();
  
  // Send current maintenance mode status to newly connected client
  socket.emit('maintenance-mode-status', {
    enabled: globalMaintenanceMode
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });

  // Handle manual refresh request
  socket.on('request-order-counts', () => {
    emitOrderCountsUpdate();
  });
});

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
const JWT_SECRET = process.env.JWT_SECRET || 'delodur_inventory_system_2025_secure_key_12345';

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

// Test endpoint to check database structure
app.get('/api/test-db-structure', authenticateToken, async (req, res) => {
  try {
    const tables = ['warehouse', 'tbl_stock', 'products'];
    const results = {};
    
    for (const table of tables) {
      try {
        const [rows] = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        results[table] = { exists: true, count: rows[0].count };
      } catch (error) {
        results[table] = { exists: false, error: error.message };
      }
    }
    
    res.json({ 
      message: 'Database structure check completed',
      tables: results 
    });
  } catch (error) {
    res.status(500).json({ message: 'Database structure check failed', error: error.message });
  }
});

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
  let limit = parseInt(req.query.limit) || 300;
  
  // Allow fetching all data when limit is set to 'all' or a very high number
  if (req.query.limit === 'all' || limit > 100000) {
    limit = 1000000; // Very high limit to get all data
  } else {
    limit = Math.min(limit, 100); // Max 100 items per page for normal requests
  }
  
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

// Startup initialization: ensure auxiliary tables exist
async function initializeWarehouseSupportTables() {
  try {
    const conn = await pool.getConnection();
    try {
      // Discrepancy logs for warehouse edits
      await conn.query(`
        CREATE TABLE IF NOT EXISTS warehouse_discrepancies (
          id INT AUTO_INCREMENT PRIMARY KEY,
          order_id VARCHAR(36) NOT NULL,
          warehouse_no INT NOT NULL,
          old_stock_id INT,
          new_stock_id INT,
          old_qty INT,
          new_qty INT,
          old_price DECIMAL(10,2),
          new_price DECIMAL(10,2),
          reason ENUM('lost','broken','not_found','wrong_location','substituted','wrong_item_picked','price_correction','qty_correction','other') NOT NULL,
          notes TEXT,
          user_id INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_order_id (order_id),
          INDEX idx_warehouse_no (warehouse_no)
        )
      `);

      // Verification table for per-item verification in warehouse
      await conn.query(`
        CREATE TABLE IF NOT EXISTS warehouse_verifications (
          warehouse_no INT PRIMARY KEY,
          order_id VARCHAR(36) NOT NULL,
          verified TINYINT(1) DEFAULT 0,
          verified_by INT NULL,
          verified_at TIMESTAMP NULL,
          INDEX idx_order_id (order_id),
          CONSTRAINT fk_wh_verify_warehouse_no FOREIGN KEY (warehouse_no) REFERENCES warehouse(no) ON DELETE CASCADE
        )
      `);
    } finally {
      conn.release();
    }
    console.log('✅ Warehouse support tables ensured');
  } catch (err) {
    console.error('❌ Failed ensuring warehouse support tables:', err.message);
  }
}

initializeWarehouseSupportTables();

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
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        permissions: user.permissions
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Maintenance Mode API Endpoints
app.get('/api/maintenance/status', async (req, res) => {
  try {
    res.json({
      success: true,
      enabled: getMaintenanceMode()
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/maintenance/toggle', authenticateToken, async (req, res) => {
  try {
    // Only admins can toggle maintenance mode
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only administrators can toggle maintenance mode' });
    }
    
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'enabled must be a boolean value' });
    }
    
    // Set maintenance mode globally
    const newStatus = setMaintenanceMode(enabled);
    
    res.json({
      success: true,
      enabled: newStatus,
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'} successfully. All users will be notified.`
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// User Management API Endpoints

// Get current user with permissions
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, username, role, fullName, permissions FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: true, message: 'User not found' });
    }
    
    const user = users[0];
    res.json({
      error: false,
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        permissions: user.permissions
      }
    });
  } catch (error) {
    console.error('❌ Get current user error:', error);
    res.status(500).json({ error: true, message: 'Failed to get user data.' });
  }
});

// Get all users
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    // Check if user has userManagement permission or is admin
    if (req.user.role !== 'admin') {
      // Parse user permissions to check for userManagement
      try {
        const [userRecords] = await pool.execute('SELECT permissions FROM users WHERE id = ?', [req.user.id]);
        if (userRecords.length > 0 && userRecords[0].permissions) {
          const userPerms = typeof userRecords[0].permissions === 'string' 
            ? JSON.parse(userRecords[0].permissions) 
            : userRecords[0].permissions;
          if (userPerms.userManagement !== true) {
            return res.status(403).json({ error: true, message: 'Access denied. User management permission required.' });
          }
        } else {
          return res.status(403).json({ error: true, message: 'Access denied. Admin privileges or user management permission required.' });
        }
      } catch (permError) {
        return res.status(403).json({ error: true, message: 'Access denied. Admin privileges required.' });
      }
    }

    const [users] = await pool.execute(`
      SELECT id, username, password, role, fullName, permissions, created_at, last_active 
      FROM users 
      ORDER BY created_at DESC
    `);

    res.json({
      error: false,
      data: users
    });
  } catch (error) {
    console.error('❌ Get users error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch users.' });
  }
});

// Create new user (Admin only)
app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: true, message: 'Access denied. Admin privileges required.' });
    }

    const { username, password, fullName, role, permissions } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({ error: true, message: 'Username and password are required.' });
    }

    // Check if username already exists
    const [existingUsers] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: true, message: 'Username already exists.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Prepare permissions JSON - can be a string or object
    let permissionsJson = null;
    if (permissions) {
      if (typeof permissions === 'string') {
        permissionsJson = permissions;
      } else {
        permissionsJson = JSON.stringify(permissions);
      }
    }

    // Insert new user with specified role or default 'user' role
    const userRole = role || 'user';
    const [result] = await pool.execute(`
      INSERT INTO users (username, password, role, fullName, permissions) 
      VALUES (?, ?, ?, ?, ?)
    `, [username, hashedPassword, userRole, fullName || null, permissionsJson]);

    res.status(201).json({
      error: false,
      message: 'User created successfully',
      data: {
        id: result.insertId,
        username,
        fullName,
        permissions: permissionsJson
      }
    });
  } catch (error) {
    console.error('❌ Create user error:', error);
    res.status(500).json({ error: true, message: 'Failed to create user.' });
  }
});

// Update user
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const { username, password, fullName, role, permissions } = req.body;

    // Check if user has permission or is admin
    if (req.user.role !== 'admin') {
      // Parse user permissions to check for userManagement
      try {
        const [userRecords] = await pool.execute('SELECT permissions FROM users WHERE id = ?', [req.user.id]);
        if (userRecords.length > 0 && userRecords[0].permissions) {
          const userPerms = typeof userRecords[0].permissions === 'string' 
            ? JSON.parse(userRecords[0].permissions) 
            : userRecords[0].permissions;
          if (userPerms.userManagement !== true) {
            return res.status(403).json({ error: true, message: 'Access denied. User management permission required.' });
          }
        } else {
          return res.status(403).json({ error: true, message: 'Access denied. Admin privileges or user management permission required.' });
        }
      } catch (permError) {
        return res.status(403).json({ error: true, message: 'Access denied. Admin privileges required.' });
      }
    }

    // Validate required fields
    if (!username) {
      return res.status(400).json({ error: true, message: 'Username is required.' });
    }

    // Check if username already exists for other users
    const [existingUsers] = await pool.execute('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: true, message: 'Username already exists.' });
    }

    // Prepare permissions JSON - can be a string or object
    let permissionsJson = null;
    if (permissions) {
      if (typeof permissions === 'string') {
        permissionsJson = permissions;
      } else {
        permissionsJson = JSON.stringify(permissions);
      }
    }

    console.log('📝 Updating user', userId, 'with permissions:', permissionsJson);

    // Get current user data to preserve role if not provided
    const [currentUser] = await pool.execute('SELECT role FROM users WHERE id = ?', [userId]);
    const currentRole = currentUser.length > 0 ? currentUser[0].role : 'user';
    const roleToUse = role !== undefined ? role : currentRole;

    // Build update query
    let updateQuery = 'UPDATE users SET username = ?, fullName = ?, role = ?, permissions = ?';
    let params = [username, fullName || null, roleToUse, permissionsJson];

    // Add password to update if provided
    if (password && password.trim()) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery += ', password = ?';
      params.push(hashedPassword);
    }

    updateQuery += ' WHERE id = ?';
    params.push(userId);

    await pool.execute(updateQuery, params);
    console.log('✅ User updated successfully:', userId);

    res.json({
      error: false,
      message: 'User updated successfully',
      data: {
        id: userId,
        username,
        fullName,
        role: roleToUse,
        permissions: permissionsJson
      }
    });
  } catch (error) {
    console.error('❌ Update user error:', error);
    res.status(500).json({ error: true, message: 'Failed to update user.' });
  }
});

// Delete user (Admin only)
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: true, message: 'Access denied. Admin privileges required.' });
    }

    const userId = req.params.id;

    // Prevent deleting own account
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: true, message: 'Cannot delete your own account.' });
    }

    await pool.execute('DELETE FROM users WHERE id = ?', [userId]);

    res.json({
      error: false,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({ error: true, message: 'Failed to delete user.' });
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


// POST endpoint removed - using existing master table data only

// Stock Items API with pagination - reads from tbl_stock table
// Stock Items API with pagination - reads from tbl_stock table
app.get('/api/stock-items', authenticateToken, async (req, res) => {
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
      
      // Check if search contains numbers (for BENZ cross-reference search)
      const hasNumbers = /\d/.test(search);
      
      // Search multiple columns: ID (if numeric), BENZ, BENZ2, BENZ3, ALTNO, ALTNO2, BRAND, and REMARKS
      if (isNumericSearch) {
        console.log(`🔍 Searching ID, BENZ, BENZ2, BENZ3, ALTNO, ALTNO2, BRAND, and REMARKS for: ${search}`);
      } else {
        console.log(`🔍 Searching BENZ, BENZ2, BENZ3, ALTNO, ALTNO2, BRAND, and REMARKS for: ${search}`);
      }
      
      // Search multiple columns with precise matching strategies (only tbl_stock fields)
      // If numeric search, add ID search first
      if (isNumericSearch) {
        whereClause += ` AND (
          ts.ID = ? OR
          ts.BENZ = ? OR ts.BENZ LIKE ? OR REPLACE(ts.BENZ, " ", "") = ? OR REPLACE(ts.BENZ, " ", "") LIKE ? OR
          ts.BENZ2 = ? OR ts.BENZ2 LIKE ? OR REPLACE(ts.BENZ2, " ", "") = ? OR REPLACE(ts.BENZ2, " ", "") LIKE ? OR
          ts.BENZ3 = ? OR ts.BENZ3 LIKE ? OR REPLACE(ts.BENZ3, " ", "") = ? OR REPLACE(ts.BENZ3, " ", "") LIKE ? OR
          ts.ALTNO = ? OR ts.ALTNO LIKE ? OR REPLACE(ts.ALTNO, " ", "") = ? OR REPLACE(ts.ALTNO, " ", "") LIKE ? OR
          ts.ALTNO2 = ? OR ts.ALTNO2 LIKE ? OR REPLACE(ts.ALTNO2, " ", "") = ? OR REPLACE(ts.ALTNO2, " ", "") LIKE ? OR
          ts.BRAND = ? OR ts.BRAND LIKE ? OR REPLACE(ts.BRAND, " ", "") = ? OR REPLACE(ts.BRAND, " ", "") LIKE ? OR
          ts.REMARKS LIKE ? OR REPLACE(ts.REMARKS, " ", "") LIKE ?
        )`;
      } else {
        whereClause += ` AND (
          ts.BENZ = ? OR ts.BENZ LIKE ? OR REPLACE(ts.BENZ, " ", "") = ? OR REPLACE(ts.BENZ, " ", "") LIKE ? OR
          ts.BENZ2 = ? OR ts.BENZ2 LIKE ? OR REPLACE(ts.BENZ2, " ", "") = ? OR REPLACE(ts.BENZ2, " ", "") LIKE ? OR
          ts.BENZ3 = ? OR ts.BENZ3 LIKE ? OR REPLACE(ts.BENZ3, " ", "") = ? OR REPLACE(ts.BENZ3, " ", "") LIKE ? OR
          ts.ALTNO = ? OR ts.ALTNO LIKE ? OR REPLACE(ts.ALTNO, " ", "") = ? OR REPLACE(ts.ALTNO, " ", "") LIKE ? OR
          ts.ALTNO2 = ? OR ts.ALTNO2 LIKE ? OR REPLACE(ts.ALTNO2, " ", "") = ? OR REPLACE(ts.ALTNO2, " ", "") LIKE ? OR
          ts.BRAND = ? OR ts.BRAND LIKE ? OR REPLACE(ts.BRAND, " ", "") = ? OR REPLACE(ts.BRAND, " ", "") LIKE ? OR
          ts.REMARKS LIKE ? OR REPLACE(ts.REMARKS, " ", "") LIKE ?
        )`;
      }
      
      const searchParamExact = search;  // Exact match
      const searchParamStartsWith = `${search}%`;  // Starts with search term
      const searchParamNoSpaces = searchWithoutSpaces;
      const searchParamNoSpacesStartsWith = `${searchWithoutSpaces}%`;  // Starts with search term (no spaces)
      const searchParamContains = `%${search}%`;  // Contains search term
      const searchParamNoSpacesContains = `%${searchWithoutSpaces}%`;  // Contains search term (no spaces)
      
      // Parameters for each field: ID (if numeric), BENZ, BENZ2, BENZ3, ALTNO, ALTNO2, BRAND, REMARKS
      if (isNumericSearch) {
        params = [
          // ID field (exact match for numeric search)
          parseInt(search),
          // BENZ field
          searchParamExact, searchParamStartsWith, searchParamNoSpaces, searchParamNoSpacesStartsWith,
          // BENZ2 field
          searchParamExact, searchParamStartsWith, searchParamNoSpaces, searchParamNoSpacesStartsWith,
          // BENZ3 field
          searchParamExact, searchParamStartsWith, searchParamNoSpaces, searchParamNoSpacesStartsWith,
          // ALTNO field (used as OEM)
          searchParamExact, searchParamStartsWith, searchParamNoSpaces, searchParamNoSpacesStartsWith,
          // ALTNO2 field
          searchParamExact, searchParamStartsWith, searchParamNoSpaces, searchParamNoSpacesStartsWith,
          // BRAND field
          searchParamExact, searchParamStartsWith, searchParamNoSpaces, searchParamNoSpacesStartsWith,
          // REMARKS field (used as description)
          searchParamContains, searchParamNoSpacesContains
        ];
      } else {
        params = [
          // BENZ field
          searchParamExact, searchParamStartsWith, searchParamNoSpaces, searchParamNoSpacesStartsWith,
          // BENZ2 field
          searchParamExact, searchParamStartsWith, searchParamNoSpaces, searchParamNoSpacesStartsWith,
          // BENZ3 field
          searchParamExact, searchParamStartsWith, searchParamNoSpaces, searchParamNoSpacesStartsWith,
          // ALTNO field (used as OEM)
          searchParamExact, searchParamStartsWith, searchParamNoSpaces, searchParamNoSpacesStartsWith,
          // ALTNO2 field
          searchParamExact, searchParamStartsWith, searchParamNoSpaces, searchParamNoSpacesStartsWith,
          // BRAND field
          searchParamExact, searchParamStartsWith, searchParamNoSpaces, searchParamNoSpacesStartsWith,
          // REMARKS field (used as description)
          searchParamContains, searchParamNoSpacesContains
        ];
      }
    }
    
    // Apply stock filters
    if (filter === 'in-stock') {
      // Show items with QTY > 0 OR items with 0 QTY but in service
      whereClause += ' AND (QTY > 0 OR s.stock_id IS NOT NULL)';
    } else if (filter === 'out-of-stock') {
      whereClause += ' AND QTY <= 0';
    } else if (filter === 'low-stock') {
      whereClause += ' AND QTY > 0 AND QTY <= 5';
    }
    // For 'all' filter, don't add any quantity restrictions - show all items
    
    // Determine ORDER BY clause based on sort and search relevance
    let orderByClause = 'ORDER BY ID DESC';
    
    if (search) {
      // When searching, prioritize exact matches across all fields, then partial matches
      const searchWithoutSpaces = search.replace(/\s+/g, '');
      
      // Use string interpolation for ORDER BY since we already have the search values
      orderByClause = `ORDER BY 
        CASE 
          -- Exact matches (highest priority)
          WHEN ts.BENZ = '${search.replace(/'/g, "''")}' THEN 1
          WHEN ts.BENZ2 = '${search.replace(/'/g, "''")}' THEN 1
          WHEN ts.BENZ3 = '${search.replace(/'/g, "''")}' THEN 1
          WHEN ts.ALTNO = '${search.replace(/'/g, "''")}' THEN 1
          WHEN ts.ALTNO2 = '${search.replace(/'/g, "''")}' THEN 1
          WHEN ts.BRAND = '${search.replace(/'/g, "''")}' THEN 1
          -- Space-removed exact matches
          WHEN REPLACE(ts.BENZ, " ", "") = '${searchWithoutSpaces.replace(/'/g, "''")}' THEN 2
          WHEN REPLACE(ts.BENZ2, " ", "") = '${searchWithoutSpaces.replace(/'/g, "''")}' THEN 2
          WHEN REPLACE(ts.BENZ3, " ", "") = '${searchWithoutSpaces.replace(/'/g, "''")}' THEN 2
          WHEN REPLACE(ts.ALTNO, " ", "") = '${searchWithoutSpaces.replace(/'/g, "''")}' THEN 2
          WHEN REPLACE(ts.ALTNO2, " ", "") = '${searchWithoutSpaces.replace(/'/g, "''")}' THEN 2
          WHEN REPLACE(ts.BRAND, " ", "") = '${searchWithoutSpaces.replace(/'/g, "''")}' THEN 2
          -- Starts with matches
          WHEN ts.BENZ LIKE '${search.replace(/'/g, "''")}%' THEN 3
          WHEN ts.BENZ2 LIKE '${search.replace(/'/g, "''")}%' THEN 3
          WHEN ts.BENZ3 LIKE '${search.replace(/'/g, "''")}%' THEN 3
          WHEN ts.ALTNO LIKE '${search.replace(/'/g, "''")}%' THEN 3
          WHEN ts.ALTNO2 LIKE '${search.replace(/'/g, "''")}%' THEN 3
          WHEN ts.BRAND LIKE '${search.replace(/'/g, "''")}%' THEN 3
          -- Space-removed starts with matches
          WHEN REPLACE(ts.BENZ, " ", "") LIKE '${searchWithoutSpaces.replace(/'/g, "''")}%' THEN 4
          WHEN REPLACE(ts.BENZ2, " ", "") LIKE '${searchWithoutSpaces.replace(/'/g, "''")}%' THEN 4
          WHEN REPLACE(ts.BENZ3, " ", "") LIKE '${searchWithoutSpaces.replace(/'/g, "''")}%' THEN 4
          WHEN REPLACE(ts.ALTNO, " ", "") LIKE '${searchWithoutSpaces.replace(/'/g, "''")}%' THEN 4
          WHEN REPLACE(ts.ALTNO2, " ", "") LIKE '${searchWithoutSpaces.replace(/'/g, "''")}%' THEN 4
          WHEN REPLACE(ts.BRAND, " ", "") LIKE '${searchWithoutSpaces.replace(/'/g, "''")}%' THEN 4
          -- Contains matches
          WHEN ts.BENZ LIKE '%${search.replace(/'/g, "''")}%' THEN 5
          WHEN ts.BENZ2 LIKE '%${search.replace(/'/g, "''")}%' THEN 5
          WHEN ts.BENZ3 LIKE '%${search.replace(/'/g, "''")}%' THEN 5
          WHEN ts.ALTNO LIKE '%${search.replace(/'/g, "''")}%' THEN 5
          WHEN ts.ALTNO2 LIKE '%${search.replace(/'/g, "''")}%' THEN 5
          WHEN ts.BRAND LIKE '%${search.replace(/'/g, "''")}%' THEN 5
          WHEN ts.REMARKS LIKE '%${search.replace(/'/g, "''")}%' THEN 5
          -- Space-removed contains matches
          WHEN REPLACE(ts.BENZ, " ", "") LIKE '%${searchWithoutSpaces.replace(/'/g, "''")}%' THEN 6
          WHEN REPLACE(ts.BENZ2, " ", "") LIKE '%${searchWithoutSpaces.replace(/'/g, "''")}%' THEN 6
          WHEN REPLACE(ts.BENZ3, " ", "") LIKE '%${searchWithoutSpaces.replace(/'/g, "''")}%' THEN 6
          WHEN REPLACE(ts.ALTNO, " ", "") LIKE '%${searchWithoutSpaces.replace(/'/g, "''")}%' THEN 6
          WHEN REPLACE(ts.ALTNO2, " ", "") LIKE '%${searchWithoutSpaces.replace(/'/g, "''")}%' THEN 6
          WHEN REPLACE(ts.BRAND, " ", "") LIKE '%${searchWithoutSpaces.replace(/'/g, "''")}%' THEN 6
          WHEN REPLACE(ts.REMARKS, " ", "") LIKE '%${searchWithoutSpaces.replace(/'/g, "''")}%' THEN 6
          ELSE 7
        END,
        ts.ID DESC`;
    } else {
      // Default sorting when not searching
    switch (sort) {
      case 'az':
          orderByClause = 'ORDER BY ts.BRAND ASC';
        break;
      case 'za':
          orderByClause = 'ORDER BY ts.BRAND DESC';
        break;
      case 'price-low':
          orderByClause = 'ORDER BY ts.SELL ASC';
        break;
      case 'price-high':
          orderByClause = 'ORDER BY ts.SELL DESC';
        break;
      case 'date-old':
          orderByClause = 'ORDER BY ts.DATE ASC';
        break;
      case 'date-new':
          orderByClause = 'ORDER BY ts.DATE DESC';
        break;
      case 'recent':
          orderByClause = 'ORDER BY ts.ID DESC';
        break;
      default:
          orderByClause = 'ORDER BY ts.ID DESC';
      }
    }
    
    // Get total count - use different query for 'all' filter
    let countSql;
    if (filter === 'all') {
      // Simple count for 'all' filter
      countSql = `SELECT COUNT(*) as total FROM tbl_stock ts ${whereClause}`;
    } else {
      // Include service items for other filters
      countSql = `SELECT COUNT(DISTINCT ts.ID) as total FROM tbl_stock ts 
                   LEFT JOIN service s ON ts.ID = s.stock_id AND s.quantity > 0 
                   ${whereClause}`;
    }
    
    const [countResult] = await pool.execute(countSql, params);
    const total = countResult[0].total;
    console.log(`📊 Found ${total} stock items`);
    
    // Ensure limit and offset are numbers
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 300;
    const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
    
    // Build the SQL query with proper parameter handling
    // For 'all' filter, use a simpler query without service table join to avoid DISTINCT issues
    let sql;
    if (filter === 'all') {
      // Simple query for 'all' filter - no service table join to avoid DISTINCT issues
      sql = `
        SELECT ts.*, 
               COALESCE(m.\`DESC\`, ts.REMARKS, 'No description') as DESCRIPTION,
               m.APPL as APPLICATION,
               m.REORDER as REORDER_POINT
        FROM tbl_stock ts
        LEFT JOIN master m ON ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ 
                           AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND
        ${whereClause}
        ${orderByClause}
        LIMIT ${safeLimit} OFFSET ${safeOffset}
      `;
    } else {
      // Include items from service table for other filters
      sql = `
        SELECT DISTINCT ts.*, 
               COALESCE(m.\`DESC\`, ts.REMARKS, 'No description') as DESCRIPTION,
               m.APPL as APPLICATION,
               m.REORDER as REORDER_POINT
        FROM tbl_stock ts
        LEFT JOIN master m ON ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ 
                           AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND
        LEFT JOIN service s ON ts.ID = s.stock_id AND s.quantity > 0
        ${whereClause}
        ${orderByClause}
        LIMIT ${safeLimit} OFFSET ${safeOffset}
      `;
    }
    
    console.log('🔍 SQL Query Debug:');
    console.log('  - Filter:', filter);
    console.log('  - Where Clause:', whereClause);
    console.log('  - Order By:', orderByClause);
    console.log('  - Full SQL:', sql);
    console.log('  - Params:', params);
    
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

// 🔗 CASCADING COMPATIBILITY SEARCH API
app.get('/api/stock-items/compatibility', authenticateToken, async (req, res) => {
  try {
    const searchTerm = req.query.search || '';
    console.log(`🔗 Starting cascading compatibility search for: ${searchTerm}`);
    
    if (!searchTerm.trim()) {
      return res.status(400).json({ message: 'Search term is required' });
    }

    // Set to find exact matches for the search term
    const searchParam = searchTerm.trim();
    console.log(`🔍 Compatibility search - searchParam: "${searchParam}"`);
    console.log(`🔍 Compatibility search - searchParam length: ${searchParam.length}`);
    
    // Get all parts that match the search term (space-insensitive match in BENZ, BENZ2, or BENZ3)
    const [exactMatches] = await pool.execute(`
      SELECT DISTINCT ts.*, 
        COALESCE(loc.location_code, 'Location not indicated') as LOCATION,
        COALESCE(m.DESC, ts.REMARKS) as DESCRIPTION
      FROM tbl_stock ts
      LEFT JOIN master m ON ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND
      LEFT JOIN location loc ON ts.ID = loc.id
      WHERE (ts.BENZ = ? OR ts.BENZ2 = ? OR ts.BENZ3 = ?) OR 
            (REPLACE(ts.BENZ, ' ', '') = ? OR REPLACE(ts.BENZ2, ' ', '') = ? OR REPLACE(ts.BENZ3, ' ', '') = ?)
      ORDER BY ts.BENZ, ts.BRAND, ts.ALTNO
    `, [searchParam, searchParam, searchParam, searchParam, searchParam, searchParam]);

    console.log(`📦 Found ${exactMatches.length} exact matches for: ${searchParam}`);
    console.log(`📦 Exact matches sample:`, exactMatches.slice(0, 3).map(m => ({ BENZ: m.BENZ, BENZ2: m.BENZ2, BENZ3: m.BENZ3 })));
    
    // Debug: Let's see what's actually in the database for this search term
    const [debugMatches] = await pool.execute(`
      SELECT BENZ, BENZ2, BENZ3, REPLACE(BENZ, ' ', '') as BENZ_NO_SPACES, 
             REPLACE(BENZ2, ' ', '') as BENZ2_NO_SPACES, 
             REPLACE(BENZ3, ' ', '') as BENZ3_NO_SPACES
      FROM tbl_stock 
      WHERE BENZ LIKE '%2112403017%' OR BENZ2 LIKE '%2112403017%' OR BENZ3 LIKE '%2112403017%'
      LIMIT 5
    `);
    console.log(`🔍 Debug - Database matches for 2112403017:`, debugMatches);

    // Set to store all found parts (to avoid duplicates)
    const allFoundParts = new Set();
    const compatibilityChain = [];
    
    // Add exact matches to the set
    exactMatches.forEach(part => {
      allFoundParts.add(part.BENZ);
      compatibilityChain.push({
        ...part,
        isCompatible: false, // Original search term is not "compatible"
        compatibilityLevel: 0
      });
    });

    // BFS (Breadth-First Search) for recursive cross-reference search
    // Initialize with both forward and reverse search
    const queue = [searchTerm]; // Start with the search term
    const processedPartNumbers = new Set(); // Tracks part numbers that have been added to the queue OR fully processed
    const finalResults = []; // Stores unique stock records (full objects)
    const finalResultKeys = new Set(); // Tracks unique keys for finalResults (e.g., BENZ + BRAND + ALTNO or ID)

    // Add initial search term to processedPartNumbers
    if (searchTerm) {
      processedPartNumbers.add(searchTerm);
    }

    // REVERSE SEARCH: Find parts that have the search term as their BENZ2/BENZ3 (alternate numbers)
    // This mimics TRACK.exe behavior where it finds parts through alternate number chains
    console.log(`🔄 Starting reverse search for parts that have "${searchTerm}" as alternate number...`);
            const [reverseMatches] = await pool.execute(`
          SELECT DISTINCT ts.id as ID, ts.BENZ, ts.BENZ2, ts.BENZ3, ts.BRAND, ts.ALTNO, ts.QTY, ts.SELL, ts.REMARKS, ts.DATE,
            COALESCE(loc.location_code, 'Location not indicated') as LOCATION,
            COALESCE(m.DESC, ts.REMARKS) as DESCRIPTION
          FROM tbl_stock ts
          LEFT JOIN master m ON ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND
          LEFT JOIN location loc ON ts.id = loc.id
          WHERE (ts.BENZ2 = ? OR ts.BENZ3 = ?) OR 
                (REPLACE(ts.BENZ2, ' ', '') = ? OR REPLACE(ts.BENZ3, ' ', '') = ?)
          ORDER BY ts.BENZ, ts.BRAND, ts.ALTNO
        `, [searchTerm, searchTerm, searchTerm, searchTerm]);

    console.log(`🔄 Found ${reverseMatches.length} parts that have "${searchTerm}" as alternate number`);

    // Add reverse matches to queue for further exploration AND to final results
    reverseMatches.forEach(part => {
      if (!processedPartNumbers.has(part.BENZ)) {
        processedPartNumbers.add(part.BENZ);
        queue.push(part.BENZ);
        console.log(`🔄 Added reverse match to queue: ${part.BENZ}`);
      }
      
      // Also add reverse matches to final results immediately
      const partKey = `ID-${part.ID}`;
      if (!finalResultKeys.has(partKey)) {
        finalResults.push({
          ...part,
          isCompatible: true,
          compatibilityLevel: 0 // Reverse matches are level 0 (direct alternate numbers)
        });
        finalResultKeys.add(partKey);
        console.log(`🔄 Added reverse match to final results: ${part.BENZ} (ID: ${part.ID})`);
      }
    });


    // FUZZY MATCHING SEARCH: Find parts with similar part numbers
    console.log(`🔍 Starting fuzzy matching search...`);
    const fuzzyPattern = searchTerm.replace(/\s+/g, '%');
    const [fuzzyMatches] = await pool.execute(`
      SELECT DISTINCT ts.id as ID, ts.BENZ, ts.BENZ2, ts.BENZ3, ts.BRAND, ts.ALTNO, ts.QTY, ts.SELL, ts.REMARKS, ts.DATE,
        COALESCE(loc.location_code, 'Location not indicated') as LOCATION,
        COALESCE(m.DESC, ts.REMARKS) as DESCRIPTION
      FROM tbl_stock ts
      LEFT JOIN master m ON ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND
      LEFT JOIN location loc ON ts.id = loc.id
      WHERE ts.BENZ LIKE ? OR ts.BENZ2 LIKE ? OR ts.BENZ3 LIKE ?
      ORDER BY ts.BENZ, ts.BRAND, ts.ALTNO
    `, [`%${fuzzyPattern}%`, `%${fuzzyPattern}%`, `%${fuzzyPattern}%`]);

    console.log(`🔍 Found ${fuzzyMatches.length} parts with fuzzy matches`);

    // Add fuzzy matches to final results
    fuzzyMatches.forEach(part => {
      const partKey = `ID-${part.ID}`;
      if (!finalResultKeys.has(partKey)) {
        finalResults.push({
          ...part,
          isCompatible: true,
          compatibilityLevel: -3, // Fuzzy matching compatibility
          compatibilityType: 'fuzzy'
        });
        finalResultKeys.add(partKey);
        console.log(`🔍 Added fuzzy match to final results: ${part.BENZ} (ID: ${part.ID})`);
      }
    });

    // RECURSIVE BRAND+ALTNO COMPATIBILITY SEARCH: Find parts with same brand+altno combinations
    console.log(`🏷️ Starting recursive brand+altno compatibility search...`);
    
    // First, collect all brand+altno combinations from the search results (including QTY=0)
    const [allSearchResults] = await pool.execute(`
      SELECT DISTINCT ts.BRAND, ts.ALTNO
      FROM tbl_stock ts
      WHERE (ts.BENZ = ? OR ts.BENZ2 = ? OR ts.BENZ3 = ?) OR 
            (REPLACE(ts.BENZ, ' ', '') = ? OR REPLACE(ts.BENZ2, ' ', '') = ? OR REPLACE(ts.BENZ3, ' ', '') = ?)
    `, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]);
    
    if (allSearchResults.length > 0) {
      const brandAltnoCombinations = allSearchResults
        .map(r => ({ brand: r.BRAND, altno: r.ALTNO }))
        .filter(c => c.brand && c.altno);
      
      console.log(`🏷️ Found ${brandAltnoCombinations.length} brand+altno combinations to search`);
      
      // BFS for brand+altno combinations
      const processedBrandAltno = new Set();
      const brandAltnoQueue = [...brandAltnoCombinations];
      
      let brandAltnoLevel = 0;
      
      while (brandAltnoQueue.length > 0) {
        const current = brandAltnoQueue.shift();
        const key = `${current.brand}-${current.altno}`;
        
        if (processedBrandAltno.has(key)) continue;
        processedBrandAltno.add(key);
        brandAltnoLevel++;
        
        console.log(`🏷️ Level ${brandAltnoLevel}: Searching for brand+altno: ${current.brand} + ${current.altno}`);
        
        // Find all parts with this brand+altno combination
        const [brandAltnoParts] = await pool.execute(`
          SELECT DISTINCT ts.id as ID, ts.BENZ, ts.BENZ2, ts.BENZ3, ts.BRAND, ts.ALTNO, ts.QTY, ts.SELL, ts.REMARKS, ts.DATE,
            COALESCE(loc.location_code, 'Location not indicated') as LOCATION,
            COALESCE(m.DESC, ts.REMARKS) as DESCRIPTION
          FROM tbl_stock ts
          LEFT JOIN master m ON ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND
          LEFT JOIN location loc ON ts.id = loc.id
          WHERE ts.BRAND = ? AND ts.ALTNO = ?
          ORDER BY ts.BENZ, ts.BRAND, ts.ALTNO
        `, [current.brand, current.altno]);
        
        console.log(`🏷️ Found ${brandAltnoParts.length} parts with ${current.brand} + ${current.altno}`);
        
        // Process each found part
        brandAltnoParts.forEach(part => {
          const partKey = `ID-${part.ID}`;
          
          // Add to final results (we'll filter by quantity later)
          if (!finalResultKeys.has(partKey)) {
            finalResults.push({
              ...part,
              isCompatible: true,
              compatibilityLevel: -5, // Brand+altno compatibility
              compatibilityType: 'brand-altno'
            });
            finalResultKeys.add(partKey);
            console.log(`🏷️ Added brand+altno match: ${part.BENZ} (${part.BRAND}, ${part.ALTNO})`);
          }
          
          // Collect new brand+altno combinations from this part's BENZ, BENZ2, BENZ3
          [part.BENZ, part.BENZ2, part.BENZ3].forEach(benz => {
            if (benz) {
              // Find parts with this BENZ to get their brand+altno combinations
              pool.execute(`
                SELECT DISTINCT BRAND, ALTNO FROM tbl_stock 
                WHERE BENZ = ? AND BRAND IS NOT NULL AND ALTNO IS NOT NULL
                LIMIT 5
              `, [benz]).then(([newCombinations]) => {
                newCombinations.forEach(combo => {
                  const newKey = `${combo.BRAND}-${combo.ALTNO}`;
                  if (!processedBrandAltno.has(newKey)) {
                    brandAltnoQueue.push({ brand: combo.BRAND, altno: combo.ALTNO });
                    console.log(`🏷️ Queued new brand+altno: ${combo.BRAND} + ${combo.ALTNO}`);
                  }
                });
              }).catch(err => console.error('Error in brand+altno queue:', err));
            }
          });
        });
      }
      
      console.log(`🏷️ Brand+altno search completed. Processed ${processedBrandAltno.size} combinations across ${brandAltnoLevel} levels`);
    }

    let level = 0;

    while (queue.length > 0) { // No level limit - search until complete
      const current = queue.shift(); // Take one part number from queue
      level++;

      console.log(`🔍 Level ${level}: Searching for parts that reference "${current}"`);

      // Find all parts that have this partNumber in their BENZ, BENZ2, or BENZ3 fields
              const [compatibleParts] = await pool.execute(`
          SELECT DISTINCT ts.id as ID, ts.BENZ, ts.BENZ2, ts.BENZ3, ts.BRAND, ts.ALTNO, ts.QTY, ts.SELL, ts.REMARKS, ts.DATE,
            COALESCE(loc.location_code, 'Location not indicated') as LOCATION,
            COALESCE(m.DESC, ts.REMARKS) as DESCRIPTION
          FROM tbl_stock ts
          LEFT JOIN master m ON ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND
          LEFT JOIN location loc ON ts.id = loc.id
          WHERE (ts.BENZ = ? OR ts.BENZ2 = ? OR ts.BENZ3 = ?) OR 
                (REPLACE(ts.BENZ, ' ', '') = ? OR REPLACE(ts.BENZ2, ' ', '') = ? OR REPLACE(ts.BENZ3, ' ', '') = ?)
          ORDER BY ts.BENZ, ts.BRAND, ts.ALTNO
        `, [current, current, current, current, current, current]);

      console.log(`  📊 Found ${compatibleParts.length} parts that reference "${current}"`);

      // Process each found part
      compatibleParts.forEach(part => {
        console.log(`    🔍 Processing part: ${part.BENZ} (ID: ${part.ID})`);
        
        // Create a unique key based on database ID to allow all unique records
        const partKey = `ID-${part.ID}`;

        console.log(`    🔍 Checking part: ${part.BENZ} (ID: ${part.ID}) - Key: ${partKey} - Already exists: ${finalResultKeys.has(partKey)}`);
        
        if (!finalResultKeys.has(partKey)) {
          finalResults.push({
            ...part,
            isCompatible: true,
            compatibilityLevel: level // Add compatibility level for display
          });
          finalResultKeys.add(partKey);
          console.log(`    ✅ Added to final results: ${part.BENZ} (ID: ${part.ID}, Level ${level})`);
        } else {
          console.log(`    ⚠️ Skipped duplicate: ${part.BENZ} (ID: ${part.ID}) - Key already exists: ${partKey}`);
        }

        // Collect BENZ, BENZ2, BENZ3 references for next level search
        // Queue ALL part numbers for further search, regardless of quantity
        [part.BENZ, part.BENZ2, part.BENZ3].forEach(ref => {
          if (ref && !processedPartNumbers.has(ref)) {
            processedPartNumbers.add(ref); // Mark as processed/queued
            queue.push(ref); // Add to queue for next search
            console.log(`    🔄 Queued for next search: ${ref}`);
          } else if (ref) {
            console.log(`    ⚠️ Already processed: ${ref}`);
          }
        });
      });
    }

    console.log(`🔗 BFS completed. Found ${finalResults.length} total stock records across ${level} levels`);
    console.log("🔗 Final BFS results (first 10):", finalResults.slice(0, 10).map(p => ({ BENZ: p.BENZ, BRAND: p.BRAND, ALTNO: p.ALTNO })));

    // NO QUANTITY FILTER - Show all parts including those with 0 quantity
    console.log(`📊 Showing all ${finalResults.length} parts (including 0 quantity items)`);
    
    // Count parts by quantity for logging
    const zeroQtyCount = finalResults.filter(part => (parseInt(part.QTY) || 0) === 0).length;
    const nonZeroQtyCount = finalResults.filter(part => (parseInt(part.QTY) || 0) > 0).length;
    console.log(`📊 Parts with quantity > 0: ${nonZeroQtyCount}, Parts with quantity = 0: ${zeroQtyCount}`);

    // Sort results: items with quantity > 0 first, then items with quantity = 0
    const sortedResults = finalResults.sort((a, b) => {
      const aQty = parseInt(a.QTY) || 0;
      const bQty = parseInt(b.QTY) || 0;
      
      // If quantities are different, sort by quantity (higher first)
      if (aQty !== bQty) {
        return bQty - aQty;
      }
      
      // If quantities are the same, maintain original order (by BENZ, BRAND, ALTNO)
      return 0;
    });

    console.log(`📊 Sorted results - first 5 items:`, sortedResults.slice(0, 5).map(p => ({ 
      BENZ: p.BENZ, 
      BRAND: p.BRAND, 
      ALTNO: p.ALTNO, 
      QTY: p.QTY 
    })));

    // Group results by compatibility level for better organization
    const groupedResults = {};
    sortedResults.forEach(part => {
      const level = part.compatibilityLevel;
      if (!groupedResults[level]) {
        groupedResults[level] = [];
      }
      groupedResults[level].push(part);
    });

    res.json({
      success: true,
      searchTerm: searchParam,
      totalParts: sortedResults.length,
      levels: level,
      results: sortedResults,
      groupedResults: groupedResults
    });

  } catch (error) {
    console.error('❌ Compatibility search error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// 🚀 ENHANCED VERSION - Stock Items API with fallback description logic (COMMENTED OUT FOR REVERT)
// app.get('/api/stock-items', authenticateToken, cacheMiddleware(120), async (req, res) => {
//   try {
//     console.log('📦 Fetching stock items from tbl_stock table...');
//     const { page, limit, offset } = getPaginationParams(req);
//     const search = req.query.search || '';
//     const filter = req.query.filter || 'all';
//     const sort = req.query.sort || '';
    
//     let whereClause = 'WHERE 1=1';
//     let params = [];
//     
//     if (search) {
//       // Remove spaces from search term for better matching
//       const searchWithoutSpaces = search.replace(/\s+/g, '');
//       
//       // Check if search is a number (for ID search)
//       const isNumericSearch = !isNaN(search) && search.trim() !== '';
//       
//       if (isNumericSearch) {
//         // For numeric searches, try exact ID match first, then LIKE for other fields
//         whereClause += ' AND (s.ID = ? OR s.BRAND LIKE ? OR s.BENZ LIKE ? OR s.BENZ2 LIKE ? OR s.BENZ3 LIKE ? OR s.ALTNO LIKE ? OR s.ALTNO2 LIKE ? OR REPLACE(s.BRAND, " ", "") LIKE ? OR REPLACE(s.BENZ, " ", "") LIKE ? OR REPLACE(s.BENZ2, " ", "") LIKE ? OR REPLACE(s.BENZ3, " ", "") LIKE ? OR REPLACE(s.ALTNO, " ", "") LIKE ? OR REPLACE(s.ALTNO2, " ", "") LIKE ? )';
//         const searchParam = `%${search}%`;
//         const searchParamNoSpaces = `%${searchWithoutSpaces}%`;
//         params = [parseInt(search), searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces];
//       } else {
//         // For text searches, use LIKE for all fields
//         whereClause += ' AND (s.ID LIKE ? OR s.BRAND LIKE ? OR s.BENZ LIKE ? OR s.BENZ2 LIKE ? OR s.BENZ3 LIKE ? OR s.ALTNO LIKE ? OR s.ALTNO2 LIKE ? OR REPLACE(s.BRAND, " ", "") LIKE ? OR REPLACE(s.BENZ, " ", "") LIKE ? OR REPLACE(s.BENZ2, " ", "") LIKE ? OR REPLACE(s.BENZ3, " ", "") LIKE ? OR REPLACE(s.ALTNO, " ", "") LIKE ? OR REPLACE(s.ALTNO2, " ", "") LIKE ? )';
//         const searchParam = `%${search}%`;
//         const searchParamNoSpaces = `%${searchWithoutSpaces}%`;
//         params = [searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces];
//       }
//     }
//     
//     // Apply stock filters
//     if (filter === 'in-stock') {
//       whereClause += ' AND s.QTY > 0';
//     } else if (filter === 'out-of-stock') {
//       whereClause += ' AND s.QTY <= 0';
//     } else if (filter === 'low-stock') {
//       whereClause += ' AND s.QTY > 0 AND s.QTY <= 5';
//     }
//     
//     // Determine ORDER BY clause based on sort
//     let orderByClause = 'ORDER BY s.ID DESC';
//     switch (sort) {
//       case 'az':
//         orderByClause = 'ORDER BY s.BRAND ASC';
//         break;
//       case 'za':
//         orderByClause = 'ORDER BY s.BRAND DESC';
//         break;
//       case 'price-low':
//         orderByClause = 'ORDER BY s.SELL ASC';
//         break;
//       case 'price-high':
//         orderByClause = 'ORDER BY s.SELL DESC';
//         break;
//       case 'date-old':
//         orderByClause = 'ORDER BY s.DATE ASC';
//         break;
//       case 'date-new':
//         orderByClause = 'ORDER BY s.DATE DESC';
//         break;
//       // 'featured' and 'best' can default to ID DESC for now
//       default:
//         orderByClause = 'ORDER BY s.ID DESC';
//     }
//     
//     // Get total count
//     const [countResult] = await pool.execute(
//       `SELECT COUNT(*) as total FROM tbl_stock s ${whereClause}`,
//       params
//     );
//     const total = countResult[0].total;
//     console.log(`📊 Found ${total} stock items`);
//     
//     // Ensure limit and offset are numbers
//     const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 300;
//     const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
    
//     // 🚀 ENHANCED: JOIN with master table to get descriptions and implement fallback logic
//     const sql = `
//       SELECT s.*, m.DESC as MASTER_DESCRIPTION
//       FROM tbl_stock s
//       LEFT JOIN master m ON (
//         s.BENZ = m.BENZ OR 
//         s.ALTNO = m.ALTNO OR 
//         (s.BRAND = m.BRAND AND s.ALTNO = m.ALTNO) OR
//         (s.BRAND = m.BRAND AND s.BENZ = m.BENZ)
//       )
//       ${whereClause.replace('WHERE 1=1', 'WHERE 1=1')}
//       ${orderByClause}
//       LIMIT ${safeLimit} OFFSET ${safeOffset}
//     `;
//     console.log('🚀 Enhanced SQL with master table JOIN:', sql);
//     console.log('Params:', params);
//     const [rows] = await pool.execute({ sql, timeout: 15000 }, params);
//     
//     // 🎯 IMPLEMENT FALLBACK DESCRIPTION LOGIC
//     const enhancedRows = rows.map(row => {
//       let finalDescription = '';
//       
//       // Priority 1: Try to get description from master table
//       if (row.MASTER_DESCRIPTION && row.MASTER_DESCRIPTION.trim() !== '') {
//         finalDescription = row.MASTER_DESCRIPTION.trim();
//       }
//       // Priority 2: Try BRAND + ALTNO combination
//       else if (row.BRAND && row.ALTNO && row.BRAND.trim() !== '' && row.ALTNO.trim() !== '') {
//         finalDescription = `${row.BRAND.trim()} - ${row.BRAND.trim()}`;
//       }
//       // Priority 3: Try BENZ + BRAND combination
//       else if (row.BENZ && row.BRAND && row.BENZ.trim() !== '' && row.BRAND.trim() !== '') {
//         finalDescription = `${row.BENZ.trim()} - ${row.BRAND.trim()}`;
//       }
//       // Priority 4: Try just BRAND if available
//       else if (row.BRAND && row.BRAND.trim() !== '') {
//         finalDescription = row.BRAND.trim();
//       }
//       // Priority 5: Keep as "No description" if nothing available
//       else {
//         finalDescription = 'No description';
//       }
//       
//       // Add the computed description to the row
//       return {
//         ...row,
//         DESCRIPTION: finalDescription,
//         ORIGINAL_DESCRIPTION: row.DESCRIPTION || 'No description', // Keep original for reference
//         DESCRIPTION_SOURCE: row.MASTER_DESCRIPTION ? 'Master Table' : 
//                            (row.BRAND && row.ALTNO ? 'BRAND + ALTNO' :
//                            (row.BENZ && row.BRAND ? 'BENZ + BRAND' :
//                            (row.BRAND ? 'BRAND only' : 'No data available')))
//       };
//     });
//     
//     console.log(`🚀 Enhanced: Returning ${enhancedRows.length} stock items with fallback descriptions`);
//     console.log(`📊 Description sources: ${enhancedRows.filter(r => r.DESCRIPTION_SOURCE !== 'No data available').length} with descriptions, ${enhancedRows.filter(r => r.DESCRIPTION_SOURCE === 'No data available').length} still no description`);
//     
//     res.json({
//       data: enhancedRows,
//       pagination: {
//         page,
//         limit,
//         total,
//         pages: Math.ceil(total / limit)
//       }
//     });
//   } catch (error) {
//     console.error('❌ Stock items API error:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// });

// 🔒 REVERT INSTRUCTIONS:
// If you need to go back to the original simple version:
// 1. Comment out the entire enhanced endpoint above (lines starting with "🚀 ENHANCED VERSION")
// 2. Uncomment the backup version (lines starting with "🔒 BACKUP VERSION")
// 3. Restart your server

// POST endpoint removed - using existing tbl_stock table data only

// Incoming/Outgoing stocks endpoints removed - using existing data only

// Outgoing stocks endpoints removed - using existing data only

// Reports API removed - using existing data only

// Low stock reports API removed - using existing data only

// Update stock quantity endpoint
app.put('/api/stock/:id/quantity', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    
    // Validate input
    if (quantity === undefined || quantity === null) {
      return res.status(400).json({ message: 'Quantity is required' });
    }
    
    const newQuantity = parseInt(quantity);
    if (isNaN(newQuantity) || newQuantity < 0) {
      return res.status(400).json({ message: 'Quantity must be a non-negative number' });
    }
    
    // Check if stock item exists
    const [existingStock] = await pool.execute(
      'SELECT ID, QTY FROM tbl_stock WHERE ID = ?',
      [id]
    );
    
    if (existingStock.length === 0) {
      return res.status(404).json({ message: 'Stock item not found' });
    }
    
    const oldQuantity = existingStock[0].QTY;
    
    // Update the quantity
    await pool.execute(
      'UPDATE tbl_stock SET QTY = ? WHERE ID = ?',
      [newQuantity, id]
    );
    
    console.log(`📦 Updated stock item ${id} quantity from ${oldQuantity} to ${newQuantity}`);
    
    res.json({
      success: true,
      message: 'Quantity updated successfully',
      data: {
        id: parseInt(id),
        oldQuantity,
        newQuantity
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating stock quantity:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Location Management API - Get items with quantity > 0 and no location
app.get('/api/location/items', authenticateToken, async (req, res) => {
  try {
    console.log('📍 Fetching items with quantity > 0 and no location...');
    
    // Query for items with quantity > 0 and (LOCATION is NULL or empty)
    // Check both tbl_stock.LOCATION and location table
    const sql = `
      SELECT ts.*,
             COALESCE(m.\`DESC\`, ts.REMARKS, 'No description') as DESCRIPTION,
             COALESCE(loc.location_code, ts.LOCATION, '') as LOCATION
      FROM tbl_stock ts
      LEFT JOIN master m ON ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ 
                         AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND
      LEFT JOIN location loc ON ts.ID = loc.id
      WHERE ts.QTY > 0 
        AND (
          (ts.LOCATION IS NULL OR ts.LOCATION = '' OR ts.LOCATION = 'Location not indicated')
          AND (loc.location_code IS NULL OR loc.location_code = '' OR loc.location_code = 'Location not indicated')
        )
      ORDER BY ts.ID DESC
    `;
    
    const [rows] = await pool.execute(sql);
    
    console.log(`📍 Found ${rows.length} items with quantity and no location`);
    // Debug: Log first item to check ID field
    if (rows.length > 0) {
      console.log('📍 Sample item:', { 
        ID: rows[0].ID, 
        id: rows[0].id,
        BENZ: rows[0].BENZ,
        hasID: 'ID' in rows[0]
      });
    }
    res.json(rows);
  } catch (error) {
    console.error('❌ Location items API error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Location Management API - Update locations
app.put('/api/location/update', authenticateToken, async (req, res) => {
  try {
    const { updates } = req.body;
    
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: 'Updates array is required' });
    }
    
    console.log(`📍 Updating locations for ${updates.length} item(s)...`);
    
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      let successCount = 0;
      const errors = [];
      
      for (const update of updates) {
        const { id, location } = update;
        
        if (!id || isNaN(parseInt(id))) {
          errors.push({ id, error: 'Invalid ID' });
          continue;
        }
        
        try {
          const stockId = parseInt(id);
          const locationValue = location && location.trim() ? location.trim() : null;
          
          // Update tbl_stock.LOCATION directly (primary storage)
          await connection.execute(
            'UPDATE tbl_stock SET LOCATION = ? WHERE ID = ?',
            [locationValue || null, stockId]
          );
          console.log(`📍 Updated tbl_stock.LOCATION for item ${id} to: ${locationValue || 'NULL'}`);
          
          // Also update or insert into location table (this is checked first in queries)
          // Wrap in try-catch so if location table doesn't exist or has issues, we still save to tbl_stock
          try {
            // Check if entry exists first
            const [existingLocation] = await connection.execute(
              'SELECT id FROM location WHERE id = ?',
              [stockId]
            );
            
            if (existingLocation.length > 0) {
              // Update existing entry
              await connection.execute(
                'UPDATE location SET location_code = ? WHERE id = ?',
                [locationValue || null, stockId]
              );
              console.log(`📍 Updated location table entry for item ${id}`);
            } else {
              // Insert new entry
              await connection.execute(
                'INSERT INTO location (id, location_code) VALUES (?, ?)',
                [stockId, locationValue || null]
              );
              console.log(`📍 Created new location table entry for item ${id}`);
            }
          } catch (locTableErr) {
            // Log but don't fail - tbl_stock.LOCATION is the primary storage
            console.warn(`⚠️ Could not update location table for item ${id}:`, locTableErr.message);
            console.log(`📍 Continuing anyway - location saved to tbl_stock.LOCATION`);
          }
          
          successCount++;
          console.log(`📍 Updated location for item ${id} to: ${locationValue || 'NULL'} (both tbl_stock and location table)`);
        } catch (err) {
          console.error(`❌ Error updating item ${id}:`, err);
          errors.push({ id, error: err.message });
        }
      }
      
      await connection.commit();
      
      console.log(`📍 Successfully updated ${successCount} item(s)`);
      
      if (errors.length > 0) {
        console.warn(`⚠️ ${errors.length} item(s) had errors:`, errors);
      }
      
      res.json({
        success: true,
        message: `Updated ${successCount} item(s) successfully`,
        updated: successCount,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('❌ Location update API error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all locations for a specific part number (BENZ)
app.get('/api/warehouse/part-locations/:partNo', authenticateToken, async (req, res) => {
  try {
    const { partNo } = req.params;
    
    if (!partNo || partNo.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Part number is required'
      });
    }
    
    console.log(`📍 Fetching locations for part number: ${partNo}`);
    
    const connection = await pool.getConnection();
    try {
      // Query tbl_stock for all records with this part number
      // Check BENZ, BENZ2, and BENZ3 fields
      // Get distinct locations from both tbl_stock.LOCATION and location.location_code
      // Fix collation mismatch by casting to consistent collation
      const query = `
        SELECT DISTINCT
          ts.BENZ as part_number,
          ts.BRAND as brand,
          CAST(COALESCE(loc.location_code, ts.LOCATION) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as location
        FROM tbl_stock ts
        LEFT JOIN location loc ON ts.ID = loc.id
        WHERE (
          ts.BENZ = ? OR 
          ts.BENZ2 = ? OR 
          ts.BENZ3 = ? OR
          REPLACE(ts.BENZ, ' ', '') = ? OR 
          REPLACE(ts.BENZ2, ' ', '') = ? OR 
          REPLACE(ts.BENZ3, ' ', '') = ?
        )
        AND (
          (loc.location_code IS NOT NULL AND loc.location_code != '' AND loc.location_code != 'Location not indicated')
          OR
          (loc.location_code IS NULL AND ts.LOCATION IS NOT NULL AND ts.LOCATION != '' AND ts.LOCATION != 'Location not indicated')
        )
        ORDER BY location ASC
      `;
      
      const partNoNoSpaces = partNo.replace(/\s+/g, '');
      const [rows] = await connection.execute(query, [
        partNo.trim(),
        partNo.trim(),
        partNo.trim(),
        partNoNoSpaces,
        partNoNoSpaces,
        partNoNoSpaces
      ]);
      
      console.log(`✅ Found ${rows.length} location(s) for part number: ${partNo}`);
      
      connection.release();
      
      res.json({
        success: true,
        partNumber: partNo,
        locations: rows,
        count: rows.length
      });
      
    } catch (dbError) {
      connection.release();
      console.error('❌ Database error fetching part locations:', dbError);
      throw dbError;
    }
    
  } catch (error) {
    console.error('❌ Error fetching part locations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch part locations',
      message: error.message
    });
  }
});

// Save adjustment record to backlog
app.post('/api/stock/adjustment', authenticateToken, async (req, res) => {
  try {
    const {
      stock_id,
      benz,
      brand,
      quantity_added,
      price,
      reason,
      note,
      date,
      previous_quantity,
      new_quantity
    } = req.body;

    // Validate required fields
    if (!stock_id) {
      return res.status(400).json({ error: 'Stock ID is required' });
    }

    // Create adjustments table if it doesn't exist
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS stock_adjustments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        stock_id INT NOT NULL,
        benz VARCHAR(50),
        brand VARCHAR(50),
        quantity_added INT NOT NULL,
        price DECIMAL(10,2) DEFAULT 0,
        reason VARCHAR(100),
        note TEXT,
        date DATE NOT NULL,
        previous_quantity INT NOT NULL,
        new_quantity INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_stock_id (stock_id),
        INDEX idx_date (date)
      )
    `);

    // Insert adjustment record
    const [result] = await pool.execute(`
      INSERT INTO stock_adjustments (
        stock_id, benz, brand, quantity_added, price, reason, note, date, previous_quantity, new_quantity
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      stock_id,
      benz || null,
      brand || null,
      quantity_added,
      price || 0,
      reason || null,
      note || null,
      date || new Date().toISOString().split('T')[0],
      previous_quantity,
      new_quantity
    ]);

    res.json({
      success: true,
      message: 'Adjustment saved to backlog',
      id: result.insertId
    });
  } catch (error) {
    console.error('❌ Error saving adjustment to backlog:', error);
    res.status(500).json({ error: 'Failed to save adjustment', details: error.message });
  }
});

// Get adjustment history
app.get('/api/stock/adjustments', authenticateToken, async (req, res) => {
  try {
    // Check if table exists, if not return empty array
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'stock_adjustments'
    `, [dbConfig.database]);

    if (tables.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const [adjustments] = await pool.execute(`
      SELECT 
        id,
        stock_id,
        benz,
        brand,
        quantity_added,
        price,
        reason,
        note,
        date,
        previous_quantity,
        new_quantity,
        created_at
      FROM stock_adjustments
      ORDER BY created_at DESC
      LIMIT 1000
    `);

    res.json({
      success: true,
      data: adjustments
    });
  } catch (error) {
    console.error('❌ Error fetching adjustment history:', error);
    res.status(500).json({ error: 'Failed to fetch adjustment history', details: error.message });
  }
});

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
      whereClause = 'WHERE customer_name LIKE ? OR customer_code LIKE ? OR contact_person LIKE ?';
      const searchParam = `%${search}%`;
      params = [searchParam, searchParam, searchParam];
    }
    
    const [customers] = await pool.execute(`
      SELECT * FROM customers ${whereClause} ORDER BY customer_name
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
      customer_code,
      customer_name,
      contact_person,
      phone,
      email,
      address,
      credit_limit,
      payment_terms,
      is_active
    } = req.body;
    
    const [result] = await pool.execute(`
      INSERT INTO customers (customer_code, customer_name, contact_person, phone, email, address, credit_limit, payment_terms, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [customer_code, customer_name, contact_person, phone, email, address, credit_limit, payment_terms, is_active]);
    
    res.status(201).json({ 
      id: result.insertId,
      message: 'Customer created successfully' 
    });
  } catch (error) {
    console.error('❌ Create customer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update customer
app.put('/api/customers/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const {
      customer_code,
      customer_name,
      contact_person,
      phone,
      email,
      address,
      credit_limit,
      payment_terms,
      is_active
    } = req.body;
    
    const [result] = await pool.execute(`
      UPDATE customers 
      SET customer_code = ?, customer_name = ?, contact_person = ?, phone = ?, email = ?, 
          address = ?, credit_limit = ?, payment_terms = ?, is_active = ?
      WHERE id = ?
    `, [customer_code, customer_name, contact_person, phone, email, address, credit_limit, payment_terms, is_active, id]);
    
    res.json({ 
      affectedRows: result.affectedRows,
      message: 'Customer updated successfully' 
    });
  } catch (error) {
    console.error('❌ Update customer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete customer (soft delete by setting is_active to false)
app.delete('/api/customers/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    
    const [result] = await pool.execute(`
      UPDATE customers SET is_active = false WHERE id = ?
    `, [id]);
    
    res.json({ 
      affectedRows: result.affectedRows,
      message: 'Customer deactivated successfully' 
    });
  } catch (error) {
    console.error('❌ Delete customer error:', error);
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
    
    // Invalidate cache so new request appears immediately
    invalidateCache('stock-requests');
    
    // Emit WebSocket notification for real-time updates
    if (io) {
      io.emit('stock-request-updated');
    }
    
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error('❌ Create stock request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// List all stock requests (with pagination and search)
app.get('/api/stock-requests', authenticateToken, cacheMiddleware(5), async (req, res) => {
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
    
    // Invalidate cache so status change appears immediately
    invalidateCache('stock-requests');
    
    // Emit WebSocket notification for real-time updates
    if (io) {
      io.emit('stock-request-updated');
    }
    
    res.json({ affectedRows: result.affectedRows });
  } catch (error) {
    console.error('❌ Update stock request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a stock request (Admin only)
// Note: This deletion does NOT affect stock quantities - it only removes the request record.
// Stock requests are just requests, not actual stock movements, so deleting them should not modify inventory.
app.delete('/api/stock-requests/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Admin privileges required to delete stock requests.',
        error: 'Forbidden'
      });
    }

    const id = req.params.id;
    // Delete only the request record - NO stock manipulation (no returning items to stock)
    const sql = `DELETE FROM stock_requests WHERE id = ?`;
    const [result] = await pool.execute(sql, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        message: 'Stock request not found',
        error: 'Not Found'
      });
    }
    
    console.log(`✅ Stock request ${id} deleted by admin ${req.user.username}`);
    
    // Invalidate cache so deletion appears immediately
    invalidateCache('stock-requests');
    
    // Emit WebSocket notification for real-time updates
    if (io) {
      io.emit('stock-request-updated');
    }
    
    res.json({ 
      success: true,
      message: 'Stock request deleted successfully',
      affectedRows: result.affectedRows 
    });
  } catch (error) {
    console.error('❌ Delete stock request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});



// Add to cart: immediately deduct from tbl_stock, store cart in a new table (user_cart)
app.post('/api/cart/add', authenticateToken, async (req, res) => {
  try {
    const { stock_id, quantity } = req.body;
    const user_id = req.user.id;
    if (!stock_id || !quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Invalid stock_id or quantity' });
    }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Check available stock
      const [[stock]] = await conn.query('SELECT QTY FROM tbl_stock WHERE ID = ?', [stock_id]);
      if (!stock || stock.QTY < quantity) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ message: 'Not enough stock available' });
      }
      // Deduct from stock
      await conn.query('UPDATE tbl_stock SET QTY = QTY - ? WHERE ID = ?', [quantity, stock_id]);
      // Add to user_cart (upsert)
      await conn.query(`INSERT INTO user_cart (user_id, stock_id, quantity) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`, [user_id, stock_id, quantity]);
      await conn.commit();
      conn.release();
      res.json({ success: true });
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove from cart: add back to tbl_stock, remove from user_cart
app.post('/api/cart/remove', authenticateToken, async (req, res) => {
  try {
    const { stock_id, quantity } = req.body;
    const user_id = req.user.id;
    if (!stock_id || !quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Invalid stock_id or quantity' });
    }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Add back to stock
      await conn.query('UPDATE tbl_stock SET QTY = QTY + ? WHERE ID = ?', [quantity, stock_id]);
      // Remove or reduce from user_cart
      const [[cartItem]] = await conn.query('SELECT quantity FROM user_cart WHERE user_id = ? AND stock_id = ?', [user_id, stock_id]);
      if (cartItem && cartItem.quantity > quantity) {
        await conn.query('UPDATE user_cart SET quantity = quantity - ? WHERE user_id = ? AND stock_id = ?', [quantity, user_id, stock_id]);
      } else {
        await conn.query('DELETE FROM user_cart WHERE user_id = ? AND stock_id = ?', [user_id, stock_id]);
      }
      await conn.commit();
      conn.release();
      res.json({ success: true });
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete warehouse item and restore stock (same logic as cancel order)
app.delete('/api/warehouse/items/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Item ID required' });
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Get the specific item with its quantity (same as cancel order logic)
      const [items] = await conn.query('SELECT id_number, qty FROM warehouse WHERE no = ?', [id]);
      
      if (items.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: 'Warehouse item not found' });
      }
      
      const item = items[0];
      const { id_number, qty } = item;
      
      console.log(`🔄 Restoring ${qty} units of item ${id_number} back to stock`);
      
      // Restore stock quantity (same as cancel order logic)
      await conn.query('UPDATE tbl_stock SET QTY = QTY + ? WHERE ID = ?', [qty, id_number]);
      
      // Delete the warehouse item
      await conn.query('DELETE FROM warehouse WHERE no = ?', [id]);
      
      await conn.commit();
      conn.release();
      
      console.log(`✅ Warehouse item ${id} deleted successfully. Returned ${qty} units to stock.`);
      res.json({ 
        success: true,
        message: `Item deleted successfully. ${qty} units returned to stock.`,
        deletedItem: item,
        restoredQuantity: qty,
        stockItemId: id_number
      });
      
    } catch (err) {
      await conn.rollback();
      conn.release();
      console.error('❌ Delete warehouse item error:', err);
      throw err;
    }
  } catch (error) {
    console.error('❌ Delete warehouse item error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update warehouse item ID and quantity with auto-fetch of new item details
app.put('/api/warehouse/items/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { new_id_number, qty, unit_price: override_unit_price, discrepancy_reason, discrepancy_notes } = req.body;
    
    console.log(`🔄 Updating warehouse item ${id} with new ID: ${new_id_number}, quantity: ${qty}`);
    
    // Validate input
    if (!new_id_number || !qty) {
      return res.status(400).json({ 
        error: 'Both new_id_number and qty are required' 
      });
    }
    
    // Check if the new ID exists in tbl_stock and get available quantity
    const [stockCheck] = await pool.execute(
      'SELECT ID, QTY FROM tbl_stock WHERE ID = ?', 
      [new_id_number]
    );
    
    if (stockCheck.length === 0) {
      return res.status(404).json({ 
        error: `Stock item with ID ${new_id_number} not found` 
      });
    }
    
    const availableStock = stockCheck[0].QTY;
    
    // Get current warehouse quantity to determine if we're increasing or decreasing
    const [currentWarehouseItem] = await pool.execute(
      'SELECT no, order_id, id_number, qty, unit_price FROM warehouse WHERE no = ?', 
      [id]
    );
    
    if (currentWarehouseItem.length === 0) {
      return res.status(404).json({ 
        error: `Warehouse item with ID ${id} not found` 
      });
    }
    
    const currentWarehouseQty = currentWarehouseItem[0].qty;
    const currentUnitPrice = currentWarehouseItem[0].unit_price;
    const currentOrderId = currentWarehouseItem[0].order_id;
    
    // Get current warehouse item ID for validation
    const currentIdNumber = currentWarehouseItem[0].id_number;
    
    // Only validate stock availability if we're increasing the warehouse quantity
    // But if we're changing to a different item, we need to check the new item's stock
    if (qty > currentWarehouseQty) {
      const additionalQtyNeeded = qty - currentWarehouseQty;
      if (additionalQtyNeeded > availableStock) {
        return res.status(400).json({ 
          error: `Insufficient stock! Available: ${availableStock}, Additional needed: ${additionalQtyNeeded}`,
          availableStock: availableStock,
          requestedQty: qty,
          currentWarehouseQty: currentWarehouseQty,
          additionalQtyNeeded: additionalQtyNeeded
        });
      }
    } else if (currentIdNumber !== new_id_number) {
      // If changing to a different item, check if new item has enough stock
      if (qty > availableStock) {
        return res.status(400).json({ 
          error: `Insufficient stock for new item! Available: ${availableStock}, Requested: ${qty}`,
          availableStock: availableStock,
          requestedQty: qty
        });
      }
    }
    
    // Get the new item details from tbl_stock and master
    const [newItemDetails] = await pool.execute(`
      SELECT 
        ts.ID,
        ts.BENZ as benz_number,
        ts.BRAND as brand,
        ts.ALTNO as alt_number,
        ts.SELL as selling_price,
        ts.LOCATION as location_code,
        COALESCE(m.DESC, ts.REMARKS) as description,
        COALESCE(loc.location_code, 'Location not indicated') as location
      FROM tbl_stock ts
      LEFT JOIN master m ON ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND
      LEFT JOIN location loc ON ts.ID = loc.id
      WHERE ts.ID = ?
    `, [new_id_number]);
    
    if (newItemDetails.length === 0) {
      return res.status(404).json({ 
        error: `Could not fetch details for ID ${new_id_number}` 
      });
    }
    
    const itemDetails = newItemDetails[0];
    const effectiveUnitPrice = (override_unit_price !== undefined && override_unit_price !== null)
      ? Number(override_unit_price)
      : Number(itemDetails.selling_price);
    
    // Calculate stock adjustment
    const stockAdjustment = currentWarehouseQty - qty; // Positive = return to stock, Negative = take from stock
    
    console.log(`📊 Stock adjustment calculation:`);
    console.log(`   Current warehouse qty: ${currentWarehouseQty}`);
    console.log(`   New warehouse qty: ${qty}`);
    console.log(`   Current item ID: ${currentIdNumber}`);
    console.log(`   New item ID: ${new_id_number}`);
    console.log(`   Stock adjustment: ${stockAdjustment} (${stockAdjustment > 0 ? 'return to stock' : 'take from stock'})`);
    
    // Start transaction to ensure data consistency
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Update the warehouse item
      await conn.execute(`
        UPDATE warehouse 
        SET 
          id_number = ?,
          qty = ?,
          part_no = ?,
          description = ?,
          unit_price = ?
        WHERE no = ?
      `, [
        new_id_number,
        qty,
        itemDetails.benz_number,
        itemDetails.description,
        effectiveUnitPrice,
        id
      ]);
      
      // Adjust stock quantity
      if (stockAdjustment !== 0 || currentIdNumber !== new_id_number) {
        // If changing to a different item (different ID), handle both items
        if (currentIdNumber !== new_id_number) {
          console.log(`🔄 Changing from item ${currentIdNumber} to item ${new_id_number}`);
          
          // Return quantity to old item's stock
          await conn.execute(
            'UPDATE tbl_stock SET QTY = QTY + ? WHERE ID = ?', 
            [currentWarehouseQty, currentIdNumber]
          );
          console.log(`📦 Returned ${currentWarehouseQty} to stock item ${currentIdNumber}`);
          
          // Take quantity from new item's stock
          await conn.execute(
            'UPDATE tbl_stock SET QTY = QTY - ? WHERE ID = ?', 
            [qty, new_id_number]
          );
          console.log(`📦 Took ${qty} from stock item ${new_id_number}`);
        } else {
          // Same item, just adjust quantity
          await conn.execute(
            'UPDATE tbl_stock SET QTY = QTY + ? WHERE ID = ?', 
            [stockAdjustment, new_id_number]
          );
          console.log(`📦 Adjusted stock for item ${new_id_number} by ${stockAdjustment}`);
        }
      } else {
        console.log(`📦 No stock adjustment needed (same item, same quantity)`);
      }
      
      await conn.commit();
      console.log(`✅ Transaction committed successfully`);
      
      // Log discrepancy when any field changes (ID/Qty/Price) and always require a reason from UI
      const changed = (currentIdNumber !== new_id_number) || (currentWarehouseQty !== qty) || (Number(currentUnitPrice) !== Number(effectiveUnitPrice));
      if (changed) {
        await pool.execute(`
          INSERT INTO warehouse_discrepancies (
            order_id, warehouse_no, old_stock_id, new_stock_id, old_qty, new_qty, old_price, new_price, reason, notes, user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [currentOrderId, Number(id), currentIdNumber, new_id_number, currentWarehouseQty, qty, currentUnitPrice, effectiveUnitPrice, (discrepancy_reason || 'other'), (discrepancy_notes || null), req.user.id]);
      }

      // Reset verification for this item (must re-verify)
      await pool.execute('INSERT INTO warehouse_verifications (warehouse_no, order_id, verified, verified_by, verified_at) VALUES (?, ?, 0, NULL, NULL) ON DUPLICATE KEY UPDATE verified = 0, verified_by = NULL, verified_at = NULL', [Number(id), currentOrderId]);

    } catch (error) {
      await conn.rollback();
      console.error('❌ Transaction rolled back:', error);
      throw error;
    } finally {
      conn.release();
    }
    
    console.log(`✅ Warehouse item ${id} updated successfully`);
    
    // Return the updated item with all details
    res.json({
      success: true,
      message: 'Warehouse item updated successfully',
      item: {
        no: id,
        id_number: new_id_number,
        qty: qty,
        part_no: itemDetails.benz_number,
        description: itemDetails.description,
        unit_price: effectiveUnitPrice,
        location: itemDetails.location,
        brand: itemDetails.brand,
        alt_number: itemDetails.alt_number
      }
    });
    
  } catch (error) {
    console.error('❌ Update warehouse item error:', error);
    res.status(500).json({ 
      error: 'Failed to update warehouse item', 
      message: error.message 
    });
  }
});

// ==================== QUOTATION APIs ====================

// Get next quotation number
app.get('/api/quotations/next-number', authenticateToken, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Get the next quotation number using sequence table
      const [sequenceResult] = await conn.execute(
        'SELECT next_quotation_number FROM quotation_sequence WHERE id = 1 FOR UPDATE'
      );
      
      if (sequenceResult.length === 0) {
        // Initialize sequence if it doesn't exist
        await conn.execute(
          'INSERT INTO quotation_sequence (id, next_quotation_number) VALUES (1, 1)'
        );
        var nextQuotationNumber = 1;
      } else {
        var nextQuotationNumber = sequenceResult[0].next_quotation_number;
      }
      
      await conn.commit();
      conn.release();
      
      console.log(`📋 Next quotation number: ${nextQuotationNumber}`);
      res.json({ next_quotation_number: nextQuotationNumber });
      
    } catch (error) {
      await conn.rollback();
      conn.release();
      throw error;
    }
  } catch (error) {
    console.error('❌ Get next quotation number error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a new quotation
app.post('/api/quotations', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { customer_name, chassis_number, contact_number, cartItems } = req.body;
    
    if (!customer_name || !cartItems || cartItems.length === 0) {
      return res.status(400).json({ message: 'Customer name and cart items are required' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Get and increment the next quotation number
      const [sequenceResult] = await conn.execute(
        'SELECT next_quotation_number FROM quotation_sequence WHERE id = 1 FOR UPDATE'
      );
      
      const nextQuotationNumber = sequenceResult[0].next_quotation_number;
      const quotationNumber = `QOU-${nextQuotationNumber.toString().padStart(3, '0')}`;
      
      // Increment the sequence for next time
      await conn.execute(
        'UPDATE quotation_sequence SET next_quotation_number = next_quotation_number + 1 WHERE id = 1'
      );
      
      // Calculate expiry date (20 days from now)
      const quotationDate = new Date();
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 20);
      
      // Calculate total amount
      let totalAmount = 0;
      for (const item of cartItems) {
        const [stockResult] = await conn.execute(
          'SELECT SELL FROM tbl_stock WHERE ID = ?', [item.stock_id]
        );
        if (stockResult.length > 0) {
          totalAmount += (stockResult[0].SELL || 0) * item.quantity;
        }
      }
      
      // Insert quotation
      const [quotationResult] = await conn.execute(
        `INSERT INTO quotations (quotation_number, customer_name, chassis_number, contact_number, 
         quotation_date, expiry_date, total_amount, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [quotationNumber, customer_name, chassis_number || null, contact_number || null, 
         quotationDate, expiryDate, totalAmount, user_id]
      );
      
      const quotationId = quotationResult.insertId;
      
      // Insert quotation items
      for (const item of cartItems) {
        const [stockResult] = await conn.execute(
          'SELECT SELL FROM tbl_stock WHERE ID = ?', [item.stock_id]
        );
        const unitPrice = stockResult.length > 0 ? (stockResult[0].SELL || 0) : 0;
        const totalPrice = unitPrice * item.quantity;
        
        await conn.execute(
          `INSERT INTO quotation_items (quotation_id, stock_id, quantity, unit_price, total_price) 
           VALUES (?, ?, ?, ?, ?)`,
          [quotationId, item.stock_id, item.quantity, unitPrice, totalPrice]
        );
      }
      
      await conn.commit();
      conn.release();
      
      console.log(`✅ Quotation ${quotationNumber} created successfully with ${cartItems.length} items`);
      res.json({ 
        success: true, 
        quotation_id: quotationId,
        quotation_number: quotationNumber,
        total_amount: totalAmount
      });
      
    } catch (error) {
      await conn.rollback();
      conn.release();
      throw error;
    }
  } catch (error) {
    console.error('❌ Create quotation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all quotations with pagination
app.get('/api/quotations', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || 'all';
    const search = req.query.search || '';
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    let baseParams = [];
    
    if (status !== 'all') {
      whereClause += ' WHERE status = ?';
      baseParams.push(status);
    }
    
    if (search) {
      const searchParam = `%${search}%`;
      if (whereClause) {
        whereClause += ' AND (quotation_number LIKE ? OR customer_name LIKE ? OR chassis_number LIKE ?)';
      } else {
        whereClause = ' WHERE (quotation_number LIKE ? OR customer_name LIKE ? OR chassis_number LIKE ?)';
      }
      baseParams.push(searchParam, searchParam, searchParam);
    }
    
    // Get total count (without limit/offset)
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM quotations ${whereClause}`,
      baseParams
    );
    const total = countResult[0].total;
    
    // Create separate params array for main query with limit/offset
    const mainParams = [...baseParams, limit, offset];
    
    // Get quotations with user info
    const [quotations] = await pool.execute(
      `SELECT q.*, u.username as created_by_name 
       FROM quotations q 
       LEFT JOIN users u ON q.created_by = u.id${whereClause}
       ORDER BY q.created_at DESC 
       LIMIT ${limit} OFFSET ${offset}`,
      baseParams
    );
    
    res.json({
      data: quotations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('❌ Get quotations error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get quotation details with items
app.get('/api/quotations/:id', authenticateToken, async (req, res) => {
  try {
    const quotationId = req.params.id;
    
    // Get quotation details
    const [quotationResult] = await pool.execute(
      `SELECT q.*, u.username as created_by_name 
       FROM quotations q 
       LEFT JOIN users u ON q.created_by = u.id 
       WHERE q.id = ?`,
      [quotationId]
    );
    
    if (quotationResult.length === 0) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    
    // Get quotation items with stock details
    const [itemsResult] = await pool.execute(
      `SELECT qi.*, ts.BENZ, ts.BRAND, ts.ALTNO, ts.REMARKS, 
              COALESCE(loc.location_code, 'Location not indicated') as LOCATION,
              COALESCE(m.DESC, ts.REMARKS) as DESCRIPTION
       FROM quotation_items qi
       LEFT JOIN tbl_stock ts ON qi.stock_id = ts.ID
       LEFT JOIN master m ON ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND
       LEFT JOIN location loc ON qi.stock_id = loc.id
       WHERE qi.quotation_id = ?
       ORDER BY qi.id`,
      [quotationId]
    );
    
    res.json({
      quotation: quotationResult[0],
      items: itemsResult
    });
  } catch (error) {
    console.error('❌ Get quotation details error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update quotation details
app.put('/api/quotations/:id', authenticateToken, async (req, res) => {
  try {
    const quotationId = req.params.id;
    const { customer_name, chassis_number, contact_number, status } = req.body;
    
    if (!customer_name) {
      return res.status(400).json({ message: 'Customer name is required' });
    }
    
    const [result] = await pool.execute(
      'UPDATE quotations SET customer_name = ?, chassis_number = ?, contact_number = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [customer_name, chassis_number || null, contact_number || null, status || 'pending', quotationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    
    res.json({ success: true, message: 'Quotation updated successfully' });
  } catch (error) {
    console.error('❌ Update quotation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete quotation
app.delete('/api/quotations/:id', authenticateToken, async (req, res) => {
  try {
    const quotationId = req.params.id;
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Check if quotation exists
      const [quotationResult] = await conn.execute(
        'SELECT * FROM quotations WHERE id = ?',
        [quotationId]
      );
      
      if (quotationResult.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: 'Quotation not found' });
      }
      
      // Delete quotation items first (due to foreign key constraint)
      await conn.execute(
        'DELETE FROM quotation_items WHERE quotation_id = ?',
        [quotationId]
      );
      
      // Delete quotation
      await conn.execute(
        'DELETE FROM quotations WHERE id = ?',
        [quotationId]
      );
      
      await conn.commit();
      conn.release();
      
      res.json({ success: true, message: 'Quotation deleted successfully' });
    } catch (error) {
      await conn.rollback();
      conn.release();
      throw error;
    }
  } catch (error) {
    console.error('❌ Delete quotation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update quotation item quantity
app.put('/api/quotations/:id/items/:itemId', authenticateToken, async (req, res) => {
  try {
    const quotationId = req.params.id;
    const itemId = req.params.itemId;
    const { quantity } = req.body;
    
    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: 'Valid quantity is required' });
    }
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Get current item details
      const [itemResult] = await conn.execute(
        'SELECT * FROM quotation_items WHERE id = ? AND quotation_id = ?',
        [itemId, quotationId]
      );
      
      if (itemResult.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: 'Quotation item not found' });
      }
      
      const item = itemResult[0];
      const newTotalPrice = item.unit_price * quantity;
      
      // Update item quantity and total price
      await conn.execute(
        'UPDATE quotation_items SET quantity = ?, total_price = ? WHERE id = ?',
        [quantity, newTotalPrice, itemId]
      );
      
      // Recalculate quotation total
      const [itemsResult] = await conn.execute(
        'SELECT SUM(total_price) as total FROM quotation_items WHERE quotation_id = ?',
        [quotationId]
      );
      
      const newTotal = itemsResult[0].total || 0;
      
      await conn.execute(
        'UPDATE quotations SET total_amount = ? WHERE id = ?',
        [newTotal, quotationId]
      );
      
      await conn.commit();
      conn.release();
      
      res.json({ 
        success: true, 
        message: 'Item updated successfully',
        newTotal: newTotal
      });
    } catch (error) {
      await conn.rollback();
      conn.release();
      throw error;
    }
  } catch (error) {
    console.error('❌ Update quotation item error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove quotation item
app.delete('/api/quotations/:id/items/:itemId', authenticateToken, async (req, res) => {
  try {
    const quotationId = req.params.id;
    const itemId = req.params.itemId;
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Check if item exists
      const [itemResult] = await conn.execute(
        'SELECT * FROM quotation_items WHERE id = ? AND quotation_id = ?',
        [itemId, quotationId]
      );
      
      if (itemResult.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: 'Quotation item not found' });
      }
      
      // Delete the item
      await conn.execute(
        'DELETE FROM quotation_items WHERE id = ?',
        [itemId]
      );
      
      // Recalculate quotation total
      const [itemsResult] = await conn.execute(
        'SELECT SUM(total_price) as total FROM quotation_items WHERE quotation_id = ?',
        [quotationId]
      );
      
      const newTotal = itemsResult[0].total || 0;
      
      await conn.execute(
        'UPDATE quotations SET total_amount = ? WHERE id = ?',
        [newTotal, quotationId]
      );
      
      await conn.commit();
      conn.release();
      
      res.json({ 
        success: true, 
        message: 'Item removed successfully',
        newTotal: newTotal
      });
    } catch (error) {
      await conn.rollback();
      conn.release();
      throw error;
    }
  } catch (error) {
    console.error('❌ Remove quotation item error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Search stock items for adding to quotation
app.get('/api/quotations/:id/search-stock', authenticateToken, async (req, res) => {
  try {
    const quotationId = req.params.id;
    const searchTerm = req.query.search || '';
    const limit = parseInt(req.query.limit) || 20;
    
    // Check if quotation exists
    const [quotationResult] = await pool.execute(
      'SELECT * FROM quotations WHERE id = ?',
      [quotationId]
    );
    
    if (quotationResult.length === 0) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    
    // Search stock items
    let whereClause = '';
    let params = [];
    
    if (searchTerm) {
      const searchWithoutSpaces = searchTerm.replace(/\s+/g, '');
      whereClause = 'WHERE (ts.ID LIKE ? OR ts.BENZ LIKE ? OR ts.BRAND LIKE ? OR ts.ALTNO LIKE ? OR ts.REMARKS LIKE ? OR m.DESC LIKE ? OR REPLACE(ts.BENZ, " ", "") LIKE ? OR REPLACE(ts.BRAND, " ", "") LIKE ? OR REPLACE(ts.ALTNO, " ", "") LIKE ? OR REPLACE(ts.REMARKS, " ", "") LIKE ? OR REPLACE(m.DESC, " ", "") LIKE ?)';
      const searchParam = `%${searchTerm}%`;
      const searchParamNoSpaces = `%${searchWithoutSpaces}%`;
      params = [searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces, searchParamNoSpaces];
    }
    
    const [stockItems] = await pool.execute(
      `SELECT ts.ID, ts.BENZ, ts.BRAND, ts.ALTNO, ts.REMARKS, ts.SELL, ts.QTY, 
              COALESCE(loc.location_code, 'Location not indicated') as LOCATION,
              COALESCE(m.DESC, ts.REMARKS) as DESCRIPTION
       FROM tbl_stock ts
       LEFT JOIN master m ON ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND
       LEFT JOIN location loc ON ts.ID = loc.id
       ${whereClause}
       ORDER BY ts.ID 
       LIMIT ${limit}`,
      params
    );
    
    res.json({ items: stockItems });
  } catch (error) {
    console.error('❌ Search stock items error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add new item to quotation
app.post('/api/quotations/:id/items', authenticateToken, async (req, res) => {
  try {
    const quotationId = req.params.id;
    const { stock_id, quantity } = req.body;
    
    if (!stock_id || !quantity || quantity < 1) {
      return res.status(400).json({ message: 'Valid stock ID and quantity are required' });
    }
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Check if quotation exists
      const [quotationResult] = await conn.execute(
        'SELECT * FROM quotations WHERE id = ?',
        [quotationId]
      );
      
      if (quotationResult.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: 'Quotation not found' });
      }
      
      // Check if item already exists in quotation
      const [existingItem] = await conn.execute(
        'SELECT * FROM quotation_items WHERE quotation_id = ? AND stock_id = ?',
        [quotationId, stock_id]
      );
      
      if (existingItem.length > 0) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ message: 'Item already exists in this quotation' });
      }
      
      // Get stock item details
      const [stockResult] = await conn.execute(
        'SELECT SELL FROM tbl_stock WHERE ID = ?',
        [stock_id]
      );
      
      if (stockResult.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: 'Stock item not found' });
      }
      
      const unitPrice = stockResult[0].SELL || 0;
      const totalPrice = unitPrice * quantity;
      
      // Add item to quotation
      await conn.execute(
        'INSERT INTO quotation_items (quotation_id, stock_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
        [quotationId, stock_id, quantity, unitPrice, totalPrice]
      );
      
      // Recalculate quotation total
      const [itemsResult] = await conn.execute(
        'SELECT SUM(total_price) as total FROM quotation_items WHERE quotation_id = ?',
        [quotationId]
      );
      
      const newTotal = itemsResult[0].total || 0;
      
      await conn.execute(
        'UPDATE quotations SET total_amount = ? WHERE id = ?',
        [newTotal, quotationId]
      );
      
      await conn.commit();
      conn.release();
      
      res.json({ 
        success: true, 
        message: 'Item added successfully',
        newTotal: newTotal
      });
    } catch (error) {
      await conn.rollback();
      conn.release();
      throw error;
    }
  } catch (error) {
    console.error('❌ Add item to quotation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update quotation status
app.put('/api/quotations/:id/status', authenticateToken, async (req, res) => {
  try {
    const quotationId = req.params.id;
    const { status } = req.body;
    
    if (!['pending', 'approved', 'converted', 'expired'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const [result] = await pool.execute(
      'UPDATE quotations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, quotationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    
    res.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    console.error('❌ Update quotation status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Convert quotation to warehouse order
app.post('/api/quotations/:id/convert-to-order', authenticateToken, async (req, res) => {
  try {
    const quotationId = req.params.id;
    const user_id = req.user.id;
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Get quotation details
      const [quotationResult] = await conn.execute(
        'SELECT * FROM quotations WHERE id = ? AND status = "approved"',
        [quotationId]
      );
      
      if (quotationResult.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: 'Approved quotation not found' });
      }
      
      // Get quotation items
      const [itemsResult] = await conn.execute(
        'SELECT * FROM quotation_items WHERE quotation_id = ?',
        [quotationId]
      );
      
      // Get next order number
      const [sequenceResult] = await conn.execute(
        'SELECT next_order_number FROM order_sequence WHERE id = 1 FOR UPDATE'
      );
      
      const nextOrderNumber = sequenceResult[0].next_order_number;
      
      // Increment order sequence
      await conn.execute(
        'UPDATE order_sequence SET next_order_number = next_order_number + 1 WHERE id = 1'
      );
      
      const orderId = nextOrderNumber.toString();
      
      // Process each item (deduct from stock and add to warehouse)
      for (const item of itemsResult) {
        // Check stock availability
        const [stockResult] = await conn.execute(
          'SELECT QTY FROM tbl_stock WHERE ID = ?',
          [item.stock_id]
        );
        
        if (stockResult.length === 0 || stockResult[0].QTY < item.quantity) {
          await conn.rollback();
          conn.release();
          return res.status(400).json({ 
            message: `Insufficient stock for item ID ${item.stock_id}` 
          });
        }
        
        // Deduct from stock
        await conn.execute(
          'UPDATE tbl_stock SET QTY = QTY - ? WHERE ID = ?',
          [item.quantity, item.stock_id]
        );
        
        // Get stock details for warehouse entry
        const [stockDetails] = await conn.execute(
          `SELECT ts.BENZ, ts.BRAND, ts.ALTNO, ts.REMARKS, ts.SELL, ts.LOCATION,
                  COALESCE(m.DESC, ts.REMARKS) as DESCRIPTION
           FROM tbl_stock ts
           LEFT JOIN master m ON ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND
           WHERE ts.ID = ?`,
          [item.stock_id]
        );
        
        if (stockDetails.length > 0) {
          const stock = stockDetails[0];
          await conn.execute(
            `INSERT INTO warehouse (order_id, user_id, id_number, qty, part_no, brand, altno, description, unit_price, location) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderId, user_id, item.stock_id, item.quantity, stock.BENZ, stock.BRAND, stock.ALTNO, stock.DESCRIPTION, stock.SELL, stock.LOCATION]
          );
        }
      }
      
      // Update quotation status to converted
      await conn.execute(
        'UPDATE quotations SET status = "converted", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [quotationId]
      );
      
      await conn.commit();
      conn.release();
      
      console.log(`✅ Quotation ${quotationId} converted to order ${orderId}`);
      res.json({ 
        success: true, 
        order_id: orderId,
        message: 'Quotation converted to order successfully'
      });
      
    } catch (error) {
      await conn.rollback();
      conn.release();
      throw error;
    }
  } catch (error) {
    console.error('❌ Convert quotation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Auto-expire quotations (can be called by cron job or manually)
app.post('/api/quotations/expire', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.execute(
      'UPDATE quotations SET status = "expired" WHERE status != "expired" AND expiry_date < NOW()'
    );
    
    console.log(`✅ Expired ${result.affectedRows} quotations`);
    res.json({ 
      success: true, 
      expired_count: result.affectedRows,
      message: `${result.affectedRows} quotations expired`
    });
  } catch (error) {
    console.error('❌ Expire quotations error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== END QUOTATION APIs ====================

// Auto-expire quotations every hour
setInterval(async () => {
  try {
    const [result] = await pool.execute(
      'UPDATE quotations SET status = "expired" WHERE status != "expired" AND expiry_date < NOW()'
    );
    
    if (result.affectedRows > 0) {
      console.log(`🕐 Auto-expired ${result.affectedRows} quotations`);
    }
  } catch (error) {
    console.error('❌ Auto-expiry error:', error.message);
  }
}, 60 * 60 * 1000); // Run every hour

// Get next order number for cart (without submitting)
app.get('/api/warehouse/next-order-number', authenticateToken, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Get the next order number using sequence table (proper auto-increment)
      const [sequenceResult] = await conn.execute(
        'SELECT next_order_number FROM order_sequence WHERE id = 1 FOR UPDATE'
      );
      
      if (sequenceResult.length === 0) {
        // Initialize sequence if it doesn't exist
        await conn.execute(
          'INSERT INTO order_sequence (id, next_order_number) VALUES (1, 1)'
        );
        var nextOrderNumber = 1;
      } else {
        var nextOrderNumber = sequenceResult[0].next_order_number;
      }
      
      await conn.commit();
      conn.release();
      
      console.log(`📋 Next order number: ${nextOrderNumber}`);
      res.json({ next_order_number: nextOrderNumber });
      
    } catch (error) {
      await conn.rollback();
      conn.release();
      throw error;
    }
  } catch (error) {
    console.error('❌ Get next order number error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Submit items to warehouse (deduct from tbl_stock.QTY)
app.post('/api/warehouse/submit', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    let order_id; // Declare order_id at function level
    
    // Get the next order number using sequence table (proper auto-increment)
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Get and increment the next order number atomically
      const [sequenceResult] = await conn.execute(
        'SELECT next_order_number FROM order_sequence WHERE id = 1 FOR UPDATE'
      );
      
      if (sequenceResult.length === 0) {
        // Initialize sequence if it doesn't exist
        await conn.execute(
          'INSERT INTO order_sequence (id, next_order_number) VALUES (1, 1)'
        );
        var nextOrderNumber = 1;
      } else {
        var nextOrderNumber = sequenceResult[0].next_order_number;
      }
      
      // Increment the sequence for next time
      await conn.execute(
        'UPDATE order_sequence SET next_order_number = next_order_number + 1 WHERE id = 1'
      );
      
      await conn.commit();
      order_id = nextOrderNumber.toString(); // Assign to function-level variable
      
      console.log(`📋 Generated new order number: ${order_id}`);
      
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
    
                const cartItems = req.body.cartItems; // Expecting [{stock_id, quantity}, ...] from frontend
      const customer_name = req.body.customer_name || null; // Get customer name from request body
      console.log('[WAREHOUSE SUBMIT] user_id:', user_id, 'cartItems:', cartItems, 'customer_name:', customer_name);
      
      // Validate customer name is provided
      if (!customer_name || !customer_name.trim()) {
        return res.status(400).json({ message: 'Customer name is required to send order to warehouse.' });
      }
      
      // Check for duplicate stock_ids in cart
    const stockIds = cartItems.map(item => item.stock_id);
    const uniqueStockIds = [...new Set(stockIds)];
    if (stockIds.length !== uniqueStockIds.length) {
      console.log('[WAREHOUSE SUBMIT] WARNING: Duplicate stock_ids found in cart:', stockIds);
      console.log('[WAREHOUSE SUBMIT] Unique stock_ids:', uniqueStockIds);
    }
    
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ message: 'No items in cart to submit' });
    }
    
    const warehouseConn = await pool.getConnection();
    try {
      await warehouseConn.beginTransaction();
      
      // Check all items have enough stock
      const insufficient = [];
      for (const item of cartItems) {
        console.log(`[WAREHOUSE SUBMIT] Checking stock for ID: ${item.stock_id}, quantity: ${item.quantity}`);
        const [[stock]] = await warehouseConn.query('SELECT QTY FROM tbl_stock WHERE ID = ?', [item.stock_id]);
        console.log(`[WAREHOUSE SUBMIT] Stock found:`, stock);
        if (!stock || stock.QTY < item.quantity) {
          console.log(`[WAREHOUSE SUBMIT] Insufficient stock for ID ${item.stock_id}: requested ${item.quantity}, available ${stock ? stock.QTY : 0}`);
          insufficient.push({ 
            stock_id: item.stock_id, 
            requested: item.quantity, 
            available: stock ? stock.QTY : 0 
          });
        }
      }
      
      if (insufficient.length > 0) {
        await warehouseConn.rollback();
        warehouseConn.release();
        console.log('[WAREHOUSE SUBMIT] Insufficient stock:', insufficient);
        return res.status(409).json({ 
          message: 'Some items are no longer available or have insufficient stock.', 
          insufficient 
        });
      }
      
      // Deduct quantities from tbl_stock and insert into warehouse
      for (const item of cartItems) {
        // Get stock details for the warehouse entry
        const [[stockDetails]] = await warehouseConn.query(`
          SELECT ts.QTY, ts.SELL, ts.BENZ, ts.BRAND, ts.ALTNO, ts.REMARKS, ts.LOCATION,
                 COALESCE(
                   (SELECT m.DESC FROM master m 
                    WHERE ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ 
                    AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND 
                    LIMIT 1), 
                   ts.REMARKS
                 ) as DESCRIPTION
          FROM tbl_stock ts
          WHERE ts.ID = ?
        `, [item.stock_id]);
        
        console.log('[WAREHOUSE SUBMIT] Stock details for ID', item.stock_id, ':', stockDetails);
        
        // Check if this item already exists in this order
        const [existingItem] = await warehouseConn.query(
          'SELECT no FROM warehouse WHERE order_id = ? AND id_number = ?',
          [order_id, item.stock_id]
        );
        
        console.log(`[WAREHOUSE SUBMIT] Checking for existing item ${item.stock_id} in order ${order_id}:`, existingItem.length, 'found');
        
        if (existingItem.length > 0) {
          console.log(`[WAREHOUSE SUBMIT] WARNING: Item with ID ${item.stock_id} already exists in order ${order_id}, skipping duplicate`);
          continue;
        }
        
        // Deduct from tbl_stock
        await warehouseConn.query('UPDATE tbl_stock SET QTY = QTY - ? WHERE ID = ?', [item.quantity, item.stock_id]);
        
                  // Insert into warehouse with locked price from cart
          const lockedPrice = item.custom_price || item.price || stockDetails.SELL || 0;
          console.log(`[WAREHOUSE SUBMIT] Inserting item ${item.stock_id} with locked price: ${lockedPrice} (original: ${stockDetails.SELL})`);
          // Check if customer_name column exists, if not, insert without it
          try {
            await warehouseConn.query(
              'INSERT INTO warehouse (order_id, user_id, id_number, qty, part_no, brand, altno, description, unit_price, location, customer_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [order_id, user_id, item.stock_id, item.quantity, stockDetails.BENZ || null, stockDetails.BRAND || null, stockDetails.ALTNO || null, stockDetails.DESCRIPTION || null, lockedPrice, stockDetails.LOCATION || null, customer_name]
            );
          } catch (insertError) {
            // If customer_name column doesn't exist, try without it
            if (insertError.code === 'ER_BAD_FIELD_ERROR' && insertError.sqlMessage && insertError.sqlMessage.includes('customer_name')) {
              console.log('[WAREHOUSE SUBMIT] customer_name column not found, inserting without it. Please add customer_name column to warehouse table.');
              await warehouseConn.query(
                'INSERT INTO warehouse (order_id, user_id, id_number, qty, part_no, brand, altno, description, unit_price, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [order_id, user_id, item.stock_id, item.quantity, stockDetails.BENZ || null, stockDetails.BRAND || null, stockDetails.ALTNO || null, stockDetails.DESCRIPTION || null, lockedPrice, stockDetails.LOCATION || null]
              );
            } else {
              throw insertError;
            }
          }
      }
      
      await warehouseConn.commit();
      warehouseConn.release();
      
      console.log(`✅ Warehouse order ${order_id} submitted successfully with ${cartItems.length} items`);
      
      // Emit WebSocket update
      emitOrderCountsUpdate();
      
      res.json({ success: true, order_id });
      
    } catch (err) {
      await warehouseConn.rollback();
      warehouseConn.release();
      console.error('[WAREHOUSE SUBMIT ERROR - INNER]', err.stack || err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  } catch (error) {
    console.error('[WAREHOUSE SUBMIT ERROR - OUTER]', error.stack || error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add items to existing warehouse order
app.post('/api/warehouse/add-to-order', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { order_id, cartItems } = req.body;
    
    if (!order_id) {
      return res.status(400).json({ message: 'Order ID is required' });
    }
    
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ message: 'No items in cart to add' });
    }
    
    // Get customer_name from existing order
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Get customer_name from the first item in the existing order
      const [[existingOrderItem]] = await conn.query(
        'SELECT customer_name FROM warehouse WHERE order_id = ? LIMIT 1',
        [order_id]
      );
      
      if (!existingOrderItem) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: 'Order not found' });
      }
      
      const customer_name = existingOrderItem.customer_name || null;
      
      // Check for duplicate stock_ids in cart
      const stockIds = cartItems.map(item => item.stock_id);
      const uniqueStockIds = [...new Set(stockIds)];
      if (stockIds.length !== uniqueStockIds.length) {
        console.log('[ADD TO ORDER] WARNING: Duplicate stock_ids found in cart:', stockIds);
      }
      
      // Check all items have enough stock
      const insufficient = [];
      for (const item of cartItems) {
        const [[stock]] = await conn.query('SELECT QTY FROM tbl_stock WHERE ID = ?', [item.stock_id]);
        if (!stock || stock.QTY < item.quantity) {
          insufficient.push({ 
            stock_id: item.stock_id, 
            requested: item.quantity, 
            available: stock ? stock.QTY : 0 
          });
        }
      }
      
      if (insufficient.length > 0) {
        await conn.rollback();
        conn.release();
        return res.status(409).json({ 
          message: 'Some items are no longer available or have insufficient stock.', 
          insufficient 
        });
      }
      
      // Deduct quantities from tbl_stock and insert into warehouse
      let addedCount = 0;
      for (const item of cartItems) {
        // Get stock details for the warehouse entry
        const [[stockDetails]] = await conn.query(`
          SELECT ts.QTY, ts.SELL, ts.BENZ, ts.BRAND, ts.ALTNO, ts.REMARKS, ts.LOCATION,
                 COALESCE(
                   (SELECT m.DESC FROM master m 
                    WHERE ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ 
                    AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND 
                    LIMIT 1), 
                   ts.REMARKS
                 ) as DESCRIPTION
          FROM tbl_stock ts
          WHERE ts.ID = ?
        `, [item.stock_id]);
        
        if (!stockDetails) {
          console.warn(`[ADD TO ORDER] Stock item with ID ${item.stock_id} not found, skipping...`);
          continue;
        }
        
        // Check if this item already exists in this order
        const [existingItem] = await conn.query(
          'SELECT no FROM warehouse WHERE order_id = ? AND id_number = ?',
          [order_id, item.stock_id]
        );
        
        if (existingItem.length > 0) {
          console.log(`[ADD TO ORDER] Item with ID ${item.stock_id} already exists in order ${order_id}, skipping duplicate`);
          continue;
        }
        
        // Deduct from tbl_stock
        await conn.query('UPDATE tbl_stock SET QTY = QTY - ? WHERE ID = ?', [item.quantity, item.stock_id]);
        
        // Insert into warehouse with locked price from cart
        const lockedPrice = item.custom_price || item.price || stockDetails.SELL || 0;
        
        // Try to insert with customer_name, fallback if column doesn't exist
        try {
          await conn.query(
            'INSERT INTO warehouse (order_id, user_id, id_number, qty, part_no, brand, altno, description, unit_price, location, customer_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [order_id, user_id, item.stock_id, item.quantity, stockDetails.BENZ || null, stockDetails.BRAND || null, stockDetails.ALTNO || null, stockDetails.DESCRIPTION || null, lockedPrice, stockDetails.LOCATION || null, customer_name]
          );
        } catch (insertError) {
          // If customer_name column doesn't exist, try without it
          if (insertError.code === 'ER_BAD_FIELD_ERROR' && insertError.sqlMessage && insertError.sqlMessage.includes('customer_name')) {
            await conn.query(
              'INSERT INTO warehouse (order_id, user_id, id_number, qty, part_no, brand, altno, description, unit_price, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [order_id, user_id, item.stock_id, item.quantity, stockDetails.BENZ || null, stockDetails.BRAND || null, stockDetails.ALTNO || null, stockDetails.DESCRIPTION || null, lockedPrice, stockDetails.LOCATION || null]
            );
          } else {
            throw insertError;
          }
        }
        
        addedCount++;
      }
      
      await conn.commit();
      conn.release();
      
      console.log(`✅ Added ${addedCount} item(s) to warehouse order ${order_id}`);
      
      // Emit WebSocket update
      emitOrderCountsUpdate();
      
      res.json({ 
        success: true, 
        order_id,
        added_count: addedCount,
        message: `Successfully added ${addedCount} item(s) to Order #${order_id}`
      });
      
    } catch (err) {
      await conn.rollback();
      conn.release();
      console.error('[ADD TO ORDER ERROR]', err.stack || err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  } catch (error) {
    console.error('[ADD TO ORDER ERROR - OUTER]', error.stack || error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Cancel or return an order (by order_id)
app.post('/api/warehouse/order/cancel', authenticateToken, async (req, res) => {
  try {
    const { order_id, reason } = req.body;
    if (!order_id) return res.status(400).json({ message: 'Order ID required' });
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Get all items in the order with their quantities
      const [items] = await conn.query('SELECT id_number, qty FROM warehouse WHERE order_id = ?', [order_id]);
      
      if (items.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: 'No items found for this order' });
      }
      
      // Restore stock quantities for each item
      for (const item of items) {
        await conn.query('UPDATE tbl_stock SET QTY = QTY + ? WHERE ID = ?', [item.qty, item.id_number]);
      }
      
      // Delete the warehouse order (since we don't have status column)
      await conn.query('DELETE FROM warehouse WHERE order_id = ?', [order_id]);
      
      await conn.commit();
      conn.release();
      
      console.log(`✅ Order ${order_id} cancelled successfully. Returned ${items.length} items to stock.`);
      
      // Emit WebSocket update
      emitOrderCountsUpdate();
      
      res.json({ 
        success: true, 
        message: `Order cancelled successfully. ${items.length} items returned to stock.`,
        items_returned: items.length
      });
      
    } catch (err) {
      await conn.rollback();
      conn.release();
      console.error('❌ Cancel order error:', err);
      throw err;
    }
  } catch (error) {
    console.error('❌ Cancel order error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Fetch returned/cancelled orders (for notification)
app.get('/api/warehouse/orders/returned', authenticateToken, async (req, res) => {
  try {
    // Since warehouse table doesn't have status column, we'll return empty for now
    // This endpoint can be enhanced later if needed
    res.json([]);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all warehouse items with stock details
app.get('/api/warehouse/items', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Fetching warehouse items...');
    
    // First check if warehouse table has any data
    const [warehouseCount] = await pool.query('SELECT COUNT(*) as count FROM warehouse');
    console.log('📊 Total warehouse orders:', warehouseCount[0].count);
    
    if (warehouseCount[0].count === 0) {
      console.log('✅ No warehouse orders found - returning empty array');
      return res.json([]);
    }
    
      const sql = `
        SELECT 
          w.*,
          ts.ID as stock_item_id,
          ts.BENZ as benz_number,
          ts.BRAND as brand,
          ts.ALTNO as alt_number,
          ts.QTY as stock_qty,
          COALESCE(
            (SELECT m.DESC FROM master m 
             WHERE ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ 
             AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND 
             LIMIT 1), 
            ts.REMARKS
          ) as description,
          w.unit_price as selling_price,
          ts.LOCATION as location_code,
          COALESCE(loc.location_code, 'Location not indicated') as location,
        CONCAT(ts.BRAND, ' - ', COALESCE(
          (SELECT m.DESC FROM master m 
           WHERE ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ 
           AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND 
           LIMIT 1), 
          ts.REMARKS, 'No description'
        )) as PRODUCT_NAME,
        ts.ALTNO as PRODUCT_CODE
      FROM warehouse w
      JOIN tbl_stock ts ON w.id_number = ts.ID
      LEFT JOIN location loc ON w.id_number = loc.id
      ORDER BY w.created_at DESC
    `;
    
    console.log('🔍 Executing warehouse query...');
    const [rows] = await pool.query(sql);
    console.log(`✅ Warehouse query successful - found ${rows.length} items`);
    
    // Debug: Check for duplicate 'no' values in the result
    const noValues = rows.map(item => item.no);
    const uniqueNoValues = [...new Set(noValues)];
    console.log('🔍 API Debug - Total rows:', rows.length);
    console.log('🔍 API Debug - Unique no values:', uniqueNoValues.length);
    console.log('🔍 API Debug - All no values:', noValues);
    
    if (noValues.length !== uniqueNoValues.length) {
      console.error('⚠️ API DUPLICATE no VALUES FOUND!');
      const duplicates = noValues.filter((no, index) => noValues.indexOf(no) !== index);
      console.error('🔍 API Duplicate no values:', [...new Set(duplicates)]);
    }
    
    res.json(rows);
  } catch (error) {
    console.error('❌ Warehouse items error:', error);
    
    // More specific error messages
    if (error.code === 'ER_NO_SUCH_TABLE') {
      res.status(500).json({ message: 'Database table missing - please check database setup', error: error.message });
    } else if (error.code === 'ER_BAD_FIELD_ERROR') {
      res.status(500).json({ message: 'Database field error - please check table structure', error: error.message });
    } else {
      res.status(500).json({ message: 'Database query failed', error: error.message });
    }
  }
});

  // Verification APIs for warehouse
  app.get('/api/warehouse/verification/:order_id', authenticateToken, async (req, res) => {
    try {
      const { order_id } = req.params;
      const [rows] = await pool.execute('SELECT warehouse_no, verified, verified_by, verified_at FROM warehouse_verifications WHERE order_id = ?', [order_id]);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // Get verification status for multiple orders at once (optimized)
  app.post('/api/warehouse/verification/batch', authenticateToken, async (req, res) => {
    try {
      const { order_ids } = req.body;
      if (!Array.isArray(order_ids) || order_ids.length === 0) {
        return res.json({});
      }
      
      // Create placeholders for IN clause
      const placeholders = order_ids.map(() => '?').join(',');
      const [rows] = await pool.execute(
        `SELECT order_id, warehouse_no, verified, verified_by, verified_at 
         FROM warehouse_verifications 
         WHERE order_id IN (${placeholders})`,
        order_ids
      );
      
      // Group by order_id
      const result = {};
      rows.forEach(row => {
        if (!result[row.order_id]) {
          result[row.order_id] = [];
        }
        result[row.order_id].push(row);
      });
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

// Discrepancy reports
app.get('/api/warehouse/discrepancies', authenticateToken, async (req, res) => {
  try {
    const { start, end, reason, order_id } = req.query;
    const clauses = [];
    const params = [];
    if (order_id) { clauses.push('wd.order_id = ?'); params.push(order_id); }
    if (reason) { clauses.push('wd.reason = ?'); params.push(reason); }
    if (start) { clauses.push('wd.created_at >= ?'); params.push(start); }
    if (end) { clauses.push('wd.created_at <= ?'); params.push(end); }
    const where = clauses.length ? ('WHERE ' + clauses.join(' AND ')) : '';
    const [rows] = await pool.execute(`
      SELECT 
        wd.*,
        ts.BENZ as old_item_benz,
        ts.BRAND as old_item_brand,
        ts.ALTNO as old_item_altno,
        COALESCE(m.\`DESC\`, ts.REMARKS) as old_item_description
      FROM warehouse_discrepancies wd
      LEFT JOIN tbl_stock ts ON wd.old_stock_id = ts.ID
      LEFT JOIN master m ON ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ 
                           AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND
      ${where} 
      ORDER BY wd.created_at DESC 
      LIMIT 1000
    `, params);
    res.json(rows);
  } catch (error) {
    console.error('❌ Warehouse discrepancies API error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/warehouse/verify-item', authenticateToken, async (req, res) => {
  try {
    const { warehouse_no, order_id } = req.body;
    if (!warehouse_no || !order_id) return res.status(400).json({ message: 'warehouse_no and order_id required' });
    await pool.execute(
      'INSERT INTO warehouse_verifications (warehouse_no, order_id, verified, verified_by, verified_at) VALUES (?, ?, 1, ?, NOW()) ON DUPLICATE KEY UPDATE verified = 1, verified_by = ?, verified_at = NOW()',
      [warehouse_no, order_id, req.user.id, req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/warehouse/unverify-item', authenticateToken, async (req, res) => {
  try {
    const { warehouse_no } = req.body;
    if (!warehouse_no) return res.status(400).json({ message: 'warehouse_no required' });
    await pool.execute('UPDATE warehouse_verifications SET verified = 0, verified_by = NULL, verified_at = NULL WHERE warehouse_no = ?', [warehouse_no]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});



// API to send items from tbl_stock to warehouse
app.post('/api/stock/send-to-warehouse', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const cartItems = req.body.cartItems; // [{stock_id, quantity}]
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ message: 'No items in cart to send' });
    }
    const order_id = require('crypto').randomBytes(16).toString('hex');
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Check all items have enough stock
      for (const item of cartItems) {
        const [[stock]] = await conn.query('SELECT QTY FROM tbl_stock WHERE ID = ?', [item.stock_id]);
        if (!stock || stock.QTY < item.quantity) {
          await conn.rollback();
          conn.release();
          return res.status(409).json({ message: 'Insufficient stock for item', stock_id: item.stock_id });
        }
      }
      // Deduct from tbl_stock and insert into warehouse
      for (const item of cartItems) {
        // Get stock details for the warehouse entry
        const [[stockDetails]] = await conn.query(`
          SELECT ts.QTY, ts.SELL, ts.BENZ, ts.BRAND, ts.ALTNO, ts.REMARKS, ts.LOCATION,
                 COALESCE(m.DESC, ts.REMARKS) as DESCRIPTION
          FROM tbl_stock ts
          LEFT JOIN master m ON ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND
          WHERE ts.ID = ?
        `, [item.stock_id]);
        
        await conn.query('UPDATE tbl_stock SET QTY = QTY - ? WHERE ID = ?', [item.quantity, item.stock_id]);
        await conn.query('INSERT INTO warehouse (order_id, user_id, id_number, qty, part_no, brand, altno, description, unit_price, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [order_id, user_id, item.stock_id, item.quantity, stockDetails.BENZ || null, stockDetails.BRAND || null, stockDetails.ALTNO || null, stockDetails.REMARKS || null, stockDetails.SELL || 0, stockDetails.LOCATION || null]);
      }
      await conn.commit();
      conn.release();
      res.json({ success: true, order_id });
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

  // API to send items from warehouse to cashier
  app.post('/api/warehouse/send-to-cashier', authenticateToken, async (req, res) => {
    try {
      const user_id = req.user.id;
      const { order_id, items } = req.body; // items: [{warehouse_id, stock_id, quantity}]
      if (!order_id || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Order ID and items are required' });
      }
      // Gate: require all items verified
      const [[{ totalItems }]] = await pool.query('SELECT COUNT(*) as totalItems FROM warehouse WHERE order_id = ?', [order_id]);
      const [[{ verifiedItems }]] = await pool.query('SELECT COUNT(*) as verifiedItems FROM warehouse_verifications WHERE order_id = ? AND verified = 1', [order_id]);
      if (Number(verifiedItems) < Number(totalItems)) {
        return res.status(400).json({ message: 'Order is not fully verified. Please verify all items before sending to Cashier.', verifiedItems, totalItems });
      }
      // Get customer_name from warehouse order
      const [[customerInfo]] = await pool.query('SELECT customer_name FROM warehouse WHERE order_id = ? LIMIT 1', [order_id]);
      const customer_name = customerInfo ? customerInfo.customer_name : null;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Check all items exist in warehouse and have enough quantity
      for (const item of items) {
        const [[warehouseItem]] = await conn.query('SELECT qty FROM warehouse WHERE no = ? AND id_number = ? AND order_id = ?', [item.warehouse_id, item.stock_id, order_id]);
        if (!warehouseItem || warehouseItem.qty < item.quantity) {
          await conn.rollback();
          conn.release();
          return res.status(409).json({ message: 'Insufficient quantity in warehouse for item', warehouse_id: item.warehouse_id });
        }
      }
        // Deduct from warehouse and insert into cashier with locked price
        for (const item of items) {
          // Get the locked price from warehouse before deducting
          const [[warehouseItem]] = await conn.query('SELECT unit_price FROM warehouse WHERE no = ? AND id_number = ? AND order_id = ?', [item.warehouse_id, item.stock_id, order_id]);
          const lockedPrice = warehouseItem ? warehouseItem.unit_price : 0;
          
          await conn.query('UPDATE warehouse SET qty = qty - ? WHERE no = ? AND id_number = ? AND order_id = ?', [item.quantity, item.warehouse_id, item.stock_id, order_id]);
          // Insert customer_name into cashier table if column exists
          try {
            await conn.query('INSERT INTO cashier (order_id, user_id, stock_id, quantity, unit_price, status, customer_name, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [order_id, user_id, item.stock_id, item.quantity, lockedPrice, 'pending', customer_name, 'counter']);
          } catch (insertError) {
            // If customer_name column doesn't exist, insert without it
            if (insertError.code === 'ER_BAD_FIELD_ERROR' && insertError.sqlMessage && insertError.sqlMessage.includes('customer_name')) {
              await conn.query('INSERT INTO cashier (order_id, user_id, stock_id, quantity, unit_price, status, source) VALUES (?, ?, ?, ?, ?, ?, ?)', [order_id, user_id, item.stock_id, item.quantity, lockedPrice, 'pending', 'counter']);
            } else {
              throw insertError;
            }
          }
        }
      // Optionally, remove warehouse rows with zero quantity
      await conn.query('DELETE FROM warehouse WHERE qty <= 0');
      await conn.commit();
      conn.release();
      
      // Invalidate notification cache and emit WebSocket update
      invalidateNotificationCache();
      emitOrderCountsUpdate();
      
      res.json({ success: true, customer_name: customer_name });
      } catch (err) {
        await conn.rollback();
        conn.release();
        throw err;
      }
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // API to send items from warehouse to service
app.post('/api/warehouse/send-to-service', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    console.log('🔍 Raw request body:', req.body);
    const { order_id, items, requisition_number, customer_name, plate_number, repair_order_number } = req.body; // items: [{warehouse_id, stock_id, quantity}]
    
    console.log('🔍 Service submission request:', { order_id, items, requisition_number, customer_name, plate_number, repair_order_number });
    
    if (!order_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order ID and items are required' });
    }
    if (!requisition_number || !requisition_number.trim()) {
      console.log('❌ Missing requisition number:', requisition_number);
      return res.status(400).json({ message: 'Requisition number is required' });
    }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Check all items exist in warehouse and have enough quantity
      for (const item of items) {
        const [[warehouseItem]] = await conn.query('SELECT qty FROM warehouse WHERE no = ? AND id_number = ? AND order_id = ?', [item.warehouse_id, item.stock_id, order_id]);
        if (!warehouseItem || warehouseItem.qty < item.quantity) {
          await conn.rollback();
          conn.release();
          return res.status(409).json({ message: 'Insufficient quantity in warehouse for item', warehouse_id: item.warehouse_id });
        }
      }
      // Deduct from warehouse and insert into service with locked price
      for (const item of items) {
        // Get the locked price from warehouse before deducting
        const [[warehouseItem]] = await conn.query('SELECT unit_price FROM warehouse WHERE no = ? AND id_number = ? AND order_id = ?', [item.warehouse_id, item.stock_id, order_id]);
        const lockedPrice = warehouseItem ? warehouseItem.unit_price : 0;
        
        await conn.query('UPDATE warehouse SET qty = qty - ? WHERE no = ? AND id_number = ? AND order_id = ?', [item.quantity, item.warehouse_id, item.stock_id, order_id]);
        console.log('💾 Inserting service item with requisition, locked price, customer info, and repair order:', { order_id, stock_id: item.stock_id, quantity: item.quantity, requisition_number: requisition_number.trim(), lockedPrice, customer_name, plate_number, repair_order_number });
        console.log('🔍 Values being inserted:', [order_id, user_id, item.stock_id, item.quantity, lockedPrice, customer_name || null, plate_number || null, 'pending', requisition_number.trim(), repair_order_number || null]);
        const insertResult = await conn.query('INSERT INTO service (order_id, user_id, stock_id, quantity, unit_price, customer_name, plate_number, status, requisition_number, repair_order_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [order_id, user_id, item.stock_id, item.quantity, lockedPrice, customer_name || null, plate_number || null, 'pending', requisition_number.trim(), repair_order_number || null]);
        console.log('✅ Insert successful, insertId:', insertResult[0].insertId);
      }
      // Optionally, remove warehouse rows with zero quantity
      await conn.query('DELETE FROM warehouse WHERE qty <= 0');
      await conn.commit();
      conn.release();
      res.json({ success: true });
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// API to send items from service to cashier (if service needs the parts)
app.post('/api/service/send-to-cashier', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { order_id, items } = req.body; // items: [{service_id, stock_id, quantity}]
    if (!order_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order ID and items are required' });
    }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Check all items exist in service and have enough quantity
      for (const item of items) {
        const [[serviceItem]] = await conn.query('SELECT quantity FROM service WHERE id = ? AND stock_id = ? AND order_id = ?', [item.service_id, item.stock_id, order_id]);
        if (!serviceItem || serviceItem.quantity < item.quantity) {
          await conn.rollback();
          conn.release();
          return res.status(409).json({ message: 'Insufficient quantity in service for item', service_id: item.service_id });
        }
      }
      // Get customer info from service for this order (get all fields before any updates)
      // Use the first item's service_id to get the exact service record
      const firstItemServiceId = items[0]?.service_id;
      let customer_name = null;
      let plate_number = null;
      let repair_order_number = null;
      let requisition_number = null;
      let unit_price = null;
      
      if (firstItemServiceId) {
        const [[serviceInfo]] = await conn.query('SELECT customer_name, plate_number, repair_order_number, requisition_number, unit_price FROM service WHERE id = ? AND order_id = ? AND status = "pending"', [firstItemServiceId, order_id]);
        if (serviceInfo) {
          customer_name = serviceInfo.customer_name;
          plate_number = serviceInfo.plate_number;
          repair_order_number = serviceInfo.repair_order_number;
          requisition_number = serviceInfo.requisition_number;
          unit_price = serviceInfo.unit_price;
        }
      }
      
      // Fallback: if not found by service_id, try by order_id
      if (!customer_name && !requisition_number) {
        const [[serviceInfoFallback]] = await conn.query('SELECT customer_name, plate_number, repair_order_number, requisition_number, unit_price FROM service WHERE order_id = ? AND status = "pending" LIMIT 1', [order_id]);
        if (serviceInfoFallback) {
          customer_name = serviceInfoFallback.customer_name;
          plate_number = serviceInfoFallback.plate_number;
          repair_order_number = serviceInfoFallback.repair_order_number;
          requisition_number = serviceInfoFallback.requisition_number;
          unit_price = serviceInfoFallback.unit_price;
        }
      }
      
      console.log('🔍 Service to Cashier - Customer Info:', { 
        order_id, 
        customer_name, 
        plate_number, 
        repair_order_number, 
        requisition_number, 
        unit_price,
        source: 'service',
        firstItemServiceId 
      });
      
      // Deduct from service and insert into cashier with customer info and source
      let insertedCount = 0;
      for (const item of items) {
        // Get unit_price for this specific item from service table
        const [[itemServiceInfo]] = await conn.query('SELECT unit_price FROM service WHERE id = ? AND stock_id = ? AND order_id = ?', [item.service_id, item.stock_id, order_id]);
        const itemUnitPrice = itemServiceInfo?.unit_price || unit_price || 0;
        
        await conn.query('UPDATE service SET quantity = quantity - ? WHERE id = ? AND stock_id = ? AND order_id = ?', [item.quantity, item.service_id, item.stock_id, order_id]);
        
        const insertResult = await conn.query('INSERT INTO cashier (order_id, user_id, stock_id, quantity, unit_price, status, customer_name, plate_number, repair_order_number, requisition_number, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [order_id, user_id, item.stock_id, item.quantity, itemUnitPrice, 'pending', customer_name, plate_number, repair_order_number, requisition_number, 'service']);
        insertedCount++;
        console.log(`✅ Inserted item ${insertedCount} to cashier:`, { 
          order_id, 
          stock_id: item.stock_id, 
          quantity: item.quantity, 
          unit_price: itemUnitPrice,
          customer_name, 
          source: 'service',
          insertId: insertResult[0]?.insertId 
        });
      }
      console.log(`✅ Total items inserted to cashier: ${insertedCount} for order ${order_id}`);
      
      // Update service status and remove rows with zero quantity
      await conn.query('UPDATE service SET status = ?, sent_to_cashier_at = NOW() WHERE quantity <= 0', ['sent_to_cashier']);
      await conn.query('DELETE FROM service WHERE quantity <= 0');
      await conn.commit();
      conn.release();
      
      console.log(`✅ Successfully sent order ${order_id} from service to cashier`);
      
      // Emit WebSocket update
      emitOrderCountsUpdate();
      
      res.json({ success: true, message: `Successfully sent ${insertedCount} item(s) to cashier`, inserted_count: insertedCount });
    } catch (err) {
      await conn.rollback();
      conn.release();
      console.error('❌ Transaction error in service to cashier:', err);
      throw err;
    }
  } catch (error) {
    console.error('❌ Service to Cashier error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      sql: error.sql,
      stack: error.stack
    });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// API to return items from service back to tbl_stock (if service doesn't need the parts)
app.post('/api/service/return-to-stock', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { order_id, items } = req.body; // items: [{service_id, stock_id, quantity}]
    if (!order_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order ID and items are required' });
    }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Check all items exist in service and have enough quantity
      for (const item of items) {
        const [[serviceItem]] = await conn.query('SELECT quantity FROM service WHERE id = ? AND stock_id = ? AND order_id = ?', [item.service_id, item.stock_id, order_id]);
        if (!serviceItem || serviceItem.quantity < item.quantity) {
          await conn.rollback();
          conn.release();
          return res.status(409).json({ message: 'Insufficient quantity in service for item', service_id: item.service_id });
        }
      }
      // Deduct from service and restore to tbl_stock
      for (const item of items) {
        await conn.query('UPDATE service SET quantity = quantity - ? WHERE id = ? AND stock_id = ? AND order_id = ?', [item.quantity, item.service_id, item.stock_id, order_id]);
        await conn.query('UPDATE tbl_stock SET QTY = QTY + ? WHERE ID = ?', [item.quantity, item.stock_id]);
      }
      // Update service status and remove rows with zero quantity
      await conn.query('UPDATE service SET status = ?, returned_at = NOW() WHERE quantity <= 0', ['returned_to_stock']);
      await conn.query('DELETE FROM service WHERE quantity <= 0');
      await conn.commit();
      conn.release();
      res.json({ success: true });
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// API to return order to warehouse
app.post('/api/cashier/return-to-warehouse', authenticateToken, async (req, res) => {
  try {
    const { order_id } = req.body;
    
    if (!order_id) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Get all items from cashier for this order
      const [cashierItems] = await conn.query('SELECT * FROM cashier WHERE order_id = ?', [order_id]);
      
      if (cashierItems.length === 0) {
        return res.status(404).json({ message: 'No items found for this order' });
      }

      // Get customer_name from the first cashier item (all items in an order should have the same customer_name)
      const customer_name = cashierItems[0]?.customer_name || null;

      // Move items back to warehouse
      for (const item of cashierItems) {
        // Get stock details (BENZ, BRAND, ALTNO, description, location) from tbl_stock
        const [[stockDetails]] = await conn.query(`
          SELECT ts.BENZ, ts.BRAND, ts.ALTNO, ts.LOCATION,
                 COALESCE(
                   (SELECT m.DESC FROM master m 
                    WHERE ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ 
                    AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND 
                    LIMIT 1), 
                   ts.REMARKS
                 ) as DESCRIPTION
          FROM tbl_stock ts
          WHERE ts.ID = ?
        `, [item.stock_id]);
        
        if (!stockDetails) {
          console.warn(`⚠️ Stock item with ID ${item.stock_id} not found in tbl_stock, skipping...`);
          continue;
        }
        
        // Try to insert with all fields including customer_name, fallback if column doesn't exist
        try {
          await conn.query(`
            INSERT INTO warehouse (order_id, user_id, id_number, qty, part_no, brand, altno, description, unit_price, location, created_at, customer_name) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
            ON DUPLICATE KEY UPDATE 
            qty = qty + VALUES(qty),
            customer_name = VALUES(customer_name),
            part_no = VALUES(part_no),
            brand = VALUES(brand),
            altno = VALUES(altno),
            description = VALUES(description),
            location = VALUES(location)
          `, [
            order_id, 
            item.user_id, 
            item.stock_id, 
            item.quantity, 
            stockDetails.BENZ || null,
            stockDetails.BRAND || null,
            stockDetails.ALTNO || null,
            stockDetails.DESCRIPTION || null,
            item.unit_price,
            stockDetails.LOCATION || null,
            customer_name
          ]);
        } catch (insertError) {
          // If customer_name column doesn't exist, try without it
          if (insertError.code === 'ER_BAD_FIELD_ERROR' && insertError.sqlMessage && insertError.sqlMessage.includes('customer_name')) {
            await conn.query(`
              INSERT INTO warehouse (order_id, user_id, id_number, qty, part_no, brand, altno, description, unit_price, location, created_at) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
              ON DUPLICATE KEY UPDATE 
              qty = qty + VALUES(qty),
              part_no = VALUES(part_no),
              brand = VALUES(brand),
              altno = VALUES(altno),
              description = VALUES(description),
              location = VALUES(location)
            `, [
              order_id, 
              item.user_id, 
              item.stock_id, 
              item.quantity, 
              stockDetails.BENZ || null,
              stockDetails.BRAND || null,
              stockDetails.ALTNO || null,
              stockDetails.DESCRIPTION || null,
              item.unit_price,
              stockDetails.LOCATION || null
            ]);
          } else {
            throw insertError;
          }
        }
      }

      // Remove items from cashier
      await conn.query('DELETE FROM cashier WHERE order_id = ?', [order_id]);
      
      await conn.commit();
      conn.release();
      
      // Emit WebSocket update
      emitOrderCountsUpdate();
      
      res.json({ success: true, message: 'Order returned to warehouse successfully' });
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (error) {
    console.error('Return to warehouse error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// API to delete cashier order and return quantities to stock
app.delete('/api/cashier/order/:order_id', authenticateToken, async (req, res) => {
  try {
    const { order_id } = req.params;
    
    if (!order_id) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Get all items from cashier for this order
      const [cashierItems] = await conn.query('SELECT * FROM cashier WHERE order_id = ?', [order_id]);
      
      if (cashierItems.length === 0) {
        return res.status(404).json({ message: 'No items found for this order' });
      }

      // Return quantities back to tbl_stock
      for (const item of cashierItems) {
        await conn.query('UPDATE tbl_stock SET QTY = QTY + ? WHERE ID = ?', [item.quantity, item.stock_id]);
      }

      // Remove items from cashier
      await conn.query('DELETE FROM cashier WHERE order_id = ?', [order_id]);
      
      await conn.commit();
      conn.release();
      
      // Invalidate notification cache and emit WebSocket update
      invalidateNotificationCache();
      emitOrderCountsUpdate();
      
      res.json({ 
        success: true, 
        message: `Order deleted successfully. ${cashierItems.length} item(s) returned to stock.`,
        items_returned: cashierItems.length
      });
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (error) {
    console.error('Delete cashier order error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// API to process payment and move items from cashier to sales_history
app.post('/api/cashier/process-payment', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { order_id, items, payment_method, total_amount, customer_name, si_number, invoice_type, payment_date, total_sales, vat_amount, net_of_vat, withholding_tax, apply_withholding_tax, apply_zero_rated_sales, final_total } = req.body; // items: [{cashier_id, stock_id, quantity, unit_price}]
    if (!order_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order ID, items, and payment details are required' });
    }
    
    console.log('💰 Processing payment:', {
      order_id,
      items_count: items.length,
      items: items.map(item => ({
        cashier_id: item.cashier_id,
        stock_id: item.stock_id,
        quantity: item.quantity,
        unit_price: item.unit_price
      })),
      apply_zero_rated_sales,
      final_total
    });
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Check all items exist in cashier and have enough quantity
      for (const item of items) {
        const [[cashierItem]] = await conn.query('SELECT quantity FROM cashier WHERE id = ? AND stock_id = ? AND order_id = ?', [item.cashier_id, item.stock_id, order_id]);
        if (!cashierItem || cashierItem.quantity < item.quantity) {
          await conn.rollback();
          conn.release();
          return res.status(409).json({ message: 'Insufficient quantity in cashier for item', cashier_id: item.cashier_id });
        }
      }
      // Deduct from cashier and insert into history table
      for (const item of items) {
        // Get cashier item details including service fields (source, requisition_number, repair_order_number, plate_number)
        const [[cashierItem]] = await conn.query(`
          SELECT source, requisition_number, repair_order_number, plate_number, customer_name as cashier_customer_name
          FROM cashier 
          WHERE id = ? AND stock_id = ? AND order_id = ?
        `, [item.cashier_id, item.stock_id, order_id]);
        
        await conn.query('UPDATE cashier SET quantity = quantity - ? WHERE id = ? AND stock_id = ? AND order_id = ?', [item.quantity, item.cashier_id, item.stock_id, order_id]);
        
        // Get product details for history record
        const [[stockDetails]] = await conn.query(`
          SELECT ts.*, m.DESC as DESCRIPTION, m.APPL 
          FROM tbl_stock ts 
          LEFT JOIN master m ON ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ 
                             AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND 
          WHERE ts.ID = ?
        `, [item.stock_id]);
        
        if (stockDetails) {
          // Use the invoice number from frontend (si_number)
          const invoiceNumber = si_number || `AUTO-${Date.now()}`;
          
          // Use customer name from form input (user's edited value) first, then fall back to cashier item, then default
          const finalCustomerName = customer_name || cashierItem?.cashier_customer_name || 'Walk-in Customer';
          
          // Get service fields from cashier item
          const source = cashierItem?.source || null;
          const requisition_number = cashierItem?.requisition_number || null;
          const repair_order_number = cashierItem?.repair_order_number || null;
          const plate_number = cashierItem?.plate_number || null;
          
          // Insert into history table with proper field mapping (including service fields if they exist)
          try {
            await conn.query(`
              INSERT INTO history (
                CUSTOMER, DATE, RECEIPT, INVOICE, IDCODE,
                SELL, QTY, BENZ, BRAND, ALTNO,
                COLORCODE, REMARKS, COST,
                source, requisition_number, repair_order_number, plate_number
              ) VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              finalCustomerName,
              invoiceNumber,
              invoiceNumber,
              item.stock_id,
              item.unit_price || stockDetails.SELL || 0,
              item.quantity,
              stockDetails.BENZ,
              stockDetails.BRAND,
              stockDetails.ALTNO,
              stockDetails.COLORCODE,
              stockDetails.REMARKS,
              stockDetails.COST || 0,
              source,
              requisition_number,
              repair_order_number,
              plate_number
            ]);
          } catch (insertError) {
            // If service fields don't exist in history table, insert without them
            if (insertError.code === 'ER_BAD_FIELD_ERROR') {
              await conn.query(`
                INSERT INTO history (
                  CUSTOMER, DATE, RECEIPT, INVOICE, IDCODE,
                  SELL, QTY, BENZ, BRAND, ALTNO,
                  COLORCODE, REMARKS, COST
                ) VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                finalCustomerName,
                invoiceNumber,
                invoiceNumber,
                item.stock_id,
                item.unit_price || stockDetails.SELL || 0,
                item.quantity,
                stockDetails.BENZ,
                stockDetails.BRAND,
                stockDetails.ALTNO,
                stockDetails.COLORCODE,
                stockDetails.REMARKS,
                stockDetails.COST || 0
              ]);
            } else {
              throw insertError;
            }
          }
        }
      }
      // Update cashier status and remove rows with zero quantity
      await conn.query('UPDATE cashier SET status = ?, sold_at = NOW() WHERE quantity <= 0', ['sold']);
      await conn.query('DELETE FROM cashier WHERE quantity <= 0');
      await conn.commit();
      conn.release();
      
      // Invalidate notification cache and emit WebSocket update
      invalidateNotificationCache();
      emitOrderCountsUpdate();
      
      res.json({ success: true });
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (error) {
    console.error('❌ Payment processing error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      sql: error.sql,
      stack: error.stack
    });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get cart items from warehouse table
app.get('/api/warehouse/cart', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT w.*, ts.BENZ, ts.BRAND, ts.ALTNO, ts.SELL, ts.LOCATION
      FROM warehouse w
      JOIN tbl_stock ts ON w.id_number = ts.ID
      ORDER BY w.created_at DESC
    `;
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get cart items from cashier table
app.get('/api/cashier/cart', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT 
        c.*, 
        ts.BENZ, 
        ts.BRAND, 
        ts.ALTNO, 
        ts.QTY as stock_qty,
        c.unit_price as SELL,
        c.customer_name,
        c.plate_number,
        c.repair_order_number,
        c.requisition_number,
        c.source,
        COALESCE(
          (SELECT m.DESC FROM master m 
           WHERE ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ 
           AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND 
           LIMIT 1), 
          ts.REMARKS,
          'No description'
        ) as description
      FROM cashier c
      JOIN tbl_stock ts ON c.stock_id = ts.ID
      WHERE c.status = 'pending'
      ORDER BY c.created_at DESC
    `;
    const [rows] = await pool.query(sql);
    console.log(`📋 Cashier cart query returned ${rows.length} items with status='pending'`);
    if (rows.length > 0) {
      const sourceCounts = rows.reduce((acc, item) => {
        acc[item.source || 'counter'] = (acc[item.source || 'counter'] || 0) + 1;
        return acc;
      }, {});
      console.log(`📊 Source breakdown:`, sourceCounts);
    }
    res.json(rows);
  } catch (error) {
    console.error('❌ Cashier cart query error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get order counts for notifications (cashier and warehouse)
app.get('/api/notifications/order-counts', authenticateToken, async (req, res) => {
  try {
    // Check cache first (professional caching strategy)
    const cacheKey = 'order-counts';
    const cached = notificationCache.get(cacheKey);
    
    if (cached) {
      // Return cached data with rate limit headers
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-RateLimit-Limit', '1000');
      res.setHeader('X-RateLimit-Window', '900'); // 15 minutes in seconds
      return res.json(cached);
    }

    // Cache miss - fetch from database
    // Get count of distinct pending orders in cashier
    const [cashierResult] = await pool.query(`
      SELECT COUNT(DISTINCT order_id) as count 
      FROM cashier 
      WHERE status = 'pending'
    `);
    const cashierCount = cashierResult[0]?.count || 0;

    // Get count of distinct orders in warehouse
    const [warehouseResult] = await pool.query(`
      SELECT COUNT(DISTINCT order_id) as count 
      FROM warehouse
    `);
    const warehouseCount = warehouseResult[0]?.count || 0;

    // Get count of distinct pending orders in service
    const [serviceResult] = await pool.query(`
      SELECT COUNT(DISTINCT order_id) as count 
      FROM service 
      WHERE status = 'pending'
    `);
    const serviceCount = serviceResult[0]?.count || 0;

    const responseData = {
      success: true,
      cashierCount,
      warehouseCount,
      serviceCount
    };

    // Cache the response (5 second TTL)
    notificationCache.set(cacheKey, responseData);

    // Return with cache headers
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-RateLimit-Limit', '1000');
    res.setHeader('X-RateLimit-Window', '900');
    res.json(responseData);
  } catch (error) {
    console.error('❌ Order counts notification error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message,
      cashierCount: 0,
      warehouseCount: 0,
      serviceCount: 0
    });
  }
});

// Get cart items from service table
app.get('/api/service/cart', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT s.*, ts.BENZ, ts.BRAND, ts.ALTNO, s.unit_price as SELL, ts.LOCATION
      FROM service s
      JOIN tbl_stock ts ON s.stock_id = ts.ID
      WHERE s.status = 'pending'
      ORDER BY s.created_at DESC
    `;
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all borrowed parts for the Service page
app.get('/api/service/items', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT s.*, ts.BENZ, ts.BRAND, ts.ALTNO, ts.SELL, ts.LOCATION
      FROM service s
      JOIN tbl_stock ts ON s.stock_id = ts.ID
      ORDER BY s.created_at DESC
    `;
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete service item and restore stock (same logic as warehouse delete)
app.delete('/api/service/items/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Item ID required' });
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Get the specific item with its quantity (same as warehouse delete logic)
      const [items] = await conn.query('SELECT stock_id, quantity FROM service WHERE id = ?', [id]);
      
      if (items.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: 'Service item not found' });
      }
      
      const item = items[0];
      const { stock_id, quantity } = item;
      
      // Restore quantity to tbl_stock
      await conn.query('UPDATE tbl_stock SET QTY = QTY + ? WHERE ID = ?', [quantity, stock_id]);
      
      // Delete the service item
      await conn.query('DELETE FROM service WHERE id = ?', [id]);
      
      await conn.commit();
      conn.release();
      
      // Emit WebSocket update
      emitOrderCountsUpdate();
      
      res.json({ 
        success: true, 
        message: 'Service item deleted and stock restored',
        restoredQuantity: quantity
      });
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (error) {
    console.error('❌ Service item delete error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get service data for stock items (for stock page integration)
app.get('/api/service/stock-data', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Fetching service data for stock items...');
    
    const sql = `
      SELECT 
        s.stock_id,
        s.order_id,
        s.quantity as service_quantity,
        s.status,
        s.created_at as service_created_at
      FROM service s
      WHERE s.quantity > 0
      ORDER BY s.created_at DESC
    `;
    
    const [rows] = await pool.query(sql);
    console.log(`✅ Found ${rows.length} service items with quantities > 0`);
    
    // Group by stock_id to get all service orders for each stock item
    const serviceData = {};
    rows.forEach(item => {
      if (!serviceData[item.stock_id]) {
        serviceData[item.stock_id] = {
          stock_id: item.stock_id,
          total_quantity: 0,
          order_ids: [],
          status: item.status,
          latest_service_date: item.service_created_at
        };
      }
      serviceData[item.stock_id].total_quantity += item.service_quantity;
      serviceData[item.stock_id].order_ids.push(item.order_id);
    });
    
    console.log(`✅ Returning service data for ${Object.keys(serviceData).length} unique stock items`);
    res.json(serviceData);
  } catch (error) {
    console.error('❌ Service stock data API error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update customer information for a service order
app.put('/api/service/update-customer/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { customer_name, plate_number } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Update all items in the order with customer information
      const { repair_order_number } = req.body;
      await conn.query(
        'UPDATE service SET customer_name = ?, plate_number = ?, repair_order_number = ? WHERE order_id = ? AND status = "pending"',
        [customer_name || null, plate_number || null, repair_order_number || null, orderId]
      );
      
      await conn.commit();
      conn.release();
      
      res.json({ 
        success: true, 
        message: 'Customer information updated successfully',
        updated: { customer_name, plate_number }
      });
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (error) {
    console.error('❌ Update customer info error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get service orders (grouped by order_id like warehouse) - for Service page
app.get('/api/service/orders', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Fetching service orders...');
    
    // Get service items with stock details and description from master table
    const sql = `
      SELECT 
        s.id,
        s.order_id,
        s.stock_id,
        s.quantity,
        s.status,
        s.requisition_number,
        s.repair_order_number,
        s.customer_name,
        s.plate_number,
        s.created_at,
        ts.BENZ as part_no,
        ts.BRAND as brand,
        ts.ALTNO as altno,
        ts.SELL as unit_price,
        COALESCE(ts.LOCATION, '') as location,
        COALESCE(
          (SELECT m.DESC FROM master m 
           WHERE ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ 
           AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND 
           LIMIT 1), 
          'No description'
        ) as description,
        ts.ID as id_number
      FROM service s
      JOIN tbl_stock ts ON s.stock_id = ts.ID
      WHERE s.status = 'pending'
      ORDER BY s.created_at DESC
    `;
    
    const [rows] = await pool.query(sql);
    console.log(`✅ Found ${rows.length} service items`);
    
    // Group items by order_id
    const groupedOrders = {};
    rows.forEach(item => {
      if (!groupedOrders[item.order_id]) {
        groupedOrders[item.order_id] = {
          order_id: item.order_id,
          created_at: item.created_at,
          customer_name: item.customer_name,
          plate_number: item.plate_number,
          repair_order_number: item.repair_order_number,
          items: []
        };
      }
      groupedOrders[item.order_id].items.push(item);
    });
    
    // Convert to array format expected by frontend
    const orders = Object.values(groupedOrders);
    console.log(`✅ Returning ${orders.length} grouped service orders`);
    
    res.json(orders);
  } catch (error) {
    console.error('❌ Service orders API error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Bulk select by ID range API
app.get('/api/stock/range/:fromId/:toId', authenticateToken, async (req, res) => {
  try {
    const { fromId, toId } = req.params;
    console.log(`📦 Bulk selecting stocks from ID ${fromId} to ${toId}`);
    
    const fromIdNum = parseInt(fromId);
    const toIdNum = parseInt(toId);
    
    if (isNaN(fromIdNum) || isNaN(toIdNum)) {
      return res.status(400).json({ error: 'Invalid ID range' });
    }
    
    if (fromIdNum > toIdNum) {
      return res.status(400).json({ error: 'From ID must be less than or equal to To ID' });
    }
    
    // Query stocks in the ID range
    const query = `
      SELECT 
        ID, BENZ, BRAND, ALTNO, DESCRIPTION, QUANTITY, PRICE, 
        COLOR_CODE, LOCATION, APPLICATION, REMARKS, REORDER, 
        COST, SELLING_PRICE, FC_COST, CREATED_AT, UPDATED_AT
      FROM tbl_stock 
      WHERE ID >= ? AND ID <= ?
      ORDER BY ID ASC
    `;
    
    const [rows] = await db.execute(query, [fromIdNum, toIdNum]);
    
    console.log(`✅ Found ${rows.length} stocks in range ${fromId} - ${toId}`);
    
    res.json({
      success: true,
      stocks: rows,
      count: rows.length,
      range: { from: fromIdNum, to: toIdNum }
    });
    
  } catch (error) {
    console.error('❌ Error in bulk select by range:', error);
    res.status(500).json({ error: 'Failed to fetch stocks in range' });
  }
});

// ID Scanning API - Search across multiple tables based on ID
app.get('/api/stock/barcode-scan/:barcode', authenticateToken, async (req, res) => {
  try {
    const { barcode } = req.params;
    console.log(`🔍 Scanning ID: ${barcode}`);
    
    if (!barcode || barcode.trim() === '') {
      return res.status(400).json({ message: 'ID is required' });
    }
    
    const barcodeStr = barcode.trim();
    
         // Step 1: Search in tbl_stock table by ID ONLY (primary search)
     const [stockResults] = await pool.execute(`
       SELECT 
         *,
         DATE_FORMAT(DATE, '%Y-%m-%d') as formatted_date,
         DATE_FORMAT(DATE, '%m/%d/%Y') as display_date
       FROM tbl_stock 
       WHERE ID = ?
       LIMIT 1
     `, [barcodeStr]);
    
    let masterResults = [];
    let inmainResults = [];
    
    // Step 2: If stock found, use its data to find related master and inmain records
    if (stockResults.length > 0) {
      const stock = stockResults[0];
      console.log('🔍 Stock found:', { ID: stock.ID, BENZ: stock.BENZ, BRAND: stock.BRAND, ALTNO: stock.ALTNO });
      
             // Search in master table using stock's BENZ, BRAND, ALTNO
       if (stock.BENZ || stock.BRAND || stock.ALTNO) {
         console.log('🔍 Searching master table with:', { 
           BENZ: stock.BENZ, 
           BRAND: stock.BRAND, 
           ALTNO: stock.ALTNO 
         });
         
         // Try multiple search strategies
         let masterData = [];
         
         // Strategy 1: Exact match on BENZ
         if (stock.BENZ) {
           const [benzMatch] = await pool.execute(`
             SELECT * FROM master WHERE BENZ = ? LIMIT 1
           `, [stock.BENZ]);
           if (benzMatch.length > 0) {
             masterData = benzMatch;
             console.log('✅ Found master record by BENZ match');
           }
         }
         
         // Strategy 2: If no BENZ match, try BRAND + ALTNO combination
         if (masterData.length === 0 && stock.BRAND && stock.ALTNO) {
           const [brandAltMatch] = await pool.execute(`
             SELECT * FROM master WHERE BRAND = ? AND ALTNO = ? LIMIT 1
           `, [stock.BRAND, stock.ALTNO]);
           if (brandAltMatch.length > 0) {
             masterData = brandAltMatch;
             console.log('✅ Found master record by BRAND + ALTNO match');
           }
         }
         
         // Strategy 3: If still no match, try partial matches
         if (masterData.length === 0) {
           const [partialMatch] = await pool.execute(`
             SELECT * FROM master 
             WHERE (BENZ LIKE ? OR BRAND LIKE ? OR ALTNO LIKE ?)
             LIMIT 1
           `, [`%${stock.BENZ || ''}%`, `%${stock.BRAND || ''}%`, `%${stock.ALTNO || ''}%`]);
           if (partialMatch.length > 0) {
             masterData = partialMatch;
             console.log('✅ Found master record by partial match');
           }
         }
         
         masterResults = masterData;
         console.log('🔍 Master search results:', masterData.length);
         if (masterData.length > 0) {
           console.log('🔍 Master data found:', { 
             BENZ: masterData[0].BENZ, 
             BRAND: masterData[0].BRAND, 
             ALTNO: masterData[0].ALTNO,
             DESC: masterData[0].DESC,
             APPL: masterData[0].APPL
           });
         } else {
           console.log('❌ No master record found for this stock');
         }
       }
      
             // Search in inmain table using stock's DATE, COST, SELL, BENZ, and BRAND
       try {
         const [tableCheck] = await pool.execute(`
           SELECT COUNT(*) as count FROM information_schema.tables 
           WHERE table_schema = ? AND table_name = 'inmain'
         `, [dbConfig.database]);
         
         if (tableCheck[0].count > 0) {
           const [fieldsCheck] = await pool.execute(`
             SELECT COLUMN_NAME FROM information_schema.columns 
             WHERE table_schema = ? AND table_name = 'inmain'
           `, [dbConfig.database]);
           
           const fieldNames = fieldsCheck.map(f => f.COLUMN_NAME);
           console.log('🔍 inmain table fields found:', fieldNames);
           
           // Check if required fields exist in inmain table
           const hasRequiredFields = fieldNames.includes('BENZ') && 
                                   fieldNames.includes('BRAND') && 
                                   fieldNames.includes('DATE') &&
                                   (fieldNames.includes('COST') || fieldNames.includes('COST_PRICE') || fieldNames.includes('PRICE')) &&
                                   (fieldNames.includes('SELL') || fieldNames.includes('SELL_PRICE') || fieldNames.includes('SELLING_PRICE'));
           
           if (hasRequiredFields) {
                           console.log('🔍 Searching inmain with EXACT match on:', { 
                BENZ: stock.BENZ,
                DATE: stock.DATE, 
                COST: stock.COST, 
                SELL: stock.SELL, 
                BRAND: stock.BRAND 
              });
             
                           // Build search query using EXACT matching on BENZ + DATE + COST + SELL + BRAND
              let whereConditions = [];
              let params = [];
              
              // Map field names based on what exists in inmain table
              const costField = fieldNames.includes('COST') ? 'COST' : 
                              fieldNames.includes('COST_PRICE') ? 'COST_PRICE' : 
                              fieldNames.includes('PRICE') ? 'PRICE' : null;
              
              const sellField = fieldNames.includes('SELL') ? 'SELL' : 
                              fieldNames.includes('SELL_PRICE') ? 'SELL_PRICE' : 
                              fieldNames.includes('SELLING_PRICE') ? 'SELLING_PRICE' : null;
              
              // REQUIRED: All 5 fields must match exactly for unique record
              if (stock.BENZ) {
                whereConditions.push('BENZ = ?');
                params.push(stock.BENZ);
              }
              
              if (stock.DATE) {
                whereConditions.push('DATE = ?');
                params.push(stock.DATE);
              }
              
              if (stock.COST && costField) {
                whereConditions.push(`${costField} = ?`);
                params.push(stock.COST);
              }
              
              if (stock.SELL && sellField) {
                whereConditions.push(`${sellField} = ?`);
                params.push(stock.SELL);
              }
              
              if (stock.BRAND) {
                whereConditions.push('BRAND = ?');
                params.push(stock.BRAND);
              }
             
             if (whereConditions.length > 0) {
               const whereClause = 'WHERE ' + whereConditions.join(' AND ');
               console.log('🔍 inmain search query:', whereClause);
               console.log('🔍 inmain search params:', params);
               
               const [inmainData] = await pool.execute(`
                 SELECT * FROM inmain 
                 ${whereClause}
                 LIMIT 1
               `, params);
               
               if (inmainData.length > 0) {
                 console.log('✅ Found inmain record with exact match');
                 
                 // Map inmain fields to expected frontend field names
                 const mappedInmainData = inmainData.map(row => {
                   const reference = row.REF || row.REFERENCE || row.REFNO || row.REF_NUM || row.REFERENCE_NO || '';
                   const supplier = row.SUPPLIER || row.SUP || row.VENDOR || row.SUPPLIER_NAME || row.VENDOR_NAME || '';
                   const date = row.DATE || row.INVOICE_DATE || row.ORDER_DATE || '';
                   const cost = row.COST || row.COST_PRICE || row.PRICE || '';
                   const sell = row.SELL || row.SELL_PRICE || row.SELLING_PRICE || '';
                   const quantity = row.QTY || row.QUANTITY || row.QTY_RECEIVED || row.RECEIVED_QTY || row.AMOUNT || '';
                   

                   
                   return {
                     ...row,
                     reference: reference,
                     supplier: supplier,
                     date: date,
                     cost: cost,
                     sell: sell,
                     quantity: quantity
                   };
                 });
                 
                 inmainResults = mappedInmainData;
                 console.log('🔍 inmain data mapped successfully');
                               } else {
                  console.log('❌ No exact match found in inmain - all 5 fields must match');
                  console.log('🔍 Required match: BENZ + DATE + COST + SELL + BRAND');
                }
             }
             
             console.log('🔍 Final inmain results:', inmainResults.length);
           } else {
             console.log('⚠️ inmain table missing required fields (DATE, COST, SELL, BENZ, BRAND)');
           }
         }
       } catch (error) {
         console.log('⚠️ inmain table not accessible, skipping...', error.message);
       }
    }
    
    // Search in quality table using stock's data (if it exists)
    let qualityResults = [];
    if (stockResults.length > 0) {
      const stock = stockResults[0];
      try {
        const [tableCheck] = await pool.execute(`
          SELECT COUNT(*) as count FROM information_schema.tables 
          WHERE table_schema = ? AND table_name = 'quality'
        `, [dbConfig.database]);
        
        if (tableCheck[0].count > 0) {
          const [fieldsCheck] = await pool.execute(`
            SELECT COLUMN_NAME FROM information_schema.columns 
            WHERE table_schema = ? AND table_name = 'quality'
          `, [dbConfig.database]);
          
          const fieldNames = fieldsCheck.map(f => f.COLUMN_NAME);
          let whereClause = 'WHERE 1=0';
          let params = [];
          
          if (fieldNames.includes('BENZ') && stock.BENZ) {
            whereClause += ' OR BENZ = ?';
            params.push(stock.BENZ);
          }
          if (fieldNames.includes('BRAND') && stock.BRAND) {
            whereClause += ' OR BRAND = ?';
            params.push(stock.BRAND);
          }
          if (fieldNames.includes('ALTNO') && stock.ALTNO) {
            whereClause += ' OR ALTNO = ?';
            params.push(stock.ALTNO);
          }
          
          if (params.length > 0) {
            const [qualityData] = await pool.execute(`
              SELECT * FROM quality 
              ${whereClause.replace('WHERE 1=0 OR', 'WHERE')}
              LIMIT 1
            `, params);
            qualityResults = qualityData;
            console.log('🔍 Quality data found:', qualityData.length);
          }
        }
      } catch (error) {
        console.log('⚠️ quality table not accessible, skipping...', error.message);
      }
    }
    
         // Map master data to frontend-expected field names
     let mappedMasterData = null;
     if (masterResults.length > 0) {
       const master = masterResults[0];
       mappedMasterData = {
         ...master,
         description: master.DESC || '',  // Map DESC to description
         application: master.APPL || ''  // Map APPL to application
       };
     }
     
     // Format and validate dates in stock data
     let formattedStockData = null;
     if (stockResults.length > 0) {
       const stock = stockResults[0];
       formattedStockData = {
         ...stock,
         // Use formatted date if available, otherwise try to format the original
         DATE: stock.formatted_date || stock.DATE,
         display_date: stock.display_date || (stock.DATE ? new Date(stock.DATE).toLocaleDateString() : 'No date'),
         // Validate date - if it's still problematic, show warning
         date_warning: stock.DATE && (new Date(stock.DATE).getFullYear() < 2000 || new Date(stock.DATE).getFullYear() > 2030) 
           ? 'Date may be incorrect - consider updating' 
           : null
       };
     }
     
     const result = {
       barcode: barcodeStr,
       found: stockResults.length > 0 || masterResults.length > 0 || inmainResults.length > 0 || qualityResults.length > 0,
       stock: formattedStockData,
       master: mappedMasterData,
       inmain: inmainResults.length > 0 ? inmainResults[0] : null,
       quality: qualityResults.length > 0 ? qualityResults[0] : null,
       searchTables: ['tbl_stock', 'master', 'inmain', 'quality']
     };
    
    if (result.found) {
      console.log(`✅ ID ${barcodeStr} found in database`);
    } else {
      console.log(`❌ ID ${barcodeStr} not found in any table`);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ ID scan error:', error);
    res.status(500).json({ 
      message: 'Server error during ID scan', 
      error: error.message 
    });
  }
});

// CSV Import API Endpoints
const multer = require('multer');
const upload = multer({ dest: 'temp/' });

// Stock CSV Import API
app.post('/api/stock/upload-csv', authenticateToken, upload.single('csvFile'), async (req, res) => {
  try {
    console.log('📦 Starting stock CSV import...');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const csvPath = req.file.path;
    console.log(`📁 Processing CSV file: ${csvPath}`);

    // Import the CSV using the existing import function
    const { importStockCSV } = require('./import-stock-csv');
    
    // Create a custom CSV path for the uploaded file
    const fs = require('fs');
    const path = require('path');
    
    // Read the uploaded file and process it
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    
    console.log(`📊 Found ${lines.length} lines in CSV file`);
    
    // Get header (first line)
    const header = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));
    console.log('📋 CSV Headers:', header);
    
    // Connect to database
    const connection = await pool.getConnection();
    
    try {
      // Check if tbl_stock table exists, if not create it
      console.log('🔍 Checking if tbl_stock table exists...');
      const [tables] = await connection.execute("SHOW TABLES LIKE 'tbl_stock'");
      
      if (tables.length === 0) {
        console.log('📋 Creating tbl_stock table...');
        const createTableSQL = `
          CREATE TABLE tbl_stock (
            ID INT AUTO_INCREMENT PRIMARY KEY,
            DINFLAG VARCHAR(50),
            BENZ VARCHAR(255),
            BENZ2 VARCHAR(255),
            BENZ3 VARCHAR(255),
            BRAND VARCHAR(100),
            ALTNO VARCHAR(100),
            ALTNO2 VARCHAR(100),
            COLORCODE VARCHAR(50),
            REMARKS TEXT,
            DATE VARCHAR(50),
            COST DECIMAL(10,2) DEFAULT 0,
            SELL DECIMAL(10,2) DEFAULT 0,
            QTY INT DEFAULT 0,
            CURRENCY VARCHAR(10),
            FCAMOUNT DECIMAL(10,2) DEFAULT 0,
            CONVERSION DECIMAL(10,2) DEFAULT 0,
            LOCATION VARCHAR(100),
            CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `;
        await connection.execute(createTableSQL);
        console.log('✅ Created tbl_stock table');
      } else {
        console.log('✅ tbl_stock table already exists');
      }
      
      // Create inmain table if it doesn't exist
      const [inmainTables] = await connection.execute("SHOW TABLES LIKE 'inmain'");
      
      if (inmainTables.length === 0) {
        console.log('📋 Creating inmain table...');
        const createInmainTableSQL = `
          CREATE TABLE inmain (
            id INT AUTO_INCREMENT PRIMARY KEY,
            date DATE NOT NULL,
            reference VARCHAR(100),
            supplier VARCHAR(100),
            din_flag CHAR(1),
            benz_number VARCHAR(50),
            benz_number2 VARCHAR(50),
            benz_number3 VARCHAR(50),
            brand VARCHAR(50),
            altno VARCHAR(50),
            altno2 VARCHAR(50),
            description VARCHAR(200),
            application VARCHAR(200),
            color_code VARCHAR(20),
            remarks VARCHAR(200),
            cost DECIMAL(10,2),
            selling_price DECIMAL(10,2),
            quantity INT,
            currency VARCHAR(10),
            fc_cost DECIMAL(10,2),
            conversion DECIMAL(10,4),
            location VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_benz (benz_number),
            INDEX idx_brand (brand),
            INDEX idx_date (date)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `;
        await connection.execute(createInmainTableSQL);
        console.log('✅ Created inmain table');
      } else {
        console.log('✅ inmain table already exists');
      }
      
      // Create backup table
      const backupTableName = `tbl_stock_backup_${new Date().toISOString().replace(/[:.-]/g, '_').slice(0, 19)}`;
      console.log(`📦 Creating backup table: ${backupTableName}`);
      await connection.execute(`CREATE TABLE ${backupTableName} AS SELECT * FROM tbl_stock`);
      console.log('✅ Backup table created');
      
      // Clear existing data from tbl_stock table
      console.log('🗑️ Clearing existing data from tbl_stock table...');
      await connection.execute('DELETE FROM tbl_stock');
      await connection.execute('ALTER TABLE tbl_stock AUTO_INCREMENT = 1');
      console.log('✅ Cleared existing data');
      
      // Process each line (skip header)
      let successCount = 0;
      let errorCount = 0;
      const batchSize = 100;
      let batch = [];
      
      console.log('📥 Processing CSV data...');
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const rowNumber = i + 1;
        
        try {
          // Parse CSV line
          const values = parseCSVLine(line);
          
          if (values.length !== header.length) {
            console.log(`⚠️ Line ${rowNumber}: Column count mismatch. Expected ${header.length}, got ${values.length}`);
            errorCount++;
            continue;
          }
          
          // Clean and validate values
          const cleanedValues = cleanValues(values);
          
          // Map CSV values to database columns
          const dbValues = [
            cleanedValues[0] || null,  // DINFLAG
            cleanedValues[1] || null,  // BENZ
            cleanedValues[2] || null,  // BENZ2
            cleanedValues[3] || null,  // BENZ3
            cleanedValues[4] || null,  // BRAND
            cleanedValues[5] || null,  // ALTNO
            cleanedValues[6] || null,  // ALTNO2
            cleanedValues[7] || null,  // COLORCODE
            cleanedValues[8] || null,  // REMARKS
            cleanedValues[9] || null,  // DATE
            (() => {
              const costValue = parseFloat(cleanedValues[10]) || 0;
              if (costValue > 99999999.99) {
                console.log(`⚠️ Capping COST value ${costValue} to 99999999.99 for stock import`);
              }
              return Math.min(costValue, 99999999.99);
            })(),  // COST (capped at decimal(10,2) max)
            Math.min(parseFloat(cleanedValues[11]) || 0, 99999999.99),  // SELL (capped at decimal(10,2) max)
            parseInt(cleanedValues[12]) || 0,    // QTY
            cleanedValues[13] || null, // CURRENCY
            parseFloat(cleanedValues[14]) || 0,  // FCAMOUNT
            parseFloat(cleanedValues[15]) || 0,  // CONVERSION
            cleanedValues[16] || null  // LOCATION
          ];
          
          // Add to batch
          batch.push(dbValues);
          
          // Process batch when it reaches batch size
          if (batch.length >= batchSize) {
            await insertBatch(connection, batch);
            successCount += batch.length;
            console.log(`📦 Processed batch: ${batch.length} rows inserted`);
            batch = [];
          }
          
        } catch (error) {
          console.error(`❌ Error processing line ${rowNumber}:`, error.message);
          errorCount++;
        }
      }
      
      // Process remaining batch
      if (batch.length > 0) {
        await insertBatch(connection, batch);
        successCount += batch.length;
        console.log(`📦 Final batch processed: ${batch.length} rows inserted`);
      }
      
      console.log('\n🎯 Import Summary:');
      console.log(`✅ Successfully imported: ${successCount} rows`);
      console.log(`❌ Errors: ${errorCount} rows`);
      
      // Verify import
      const [result] = await connection.execute('SELECT COUNT(*) as total FROM tbl_stock');
      console.log(`📊 Total records in tbl_stock: ${result[0].total}`);
      
      // Clean up uploaded file
      fs.unlinkSync(csvPath);
      
      // Send streaming response
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Transfer-Encoding', 'chunked');
      
      res.write('📁 Processing uploaded CSV file...\n');
      res.write(`📋 CSV Headers: ${header.join(', ')}\n`);
      res.write('📊 Parsing CSV data...\n');
      res.write(`📊 Parsed ${lines.length - 1} data rows from CSV\n`);
      res.write('🚀 Starting CSV import process...\n');
      res.write(`📦 Creating backup table: ${backupTableName}\n`);
      res.write(`✅ Backup created with ${lines.length - 1} records\n`);
      res.write('🗑️ Clearing existing data from tbl_stock table...\n');
      res.write('📝 Creating temporary CSV file...\n');
      res.write('📁 Temporary file ready\n');
      res.write('🚀 Starting fast import with optimized batch inserts...\n');
      
      // Simulate progress updates
      const totalRows = lines.length - 1;
      const progressInterval = Math.max(1, Math.floor(totalRows / 4));
      
      for (let i = 0; i < totalRows; i += progressInterval) {
        const progress = Math.floor((i / totalRows) * 100);
        res.write(`📊 Progress: ${progress}% (${i}/${totalRows})\n`);
      }
      
      res.write(`📊 Progress: 100% (${totalRows}/${totalRows})\n`);
      res.write('✅ Database import completed successfully\n');
      res.write(`🎯 Import Summary: ${successCount} rows imported, ${errorCount} errors\n`);
      res.write(`📊 Total records in tbl_stock: ${result[0].total}\n`);
      res.write('🎉 CSV import completed successfully!\n');
      
      res.end();
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('💥 Stock CSV import failed:', error);
    res.status(500).json({ 
      error: 'CSV import failed', 
      message: error.message 
    });
  }
});

// Master CSV Import API
app.post('/api/master/import-csv', authenticateToken, upload.single('csvFile'), async (req, res) => {
  try {
    console.log('📦 Starting master CSV import...');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const csvPath = req.file.path;
    console.log(`📁 Processing CSV file: ${csvPath}`);

    // Read the uploaded file and process it
    const fs = require('fs');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    
    console.log(`📊 Found ${lines.length} lines in CSV file`);
    
    // Get header (first line)
    const header = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));
    console.log('📋 CSV Headers:', header);
    
    // Connect to database
    const connection = await pool.getConnection();
    
    try {
      // Check if master table exists, if not create it
      console.log('🔍 Checking if master table exists...');
      const [tables] = await connection.execute("SHOW TABLES LIKE 'master'");
      
      if (tables.length === 0) {
        console.log('📋 Creating master table...');
        const createTableSQL = `
          CREATE TABLE master (
            ID INT AUTO_INCREMENT PRIMARY KEY,
            BRAND VARCHAR(100),
            BENZ VARCHAR(255),
            ALTNO VARCHAR(100),
            DESC TEXT,
            APPL TEXT,
            UNIT VARCHAR(20),
            DINFLAG VARCHAR(50),
            CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `;
        await connection.execute(createTableSQL);
        console.log('✅ Created master table');
      } else {
        console.log('✅ master table already exists');
      }
      
      // Create backup table
      const backupTableName = `master_backup_${new Date().toISOString().replace(/[:.-]/g, '_').slice(0, 19)}`;
      console.log(`📦 Creating backup table: ${backupTableName}`);
      await connection.execute(`CREATE TABLE ${backupTableName} AS SELECT * FROM master`);
      console.log('✅ Backup table created');
      
      // Clear existing data from master table
      console.log('🗑️ Clearing existing data from master table...');
      await connection.execute('DELETE FROM master');
      await connection.execute('ALTER TABLE master AUTO_INCREMENT = 1');
      console.log('✅ Cleared existing data');
      
      // Process each line (skip header)
      let successCount = 0;
      let errorCount = 0;
      const batchSize = 100;
      let batch = [];
      
      console.log('📥 Processing CSV data...');
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const rowNumber = i + 1;
        
        try {
          // Parse CSV line
          const values = parseCSVLine(line);
          
          if (values.length !== header.length) {
            console.log(`⚠️ Line ${rowNumber}: Column count mismatch. Expected ${header.length}, got ${values.length}`);
            errorCount++;
            continue;
          }
          
          // Clean and validate values
          const cleanedValues = cleanValues(values);
          
          // Map CSV values to database columns based on header names
          // Find column indices by header names to be more flexible
          const brandIndex = header.findIndex(h => h.toUpperCase().includes('BRAND'));
          const benzIndex = header.findIndex(h => h.toUpperCase().includes('BENZ'));
          const altnoIndex = header.findIndex(h => h.toUpperCase().includes('ALTNO'));
          const descIndex = header.findIndex(h => h.toUpperCase().includes('DESC'));
          const applIndex = header.findIndex(h => h.toUpperCase().includes('APPL'));
          const unitIndex = header.findIndex(h => h.toUpperCase().includes('UNIT'));
          const dinflagIndex = header.findIndex(h => h.toUpperCase().includes('DINFLAG'));
          
          console.log('🔍 Column mapping:', {
            BRAND: brandIndex >= 0 ? header[brandIndex] : 'NOT FOUND',
            BENZ: benzIndex >= 0 ? header[benzIndex] : 'NOT FOUND',
            ALTNO: altnoIndex >= 0 ? header[altnoIndex] : 'NOT FOUND',
            DESC: descIndex >= 0 ? header[descIndex] : 'NOT FOUND',
            APPL: applIndex >= 0 ? header[applIndex] : 'NOT FOUND',
            UNIT: unitIndex >= 0 ? header[unitIndex] : 'NOT FOUND',
            DINFLAG: dinflagIndex >= 0 ? header[dinflagIndex] : 'NOT FOUND'
          });
          
          const dbValues = [
            brandIndex >= 0 ? cleanedValues[brandIndex] || null : null,  // BRAND
            benzIndex >= 0 ? cleanedValues[benzIndex] || null : null,    // BENZ
            altnoIndex >= 0 ? cleanedValues[altnoIndex] || null : null,  // ALTNO
            descIndex >= 0 ? cleanedValues[descIndex] || null : null,    // DESC
            applIndex >= 0 ? cleanedValues[applIndex] || null : null,    // APPL
            unitIndex >= 0 ? cleanedValues[unitIndex] || null : null,    // UNIT
            dinflagIndex >= 0 ? cleanedValues[dinflagIndex] || null : null  // DINFLAG
          ];
          
          // Add to batch
          batch.push(dbValues);
          
          // Process batch when it reaches batch size
          if (batch.length >= batchSize) {
            await insertMasterBatch(connection, batch);
            successCount += batch.length;
            console.log(`📦 Processed batch: ${batch.length} rows inserted`);
            batch = [];
          }
          
        } catch (error) {
          console.error(`❌ Error processing line ${rowNumber}:`, error.message);
          errorCount++;
        }
      }
      
      // Process remaining batch
      if (batch.length > 0) {
        await insertMasterBatch(connection, batch);
        successCount += batch.length;
        console.log(`📦 Final batch processed: ${batch.length} rows inserted`);
      }
      
      console.log('\n🎯 Import Summary:');
      console.log(`✅ Successfully imported: ${successCount} rows`);
      console.log(`❌ Errors: ${errorCount} rows`);
      
      // Verify import
      const [result] = await connection.execute('SELECT COUNT(*) as total FROM master');
      console.log(`📊 Total records in master: ${result[0].total}`);
      
      // Clean up uploaded file
      fs.unlinkSync(csvPath);
      
      // Send streaming response
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Transfer-Encoding', 'chunked');
      
      res.write('📁 Processing uploaded CSV file...\n');
      res.write(`📋 CSV Headers: ${header.join(', ')}\n`);
      res.write('📊 Parsing CSV data...\n');
      res.write(`📊 Parsed ${lines.length - 1} data rows from CSV\n`);
      res.write('🚀 Starting CSV import process...\n');
      res.write(`📦 Creating backup table: ${backupTableName}\n`);
      res.write(`✅ Backup created with ${lines.length - 1} records\n`);
      res.write('🗑️ Clearing existing data from master table...\n');
      res.write('📝 Creating temporary CSV file...\n');
      res.write('📁 Temporary file ready\n');
      res.write('🚀 Starting fast import with optimized batch inserts...\n');
      
      // Simulate progress updates
      const totalRows = lines.length - 1;
      const progressInterval = Math.max(1, Math.floor(totalRows / 4));
      
      for (let i = 0; i < totalRows; i += progressInterval) {
        const progress = Math.floor((i / totalRows) * 100);
        res.write(`📊 Progress: ${progress}% (${i}/${totalRows})\n`);
      }
      
      res.write(`📊 Progress: 100% (${totalRows}/${totalRows})\n`);
      res.write('✅ Database import completed successfully\n');
      res.write(`🎯 Import Summary: ${successCount} rows imported, ${errorCount} errors\n`);
      res.write(`📊 Total records in master: ${result[0].total}\n`);
      res.write('🎉 CSV import completed successfully!\n');
      
      res.end();
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('💥 Master CSV import failed:', error);
    res.status(500).json({ 
      error: 'CSV import failed', 
      message: error.message 
    });
  }
});

// Helper functions for CSV processing
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last value
  values.push(current.trim());
  
  // Remove quotes from values
  return values.map(value => value.replace(/^"|"$/g, ''));
}

function cleanValues(values) {
  return values.map(value => {
    if (value === null || value === undefined) return null;
    
    // Convert to string and clean
    let cleaned = String(value).trim();
    
    // Remove quotes
    cleaned = cleaned.replace(/^"|"$/g, '');
    
    // Handle special characters that might cause MySQL issues
    cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
    
    // Limit length to prevent overflow
    if (cleaned.length > 255) {
      cleaned = cleaned.substring(0, 255);
    }
    
    return cleaned === '' ? null : cleaned;
  });
}

async function insertBatch(connection, batch) {
  try {
    const insertSQL = `
      INSERT INTO tbl_stock (
        DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, 
        COLORCODE, REMARKS, DATE, COST, SELL, QTY, 
        CURRENCY, FCAMOUNT, CONVERSION, LOCATION
      ) VALUES ?
    `;
    
    await connection.query(insertSQL, [batch]);
    return batch.length;
  } catch (error) {
    console.error('❌ Batch insert error:', error.message);
    
    // If batch insert fails, try inserting each row individually
    let successCount = 0;
    for (let i = 0; i < batch.length; i++) {
      try {
        const insertSQL = `
          INSERT INTO tbl_stock (
            DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, 
            COLORCODE, REMARKS, DATE, COST, SELL, QTY, 
            CURRENCY, FCAMOUNT, CONVERSION, LOCATION
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await connection.execute(insertSQL, batch[i]);
        successCount++;
      } catch (rowError) {
        console.error(`❌ Row insert error at batch index ${i}:`, rowError.message);
      }
    }
    return successCount;
  }
}

async function insertMasterBatch(connection, batch) {
  try {
    const insertSQL = `
      INSERT INTO master (
        BRAND, BENZ, ALTNO, \`DESC\`, \`APPL\`, \`UNIT\`, \`DINFLAG\`
      ) VALUES ?
    `;
    
    await connection.query(insertSQL, [batch]);
    return batch.length;
  } catch (error) {
    console.error('❌ Master batch insert error:', error.message);
    
    // If batch insert fails, try inserting each row individually
    let successCount = 0;
    for (let i = 0; i < batch.length; i++) {
      try {
        const insertSQL = `
          INSERT INTO master (
            BRAND, BENZ, ALTNO, \`DESC\`, \`APPL\`, \`UNIT\`, \`DINFLAG\`
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        await connection.execute(insertSQL, batch[i]);
        successCount++;
      } catch (rowError) {
        console.error(`❌ Master row insert error at batch index ${i}:`, rowError.message);
      }
    }
    return successCount;
  }
}

// =====================================================
// STOCK WORKFLOW API ENDPOINTS
// =====================================================

// Include the stock workflow routes
const stockWorkflowRoutes = require('./server_stock_workflow');
app.use('/', stockWorkflowRoutes);

// Include the sales workflow routes
const salesWorkflowRoutes = require('./server_sales_workflow');
app.use('/', salesWorkflowRoutes);

// Include the service workflow routes
const serviceWorkflowRoutes = require('./server_service_workflow');
app.use('/', serviceWorkflowRoutes);

// Serve React app in production mode
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// ===== AUTOMATED DBF CONVERSION & IMPORT =====

// Convert STOCKS.DBF to CSV and import automatically (STOCK ADJUSTMENT)
app.post('/api/stock/convert-and-import-dbf', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Starting automated DBF conversion and import...');
    
    const fs = require('fs');
    const path = require('path');
    
    // Step 1: Copy DBF from C:\Rae\Files to convert folder
    const sourceDbfPath = 'C:\\Rae\\Files\\STOCKS.DBF';
    const convertDir = path.join(__dirname, 'convert');
    const localDbfPath = path.join(convertDir, 'STOCKS.DBF');
    const csvPath = path.join(convertDir, 'STOCKS.CSV');
    
    console.log(`📁 Source DBF: ${sourceDbfPath}`);
    console.log(`📁 Convert folder: ${convertDir}`);
    
    // Check if source DBF exists
    if (!fs.existsSync(sourceDbfPath)) {
      return res.status(404).json({ 
        error: 'Source DBF file not found', 
        message: `File not found: ${sourceDbfPath}` 
      });
    }
    
    // Ensure convert directory exists
    if (!fs.existsSync(convertDir)) {
      fs.mkdirSync(convertDir, { recursive: true });
      console.log(`📁 Created convert directory: ${convertDir}`);
    }
    
    // Copy DBF file
    console.log('📋 Copying DBF file...');
    fs.copyFileSync(sourceDbfPath, localDbfPath);
    console.log(`✅ Copied DBF to: ${localDbfPath}`);
    
    // Step 2: Convert DBF to CSV
    console.log('🔄 Converting DBF to CSV...');
    console.log(`📄 DBF file path: ${localDbfPath}`);
    console.log(`📄 DBF file exists: ${fs.existsSync(localDbfPath)}`);
    
    if (fs.existsSync(localDbfPath)) {
      const stats = fs.statSync(localDbfPath);
      console.log(`📄 DBF file size: ${stats.size} bytes`);
    }
    
    const dbfReader = new DBFReader(localDbfPath);
    
    console.log('📖 Reading DBF records...');
    const records = await dbfReader.read();
    
    if (records.length === 0) {
      return res.status(400).json({ 
        error: 'No data found', 
        message: 'DBF file contains no records' 
      });
    }
    
    console.log(`📊 Found ${records.length} records in DBF file`);
    console.log(`📋 First record keys: ${Object.keys(records[0]).join(', ')}`);
    
    // Save as CSV
    try {
      await dbfReader.saveAsCSV(csvPath);
      console.log(`✅ Converted to CSV: ${csvPath}`);
      
      // Verify CSV file was created and has content
      if (!fs.existsSync(csvPath)) {
        throw new Error('CSV file was not created after conversion');
      }
      
      const stats = fs.statSync(csvPath);
      console.log(`📄 CSV file size: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        throw new Error('CSV file was created but is empty');
      }
      
    } catch (csvError) {
      console.error('❌ CSV conversion failed:', csvError);
      throw new Error(`Failed to convert DBF to CSV: ${csvError.message}`);
    }
    
    // Step 3: Clear existing data and import
    console.log('🗑️ Clearing existing stock data...');
    const connection = await pool.getConnection();
    
    try {
      // Clean up old backups (keep only 1 backup)
      console.log('🧹 Cleaning up old stock backups...');
      const [oldBackups] = await connection.execute(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME LIKE 'tbl_stock_backup_%'
        ORDER BY CREATE_TIME DESC
      `);
      
      // Keep only the most recent backup, delete the rest
      if (oldBackups.length > 1) {
        for (let i = 1; i < oldBackups.length; i++) {
          await connection.execute(`DROP TABLE ${oldBackups[i].TABLE_NAME}`);
          console.log(`🗑️ Deleted old backup: ${oldBackups[i].TABLE_NAME}`);
        }
      }
      
      // Create new backup
      const backupTableName = `tbl_stock_backup_${Date.now()}`;
      await connection.execute(`CREATE TABLE ${backupTableName} AS SELECT * FROM tbl_stock`);
      console.log(`📦 Created backup table: ${backupTableName}`);
      
      // Clear data
      await connection.beginTransaction();
      
      try {
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        const [clearResult] = await connection.execute('DELETE FROM tbl_stock');
        await connection.execute('ALTER TABLE tbl_stock AUTO_INCREMENT = 1');
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        await connection.commit();
        
        console.log(`🗑️ Cleared ${clearResult.affectedRows} existing records`);
        
    // Step 4: Import CSV data
    console.log('📥 Importing CSV data...');
    
    // Check if CSV file was created successfully
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file was not created: ${csvPath}`);
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf8');
        const lines = csvContent.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
          throw new Error('CSV file is empty or has no data rows');
        }
        
        const header = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));
        console.log('📋 CSV Headers:', header);
        
        // Improved CSV parsing function
        const parseCSVLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };
        
        // Import data in batches
        const batchSize = 1000;
        let batch = [];
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 1; i < lines.length; i++) {
          try {
            const values = parseCSVLine(lines[i]);
            
            // Map CSV values to database columns
            const dbValues = [
              values[0] || null,  // DINFLAG
              values[1] || null,  // BENZ
              values[2] || null,  // BENZ2
              values[3] || null,  // BENZ3
              values[4] || null,  // BRAND
              values[5] || null,  // ALTNO
              values[6] || null,  // ALTNO2
              values[7] || null,  // COLORCODE
              values[8] || null,  // REMARKS
              values[9] || null,  // DATE
              Math.min(parseFloat(values[10]) || 0, 99999999.99),  // COST
              Math.min(parseFloat(values[11]) || 0, 99999999.99),  // SELL
              parseInt(values[12]) || 0,    // QTY
              values[13] || null, // CURRENCY
              parseFloat(values[14]) || 0,  // FCAMOUNT
              parseFloat(values[15]) || 0,  // CONVERSION
              values[16] || null  // LOCATION
            ];
            
            batch.push(dbValues);
            
            if (batch.length >= batchSize) {
              const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
              const flatBatch = batch.flat();
              await connection.execute(`
                INSERT INTO tbl_stock (DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, COLORCODE, REMARKS, DATE, COST, SELL, QTY, CURRENCY, FCAMOUNT, CONVERSION, LOCATION)
                VALUES ${placeholders}
              `, flatBatch);
              successCount += batch.length;
              batch = [];
              
              // Progress update
              if (successCount % 10000 === 0) {
                console.log(`📊 Imported ${successCount} records...`);
              }
            }
            
          } catch (error) {
            console.error(`❌ Error processing line ${i}:`, error.message);
            errorCount++;
          }
        }
        
        // Process remaining batch
        if (batch.length > 0) {
          const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
          const flatBatch = batch.flat();
          await connection.execute(`
            INSERT INTO tbl_stock (DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, COLORCODE, REMARKS, DATE, COST, SELL, QTY, CURRENCY, FCAMOUNT, CONVERSION, LOCATION)
            VALUES ${placeholders}
          `, flatBatch);
          successCount += batch.length;
        }
        
        // Verify import
        const [result] = await connection.execute('SELECT COUNT(*) as total FROM tbl_stock');
        
        // Clean up files
        fs.unlinkSync(localDbfPath);
        fs.unlinkSync(csvPath);
        
        console.log('✅ Automated DBF conversion and import completed successfully');
        console.log(`📊 Imported: ${successCount} records`);
        console.log(`❌ Errors: ${errorCount} records`);
        console.log(`📊 Total in tbl_stock: ${result[0].total}`);
        
        res.json({
          success: true,
          message: 'DBF converted and imported successfully',
          imported: successCount,
          errors: errorCount,
          total: result[0].total,
          backupTable: backupTableName,
          sourceFile: sourceDbfPath
        });
        
      } catch (importError) {
        await connection.rollback();
        console.error('❌ Import failed, transaction rolled back:', importError);
        throw importError;
      }
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Automated DBF conversion error:', error);
    res.status(500).json({ 
      error: 'DBF conversion failed', 
      message: error.message 
    });
  }
});

// Convert MASTER.DBF to CSV and import automatically (DESCRIPTION ADJUSTMENT)
// Import incoming.dbf to inc_tbl
app.post('/api/incoming/import-dbf', authenticateToken, async (req, res) => {
  try {
    const { tabNumber } = req.body;
    console.log(`🔄 Starting INCOMING.DBF import to inc_tbl for Tab ${tabNumber}...`);
    
    const fs = require('fs');
    const path = require('path');
    
    // Step 1: Copy DBF from C:\Rae\Files to convert folder
    const sourceDbfPath = 'C:\\Rae\\Files\\INCOMING.DBF';
    const convertDir = path.join(__dirname, 'convert');
    const localDbfPath = path.join(convertDir, 'INCOMING.DBF');
    const csvPath = path.join(convertDir, 'INCOMING.CSV');
    
    console.log(`📁 Source INCOMING DBF: ${sourceDbfPath}`);
    console.log(`📁 Convert folder: ${convertDir}`);
    
    // Check if source DBF exists
    if (!fs.existsSync(sourceDbfPath)) {
      return res.status(404).json({ 
        error: 'Source INCOMING.DBF file not found', 
        message: `File not found: ${sourceDbfPath}` 
      });
    }
    
    // Ensure convert directory exists
    if (!fs.existsSync(convertDir)) {
      fs.mkdirSync(convertDir, { recursive: true });
      console.log(`📁 Created convert directory: ${convertDir}`);
    }
    
    // Copy DBF file
    console.log('📋 Copying INCOMING.DBF file...');
    fs.copyFileSync(sourceDbfPath, localDbfPath);
    console.log(`✅ Copied INCOMING.DBF to: ${localDbfPath}`);
    
    // Step 2: Convert DBF to CSV
    console.log('🔄 Converting INCOMING.DBF to CSV...');
    const dbfReader = new DBFReader(localDbfPath);
    const records = await dbfReader.read();
    
    if (records.length === 0) {
      return res.status(400).json({ 
        error: 'No data found', 
        message: 'INCOMING.DBF file contains no records' 
      });
    }
    
    console.log(`📊 Found ${records.length} records in INCOMING.DBF file`);
    
    // Save as CSV
    await dbfReader.saveAsCSV(csvPath);
    console.log(`✅ Converted to CSV: ${csvPath}`);
    
    // Step 3: Import to inc_tbl
    console.log('📥 Starting import to inc_tbl...');
    
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      let successCount = 0;
      let errorCount = 0;
      const errors = [];
      
      for (const record of records) {
        try {
          // Map DBF fields to inc_tbl fields
          const incData = {
            supplier: record.SUPPLIER || '',
            date: record.DATE ? record.DATE.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, ''),
            reference: record.REF || '',
            din_flag: record.DINFLAG || '',
            benz_number: record.BENZ || '',
            benz_number2: record.BENZ2 || '',
            benz_number3: record.BENZ3 || '',
            brand: record.BRAND || '',
            altno: record.ALTNO || '',
            altno2: record.ALTNO2 || '',
            description: record.DESC || '',
            application: record.APPL || '',
            color_code: record.COLORCODE || '',
            remarks: record.REMARKS || '',
            cost: parseFloat(record.COST) || 0,
            selling_price: parseFloat(record.SELL) || 0,
            quantity: parseFloat(record.QTY) || 0,
            currency: record.CURRENCY || 'PHP',
            fc_cost: parseFloat(record.FCAMOUNT) || 0,
            conversion: parseFloat(record.CONVERSION) || 1,
            location: record.LOCATION || '',
            tab_number: tabNumber || 1 // Use provided tab number or default to Tab 1
          };
          
          // Insert into inc_tbl
          await connection.execute(`
            INSERT INTO inc_tbl (
              SUPPLIER, DATE, REF, DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2,
              \`DESC\`, APPL, COLORCODE, REMARKS, COST, SELL, QTY, CURRENCY, FCAMOUNT, 
              CONVERSION, LOCATION, tab_number
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            incData.supplier, incData.date, incData.reference, incData.din_flag,
            incData.benz_number, incData.benz_number2, incData.benz_number3, incData.brand,
            incData.altno, incData.altno2, incData.description, incData.application,
            incData.color_code, incData.remarks, incData.cost, incData.selling_price,
            incData.quantity, incData.currency, incData.fc_cost, incData.conversion,
            incData.location, incData.tab_number
          ]);
          
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push({
            record: record,
            error: error.message
          });
          console.error(`❌ Error importing record:`, error.message);
        }
      }
      
      await connection.commit();
      console.log(`✅ Import completed: ${successCount} successful, ${errorCount} errors`);
      
      res.json({
        success: true,
        message: 'INCOMING.DBF imported successfully to inc_tbl',
        imported: successCount,
        errors: errorCount,
        total: records.length,
        sourceFile: sourceDbfPath
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Error importing INCOMING.DBF:', error);
    res.status(500).json({
      success: false,
      error: 'Import failed',
      message: error.message
    });
  }
});

// Auto-populate Description/Application for imported items
app.post('/api/incoming/autopopulate-descriptions', authenticateToken, async (req, res) => {
  try {
    const { tabNumber } = req.body;
    console.log(`🔄 Auto-populating Description/Application for Tab ${tabNumber}...`);
    
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Get all items from the specified tab
      const [items] = await connection.execute(
        'SELECT id, BENZ, BRAND, ALTNO, `DESC`, APPL FROM inc_tbl WHERE tab_number = ?',
        [tabNumber]
      );
      
      let updatedCount = 0;
      
      for (const item of items) {
        let masterRecords = [];
        let query = '';
        let params = [];
        
        // Use flexible lookup logic (same as form lookup)
        // Try multiple lookup strategies in order of specificity
        if (item.BENZ && item.BRAND && item.ALTNO) {
          // First try: BENZ + BRAND + ALTNO (most specific)
          query = 'SELECT `DESC`, APPL FROM master WHERE BENZ = ? AND BRAND = ? AND ALTNO = ?';
          params = [item.BENZ, item.BRAND, item.ALTNO];
          [masterRecords] = await connection.execute(query, params);
        }
        
        if (masterRecords.length === 0 && item.BENZ && item.BRAND) {
          // Fallback: BENZ + BRAND (when ALTNO is empty/null)
          query = 'SELECT `DESC`, APPL FROM master WHERE BENZ = ? AND BRAND = ?';
          params = [item.BENZ, item.BRAND];
          [masterRecords] = await connection.execute(query, params);
        }
        
        if (masterRecords.length === 0 && item.BRAND && item.ALTNO) {
          // Fallback: BRAND + ALTNO
          query = 'SELECT `DESC`, APPL FROM master WHERE BRAND = ? AND ALTNO = ?';
          params = [item.BRAND, item.ALTNO];
          [masterRecords] = await connection.execute(query, params);
        }
        
        if (masterRecords.length === 0 && item.BENZ) {
          // Fallback: BENZ only
          query = 'SELECT `DESC`, APPL FROM master WHERE BENZ = ?';
          params = [item.BENZ];
          [masterRecords] = await connection.execute(query, params);
        }
        
        if (masterRecords.length > 0) {
          const master = masterRecords[0];
          const newDescription = master.DESC || '';
          const newApplication = master.APPL || '';
          
          // Only update if different from current values
          if (newDescription !== item.DESC || newApplication !== item.APPL) {
            await connection.execute(
              'UPDATE inc_tbl SET `DESC` = ?, APPL = ? WHERE id = ?',
              [newDescription, newApplication, item.id]
            );
            updatedCount++;
            console.log(`✅ Updated item ${item.id}: "${newDescription}" / "${newApplication}"`);
          }
        }
      }
      
      await connection.commit();
      
      res.json({
        success: true,
        message: `Auto-populated ${updatedCount} items with Description/Application`,
        updated: updatedCount,
        total: items.length
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Error auto-populating descriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Auto-populate failed',
      message: error.message
    });
  }
});

app.post('/api/master/convert-and-import-dbf', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Starting MASTER.DBF conversion and import (Description Adjustment)...');
    
    const fs = require('fs');
    const path = require('path');
    
    // Step 1: Copy DBF from C:\Rae\Files to convert folder
    const sourceDbfPath = 'C:\\Rae\\Files\\MASTER.DBF';
    const convertDir = path.join(__dirname, 'convert');
    const localDbfPath = path.join(convertDir, 'MASTER.DBF');
    const csvPath = path.join(convertDir, 'MASTER.CSV');
    
    console.log(`📁 Source MASTER DBF: ${sourceDbfPath}`);
    console.log(`📁 Convert folder: ${convertDir}`);
    
    // Check if source DBF exists
    if (!fs.existsSync(sourceDbfPath)) {
      return res.status(404).json({ 
        error: 'Source MASTER.DBF file not found', 
        message: `File not found: ${sourceDbfPath}` 
      });
    }
    
    // Ensure convert directory exists
    if (!fs.existsSync(convertDir)) {
      fs.mkdirSync(convertDir, { recursive: true });
      console.log(`📁 Created convert directory: ${convertDir}`);
    }
    
    // Copy DBF file
    console.log('📋 Copying MASTER.DBF file...');
    fs.copyFileSync(sourceDbfPath, localDbfPath);
    console.log(`✅ Copied MASTER.DBF to: ${localDbfPath}`);
    
    // Step 2: Convert DBF to CSV
    console.log('🔄 Converting MASTER.DBF to CSV...');
    const dbfReader = new DBFReader(localDbfPath);
    const records = await dbfReader.read();
    
    if (records.length === 0) {
      return res.status(400).json({ 
        error: 'No data found', 
        message: 'MASTER.DBF file contains no records' 
      });
    }
    
    console.log(`📊 Found ${records.length} records in MASTER.DBF file`);
    
    // Save as CSV
    await dbfReader.saveAsCSV(csvPath);
    console.log(`✅ Converted to CSV: ${csvPath}`);
    
    // Step 3: Clear existing data and import
    console.log('🗑️ Clearing existing master data...');
    const connection = await pool.getConnection();
    
    try {
      // Clean up old backups (keep only 1 backup)
      console.log('🧹 Cleaning up old master backups...');
      const [oldBackups] = await connection.execute(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME LIKE 'master_backup_%'
        ORDER BY CREATE_TIME DESC
      `);
      
      // Keep only the most recent backup, delete the rest
      if (oldBackups.length > 1) {
        for (let i = 1; i < oldBackups.length; i++) {
          await connection.execute(`DROP TABLE ${oldBackups[i].TABLE_NAME}`);
          console.log(`🗑️ Deleted old backup: ${oldBackups[i].TABLE_NAME}`);
        }
      }
      
      // Create new backup
      const backupTableName = `master_backup_${Date.now()}`;
      await connection.execute(`CREATE TABLE ${backupTableName} AS SELECT * FROM master`);
      console.log(`📦 Created backup table: ${backupTableName}`);
      
      // Clear data
      await connection.beginTransaction();
      
      try {
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        const [clearResult] = await connection.execute('DELETE FROM master');
        await connection.execute('ALTER TABLE master AUTO_INCREMENT = 1');
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        await connection.commit();
        
        console.log(`🗑️ Cleared ${clearResult.affectedRows} existing master records`);
        
        // Step 4: Import CSV data
        console.log('📥 Importing MASTER.CSV data...');
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          throw new Error('CSV file has no data rows');
        }
        
        // Parse CSV with proper handling of quoted fields and embedded commas
        function parseCSVLine(line) {
          const result = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          
          result.push(current.trim());
          return result;
        }
        
        const headers = parseCSVLine(lines[0]);
        console.log(`📋 CSV Headers: ${headers.join(', ')}`);
        
        let successCount = 0;
        let errorCount = 0;
        const batchSize = 1000;
        let batch = [];
        
        // Process each line
        for (let i = 1; i < lines.length; i++) {
          try {
            const values = parseCSVLine(lines[i]);
            
            // Ensure we have exactly 13 columns (DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, DESC, APPL, UNIT, LOCATION, REORDER, BALANCE)
            if (values.length !== 13) {
              console.warn(`⚠️ Line ${i + 1}: Column count mismatch (${values.length} vs 13) - skipping`);
              errorCount++;
              continue;
            }
            
            // Map CSV columns to master table columns
            const dbValues = [
              values[0] ? values[0].trim() : null, // DINFLAG
              values[1] ? values[1].trim() : null, // BENZ
              values[2] ? values[2].trim() : null, // BENZ2
              values[3] ? values[3].trim() : null, // BENZ3
              values[4] ? values[4].trim() : null, // BRAND
              values[5] ? values[5].trim() : null, // ALTNO
              values[6] ? values[6].trim() : null, // ALTNO2
              values[7] ? values[7].trim() : null, // DESC
              values[8] ? values[8].trim() : null, // APPL
              values[9] ? values[9].trim() : null, // UNIT
              values[10] ? values[10].trim() : null, // LOCATION
              values[11] && values[11].trim() ? parseInt(values[11].trim()) || null : null, // REORDER
              values[12] && values[12].trim() ? parseInt(values[12].trim()) || null : null  // BALANCE
            ];
            
            batch.push(dbValues);
            
            if (batch.length >= batchSize) {
              const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
              const flatBatch = batch.flat();
              await connection.execute(`
                INSERT INTO master (DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, \`DESC\`, APPL, UNIT, LOCATION, REORDER, BALANCE)
                VALUES ${placeholders}
              `, flatBatch);
              successCount += batch.length;
              batch = [];
              
              // Progress update
              if (successCount % 1000 === 0) {
                console.log(`📊 Imported ${successCount} master records...`);
              }
            }
            
          } catch (error) {
            console.error(`❌ Error processing master line ${i}:`, error.message);
            errorCount++;
          }
        }
        
        // Process remaining batch
        if (batch.length > 0) {
          const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
          const flatBatch = batch.flat();
          await connection.execute(`
            INSERT INTO master (DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, \`DESC\`, APPL, UNIT, LOCATION, REORDER, BALANCE)
            VALUES ${placeholders}
          `, flatBatch);
          successCount += batch.length;
        }
        
        // Verify import
        const [result] = await connection.execute('SELECT COUNT(*) as total FROM master');
        
        // Clean up files
        fs.unlinkSync(localDbfPath);
        fs.unlinkSync(csvPath);
        
        console.log('✅ MASTER.DBF conversion and import completed successfully');
        console.log(`📊 Imported: ${successCount} master records`);
        console.log(`❌ Errors: ${errorCount} master records`);
        console.log(`📊 Total in master: ${result[0].total}`);
        
        res.json({
          success: true,
          message: 'MASTER.DBF converted and imported successfully (Description Adjustment)',
          imported: successCount,
          errors: errorCount,
          total: result[0].total,
          backupTable: backupTableName,
          sourceFile: sourceDbfPath
        });
        
      } catch (importError) {
        await connection.rollback();
        console.error('❌ Master import failed, transaction rolled back:', importError);
        throw importError;
      }
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ MASTER.DBF conversion error:', error);
    res.status(500).json({ 
      error: 'MASTER.DBF conversion failed', 
      message: error.message 
    });
  }
});

// Location Adjustment from STKADES.DBF
app.post('/api/location/convert-and-import-dbf', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Starting stkadres.dbf conversion and import (Location Adjustment)...');
    
    const fs = require('fs');
    const path = require('path');
    
    // Step 1: Copy DBF from C:\Rae\Files to convert folder
    const sourceDbfPath = 'C:\\Rae\\Files\\stkadres.dbf';
    const convertDir = path.join(__dirname, 'convert');
    const localDbfPath = path.join(convertDir, 'STKADES.DBF');
    const csvPath = path.join(convertDir, 'STKADES.CSV');
    
    console.log(`📁 Source STKADES DBF: ${sourceDbfPath}`);
    console.log(`📁 Convert folder: ${convertDir}`);
    
    // Check if source DBF exists
    if (!fs.existsSync(sourceDbfPath)) {
      return res.status(404).json({ 
        error: 'Source stkadres.dbf file not found', 
        message: `File not found: ${sourceDbfPath}` 
      });
    }
    
    // Ensure convert directory exists
    if (!fs.existsSync(convertDir)) {
      fs.mkdirSync(convertDir, { recursive: true });
      console.log(`📁 Created convert directory: ${convertDir}`);
    }
    
    // Copy DBF file
    console.log('📋 Copying stkadres.dbf file...');
    fs.copyFileSync(sourceDbfPath, localDbfPath);
    console.log(`✅ Copied stkadres.dbf to: ${localDbfPath}`);
    
    // Step 2: Convert DBF to CSV
    console.log('🔄 Converting stkadres.dbf to CSV...');
    const dbfReader = new DBFReader(localDbfPath);
    const records = await dbfReader.read();
    
    if (records.length === 0) {
      return res.status(400).json({ 
        error: 'No data found', 
        message: 'stkadres.dbf file contains no records' 
      });
    }
    
    console.log(`📊 Found ${records.length} records in stkadres.dbf file`);
    
    // Save as CSV
    await dbfReader.saveAsCSV(csvPath);
    console.log(`✅ Converted to CSV: ${csvPath}`);
    
    // Step 3: Clear existing data and import
    console.log('🗑️ Clearing existing location data...');
    const connection = await pool.getConnection();
    
    try {
      // Clean up old backups (keep only 1 backup)
      console.log('🧹 Cleaning up old location backups...');
      const [oldBackups] = await connection.execute(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME LIKE 'location_backup_%'
        ORDER BY CREATE_TIME DESC
      `);
      
      // Keep only the most recent backup, delete the rest
      if (oldBackups.length > 1) {
        for (let i = 1; i < oldBackups.length; i++) {
          await connection.execute(`DROP TABLE ${oldBackups[i].TABLE_NAME}`);
          console.log(`🗑️ Deleted old backup: ${oldBackups[i].TABLE_NAME}`);
        }
      }
      
      // Create new backup
      const backupTableName = `location_backup_${Date.now()}`;
      await connection.execute(`CREATE TABLE ${backupTableName} AS SELECT * FROM location`);
      console.log(`📦 Created backup table: ${backupTableName}`);
      
      // Clear data
      await connection.beginTransaction();
      
      try {
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        const [clearResult] = await connection.execute('DELETE FROM location');
        await connection.execute('ALTER TABLE location AUTO_INCREMENT = 1');
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        await connection.commit();
        
        console.log(`🗑️ Cleared ${clearResult.affectedRows} existing location records`);
        
        // Step 4: Import CSV data
        console.log('📥 Importing STKADES.CSV data...');
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const lines = csvContent.split('\n');
        
        if (lines.length < 2) {
          throw new Error('CSV file has no data rows');
        }
        
        // Parse CSV with proper handling of quoted fields and embedded commas
        function parseCSVLine(line) {
          const result = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          
          result.push(current.trim());
          return result;
        }
        
        const headers = parseCSVLine(lines[0]);
        console.log(`📋 CSV Headers: ${headers.join(', ')}`);
        
        let successCount = 0;
        let errorCount = 0;
        const batchSize = 1000;
        let batch = [];
        
        // Determine expected column count from headers
        const expectedColumns = headers.length;
        console.log(`📊 Expected ${expectedColumns} columns based on headers`);
        
        // Process each line
        for (let i = 1; i < lines.length; i++) {
          try {
            // Skip completely empty lines (just newline characters)
            if (!lines[i].trim()) {
              // Insert empty row to preserve position
              batch.push(['']);
              continue;
            }
            
            const values = parseCSVLine(lines[i]);
            
            // Ensure we have matching column count
            if (values.length !== expectedColumns) {
              console.warn(`⚠️ Line ${i + 1}: Column count mismatch (${values.length} vs ${expectedColumns}) - skipping`);
              errorCount++;
              continue;
            }
            
            // Map LOCATION column to location_code in database
            // The CSV has only 1 column: LOCATION, which maps to location_code in our table
            const locationCode = values[0] ? values[0].trim() : '';
            
            // Insert all rows, including empty ones, to preserve row positions
            batch.push([locationCode]);
            
            if (batch.length >= batchSize) {
              const placeholdersBatch = batch.map(() => '(?)').join(', ');
              const flatBatch = batch.flat();
              await connection.execute(`
                INSERT INTO location (location_code)
                VALUES ${placeholdersBatch}
              `, flatBatch);
              successCount += batch.length;
              batch = [];
              
              // Progress update
              if (successCount % 1000 === 0) {
                console.log(`📊 Imported ${successCount} location records...`);
              }
            }
            
          } catch (error) {
            console.error(`❌ Error processing location line ${i}:`, error.message);
            errorCount++;
          }
        }
        
        // Process remaining batch
        if (batch.length > 0) {
          const placeholdersBatch = batch.map(() => '(?)').join(', ');
          const flatBatch = batch.flat();
          await connection.execute(`
            INSERT INTO location (location_code)
            VALUES ${placeholdersBatch}
          `, flatBatch);
          successCount += batch.length;
        }
        
        // Verify import
        const [result] = await connection.execute('SELECT COUNT(*) as total FROM location');
        
        // Clean up files
        fs.unlinkSync(localDbfPath);
        fs.unlinkSync(csvPath);
        
        console.log('✅ stkadres.dbf conversion and import completed successfully');
        console.log(`📊 Imported: ${successCount} location records`);
        console.log(`❌ Errors: ${errorCount} location records`);
        console.log(`📊 Total in location: ${result[0].total}`);
        
        res.json({
          success: true,
          message: 'stkadres.dbf converted and imported successfully (Location Adjustment)',
          imported: successCount,
          errors: errorCount,
          total: result[0].total,
          backupTable: backupTableName,
          sourceFile: sourceDbfPath
        });
        
      } catch (importError) {
        await connection.rollback();
        console.error('❌ Location import failed, transaction rolled back:', importError);
        throw importError;
      }
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Error converting stkadres.dbf:', error);
    res.status(500).json({ 
      error: 'stkadres.dbf conversion failed', 
      message: error.message 
    });
  }
});

// ===== DBF REFRESH ENDPOINTS =====

// Clear all stock data
app.delete('/api/stock/clear-all', authenticateToken, async (req, res) => {
  try {
    console.log('🗑️ Clearing all stock data...');
    
    const connection = await pool.getConnection();
    
    try {
      // Create backup before clearing
      const backupTableName = `tbl_stock_backup_${Date.now()}`;
      await connection.execute(`CREATE TABLE ${backupTableName} AS SELECT * FROM tbl_stock`);
      console.log(`📦 Created backup table: ${backupTableName}`);
      
      // Clear all data with proper transaction handling
      await connection.beginTransaction();
      
      try {
        // Disable foreign key checks temporarily
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        
        // Clear all data
        const [result] = await connection.execute('DELETE FROM tbl_stock');
        console.log(`🗑️ Cleared ${result.affectedRows} records from tbl_stock`);
        
        // Reset auto increment
        await connection.execute('ALTER TABLE tbl_stock AUTO_INCREMENT = 1');
        
        // Re-enable foreign key checks
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        
        // Commit the transaction
        await connection.commit();
        console.log('✅ Data clearing transaction committed successfully');
        
      } catch (clearError) {
        // Rollback on error
        await connection.rollback();
        console.error('❌ Error clearing data, transaction rolled back:', clearError);
        throw clearError;
      }
      
      res.json({ 
        success: true, 
        message: `Cleared ${result.affectedRows} records`,
        backupTable: backupTableName
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Error clearing stock data:', error);
    res.status(500).json({ 
      error: 'Failed to clear stock data', 
      message: error.message 
    });
  }
});

// Convert DBF to CSV and refresh stock data
app.post('/api/stock/refresh-from-dbf', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Starting DBF refresh process...');
    
    const { dbfPath } = req.body;
    const defaultDbfPath = path.join(__dirname, 'CSV FILES', 'STOCKS.DBF');
    const sourceDbfPath = dbfPath || defaultDbfPath;
    
    console.log(`📁 Source DBF file: ${sourceDbfPath}`);
    
    // Check if DBF file exists
    const fs = require('fs');
    if (!fs.existsSync(sourceDbfPath)) {
      return res.status(404).json({ 
        error: 'DBF file not found', 
        message: `File not found: ${sourceDbfPath}` 
      });
    }
    
    // Step 1: Read and convert DBF to CSV
    console.log('📖 Reading DBF file...');
    const dbfReader = new DBFReader(sourceDbfPath);
    const records = await dbfReader.read();
    
    if (records.length === 0) {
      return res.status(400).json({ 
        error: 'No data found', 
        message: 'DBF file contains no records' 
      });
    }
    
    // Step 2: Create CSV file
    const csvPath = path.join(__dirname, 'temp', `stock_refresh_${Date.now()}.csv`);
    await dbfReader.saveAsCSV(csvPath);
    
    // Step 3: Clear existing stock data
    console.log('🗑️ Clearing existing stock data...');
    const connection = await pool.getConnection();
    
    try {
      // Create backup
      const backupTableName = `tbl_stock_backup_${Date.now()}`;
      await connection.execute(`CREATE TABLE ${backupTableName} AS SELECT * FROM tbl_stock`);
      console.log(`📦 Created backup table: ${backupTableName}`);
      
      // Clear data with proper transaction handling
      await connection.beginTransaction();
      
      try {
        // Disable foreign key checks temporarily
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        
        // Clear all data
        const [clearResult] = await connection.execute('DELETE FROM tbl_stock');
        console.log(`🗑️ Cleared ${clearResult.affectedRows} existing records`);
        
        // Reset auto increment
        await connection.execute('ALTER TABLE tbl_stock AUTO_INCREMENT = 1');
        
        // Re-enable foreign key checks
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        
        // Commit the transaction
        await connection.commit();
        console.log('✅ Data clearing transaction committed successfully');
        
        // Return backup info for user confirmation
        res.json({
          success: true,
          message: 'Database cleared successfully',
          cleared: true,
          backupTable: backupTableName,
          clearedRecords: clearResult.affectedRows,
          csvPath: csvPath,
          requiresConfirmation: true
        });
        return; // Stop here, don't import yet
        
      } catch (clearError) {
        // Rollback on error
        await connection.rollback();
        console.error('❌ Error clearing data, transaction rolled back:', clearError);
        throw clearError;
      }
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ DBF refresh error:', error);
    res.status(500).json({ 
      error: 'DBF refresh failed', 
      message: error.message 
    });
  }
});

// Continue import after user confirmation
app.post('/api/stock/continue-import', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Continuing import after user confirmation...');
    
    const { csvPath } = req.body;
    const fs = require('fs');
    
    if (!csvPath || !fs.existsSync(csvPath)) {
      return res.status(400).json({ 
        error: 'CSV file not found', 
        message: 'CSV file path is required and must exist' 
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      // Step 4: Import new data from CSV
      console.log('📥 Importing new data from CSV...');
      const csvContent = fs.readFileSync(csvPath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim() !== '');
      
      if (lines.length < 2) {
        throw new Error('CSV file is empty or has no data rows');
      }
      
      const header = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));
      console.log('📋 CSV Headers:', header);
      
      // Insert data in batches
      const batchSize = 1000;
      let batch = [];
      let successCount = 0;
      let errorCount = 0;
      
      // Improved CSV parsing function
      const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = parseCSVLine(lines[i]);
          
          // Debug logging for first few records
          if (i <= 3) {
            console.log(`📋 Line ${i} parsed values:`, values.slice(0, 5), '...');
          }
          
          // Map CSV values to database columns (adjust based on your DBF structure)
          const dbValues = [
            values[0] || null,  // DINFLAG
            values[1] || null,  // BENZ
            values[2] || null,  // BENZ2
            values[3] || null,  // BENZ3
            values[4] || null,  // BRAND
            values[5] || null,  // ALTNO
            values[6] || null,  // ALTNO2
            values[7] || null,  // COLORCODE
            values[8] || null,  // REMARKS
            values[9] || null,  // DATE
            (() => {
              const costValue = parseFloat(values[10]) || 0;
              if (costValue > 99999999.99) {
                console.log(`⚠️ Capping COST value ${costValue} to 99999999.99 for stock import`);
              }
              return Math.min(costValue, 99999999.99);
            })(),  // COST (capped at decimal(10,2) max)
            Math.min(parseFloat(values[11]) || 0, 99999999.99),  // SELL (capped at decimal(10,2) max)
            parseInt(values[12]) || 0,    // QTY
            values[13] || null, // CURRENCY
            parseFloat(values[14]) || 0,  // FCAMOUNT
            parseFloat(values[15]) || 0,  // CONVERSION
            values[16] || null  // LOCATION
          ];
          
          batch.push(dbValues);
          
          if (batch.length >= batchSize) {
            const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
            const flatBatch = batch.flat();
            await connection.execute(`
              INSERT INTO tbl_stock (DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, COLORCODE, REMARKS, DATE, COST, SELL, QTY, CURRENCY, FCAMOUNT, CONVERSION, LOCATION)
              VALUES ${placeholders}
            `, flatBatch);
            successCount += batch.length;
            batch = [];
          }
          
        } catch (error) {
          console.error(`❌ Error processing line ${i}:`, error.message);
          errorCount++;
        }
      }
      
      // Process remaining batch
      if (batch.length > 0) {
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const flatBatch = batch.flat();
        await connection.execute(`
          INSERT INTO tbl_stock (DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, COLORCODE, REMARKS, DATE, COST, SELL, QTY, CURRENCY, FCAMOUNT, CONVERSION, LOCATION)
          VALUES ${placeholders}
        `, flatBatch);
        successCount += batch.length;
      }
      
      // Verify import
      const [result] = await connection.execute('SELECT COUNT(*) as total FROM tbl_stock');
      
      // Clean up temporary CSV file
      fs.unlinkSync(csvPath);
      
      console.log('✅ DBF refresh completed successfully');
      console.log(`📊 Imported: ${successCount} records`);
      console.log(`❌ Errors: ${errorCount} records`);
      console.log(`📊 Total in tbl_stock: ${result[0].total}`);
      
      res.json({
        success: true,
        message: 'Stock data refreshed successfully from DBF',
        imported: successCount,
        errors: errorCount,
        total: result[0].total,
        sourceFile: csvPath
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Continue import error:', error);
    res.status(500).json({ 
      error: 'Continue import failed', 
      message: error.message 
    });
  }
});

// Revert to backup after clearing
app.post('/api/stock/revert-to-backup', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Reverting to backup...');
    
    const { backupTable } = req.body;
    
    if (!backupTable) {
      return res.status(400).json({ 
        error: 'Backup table required', 
        message: 'Backup table name is required' 
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      // Check if backup table exists
      const [tables] = await connection.execute(
        'SHOW TABLES LIKE ?', 
        [backupTable]
      );
      
      if (tables.length === 0) {
        return res.status(404).json({ 
          error: 'Backup not found', 
          message: `Backup table ${backupTable} does not exist` 
        });
      }
      
      // Clear current data
      await connection.beginTransaction();
      
      try {
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        await connection.execute('DELETE FROM tbl_stock');
        await connection.execute('ALTER TABLE tbl_stock AUTO_INCREMENT = 1');
        
        // Restore from backup
        await connection.execute(`INSERT INTO tbl_stock SELECT * FROM ${backupTable}`);
        
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        await connection.commit();
        
        // Get count of restored records
        const [result] = await connection.execute('SELECT COUNT(*) as total FROM tbl_stock');
        
        console.log('✅ Successfully reverted to backup');
        console.log(`📊 Restored: ${result[0].total} records`);
        
        res.json({
          success: true,
          message: 'Successfully reverted to backup',
          restored: result[0].total,
          backupTable: backupTable
        });
        
      } catch (revertError) {
        await connection.rollback();
        console.error('❌ Error reverting to backup, transaction rolled back:', revertError);
        throw revertError;
      }
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Revert to backup error:', error);
    res.status(500).json({ 
      error: 'Revert to backup failed', 
      message: error.message 
    });
  }
});

// ===== TBL_STOCK DIRECT ADD ENDPOINT =====

// Add stock directly to tbl_stock (TRACK.exe style)
app.post('/api/tbl-stock/add', authenticateToken, async (req, res) => {
  try {
    console.log('📦 Adding stock directly to tbl_stock...');
    
    const {
      date,
      reference,
      supplier,
      din_flag,
      benz_number,
      benz_number2,
      benz_number3,
      brand,
      altno,
      altno2,
      description,
      application,
      color_code,
      remarks,
      cost,
      selling_price,
      currency,
      fc_cost,
      conversion,
      quantity,
      unit,
      reorder_point,
      location,
      document_ref
    } = req.body;

    // Validate required fields
    if (!benz_number || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Benz Number and Quantity are required'
      });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Insert into tbl_stock
      const insertSql = `
        INSERT INTO tbl_stock (
          DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, 
          COLORCODE, REMARKS, DATE, COST, SELL, QTY, CURRENCY, 
          FCAMOUNT, CONVERSION, LOCATION
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        din_flag || '',
        benz_number,
        benz_number2 || '',
        benz_number3 || '',
        brand || '',
        altno || '',
        altno2 || '',
        color_code || '',
        remarks || '',
        date || new Date().toISOString().split('T')[0],
        parseFloat(cost) || 0,
        parseFloat(selling_price) || 0,
        parseInt(quantity) || 0,
        currency || 'PHP',
        parseFloat(fc_cost) || 0,
        parseFloat(conversion) || 1,
        location || ''
      ];

      const [result] = await connection.execute(insertSql, params);
      
      // Also insert into products table for compatibility
      const productInsertSql = `
        INSERT INTO products (
          name, description, brand, part_number, oem_number, 
          cost_price, selling_price, quantity, location, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      
      const productParams = [
        `${brand || ''} ${description || ''}`.trim() || 'Auto Part',
        description || '',
        brand || '',
        benz_number,
        altno || '',
        parseFloat(cost) || 0,
        parseFloat(selling_price) || 0,
        parseInt(quantity) || 0,
        location || ''
      ];

      await connection.execute(productInsertSql, productParams);

      await connection.commit();

      console.log(`✅ Stock added successfully with ID: ${result.insertId}`);
      
      res.json({
        success: true,
        message: 'Stock added successfully',
        stockId: result.insertId
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Error adding stock to tbl_stock:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add stock: ' + error.message
    });
  }
});

// ===== MASTER DBF REFRESH ENDPOINTS =====

// Clear all master data
app.delete('/api/master/clear-all', authenticateToken, async (req, res) => {
  try {
    console.log('🗑️ Clearing all master data...');
    
    const connection = await pool.getConnection();
    
    try {
      // Create backup before clearing
      const backupTableName = `master_backup_${Date.now()}`;
      await connection.execute(`CREATE TABLE ${backupTableName} AS SELECT * FROM master`);
      console.log(`📦 Created backup table: ${backupTableName}`);
      
      // Clear all data
      const [result] = await connection.execute('DELETE FROM master');
      console.log(`🗑️ Cleared ${result.affectedRows} records from master`);
      
      // Reset auto increment
      await connection.execute('ALTER TABLE master AUTO_INCREMENT = 1');
      
      res.json({ 
        success: true, 
        message: `Cleared ${result.affectedRows} records`,
        backupTable: backupTableName
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Error clearing master data:', error);
    res.status(500).json({ 
      error: 'Failed to clear master data', 
      message: error.message 
    });
  }
});

// Convert Master DBF to CSV and refresh master data
app.post('/api/master/refresh-from-dbf', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Starting Master DBF refresh process...');
    
    const { dbfPath } = req.body;
    const defaultDbfPath = path.join(__dirname, 'CSV FILES', 'MASTER.DBF');
    const sourceDbfPath = dbfPath || defaultDbfPath;
    
    console.log(`📁 Source Master DBF file: ${sourceDbfPath}`);
    
    // Check if DBF file exists
    const fs = require('fs');
    if (!fs.existsSync(sourceDbfPath)) {
      return res.status(404).json({ 
        error: 'Master DBF file not found', 
        message: `File not found: ${sourceDbfPath}` 
      });
    }
    
    // Step 1: Read and convert DBF to CSV
    console.log('📖 Reading Master DBF file...');
    const dbfReader = new DBFReader(sourceDbfPath);
    const records = await dbfReader.read();
    
    if (records.length === 0) {
      return res.status(400).json({ 
        error: 'No data found', 
        message: 'Master DBF file contains no records' 
      });
    }
    
    // Step 2: Create CSV file
    const csvPath = path.join(__dirname, 'temp', `master_refresh_${Date.now()}.csv`);
    await dbfReader.saveAsCSV(csvPath);
    
    // Step 3: Clear existing master data
    console.log('🗑️ Clearing existing master data...');
    const connection = await pool.getConnection();
    
    try {
      // Create backup
      const backupTableName = `master_backup_${Date.now()}`;
      await connection.execute(`CREATE TABLE ${backupTableName} AS SELECT * FROM master`);
      console.log(`📦 Created backup table: ${backupTableName}`);
      
      // Clear data
      const [clearResult] = await connection.execute('DELETE FROM master');
      await connection.execute('ALTER TABLE master AUTO_INCREMENT = 1');
      console.log(`🗑️ Cleared ${clearResult.affectedRows} existing records`);
      
      // Step 4: Import new data from CSV
      console.log('📥 Importing new master data from CSV...');
      const csvContent = fs.readFileSync(csvPath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim() !== '');
      
      if (lines.length < 2) {
        throw new Error('CSV file is empty or has no data rows');
      }
      
      const header = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));
      console.log('📋 Master CSV Headers:', header);
      
      // Insert data in batches
      const batchSize = 1000;
      let batch = [];
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',').map(val => val.trim().replace(/"/g, ''));
          
          // Map CSV values to master database columns
          const dbValues = [
            values[0] || null,  // DINFLAG
            values[1] || null,  // BENZ
            values[2] || null,  // BENZ2
            values[3] || null,  // BENZ3
            values[4] || null,  // BRAND
            values[5] || null,  // ALTNO
            values[6] || null,  // ALTNO2
            values[7] || null,  // DESC
            values[8] || null,  // APPL
            values[9] || null,  // UNIT
            values[10] || null, // LOCATION
            parseInt(values[11]) || 0,    // REORDER
            parseFloat(values[12]) || 0   // BALANCE
          ];
          
          batch.push(dbValues);
          
          if (batch.length >= batchSize) {
            const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
            const flatBatch = batch.flat();
            await connection.execute(`
              INSERT INTO master (DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, \`DESC\`, APPL, UNIT, LOCATION, REORDER, BALANCE)
              VALUES ${placeholders}
            `, flatBatch);
            successCount += batch.length;
            batch = [];
          }
          
        } catch (error) {
          console.error(`❌ Error processing line ${i}:`, error.message);
          errorCount++;
        }
      }
      
      // Process remaining batch
      if (batch.length > 0) {
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const flatBatch = batch.flat();
        await connection.execute(`
          INSERT INTO master (DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, \`DESC\`, APPL, UNIT, LOCATION, REORDER, BALANCE)
          VALUES ${placeholders}
        `, flatBatch);
        successCount += batch.length;
      }
      
      // Verify import
      const [result] = await connection.execute('SELECT COUNT(*) as total FROM master');
      
      // Clean up temporary CSV file
      fs.unlinkSync(csvPath);
      
      console.log('✅ Master DBF refresh completed successfully');
      console.log(`📊 Imported: ${successCount} records`);
      console.log(`❌ Errors: ${errorCount} records`);
      console.log(`📊 Total in master: ${result[0].total}`);
      
      res.json({
        success: true,
        message: 'Master data refreshed successfully from DBF',
        imported: successCount,
        errors: errorCount,
        total: result[0].total,
        backupTable: backupTableName,
        sourceFile: sourceDbfPath
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Master DBF refresh failed:', error);
    res.status(500).json({ 
      error: 'Master DBF refresh failed', 
      message: error.message 
    });
  }
});

// ===== INMAIN DBF REFRESH ENDPOINTS =====

// Get stock matches for incoming records
app.get('/api/incoming/stock-matches', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    console.log(`🔍 Fetching stock matches for incoming records - Date: ${date || 'all'}`);
    
    const connection = await pool.getConnection();
    try {
      // Check if inmain table exists
      const [tableCheck] = await connection.execute(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_schema = ? AND table_name = 'inmain'
      `, [dbConfig.database]);
      
      if (tableCheck[0].count === 0) {
        return res.status(404).json({ 
          error: 'inmain table not found',
          message: 'The inmain table does not exist in the database'
        });
      }

      // Check actual column names in inmain table
      const [inmainColumns] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'inmain'
        ORDER BY ORDINAL_POSITION
      `, [dbConfig.database]);
      
      const inmainColumnMap = {};
      inmainColumns.forEach(col => {
        const upperName = col.COLUMN_NAME.toUpperCase();
        inmainColumnMap[upperName] = col.COLUMN_NAME; // Store actual case-sensitive name
      });
      
      // Get actual column names
      const idCol = inmainColumnMap['ID'] || 'id';
      const benzCol = inmainColumnMap['BENZ'] || 'BENZ';
      const brandCol = inmainColumnMap['BRAND'] || 'BRAND';
      const altnoCol = inmainColumnMap['ALTNO'] || 'ALTNO';
      const dateCol = inmainColumnMap['DATE'] || 'DATE';
      const costCol = inmainColumnMap['COST'] || 'COST';
      
      console.log('📋 Using inmain columns:', { idCol, benzCol, brandCol, altnoCol, dateCol, costCol });
      
      // Check date format from sample dates
      const [sampleDates] = await connection.execute(`
        SELECT \`${dateCol}\` as date_value 
        FROM inmain 
        WHERE \`${dateCol}\` IS NOT NULL 
        LIMIT 1
      `);
      
      const usesDashes = sampleDates.length > 0 && 
        sampleDates[0].date_value && 
        String(sampleDates[0].date_value).includes('-');
      
      // Build WHERE clause for date filtering
      let whereClause = '';
      let whereParams = [];
      
      if (date) {
        // Use the same date format as stored in database
        if (usesDashes) {
          // Dates stored as YYYY-MM-DD
          whereClause = `WHERE i.\`${dateCol}\` = ?`;
          whereParams.push(date);
          console.log(`📅 Using YYYY-MM-DD format for matching: ${date}`);
        } else {
          // Dates stored as YYYYMMDD
          const dateFormatted = date.replace(/-/g, '');
          whereClause = `WHERE i.\`${dateCol}\` = ?`;
          whereParams.push(dateFormatted);
          console.log(`📅 Using YYYYMMDD format for matching: ${dateFormatted}`);
        }
      }

      // Single JOIN query to get all matches (BENZ, BRAND, DATE only)
      const sql = `
        SELECT 
          i.\`${idCol}\` as incoming_id,
          i.\`${benzCol}\` as incoming_benz,
          i.\`${brandCol}\` as incoming_brand,
          i.\`${altnoCol}\` as incoming_altno,
          i.\`${dateCol}\` as incoming_date,
          s.ID as stock_id,
          s.BENZ as stock_benz,
          s.BRAND as stock_brand,
          s.ALTNO as stock_altno,
          s.DATE as stock_date,
          CASE 
            WHEN s.ID IS NOT NULL THEN s.ID
            ELSE NULL
          END as matched_stock_id,
          CASE 
            WHEN COUNT(s.ID) OVER (PARTITION BY i.\`${idCol}\`) > 1 THEN 'Multiple matches found'
            ELSE NULL
          END as warning
        FROM inmain i
                  LEFT JOIN tbl_stock s ON (
                    i.\`${benzCol}\` = s.BENZ AND 
                    i.\`${brandCol}\` = s.BRAND AND 
                    i.\`${dateCol}\` = s.DATE AND
                    i.\`${costCol}\` = s.COST
                  )
        ${whereClause}
        ORDER BY i.\`${idCol}\`, s.ID
      `;

      console.log('🔍 Stock matches SQL:', sql);
      console.log('🔍 Params:', whereParams);

      const [rows] = await connection.execute(sql, whereParams);
      console.log(`📊 Found ${rows.length} incoming records with matches`);
      
      // Debug: Log first few rows to see what we're getting
      if (rows.length > 0) {
        console.log('🔍 Sample match rows:', rows.slice(0, 3).map(r => ({
          incoming_id: r.incoming_id,
          incoming_benz: r.incoming_benz,
          incoming_brand: r.incoming_brand,
          stock_id: r.stock_id,
          matched: !!r.matched_stock_id
        })));
      } else {
        console.warn('⚠️ No matching rows found. This could mean:');
        console.warn('  1. No matching records in tbl_stock for the given date');
        console.warn('  2. BENZ/BRAND/DATE/COST don\'t match exactly');
        console.warn('  3. Date format mismatch between inmain and tbl_stock');
      }

      // Group results by incoming record ID
      const matches = {};
      const warnings = {};

      rows.forEach(row => {
        const incomingId = row.incoming_id;
        
        if (!matches[incomingId]) {
          matches[incomingId] = {
            incoming_id: incomingId,
            incoming_benz: row.incoming_benz,
            incoming_brand: row.incoming_brand,
            incoming_altno: row.incoming_altno,
            incoming_date: row.incoming_date,
            stock_ids: [],
            warning: null
          };
        }

        if (row.matched_stock_id) {
          matches[incomingId].stock_ids.push(row.matched_stock_id);
        }
      });
      
      // Debug: Log unmatched incoming records
      const allIncomingIds = new Set(rows.map(r => r.incoming_id));
      if (allIncomingIds.size > 0) {
        const unmatchedIds = Array.from(allIncomingIds).filter(id => {
          const match = matches[id];
          return !match || match.stock_ids.length === 0;
        });
        if (unmatchedIds.length > 0) {
          console.warn(`⚠️ ${unmatchedIds.length} incoming records have no stock matches:`, unmatchedIds.slice(0, 5));
        }
      }

      // Check for multiple matches after collecting all stock_ids
      Object.values(matches).forEach(match => {
        if (match.stock_ids.length > 1) {
          match.warning = 'Multiple matches found';
        }
      });

      // Apply Stock ID priority logic for multiple matches
      // Sort incoming records by ID (ascending - first imported gets priority)
      const sortedMatches = Object.values(matches).sort((a, b) => a.incoming_id - b.incoming_id);
      
      // Create a set to track used stock IDs
      const usedStockIds = new Set();
      
      const results = sortedMatches.map(match => {
        let assignedStockId = 'No Match';
        
        if (match.stock_ids.length === 1) {
          // Single match - assign it
          assignedStockId = match.stock_ids[0];
        } else if (match.stock_ids.length > 1) {
          // Multiple matches - apply Stock ID priority logic
          // Sort stock IDs in ascending order (lower ID gets priority)
          const sortedStockIds = match.stock_ids.sort((a, b) => a - b);
          
          // Find first available stock ID (not used by previous incoming records)
          for (const stockId of sortedStockIds) {
            if (!usedStockIds.has(stockId)) {
              assignedStockId = stockId;
              usedStockIds.add(stockId);
              break;
            }
          }
        }
        
        return {
          incoming_id: match.incoming_id,
          stock_id: assignedStockId,
          warning: match.stock_ids.length > 1 ? 'Multiple matches found' : null,
          match_count: match.stock_ids.length,
          all_matches: match.stock_ids // Include all matching stock IDs
        };
      });

      console.log(`📊 Processed ${results.length} incoming records`);
      console.log(`📊 Matches found: ${results.filter(r => r.stock_id !== 'No Match').length}`);
      console.log(`📊 Multiple matches: ${results.filter(r => r.warning).length}`);

      res.json({
        success: true,
        matches: results,
        total: results.length,
        matched: results.filter(r => r.stock_id !== 'No Match').length,
        multiple_matches: results.filter(r => r.warning).length
      });

    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Error fetching stock matches:', error);
    res.status(500).json({ 
      error: 'Failed to fetch stock matches', 
      message: error.message 
    });
  }
});

// Get detailed duplicate matches for a specific incoming record
app.get('/api/incoming/duplicate-matches/:incomingId', authenticateToken, async (req, res) => {
  try {
    const { incomingId } = req.params;
    console.log(`🔍 Fetching duplicate matches for incoming record: ${incomingId}`);
    
    const connection = await pool.getConnection();
    try {
      // Get the incoming record details
      const [incomingRecord] = await connection.execute(`
        SELECT id, BENZ, BRAND, ALTNO, DATE, COST, SUPPLIER, REF
        FROM inmain 
        WHERE id = ?
      `, [incomingId]);

      if (incomingRecord.length === 0) {
        return res.status(404).json({ 
          error: 'Incoming record not found',
          message: 'The specified incoming record does not exist'
        });
      }

      const incoming = incomingRecord[0];
      const dateFormatted = incoming.DATE;
      
      console.log(`🔍 Incoming record details:`, {
        id: incoming.id,
        BENZ: incoming.BENZ,
        BRAND: incoming.BRAND,
        ALTNO: incoming.ALTNO,
        DATE: incoming.DATE,
        COST: incoming.COST,
        dateFormatted: dateFormatted
      });

      // Get all matching stock records
      const [duplicateMatches] = await connection.execute(`
        SELECT 
          s.ID,
          s.BENZ,
          s.BRAND,
          s.ALTNO,
          s.DATE,
          s.QTY,
          s.COST,
          s.SELL,
          s.REMARKS,
          s.LOCATION
        FROM tbl_stock s
        WHERE s.BENZ = ? AND s.BRAND = ? AND s.DATE = ? AND s.COST = ?
        ORDER BY s.ID
      `, [incoming.BENZ, incoming.BRAND, dateFormatted, incoming.COST]);

      console.log(`🔍 Duplicate query params:`, {
        incoming_id: incomingId,
        benz: incoming.BENZ,
        brand: incoming.BRAND,
        date: dateFormatted,
        cost: incoming.COST
      });
      console.log(`🔍 Raw duplicate matches:`, duplicateMatches);

      // Debug: Check if there are any records in tbl_stock with matching BENZ and BRAND
      const [debugMatches] = await connection.execute(`
        SELECT COUNT(*) as count, MIN(DATE) as min_date, MAX(DATE) as max_date, MIN(COST) as min_cost, MAX(COST) as max_cost
        FROM tbl_stock 
        WHERE BENZ = ? AND BRAND = ?
      `, [incoming.BENZ, incoming.BRAND]);
      
      console.log(`🔍 Debug - tbl_stock matches for BENZ=${incoming.BENZ}, BRAND=${incoming.BRAND}:`, debugMatches[0]);

      console.log(`📊 Found ${duplicateMatches.length} duplicate matches for incoming record ${incomingId}`);

      res.json({
        success: true,
        incoming_record: incoming,
        duplicate_matches: duplicateMatches,
        match_count: duplicateMatches.length
      });

    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Error fetching duplicate matches:', error);
    res.status(500).json({ 
      error: 'Failed to fetch duplicate matches', 
      message: error.message 
    });
  }
});

// Get inmain data with pagination
app.get('/api/inmain', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = (page - 1) * limit;
    const { date, all } = req.query;
    
    console.log(`📋 Fetching inmain data - Page: ${page}, Limit: ${limit}, Date: ${date || 'all'}, All: ${all || 'false'}`);
    
    const connection = await pool.getConnection();
    try {
      // Check if inmain table exists
      const [tableCheck] = await connection.execute(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_schema = ? AND table_name = 'inmain'
      `, [dbConfig.database]);
      
      if (tableCheck[0].count === 0) {
        return res.status(404).json({ 
          error: 'inmain table not found',
          message: 'The inmain table does not exist in the database'
        });
      }
      
      // Check actual column names in the inmain table (case-sensitive check)
      const [columnNames] = await connection.execute(`
        SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'inmain'
        ORDER BY ORDINAL_POSITION
      `, [dbConfig.database]);
      console.log('📋 All columns in inmain table:', columnNames.map(c => `${c.COLUMN_NAME} (${c.DATA_TYPE})`));
      
      // Find the date column (could be DATE, date, or Date)
      const dateColumn = columnNames.find(c => 
        c.COLUMN_NAME.toUpperCase() === 'DATE'
      );
      
      if (!dateColumn) {
        console.error('❌ DATE column not found in inmain table!');
        console.log('Available columns:', columnNames.map(c => c.COLUMN_NAME));
      }
      
      const dateColumnName = dateColumn?.COLUMN_NAME || 'DATE'; // Use actual column name
      const dateColumnType = dateColumn?.DATA_TYPE?.toUpperCase() || 'VARCHAR';
      console.log(`📋 Using DATE column: "${dateColumnName}" (${dateColumnType})`);
      
      // Debug: Check what dates exist in the database
      const [sampleDates] = await connection.execute(`
        SELECT \`${dateColumnName}\` as date_value, COUNT(*) as count 
        FROM inmain 
        GROUP BY \`${dateColumnName}\` 
        ORDER BY \`${dateColumnName}\` DESC 
        LIMIT 10
      `);
      console.log('📅 Sample dates in database:', sampleDates);
      
      // Also get total count to see if table has any data
      const [totalCheck] = await connection.execute('SELECT COUNT(*) as total FROM inmain');
      console.log(`📊 Total records in inmain table: ${totalCheck[0].total}`);
      
      // Build WHERE clause for date filtering using actual column name
      let whereClause = '';
      let whereParams = [];
      
      if (date) {
        console.log(`🔍 Filtering by date: ${date}, Column: "${dateColumnName}", Type: ${dateColumnType}`);
        
        if (dateColumnType === 'DATE' || dateColumnType === 'DATETIME') {
          // DATE type - use DATE comparison with YYYY-MM-DD format
          whereClause = `WHERE \`${dateColumnName}\` = ?`;
          whereParams.push(date);
        } else if (dateColumnType === 'VARCHAR' || dateColumnType === 'CHAR' || dateColumnType === 'TEXT') {
          // String type - check what format dates are actually stored in from sample dates
          // Sample dates show: '2025-11-05' (YYYY-MM-DD with dashes)
          // So we need to use the YYYY-MM-DD format, not YYYYMMDD
          const dateFormatted = date.replace(/-/g, ''); // YYYYMMDD format for fallback
          
          // Check if sample dates use dashes (YYYY-MM-DD) or not (YYYYMMDD)
          const usesDashes = sampleDates.length > 0 && 
            sampleDates[0].date_value && 
            String(sampleDates[0].date_value).includes('-');
          
          if (usesDashes) {
            // Dates are stored as YYYY-MM-DD (with dashes) - use that format
            whereClause = `WHERE \`${dateColumnName}\` = ?`;
            whereParams.push(date); // Use YYYY-MM-DD format
            console.log(`📅 Using VARCHAR comparison with YYYY-MM-DD format (with dashes): ${date}`);
          } else {
            // Dates are stored as YYYYMMDD (no dashes) - use that format
            whereClause = `WHERE \`${dateColumnName}\` = ?`;
            whereParams.push(dateFormatted);
            console.log(`📅 Using VARCHAR comparison with YYYYMMDD format (no dashes): ${dateFormatted}`);
          }
        } else {
          // Unknown type - try both formats
          const dateFormatted = date.replace(/-/g, '');
          whereClause = `WHERE (\`${dateColumnName}\` = ? OR \`${dateColumnName}\` = ?)`;
          whereParams.push(date, dateFormatted);
          console.log(`📅 Trying both formats: ${date} and ${dateFormatted}`);
        }
      }
      
      // Get total count with date filter
      const countQuery = `SELECT COUNT(*) as total FROM inmain ${whereClause}`;
      console.log(`📊 Count query: ${countQuery} with params:`, whereParams);
      const [countResult] = await connection.execute(countQuery, whereParams);
      const totalRecords = countResult[0].total;
      console.log(`📊 Total records found for date filter: ${totalRecords}`);
      
      // Fetch data with date filter
      let dataQuery, rows;
      
      if (all === 'true') {
        // Fetch all records without pagination with DESCRIPTION from master table
        // Use actual column names - check for both uppercase and lowercase
        const benzCol = columnNames.find(c => c.COLUMN_NAME.toUpperCase() === 'BENZ')?.COLUMN_NAME || 'BENZ';
        const brandCol = columnNames.find(c => c.COLUMN_NAME.toUpperCase() === 'BRAND')?.COLUMN_NAME || 'BRAND';
        const remarksCol = columnNames.find(c => c.COLUMN_NAME.toUpperCase() === 'REMARKS')?.COLUMN_NAME || 'REMARKS';
        const idCol = columnNames.find(c => c.COLUMN_NAME.toUpperCase() === 'ID')?.COLUMN_NAME || 'id';
        
        dataQuery = `
          SELECT i.*, 
                 COALESCE(m.\`DESC\`, i.\`${remarksCol}\`, 'No description') as DESCRIPTION,
                 m.APPL as APPLICATION
          FROM inmain i
          LEFT JOIN master m ON i.\`${benzCol}\` COLLATE utf8mb4_0900_ai_ci = m.BENZ 
                             AND i.\`${brandCol}\` COLLATE utf8mb4_0900_ai_ci = m.BRAND
          ${whereClause}
          ORDER BY i.\`${dateColumnName}\` DESC, i.\`${idCol}\` DESC
        `;
        console.log(`📊 Executing query: ${dataQuery.substring(0, 200)}...`);
        console.log(`📊 Query params:`, whereParams);
        [rows] = await connection.execute(dataQuery, whereParams);
        console.log(`📊 Found ${rows.length} inmain records (all records)`);
        
        // Log sample of first record to debug structure
        if (rows.length > 0) {
          console.log('📊 Sample record structure:', Object.keys(rows[0]));
          console.log('📊 Sample record DATE value:', rows[0][dateColumnName] || rows[0].DATE || rows[0].date);
        }
        
        // If no data found with date filter, but table has data, include available dates in response
        let availableDates = [];
        if (totalRecords === 0 && totalCheck[0].total > 0) {
          // Get available dates to help user
          const [availableDatesResult] = await connection.execute(`
            SELECT DISTINCT \`${dateColumnName}\` as date_value 
            FROM inmain 
            ORDER BY \`${dateColumnName}\` DESC 
            LIMIT 10
          `);
          
          availableDates = availableDatesResult.map(r => {
            const d = r.date_value;
            if (dateColumnType === 'DATE' || dateColumnType === 'DATETIME') {
              // DATE type - convert Date object to YYYY-MM-DD
              return d instanceof Date ? d.toISOString().split('T')[0] : d;
            } else {
              // String type - convert YYYYMMDD to YYYY-MM-DD if needed
              if (typeof d === 'string' && d.length === 8 && /^\d+$/.test(d)) {
                return `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`;
              }
              // If already in YYYY-MM-DD format, return as is
              if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
                return d;
              }
              return d;
            }
          });
          console.log(`📅 Available dates in database:`, availableDates);
        }
        
        res.json({
          success: true,
          stocks: rows,
          total: totalRecords,
          page: 1,
          limit: totalRecords,
          totalPages: 1,
          debug: {
            requestedDate: date || null,
            dateColumnType: dateColumnType,
            availableDates: availableDates,
            sampleDatesInDb: sampleDates,
            totalInTable: totalCheck[0].total
          }
        });
      } else {
        // Fetch paginated data with DESCRIPTION from master table
        // Use actual column names (same as above)
        const benzCol = columnNames.find(c => c.COLUMN_NAME.toUpperCase() === 'BENZ')?.COLUMN_NAME || 'BENZ';
        const brandCol = columnNames.find(c => c.COLUMN_NAME.toUpperCase() === 'BRAND')?.COLUMN_NAME || 'BRAND';
        const remarksCol = columnNames.find(c => c.COLUMN_NAME.toUpperCase() === 'REMARKS')?.COLUMN_NAME || 'REMARKS';
        const idCol = columnNames.find(c => c.COLUMN_NAME.toUpperCase() === 'ID')?.COLUMN_NAME || 'id';
        
        dataQuery = `
          SELECT i.*, 
                 COALESCE(m.\`DESC\`, i.\`${remarksCol}\`, 'No description') as DESCRIPTION,
                 m.APPL as APPLICATION
          FROM inmain i
          LEFT JOIN master m ON i.\`${benzCol}\` COLLATE utf8mb4_0900_ai_ci = m.BENZ 
                             AND i.\`${brandCol}\` COLLATE utf8mb4_0900_ai_ci = m.BRAND
          ${whereClause}
          ORDER BY i.\`${dateColumnName}\` DESC, i.\`${idCol}\` DESC
          LIMIT ${parseInt(offset, 10)}, ${parseInt(limit, 10)}
        `;
        [rows] = await connection.execute(dataQuery, whereParams);
        console.log(`📊 Found ${rows.length} inmain records (${totalRecords} total)`);
        
        res.json({
          success: true,
          stocks: rows,
          total: totalRecords,
          page: page,
          limit: limit,
          totalPages: Math.ceil(totalRecords / limit),
          debug: {
            requestedDate: date || null,
            dateColumnType: dateColumnType,
            dateColumnName: dateColumnName
          }
        });
      }
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Error fetching inmain data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch inmain data', 
      message: error.message 
    });
  }
});

// Get stock history by part number (BENZ) - shows incoming stock records
app.get('/api/inmain/history/:benz', authenticateToken, async (req, res) => {
  try {
    const { benz } = req.params;
    
    if (!benz || benz.trim() === '') {
      return res.status(400).json({
        error: 'Part number (BENZ) is required',
        message: 'Please provide a valid part number'
      });
    }
    
    console.log(`📋 Fetching stock history for part number: ${benz}`);
    
    const connection = await pool.getConnection();
    try {
      // Query tbl_stock table for records matching the part number (BENZ)
      // This shows the stock records (incoming/inventory) for this part number
      // Join with inmain to get supplier information and proper DATE values
      // Note: We get DATE from inmain table first (which has proper DATE type), 
      // then fall back to tbl_stock.DATE if no match found
      
      // First, check what columns exist in inmain table
      const [inmainColumns] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'inmain'
        ORDER BY ORDINAL_POSITION
      `, [dbConfig.database]);
      
      const inmainColumnMap = {};
      inmainColumns.forEach(col => {
        inmainColumnMap[col.COLUMN_NAME.toUpperCase()] = col.COLUMN_NAME;
      });
      
      // Determine actual column names (handle both uppercase and lowercase)
      const inmainBenzCol = inmainColumnMap['BENZ'] || inmainColumnMap['BENZ_NUMBER'] || 'BENZ';
      const inmainBrandCol = inmainColumnMap['BRAND'] || 'BRAND';
      const inmainDateCol = inmainColumnMap['DATE'] || 'date';
      const inmainSupplierCol = inmainColumnMap['SUPPLIER'] || 'supplier';
      
      const query = `
        SELECT * FROM (
          SELECT DISTINCT
            ts.ID,
            COALESCE(
              (SELECT 
                CASE 
                  WHEN im.\`${inmainDateCol}\` REGEXP '^[0-9]{8}$' THEN 
                    STR_TO_DATE(im.\`${inmainDateCol}\`, '%Y%m%d')
                  WHEN im.\`${inmainDateCol}\` REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN 
                    CAST(im.\`${inmainDateCol}\` AS DATE)
                  ELSE 
                    NULL
                END
               FROM inmain im 
               WHERE (im.\`${inmainBenzCol}\` = ts.BENZ OR REPLACE(im.\`${inmainBenzCol}\`, ' ', '') = REPLACE(ts.BENZ, ' ', ''))
                 AND im.\`${inmainBrandCol}\` = ts.BRAND 
               ORDER BY 
                 CASE 
                   WHEN im.\`${inmainDateCol}\` REGEXP '^[0-9]{8}$' THEN 
                     STR_TO_DATE(im.\`${inmainDateCol}\`, '%Y%m%d')
                   WHEN im.\`${inmainDateCol}\` REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN 
                     CAST(im.\`${inmainDateCol}\` AS DATE)
                   ELSE 
                     NULL
                 END DESC
               LIMIT 1),
              CASE 
                WHEN ts.DATE REGEXP '^[0-9]{8}$' THEN 
                  STR_TO_DATE(ts.DATE, '%Y%m%d')
                WHEN ts.DATE REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN 
                  CAST(ts.DATE AS DATE)
                ELSE 
                  NULL
              END,
              NULL
            ) as DATE,
            ts.QTY,
            ts.SELL as SELLING_PRICE,
            ts.BENZ,
            ts.BRAND,
            COALESCE(
              (SELECT im.\`${inmainSupplierCol}\` 
               FROM inmain im 
               WHERE (im.\`${inmainBenzCol}\` = ts.BENZ OR REPLACE(im.\`${inmainBenzCol}\`, ' ', '') = REPLACE(ts.BENZ, ' ', ''))
                 AND im.\`${inmainBrandCol}\` = ts.BRAND 
               ORDER BY 
                 CASE 
                   WHEN im.\`${inmainDateCol}\` REGEXP '^[0-9]{8}$' THEN 
                     STR_TO_DATE(im.\`${inmainDateCol}\`, '%Y%m%d')
                   WHEN im.\`${inmainDateCol}\` REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN 
                     CAST(im.\`${inmainDateCol}\` AS DATE)
                   ELSE 
                     NULL
                 END DESC
               LIMIT 1), 
              'N/A'
            ) as SUPPLIER
          FROM tbl_stock ts
          WHERE ts.BENZ = ?
        ) as result
        ORDER BY DATE IS NULL, DATE DESC, ID DESC
        LIMIT 1000
      `;
      
      const [rows] = await connection.execute(query, [benz.trim()]);
      
      console.log(`✅ Found ${rows.length} stock records for part number: ${benz}`);
      
      connection.release();
      
      res.json({
        success: true,
        data: rows,
        count: rows.length,
        partNumber: benz
      });
      
    } catch (dbError) {
      connection.release();
      console.error('❌ Database error fetching stock history:', dbError);
      throw dbError;
    }
    
  } catch (error) {
    console.error('❌ Error fetching stock history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch stock history', 
      message: error.message 
    });
  }
});

// Post incoming stock to main tables
app.post('/api/inc_tbl/post', authenticateToken, async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No items provided for posting'
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      console.log(`🚀 Posting ${items.length} items to main tables...`);
      
      for (const item of items) {
        // 1. Add to tbl_stock (main stock table)
        const stockData = {
          DINFLAG: item.din_flag || '',
          BENZ: item.benz_number || '',
          BENZ2: item.benz_number2 || '',
          BENZ3: item.benz_number3 || '',
          BRAND: item.brand || '',
          ALTNO: item.oem || '',
          ALTNO2: item.oem2 || '',
          COLORCODE: item.color_code || '',
          REMARKS: item.remarks || '',
          DATE: item.date?.replace(/-/g, '') || new Date().toISOString().split('T')[0].replace(/-/g, ''),
          COST: parseFloat(item.cost) || 0,
          SELL: parseFloat(item.selling_price) || 0,
          QTY: parseFloat(item.quantity) || 0,
          CURRENCY: item.currency || 'PHP',
          FCAMOUNT: parseFloat(item.fc_cost) || 0,
          CONVERSION: parseFloat(item.conversion) || 1,
          LOCATION: item.location || ''
        };

        await connection.execute(
          `INSERT INTO tbl_stock (DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, COLORCODE, REMARKS, DATE, COST, SELL, QTY, CURRENCY, FCAMOUNT, CONVERSION, LOCATION) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [stockData.DINFLAG, stockData.BENZ, stockData.BENZ2, stockData.BENZ3, stockData.BRAND, 
           stockData.ALTNO, stockData.ALTNO2, stockData.COLORCODE, stockData.REMARKS, stockData.DATE,
           stockData.COST, stockData.SELL, stockData.QTY, stockData.CURRENCY, stockData.FCAMOUNT,
           stockData.CONVERSION, stockData.LOCATION]
        );

        // 2. Add to inmain (incoming main table)
        const inmainData = {
          date: item.date || new Date().toISOString().split('T')[0],
          reference: item.reference || '',
          supplier: item.supplier || '',
          din_flag: item.din_flag || '',
          benz_number: item.benz_number || '',
          benz_number2: item.benz_number2 || '',
          benz_number3: item.benz_number3 || '',
          brand: item.brand || '',
          altno: item.oem || '',
          altno2: item.oem2 || '',
          description: item.description || '',
          application: item.application || '',
          color_code: item.color_code || '',
          remarks: item.remarks || '',
          cost: parseFloat(item.cost) || 0,
          selling_price: parseFloat(item.selling_price) || 0,
          quantity: parseFloat(item.quantity) || 0,
          currency: item.currency || 'PHP',
          fc_cost: parseFloat(item.fc_cost) || 0,
          conversion: parseFloat(item.conversion) || 1,
          location: item.location || ''
        };

        await connection.execute(
          `INSERT INTO inmain (DATE, REF, SUPPLIER, DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, COLORCODE, REMARKS, COST, SELL, QTY, CURRENCY, FCAMOUNT, CONVERSION, LOCATION) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [inmainData.date, inmainData.reference, inmainData.supplier, inmainData.din_flag,
           inmainData.benz_number, inmainData.benz_number2, inmainData.benz_number3, inmainData.brand,
           inmainData.altno, inmainData.altno2, inmainData.color_code, inmainData.remarks, 
           inmainData.cost, inmainData.selling_price, inmainData.quantity, inmainData.currency, 
           inmainData.fc_cost, inmainData.conversion, inmainData.location]
        );

        // 3. Update master table if needed (like TRACK.EXE)
        const [existingMaster] = await connection.execute(
          'SELECT * FROM master WHERE BENZ = ? AND BRAND = ? AND ALTNO = ?',
          [inmainData.benz_number, inmainData.brand, inmainData.altno]
        );

        if (existingMaster.length === 0) {
          // Create new master record
          await connection.execute(
            `INSERT INTO master (DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, \`DESC\`, APPL, UNIT, LOCATION, REORDER) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [inmainData.din_flag, inmainData.benz_number, inmainData.benz_number2, inmainData.benz_number3, inmainData.brand,
             inmainData.altno, inmainData.altno2, item.description || '', item.application || '',
             item.unit || 'pcs', inmainData.location, parseFloat(item.reorder) || 0]
          );
        } else {
          // Update existing master record
          await connection.execute(
            `UPDATE master SET \`DESC\` = ?, APPL = ?, UNIT = ?, LOCATION = ?, REORDER = ? WHERE BENZ = ? AND BRAND = ? AND ALTNO = ?`,
            [item.description || '', item.application || '', item.unit || 'pcs', 
             inmainData.location, parseFloat(item.reorder) || 0, inmainData.benz_number, inmainData.brand, inmainData.altno]
          );
        }
      }

      // 4. Delete items from inc_tbl after successful posting
      console.log(`🗑️ Deleting posted items from inc_tbl...`);
      for (const item of items) {
        if (item.id) {
          await connection.execute(
            'DELETE FROM inc_tbl WHERE id = ?',
            [item.id]
          );
        }
      }
      console.log(`✅ Deleted ${items.length} items from inc_tbl`);

      await connection.commit();
      console.log(`✅ Successfully posted ${items.length} items to main tables`);

      res.json({
        success: true,
        message: `Successfully posted ${items.length} items to main stock tables`,
        postedCount: items.length
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('❌ Error posting incoming stock:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to post incoming stock',
      error: error.message
    });
  }
});

// Create new master record
app.post('/api/master/create', authenticateToken, async (req, res) => {
  try {
    const { DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, DESC, APPL, UNIT, LOCATION, REORDER } = req.body;
    
    if (!BENZ && !BRAND) {
      return res.status(400).json({
        success: false,
        message: 'BENZ or BRAND is required'
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO master (DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, \`DESC\`, APPL, UNIT, LOCATION, REORDER) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [DINFLAG || 'D', BENZ || '', BENZ2 || '', BENZ3 || '', BRAND || '', ALTNO || '', ALTNO2 || '', 
         DESC || '', APPL || '', UNIT || 'pcs', LOCATION || '', REORDER || 0]
      );

      res.json({
        success: true,
        message: 'Master record created successfully'
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('❌ Error creating master record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create master record',
      error: error.message
    });
  }
});

// Update existing master record
app.put('/api/master/update', authenticateToken, async (req, res) => {
  try {
    const { benz, brand, altno, data } = req.body;
    
    if (!benz && !brand) {
      return res.status(400).json({
        success: false,
        message: 'BENZ or BRAND is required for update'
      });
    }

    const connection = await pool.getConnection();
    try {
      // Build dynamic update query
      const updateFields = [];
      const updateValues = [];
      
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && data[key] !== null) {
          updateFields.push(`${key} = ?`);
          updateValues.push(data[key]);
        }
      });

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      // Add WHERE condition
      let whereClause = '';
      if (benz && brand) {
        whereClause = 'WHERE BENZ = ? AND BRAND = ?';
        updateValues.push(benz, brand);
      } else if (brand && altno) {
        whereClause = 'WHERE BRAND = ? AND ALTNO = ?';
        updateValues.push(brand, altno);
      } else if (benz) {
        whereClause = 'WHERE BENZ = ?';
        updateValues.push(benz);
      } else if (brand) {
        whereClause = 'WHERE BRAND = ?';
        updateValues.push(brand);
      }

      const query = `UPDATE master SET ${updateFields.join(', ')} ${whereClause}`;
      
      const [result] = await connection.execute(query, updateValues);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Master record not found'
        });
      }

      res.json({
        success: true,
        message: 'Master record updated successfully',
        affectedRows: result.affectedRows
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('❌ Error updating master record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update master record',
      error: error.message
    });
  }
});

// Lookup master table for auto-fill
app.get('/api/master/lookup', authenticateToken, async (req, res) => {
  try {
    const { benz, brand, altno } = req.query;
    
    if (!benz && !brand && !altno) {
      return res.status(400).json({ 
        error: 'Missing parameters',
        message: 'At least one of benz, brand, or altno must be provided'
      });
    }
    
    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM master WHERE ';
      let params = [];
      
      // Build query based on available parameters
      if (benz && brand) {
        // Primary lookup: BENZ + BRAND
        query += 'BENZ = ? AND BRAND = ?';
        params = [benz, brand];
      } else if (brand && altno) {
        // Secondary lookup: BRAND + ALTNO
        query += 'BRAND = ? AND ALTNO = ?';
        params = [brand, altno];
      } else if (benz) {
        // Tertiary lookup: BENZ only
        query += 'BENZ = ?';
        params = [benz];
      } else if (brand) {
        // Brand only lookup
        query += 'BRAND = ?';
        params = [brand];
      } else if (altno) {
        // ALTNO only lookup
        query += 'ALTNO = ?';
        params = [altno];
      }
      
      const [rows] = await connection.execute(query, params);
      
      if (rows.length > 0) {
        res.json({
          success: true,
          data: rows[0],
          message: 'Master record found'
        });
      } else {
        res.json({
          success: false,
          data: null,
          message: 'No matching record found in master table'
        });
      }
      
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('❌ Error looking up master table:', error);
    res.status(500).json({
      error: 'Failed to lookup master table',
      message: error.message
    });
  }
});

// Add new incoming stock to inc_tbl
app.post('/api/inc_tbl/add', authenticateToken, async (req, res) => {
  try {
    console.log('➕ Adding new incoming stock to inc_tbl...');
    console.log('📝 Request data:', req.body);
    
    const {
      supplier, date, reference, din_flag, benz_number, benz_number2, benz_number3,
      brand, altno, altno2, description, application, color_code, remarks,
      cost, selling_price, currency, fc_cost, conversion, quantity, location
    } = req.body;
    
    // Validate required fields
    if (!benz_number || !brand || !description) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Benz Number, Brand, and Description are required'
      });
    }
    
    const connection = await pool.getConnection();
    try {
      // Check if inc_tbl table exists
      const [tableCheck] = await connection.execute(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_schema = ? AND table_name = 'inc_tbl'
      `, [dbConfig.database]);
      
      if (tableCheck[0].count === 0) {
        return res.status(404).json({ 
          error: 'inc_tbl table not found',
          message: 'The inc_tbl table does not exist in the database'
        });
      }
      
      // Insert new record into inc_tbl
      const [result] = await connection.execute(`
        INSERT INTO inc_tbl (
          SUPPLIER, DATE, REF, DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2,
          \`DESC\`, APPL, COLORCODE, REMARKS, COST, SELL, QTY, CURRENCY, FCAMOUNT, 
          CONVERSION, LOCATION, tab_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        supplier || '',
        date ? date.replace(/-/g, '') : '',
        reference || '',
        din_flag || '',
        benz_number || '',
        benz_number2 || '',
        benz_number3 || '',
        brand || '',
        altno || '',
        altno2 || '',
        description || '',
        application || '',
        color_code || '',
        remarks || '',
        parseFloat(cost) || 0,
        parseFloat(selling_price) || 0,
        parseFloat(quantity) || 0,
        currency || 'PHP',
        parseFloat(fc_cost) || 0,
        parseFloat(conversion) || 1,
        location || '',
        parseInt(req.body.tab_number) || 1
      ]);
      
      console.log(`✅ Added incoming stock to inc_tbl with ID: ${result.insertId}`);
      
      res.json({
        success: true,
        message: 'Incoming stock added successfully to inc_tbl',
        id: result.insertId
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Error adding incoming stock to inc_tbl:', error);
    res.status(500).json({ 
      error: 'Failed to add incoming stock to inc_tbl', 
      message: error.message 
    });
  }
});

// Get incoming stock items by tab number
app.get('/api/inc_tbl/by-tab/:tabNumber', authenticateToken, async (req, res) => {
  try {
    const { tabNumber } = req.params;
    const tabNum = parseInt(tabNumber);
    
    if (isNaN(tabNum) || tabNum < 1 || tabNum > 10) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tab number. Must be between 1 and 10.'
      });
    }
    
    console.log(`📋 Fetching items for tab ${tabNum}...`);
    
    const connection = await pool.getConnection();
    try {
      // Check if inc_tbl table exists
      const [tableCheck] = await connection.execute(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_schema = ? AND table_name = 'inc_tbl'
      `, [dbConfig.database]);
      
      if (tableCheck[0].count === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'inc_tbl table not found',
          message: 'The inc_tbl table does not exist in the database'
        });
      }
      
      // Fetch items for the specific tab
      const [rows] = await connection.execute(`
        SELECT 
          id, SUPPLIER as supplier, DATE as date, REF as reference, DINFLAG as din_flag,
          BENZ as benz_number, BENZ2 as benz_number2, BENZ3 as benz_number3,
          BRAND as brand, ALTNO as altno, ALTNO2 as altno2,
          \`DESC\` as description, APPL as application, COLORCODE as color_code,
          REMARKS as remarks, COST as cost, SELL as selling_price, QTY as quantity,
          CURRENCY as currency, FCAMOUNT as fc_cost, CONVERSION as conversion,
          LOCATION as location, tab_number, created_at
        FROM inc_tbl 
        WHERE tab_number = ?
        ORDER BY created_at DESC
      `, [tabNum]);
      
      console.log(`✅ Found ${rows.length} items for tab ${tabNum}`);
      
      res.json({
        success: true,
        data: rows,
        count: rows.length,
        tabNumber: tabNum
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error(`❌ Error fetching items for tab ${req.params.tabNumber}:`, error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch items by tab', 
      message: error.message 
    });
  }
});

// Delete incoming stock item
app.delete('/api/inc_tbl/delete/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Deleting incoming stock item ID: ${id}...`);
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID'
      });
    }
    
    const connection = await pool.getConnection();
    try {
      // Check if inc_tbl table exists
      const [tableCheck] = await connection.execute(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_schema = ? AND table_name = 'inc_tbl'
      `, [dbConfig.database]);
      
      if (tableCheck[0].count === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'inc_tbl table not found',
          message: 'The inc_tbl table does not exist in the database'
        });
      }
      
      // Check if item exists
      const [itemCheck] = await connection.execute(`
        SELECT id, BENZ, BRAND, \`DESC\` FROM inc_tbl WHERE id = ?
      `, [id]);
      
      if (itemCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Item not found'
        });
      }
      
      // Delete record from inc_tbl
      const [result] = await connection.execute(`
        DELETE FROM inc_tbl WHERE id = ?
      `, [id]);
      
      console.log(`✅ Deleted incoming stock item ID: ${id}`);
      
      res.json({
        success: true,
        message: 'Item deleted successfully',
        deletedItem: itemCheck[0]
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Error deleting incoming stock item:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete incoming stock item', 
      message: error.message 
    });
  }
});

// Update existing incoming stock item
app.put('/api/inc_tbl/update/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔄 Updating incoming stock item ID: ${id}...`);
    console.log('📝 Request data:', req.body);
    
    const {
      supplier, date, reference, din_flag, benz_number, benz_number2, benz_number3,
      brand, altno, altno2, description, application, color_code, remarks,
      cost, selling_price, currency, fc_cost, conversion, quantity, location, tab_number
    } = req.body;
    
    // Validate required fields
    if (!benz_number || !brand || !description) {
      return res.status(400).json({
        success: false,
        message: 'Benz Number, Brand, and Description are required'
      });
    }
    
    const connection = await pool.getConnection();
    try {
      // Check if inc_tbl table exists
      const [tableCheck] = await connection.execute(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_schema = ? AND table_name = 'inc_tbl'
      `, [dbConfig.database]);
      
      if (tableCheck[0].count === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'inc_tbl table not found',
          message: 'The inc_tbl table does not exist in the database'
        });
      }
      
      // Check if item exists
      const [itemCheck] = await connection.execute(`
        SELECT id FROM inc_tbl WHERE id = ?
      `, [id]);
      
      if (itemCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Item not found'
        });
      }
      
      // Update record in inc_tbl
      const [result] = await connection.execute(`
        UPDATE inc_tbl SET
          SUPPLIER = ?, DATE = ?, REF = ?, DINFLAG = ?, BENZ = ?, BENZ2 = ?, BENZ3 = ?,
          BRAND = ?, ALTNO = ?, ALTNO2 = ?, \`DESC\` = ?, APPL = ?, COLORCODE = ?, 
          REMARKS = ?, COST = ?, SELL = ?, QTY = ?, CURRENCY = ?, FCAMOUNT = ?, 
          CONVERSION = ?, LOCATION = ?, tab_number = ?
        WHERE id = ?
      `, [
        supplier || '',
        date ? date.replace(/-/g, '') : '',
        reference || '',
        din_flag || '',
        benz_number || '',
        benz_number2 || '',
        benz_number3 || '',
        brand || '',
        altno || '',
        altno2 || '',
        description || '',
        application || '',
        color_code || '',
        remarks || '',
        parseFloat(cost) || 0,
        parseFloat(selling_price) || 0,
        parseFloat(quantity) || 0,
        currency || 'PHP',
        parseFloat(fc_cost) || 0,
        parseFloat(conversion) || 1,
        location || '',
        parseInt(tab_number) || 1,
        id
      ]);
      
      console.log(`✅ Updated incoming stock item with ID: ${id}`);
      
      res.json({
        success: true,
        message: 'Incoming stock item updated successfully',
        id: id
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error(`❌ Error updating incoming stock item:`, error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update incoming stock item', 
      message: error.message 
    });
  }
});

// Add new incoming stock to inmain
app.post('/api/inmain/add', authenticateToken, async (req, res) => {
  try {
    console.log('➕ Adding new incoming stock...');
    console.log('📝 Request data:', req.body);
    
    const {
      date, reference, supplier, din_flag, benz_number, benz_number2, benz_number3,
      brand, altno, altno2, description, application, color_code, remarks,
      cost, selling_price, currency, fc_cost, conversion, quantity, unit,
      reorder_point, location
    } = req.body;
    
    // Validate required fields
    if (!date || !supplier) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Date and Supplier are required'
      });
    }
    
    const connection = await pool.getConnection();
    try {
      // Check if inmain table exists
      const [tableCheck] = await connection.execute(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_schema = ? AND table_name = 'inmain'
      `, [dbConfig.database]);
      
      if (tableCheck[0].count === 0) {
        return res.status(404).json({ 
          error: 'inmain table not found',
          message: 'The inmain table does not exist in the database'
        });
      }
      
      // Insert new record
      const [result] = await connection.execute(`
        INSERT INTO inmain (
          SUPPLIER, DATE, REF, DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2,
          COLORCODE, REMARKS, COST, SELL, QTY, DOCREF, CURRENCY, FCAMOUNT, 
          CONVERSION, LOCATION
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        supplier || '',
        date,
        reference || '',
        din_flag || '',
        benz_number || '',
        benz_number2 || '',
        benz_number3 || '',
        brand || '',
        altno || '',
        altno2 || '',
        color_code || '',
        remarks || '',
        parseFloat(cost) || 0,
        parseFloat(selling_price) || 0,
        parseInt(quantity) || 0,
        '', // DOCREF (document reference) - not used in form
        currency || 'PHP',
        parseFloat(fc_cost) || 0,
        parseFloat(conversion) || 1,
        location || ''
      ]);
      
      console.log(`✅ Added incoming stock with ID: ${result.insertId}`);
      
      res.json({
        success: true,
        message: 'Incoming stock added successfully',
        id: result.insertId
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Error adding incoming stock:', error);
    res.status(500).json({ 
      error: 'Failed to add incoming stock', 
      message: error.message 
    });
  }
});

// Clear all inmain data
app.delete('/api/inmain/clear-all', authenticateToken, async (req, res) => {
  try {
    console.log('🗑️ Clearing all inmain data...');
    
    const connection = await pool.getConnection();
    
    try {
      // Create backup before clearing
      const backupTableName = `inmain_backup_${Date.now()}`;
      await connection.execute(`CREATE TABLE ${backupTableName} AS SELECT * FROM inmain`);
      console.log(`📦 Created backup table: ${backupTableName}`);
      
      // Clear all data
      const [result] = await connection.execute('DELETE FROM inmain');
      console.log(`🗑️ Cleared ${result.affectedRows} records from inmain`);
      
      // Reset auto increment
      await connection.execute('ALTER TABLE inmain AUTO_INCREMENT = 1');
      
      res.json({ 
        success: true, 
        message: `Cleared ${result.affectedRows} records`,
        backupTable: backupTableName
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Error clearing inmain data:', error);
    res.status(500).json({ 
      error: 'Failed to clear inmain data', 
      message: error.message 
    });
  }
});

// Convert Inmain DBF to CSV and refresh inmain data
app.post('/api/inmain/refresh-from-dbf', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Starting Inmain DBF refresh process...');
    
    const { dbfPath } = req.body;
    const defaultDbfPath = 'C:\\Rae\\Files\\inmain.dbf';
    const sourceDbfPath = dbfPath || defaultDbfPath;
    
    console.log(`📁 Source Inmain DBF file: ${sourceDbfPath}`);
    
    // Check if DBF file exists
    const fs = require('fs');
    if (!fs.existsSync(sourceDbfPath)) {
      return res.status(404).json({ 
        error: 'Inmain DBF file not found', 
        message: `File not found: ${sourceDbfPath}` 
      });
    }
    
    // Step 1: Read and convert DBF to CSV
    console.log('📖 Reading Inmain DBF file...');
    const dbfReader = new DBFReader(sourceDbfPath);
    const records = await dbfReader.read();
    
    if (records.length === 0) {
      return res.status(400).json({ 
        error: 'No data found', 
        message: 'Inmain DBF file contains no records' 
      });
    }
    
    // Step 2: Create CSV file
    const csvPath = path.join(__dirname, 'temp', `inmain_refresh_${Date.now()}.csv`);
    await dbfReader.saveAsCSV(csvPath);
    
    // Step 3: Clear existing inmain data
    console.log('🗑️ Clearing existing inmain data...');
    const connection = await pool.getConnection();
    
    try {
      // Create backup
      const backupTableName = `inmain_backup_${Date.now()}`;
      await connection.execute(`CREATE TABLE ${backupTableName} AS SELECT * FROM inmain`);
      console.log(`📦 Created backup table: ${backupTableName}`);
      
      // Clear data
      const [clearResult] = await connection.execute('DELETE FROM inmain');
      await connection.execute('ALTER TABLE inmain AUTO_INCREMENT = 1');
      console.log(`🗑️ Cleared ${clearResult.affectedRows} existing records`);
      
      // Step 4: Check actual column names in the database
      const [actualColumns] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'inmain'
        ORDER BY ORDINAL_POSITION
      `, [dbConfig.database]);
      
      const columnMap = {};
      actualColumns.forEach(col => {
        const upperName = col.COLUMN_NAME.toUpperCase();
        columnMap[upperName] = col.COLUMN_NAME; // Store actual case-sensitive name
      });
      
      console.log('📋 Actual inmain table columns:', actualColumns.map(c => c.COLUMN_NAME));
      console.log('📋 Column mapping:', columnMap);
      
      // Determine which column names to use (prefer actual, fallback to uppercase)
      const supplierCol = columnMap['SUPPLIER'] || 'supplier';
      const dateCol = columnMap['DATE'] || 'date';
      const refCol = columnMap['REF'] || 'reference';
      const dinflagCol = columnMap['DINFLAG'] || 'din_flag';
      const benzCol = columnMap['BENZ'] || 'benz_number';
      const benz2Col = columnMap['BENZ2'] || 'benz_number2';
      const benz3Col = columnMap['BENZ3'] || 'benz_number3';
      const brandCol = columnMap['BRAND'] || 'brand';
      const altnoCol = columnMap['ALTNO'] || 'altno';
      const altno2Col = columnMap['ALTNO2'] || 'altno2';
      const colorcodeCol = columnMap['COLORCODE'] || 'color_code';
      const remarksCol = columnMap['REMARKS'] || 'remarks';
      const costCol = columnMap['COST'] || 'cost';
      const sellCol = columnMap['SELL'] || 'selling_price';
      const qtyCol = columnMap['QTY'] || 'quantity';
      const currencyCol = columnMap['CURRENCY'] || 'currency';
      const fcamountCol = columnMap['FCAMOUNT'] || 'fc_cost';
      const conversionCol = columnMap['CONVERSION'] || 'conversion';
      const locationCol = columnMap['LOCATION'] || 'location';
      
      // Step 5: Import new data from CSV
      console.log('📥 Importing new inmain data from CSV...');
      const csvContent = fs.readFileSync(csvPath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim() !== '');
      
      if (lines.length < 2) {
        throw new Error('CSV file is empty or has no data rows');
      }
      
      const header = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));
      console.log('📋 Inmain CSV Headers:', header);
      
      // Insert data in batches
      const batchSize = 1000;
      let batch = [];
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',').map(val => val.trim().replace(/"/g, ''));
          
          // Map CSV values to inmain database columns (correct mapping based on DBF structure)
          // Note: DOCREF (values[15]) is skipped as it doesn't exist in the table schema
          const dbValues = [
            values[0] || null,  // SUPPLIER
            values[1] || null,  // DATE
            values[2] || null,  // REF
            values[3] || null,  // DINFLAG
            values[4] || null,  // BENZ
            values[5] || null,  // BENZ2
            values[6] || null,  // BENZ3
            values[7] || null,  // BRAND
            values[8] || null,  // ALTNO
            values[9] || null,  // ALTNO2
            values[10] || null, // COLORCODE
            values[11] || null, // REMARKS
            (() => {
              const costValue = parseFloat(values[12]) || 0;
              if (costValue > 99999999.99) {
                console.log(`⚠️ Capping COST value ${costValue} to 99999999.99 for inmain import`);
              }
              return Math.min(costValue, 99999999.99);
            })(),  // COST (capped at decimal(10,2) max)
            (() => {
              const sellValue = parseFloat(values[13]) || 0;
              if (sellValue > 99999999.99) {
                console.log(`⚠️ Capping SELL value ${sellValue} to 99999999.99 for inmain import`);
              }
              return Math.min(sellValue, 99999999.99);
            })(),  // SELL (capped at decimal(10,2) max)
            parseInt(values[14]) || 0,    // QTY
            values[16] || null, // CURRENCY (skip DOCREF at index 15)
            parseFloat(values[17]) || 0,  // FCAMOUNT
            parseFloat(values[18]) || 0,  // CONVERSION
            values[19] || null  // LOCATION
          ];
          
          batch.push(dbValues);
          
          if (batch.length >= batchSize) {
            const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
            const flatBatch = batch.flat();
            // Use actual column names from database (19 columns, DOCREF excluded)
            await connection.execute(`
              INSERT INTO inmain (\`${supplierCol}\`, \`${dateCol}\`, \`${refCol}\`, \`${dinflagCol}\`, \`${benzCol}\`, \`${benz2Col}\`, \`${benz3Col}\`, \`${brandCol}\`, \`${altnoCol}\`, \`${altno2Col}\`, \`${colorcodeCol}\`, \`${remarksCol}\`, \`${costCol}\`, \`${sellCol}\`, \`${qtyCol}\`, \`${currencyCol}\`, \`${fcamountCol}\`, \`${conversionCol}\`, \`${locationCol}\`)
              VALUES ${placeholders}
            `, flatBatch);
            successCount += batch.length;
            batch = [];
          }
          
        } catch (error) {
          console.error(`❌ Error processing line ${i}:`, error.message);
          errorCount++;
        }
      }
      
      // Process remaining batch
      if (batch.length > 0) {
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const flatBatch = batch.flat();
        // Use actual column names from database (19 columns, DOCREF excluded)
        await connection.execute(`
          INSERT INTO inmain (\`${supplierCol}\`, \`${dateCol}\`, \`${refCol}\`, \`${dinflagCol}\`, \`${benzCol}\`, \`${benz2Col}\`, \`${benz3Col}\`, \`${brandCol}\`, \`${altnoCol}\`, \`${altno2Col}\`, \`${colorcodeCol}\`, \`${remarksCol}\`, \`${costCol}\`, \`${sellCol}\`, \`${qtyCol}\`, \`${currencyCol}\`, \`${fcamountCol}\`, \`${conversionCol}\`, \`${locationCol}\`)
          VALUES ${placeholders}
        `, flatBatch);
        successCount += batch.length;
      }
      
      // Verify import
      const [result] = await connection.execute('SELECT COUNT(*) as total FROM inmain');
      
      // Clean up temporary CSV file
      fs.unlinkSync(csvPath);
      
      console.log('✅ Inmain DBF refresh completed successfully');
      console.log(`📊 Imported: ${successCount} records`);
      console.log(`❌ Errors: ${errorCount} records`);
      console.log(`📊 Total in inmain: ${result[0].total}`);
      
      res.json({
        success: true,
        message: 'Inmain data refreshed successfully from DBF',
        imported: successCount,
        errors: errorCount,
        total: result[0].total,
        backupTable: backupTableName,
        sourceFile: sourceDbfPath
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Inmain DBF refresh failed:', error);
    res.status(500).json({ 
      error: 'Inmain DBF refresh failed', 
      message: error.message 
    });
  }
});

// Get available DBF files
app.get('/api/stock/available-dbf-files', authenticateToken, async (req, res) => {
  try {
    const fs = require('fs');
    const csvDir = path.join(__dirname, 'CSV FILES');
    const newDataDir = path.join(__dirname, 'CSV FILES', 'New data');
    const raeFilesDir = 'C:\\Rae\\Files'; // Add Rae Files directory
    
    const dbfFiles = [];
    
    // Helper function to scan directory for DBF files
    const scanDirectory = (dir, source) => {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir);
          files.forEach(file => {
            if (file.toLowerCase().endsWith('.dbf')) {
              const filePath = path.join(dir, file);
              dbfFiles.push({
                name: file,
                path: filePath,
                size: fs.statSync(filePath).size,
                modified: fs.statSync(filePath).mtime,
                source: source // Add source information
              });
            }
          });
        } catch (error) {
          console.log(`⚠️ Could not read directory ${dir}:`, error.message);
        }
      }
    };
    
    // Check main CSV FILES directory
    scanDirectory(csvDir, 'Project CSV FILES');
    
    // Check New data subdirectory
    scanDirectory(newDataDir, 'Project New Data');
    
    // Check Rae Files directory
    scanDirectory(raeFilesDir, 'Rae Files (C:\\Rae\\Files)');
    
    res.json({
      success: true,
      files: dbfFiles.sort((a, b) => b.modified - a.modified) // Sort by most recent first
    });
    
  } catch (error) {
    console.error('❌ Error getting DBF files:', error);
    res.status(500).json({ 
      error: 'Failed to get DBF files', 
      message: error.message 
    });
  }
});


// ==================== DASHBOARD API ENDPOINTS ====================


// Recent Sales + No Stock
app.get('/api/dashboard/recent-sales-no-stock', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT DISTINCT
        s.BRAND,
        s.BENZ,
        s.ALTNO,
        s.SELL,
        MAX(h.DATE) as lastSaleDate,
        COUNT(h.CODE) as salesCount
      FROM tbl_stock s
      LEFT JOIN (
        SELECT 
          CODE as stock_id,
          DATE,
          CODE
        FROM history 
        WHERE DATE >= '2020-01-01' AND DATE <= '2025-12-31'
      ) h ON s.ID = h.stock_id
      WHERE s.QTY = 0
        AND s.BRAND IS NOT NULL
        AND s.BRAND != ''
        AND h.DATE IS NOT NULL
      GROUP BY s.ID, s.BRAND, s.BENZ, s.ALTNO, s.SELL
      ORDER BY lastSaleDate DESC, salesCount DESC
      LIMIT 15
    `);

    const alerts = rows.map(item => ({
      brand: item.BRAND || 'Unknown',
      benz: item.BENZ || '',
      altno: item.ALTNO || '',
      price: item.SELL || 0,
      lastSaleDate: item.lastSaleDate ? new Date(item.lastSaleDate).toLocaleDateString() : 'Unknown',
      salesCount: item.salesCount || 0
    }));

    res.json(alerts);
  } catch (error) {
    console.error('Error fetching recent sales no stock:', error);
    res.status(500).json({ error: 'Failed to fetch recent sales no stock data' });
  }
});

// Fast Moving Items
app.get('/api/dashboard/fast-moving-items', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        s.ID,
        s.BRAND,
        s.BENZ,
        s.ALTNO,
        s.QTY as currentStock,
        s.SELL,
        s.COST,
        COALESCE(sales.sales30Days, 0) as sales30Days,
        CASE 
          WHEN COALESCE(sales.sales30Days, 0) > 0 
          THEN FLOOR(s.QTY / (COALESCE(sales.sales30Days, 0) / 30))
          ELSE 999
        END as daysRemaining
      FROM tbl_stock s
      LEFT JOIN (
        SELECT 
          CODE as stock_id,
          SUM(QTY) as sales30Days
        FROM history 
        WHERE DATE >= '2020-01-01' AND DATE <= '2025-12-31'
        GROUP BY CODE
      ) sales ON s.ID = sales.stock_id
      WHERE s.QTY > 0
        AND s.BRAND IS NOT NULL
        AND s.BRAND != ''
        AND COALESCE(sales.sales30Days, 0) > 0
      ORDER BY sales30Days DESC, s.QTY ASC
      LIMIT 15
    `);

    const items = rows.map(item => ({
      id: item.ID,
      brand: item.BRAND || 'Unknown',
      benz: item.BENZ || '',
      altno: item.ALTNO || '',
      currentStock: item.currentStock || 0,
      sales30Days: item.sales30Days || 0,
      daysRemaining: item.daysRemaining || 999,
      price: item.SELL || 0,
      cost: item.COST || 0
    }));

    res.json(items);
  } catch (error) {
    console.error('Error fetching fast moving items:', error);
    res.status(500).json({ error: 'Failed to fetch fast moving items' });
  }
});

// Slow Moving Items
app.get('/api/dashboard/slow-moving-items', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        s.ID,
        s.BRAND,
        s.BENZ,
        s.ALTNO,
        s.QTY as currentStock,
        s.SELL,
        s.COST,
        (s.QTY * s.COST) as totalValue,
        COALESCE(sales.lastSaleDate, '1900-01-01') as lastSaleDate,
        DATEDIFF((SELECT MAX(DATE) FROM history WHERE DATE >= '2020-01-01' AND DATE <= '2025-12-31'), COALESCE(sales.lastSaleDate, '1900-01-01')) as daysSinceLastSale
      FROM tbl_stock s
      LEFT JOIN (
        SELECT 
          CODE as stock_id,
          MAX(DATE) as lastSaleDate
        FROM history 
        WHERE DATE >= '2020-01-01' AND DATE <= '2025-12-31'
        GROUP BY CODE
      ) sales ON s.ID = sales.stock_id
      WHERE s.QTY > 10
        AND s.BRAND IS NOT NULL
        AND s.BRAND != ''
        AND (sales.lastSaleDate IS NULL OR DATEDIFF((SELECT MAX(DATE) FROM history WHERE DATE >= '2020-01-01' AND DATE <= '2025-12-31'), sales.lastSaleDate) >= 90)
      ORDER BY daysSinceLastSale DESC, totalValue DESC
      LIMIT 15
    `);

    const items = rows.map(item => ({
      id: item.ID,
      brand: item.BRAND || 'Unknown',
      benz: item.BENZ || '',
      altno: item.ALTNO || '',
      currentStock: item.currentStock || 0,
      totalValue: item.totalValue || 0,
      daysSinceLastSale: item.daysSinceLastSale || 999,
      price: item.SELL || 0,
      cost: item.COST || 0,
      lastSaleDate: item.lastSaleDate !== '1900-01-01' ? new Date(item.lastSaleDate).toLocaleDateString() : 'Never'
    }));

    res.json(items);
  } catch (error) {
    console.error('Error fetching slow moving items:', error);
    res.status(500).json({ error: 'Failed to fetch slow moving items' });
  }
});

// Yesterday's Sales
app.get('/api/dashboard/yesterday-sales', authenticateToken, async (req, res) => {
  try {
    // Get yesterday's sales
    const [yesterdayRows] = await pool.execute(`
      SELECT 
        COUNT(*) as itemCount,
        SUM(QTY * AMOUNT) as totalValue,
        SUM(QTY) as totalQuantity
      FROM history 
      WHERE DATE = (SELECT MAX(DATE) FROM history WHERE DATE >= '2020-01-01' AND DATE <= '2025-12-31')
    `);

    // Get previous day's sales for comparison
    const [previousDayRows] = await pool.execute(`
      SELECT 
        COUNT(*) as itemCount,
        SUM(QTY * AMOUNT) as totalValue
      FROM history 
      WHERE DATE = DATE_SUB((SELECT MAX(DATE) FROM history WHERE DATE >= '2020-01-01' AND DATE <= '2025-12-31'), INTERVAL 1 DAY)
    `);

    // Get top items from yesterday
    const [topItemsRows] = await pool.execute(`
      SELECT 
        h.BRAND,
        h.PARTNO as BENZ,
        h.PARTNO as ALTNO,
        SUM(h.QTY) as quantity,
        SUM(h.QTY * h.AMOUNT) as value
      FROM history h
      WHERE h.DATE = (SELECT MAX(DATE) FROM history WHERE DATE >= '2020-01-01' AND DATE <= '2025-12-31')
      GROUP BY h.BRAND, h.PARTNO
      ORDER BY value DESC
      LIMIT 5
    `);

    const yesterday = yesterdayRows[0] || { itemCount: 0, totalValue: 0, totalQuantity: 0 };
    const previousDay = previousDayRows[0] || { itemCount: 0, totalValue: 0 };
    
    const vsPreviousDay = previousDay.totalValue > 0 
      ? Math.round(((yesterday.totalValue - previousDay.totalValue) / previousDay.totalValue) * 100)
      : 0;

    const topItems = topItemsRows.map(item => ({
      brand: item.BRAND || 'Unknown',
      benz: item.BENZ || '',
      altno: item.ALTNO || '',
      quantity: item.quantity || 0,
      value: item.value || 0
    }));

    res.json({
      totalValue: yesterday.totalValue || 0,
      itemCount: yesterday.itemCount || 0,
      totalQuantity: yesterday.totalQuantity || 0,
      vsPreviousDay: vsPreviousDay,
      topItems: topItems
    });
  } catch (error) {
    console.error('Error fetching yesterday sales:', error);
    res.status(500).json({ error: 'Failed to fetch yesterday sales data' });
  }
});

// Daily Sales Graph Data
app.get('/api/dashboard/daily-sales', authenticateToken, async (req, res) => {
  try {
    // Get daily sales data for the last 30 days
    const [rows] = await pool.execute(`
      SELECT 
        DATE as sale_date,
        COUNT(*) as total_transactions,
        SUM(QTY) as total_quantity,
        SUM(QTY * SELL) as total_value,
        COUNT(DISTINCT IDCODE) as unique_items_sold
      FROM history 
      WHERE DATE >= DATE_SUB((SELECT MAX(DATE) FROM history WHERE DATE >= '2020-01-01' AND DATE <= '2025-12-31'), INTERVAL 30 DAY)
        AND DATE <= (SELECT MAX(DATE) FROM history WHERE DATE >= '2020-01-01' AND DATE <= '2025-12-31')
        AND DATE IS NOT NULL
      GROUP BY DATE
      ORDER BY DATE ASC
    `);

    // Fill in missing dates with zero values
    const dailySales = [];
    const maxDate = new Date(Math.max(...rows.map(row => new Date(row.sale_date))));
    const minDate = new Date(Math.max(...rows.map(row => new Date(row.sale_date))));
    minDate.setDate(minDate.getDate() - 29); // 30 days total

    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const existingData = rows.find(row => row.sale_date.toISOString().split('T')[0] === dateStr);
      
      dailySales.push({
        date: dateStr,
        total_transactions: existingData ? existingData.total_transactions : 0,
        total_quantity: existingData ? existingData.total_quantity : 0,
        total_value: existingData ? parseFloat(existingData.total_value) : 0,
        unique_items_sold: existingData ? existingData.unique_items_sold : 0
      });
    }

    res.json(dailySales);
  } catch (error) {
    console.error('Error fetching daily sales data:', error);
    res.status(500).json({ error: 'Failed to fetch daily sales data' });
  }
});

// Sales History API Endpoints

// Get sales history with pagination and filters
app.get('/api/sales/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, customer, date_from, date_to, date } = req.query;
    const offset = (page - 1) * limit;
    
    console.log('🔍 Sales History API - Received params:', { page, limit, search, customer, date_from, date_to, date });
    
    let whereConditions = [];
    let queryParams = [];
    
    // Build WHERE clause based on filters
    if (search) {
      // Trim and normalize search term (remove extra spaces)
      const trimmedSearch = search.trim().replace(/\s+/g, ' ');
      
      // Search across: BENZ, BRAND, ALTNO, INVOICE, CUSTOMER, RECEIPT
      // Use both with spaces and without spaces for better matching
      const searchWithSpaces = `%${trimmedSearch}%`;
      const searchWithoutSpaces = `%${trimmedSearch.replace(/\s+/g, '')}%`;
      
      // Search with spaces (exact match)
      whereConditions.push(`(h.BENZ LIKE ? OR h.BRAND LIKE ? OR h.ALTNO LIKE ? OR h.INVOICE LIKE ? OR h.CUSTOMER LIKE ? OR h.RECEIPT LIKE ? OR REPLACE(h.BENZ, ' ', '') LIKE ? OR REPLACE(h.CUSTOMER, ' ', '') LIKE ? OR REPLACE(h.RECEIPT, ' ', '') LIKE ?)`);
      queryParams.push(
        searchWithSpaces, searchWithSpaces, searchWithSpaces, searchWithSpaces, searchWithSpaces, searchWithSpaces,
        searchWithoutSpaces, searchWithoutSpaces, searchWithoutSpaces
      );
    }
    
    if (customer) {
      whereConditions.push(`h.CUSTOMER LIKE ?`);
      queryParams.push(`%${customer}%`);
    }
    
    if (date) {
      // Single date filter - show only records from this specific date
      // Direct comparison should work better than DATE() function
      // Also handle NULL dates
      whereConditions.push(`h.DATE = ?`);
      queryParams.push(date);
    } else if (date_from) {
      whereConditions.push(`h.DATE >= ?`);
      queryParams.push(date_from);
    }
    
    if (date_to) {
      whereConditions.push(`h.DATE <= ?`);
      queryParams.push(date_to);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    console.log('🔍 Final WHERE clause:', whereClause);
    console.log('🔍 Query params:', queryParams);
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM history h
      ${whereClause}
    `;
    const [countResult] = await pool.query(countQuery, queryParams);
    const totalRecords = countResult[0].total;
    const totalPages = Math.ceil(totalRecords / limit);
    
    // Get paginated data
    // Format DATE properly and handle null values
    // JOIN with tbl_stock to get description from master table or stock REMARKS
    // Use DISTINCT to prevent duplicates from master table JOIN
    // Check if service columns exist in history table
    let hasServiceColumns = false;
    try {
      const [columnCheck] = await pool.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'history' 
        AND COLUMN_NAME IN ('source', 'requisition_number', 'repair_order_number', 'plate_number')
      `);
      hasServiceColumns = columnCheck[0]?.count === 4;
    } catch (err) {
      console.warn('Could not check for service columns:', err);
      hasServiceColumns = false;
    }
    
    const serviceColumns = hasServiceColumns 
      ? 'h.source, h.requisition_number, h.repair_order_number, h.plate_number'
      : 'NULL as source, NULL as requisition_number, NULL as repair_order_number, NULL as plate_number';
    
    const dataQuery = `
      SELECT DISTINCT
        COALESCE(h.DATE, '1900-01-01') as DATE,
        DATE_FORMAT(h.DATE, '%Y-%m-%d') as DATE_FORMATTED,
        h.CUSTOMER,
        h.INVOICE,
        h.RECEIPT,
        h.IDCODE,
        h.SELL,
        h.QTY,
        h.BENZ,
        h.BRAND,
        h.ALTNO,
        h.COLORCODE,
        h.REMARKS,
        h.COST,
        (h.SELL * h.QTY) as total_amount,
        COALESCE(m.\`DESC\`, ts.REMARKS, h.REMARKS, 'N/A') as DESCRIPTION,
        ${serviceColumns}
      FROM history h
      LEFT JOIN tbl_stock ts ON h.IDCODE = ts.ID
      LEFT JOIN master m ON ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ 
                         AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND
      ${whereClause}
      ORDER BY DATE DESC, h.RECEIPT DESC
      LIMIT ? OFFSET ?
    `;
    
    const [rows] = await pool.query(dataQuery, [...queryParams, parseInt(limit), offset]);
    
    // Process rows to ensure dates are properly formatted and remove duplicates
    // Create a Set to track unique records by IDCODE, DATE, RECEIPT, QTY combination
    const seenRecords = new Set();
    const processedRows = rows
      .map(row => {
        // Use DATE_FORMATTED if available, otherwise use DATE
        // If DATE is null or invalid (1900-01-01), set it to null
        if (row.DATE === '1900-01-01' || !row.DATE || row.DATE === null) {
          row.DATE = null;
        } else {
          row.DATE = row.DATE_FORMATTED || row.DATE;
        }
        // Remove the formatted date field as we don't need it in response
        delete row.DATE_FORMATTED;
        return row;
      })
      .filter(row => {
        // Create a unique key for each record
        const uniqueKey = `${row.IDCODE}-${row.DATE}-${row.RECEIPT || row.INVOICE}-${row.QTY}-${row.SELL}`;
        if (seenRecords.has(uniqueKey)) {
          return false; // Skip duplicate
        }
        seenRecords.add(uniqueKey);
        return true; // Keep unique record
      });
    
    // Debug: Check if there are ANY records in the history table
    const [allRecordsCheck] = await pool.query('SELECT COUNT(*) as total FROM history');
    const totalInTable = allRecordsCheck[0].total;
    
    // Debug: Check date range in history table
    const [dateRangeCheck] = await pool.query(`
      SELECT 
        MIN(DATE) as min_date, 
        MAX(DATE) as max_date,
        COUNT(*) as total,
        DATE_FORMAT(MIN(DATE), '%Y-%m-%d') as min_date_formatted,
        DATE_FORMAT(MAX(DATE), '%Y-%m-%d') as max_date_formatted
      FROM history
    `);
    
    // Debug: Check if the searched date exists in the database
    let dateExistsCheck = null;
    let nearbyDatesCheck = null;
    if (date) {
      const [dateCheck] = await pool.query(`
        SELECT COUNT(*) as count, 
               MIN(DATE) as min_date,
               MAX(DATE) as max_date,
               DATE_FORMAT(MIN(DATE), '%Y-%m-%d') as min_fmt,
               DATE_FORMAT(MAX(DATE), '%Y-%m-%d') as max_fmt
        FROM history 
        WHERE DATE = ?
      `, [date]);
      dateExistsCheck = dateCheck[0];
      
      // Check nearby dates (3 days before and after)
      const [nearbyCheck] = await pool.query(`
        SELECT DATE, DATE_FORMAT(DATE, '%Y-%m-%d') as date_fmt, COUNT(*) as count
        FROM history 
        WHERE DATE >= DATE_SUB(?, INTERVAL 3 DAY)
          AND DATE <= DATE_ADD(?, INTERVAL 3 DAY)
        GROUP BY DATE
        ORDER BY DATE DESC
        LIMIT 10
      `, [date, date]);
      nearbyDatesCheck = nearbyCheck;
    }
    
    console.log(`📊 Sales History API Debug:`);
    console.log(`   - Total records in history table: ${totalInTable}`);
    console.log(`   - Date range in history: ${dateRangeCheck[0]?.min_date || 'N/A'} to ${dateRangeCheck[0]?.max_date || 'N/A'}`);
    console.log(`   - Date range formatted: ${dateRangeCheck[0]?.min_date_formatted || 'N/A'} to ${dateRangeCheck[0]?.max_date_formatted || 'N/A'}`);
    if (dateExistsCheck) {
      console.log(`   - Searching for date: ${date}`);
      console.log(`   - Records with exact date match: ${dateExistsCheck.count}`);
      console.log(`   - Date check result:`, dateExistsCheck);
    }
    if (nearbyDatesCheck && nearbyDatesCheck.length > 0) {
      console.log(`   - Nearby dates (within 3 days) with records:`, nearbyDatesCheck.map(d => `${d.date_fmt} (${d.count} records)`));
    }
    console.log(`   - Records matching filters: ${totalRecords}`);
    console.log(`   - Records returned: ${processedRows.length}`);
    if (processedRows.length > 0) {
      console.log(`   - Sample record DATE:`, processedRows[0]?.DATE);
      console.log(`   - Sample record:`, processedRows[0]);
    }
    console.log(`   - Query used:`, dataQuery);
    console.log(`   - Query params:`, queryParams);
    
    res.json({
      data: processedRows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalRecords,
        pages: totalPages
      }
    });
  } catch (error) {
    console.error('❌ Sales history API error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Export sales history to DBF file
app.get('/api/sales/export-dbf', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ message: 'Date parameter is required' });
    }
    
    console.log('📦 Exporting sales history to DBF for date:', date);
    
    // Get all sales data for the selected date (no pagination)
    const dataQuery = `
      SELECT DISTINCT
        h.CUSTOMER,
        h.DATE,
        h.RECEIPT,
        h.INVOICE,
        h.IDCODE,
        h.SELL,
        h.QTY,
        h.BENZ,
        h.BRAND,
        h.ALTNO,
        h.COLORCODE,
        h.REMARKS,
        h.COST
      FROM history h
      WHERE h.DATE = ?
      ORDER BY h.RECEIPT DESC, h.IDCODE
    `;
    
    const [rows] = await pool.query(dataQuery, [date]);
    
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'No sales data found for the selected date' });
    }
    
    console.log(`📊 Found ${rows.length} records to export`);
    
    // Define DBF field structure matching the WORKING OUTGOING.DBF exactly
    // Based on Fields Info dialog from the original working file
    const fieldDefs = [
      { name: 'CUSTOMER', type: 'C', size: 10 },   // Character - 10 chars (truncated from full name)
      { name: 'DATE', type: 'D', size: 8 },        // Date type (8 bytes, YYYYMMDD format)
      { name: 'RECEIPT', type: 'C', size: 10 },    // Character - 10 chars
      { name: 'INVOICE', type: 'L', size: 1 },     // Logical type (T/F, 1 byte)
      { name: 'IDCODE', type: 'N', size: 6, decimalPlaces: 0 },   // Numeric - 6 digits
      { name: 'SELL', type: 'N', size: 9, decimalPlaces: 2 },    // Numeric - 9 digits, 2 decimals
      { name: 'QTY', type: 'N', size: 5, decimalPlaces: 0 },     // Numeric - 5 digits
      { name: 'BENZ', type: 'C', size: 16 },       // Character - 16 chars
      { name: 'BRAND', type: 'C', size: 12 },      // Character - 12 chars
      { name: 'ALTNO', type: 'C', size: 20 },      // Character - 20 chars
      { name: 'COLORCODE', type: 'C', size: 4 },   // Character - 4 chars
      { name: 'REMARKS', type: 'C', size: 1 },     // Character - 1 char
      { name: 'COST', type: 'N', size: 9, decimalPlaces: 2 }     // Numeric - 9 digits, 2 decimals
      // Note: MARIOSO fields will be added manually in binary format
    ];
    
    // Convert rows to DBF format
    const dbfRecords = rows.map(row => {
      // Parse date for Date type field (dbffile expects a Date object)
      // IMPORTANT: Create date in local time to avoid timezone issues
      let dateValue = null; // For Date type field (Date object)
      
      if (row.DATE) {
        // Parse YYYY-MM-DD string and create Date in local time (not UTC)
        // Set time to noon (12:00:00) to avoid timezone shifts
        const dateStr = String(row.DATE);
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [year, month, day] = dateStr.split('-').map(Number);
          // Create date in local timezone at noon to avoid DST/timezone issues
          const dateObj = new Date(year, month - 1, day, 12, 0, 0, 0);
          if (!isNaN(dateObj.getTime())) {
            dateValue = dateObj; // Date object for dbffile Date type
          }
        } else {
          // Fallback: parse and set to noon
          const dateObj = new Date(row.DATE);
          if (!isNaN(dateObj.getTime())) {
            dateObj.setHours(12, 0, 0, 0); // Set to noon to avoid timezone shifts
            dateValue = dateObj;
          }
        }
      }
      
      // Determine INVOICE value: 'F' if RECEIPT starts with "D", otherwise 'T'
      // Based on user requirement: if RECEIPT starts with "D" (like "D21231222"), INVOICE = 'F' (false)
      let invoiceValue = 'T';
      const receipt = String(row.RECEIPT || '');
      // Check if receipt starts with "D" (first character is D)
      if (receipt.startsWith('D')) {
        invoiceValue = 'F';
      }
      
      // Convert INVOICE to Logical type (true/false, not 'T'/'F')
      const invoiceLogical = invoiceValue === 'T' || invoiceValue === 't';
      
      // Truncate customer name to 10 characters (matching working OUTGOING.DBF)
      const customerName = String(row.CUSTOMER || '').substring(0, 10);
      
      // Truncate receipt to 10 characters
      const receiptValue = String(row.RECEIPT || '').substring(0, 10);
      
      return {
        CUSTOMER: customerName.padEnd(10, ' ').substring(0, 10),
        DATE: dateValue, // Date type (YYYYMMDD format, 8 bytes)
        RECEIPT: receiptValue.padEnd(10, ' ').substring(0, 10),
        INVOICE: invoiceLogical, // Logical type (true/false)
        IDCODE: parseInt(row.IDCODE) || 0, // Numeric, 6 digits
        SELL: parseFloat(row.SELL) || 0, // Numeric, 9 digits, 2 decimals
        QTY: parseInt(row.QTY) || 0, // Numeric, 5 digits
        BENZ: String(row.BENZ || '').padEnd(16, ' ').substring(0, 16),
        BRAND: String(row.BRAND || '').padEnd(12, ' ').substring(0, 12),
        ALTNO: String(row.ALTNO || '').padEnd(20, ' ').substring(0, 20),
        COLORCODE: String(row.COLORCODE || '').padEnd(4, ' ').substring(0, 4),
        REMARKS: String(row.REMARKS || '').substring(0, 1).padEnd(1, ' '), // Only 1 char!
        COST: parseFloat(row.COST) || 0 // Numeric, 9 digits, 2 decimals
        // Note: MARIOSO fields will be added manually in binary format after dbffile creates the base structure
      };
    });
    
    // Save directly to C:\Rae\Files\OUTGOING.DBF (as requested by user)
    const outputDir = 'C:\\Rae\\Files';
    const outputFilePath = path.join(outputDir, 'OUTGOING.DBF');
    
    // Ensure directory exists
    if (!require('fs').existsSync(outputDir)) {
      require('fs').mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created directory: ${outputDir}`);
    }
    
    // Check if file exists and is locked (might be open in track.exe)
    const fs = require('fs');
    if (fs.existsSync(outputFilePath)) {
      try {
        // Try to delete the existing file first to ensure we can overwrite
        fs.unlinkSync(outputFilePath);
        console.log(`🗑️ Removed existing OUTGOING.DBF to allow overwrite`);
      } catch (deleteError) {
        // If we can't delete, the file might be locked by track.exe
        console.warn(`⚠️ Could not remove existing file (might be locked): ${deleteError.message}`);
        // Continue anyway - DBFFile.create might still work
      }
    }
    
    // Create DBF file with the 13 base fields (no MARIOSO - track.exe will add them automatically)
    const dbf = await DBFFile.create(outputFilePath, fieldDefs);
    
    // Write all records
    await dbf.appendRecords(dbfRecords);
    
    console.log(`✅ DBF file created: ${outputFilePath}`);
    
    // Read the file and send as download
    const finalFileBuffer = fs.readFileSync(outputFilePath);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="OUTGOING.DBF"');
    res.setHeader('Content-Length', finalFileBuffer.length);
    
    // Send file
    res.send(finalFileBuffer);
    
  } catch (error) {
    console.error('❌ DBF export error:', error);
    
    // Check if error is related to file locking
    if (error.code === 'EBUSY' || error.code === 'EPERM' || error.message.includes('locked') || error.message.includes('being used')) {
      return res.status(409).json({ 
        message: 'File is locked', 
        error: 'OUTGOING.DBF is currently open in another program (possibly track.exe). Please close it and try again.',
        details: error.message
      });
    }
    
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Import sales data from OUTGOING.DBF
app.get('/api/sales/import-dbf', authenticateToken, async (req, res) => {
  try {
    console.log('📥 Importing sales data from OUTGOING.DBF');

    const dbfFilePath = 'C:\\Rae\\Files\\OUTGOING.DBF';
    const fs = require('fs');

    // Check if file exists
    if (!fs.existsSync(dbfFilePath)) {
      return res.status(404).json({ 
        message: 'File not found', 
        error: 'OUTGOING.DBF not found at C:\\Rae\\Files\\OUTGOING.DBF' 
      });
    }

    // Open and read the DBF file
    const dbf = await DBFFile.open(dbfFilePath);
    const records = await dbf.readRecords(); // Read all records

    console.log(`📊 Found ${records.length} records in OUTGOING.DBF`);

    // Get unique IDCODEs to look up descriptions from stock table
    const uniqueIdCodes = [...new Set(records.map(r => parseInt(r.IDCODE) || 0).filter(id => id > 0))];
    
    // Fetch descriptions from stock table
    const descriptionMap = new Map();
    if (uniqueIdCodes.length > 0) {
      const placeholders = uniqueIdCodes.map(() => '?').join(',');
      const [stockRows] = await pool.query(
        `SELECT ts.ID, COALESCE(m.\`DESC\`, ts.REMARKS, 'N/A') as DESCRIPTION
         FROM tbl_stock ts
         LEFT JOIN master m ON ts.BENZ COLLATE utf8mb4_0900_ai_ci = m.BENZ AND ts.BRAND COLLATE utf8mb4_0900_ai_ci = m.BRAND
         WHERE ts.ID IN (${placeholders})`,
        uniqueIdCodes
      );
      
      stockRows.forEach(row => {
        descriptionMap.set(row.ID, row.DESCRIPTION || 'N/A');
      });
    }

    // Convert DBF records to sales history format
    const salesData = records.map(record => {
      // Convert DATE from Date object to YYYY-MM-DD string
      let dateStr = null;
      if (record.DATE) {
        const date = new Date(record.DATE);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
        }
      }

      // Convert INVOICE from Logical (true/false) to 'T'/'F'
      let invoiceValue = 'T';
      if (record.INVOICE === false || record.INVOICE === 'F' || record.INVOICE === 'f') {
        invoiceValue = 'F';
      }

      // Trim whitespace from string fields
      const trimString = (str) => str ? String(str).trim() : '';
      
      const idCode = parseInt(record.IDCODE) || 0;
      const description = descriptionMap.get(idCode) || 'N/A';

      return {
        CUSTOMER: trimString(record.CUSTOMER),
        DATE: dateStr,
        RECEIPT: trimString(record.RECEIPT),
        INVOICE: invoiceValue,
        IDCODE: idCode,
        SELL: parseFloat(record.SELL) || 0,
        QTY: parseInt(record.QTY) || 0,
        BENZ: trimString(record.BENZ),
        BRAND: trimString(record.BRAND),
        ALTNO: trimString(record.ALTNO),
        COLORCODE: trimString(record.COLORCODE),
        REMARKS: trimString(record.REMARKS),
        DESCRIPTION: description, // Look up from stock table
        COST: parseFloat(record.COST) || 0,
        total_amount: (parseFloat(record.SELL) || 0) * (parseInt(record.QTY) || 0)
      };
    });

    // Check if user wants to save to database (optional query parameter)
    const saveToDatabase = req.query.save === 'true';
    
    if (saveToDatabase) {
      // Save imported data to history table
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        
        let savedCount = 0;
        let skippedCount = 0;
        
        const stockErrors = [];
        
        for (const record of salesData) {
          // Ensure QTY is parsed as integer (handle string values from DBF)
          let recordQty = parseInt(record.QTY);
          if (isNaN(recordQty)) {
            recordQty = 0;
          }
          
          // Ensure IDCODE is an integer early in the process
          const idCodeInt = parseInt(record.IDCODE);
          if (isNaN(idCodeInt)) {
            console.error(`❌ Invalid IDCODE: ${record.IDCODE} cannot be parsed as integer`);
            skippedCount++;
            continue;
          }
          
          // Check if record already exists (same IDCODE, DATE, RECEIPT)
          const [existing] = await conn.query(
            `SELECT 1 FROM history 
             WHERE IDCODE = ? AND DATE = ? AND RECEIPT = ? 
             LIMIT 1`,
            [idCodeInt, record.DATE, record.RECEIPT]
          );
          
          const recordExists = existing.length > 0;
          
          // Check stock availability - needed for both new records and returns/exchanges
          const [stockResult] = await conn.query(
            `SELECT QTY, BENZ, BRAND FROM tbl_stock WHERE ID = ?`,
            [idCodeInt]
          );
          
          if (stockResult.length === 0) {
            // Stock item doesn't exist
            if (!recordExists) {
              stockErrors.push({
                idcode: record.IDCODE,
                benz: record.BENZ || 'N/A',
                brand: record.BRAND || 'N/A',
                receipt: record.RECEIPT,
                error: 'Stock item not found'
              });
            }
            // Skip this record (whether it exists or not, we can't update stock)
            if (recordExists) {
              skippedCount++;
            }
            continue;
          }
          
          const availableStock = stockResult[0].QTY || 0;
          
          console.log(`🔍 Processing record: ID ${record.IDCODE}, QTY: ${record.QTY} (parsed: ${recordQty}), exists: ${recordExists}`);
          
          // Handle negative quantities (returns/exchanges) - add to stock
          // If QTY is negative (e.g., -12), remove the negative sign and add that positive value to stock
          // Example: -12 -> remove "-" -> 12 -> add 12 to stock
          if (recordQty < 0) {
            // Remove negative sign: -12 becomes 12, -1 becomes 1, etc.
            const quantityToAdd = Math.abs(recordQty);
            console.log(`📦 Processing return/exchange: ID ${record.IDCODE}, QTY: ${recordQty} (removed negative, will add ${quantityToAdd} to stock)`);
            
            if (!recordExists) {
              // Insert new record into history
              await conn.query(
                `INSERT INTO history (
                  CUSTOMER, DATE, RECEIPT, INVOICE, IDCODE,
                  SELL, QTY, BENZ, BRAND, ALTNO,
                  COLORCODE, REMARKS, COST
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  record.CUSTOMER,
                  record.DATE,
                  record.RECEIPT,
                  record.INVOICE,
                  idCodeInt, // Use parsed integer
                  record.SELL,
                  recordQty, // Use parsed integer (negative value)
                  record.BENZ,
                  record.BRAND,
                  record.ALTNO,
                  record.COLORCODE,
                  record.REMARKS,
                  record.COST
                ]
              );
              savedCount++;
            } else {
              skippedCount++;
            }
            
            // Always update stock for returns/exchanges (even if record already exists)
            // This handles cases where record was manually added or imported in preview mode
            
            // Re-read stock value right before update to get the latest value (in case other records in this batch updated it)
            const [currentStockCheck] = await conn.query(
              `SELECT QTY FROM tbl_stock WHERE ID = ?`,
              [idCodeInt]
            );
            let actualCurrentStock = currentStockCheck.length > 0 ? (currentStockCheck[0].QTY || 0) : 0;
            
            // If stock is negative, normalize it to 0 before adding
            // This handles cases where stock went negative due to errors
            const normalizedStock = actualCurrentStock < 0 ? 0 : actualCurrentStock;
            const stockAdjustment = normalizedStock - actualCurrentStock; // How much to add to normalize
            
            console.log(`🔄 Attempting to update stock: ID ${idCodeInt} (original: ${record.IDCODE}), adding ${quantityToAdd} units`);
            console.log(`   Current stock from DB: ${actualCurrentStock}`);
            if (actualCurrentStock < 0) {
              console.log(`   ⚠️ Stock is negative (${actualCurrentStock}), normalizing to 0 before adding import value`);
            }
            console.log(`   📊 Calculation: Normalized stock (${normalizedStock}) + Import value (${quantityToAdd}) = ${normalizedStock + quantityToAdd}`);
            
            // Update: normalize negative stock to 0, then add the import value
            // This is: SET QTY = 0 + quantityToAdd if QTY < 0, else SET QTY = QTY + quantityToAdd
            const [updateResult] = await conn.query(
              `UPDATE tbl_stock SET QTY = CASE 
                WHEN QTY < 0 THEN 0 + ?
                ELSE QTY + ?
               END
               WHERE ID = ?`,
              [quantityToAdd, quantityToAdd, idCodeInt]
            );
            
            console.log(`   Update result: affectedRows=${updateResult.affectedRows}, changedRows=${updateResult.changedRows || 'N/A'}`);
            
            // Verify the update by checking the new stock value
            const [verifyStock] = await conn.query(
              `SELECT QTY FROM tbl_stock WHERE ID = ?`,
              [idCodeInt]
            );
            
            if (verifyStock.length > 0) {
              const newStockValue = verifyStock[0].QTY;
              console.log(`   Stock after update: ${newStockValue}`);
              if (actualCurrentStock < 0) {
                console.log(`   ✅ Final result: ${actualCurrentStock} (was negative) → normalized to 0 → + ${quantityToAdd} (import) = ${newStockValue}`);
              } else {
                console.log(`   ✅ Final result: ${actualCurrentStock} (last value from DB) + ${quantityToAdd} (import, removed "-") = ${newStockValue}`);
              }
            } else {
              console.error(`   ❌ ID ${idCodeInt} not found in tbl_stock after update attempt!`);
            }
            
            if (updateResult.affectedRows > 0) {
              const newStock = verifyStock.length > 0 ? verifyStock[0].QTY : 'unknown';
              console.log(`✅ Added stock: ID ${idCodeInt} by ${quantityToAdd} units (return/exchange). New stock: ${newStock}`);
            } else {
              console.error(`❌ Stock update failed: ID ${idCodeInt} - no rows affected.`);
              // Check if the ID exists in stock table
              const [checkId] = await conn.query(
                `SELECT ID, QTY FROM tbl_stock WHERE ID = ?`,
                [idCodeInt]
              );
              if (checkId.length === 0) {
                console.error(`   ❌ ID ${idCodeInt} does not exist in tbl_stock!`);
              } else {
                console.error(`   ⚠️ ID exists but update didn't work. Current QTY: ${checkId[0].QTY}`);
              }
              // Add error if stock update failed (only for new records to avoid rollback of existing ones)
              if (!recordExists) {
                stockErrors.push({
                  idcode: record.IDCODE,
                  benz: record.BENZ || 'N/A',
                  brand: record.BRAND || 'N/A',
                  receipt: record.RECEIPT,
                  error: 'Stock update failed - ID may not match'
                });
              }
            }
            
            continue;
          }
          
          // For positive quantities, only process if record doesn't exist
          if (recordExists) {
            skippedCount++;
            continue;
          }
          
          // Positive quantity - check stock availability
          if (availableStock < recordQty) {
            // Insufficient stock
            stockErrors.push({
              idcode: record.IDCODE,
              benz: record.BENZ || 'N/A',
              brand: record.BRAND || 'N/A',
              receipt: record.RECEIPT,
              available: availableStock,
              required: recordQty,
              error: 'Insufficient stock'
            });
            continue; // Skip this record
          }
          
          // Stock is available - proceed with insert and stock deduction
          // Insert new record into history
          await conn.query(
            `INSERT INTO history (
              CUSTOMER, DATE, RECEIPT, INVOICE, IDCODE,
              SELL, QTY, BENZ, BRAND, ALTNO,
              COLORCODE, REMARKS, COST
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              record.CUSTOMER,
              record.DATE,
              record.RECEIPT,
              record.INVOICE,
              idCodeInt, // Use parsed integer
              record.SELL,
              recordQty, // Use parsed integer
              record.BENZ,
              record.BRAND,
              record.ALTNO,
              record.COLORCODE,
              record.REMARKS,
              record.COST
            ]
          );
          
          // Deduct from stock (positive quantity means sale)
          const [updateResult] = await conn.query(
            `UPDATE tbl_stock SET QTY = QTY - ? WHERE ID = ?`,
            [recordQty, idCodeInt]
          );
          
          if (updateResult.affectedRows > 0) {
            console.log(`✅ Reduced stock: ID ${record.IDCODE} by ${recordQty} units`);
          } else {
            console.warn(`⚠️ Stock update failed: ID ${record.IDCODE} - no rows affected`);
          }
          
          savedCount++;
        }
        
        // If there are stock errors, rollback and return error
        if (stockErrors.length > 0) {
          await conn.rollback();
          conn.release();
          
          const errorMessages = stockErrors.map(err => {
            if (err.error === 'Stock item not found') {
              return `ID ${err.idcode} (${err.benz} - ${err.brand}): Stock item not found`;
            } else {
              return `ID ${err.idcode} (${err.benz} - ${err.brand}): Insufficient stock (Available: ${err.available}, Required: ${err.required})`;
            }
          }).join('\n');
          
          return res.status(400).json({
            success: false,
            message: `Cannot import: Stock errors detected`,
            errors: stockErrors,
            errorDetails: errorMessages
          });
        }
        
        await conn.commit();
        
        return res.json({
          success: true,
          message: `Successfully imported ${salesData.length} records from OUTGOING.DBF`,
          saved: savedCount,
          skipped: skippedCount,
          data: salesData,
          count: salesData.length
        });
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
    }
    
    // Return the data without saving
    res.json({
      success: true,
      message: `Successfully imported ${salesData.length} records from OUTGOING.DBF (preview only - not saved)`,
      data: salesData,
      count: salesData.length
    });

  } catch (error) {
    console.error('❌ DBF import error:', error);
    
    // Check if error is related to file locking
    if (error.code === 'EBUSY' || error.code === 'EPERM' || error.message.includes('locked') || error.message.includes('being used')) {
      return res.status(409).json({ 
        message: 'File is locked', 
        error: 'OUTGOING.DBF is currently open in another program (possibly track.exe). Please close it and try again.',
        details: error.message
      });
    }
    
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Clear today's sales history (Password protected - Developer Tools)
app.delete('/api/sales/history/clear-today', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin privileges required.' 
      });
    }
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    console.log(`🗑️ Clearing all sales history for today: ${todayStr}`);
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Get count of records to be deleted
      const [countResult] = await conn.query(
        `SELECT COUNT(*) as count FROM history WHERE DATE = ?`,
        [todayStr]
      );
      const deletedCount = countResult[0]?.count || 0;
      
      if (deletedCount === 0) {
        await conn.rollback();
        conn.release();
        return res.json({
          success: true,
          message: 'No sales history records found for today.',
          deletedCount: 0
        });
      }
      
      // Delete all records for today
      const [deleteResult] = await conn.query(
        `DELETE FROM history WHERE DATE = ?`,
        [todayStr]
      );
      
      await conn.commit();
      conn.release();
      
      console.log(`✅ Cleared ${deletedCount} sales history records for today`);
      
      res.json({
        success: true,
        message: `Successfully cleared ${deletedCount} sales history record(s) for today.`,
        deletedCount: deletedCount,
        date: todayStr
      });
      
    } catch (err) {
      await conn.rollback();
      conn.release();
      console.error('❌ Clear today\'s sales history error:', err);
      throw err;
    }
  } catch (error) {
    console.error('❌ Clear today\'s sales history error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Update sales history record
app.put('/api/sales/history/:idcode', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin privileges required to edit sales.' 
      });
    }
    
    const { idcode } = req.params;
    const { date, receipt, qty, customer, qty_new, unit_price, receipt_new, idcode_new, stock_details } = req.body;
    
    if (!idcode) {
      return res.status(400).json({ success: false, message: 'ID Code is required' });
    }
    
    if (!date || !qty) {
      return res.status(400).json({ success: false, message: 'Date and original quantity are required' });
    }
    
    if (!customer || customer.trim() === '') {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }
    
    if (!qty_new || qty_new <= 0) {
      return res.status(400).json({ success: false, message: 'New quantity must be greater than 0' });
    }
    
    if (unit_price === undefined || unit_price === null || unit_price < 0) {
      return res.status(400).json({ success: false, message: 'Unit price must be 0 or greater' });
    }
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Build WHERE clause to find the specific record
      let whereConditions = ['IDCODE = ?', 'DATE = ?', 'QTY = ?'];
      let queryParams = [idcode, date, qty];
      
      // Add receipt if provided for more precise matching
      if (receipt) {
        whereConditions.push('(RECEIPT = ? OR INVOICE = ?)');
        queryParams.push(receipt, receipt);
      }
      
      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
      
      // Get the record first to verify it exists
      const [records] = await conn.query(`
        SELECT IDCODE, QTY, DATE, RECEIPT, INVOICE, SELL, CUSTOMER
        FROM history
        ${whereClause}
        LIMIT 1
      `, queryParams);
      
      if (records.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ 
          success: false, 
          message: 'Sales record not found' 
        });
      }
      
      const record = records[0];
      const oldIdCode = parseInt(idcode);
      const oldQty = record.QTY || qty;
      const newQty = parseInt(qty_new);
      const qtyDifference = newQty - oldQty;
      const idCodeChanged = idcode_new && parseInt(idcode_new) !== oldIdCode;
      
      // If ID code changed, handle stock restoration and deduction
      if (idCodeChanged) {
        const newIdCode = parseInt(idcode_new);
        
        // 1. Return old ID's quantity to stock
        await conn.query('UPDATE tbl_stock SET QTY = QTY + ? WHERE ID = ?', [oldQty, oldIdCode]);
        console.log(`🔄 Returned ${oldQty} units to stock for old ID ${oldIdCode}`);
        
        // 2. Check if new ID has enough stock
        const [newStock] = await conn.query('SELECT QTY FROM tbl_stock WHERE ID = ?', [newIdCode]);
        if (newStock.length === 0) {
          await conn.rollback();
          conn.release();
          return res.status(404).json({ 
            success: false, 
            message: `Stock item with ID ${newIdCode} not found` 
          });
        }
        
        if (newStock[0].QTY < newQty) {
          // Rollback the old ID stock restoration
          await conn.query('UPDATE tbl_stock SET QTY = QTY - ? WHERE ID = ?', [oldQty, oldIdCode]);
          await conn.rollback();
          conn.release();
          return res.status(409).json({ 
            success: false, 
            message: `Insufficient stock for new item. Available: ${newStock[0].QTY}, Required: ${newQty}` 
          });
        }
        
        // 3. Deduct new ID's quantity from stock
        await conn.query('UPDATE tbl_stock SET QTY = QTY - ? WHERE ID = ?', [newQty, newIdCode]);
        console.log(`🔄 Deducted ${newQty} units from stock for new ID ${newIdCode}`);
      } else {
        // If ID code didn't change, handle quantity difference only
        if (qtyDifference !== 0) {
          // If quantity increased, deduct from stock
          // If quantity decreased, add back to stock
          if (qtyDifference > 0) {
            // Check if enough stock is available
            const [stock] = await conn.query('SELECT QTY FROM tbl_stock WHERE ID = ?', [oldIdCode]);
            if (stock.length === 0 || stock[0].QTY < qtyDifference) {
              await conn.rollback();
              conn.release();
              return res.status(409).json({ 
                success: false, 
                message: `Insufficient stock. Available: ${stock.length > 0 ? stock[0].QTY : 0}, Required: ${qtyDifference}` 
              });
            }
            // Deduct from stock
            await conn.query('UPDATE tbl_stock SET QTY = QTY - ? WHERE ID = ?', [qtyDifference, oldIdCode]);
          } else {
            // Add back to stock
            await conn.query('UPDATE tbl_stock SET QTY = QTY + ? WHERE ID = ?', [Math.abs(qtyDifference), oldIdCode]);
          }
        }
      }
      
      // Update the history record
      const updateFields = [];
      const updateParams = [];
      
      if (customer && customer.trim() !== '') {
        updateFields.push('CUSTOMER = ?');
        updateParams.push(customer.trim());
      }
      
      if (qty_new) {
        updateFields.push('QTY = ?');
        updateParams.push(newQty);
      }
      
      if (unit_price !== undefined && unit_price !== null) {
        updateFields.push('SELL = ?');
        updateParams.push(parseFloat(unit_price));
      }
      
      if (receipt_new && receipt_new.trim() !== '') {
        // Update both RECEIPT and INVOICE if they match
        updateFields.push('RECEIPT = ?');
        updateFields.push('INVOICE = ?');
        updateParams.push(receipt_new.trim());
        updateParams.push(receipt_new.trim());
      }
      
      // If ID code changed, update IDCODE and stock details
      if (idCodeChanged) {
        updateFields.push('IDCODE = ?');
        updateParams.push(parseInt(idcode_new));
        
        // Update stock details if provided
        if (stock_details) {
          if (stock_details.benz) {
            updateFields.push('BENZ = ?');
            updateParams.push(stock_details.benz);
          }
          if (stock_details.brand) {
            updateFields.push('BRAND = ?');
            updateParams.push(stock_details.brand);
          }
          if (stock_details.altno) {
            updateFields.push('ALTNO = ?');
            updateParams.push(stock_details.altno);
          }
          if (stock_details.description) {
            updateFields.push('REMARKS = ?');
            updateParams.push(stock_details.description);
          }
        }
      }
      
      if (updateFields.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ 
          success: false, 
          message: 'No fields to update' 
        });
      }
      
      // Add WHERE clause params
      updateParams.push(...queryParams);
      
      await conn.query(`
        UPDATE history
        SET ${updateFields.join(', ')}
        ${whereClause}
        LIMIT 1
      `, updateParams);
      
      await conn.commit();
      conn.release();
      
      console.log(`✅ Updated sales history record: ID ${idcode}, Date ${date}`);
      res.json({ 
        success: true, 
        message: 'Sales record updated successfully',
        qty_difference: qtyDifference
      });
      
    } catch (err) {
      await conn.rollback();
      conn.release();
      console.error('❌ Update sales history error:', err);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update sales record',
        error: err.message 
      });
    }
  } catch (error) {
    console.error('❌ Update sales history error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
});

app.delete('/api/sales/history/:idcode', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin privileges required to delete sales.' 
      });
    }
    
    const { idcode } = req.params;
    const { date, receipt, qty, return_to_stock = true } = req.body;
    
    if (!idcode) {
      return res.status(400).json({ success: false, message: 'ID Code is required' });
    }
    
    if (!date || !qty) {
      return res.status(400).json({ success: false, message: 'Date and quantity are required' });
    }
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Build WHERE clause to find the specific record (no table alias for DELETE)
      let whereConditions = ['IDCODE = ?', 'DATE = ?', 'QTY = ?'];
      let queryParams = [idcode, date, qty];
      
      // Add receipt if provided for more precise matching
      if (receipt) {
        whereConditions.push('(RECEIPT = ? OR INVOICE = ?)');
        queryParams.push(receipt, receipt);
      }
      
      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
      
      // Get the record first to verify it exists (can use alias in SELECT)
      const [records] = await conn.query(`
        SELECT IDCODE, QTY, DATE, RECEIPT, INVOICE
        FROM history
        ${whereClause}
        LIMIT 1
      `, queryParams);
      
      if (records.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ 
          success: false, 
          message: 'Sales record not found' 
        });
      }
      
      const record = records[0];
      const quantityToRestore = record.QTY || qty;
      
      console.log(`🔄 Deleting sales history record: ID ${idcode}, Date ${date}, Qty ${quantityToRestore}`);
      
      // Conditionally restore quantity to tbl_stock based on return_to_stock flag
      if (return_to_stock) {
        console.log(`🔄 Restoring ${quantityToRestore} units back to stock for ID ${idcode}`);
        const [updateResult] = await conn.query(
          'UPDATE tbl_stock SET QTY = QTY + ? WHERE ID = ?',
          [quantityToRestore, idcode]
        );
        
        if (updateResult.affectedRows === 0) {
          console.warn(`⚠️ Stock item with ID ${idcode} not found in tbl_stock, but continuing with deletion`);
        }
      } else {
        console.log(`⚠️ NOT restoring quantity to stock (return_to_stock = false)`);
      }
      
      // Delete the record from history (no table alias in DELETE WHERE clause)
      await conn.query(`
        DELETE FROM history
        ${whereClause}
        LIMIT 1
      `, queryParams);
      
      await conn.commit();
      conn.release();
      
      if (return_to_stock) {
        console.log(`✅ Sales history record deleted successfully. Returned ${quantityToRestore} units to stock.`);
        res.json({ 
          success: true,
          message: `Sale deleted successfully. ${quantityToRestore} unit(s) returned to stock.`,
          restoredQuantity: quantityToRestore,
          stockItemId: idcode,
          returnedToStock: true
        });
      } else {
        console.log(`✅ Sales history record deleted successfully. Quantity was NOT returned to stock.`);
        res.json({ 
          success: true,
          message: `Sale deleted successfully. Quantity was NOT returned to stock.`,
          restoredQuantity: 0,
          stockItemId: idcode,
          returnedToStock: false
        });
      }
      
    } catch (err) {
      await conn.rollback();
      conn.release();
      console.error('❌ Delete sales history error:', err);
      throw err;
    }
  } catch (error) {
    console.error('❌ Delete sales history error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Get item movement/sales history by BENZ number
app.get('/api/stock/movement/:benz', authenticateToken, async (req, res) => {
  try {
    const { benz } = req.params;
    const { brand, altno } = req.query; // Optional filters
    
    if (!benz) {
      return res.status(400).json({ 
        success: false,
        message: 'BENZ number is required' 
      });
    }
    
    console.log(`📦 Fetching movement history for BENZ: ${benz}${brand ? `, Brand: ${brand}` : ''}${altno ? `, ALTNO: ${altno}` : ''}`);
    
    let whereConditions = [];
    let queryParams = [];
    
    // Match BENZ (history table only has BENZ column)
    // Also handle space-insensitive matching
    const benzNoSpaces = benz.replace(/\s+/g, '');
    whereConditions.push(`(
      h.BENZ = ? OR 
      REPLACE(h.BENZ, ' ', '') = ?
    )`);
    queryParams.push(benz, benzNoSpaces);
    
    // Optional brand filter
    if (brand) {
      whereConditions.push(`h.BRAND = ?`);
      queryParams.push(brand);
    }
    
    // Optional ALTNO filter
    if (altno) {
      whereConditions.push(`h.ALTNO = ?`);
      queryParams.push(altno);
    }
    
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    
    // Get all movement history for this BENZ
    const movementQuery = `
      SELECT 
        h.DATE,
        h.CUSTOMER,
        h.QTY as quantity,
        h.SELL as price,
        h.IDCODE as id,
        h.RECEIPT,
        h.INVOICE,
        h.BENZ,
        h.BRAND,
        h.ALTNO,
        (h.SELL * h.QTY) as total_amount
      FROM history h
      ${whereClause}
      ORDER BY h.DATE DESC, h.RECEIPT DESC
    `;
    
    const [rows] = await pool.query(movementQuery, queryParams);
    
    console.log(`📊 Found ${rows.length} movement records for BENZ: ${benz}`);
    
    res.json({
      success: true,
      data: rows,
      benz: benz,
      brand: brand || null,
      altno: altno || null,
      total: rows.length
    });
  } catch (error) {
    console.error('❌ Get item movement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get sales summary statistics
app.get('/api/sales/summary', authenticateToken, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let dateCondition = '';
    switch (period) {
      case 'today':
        dateCondition = 'DATE = \'2025-09-22\'';
        break;
      case 'week':
        dateCondition = 'DATE >= DATE_SUB(CURDATE(), INTERVAL 1 WEEK)';
        break;
      case 'month':
        dateCondition = 'DATE >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)';
        break;
      case 'year':
        dateCondition = 'DATE >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)';
        break;
      default:
        dateCondition = 'DATE >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)';
    }
    
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_sales,
        COUNT(DISTINCT CUSTOMER) as unique_customers,
        SUM(SELL * QTY) as total_revenue,
        COUNT(DISTINCT DATE) as active_days,
        AVG(SELL * QTY) as average_transaction_value
      FROM history 
      WHERE ${dateCondition}
    `;
    
    const [summaryResult] = await pool.query(summaryQuery);
    const summary = summaryResult[0];
    
    console.log(`📊 Sales Summary API Debug:`);
    console.log(`   - Period: ${period}`);
    console.log(`   - Query:`, summaryQuery);
    console.log(`   - Summary result:`, summary);
    
    res.json({
      todaySales: summary.total_revenue || 0,
      weekSales: summary.total_revenue || 0, 
      monthSales: summary.total_revenue || 0,
      totalTransactions: summary.total_sales || 0,
      avgSale: summary.average_transaction_value || 0,
      totalRevenue: summary.total_revenue || 0,
      period: period
    });
  } catch (error) {
    console.error('❌ Sales summary API error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// API to refund a sale item and return it to stock
app.post('/api/sales/refund', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { idcode, quantity, benz, brand, altno } = req.body;
    
    console.log('🔄 Refund request received:', { idcode, quantity, benz, brand, altno });
    
    if (!idcode || !quantity) {
      return res.status(400).json({ 
        success: false,
        message: 'ID Code and quantity are required' 
      });
    }
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Find the stock item in tbl_stock using IDCODE
      // IDCODE should match the ID field in tbl_stock
      const [stockResult] = await conn.query(
        'SELECT ID, QTY FROM tbl_stock WHERE ID = ?',
        [idcode]
      );
      
      if (!stockResult || stockResult.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ 
          success: false,
          message: `Stock item with ID ${idcode} not found in tbl_stock` 
        });
      }
      
      const stockItem = stockResult[0];
      console.log('📦 Found stock item:', stockItem);
      
      // Restore the quantity to tbl_stock
      await conn.query(
        'UPDATE tbl_stock SET QTY = QTY + ? WHERE ID = ?',
        [quantity, idcode]
      );
      
      // Get updated quantity
      const [updatedStock] = await conn.query(
        'SELECT QTY FROM tbl_stock WHERE ID = ?',
        [idcode]
      );
      
      console.log(`✅ Refund successful: Added ${quantity} units back to stock. New quantity: ${updatedStock[0].QTY}`);
      
      await conn.commit();
      conn.release();
      
      res.json({ 
        success: true, 
        message: 'Item refunded successfully',
        restoredQuantity: quantity,
        currentStock: updatedStock[0].QTY,
        stock_id: idcode
      });
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (error) {
    console.error('❌ Refund API error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Create Refund Request (PENDING Status) - New Workflow
// This creates a refund request but does NOT return quantity to stock yet
app.post('/api/sales/refund/create', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username || 'system';
    const { items, customer_name, receipt_number, invoice_number, cm_number, reason, notes } = req.body;
    
    console.log('🔄 Create Refund Request:', { items, customer_name, receipt_number, cm_number, reason });
    
    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'At least one item is required for refund' 
      });
    }

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ 
        success: false,
        message: 'Refund reason is required' 
      });
    }

    if (!cm_number || cm_number.trim() === '') {
      return res.status(400).json({ 
        success: false,
        message: 'CM Number is required' 
      });
    }
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Use provided CM Number instead of auto-generating
      const cmNumber = cm_number.trim();
      
      // Check if CM number already exists
      const [existingCM] = await conn.query(
        'SELECT id FROM refunds WHERE cm_number = ?',
        [cmNumber]
      );
      
      if (existingCM.length > 0) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ 
          success: false,
          message: `CM Number ${cmNumber} already exists. Please use a different CM number.` 
        });
      }
      
      console.log('📝 Using CM Number from input:', cmNumber);
      
      // Calculate total amount
      let totalAmount = 0;
      const refundItems = [];
      
      for (const item of items) {
        const { idcode, date, receipt, quantity, unit_price } = item;
        
        if (!idcode || !quantity) {
          throw new Error(`Missing required fields for item: idcode=${idcode}, quantity=${quantity}`);
        }
        
        const amount = (parseFloat(unit_price) || 0) * parseInt(quantity);
        totalAmount += amount;
        
        refundItems.push({
          idcode,
          date,
          receipt,
          quantity: parseInt(quantity),
          unit_price: parseFloat(unit_price) || 0,
          amount
        });
      }
      
      // Get item details from first item for customer/receipt info if not provided
      const firstItem = items[0];
      const finalCustomerName = customer_name || firstItem.customer || 'Walk-in Customer';
      const finalReceiptNumber = receipt_number || firstItem.receipt || firstItem.invoice || '';
      const finalInvoiceNumber = invoice_number || firstItem.invoice || firstItem.receipt || '';
      
      // Insert refund record
      const [refundResult] = await conn.query(
        `INSERT INTO refunds (
          cm_number, status, customer_name, receipt_number, invoice_number,
          refund_date, reason, notes, total_amount, created_by
        ) VALUES (?, 'PENDING', ?, ?, ?, CURDATE(), ?, ?, ?, ?)`,
        [cmNumber, finalCustomerName, finalReceiptNumber, finalInvoiceNumber, reason, notes || null, totalAmount, username]
      );
      
      const refundId = refundResult.insertId;
      console.log('✅ Refund record created:', refundId);
      
      // Insert refund items
      for (const item of refundItems) {
        // Get item details from history table if available
        let itemDetails = null;
        if (item.date && item.receipt) {
          try {
            // Convert date to proper format if needed
            let dateValue = item.date;
            if (typeof dateValue === 'string' && dateValue.includes('T')) {
              dateValue = dateValue.split('T')[0];
            }
            
            const [historyResult] = await conn.query(
              `SELECT BENZ, BRAND, ALTNO, COLORCODE FROM history 
               WHERE IDCODE = ? AND DATE = ? AND RECEIPT = ? LIMIT 1`,
              [item.idcode, dateValue, item.receipt]
            );
            if (historyResult.length > 0) {
              itemDetails = historyResult[0];
            }
          } catch (historyErr) {
            console.log('⚠️ Could not fetch from history table:', historyErr.message);
          }
        }
        
        // If not found in history, try to get from tbl_stock
        if (!itemDetails) {
          try {
            const [stockResult] = await conn.query(
              'SELECT BENZ, BRAND, ALTNO, COLORCODE FROM tbl_stock WHERE ID = ? LIMIT 1',
              [item.idcode]
            );
            if (stockResult.length > 0) {
              itemDetails = stockResult[0];
            }
          } catch (stockErr) {
            console.log('⚠️ Could not fetch from tbl_stock:', stockErr.message);
          }
        }
        
        // Insert refund item
        const [refundItemResult] = await conn.query(
          `INSERT INTO refund_items (
            refund_id, idcode, benz, brand, altno, colorcode,
            quantity, unit_price, amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            refundId,
            String(item.idcode || ''),
            itemDetails?.BENZ || null,
            itemDetails?.BRAND || null,
            itemDetails?.ALTNO || null,
            itemDetails?.COLORCODE || null,
            item.quantity,
            item.unit_price,
            item.amount
          ]
        );
        
        const refundItemId = refundItemResult.insertId;
        
        // Create history_refund_status record for quick status lookup
        // Convert date to proper format
        let dateValue = item.date || new Date().toISOString().split('T')[0];
        if (typeof dateValue === 'string' && dateValue.includes('T')) {
          dateValue = dateValue.split('T')[0];
        }
        
        try {
          await conn.query(
            `INSERT INTO history_refund_status (
              history_idcode, history_date, history_receipt,
              refund_id, refund_item_id, status
            ) VALUES (?, ?, ?, ?, ?, 'PENDING')
            ON DUPLICATE KEY UPDATE 
              refund_id = VALUES(refund_id),
              refund_item_id = VALUES(refund_item_id),
              status = 'PENDING',
              updated_at = CURRENT_TIMESTAMP`,
            [
              String(item.idcode || ''),
              dateValue,
              String(item.receipt || finalReceiptNumber),
              refundId,
              refundItemId
            ]
          );
        } catch (statusErr) {
          // If duplicate key error, that's okay - just log it
          if (statusErr.code !== 'ER_DUP_ENTRY') {
            console.error('⚠️ Error creating history_refund_status:', statusErr.message);
            throw statusErr;
          }
        }
      }
      
      await conn.commit();
      conn.release();
      
      console.log('✅ Refund request created successfully:', { refundId, cmNumber, totalAmount });
      
      res.json({ 
        success: true, 
        message: 'Refund request created successfully',
        refund_id: refundId,
        cm_number: cmNumber,
        total_amount: totalAmount,
        status: 'PENDING',
        items_count: refundItems.length
      });
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (error) {
    console.error('❌ Create Refund Request API error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      sql: error.sql,
      sqlMessage: error.sqlMessage,
      stack: error.stack
    });
    res.status(500).json({ 
      success: false,
      message: error.sqlMessage || error.message || 'Server error', 
      error: error.message,
      code: error.code
    });
  }
});

// Get all refunds with items grouped by CM#
app.get('/api/sales/refunds', authenticateToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const conn = await pool.getConnection();
    try {
      // Build WHERE clause
      let whereClause = '1=1';
      const params = [];
      
      if (status && status !== 'all') {
        whereClause += ' AND r.status = ?';
        params.push(status);
      }
      
      // Get total count
      const [countResult] = await conn.query(
        `SELECT COUNT(DISTINCT r.id) as total FROM refunds r WHERE ${whereClause}`,
        params
      );
      const total = countResult[0].total;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      // Get refunds with pagination
      const [refunds] = await conn.query(
        `SELECT 
          r.id,
          r.cm_number,
          r.status,
          r.customer_name,
          r.receipt_number,
          r.invoice_number,
          r.refund_date,
          r.reason,
          r.notes,
          r.total_amount,
          r.created_by,
          r.created_at,
          r.confirmed_by,
          r.confirmed_at,
          COUNT(ri.id) as items_count
        FROM refunds r
        LEFT JOIN refund_items ri ON r.id = ri.refund_id
        WHERE ${whereClause}
        GROUP BY r.id
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset]
      );
      
      // Get items for each refund
      const refundIds = refunds.map(r => r.id);
      let refundItemsMap = {};
      
      if (refundIds.length > 0) {
        const [items] = await conn.query(
          `SELECT 
            ri.*,
            ri.refund_id
          FROM refund_items ri
          WHERE ri.refund_id IN (${refundIds.map(() => '?').join(',')})
          ORDER BY ri.id`,
          refundIds
        );
        
        // Group items by refund_id
        items.forEach(item => {
          if (!refundItemsMap[item.refund_id]) {
            refundItemsMap[item.refund_id] = [];
          }
          refundItemsMap[item.refund_id].push(item);
        });
      }
      
      // Attach items to each refund
      const refundsWithItems = refunds.map(refund => ({
        ...refund,
        items: refundItemsMap[refund.id] || []
      }));
      
      conn.release();
      
      res.json({
        success: true,
        data: refundsWithItems,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (err) {
      conn.release();
      throw err;
    }
  } catch (error) {
    console.error('❌ Get refunds error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get refund details for a specific sale item
app.get('/api/sales/refund/details', authenticateToken, async (req, res) => {
  try {
    const { idcode, date, receipt } = req.query;
    
    if (!idcode || !date || !receipt) {
      return res.status(400).json({
        success: false,
        message: 'ID Code, Date, and Receipt are required'
      });
    }
    
    const conn = await pool.getConnection();
    try {
      // Get refund status and details from history_refund_status
      // Use r.status from refunds table (not hrs.status) as it's the actual refund status
      const [refundStatus] = await conn.query(
        `SELECT 
          r.status,
          hrs.status as history_status,
          hrs.refund_id,
          r.cm_number,
          r.reason,
          r.notes,
          r.refund_date,
          r.created_by,
          r.created_at,
          r.confirmed_by,
          r.confirmed_at,
          ri.quantity,
          ri.amount
        FROM history_refund_status hrs
        LEFT JOIN refunds r ON hrs.refund_id = r.id
        LEFT JOIN refund_items ri ON hrs.refund_item_id = ri.id
        WHERE hrs.history_idcode = ? 
        AND hrs.history_date = ? 
        AND hrs.history_receipt = ?
        LIMIT 1`,
        [idcode, date, receipt]
      );
      
      conn.release();
      
      if (refundStatus.length === 0) {
        return res.json({
          success: true,
          hasRefund: false,
          data: null
        });
      }
      
      res.json({
        success: true,
        hasRefund: true,
        data: refundStatus[0]
      });
    } catch (err) {
      conn.release();
      throw err;
    }
  } catch (error) {
    console.error('❌ Get refund details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Batch endpoint: Get refund details for multiple sale items in one request
app.post('/api/sales/refund/details/batch', authenticateToken, async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items array is required and must not be empty'
      });
    }

    // Limit batch size to prevent abuse (max 200 items per batch)
    if (items.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Batch size cannot exceed 200 items'
      });
    }

    // Validate all items have required fields
    const invalidItems = items.filter(item => !item.idcode || !item.date || !item.receipt);
    if (invalidItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'All items must have idcode, date, and receipt fields'
      });
    }
    
    const conn = await pool.getConnection();
    try {
      // Build WHERE clause with multiple OR conditions for batch query
      // This is more efficient than making 50 separate queries
      const conditions = [];
      const params = [];
      
      items.forEach((item, index) => {
        conditions.push(`(hrs.history_idcode = ? AND hrs.history_date = ? AND hrs.history_receipt = ?)`);
        params.push(item.idcode, item.date, item.receipt);
      });

      // Single query to get all refund statuses at once
      const [refundStatuses] = await conn.query(
        `SELECT 
          hrs.history_idcode,
          hrs.history_date,
          hrs.history_receipt,
          r.status,
          hrs.status as history_status,
          hrs.refund_id,
          r.cm_number,
          r.reason,
          r.notes,
          r.refund_date,
          r.created_by,
          r.created_at,
          r.confirmed_by,
          r.confirmed_at,
          ri.quantity,
          ri.amount
        FROM history_refund_status hrs
        LEFT JOIN refunds r ON hrs.refund_id = r.id
        LEFT JOIN refund_items ri ON hrs.refund_item_id = ri.id
        WHERE ${conditions.join(' OR ')}`,
        params
      );
      
      conn.release();
      
      // Build result map: key = "idcode-date-receipt", value = refund data
      const resultMap = {};
      
      // Initialize all items as having no refund
      items.forEach(item => {
        const key = `${item.idcode}-${item.date}-${item.receipt}`;
        resultMap[key] = {
          hasRefund: false,
          data: null
        };
      });
      
      // Fill in items that have refunds
      refundStatuses.forEach(refund => {
        const key = `${refund.history_idcode}-${refund.history_date}-${refund.history_receipt}`;
        if (resultMap[key]) {
          resultMap[key] = {
            hasRefund: true,
            data: {
              status: refund.status,
              history_status: refund.history_status,
              refund_id: refund.refund_id,
              cm_number: refund.cm_number,
              reason: refund.reason,
              notes: refund.notes,
              refund_date: refund.refund_date,
              created_by: refund.created_by,
              created_at: refund.created_at,
              confirmed_by: refund.confirmed_by,
              confirmed_at: refund.confirmed_at,
              quantity: refund.quantity,
              amount: refund.amount
            }
          };
        }
      });
      
      res.json({
        success: true,
        data: resultMap
      });
    } catch (err) {
      conn.release();
      throw err;
    }
  } catch (error) {
    console.error('❌ Batch get refund details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Confirm refund - return items to stock and make QTY/price negative in history
app.post('/api/sales/refunds/:id/confirm', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.user.username || 'system';
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Get refund with items
      const [refunds] = await conn.query(
        'SELECT * FROM refunds WHERE id = ? AND status = ?',
        [id, 'PENDING']
      );
      
      if (refunds.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({
          success: false,
          message: 'Refund not found or already processed'
        });
      }
      
      const refund = refunds[0];
      
      // Get refund items
      const [items] = await conn.query(
        'SELECT * FROM refund_items WHERE refund_id = ?',
        [id]
      );
      
      if (items.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({
          success: false,
          message: 'No items found for this refund'
        });
      }
      
      // Process each item
      for (const item of items) {
        // Get the original sale date and receipt from history_refund_status
        const [statusRecords] = await conn.query(
          `SELECT history_date, history_receipt 
           FROM history_refund_status 
           WHERE refund_id = ? AND refund_item_id = ? 
           LIMIT 1`,
          [id, item.id]
        );
        
        let saleDate, saleReceipt;
        if (statusRecords.length > 0) {
          saleDate = statusRecords[0].history_date;
          saleReceipt = statusRecords[0].history_receipt;
        } else {
          // Fallback: try to find from history table using idcode
          const [historyRecords] = await conn.query(
            `SELECT DATE, RECEIPT FROM history 
             WHERE IDCODE = ? AND QTY > 0 
             ORDER BY DATE DESC LIMIT 1`,
            [item.idcode]
          );
          if (historyRecords.length > 0) {
            saleDate = historyRecords[0].DATE;
            saleReceipt = historyRecords[0].RECEIPT;
          } else {
            // Last resort: use refund data
            saleDate = refund.refund_date;
            saleReceipt = refund.receipt_number;
          }
        }
        
        // Insert a new negative record for the refund on TODAY's date (keep original record unchanged)
        // Get the original history record details
        const [originalRecords] = await conn.query(
          `SELECT * FROM history 
           WHERE IDCODE = ? AND DATE = ? AND RECEIPT = ? AND QTY > 0
           LIMIT 1`,
          [item.idcode, saleDate, saleReceipt]
        );
        
        if (originalRecords.length > 0) {
          const original = originalRecords[0];
          // Get today's date
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
          
          // Insert a new negative record as a duplicate on TODAY's date (for refund display)
          await conn.query(
            `INSERT INTO history (
              CUSTOMER, DATE, RECEIPT, INVOICE, IDCODE,
              SELL, QTY, BENZ, BRAND, ALTNO,
              COLORCODE, REMARKS, COST,
              source, requisition_number, repair_order_number, plate_number
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              original.CUSTOMER,
              today, // Use today's date instead of original date
              original.RECEIPT, // Same receipt number as original
              original.INVOICE || original.RECEIPT, // Same invoice number as original
              original.IDCODE,
              -Math.abs(original.SELL || 0), // Negative unit price
              -Math.abs(item.quantity), // Negative quantity (use refund quantity)
              original.BENZ,
              original.BRAND,
              original.ALTNO,
              original.COLORCODE,
              original.REMARKS,
              original.COST || 0,
              original.source || null,
              original.requisition_number || null,
              original.repair_order_number || null,
              original.plate_number || null
            ]
          );
        }
        
        // Return quantity to stock
        await conn.query(
          'UPDATE tbl_stock SET QTY = QTY + ? WHERE ID = ?',
          [item.quantity, item.idcode]
        );
      }
      
      // Update refund status to CONFIRMED
      await conn.query(
        `UPDATE refunds 
         SET status = 'CONFIRMED', confirmed_by = ?, confirmed_at = NOW()
         WHERE id = ?`,
        [username, id]
      );
      
      await conn.commit();
      conn.release();
      
      res.json({
        success: true,
        message: 'Refund confirmed. Items returned to stock and history updated.',
        refund_id: id
      });
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (error) {
    console.error('❌ Confirm refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Cancel refund - remove pending status
app.post('/api/sales/refunds/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.user.username || 'system';
    const { reason } = req.body;
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Get refund
      const [refunds] = await conn.query(
        'SELECT * FROM refunds WHERE id = ? AND status = ?',
        [id, 'PENDING']
      );
      
      if (refunds.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({
          success: false,
          message: 'Refund not found or already processed'
        });
      }
      
      // Update refund status to CANCELLED
      await conn.query(
        `UPDATE refunds 
         SET status = 'CANCELLED', cancelled_by = ?, cancelled_at = NOW(), cancellation_reason = ?
         WHERE id = ?`,
        [username, reason || null, id]
      );
      
      await conn.commit();
      conn.release();
      
      res.json({
        success: true,
        message: 'Refund cancelled successfully.',
        refund_id: id
      });
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (error) {
    console.error('❌ Cancel refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// History Import API Endpoints

// Import history from default HISTORY.DBF location
app.post('/api/history/import-dbf', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Starting history import from HISTORY.DBF...');
    
    const DBFReader = require('./dbf-reader');
    const fs = require('fs');
    const path = require('path');
    
    // Default DBF file path - check C:\Rae\Files\ first (like other DBF files)
    const dbfPath1 = 'C:\\Rae\\Files\\HISTORY.DBF';
    const dbfPath2 = path.join(__dirname, 'CSV FILES', 'HISTORY.DBF');
    
    let dbfPath;
    if (fs.existsSync(dbfPath1)) {
      dbfPath = dbfPath1;
      console.log(`📁 Found HISTORY.DBF at: ${dbfPath}`);
    } else if (fs.existsSync(dbfPath2)) {
      dbfPath = dbfPath2;
      console.log(`📁 Found HISTORY.DBF at: ${dbfPath}`);
    } else {
      return res.status(400).json({
        success: false,
        message: `HISTORY.DBF file not found. Checked:\n- ${dbfPath1}\n- ${dbfPath2}`
      });
    }
    
    // Read DBF file
    const reader = new DBFReader(dbfPath);
    const records = await reader.read();
    
    if (!records || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No records found in HISTORY.DBF file'
      });
    }
    
    // Debug: Log first record to see actual field names and values
    if (records.length > 0) {
      console.log('📋 First record from DBF:');
      console.log('   Field names:', Object.keys(records[0]));
      console.log('   Sample record:', JSON.stringify(records[0], null, 2));
    }
    
    // Clear existing history data
    await pool.execute('DELETE FROM history');
    console.log('🗑️ Cleared existing history data');
    
    // Insert new records
    let importedCount = 0;
    const batchSize = 100;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const insertQuery = `
        INSERT INTO history (
          CUSTOMER, DATE, RECEIPT, INVOICE, IDCODE, 
          SELL, QTY, BENZ, BRAND, ALTNO, 
          COLORCODE, REMARKS, COST
        ) VALUES ${batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}
      `;
      
      const values = batch.flatMap((record, index) => {
        // Map DBF field names to database column names
        // DBF fields: DATEMER, SELLE, QTYE, BENZE, REMARKSE, COSTKSE
        // DB columns: DATE, SELL, QTY, BENZ, REMARKS, COST
        const fieldMapping = {
          'DATEMER': 'DATE',
          'SELLE': 'SELL',
          'QTYE': 'QTY',
          'BENZE': 'BENZ',
          'REMARKSE': 'REMARKS',
          'COSTKSE': 'COST'
        };
        
        // Normalize field names - DBF files might have uppercase field names
        // Try to find fields case-insensitively with field mapping
        const getField = (dbColumnName) => {
          // First, check if there's a mapping for this column
          const dbfFieldName = Object.keys(fieldMapping).find(key => fieldMapping[key] === dbColumnName);
          
          // Try to find the field in the record
          let fieldValue = undefined;
          
          // Try mapped DBF field name first
          if (dbfFieldName) {
            if (record[dbfFieldName] !== undefined) fieldValue = record[dbfFieldName];
            if (record[dbfFieldName.toUpperCase()] !== undefined) fieldValue = record[dbfFieldName.toUpperCase()];
            if (record[dbfFieldName.toLowerCase()] !== undefined) fieldValue = record[dbfFieldName.toLowerCase()];
          }
          
          // Also try direct column name (for fields that match)
          if (fieldValue === undefined) {
            if (record[dbColumnName] !== undefined) fieldValue = record[dbColumnName];
            if (record[dbColumnName.toUpperCase()] !== undefined) fieldValue = record[dbColumnName.toUpperCase()];
            if (record[dbColumnName.toLowerCase()] !== undefined) fieldValue = record[dbColumnName.toLowerCase()];
          }
          
          return fieldValue;
        };
        
        // Parse and format DATE properly
        let formattedDate = null;
        const dateValue = getField('DATE');
        if (dateValue) {
          // Log first few records to debug date format
          if (importedCount === 0 && index < 3) {
            console.log(`📅 Sample DATE from DBF - Record ${index + 1}:`, {
              raw: dateValue,
              type: typeof dateValue,
              isDate: dateValue instanceof Date
            });
          }
          // If DATE is a Date object, convert to YYYY-MM-DD format
          if (dateValue instanceof Date) {
            const year = dateValue.getFullYear();
            const month = String(dateValue.getMonth() + 1).padStart(2, '0');
            const day = String(dateValue.getDate()).padStart(2, '0');
            formattedDate = `${year}-${month}-${day}`;
          } 
          // If DATE is already a string, try to parse and format it
          else if (typeof dateValue === 'string') {
            const dateStr = dateValue.trim();
            // Check if it's already in YYYY-MM-DD format
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
              formattedDate = dateStr;
            } 
            // Try YYMMDD format (common in DBF files)
            else if (/^\d{6}$/.test(dateStr)) {
              const year = '20' + dateStr.substring(0, 2);
              const month = dateStr.substring(2, 4);
              const day = dateStr.substring(4, 6);
              formattedDate = `${year}-${month}-${day}`;
            }
            // Try YYYYMMDD format
            else if (/^\d{8}$/.test(dateStr)) {
              const year = dateStr.substring(0, 4);
              const month = dateStr.substring(4, 6);
              const day = dateStr.substring(6, 8);
              formattedDate = `${year}-${month}-${day}`;
            }
            // Try MM/DD/YYYY format (common in DBF files like HISTORY.DBF)
            // This format is shown in DBF Viewer as "01/02/2019"
            else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
              const parts = dateStr.split('/');
              // Assume MM/DD/YYYY format (US format as shown in DBF Viewer)
              const month = parts[0].padStart(2, '0');
              const day = parts[1].padStart(2, '0');
              const year = parts[2];
              // Validate the date makes sense
              const parsedDate = new Date(`${year}-${month}-${day}`);
              if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() >= 2000 && 
                  parsedDate.getMonth() + 1 === parseInt(month) && 
                  parsedDate.getDate() === parseInt(day)) {
                formattedDate = `${year}-${month}-${day}`;
              } else {
                // If MM/DD doesn't work, try DD/MM (European format)
                const parsedDateAlt = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                if (!isNaN(parsedDateAlt.getTime()) && parsedDateAlt.getFullYear() >= 2000) {
                  const altYear = parsedDateAlt.getFullYear();
                  const altMonth = String(parsedDateAlt.getMonth() + 1).padStart(2, '0');
                  const altDay = String(parsedDateAlt.getDate()).padStart(2, '0');
                  formattedDate = `${altYear}-${altMonth}-${altDay}`;
                } else {
                  console.warn(`⚠️ Invalid date format: ${dateStr}`);
                }
              }
            }
            // Try to parse other common formats
            else {
              const parsedDate = new Date(dateStr);
              if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() >= 2000) {
                const year = parsedDate.getFullYear();
                const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                const day = String(parsedDate.getDate()).padStart(2, '0');
                formattedDate = `${year}-${month}-${day}`;
              } else {
                console.warn(`⚠️ Could not parse date: ${dateStr} (type: ${typeof dateValue})`);
              }
            }
          }
          // If DATE is a number (days since epoch), convert it
          else if (typeof dateValue === 'number') {
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              formattedDate = `${year}-${month}-${day}`;
            }
          }
        }
        
        // Get all field values with proper mapping
        const customerValue = getField('CUSTOMER');
        const receiptValue = getField('RECEIPT');
        const invoiceValue = getField('INVOICE');
        const idcodeValue = getField('IDCODE');
        const sellValue = getField('SELL');
        const qtyValue = getField('QTY');
        const benzValue = getField('BENZ');
        const brandValue = getField('BRAND');
        const altnoValue = getField('ALTNO');
        const colorcodeValue = getField('COLORCODE');
        const remarksValue = getField('REMARKS');
        const costValue = getField('COST');
        
        // Log first few records for debugging
        if (importedCount === 0 && index < 3) {
          console.log(`📊 Sample record ${index + 1} mapping:`, {
            'CUSTOMER': customerValue,
            'DATE': dateValue,
            'RECEIPT': receiptValue,
            'INVOICE': invoiceValue,
            'IDCODE': idcodeValue,
            'SELL': sellValue,
            'QTY': qtyValue,
            'BENZ': benzValue,
            'BRAND': brandValue,
            'ALTNO': altnoValue,
            'COLORCODE': colorcodeValue,
            'REMARKS': remarksValue,
            'COST': costValue
          });
        }
        
        return [
          customerValue || null,
          formattedDate,
          receiptValue || null,
          // INVOICE is Logical (L1) in DBF - convert T/Y to '1', F/N to '0' or null
          invoiceValue === true || invoiceValue === 'T' || invoiceValue === 'Y' || invoiceValue === 't' || invoiceValue === 'y' ? '1' : (invoiceValue || null),
          idcodeValue !== null && idcodeValue !== undefined ? parseInt(idcodeValue) : null,
          sellValue !== null && sellValue !== undefined ? parseFloat(sellValue) : 0,
          qtyValue !== null && qtyValue !== undefined ? parseInt(qtyValue) : 0,
          benzValue || null,
          brandValue || null,
          altnoValue || null,
          colorcodeValue || null,
          remarksValue || null,
          costValue !== null && costValue !== undefined ? parseFloat(costValue) : 0
        ];
      });
      
      await pool.execute(insertQuery, values);
      importedCount += batch.length;
    }
    
    console.log(`✅ Successfully imported ${importedCount} history records`);
    
    res.json({
      success: true,
      message: 'History data imported successfully',
      imported: importedCount
    });
    
  } catch (error) {
    console.error('❌ History import error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import history data',
      error: error.message
    });
  }
});

// Import history from C:\Rae\Files\HISTORY.DBF
app.post('/api/history/import-rae-dbf', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Starting Rae OUTMAIN import from C:\\Rae\\Files\\OUTMAIN.DBF...');
    
    const DBFReader = require('./dbf-reader');
    const fs = require('fs');
    const path = require('path');
    
    // Try both possible file extensions for OUTMAIN
    const dbfPath1 = 'C:\\Rae\\Files\\OUTMAIN.DBF';
    const dbfPath2 = 'C:\\Rae\\Files\\OUTMAIN.DB';
    
    let dbfPath;
    if (fs.existsSync(dbfPath1)) {
      dbfPath = dbfPath1;
    } else if (fs.existsSync(dbfPath2)) {
      dbfPath = dbfPath2;
    } else {
      return res.status(400).json({
        success: false,
        message: `OUTMAIN file not found. Checked:\n- ${dbfPath1}\n- ${dbfPath2}`
      });
    }
    
    console.log(`📁 Found OUTMAIN file at: ${dbfPath}`);
    
    // Read DBF file
    const reader = new DBFReader(dbfPath);
    const records = await reader.read();
    
    if (!records || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No records found in OUTMAIN.DBF file'
      });
    }
    
    console.log(`📊 DBF Analysis:`);
    console.log(`   - Total records in DBF file: ${records.length} (after filtering deleted records)`);
    console.log(`   - Records ready for import: ${records.length}`);
    
    // Show some sample records for debugging
    if (records.length > 0) {
      console.log(`📋 Sample record structure:`, Object.keys(records[0]));
      console.log(`📋 First record data:`, records[0]);
      console.log(`📋 Field mapping check:`);
      console.log(`   - CUSTOMER: "${records[0].CUSTOMER}"`);
      console.log(`   - DATEMER: "${records[0].DATEMER}"`);
      console.log(`   - SELLE: "${records[0].SELLE}"`);
      console.log(`   - QTYE: "${records[0].QTYE}"`);
      console.log(`   - BENZE: "${records[0].BENZE}"`);
    }
    
    // Clear existing history data
    await pool.execute('DELETE FROM history');
    console.log('🗑️ Cleared existing history data');
    
    // Insert new records
    let importedCount = 0;
    const batchSize = 100;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const insertQuery = `
        INSERT INTO history (
          CUSTOMER, DATE, RECEIPT, INVOICE, IDCODE, 
          SELL, QTY, BENZ, BRAND, ALTNO, 
          COLORCODE, REMARKS, COST
        ) VALUES ${batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}
      `;
      
      const values = batch.flatMap(record => [
        record.CUSTOMER || null,
        // Handle date conversion from OUTMAIN format
        (() => {
          const dateValue = record.DATEMER || record.DATE;
          if (!dateValue) return null;
          
          // Convert various date formats to MySQL DATE format (YYYY-MM-DD)
          if (typeof dateValue === 'string') {
            // Handle formats like "09/17/2025" or "20250917"
            if (dateValue.includes('/')) {
              const [month, day, year] = dateValue.split('/');
              return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            } else if (dateValue.length === 8) {
              // Handle YYYYMMDD format
              return `${dateValue.substr(0,4)}-${dateValue.substr(4,2)}-${dateValue.substr(6,2)}`;
            }
          }
          return dateValue;
        })(),
        record.RECEIPT || null,
        record.INVOICE || null,
        record.IDCODE || null,
        record.SELLE || record.SELL || 0,       // OUTMAIN uses SELLE
        record.QTYE || record.QTY || 0,         // OUTMAIN uses QTYE
        record.BENZE || record.BENZ || null,    // OUTMAIN uses BENZE
        record.BRAND || null,
        record.ALTNO || null,
        record.COLORCODE || null,
        record.REMARKSE || record.REMARKS || null, // OUTMAIN uses REMARKSE
        record.COSTKSE || record.COST || 0      // OUTMAIN uses COSTKSE
      ]);
      
      await pool.execute(insertQuery, values);
      importedCount += batch.length;
      
      console.log(`📥 Imported batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(records.length/batchSize)} (${importedCount}/${records.length} records)`);
    }
    
    console.log(`✅ Successfully imported ${importedCount} sales records from OUTMAIN.DBF`);
    
    res.json({
      success: true,
      message: 'Sales data imported successfully',
      imported: importedCount,
      source: 'C:\\Rae\\Files\\OUTMAIN.DBF'
    });
    
  } catch (error) {
    console.error('❌ Rae OUTMAIN import error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import Rae OUTMAIN data',
      error: error.message
    });
  }
});

// Import history from C:\Rae\Files\OUTMAIN.DBF (INCLUDING DELETED RECORDS)
app.post('/api/history/import-rae-dbf-all', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Starting Rae OUTMAIN import (INCLUDING DELETED) from C:\\Rae\\Files\\OUTMAIN.DBF...');
    
    const fs = require('fs');
    const path = require('path');
    
    // Try both possible file extensions for OUTMAIN
    const dbfPath1 = 'C:\\Rae\\Files\\OUTMAIN.DBF';
    const dbfPath2 = 'C:\\Rae\\Files\\OUTMAIN.DB';
    
    let dbfPath;
    if (fs.existsSync(dbfPath1)) {
      dbfPath = dbfPath1;
    } else if (fs.existsSync(dbfPath2)) {
      dbfPath = dbfPath2;
    } else {
      return res.status(400).json({
        success: false,
        message: `OUTMAIN file not found. Checked:\n- ${dbfPath1}\n- ${dbfPath2}`
      });
    }
    
    console.log(`📁 Found OUTMAIN file at: ${dbfPath}`);
    
    // Read DBF file manually to include deleted records
    const buffer = fs.readFileSync(dbfPath);
    
    // Parse header manually
    const recordCount = buffer.readUInt32LE(4);
    const headerLength = buffer.readUInt16LE(8);
    const recordLength = buffer.readUInt16LE(10);
    
    console.log(`📊 Raw DBF Analysis:`);
    console.log(`   - Total records (including deleted): ${recordCount}`);
    console.log(`   - Header length: ${headerLength}`);
    console.log(`   - Record length: ${recordLength}`);
    
    // Parse field descriptors
    const fields = [];
    let offset = 32;
    
    while (offset < headerLength - 1) {
      const fieldName = buffer.toString('ascii', offset, offset + 11).replace(/\0/g, '');
      if (fieldName === '') break;
      
      const fieldType = buffer.toString('ascii', offset + 11, offset + 12);
      const fieldLength = buffer.readUInt8(offset + 16);
      
      fields.push({
        name: fieldName,
        type: fieldType,
        length: fieldLength
      });
      
      offset += 32;
    }
    
    console.log(`📋 Fields found:`, fields.map(f => `${f.name}(${f.type}${f.length})`).join(', '));
    
    // Parse all records (including deleted)
    const records = [];
    let deletedCount = 0;
    
    for (let i = 0; i < recordCount; i++) {
      const recordOffset = headerLength + (i * recordLength);
      const isDeleted = buffer.readUInt8(recordOffset) === 0x2A;
      
      if (isDeleted) deletedCount++;
      
      const record = { _DELETED: isDeleted };
      let fieldOffset = recordOffset + 1;
      
      for (const field of fields) {
        const value = buffer.toString('ascii', fieldOffset, fieldOffset + field.length).trim();
        
        switch (field.type) {
          case 'N':
            record[field.name] = value === '' ? null : parseFloat(value);
            break;
          case 'C':
            record[field.name] = value;
            break;
          case 'D':
            record[field.name] = value === '' ? null : value;
            break;
          default:
            record[field.name] = value;
        }
        
        fieldOffset += field.length;
      }
      
      records.push(record);
    }
    
    console.log(`📊 Complete DBF Analysis:`);
    console.log(`   - Total records: ${records.length}`);
    console.log(`   - Deleted records: ${deletedCount}`);
    console.log(`   - Active records: ${records.length - deletedCount}`);
    
    res.json({
      success: true,
      message: 'OUTMAIN analysis complete',
      totalRecords: records.length,
      deletedRecords: deletedCount,
      activeRecords: records.length - deletedCount,
      deletionRate: ((deletedCount / records.length) * 100).toFixed(1) + '%',
      source: dbfPath,
      sampleRecord: records[0] || null
    });
    
  } catch (error) {
    console.error('❌ Rae OUTMAIN analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze Rae OUTMAIN data',
      error: error.message
    });
  }
});

// Debug endpoint to check available files
app.get('/api/debug/check-rae-files', authenticateToken, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const raeDir = 'C:\\Rae\\Files';
    
    if (!fs.existsSync(raeDir)) {
      return res.json({
        success: false,
        message: `Directory not found: ${raeDir}`,
        directory: raeDir,
        exists: false
      });
    }
    
    const files = fs.readdirSync(raeDir);
    const historyFiles = files.filter(file => 
      (file.toUpperCase().startsWith('HISTORY') || file.toUpperCase().startsWith('OUTMAIN')) && 
      (file.toUpperCase().endsWith('.DBF') || file.toUpperCase().endsWith('.DB'))
    );
    
    res.json({
      success: true,
      directory: raeDir,
      exists: true,
      allFiles: files,
      historyFiles: historyFiles,
      totalFiles: files.length
    });
    
  } catch (error) {
    console.error('❌ Error checking Rae files:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking directory',
      error: error.message
    });
  }
});

// Debug endpoint to check history table data
app.get('/api/debug/history-data', authenticateToken, async (req, res) => {
  try {
    // Check total count
    const [countResult] = await pool.query('SELECT COUNT(*) as total FROM history');
    const totalRecords = countResult[0].total;
    
    // Get first 3 records to see actual data
    const [sampleRecords] = await pool.query('SELECT * FROM history LIMIT 3');
    
    // Check for non-null data
    const [nonNullCheck] = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CUSTOMER) as customer_count,
        COUNT(DATE) as date_count,
        COUNT(SELL) as sell_count,
        COUNT(QTY) as qty_count,
        COUNT(BENZ) as benz_count
      FROM history
    `);
    
    res.json({
      success: true,
      totalRecords: totalRecords,
      sampleRecords: sampleRecords,
      nonNullCounts: nonNullCheck[0],
      analysis: {
        hasData: sampleRecords.length > 0,
        hasRealData: sampleRecords.some(record => 
          record.CUSTOMER || record.DATE || record.SELL > 0 || record.QTY > 0
        )
      }
    });
    
  } catch (error) {
    console.error('❌ History debug error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check history data',
      error: error.message
    });
  }
});

// ========================================
// AUDIT API ENDPOINTS
// ========================================

// Get all audit sessions
app.get('/api/audit/sessions', authenticateToken, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [sessions] = await connection.execute(`
      SELECT 
        a.*,
        u.username,
        COUNT(ai.id) as item_count
      FROM audit_sessions a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN audit_items ai ON a.id = ai.session_id
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `);
    
    res.json({
      success: true,
      sessions: sessions
    });
  } catch (error) {
    console.error('❌ Error fetching audit sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit sessions',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});

// Create new audit session
app.post('/api/audit/sessions', authenticateToken, async (req, res) => {
  let connection;
  try {
    const { session_name, notes } = req.body;
    const user_id = req.user.id;
    
    connection = await pool.getConnection();
    const [result] = await connection.execute(`
      INSERT INTO audit_sessions (user_id, session_name, notes)
      VALUES (?, ?, ?)
    `, [user_id, session_name, notes]);
    
    res.json({
      success: true,
      message: 'Audit session created successfully',
      session_id: result.insertId
    });
  } catch (error) {
    console.error('❌ Error creating audit session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create audit session',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});

// Get audit session details
app.get('/api/audit/sessions/:id', authenticateToken, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();
    
    // Get session details
    const [sessions] = await connection.execute(`
      SELECT 
        a.*,
        u.username
      FROM audit_sessions a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.id = ?
    `, [id]);
    
    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Audit session not found'
      });
    }
    
    // Get audit items with stock details using same schema as scanning/search
    const [items] = await connection.execute(`
      SELECT 
        ai.id as audit_item_id,
        ai.session_id,
        ai.stock_id,
        ai.system_quantity,
        ai.physical_count,
        ai.variance,
        ai.scanned_at,
        ts.id,
        ts.BENZ,
        ts.BRAND,
        ts.ALTNO,
        COALESCE(
          (SELECT m2.\`DESC\` FROM master m2 
           WHERE m2.BENZ COLLATE utf8mb4_0900_ai_ci = ts.BENZ 
           AND m2.BRAND COLLATE utf8mb4_0900_ai_ci = ts.BRAND 
           LIMIT 1),
          ts.REMARKS, 
          'No description'
        ) as DESCRIPTION,
        ts.DATE,
        ts.QTY,
        ts.SELL,
        ts.COST,
        ts.LOCATION
      FROM audit_items ai
      LEFT JOIN tbl_stock ts ON ai.stock_id = ts.id
      WHERE ai.session_id = ?
      ORDER BY ai.scanned_at DESC
    `, [id]);
    
    res.json({
      success: true,
      session: sessions[0],
      items: items
    });
  } catch (error) {
    console.error('❌ Error fetching audit session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit session',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});

// Update audit session
app.put('/api/audit/sessions/:id', authenticateToken, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { session_name, status, notes } = req.body;
    
    connection = await pool.getConnection();
    
    let updateFields = [];
    let values = [];
    
    if (session_name) {
      updateFields.push('session_name = ?');
      values.push(session_name);
    }
    if (status) {
      updateFields.push('status = ?');
      values.push(status);
      if (status === 'completed') {
        updateFields.push('completed_at = NOW()');
      }
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      values.push(notes);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }
    
    values.push(id);
    
    await connection.execute(`
      UPDATE audit_sessions 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, values);
    
    res.json({
      success: true,
      message: 'Audit session updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating audit session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update audit session',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});

// Scan item for audit
app.post('/api/audit/scan', authenticateToken, async (req, res) => {
  let connection;
  try {
    const { session_id, stock_id, physical_count } = req.body;
    
    connection = await pool.getConnection();
    
    // Get stock item details - same as Stock page
    const [stockItems] = await connection.execute(`
      SELECT 
        ts.id,
        ts.BENZ,
        ts.BRAND,
        ts.ALTNO,
        COALESCE(
          (SELECT m2.\`DESC\` FROM master m2 
           WHERE m2.BENZ COLLATE utf8mb4_0900_ai_ci = ts.BENZ 
           AND m2.BRAND COLLATE utf8mb4_0900_ai_ci = ts.BRAND 
           LIMIT 1),
          ts.REMARKS, 
          'No description'
        ) as DESCRIPTION,
        ts.DATE,
        ts.QTY,
        ts.SELL,
        ts.COST,
        ts.LOCATION
      FROM tbl_stock ts
      WHERE ts.id = ?
    `, [stock_id]);
    
    if (stockItems.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Stock item not found'
      });
    }
    
    const stockItem = stockItems[0];
    const system_quantity = stockItem.QTY || 0;
    const variance = physical_count - system_quantity;
    
    // Insert or update audit item
    await connection.execute(`
      INSERT INTO audit_items (session_id, stock_id, system_quantity, physical_count, variance)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      physical_count = VALUES(physical_count),
      variance = VALUES(variance),
      scanned_at = NOW()
    `, [session_id, stock_id, system_quantity, physical_count, variance]);
    
    // Update session statistics
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_items,
        SUM(CASE WHEN variance = 0 THEN 1 ELSE 0 END) as matched_items,
        SUM(CASE WHEN variance != 0 THEN 1 ELSE 0 END) as discrepancy_items
      FROM audit_items 
      WHERE session_id = ?
    `, [session_id]);
    
    await connection.execute(`
      UPDATE audit_sessions 
      SET total_items = ?, matched_items = ?, discrepancy_items = ?
      WHERE id = ?
    `, [stats[0].total_items, stats[0].matched_items, stats[0].discrepancy_items, session_id]);
    
    res.json({
      success: true,
      message: 'Item scanned successfully',
      item: {
        stock_id,
        id: stockItem.id,
        BENZ: stockItem.BENZ,
        BRAND: stockItem.BRAND,
        ALTNO: stockItem.ALTNO,
        DESCRIPTION: stockItem.DESCRIPTION,
        DATE: stockItem.DATE,
        QTY: stockItem.QTY,
        SELL: stockItem.SELL,
        COST: stockItem.COST,
        LOCATION: stockItem.LOCATION,
        system_quantity,
        physical_count,
        variance
      }
    });
  } catch (error) {
    console.error('❌ Error scanning item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to scan item',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});

// Search stock items by barcode/ID
app.get('/api/audit/search-stock', authenticateToken, async (req, res) => {
  let connection;
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    connection = await pool.getConnection();
    
    // Search by ID - exact match only, same as Stock page
    const [items] = await connection.execute(`
      SELECT 
        ts.id,
        ts.BENZ,
        ts.BRAND,
        ts.ALTNO,
        COALESCE(
          (SELECT m2.\`DESC\` FROM master m2 
           WHERE m2.BENZ COLLATE utf8mb4_0900_ai_ci = ts.BENZ 
           AND m2.BRAND COLLATE utf8mb4_0900_ai_ci = ts.BRAND 
           LIMIT 1),
          ts.REMARKS, 
          'No description'
        ) as DESCRIPTION,
        ts.DATE,
        ts.QTY,
        ts.SELL,
        ts.COST,
        ts.LOCATION
      FROM tbl_stock ts
      WHERE ts.id = ?
      LIMIT 1
    `, [q]);
    
    res.json({
      success: true,
      items: items
    });
  } catch (error) {
    console.error('❌ Error searching stock items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search stock items',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});

// Generate variance report
app.get('/api/audit/sessions/:id/report', authenticateToken, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { type = 'summary' } = req.query;
    
    connection = await pool.getConnection();
    
    // Get session details
    const [sessions] = await connection.execute(`
      SELECT * FROM audit_sessions WHERE id = ?
    `, [id]);
    
    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Audit session not found'
      });
    }
    
    const session = sessions[0];
    
    // Get detailed items for report
    const [items] = await connection.execute(`
      SELECT 
        ai.*,
        ts.BENZ,
        ts.BRAND,
        ts.ALTNO,
        ts.QTY as system_quantity,
        ts.SELL,
        ts.COST,
        ts.LOCATION,
        ts.DATE,
        COALESCE(
          (SELECT m2.\`DESC\` FROM master m2 
           WHERE m2.BENZ COLLATE utf8mb4_0900_ai_ci = ts.BENZ 
           AND m2.BRAND COLLATE utf8mb4_0900_ai_ci = ts.BRAND 
           LIMIT 1),
          ts.REMARKS, 
          'No description'
        ) as DESCRIPTION
      FROM audit_items ai
      LEFT JOIN tbl_stock ts ON ai.stock_id = ts.id
      WHERE ai.session_id = ?
      ORDER BY ai.variance DESC, ai.scanned_at DESC
    `, [id]);
    
    // Calculate summary statistics
    const summary = {
      total_items: items.length,
      matched_items: items.filter(item => item.variance === 0).length,
      discrepancy_items: items.filter(item => item.variance !== 0).length,
      total_variance: items.reduce((sum, item) => sum + item.variance, 0),
      positive_variance: items.filter(item => item.variance > 0).length,
      negative_variance: items.filter(item => item.variance < 0).length
    };
    
    const report = {
      session: session,
      summary: summary,
      items: type === 'detailed' ? items : items.filter(item => item.variance !== 0),
      generated_at: new Date().toISOString()
    };
    
    // Save report to database
    await connection.execute(`
      INSERT INTO audit_variance_reports (session_id, report_type, report_data)
      VALUES (?, ?, ?)
    `, [id, type, JSON.stringify(report)]);
    
    res.json({
      success: true,
      report: report
    });
  } catch (error) {
    console.error('❌ Error generating variance report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate variance report',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});

// Delete audit session
app.delete('/api/audit/sessions/:id', authenticateToken, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    
    connection = await pool.getConnection();
    
    // Check if session exists and user has permission
    const [sessions] = await connection.execute(`
      SELECT * FROM audit_sessions WHERE id = ? AND user_id = ?
    `, [id, req.user.id]);
    
    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Audit session not found or access denied'
      });
    }
    
    // Delete session (cascade will delete items and reports)
    await connection.execute(`
      DELETE FROM audit_sessions WHERE id = ?
    `, [id]);
    
    res.json({
      success: true,
      message: 'Audit session deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting audit session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete audit session',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});

// ========================================
// BACKUP API ENDPOINTS
// ========================================

// Create system backup
app.post('/api/backup/create', async (req, res) => {
  let connection;
  try {
    const { exec } = require('child_process');
    const path = require('path');
    const fs = require('fs').promises;
    
    console.log('🔄 Creating system backup...');
    
    // Check if create-backup.bat exists
    const backupScript = path.join(__dirname, 'create-backup.bat');
    try {
      await fs.access(backupScript);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Backup script not found. Please ensure create-backup.bat exists.',
        error: error.message
      });
    }

    // Execute backup script with environment variables
    const env = {
      ...process.env,
      DB_PASSWORD: process.env.DB_PASSWORD || 'password'
    };
    
    exec(`"${backupScript}"`, { cwd: __dirname, env: env }, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Backup script error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to execute backup script',
          error: error.message,
          stderr: stderr
        });
      }

      if (stderr) {
        console.warn('⚠️ Backup script warnings:', stderr);
      }

      console.log('✅ Backup completed successfully');
      console.log('Backup output:', stdout);

      // Try to get backup information
      const getBackupInfo = async () => {
        try {
          const backupDir = path.join(__dirname, 'SYSTEM_BACKUPS');
          const files = await fs.readdir(backupDir);
          const latestBackup = files
            .filter(file => file.startsWith('backup_'))
            .sort()
            .pop();

          if (latestBackup) {
            const backupPath = path.join(backupDir, latestBackup);
            const stats = await fs.stat(backupPath);
            
            // Calculate total size of all files in the backup directory
            let totalSize = 0;
            try {
              const files = await fs.readdir(backupPath, { withFileTypes: true });
              for (const file of files) {
                const filePath = path.join(backupPath, file.name);
                if (file.isFile()) {
                  const fileStats = await fs.stat(filePath);
                  totalSize += fileStats.size;
                } else if (file.isDirectory()) {
                  // Recursively calculate directory size
                  const dirSize = await calculateDirectorySize(filePath);
                  totalSize += dirSize;
                }
              }
            } catch (error) {
              console.warn('Could not calculate backup size:', error.message);
            }
            
            return {
              backupName: latestBackup,
              backupPath: backupPath,
              created: stats.birthtime,
              size: totalSize
            };
          }
          return null;
        } catch (error) {
          console.warn('Could not get backup info:', error.message);
          return null;
        }
      };

      getBackupInfo().then(backupInfo => {
        res.json({
          success: true,
          message: 'System backup created successfully!',
          output: stdout,
          warnings: stderr || null,
          backupInfo: backupInfo
        });
      }).catch(() => {
        res.json({
          success: true,
          message: 'System backup created successfully!',
          output: stdout,
          warnings: stderr || null
        });
      });
    });

  } catch (error) {
    console.error('❌ Error creating backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create backup',
      error: error.message
    });
  }
});

// List available backups
app.get('/api/backup/list', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const backupDir = path.join(__dirname, 'SYSTEM_BACKUPS');
    
    try {
      const files = await fs.readdir(backupDir);
      const backups = [];
      
      for (const file of files) {
        if (file.startsWith('backup_')) {
          const backupPath = path.join(backupDir, file);
          const stats = await fs.stat(backupPath);
          
          // Calculate total size of all files in the backup directory
          let totalSize = 0;
          try {
            const backupFiles = await fs.readdir(backupPath, { withFileTypes: true });
            for (const backupFile of backupFiles) {
              const filePath = path.join(backupPath, backupFile.name);
              if (backupFile.isFile()) {
                const fileStats = await fs.stat(filePath);
                totalSize += fileStats.size;
              } else if (backupFile.isDirectory()) {
                const dirSize = await calculateDirectorySize(filePath);
                totalSize += dirSize;
              }
            }
          } catch (error) {
            console.warn('Could not calculate backup size for', file, ':', error.message);
          }
          
          backups.push({
            name: file,
            path: backupPath,
            created: stats.birthtime,
            size: totalSize,
            sizeFormatted: formatBytes(totalSize)
          });
        }
      }
      
      // Sort by creation date (newest first)
      backups.sort((a, b) => new Date(b.created) - new Date(a.created));
      
      res.json({
        success: true,
        backups: backups,
        count: backups.length
      });
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.json({
          success: true,
          backups: [],
          count: 0,
          message: 'No backups found'
        });
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('❌ Error listing backups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list backups',
      error: error.message
    });
  }
});

// Helper function to calculate directory size recursively
async function calculateDirectorySize(dirPath) {
  let totalSize = 0;
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      if (file.isFile()) {
        const fileStats = await fs.stat(filePath);
        totalSize += fileStats.size;
      } else if (file.isDirectory()) {
        const dirSize = await calculateDirectorySize(filePath);
        totalSize += dirSize;
      }
    }
  } catch (error) {
    console.warn('Error calculating directory size:', error.message);
  }
  return totalSize;
}

// Restore backup
app.post('/api/backup/restore', async (req, res) => {
  try {
    const { backupName } = req.body;
    
    if (!backupName) {
      return res.status(400).json({
        success: false,
        message: 'Backup name is required'
      });
    }

    console.log(`🔄 Restoring backup: ${backupName}`);
    
    const backupDir = path.join(__dirname, 'SYSTEM_BACKUPS');
    const backupPath = path.join(backupDir, backupName);
    
    // Check if backup exists
    try {
      await fs.access(backupPath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found',
        error: error.message
      });
    }

    // Check if restore script exists
    const restoreScript = path.join(backupPath, 'restore_this_backup.bat');
    try {
      await fs.access(restoreScript);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Restore script not found in backup',
        error: error.message
      });
    }

    // Execute restore script
    const { exec } = require('child_process');
    exec(`"${restoreScript}"`, { cwd: __dirname }, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Restore script error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to execute restore script',
          error: error.message,
          stderr: stderr
        });
      }

      if (stderr) {
        console.warn('⚠️ Restore script warnings:', stderr);
      }

      console.log('✅ Restore completed successfully');
      console.log('Restore output:', stdout);

      res.json({
        success: true,
        message: 'Backup restored successfully!',
        output: stdout,
        warnings: stderr || null,
        backupName: backupName
      });
    });

  } catch (error) {
    console.error('❌ Error restoring backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore backup',
      error: error.message
    });
  }
});

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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
    server.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌐 Frontend: http://localhost:3000`);
      console.log(`🔧 Backend API: http://localhost:${PORT}`);
      console.log(`📊 Database: ${dbConfig.host}/${dbConfig.database}`);
      console.log(`🔌 WebSocket server ready`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
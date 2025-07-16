// Performance Monitoring Script for Inventory System
// This script helps monitor database and API performance

const mysql = require('mysql2/promise');
require('dotenv').config();

// Database connection for monitoring
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_system',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

const pool = mysql.createPool(dbConfig);

// Performance monitoring functions
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      queryTimes: [],
      cacheHits: 0,
      cacheMisses: 0,
      apiResponseTimes: [],
      databaseConnections: 0
    };
  }

  // Monitor query performance
  async monitorQuery(query, params = []) {
    const startTime = Date.now();
    try {
      const [rows] = await pool.execute(query, params);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      this.metrics.queryTimes.push({
        query: query.substring(0, 50) + '...',
        duration,
        timestamp: new Date(),
        rowCount: rows.length
      });
      
      console.log(`✅ Query executed in ${duration}ms (${rows.length} rows)`);
      return rows;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.error(`❌ Query failed after ${duration}ms:`, error.message);
      throw error;
    }
  }

  // Monitor API response time
  monitorApiResponse(req, res, next) {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      this.metrics.apiResponseTimes.push({
        path: req.path,
        method: req.method,
        duration,
        statusCode: res.statusCode,
        timestamp: new Date()
      });
      
      console.log(`🌐 API ${req.method} ${req.path} - ${duration}ms - ${res.statusCode}`);
    });
    
    next();
  }

  // Get database statistics
  async getDatabaseStats() {
    try {
      const stats = {};
      
      // Table sizes
      const [tableSizes] = await pool.execute(`
        SELECT 
          table_name,
          ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)',
          table_rows
        FROM information_schema.tables 
        WHERE table_schema = '${dbConfig.database}'
        ORDER BY (data_length + index_length) DESC
      `);
      
      stats.tableSizes = tableSizes;
      
      // Index usage
      const [indexUsage] = await pool.execute(`
        SELECT 
          table_name,
          index_name,
          cardinality
        FROM information_schema.statistics 
        WHERE table_schema = '${dbConfig.database}'
        ORDER BY cardinality DESC
      `);
      
      stats.indexUsage = indexUsage;
      
      // Slow queries (if slow query log is enabled)
      const [slowQueries] = await pool.execute(`
        SHOW VARIABLES LIKE 'slow_query_log'
      `);
      
      stats.slowQueryLogEnabled = slowQueries.length > 0 && slowQueries[0].Value === 'ON';
      
      return stats;
    } catch (error) {
      console.error('Error getting database stats:', error);
      return null;
    }
  }

  // Get performance summary
  getPerformanceSummary() {
    const queryTimes = this.metrics.queryTimes;
    const apiResponseTimes = this.metrics.apiResponseTimes;
    
    const summary = {
      totalQueries: queryTimes.length,
      averageQueryTime: queryTimes.length > 0 ? 
        queryTimes.reduce((sum, q) => sum + q.duration, 0) / queryTimes.length : 0,
      slowestQuery: queryTimes.length > 0 ? 
        queryTimes.reduce((max, q) => q.duration > max.duration ? q : max) : null,
      totalApiCalls: apiResponseTimes.length,
      averageApiResponseTime: apiResponseTimes.length > 0 ? 
        apiResponseTimes.reduce((sum, a) => sum + a.duration, 0) / apiResponseTimes.length : 0,
      cacheHitRate: this.metrics.cacheHits + this.metrics.cacheMisses > 0 ? 
        (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100 : 0
    };
    
    return summary;
  }

  // Generate performance report
  async generateReport() {
    console.log('\n📊 PERFORMANCE MONITORING REPORT');
    console.log('=====================================\n');
    
    // Performance summary
    const summary = this.getPerformanceSummary();
    console.log('📈 PERFORMANCE SUMMARY:');
    console.log(`   Total Queries: ${summary.totalQueries}`);
    console.log(`   Average Query Time: ${summary.averageQueryTime.toFixed(2)}ms`);
    console.log(`   Total API Calls: ${summary.totalApiCalls}`);
    console.log(`   Average API Response Time: ${summary.averageApiResponseTime.toFixed(2)}ms`);
    console.log(`   Cache Hit Rate: ${summary.cacheHitRate.toFixed(2)}%`);
    
    if (summary.slowestQuery) {
      console.log(`   Slowest Query: ${summary.slowestQuery.duration}ms`);
    }
    
    // Database statistics
    console.log('\n🗄️ DATABASE STATISTICS:');
    const dbStats = await this.getDatabaseStats();
    if (dbStats) {
      console.log('   Table Sizes:');
      dbStats.tableSizes.forEach(table => {
        console.log(`     ${table['table_name']}: ${table['Size (MB)']}MB (${table['table_rows']} rows)`);
      });
    }
    
    // Recent slow queries
    console.log('\n🐌 RECENT SLOW QUERIES (>100ms):');
    const slowQueries = this.metrics.queryTimes
      .filter(q => q.duration > 100)
      .slice(-5)
      .reverse();
    
    slowQueries.forEach(query => {
      console.log(`   ${query.duration}ms - ${query.query}`);
    });
    
    // Recent API calls
    console.log('\n🌐 RECENT API CALLS:');
    const recentApiCalls = this.metrics.apiResponseTimes
      .slice(-10)
      .reverse();
    
    recentApiCalls.forEach(call => {
      console.log(`   ${call.method} ${call.path} - ${call.duration}ms - ${call.statusCode}`);
    });
    
    console.log('\n=====================================\n');
  }

  // Reset metrics
  resetMetrics() {
    this.metrics = {
      queryTimes: [],
      cacheHits: 0,
      cacheMisses: 0,
      apiResponseTimes: [],
      databaseConnections: 0
    };
    console.log('🔄 Performance metrics reset');
  }
}

// Export the monitor
module.exports = PerformanceMonitor;

// If run directly, show example usage
if (require.main === module) {
  const monitor = new PerformanceMonitor();
  
  // Example usage
  async function example() {
    console.log('🚀 Performance Monitor Example');
    
    // Monitor some queries
    await monitor.monitorQuery('SELECT COUNT(*) as total FROM master');
    await monitor.monitorQuery('SELECT * FROM master LIMIT 10');
    await monitor.monitorQuery('SELECT DISTINCT BRAND FROM master WHERE BRAND IS NOT NULL');
    
    // Generate report
    await monitor.generateReport();
    
    process.exit(0);
  }
  
  example().catch(console.error);
} 
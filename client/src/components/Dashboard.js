import React, { useContext, useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { AuthContext } from '../AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Custom plugin to draw red 100k line
const redLine100kPlugin = {
  id: 'redLine100k',
  afterDraw: (chart) => {
    const ctx = chart.ctx;
    const yAxis = chart.scales.y;
    const xAxis = chart.scales.x;
    const value = 100000;
    
    // Calculate y position for 100k
    const yPosition = yAxis.getPixelForValue(value);
    
    // Draw the red line
    ctx.save();
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(xAxis.left, yPosition);
    ctx.lineTo(xAxis.right, yPosition);
    ctx.stroke();
    
    // Draw label
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.font = 'bold 10px Arial';
    ctx.fillText('₱100,000', xAxis.right - 70, yPosition - 5);
    ctx.restore();
  }
};

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  redLine100kPlugin
);

function Dashboard() {
  const { user } = useContext(AuthContext);
  const { theme } = useTheme();
  const username = user?.username || 'User';
  
  // State for data
  const [recentSales, setRecentSales] = useState([]);
  const [newItems, setNewItems] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [showSalesGraph, setShowSalesGraph] = useState(false);
  const [loading, setLoading] = useState({
    sales: true,
    items: true,
    graph: true
  });

  // Fetch recent sales (last 10)
  const fetchRecentSales = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/sales/history', {
        headers: { Authorization: `Bearer ${token}` },
        params: { page: 1, limit: 10 }
      });
      setRecentSales(response.data.data || []);
    } catch (error) {
      console.error('Error fetching recent sales:', error);
      setRecentSales([]);
    } finally {
      setLoading(prev => ({ ...prev, sales: false }));
    }
  }, []);

  // Fetch new items (most recent 10 by ID)
  const fetchNewItems = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/stock-items', {
        headers: { Authorization: `Bearer ${token}` },
        params: { page: 1, limit: 10, sort: 'recent' }
      });
      setNewItems(response.data.data || []);
    } catch (error) {
      console.error('Error fetching new items:', error);
      setNewItems([]);
    } finally {
      setLoading(prev => ({ ...prev, items: false }));
    }
  }, []);

  // Fetch daily sales for past 10 days
  const fetchDailySales = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/dashboard/daily-sales', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Get last 10 days from the response
      const last10Days = response.data.slice(-10);
      setDailySales(last10Days);
    } catch (error) {
      console.error('Error fetching daily sales:', error);
      setDailySales([]);
    } finally {
      setLoading(prev => ({ ...prev, graph: false }));
    }
  }, []);

  // Fetch all data on mount
  useEffect(() => {
    fetchRecentSales();
    fetchNewItems();
    fetchDailySales();
  }, [fetchRecentSales, fetchNewItems, fetchDailySales]);

  // Format currency
  const formatCurrency = useCallback((amount) => {
    if (!amount && amount !== 0) return '0.00';
    const num = parseFloat(amount);
    if (isNaN(num)) return '0.00';
    return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }, []);

  // Format date
  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, []);

  // Prepare chart data for last 10 days
  const chartData = useMemo(() => {
    const labels = dailySales.map(item => {
      const date = new Date(item.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    const data = dailySales.map(item => parseFloat(item.total_value) || 0);

    return {
      labels,
      datasets: [
        {
          label: 'Total Sales',
          data,
          borderColor: 'rgb(25, 118, 210)',
          backgroundColor: 'rgba(25, 118, 210, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: 'rgb(25, 118, 210)',
          pointBorderColor: theme === 'light' ? '#ffffff' : '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        }
      ]
    };
  }, [dailySales, theme]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleColor: theme === 'light' ? '#212529' : '#fff',
        bodyColor: theme === 'light' ? '#212529' : '#fff',
        borderColor: 'rgba(25, 118, 210, 0.5)',
        borderWidth: 1,
        callbacks: {
          label: function(context) {
            return `₱${formatCurrency(context.parsed.y)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)',
          drawBorder: false
        },
        ticks: {
          color: theme === 'light' ? '#495057' : '#aaa',
          font: {
            size: 11
          }
        }
      },
      y: {
        grid: {
          color: theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)',
          drawBorder: false
        },
        ticks: {
          color: theme === 'light' ? '#495057' : '#aaa',
          font: {
            size: 11
          },
          callback: function(value) {
            return '₱' + formatCurrency(value);
          }
        }
      }
    }
  }), [formatCurrency, theme]);

  return (
    <div className="dashboard">
      <div className="dashboard-content">
        {/* Welcome Section */}
        <div className="welcome-card">
          <div className="welcome-background"></div>
          <div className="welcome-content">
            <div className="welcome-icon">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div className="welcome-text">
              <h1>Hello, <span className="username-highlight">{username.toUpperCase()}</span></h1>
              <p>Welcome to your inventory management system</p>
            </div>
          </div>
        </div>

        {/* System Status Cards */}
        <div className="status-cards-grid">
          <div className="status-card">
            <div className="status-indicator online"></div>
            <div className="status-text">
              <h3>System Online</h3>
              <p>All services running</p>
            </div>
          </div>
          <div className="status-card">
            <div className="status-indicator online"></div>
            <div className="status-text">
              <h3>Database Connected</h3>
              <p>MySQL connection active</p>
            </div>
          </div>
          <div className="status-card">
            <div className="status-indicator online"></div>
            <div className="status-text">
              <h3>Sync Active</h3>
              <p>Data synchronized</p>
            </div>
          </div>
        </div>

        {/* Sales Graph Section */}
        <div className="dashboard-section">
          <div className="section-header">
            <div>
              <h2>Sales Overview</h2>
              <p>Total sales for the past 10 days</p>
            </div>
            {showSalesGraph ? (
              <button
                onClick={() => setShowSalesGraph(false)}
                className="toggle-graph-btn hide-btn"
              >
                Hide Sales Graph
              </button>
            ) : (
              <button
                onClick={() => setShowSalesGraph(true)}
                className="toggle-graph-btn show-btn"
              >
                Show Sales Graph
              </button>
            )}
          </div>
          {showSalesGraph && (
            <div className="chart-container">
              {loading.graph ? (
                <div className="loading-state">Loading chart data...</div>
              ) : dailySales.length > 0 ? (
                <Line data={chartData} options={chartOptions} />
              ) : (
                <div className="empty-state">No sales data available</div>
              )}
            </div>
          )}
        </div>

        {/* Two Column Layout for Recent Sales and New Items */}
        <div className="dashboard-grid">
          {/* Recent Sales Section */}
          <div className="dashboard-section">
            <div className="section-header">
              <h2>Recent Sales</h2>
              <p>Last 10 transactions</p>
            </div>
            <div className="items-list">
              {loading.sales ? (
                <div className="loading-state">Loading recent sales...</div>
              ) : recentSales.length > 0 ? (
                recentSales.map((sale, index) => (
                  <div key={`${sale.IDCODE}-${sale.DATE}-${index}`} className="simple-item-card">
                    <div className="simple-item-left">
                      <div className="simple-product-code">{sale.BENZ || sale.IDCODE || 'N/A'}</div>
                      <div className="simple-item-name">{sale.DESCRIPTION || sale.REMARKS || 'N/A'}</div>
                      <div className="simple-item-meta">
                        {sale.BRAND && <span className="simple-meta-item">Brand: {sale.BRAND}</span>}
                        {sale.CUSTOMER && <span className="simple-meta-item">Customer: {sale.CUSTOMER}</span>}
                        <span className="simple-meta-item">Date: {formatDate(sale.DATE)}</span>
                      </div>
                    </div>
                    <div className="simple-item-right">
                      <div className="simple-price">₱{formatCurrency(sale.total_amount || (sale.SELL * sale.QTY))}</div>
                      <div className="simple-qty">Qty: {sale.QTY || 0}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">No recent sales found</div>
              )}
            </div>
          </div>

          {/* New Items Section */}
          <div className="dashboard-section">
            <div className="section-header">
              <h2>New Items</h2>
              <p>Most recently added items</p>
            </div>
            <div className="items-list">
              {loading.items ? (
                <div className="loading-state">Loading new items...</div>
              ) : newItems.length > 0 ? (
                newItems.map((item, index) => (
                  <div key={`${item.ID || item.id}-${index}`} className="simple-item-card new-item-simple">
                    <div className="simple-item-left">
                      <div className="simple-product-code">{item.BENZ || item.IDCODE || 'N/A'}</div>
                      <div className="simple-item-name">{item.REMARKS || item.DESCRIPTION || 'N/A'}</div>
                      <div className="simple-item-meta">
                        {item.BRAND && <span className="simple-meta-item">Brand: {item.BRAND}</span>}
                        <span className="simple-meta-item">ID: {item.ID || item.id || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="simple-item-right">
                      <div className="simple-new-badge">NEW</div>
                      <div className="simple-price">₱{formatCurrency(item.SELL)}</div>
                      <div className="simple-qty">Stock: {item.QTY || 0}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">No new items found</div>
              )}
            </div>
          </div>
        </div>

      </div>

      <style jsx>{`
        .dashboard {
          padding: 1rem;
          background: transparent;
          min-height: 100vh;
          color: var(--text-primary);
        }

        .dashboard-content {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        /* Welcome Card */
        .welcome-card {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 1.25rem;
          box-shadow: 0 4px 16px var(--shadow-lg);
          position: relative;
          overflow: hidden;
        }

        :global([data-theme="light"]) .welcome-card {
          background: linear-gradient(135deg, rgba(25, 118, 210, 0.08) 0%, rgba(13, 71, 161, 0.05) 100%);
          border: 1px solid rgba(25, 118, 210, 0.2);
          box-shadow: 0 4px 16px rgba(25, 118, 210, 0.1);
        }

        :global([data-theme="dark"]) .welcome-card {
          background: linear-gradient(135deg, rgba(25, 118, 210, 0.15) 0%, rgba(13, 71, 161, 0.1) 100%);
          border: 1px solid rgba(25, 118, 210, 0.3);
          box-shadow: 0 4px 16px rgba(25, 118, 210, 0.15);
        }

        .welcome-background {
          position: absolute;
          top: -50%;
          right: -10%;
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(25, 118, 210, 0.2) 0%, transparent 70%);
          border-radius: 50%;
          animation: float 6s ease-in-out infinite;
        }

        .welcome-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.05) 50%,
            transparent 100%
          );
          animation: shine 4s ease-in-out infinite;
        }

        :global([data-theme="light"]) .welcome-card::before {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(0, 0, 0, 0.02) 50%,
            transparent 100%
          );
        }

        :global([data-theme="dark"]) .welcome-card::before {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.05) 50%,
            transparent 100%
          );
        }

        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-20px) scale(1.05); }
        }

        @keyframes shine {
          0% { left: -100%; }
          100% { left: 100%; }
        }

        .welcome-content {
          display: flex;
          align-items: center;
          gap: 1rem;
          position: relative;
          z-index: 1;
        }

        .welcome-icon {
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, #1976d2, #1565c0);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          box-shadow: 0 4px 12px rgba(25, 118, 210, 0.4);
          animation: pulse-glow 3s ease-in-out infinite;
        }

        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 8px 24px rgba(25, 118, 210, 0.4); }
          50% { box-shadow: 0 8px 32px rgba(25, 118, 210, 0.6); }
        }

        .welcome-text {
          flex: 1;
        }

        .welcome-text h1 {
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .username-highlight {
          background: linear-gradient(135deg, var(--text-primary), #1976d2);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          position: relative;
        }

        .welcome-text > p {
          margin: 0 0 0.5rem 0;
          font-size: 0.95rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }


        /* Status Cards Grid */
        .status-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0.75rem;
        }

        .status-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        :global([data-theme="light"]) .status-card {
          background: var(--bg-tertiary);
        }

        .status-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #28a745;
          box-shadow: 0 0 8px rgba(40, 167, 69, 0.5);
          flex-shrink: 0;
        }

        .status-indicator.online {
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .status-text {
          flex: 1;
        }

        .status-text h3 {
          margin: 0 0 0.25rem 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .status-text p {
          margin: 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        /* Dashboard Sections */
        .dashboard-section {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 1.25rem;
        }

        :global([data-theme="light"]) .dashboard-section {
          background: var(--bg-secondary);
          box-shadow: 0 2px 4px var(--shadow-sm);
        }

        .section-header {
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .section-header h2 {
          margin: 0 0 0.25rem 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .section-header p {
          margin: 0;
          font-size: 0.8rem;
          font-weight: 400;
          color: var(--text-muted);
        }

        /* Chart Container */
        .chart-container {
          height: 200px;
          position: relative;
        }

        /* Dashboard Grid - Two Columns */
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }

        @media (max-width: 1200px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Items List */
        .items-list {
          display: flex;
          flex-direction: column;
          gap: 0;
          max-height: 500px;
          overflow-y: auto;
          padding-right: 0.5rem;
        }

        .items-list::-webkit-scrollbar {
          width: 6px;
        }

        .items-list::-webkit-scrollbar-track {
          background: var(--bg-tertiary);
          border-radius: 3px;
        }

        .items-list::-webkit-scrollbar-thumb {
          background: var(--border-color);
          border-radius: 3px;
        }

        .items-list::-webkit-scrollbar-thumb:hover {
          background: var(--text-muted);
        }

        /* Simple Item Card - Clean and Readable */
        .simple-item-card {
          background: var(--bg-secondary);
          border-left: 3px solid var(--border-color);
          border-radius: 6px;
          padding: 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          transition: all 0.2s ease;
          margin-bottom: 0.5rem;
        }

        :global([data-theme="light"]) .simple-item-card {
          background: var(--bg-tertiary);
        }

        .simple-item-card:hover {
          background: var(--hover-bg);
          border-left-color: var(--text-muted);
        }

        .new-item-simple {
          border-left-color: var(--text-muted);
        }

        .new-item-simple:hover {
          border-left-color: #007bff;
        }

        .simple-item-left {
          flex: 1;
          min-width: 0;
        }

        .simple-product-code {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
          font-family: 'monospace', monospace;
          margin-bottom: 0.25rem;
          letter-spacing: 0.5px;
        }

        .simple-item-name {
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text-primary);
          margin-bottom: 0.5rem;
          line-height: 1.4;
        }

        .simple-item-meta {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .simple-meta-item {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 400;
        }

        .simple-item-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.5rem;
          flex-shrink: 0;
          position: relative;
        }

        .simple-price {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
        }

        .simple-qty {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .simple-new-badge {
          background: #ff0000;
          color: #ffffff;
          font-size: 0.7rem;
          font-weight: 900;
          padding: 8px 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
          position: relative;
          clip-path: polygon(
            50% 0%,
            61% 35%,
            98% 35%,
            68% 57%,
            79% 91%,
            50% 70%,
            21% 91%,
            32% 57%,
            2% 35%,
            39% 35%
          );
          transform: rotate(-8deg);
          border: 2px solid var(--bg-primary);
          box-shadow: 0 2px 6px var(--shadow-lg);
          display: inline-block;
          line-height: 1.2;
        }

        /* Loading and Empty States */
        .loading-state,
        .empty-state {
          text-align: center;
          padding: 1.5rem;
          color: var(--text-primary);
          font-size: 0.85rem;
          font-weight: 600;
        }

        /* Toggle Graph Button */
        .toggle-graph-btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .toggle-graph-btn.show-btn {
          background: #1976d2;
          color: #fff;
        }

        .toggle-graph-btn.show-btn:hover {
          background: #1565c0;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
        }

        .toggle-graph-btn.hide-btn {
          background: #d32f2f;
          color: #fff;
        }

        .toggle-graph-btn.hide-btn:hover {
          background: #c62828;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(211, 47, 47, 0.3);
        }
      `}</style>
    </div>
  );
}

export default Dashboard;

import React, { useState, useEffect } from 'react';
import { Settings, Lock, Shield, Zap, Database, AlertCircle } from 'lucide-react';
import './MaintenanceMode.css';

const MaintenanceMode = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isBypassed, setIsBypassed] = useState(false);

  // Check if already bypassed
  useEffect(() => {
    const bypassed = localStorage.getItem('maintenanceBypassed') === 'true';
    setIsBypassed(bypassed);
  }, []);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    
    if (password.toLowerCase().trim() === 'delodur') {
      localStorage.setItem('maintenanceBypassed', 'true');
      setIsBypassed(true);
      setError('');
      setPassword('');
      window.location.reload();
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  // If bypassed, don't show maintenance screen
  if (isBypassed) {
    return null;
  }

  return (
    <div className="maintenance-container">
      {/* Animated Grid Background */}
      <div className="maintenance-grid-bg"></div>
      
      {/* Floating Orbs */}
      <div className="maintenance-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      <div className="maintenance-content">
        {/* Main Card */}
        <div className="maintenance-card">
          {/* Header Section */}
          <div className="maintenance-header">
            <div className="maintenance-icon-wrapper">
              <div className="icon-glow"></div>
              <Settings size={48} className="maintenance-icon-svg" />
            </div>
            <h1 className="maintenance-title">
              <span className="title-main">System Maintenance</span>
              <span className="title-subtitle">In Progress</span>
            </h1>
          </div>

          {/* Status Badge */}
          <div className="maintenance-status-badge">
            <div className="status-dot"></div>
            <span>Optimizing System Performance</span>
          </div>

          {/* Description Section */}
          <div className="maintenance-description-section">
            <p className="description-main">
              We're currently performing critical system optimizations to resolve rate limiting issues 
              and enhance overall performance. Our technical team is implementing advanced request 
              handling protocols and system stability improvements.
            </p>
            <p className="description-sub">
              This maintenance ensures a smoother, faster experience for all users. 
              We appreciate your patience during this process.
            </p>
          </div>

          {/* Features Grid */}
          <div className="maintenance-features">
            <div className="feature-item">
              <div className="feature-icon">
                <Zap size={24} />
              </div>
              <div className="feature-content">
                <h3>Performance</h3>
                <p>Request optimization</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">
                <Shield size={24} />
              </div>
              <div className="feature-content">
                <h3>Security</h3>
                <p>Rate limiting fixes</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">
                <Database size={24} />
              </div>
              <div className="feature-content">
                <h3>Stability</h3>
                <p>System updates</p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="maintenance-divider">
            <div className="divider-line"></div>
            <Lock size={16} className="divider-icon" />
            <div className="divider-line"></div>
          </div>

          {/* Administrator Access */}
          <div className="maintenance-admin-section">
            <div className="admin-header">
              <Lock size={18} />
              <span>Administrator Access</span>
            </div>
            <form onSubmit={handlePasswordSubmit} className="admin-form">
              <div className="admin-input-group">
                <div className="input-icon-wrapper">
                  <Lock size={18} className="input-icon" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter administrator password"
                  className="admin-input"
                  autoFocus
                  autoComplete="off"
                />
              </div>
              <button type="submit" className="admin-button">
                <span>Access System</span>
                <div className="button-shine"></div>
              </button>
            </form>
            {error && (
              <div className="admin-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
            <div className="admin-footer-text">
              <small>Restricted access • Authorized personnel only</small>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="maintenance-footer">
          <div className="footer-brand">
            <span className="brand-name">DELODUR CORPORATION</span>
            <span className="brand-version">TRACK v2</span>
          </div>
          <div className="footer-time">
            {new Date().toLocaleString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceMode;

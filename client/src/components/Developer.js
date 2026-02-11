import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { FileText, Database, Settings, AlertTriangle, CheckCircle, Shield, Clock, HardDrive, RotateCcw, BookOpen, Wrench, Power, Trash2 } from 'lucide-react';
import SystemDocumentation from './SystemDocumentation';
import { AuthContext } from '../AuthContext';

const Developer = () => {
  const { logout } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [dbfConversionLoading, setDbfConversionLoading] = useState(false);
  const [inmainDbfLoading, setInmainDbfLoading] = useState(false);
  const [historyDbfLoading, setHistoryDbfLoading] = useState(false);
  const [raeHistoryLoading, setRaeHistoryLoading] = useState(false);
  const [locationDbfLoading, setLocationDbfLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [clearSalesHistoryLoading, setClearSalesHistoryLoading] = useState(false);
  const [backups, setBackups] = useState([]);
  const [backupInfo, setBackupInfo] = useState(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showDocumentation, setShowDocumentation] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(() => {
    return localStorage.getItem('maintenanceMode') === 'true';
  });

  // Load backups on component mount
  useEffect(() => {
    loadBackups();
  }, []);

  // Handle Maintenance Mode Toggle
  const handleMaintenanceModeToggle = async (enabled) => {
    try {
      const token = localStorage.getItem('token');
      
      // Call server API to toggle maintenance mode globally
      const response = await axios.post('/api/maintenance/toggle', 
        { enabled },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setMaintenanceMode(enabled);
        
        if (enabled) {
          // Show warning message
          setSuccessMessage('⚠️ Maintenance mode enabled globally. All authenticated users across all devices will be logged out. They will need to use password "delodur" to bypass.');
          
          // Reload page after 2 seconds to apply changes
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          // Show success message
          setSuccessMessage('Maintenance mode disabled globally. System is now accessible to all users.');
          setTimeout(() => {
            setSuccessMessage('');
          }, 5000);
          
          // Reload page after 2 seconds
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } else {
        setError(response.data.message || 'Failed to toggle maintenance mode');
      }
    } catch (error) {
      console.error('Error toggling maintenance mode:', error);
      setError(error.response?.data?.message || 'Failed to toggle maintenance mode. Please try again.');
    }
  };
  
  // Check maintenance mode status on mount
  useEffect(() => {
    const checkMaintenanceStatus = async () => {
      try {
        const response = await axios.get('/api/maintenance/status');
        if (response.data.success) {
          setMaintenanceMode(response.data.enabled);
        }
      } catch (error) {
        console.error('Error checking maintenance status:', error);
      }
    };
    
    checkMaintenanceStatus();
  }, []);

  // Load available backups
  const loadBackups = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/backup/list', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setBackups(response.data.backups || []);
      }
    } catch (error) {
      console.error('Error loading backups:', error);
    }
  };

  // Handle Create Backup
  const handleCreateBackup = async () => {
    setBackupLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/backup/create', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setSuccessMessage(`Backup created successfully! ${response.data.backupInfo ? `Backup: ${response.data.backupInfo.backupName}` : ''}`);
        setBackupInfo(response.data.backupInfo);
        
        // Reload backups list
        await loadBackups();
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccessMessage('');
        }, 5000);
      } else {
        setError(response.data.message || 'Failed to create backup');
      }
    } catch (error) {
      console.error('Error creating backup:', error);
      setError(error.response?.data?.message || 'Failed to create backup');
    } finally {
      setBackupLoading(false);
    }
  };

  // Handle Restore Backup
  const handleRestoreBackup = async (backupName) => {
    setRestoreLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/backup/restore', 
        { backupName: backupName }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setSuccessMessage(`Backup restored successfully! Restored: ${backupName}`);
        setShowRestoreModal(false);
        setSelectedBackup(null);
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccessMessage('');
        }, 5000);
      } else {
        setError(response.data.message || 'Failed to restore backup');
      }
    } catch (error) {
      console.error('Error restoring backup:', error);
      setError(error.response?.data?.message || 'Failed to restore backup');
    } finally {
      setRestoreLoading(false);
    }
  };

  // Handle Restore Button Click
  const handleRestoreClick = (backup) => {
    setSelectedBackup(backup);
    setShowRestoreModal(true);
  };

  // Handle Description Adjustment from MASTER.DBF
  const handleDescriptionAdjustment = async () => {
    setDbfConversionLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/master/convert-and-import-dbf', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setSuccessMessage('Description data adjusted successfully from MASTER.DBF!');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setError(response.data.message || 'Failed to adjust description data from MASTER.DBF');
      }
    } catch (error) {
      console.error('Error adjusting description from MASTER.DBF:', error);
      setError(error.response?.data?.message || 'Failed to adjust description data from MASTER.DBF');
    } finally {
      setDbfConversionLoading(false);
    }
  };

  // Handle Location Adjustment from STKADES.DBF
  const handleLocationAdjustment = async () => {
    setLocationDbfLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/location/convert-and-import-dbf', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setSuccessMessage('Location data adjusted successfully from STKADES.DBF!');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setError(response.data.message || 'Failed to adjust location data from STKADES.DBF');
      }
    } catch (error) {
      console.error('Error adjusting location from STKADES.DBF:', error);
      setError(error.response?.data?.message || 'Failed to adjust location data from STKADES.DBF');
    } finally {
      setLocationDbfLoading(false);
    }
  };

  // Handle History Import from HISTORY.DBF
  const handleHistoryImport = async () => {
    setHistoryDbfLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/history/import-dbf', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setSuccessMessage(`History data imported successfully! ${response.data.imported} records imported from HISTORY.DBF`);
        setTimeout(() => {
          setSuccessMessage('');
        }, 5000);
      } else {
        setError(response.data.message || 'Failed to import history data from HISTORY.DBF');
      }
    } catch (error) {
      console.error('Error importing history from HISTORY.DBF:', error);
      setError(error.response?.data?.message || 'Failed to import history data from HISTORY.DBF');
    } finally {
      setHistoryDbfLoading(false);
    }
  };

  // Handle Rae History Import from C:\Rae\Files\HISTORY.DBF
  const handleRaeHistoryImport = async () => {
    setRaeHistoryLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/history/import-rae-dbf', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setSuccessMessage(`Sales data imported successfully! ${response.data.imported} records imported from C:\\Rae\\Files\\OUTMAIN.DBF`);
        setTimeout(() => {
          setSuccessMessage('');
        }, 5000);
      } else {
        setError(response.data.message || 'Failed to import sales data from C:\\Rae\\Files\\OUTMAIN.DBF');
      }
    } catch (error) {
      console.error('Error importing sales from OUTMAIN.DBF:', error);
      setError(error.response?.data?.message || 'Failed to import sales data from C\\Rae\\Files\\OUTMAIN.DBF');
    } finally {
      setRaeHistoryLoading(false);
    }
  };

  // Handle Clear Today's Sales History (Password Protected)
  const handleClearTodaySalesHistory = async () => {
    // Prompt for password
    const password = window.prompt('Enter password to clear today\'s sales history:');
    
    if (!password) {
      return; // User cancelled
    }
    
    if (password !== 'delo') {
      alert('Incorrect password. Access denied.');
      return;
    }
    
    // Confirm action
    const confirmed = window.confirm(
      '⚠️ WARNING: This will permanently delete ALL sales history records for TODAY.\n\n' +
      'This action cannot be undone!\n\n' +
      'Are you absolutely sure you want to proceed?'
    );
    
    if (!confirmed) {
      return;
    }
    
    setClearSalesHistoryLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete('/api/sales/history/clear-today', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setSuccessMessage(`Successfully cleared ${response.data.deletedCount || 0} sales history records for today.`);
        setTimeout(() => {
          setSuccessMessage('');
        }, 5000);
      } else {
        setError(response.data.message || 'Failed to clear today\'s sales history');
      }
    } catch (error) {
      console.error('Error clearing today\'s sales history:', error);
      setError('Error clearing today\'s sales history: ' + (error.response?.data?.message || error.message));
    } finally {
      setClearSalesHistoryLoading(false);
    }
  };

  // Handle Convert & Import DBF
  const handleConvertAndImportDbf = async () => {
    setDbfConversionLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/stock/convert-and-import-dbf', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setSuccessMessage('DBF data converted and imported successfully!');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        alert('Failed to convert and import DBF data.');
      }
    } catch (error) {
      console.error('Error converting and importing DBF:', error);
      alert('Error converting and importing DBF: ' + (error.response?.data?.message || error.message));
    } finally {
      setDbfConversionLoading(false);
    }
  };

  // Handle INMAIN.DBF refresh
  const handleInmainDbfRefresh = async () => {
    setInmainDbfLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/inmain/refresh-from-dbf', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setSuccessMessage('INMAIN.DBF data refreshed successfully!');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setError(response.data.message || 'Failed to refresh INMAIN.DBF data');
      }
    } catch (error) {
      console.error('Error refreshing INMAIN.DBF:', error);
      setError(error.response?.data?.message || 'Failed to refresh INMAIN.DBF data');
    } finally {
      setInmainDbfLoading(false);
    }
  };

  // Helper function to format bytes
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="developer-page">
      <div className="developer-header">
        <h1>Developer Tools</h1>
        <p>Database management and system utilities</p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="alert alert-success">
          <CheckCircle className="me-2" />
          {successMessage}
        </div>
      )}
      
      {error && (
        <div className="alert alert-danger">
          <AlertTriangle className="me-2" />
          {error}
        </div>
      )}

      {/* System Documentation Section */}
      <div className="developer-section">
        <h2>System Documentation</h2>
        <div style={{ marginBottom: '20px' }}>
          <button
            className="dbf-button"
            onClick={() => setShowDocumentation(true)}
            style={{
              background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
              color: 'white',
              padding: '15px 30px',
              fontSize: '16px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0, 123, 255, 0.3)',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 12px rgba(0, 123, 255, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 6px rgba(0, 123, 255, 0.3)';
            }}
          >
            <BookOpen className="button-icon" />
            View System Documentation
          </button>
          <p style={{ marginTop: '10px', color: '#666', fontSize: '14px' }}>
            Complete system documentation including features, workflows, TRACK v1 vs v2 comparison, and user guides. Print-ready format.
          </p>
        </div>
      </div>

      {/* DBF Management Section */}
      <div className="developer-section">
        <h2>DBF File Management</h2>
        <div className="dbf-buttons-grid">
          {/* STOCK ADJUSTMENT Button */}
          <button
            className="dbf-button stock-adjustment"
            onClick={handleConvertAndImportDbf}
            disabled={dbfConversionLoading}
            title="Full stock adjustment from STOCKS.DBF"
          >
            <FileText className="button-icon" />
            {dbfConversionLoading ? 'Adjusting...' : 'STOCK ADJUSTMENT'}
          </button>

          {/* Description Adjustment Button */}
          <button
            className="dbf-button description-adjustment"
            onClick={handleDescriptionAdjustment}
            disabled={dbfConversionLoading}
            title="Full description adjustment from MASTER.DBF"
          >
            <FileText className="button-icon" />
            {dbfConversionLoading ? 'Adjusting...' : 'Description Adjustment'}
          </button>

          {/* Location Adjustment Button */}
          <button
            className="dbf-button location-adjustment"
            onClick={handleLocationAdjustment}
            disabled={locationDbfLoading}
            title="Full location adjustment from STKADES.DBF"
          >
            <FileText className="button-icon" />
            {locationDbfLoading ? 'Adjusting...' : 'Location Adjustment'}
          </button>

          {/* Incoming Adjustment Button */}
          <button
            className="dbf-button inmain-dbf"
            onClick={handleInmainDbfRefresh}
            disabled={inmainDbfLoading}
            title="Refresh inmain data from INMAIN.DBF"
          >
            <FileText className="button-icon" />
            {inmainDbfLoading ? 'Adjusting...' : 'Incoming Adjustment'}
          </button>

          {/* History Import Button */}
          <button
            className="dbf-button history-import"
            onClick={handleHistoryImport}
            disabled={historyDbfLoading}
            title="Import sales history from HISTORY.DBF"
          >
            <Database className="button-icon" />
            {historyDbfLoading ? 'Importing...' : 'History Import'}
          </button>

          {/* Rae History Import Button */}
          <button
            className="dbf-button rae-history-import"
            onClick={handleRaeHistoryImport}
            disabled={raeHistoryLoading}
            title="Import sales data from C:\Rae\Files\OUTMAIN.DBF"
          >
            <Database className="button-icon" />
            {raeHistoryLoading ? 'Importing...' : 'Sales Import'}
          </button>

          {/* Create Backup Button */}
          <button
            className="dbf-button backup-create"
            onClick={handleCreateBackup}
            disabled={backupLoading}
            title="Create a complete system backup"
          >
            <Shield className="button-icon" />
            {backupLoading ? 'Creating...' : 'Create Backup'}
          </button>

          {/* Clear Today's Sales History Button (Password Protected) */}
          <button
            className="dbf-button"
            onClick={handleClearTodaySalesHistory}
            disabled={clearSalesHistoryLoading}
            title="Clear all sales history records for today (Password: delo)"
            style={{
              background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
              color: 'white'
            }}
          >
            <Trash2 className="button-icon" />
            {clearSalesHistoryLoading ? 'Clearing...' : 'Clear Today\'s Sales'}
          </button>

        </div>
      </div>

      {/* Backup Management Section */}
      <div className="developer-section">
        <h2>Backup Management</h2>
        
        {/* Backup Status */}
        {backupInfo && (
          <div className="backup-status">
            <div className="backup-info-card">
              <HardDrive className="backup-icon" />
              <div className="backup-details">
                <h4>Latest Backup</h4>
                <p><strong>Name:</strong> {backupInfo.backupName}</p>
                <p><strong>Created:</strong> {new Date(backupInfo.created).toLocaleString()}</p>
                <p><strong>Size:</strong> {formatBytes(backupInfo.size)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Backup History */}
        <div className="backup-history">
          <h3>Backup History</h3>
          {backups.length > 0 ? (
            <div className="backup-list">
              {backups.slice(0, 5).map((backup, index) => (
                <div key={backup.name} className={`backup-item ${index === 0 ? 'latest' : ''}`}>
                  <div className="backup-item-info">
                    <HardDrive className="backup-item-icon" />
                    <div>
                      <strong>{backup.name}</strong>
                      <p>{new Date(backup.created).toLocaleString()} • {backup.sizeFormatted}</p>
                    </div>
                  </div>
                  <div className="backup-item-actions">
                    {index === 0 && <span className="latest-badge">Latest</span>}
                    <button
                      className="restore-button"
                      onClick={() => handleRestoreClick(backup)}
                      disabled={restoreLoading}
                      title={`Restore backup from ${new Date(backup.created).toLocaleString()}`}
                    >
                      <RotateCcw className="restore-icon" />
                      Restore
                    </button>
                  </div>
                </div>
              ))}
              {backups.length > 5 && (
                <p className="more-backups">... and {backups.length - 5} more backups</p>
              )}
            </div>
          ) : (
            <p className="no-backups">No backups found. Create your first backup above!</p>
          )}
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {showRestoreModal && selectedBackup && (
        <div className="modal-overlay">
          <div className="restore-modal">
            <div className="modal-header">
              <h3>⚠️ Confirm Restore</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowRestoreModal(false)}
                disabled={restoreLoading}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="restore-warning">
                <AlertTriangle className="warning-icon" />
                <p><strong>WARNING:</strong> This will overwrite your current system files!</p>
              </div>
              <div className="restore-details">
                <h4>Restore Details:</h4>
                <p><strong>Backup:</strong> {selectedBackup.name}</p>
                <p><strong>Created:</strong> {new Date(selectedBackup.created).toLocaleString()}</p>
                <p><strong>Size:</strong> {selectedBackup.sizeFormatted}</p>
              </div>
              <div className="restore-note">
                <p>This action will restore all system files, database, and configuration from the selected backup point.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="cancel-button" 
                onClick={() => setShowRestoreModal(false)}
                disabled={restoreLoading}
              >
                Cancel
              </button>
              <button 
                className="confirm-restore-button" 
                onClick={() => handleRestoreBackup(selectedBackup.name)}
                disabled={restoreLoading}
              >
                {restoreLoading ? 'Restoring...' : 'Confirm Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* System Controls Section */}
      <div className="developer-section">
        <h2>System Controls</h2>
        
        {/* Maintenance Mode Toggle */}
        <div className="control-item">
          <div className="control-header">
            <div className="control-info">
              <Wrench className="control-icon" />
              <div>
                <h3>Maintenance Mode</h3>
                <p>Enable to show maintenance page to all users. Disable to allow normal access.</p>
              </div>
            </div>
            <div className="toggle-switch-container">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={maintenanceMode}
                  onChange={(e) => handleMaintenanceModeToggle(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span className="toggle-status">
                {maintenanceMode ? (
                  <span className="status-on">
                    <Power className="status-icon" size={16} />
                    ON
                  </span>
                ) : (
                  <span className="status-off">OFF</span>
                )}
              </span>
            </div>
          </div>
          {maintenanceMode && (
            <div className="control-warning">
              <AlertTriangle className="warning-icon-small" />
              <span>Maintenance mode is active. Users will see the maintenance page. Use password "delodur" to bypass.</span>
            </div>
          )}
        </div>
      </div>

      {/* System Information Section */}
      <div className="developer-section">
        <h2>System Information</h2>
        <div className="system-info">
          <div className="info-item">
            <Database className="info-icon" />
            <span>Database: MySQL</span>
          </div>
          <div className="info-item">
            <Settings className="info-icon" />
            <span>Environment: Development</span>
          </div>
        </div>
      </div>



      <style jsx>{`
        .developer-page {
          padding: 2rem;
          background: var(--bg-primary);
          min-height: 100vh;
          color: var(--text-primary);
        }

        .developer-header {
          margin-bottom: 2rem;
          text-align: center;
        }

        .developer-header h1 {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          color: var(--text-primary);
        }

        .developer-header p {
          font-size: 1.1rem;
          color: var(--text-secondary);
          margin: 0;
        }

        .developer-section {
          background: var(--card-bg);
          border-radius: 12px;
          padding: 2rem;
          margin-bottom: 2rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .developer-section h2 {
          color: var(--text-primary);
          margin-bottom: 1.5rem;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .dbf-buttons-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
        }

        .dbf-button {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.5rem;
          background: linear-gradient(135deg, #6c5ce7, #5f3dc4);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(108, 92, 231, 0.3);
        }

        .dbf-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(108, 92, 231, 0.4);
        }

        .dbf-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }


        .dbf-button.stock-adjustment {
          background: linear-gradient(135deg, #6c5ce7, #5f3dc4);
          box-shadow: 0 4px 12px rgba(108, 92, 231, 0.3);
        }

        .dbf-button.description-adjustment {
          background: linear-gradient(135deg, #fd79a8, #e84393);
          box-shadow: 0 4px 12px rgba(253, 121, 168, 0.3);
        }

        .dbf-button.location-adjustment {
          background: linear-gradient(135deg, #a29bfe, #6c5ce7);
          box-shadow: 0 4px 12px rgba(162, 155, 254, 0.3);
        }

        .dbf-button.inmain-dbf {
          background: linear-gradient(135deg, #00b894, #00a085);
          box-shadow: 0 4px 12px rgba(0, 184, 148, 0.3);
        }

        .dbf-button.history-import {
          background: linear-gradient(135deg, #ff7675, #d63031);
          box-shadow: 0 4px 12px rgba(255, 118, 117, 0.3);
        }

        .dbf-button.rae-history-import {
          background: linear-gradient(135deg, #fdcb6e, #e17055);
          box-shadow: 0 4px 12px rgba(253, 203, 110, 0.3);
        }

        .dbf-button.backup-create {
          background: linear-gradient(135deg, #00b894, #00a085);
          box-shadow: 0 4px 12px rgba(0, 184, 148, 0.3);
        }




        .button-icon {
          width: 24px;
          height: 24px;
          flex-shrink: 0;
        }

        .system-info {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .info-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: var(--bg-secondary);
          border-radius: 8px;
          color: var(--text-primary);
        }

        .info-icon {
          width: 20px;
          height: 20px;
          color: #6c5ce7;
        }

        /* System Controls Styles */
        .control-item {
          background: var(--bg-secondary);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1rem;
        }

        .control-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 2rem;
        }

        .control-info {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          flex: 1;
        }

        .control-icon {
          width: 32px;
          height: 32px;
          color: #fdcb6e;
          flex-shrink: 0;
          margin-top: 0.25rem;
        }

        .control-info h3 {
          margin: 0 0 0.5rem 0;
          color: var(--text-primary);
          font-size: 1.1rem;
          font-weight: 600;
        }

        .control-info p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .toggle-switch-container {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 60px;
          height: 34px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #4a4a4a;
          transition: 0.3s;
          border-radius: 34px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 26px;
          width: 26px;
          left: 4px;
          bottom: 4px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }

        .toggle-switch input:checked + .toggle-slider {
          background: linear-gradient(135deg, #00b894, #00a085);
        }

        .toggle-switch input:checked + .toggle-slider:before {
          transform: translateX(26px);
        }

        .toggle-switch input:focus + .toggle-slider {
          box-shadow: 0 0 1px #00b894;
        }

        .toggle-status {
          font-weight: 600;
          font-size: 0.9rem;
          min-width: 50px;
          text-align: center;
        }

        .status-on {
          color: #00b894;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .status-off {
          color: var(--text-secondary);
        }

        .status-icon {
          width: 16px;
          height: 16px;
        }

        .control-warning {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-top: 1rem;
          padding: 1rem;
          background: rgba(231, 76, 60, 0.1);
          border: 1px solid rgba(231, 76, 60, 0.3);
          border-radius: 8px;
          color: #ff7675;
          font-size: 0.9rem;
        }

        .warning-icon-small {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }

        .alert {
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          font-weight: 500;
        }

        .alert-success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .alert-danger {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: var(--card-bg);
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          max-height: 80vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid #404040;
        }

        .modal-header h2 {
          margin: 0;
          color: var(--text-primary);
          font-size: 1.25rem;
        }

        .modal-close {
          background: none;
          border: none;
          color: var(--text-primary);
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-body {
          padding: 1.5rem;
          color: #e0e0e0;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          padding: 1.5rem;
          border-top: 1px solid #404040;
        }

        .btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .btn-secondary:hover {
          background: #5a6268;
        }

        .btn-primary {
          background: #007bff;
          color: white;
        }

        .btn-primary:hover {
          background: #0056b3;
        }

        .btn-primary:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .dbf-files-list {
          margin-top: 1rem;
        }

        .dbf-files-list h4 {
          color: var(--text-primary);
          margin-bottom: 0.5rem;
        }

        .dbf-files-list ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .dbf-files-list li {
          padding: 0.5rem;
          background: var(--bg-secondary);
          margin-bottom: 0.5rem;
          border-radius: 4px;
          color: #e0e0e0;
        }

        .debug-info {
          background: var(--bg-secondary);
          border-radius: 8px;
          padding: 1.5rem;
        }

        .debug-item {
          margin-bottom: 1rem;
          color: #e0e0e0;
          line-height: 1.5;
        }

        .debug-item strong {
          color: var(--text-primary);
          margin-right: 0.5rem;
        }

        .file-list {
          margin-top: 0.5rem;
          max-height: 200px;
          overflow-y: auto;
          background: var(--card-bg);
          border-radius: 4px;
          padding: 0.5rem;
        }

        .file-item {
          padding: 0.25rem 0;
          color: var(--text-secondary);
          font-family: monospace;
          font-size: 0.9rem;
        }

        /* Backup Management Styles */
        .backup-status {
          margin-bottom: 2rem;
        }

        .backup-info-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.5rem;
          background: linear-gradient(135deg, #00b894, #00a085);
          border-radius: 12px;
          color: white;
          box-shadow: 0 4px 12px rgba(0, 184, 148, 0.3);
        }

        .backup-icon {
          width: 48px;
          height: 48px;
          flex-shrink: 0;
        }

        .backup-details h4 {
          margin: 0 0 0.5rem 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .backup-details p {
          margin: 0.25rem 0;
          font-size: 0.9rem;
          opacity: 0.9;
        }

        .backup-history h3 {
          color: var(--text-primary);
          margin-bottom: 1rem;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .backup-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .backup-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: var(--bg-secondary);
          border-radius: 8px;
          margin-bottom: 0.5rem;
          transition: all 0.2s ease;
        }

        .backup-item:hover {
          background: #4a4a4a;
        }

        .backup-item.latest {
          background: linear-gradient(135deg, #00b894, #00a085);
          color: white;
        }

        .backup-item-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .backup-item-icon {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }

        .backup-item-info strong {
          display: block;
          font-size: 0.9rem;
          margin-bottom: 0.25rem;
        }

        .backup-item-info p {
          margin: 0;
          font-size: 0.8rem;
          opacity: 0.8;
        }

        .latest-badge {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .more-backups {
          text-align: center;
          color: var(--text-secondary);
          font-style: italic;
          margin-top: 1rem;
        }

        .no-backups {
          text-align: center;
          color: var(--text-secondary);
          font-style: italic;
          padding: 2rem;
          background: var(--bg-secondary);
          border-radius: 8px;
        }

        /* Restore Button Styles */
        .backup-item-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .restore-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: linear-gradient(135deg, #e74c3c, #c0392b);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(231, 76, 60, 0.3);
        }

        .restore-button:hover:not(:disabled) {
          background: linear-gradient(135deg, #c0392b, #a93226);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
        }

        .restore-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .restore-icon {
          width: 16px;
          height: 16px;
        }

        /* Restore Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .restore-modal {
          background: var(--card-bg);
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid #3a3a3a;
        }

        .modal-header h3 {
          margin: 0;
          color: var(--text-primary);
          font-size: 1.25rem;
          font-weight: 600;
        }

        .modal-close {
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 4px;
          transition: all 0.2s ease;
        }

        .modal-close:hover:not(:disabled) {
          background: var(--bg-secondary);
          color: var(--text-primary);
        }

        .modal-close:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .modal-body {
          padding: 1.5rem;
        }

        .restore-warning {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: linear-gradient(135deg, #e74c3c, #c0392b);
          border-radius: 8px;
          margin-bottom: 1.5rem;
        }

        .warning-icon {
          width: 24px;
          height: 24px;
          color: white;
          flex-shrink: 0;
        }

        .restore-warning p {
          margin: 0;
          color: white;
          font-weight: 600;
        }

        .restore-details {
          background: var(--bg-secondary);
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
        }

        .restore-details h4 {
          margin: 0 0 0.75rem 0;
          color: var(--text-primary);
          font-size: 1rem;
          font-weight: 600;
        }

        .restore-details p {
          margin: 0.25rem 0;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .restore-note {
          background: #1a1a1a;
          padding: 1rem;
          border-radius: 8px;
          border-left: 4px solid #00b894;
        }

        .restore-note p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.9rem;
          line-height: 1.4;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          padding: 1.5rem;
          border-top: 1px solid #3a3a3a;
        }

        .cancel-button {
          padding: 0.75rem 1.5rem;
          background: var(--bg-secondary);
          color: var(--text-secondary);
          border: none;
          border-radius: 6px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .cancel-button:hover:not(:disabled) {
          background: #4a4a4a;
          color: var(--text-primary);
        }

        .cancel-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .confirm-restore-button {
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #e74c3c, #c0392b);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(231, 76, 60, 0.3);
        }

        .confirm-restore-button:hover:not(:disabled) {
          background: linear-gradient(135deg, #c0392b, #a93226);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
        }

        .confirm-restore-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        @media (max-width: 768px) {
          .developer-page {
            padding: 1rem;
          }

          .dbf-buttons-grid {
            grid-template-columns: 1fr;
          }

          .developer-section {
            padding: 1.5rem;
          }

          .backup-info-card {
            flex-direction: column;
            text-align: center;
          }

          .backup-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }

          .backup-item-actions {
            width: 100%;
            justify-content: space-between;
          }

          .restore-modal {
            width: 95%;
            margin: 1rem;
          }

          .modal-header {
            padding: 1rem;
          }

          .modal-body {
            padding: 1rem;
          }

          .modal-footer {
            padding: 1rem;
            flex-direction: column;
            gap: 0.5rem;
          }

          .cancel-button,
          .confirm-restore-button {
            width: 100%;
          }
        }
      `}</style>
      
      {/* System Documentation Modal */}
      {showDocumentation && (
        <SystemDocumentation onClose={() => setShowDocumentation(false)} />
      )}
    </div>
  );
};

export default Developer;

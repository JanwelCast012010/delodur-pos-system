import React, { useState, useEffect, useContext } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  House, 
  Receipt, 
  FileText, 
  Box, 
  People, 
  Speedometer2,
  Clock,
  Person,
  Cart,
  Search,
  QrCode,
  Gear,
  List,
  X as XIcon,
  ChevronLeft,
  ChevronRight,
  GeoAlt,
  Truck,
  FileEarmarkSpreadsheet
} from 'react-bootstrap-icons';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { AuthContext } from '../AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useTheme } from '../contexts/ThemeContext';


// Mercedes Benz Logo Component
const MercedesBenzLogo = ({ size = 50 }) => (
  <div style={{
    width: `${size}px`,
    height: `${size}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }}>
    <img 
      src="/mercedes-logo-2.png" 
      alt="Mercedes Benz Logo" 
      style={{ 
        width: '100%', 
        height: '100%', 
        objectFit: 'contain',
        marginBottom: '0'
      }} 
    />
  </div>
);

const POSLayout = ({ children }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { user, logout, hasPermission } = useContext(AuthContext);
  const { orderCounts } = useNotifications();
  const { theme, toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  // Large font mode state (shared across all pages)
  const [largeFontMode, setLargeFontMode] = useState(() => {
    const saved = localStorage.getItem('systemLargeFont');
    return saved === 'true';
  });
  
  // Toggle large font mode
  const toggleLargeFont = () => {
    const newValue = !largeFontMode;
    setLargeFontMode(newValue);
    localStorage.setItem('systemLargeFont', newValue.toString());
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('fontModeChanged', { detail: { largeFontMode: newValue } }));
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Track window width for responsive design
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth > 768) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSettings = () => {
    setDropdownOpen(false);
    navigate('/settings');
  };
  
  // Toggle sidebar collapse
  const toggleSidebarCollapse = () => {
    const newValue = !sidebarCollapsed;
    setSidebarCollapsed(newValue);
    localStorage.setItem('sidebarCollapsed', newValue.toString());
  };

  // Listen for cart item selection to auto-collapse sidebar
  useEffect(() => {
    const handleCartItemsSelected = (e) => {
      const hasItems = e.detail.hasItems;
      const currentCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
      
      if (hasItems && !currentCollapsed) {
        // Store previous state before auto-collapsing
        const previousState = localStorage.getItem('sidebarCollapsed');
        localStorage.setItem('sidebarCollapsedBeforeCart', previousState || 'false');
        setSidebarCollapsed(true);
        localStorage.setItem('sidebarCollapsed', 'true');
      } else if (!hasItems) {
        // Restore previous state when cart is empty
        const previousState = localStorage.getItem('sidebarCollapsedBeforeCart');
        if (previousState !== null) {
          setSidebarCollapsed(previousState === 'true');
          localStorage.setItem('sidebarCollapsed', previousState);
          localStorage.removeItem('sidebarCollapsedBeforeCart');
        }
      }
    };

    window.addEventListener('cartItemsSelected', handleCartItemsSelected);
    return () => window.removeEventListener('cartItemsSelected', handleCartItemsSelected);
  }, []);

  // Check if user has items in cart and confirm navigation
  const handleNavigationWithCartCheck = (e, targetPath) => {
    const cartCount = localStorage.getItem('inventoryCartCount');
    const cartPage = localStorage.getItem('inventoryCartPage');
    
    console.log('🧭 Navigation check:', { cartCount, cartPage, targetPath, currentPath: location.pathname });
    
    // Close sidebar on mobile when navigating
    if (windowWidth <= 768) {
      setSidebarOpen(false);
    }
    
    // Only show warning if we're leaving from stock page with items in cart
    if (cartCount && parseInt(cartCount) > 0 && cartPage === '/stock' && targetPath !== '/stock') {
      e.preventDefault();
      
      // Trigger custom confirmation modal in Stock component
      window.dispatchEvent(new CustomEvent('showNavigationConfirm', {
        detail: { targetPath, cartCount }
      }));
      
      return false;
    }
    return true;
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e) => {
      if (!e.target.closest('.pos-user-avatar')) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  return (
    <div className="pos-layout">
      {/* Header */}
      <header className="pos-header">
        <div className="pos-header-left">
          {windowWidth <= 768 && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '4px 8px',
                marginRight: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {sidebarOpen ? <XIcon size={24} /> : <List size={24} />}
            </button>
          )}
          <div className="pos-company">
            <span>DELODUR CORPORATION</span>
            <span className="pos-system">TRACK v2</span>
          </div>
        </div>
        
        <div className="pos-header-center">
          <MercedesBenzLogo size={50} />
        </div>
        
        <div className="pos-header-right">
          <div className="pos-user">
            <div className="pos-user-avatar" style={{ cursor: 'pointer', position: 'relative' }} onClick={() => setDropdownOpen(v => !v)}>
              <Person />
              {dropdownOpen && (
                <div className="pos-user-dropdown" style={{ position: 'absolute', top: 44, right: 0, background: 'var(--card-bg)', borderRadius: 8, boxShadow: '0 2px 12px var(--shadow-lg)', minWidth: 180, zIndex: 1000, border: '1px solid var(--border-color)', padding: 0 }}>
                  <button style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text-primary)', padding: '12px 18px', textAlign: 'left', fontSize: '1rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }} onClick={handleSettings}>Settings</button>
                  <div 
                    className="font-toggle-container" 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLargeFont();
                    }}
                  >
                    <span className="font-toggle-label" style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Large Font</span>
                    <label className="font-toggle-switch" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={largeFontMode}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleLargeFont();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      />
                      <span className="font-toggle-slider"></span>
                    </label>
                  </div>
                  <div 
                    className="theme-toggle-container" 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTheme();
                    }}
                  >
                    <span className="theme-toggle-label" style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Dark Mode</span>
                    <label className="theme-toggle-switch" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isDark}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleTheme();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      />
                      <span className="theme-toggle-slider"></span>
                    </label>
                  </div>
                  <button style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text-primary)', padding: '12px 18px', textAlign: 'left', fontSize: '1rem', cursor: 'pointer', borderTop: '1px solid var(--border-color)' }} onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
            <div className="pos-user-info">
              <div className="pos-user-name">{user?.username || 'Admin'}</div>
              <div className="pos-user-role">Administrator</div>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`pos-sidebar-modern ${sidebarOpen ? 'mobile-open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {/* Mobile Header */}
        {windowWidth <= 768 && (
          <div className="sidebar-header-modern">
            <button
              onClick={() => setSidebarOpen(false)}
              className="sidebar-close-btn"
            >
              <XIcon size={20} />
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="sidebar-nav-modern">
          {/* Home - always visible */}
          <NavLink 
            to="/" 
            className={({ isActive }) => `nav-item-modern ${isActive ? 'active' : ''}`}
            onClick={(e) => handleNavigationWithCartCheck(e, '/')}
          > 
            <div className="nav-icon-wrapper-modern">
              <House className="nav-icon-modern" size={20} />
            </div>
            <span className="nav-text-modern">Home</span>
          </NavLink>
          
          {/* Dashboard - always visible */}
          <NavLink 
            to="/dashboard" 
            className={({ isActive }) => `nav-item-modern ${isActive ? 'active' : ''}`}
            onClick={(e) => handleNavigationWithCartCheck(e, '/dashboard')}
          > 
            <div className="nav-icon-wrapper-modern">
              <Speedometer2 className="nav-icon-modern" size={20} />
            </div>
            <span className="nav-text-modern">Dashboard</span>
          </NavLink>
          
          {/* Stocks - permission based */}
          {hasPermission('stocks') && (
            <NavLink 
              to="/stock" 
              className={({ isActive }) => `nav-item-modern ${isActive ? 'active' : ''}`}
              onClick={(e) => handleNavigationWithCartCheck(e, '/stock')}
            > 
              <div className="nav-icon-wrapper-modern">
                <Box className="nav-icon-modern" size={20} />
              </div>
              <span className="nav-text-modern">Stocks</span>
            </NavLink>
          )}
          
          {/* Warehouses - permission based */}
          {hasPermission('warehouses') && (
            <NavLink 
              to="/warehouses" 
              className={({ isActive }) => `nav-item-modern ${isActive ? 'active' : ''}`}
              onClick={(e) => handleNavigationWithCartCheck(e, '/warehouses')}
            > 
              <div className="nav-icon-wrapper-modern">
                <Box className="nav-icon-modern" size={20} />
                {orderCounts.warehouseCount > 0 && (
                  <span className="nav-badge-modern">
                    {orderCounts.warehouseCount > 99 ? '99+' : orderCounts.warehouseCount}
                  </span>
                )}
              </div>
              <span className="nav-text-modern">Warehouses</span>
            </NavLink>
          )}
          
          {/* Cashier - permission based */}
          {hasPermission('cashier') && (
            <NavLink 
              to="/cashier" 
              className={({ isActive }) => `nav-item-modern ${isActive ? 'active' : ''}`}
              onClick={(e) => handleNavigationWithCartCheck(e, '/cashier')}
            > 
              <div className="nav-icon-wrapper-modern">
                <Receipt className="nav-icon-modern" size={20} />
                {orderCounts.cashierCount > 0 && (
                  <span className="nav-badge-modern">
                    {orderCounts.cashierCount > 99 ? '99+' : orderCounts.cashierCount}
                  </span>
                )}
              </div>
              <span className="nav-text-modern">Cashier</span>
            </NavLink>
          )}
          
          {/* Service - permission based */}
          {hasPermission('service') && (
            <NavLink 
              to="/service" 
              className={({ isActive }) => `nav-item-modern ${isActive ? 'active' : ''}`}
              onClick={(e) => handleNavigationWithCartCheck(e, '/service')}
            > 
              <div className="nav-icon-wrapper-modern">
                <FileText className="nav-icon-modern" size={20} />
                {orderCounts.serviceCount > 0 && (
                  <span className="nav-badge-modern">
                    {orderCounts.serviceCount > 99 ? '99+' : orderCounts.serviceCount}
                  </span>
                )}
              </div>
              <span className="nav-text-modern">Service</span>
            </NavLink>
          )}
          
          {/* Quotations - permission based */}
          {hasPermission('quotations') && (
            <NavLink 
              to="/quotations" 
              className={({ isActive }) => `nav-item-modern ${isActive ? 'active' : ''}`}
              onClick={(e) => handleNavigationWithCartCheck(e, '/quotations')}
            > 
              <div className="nav-icon-wrapper-modern">
                <FileText className="nav-icon-modern" size={20} />
              </div>
              <span className="nav-text-modern">Quotations</span>
            </NavLink>
          )}
          
          {/* Sales History - permission based */}
          {hasPermission('salesHistory') && (
            <NavLink 
              to="/sales-history" 
              className={({ isActive }) => `nav-item-modern ${isActive ? 'active' : ''}`}
              onClick={(e) => handleNavigationWithCartCheck(e, '/sales-history')}
            > 
              <div className="nav-icon-wrapper-modern">
                <Receipt className="nav-icon-modern" size={20} />
              </div>
              <span className="nav-text-modern">Sales History</span>
            </NavLink>
          )}
          
          {/* Requests - permission based */}
          {hasPermission('requests') && (
            <NavLink 
              to="/requests" 
              className={({ isActive }) => `nav-item-modern ${isActive ? 'active' : ''}`}
              onClick={(e) => handleNavigationWithCartCheck(e, '/requests')}
            > 
              <div className="nav-icon-wrapper-modern">
                <People className="nav-icon-modern" size={20} />
              </div>
              <span className="nav-text-modern">Requests</span>
            </NavLink>
          )}
          
          {/* P.O (Purchase Orders) - permission based */}
          {hasPermission('stocks') && (
            <NavLink 
              to="/po" 
              className={({ isActive }) => `nav-item-modern ${isActive ? 'active' : ''}`}
              onClick={(e) => handleNavigationWithCartCheck(e, '/po')}
            > 
              <div className="nav-icon-wrapper-modern">
                <FileText className="nav-icon-modern" size={20} />
              </div>
              <span className="nav-text-modern">P.O</span>
            </NavLink>
          )}

          {/* Shipment Checking */}
          {hasPermission('shipmentChecking') && (
            <NavLink 
              to="/shipment-checking" 
              className={({ isActive }) => `nav-item-modern ${isActive ? 'active' : ''}`}
              onClick={(e) => handleNavigationWithCartCheck(e, '/shipment-checking')}
            > 
              <div className="nav-icon-wrapper-modern">
                <Truck className="nav-icon-modern" size={20} />
              </div>
              <span className="nav-text-modern">Shipment Checking</span>
            </NavLink>
          )}

          {/* PDF to Excel - AI extract invoice/order data to Excel */}
          <NavLink 
            to="/pdf-to-excel" 
            className={({ isActive }) => `nav-item-modern ${isActive ? 'active' : ''}`}
            onClick={(e) => handleNavigationWithCartCheck(e, '/pdf-to-excel')}
          > 
            <div className="nav-icon-wrapper-modern">
              <FileEarmarkSpreadsheet className="nav-icon-modern" size={20} />
            </div>
            <span className="nav-text-modern">PDF to Excel</span>
          </NavLink>
          
          {/* Inventory Management - permission based */}
          {hasPermission('inventoryManagement') && (
            <NavLink 
              to="/inventory-management" 
              className={({ isActive }) => `nav-item-modern ${isActive ? 'active' : ''}`}
              onClick={(e) => handleNavigationWithCartCheck(e, '/inventory-management')}
            > 
              <div className="nav-icon-wrapper-modern">
                <Box className="nav-icon-modern" size={20} />
              </div>
              <span className="nav-text-modern">Inventory</span>
            </NavLink>
          )}
          
          {/* Inventory Audit - permission based */}
          {hasPermission('inventoryAudit') && (
            <NavLink 
              to="/inventory-audit" 
              className={({ isActive }) => `nav-item-modern ${isActive ? 'active' : ''}`}
              onClick={(e) => handleNavigationWithCartCheck(e, '/inventory-audit')}
            > 
              <div className="nav-icon-wrapper-modern">
                <Search className="nav-icon-modern" size={20} />
              </div>
              <span className="nav-text-modern">Inventory Audit</span>
            </NavLink>
          )}
          
          {/* Location - permission based */}
          {hasPermission('location') && (
            <NavLink 
              to="/location" 
              className={({ isActive }) => `nav-item-modern ${isActive ? 'active' : ''}`}
              onClick={(e) => handleNavigationWithCartCheck(e, '/location')}
            > 
              <div className="nav-icon-wrapper-modern">
                <GeoAlt className="nav-icon-modern" size={20} />
              </div>
              <span className="nav-text-modern">Location</span>
            </NavLink>
          )}
          
          {/* Administrator Section */}
          {hasPermission('userManagement') && (
            <NavLink 
              to="/user-management" 
              className={({ isActive }) => `nav-item-modern ${isActive ? 'active' : ''}`}
              onClick={(e) => handleNavigationWithCartCheck(e, '/user-management')}
            > 
              <div className="nav-icon-wrapper-modern">
                <People className="nav-icon-modern" size={20} />
              </div>
              <span className="nav-text-modern">User Management</span>
            </NavLink>
          )}

          {/* Developer Section */}
          {hasPermission('developerTools') && (
            <>
              <div className="nav-divider-modern">
                <div className="divider-line-modern"></div>
                <span className="divider-text-modern">Developer</span>
                <div className="divider-line-modern"></div>
              </div>
              
              <NavLink 
                to="/developer" 
                className={({ isActive }) => `nav-item-modern ${isActive ? 'active' : ''}`}
              > 
                <div className="nav-icon-wrapper-modern">
                  <Gear className="nav-icon-modern" size={20} />
                </div>
                <span className="nav-text-modern">Developer Tools</span>
              </NavLink>
            </>
          )}

        </nav>
      </aside>

      {/* Canva-style Collapse Button - Outside sidebar container */}
      {windowWidth > 768 && (
        <button
          onClick={toggleSidebarCollapse}
          className={`sidebar-collapse-btn-canva ${sidebarCollapsed ? 'collapsed' : ''}`}
          title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      )}

      {/* Mobile Overlay */}
      {windowWidth <= 768 && sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--modal-overlay)',
            zIndex: 1999,
            transition: 'opacity 0.3s ease'
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className={`pos-main-modern ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="pos-content">
          {children}
        </div>
      </main>

      <style jsx>{`
        /* Modern Sidebar Styles */
        .pos-sidebar-modern {
          width: clamp(240px, 20vw, 260px);
          background: var(--bg-secondary);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          height: calc(100vh - clamp(60px, 10vw, 80px));
          position: fixed;
          left: 0;
          top: clamp(60px, 10vw, 80px);
          z-index: 1050;
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          overflow-x: visible;
          transition: width 0.3s ease, transform 0.3s ease;
        }

        :global([data-theme="light"]) .pos-sidebar-modern {
          background: var(--bg-tertiary);
          box-shadow: 2px 0 8px var(--shadow-sm);
        }

        :global([data-theme="dark"]) .pos-sidebar-modern {
          background: rgba(30, 30, 30, 0.70);
        }

        .pos-sidebar-modern.collapsed {
          width: 70px;
        }

        .pos-sidebar-modern.collapsed .nav-text-modern,
        .pos-sidebar-modern.collapsed .brand-text-modern,
        .pos-sidebar-modern.collapsed .divider-text-modern {
          display: none;
        }

        .pos-sidebar-modern.collapsed .nav-item-modern {
          justify-content: center;
          padding: 14px;
        }

        .pos-sidebar-modern.collapsed .nav-icon-wrapper-modern {
          margin-right: 0;
        }

        .sidebar-header-modern {
          padding: 12px;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          min-height: 44px;
        }

        @media (min-width: 769px) {
          .sidebar-header-modern {
            display: none;
          }
        }

        .sidebar-close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          border-radius: 4px;
        }

        .sidebar-close-btn:hover {
          background: var(--hover-bg);
          color: var(--text-primary);
        }

        .sidebar-footer-modern {
          margin-top: auto;
          padding: 12px;
          border-top: 1px solid var(--border-color);
          background: var(--bg-secondary);
          display: flex;
          justify-content: flex-end;
        }

        .sidebar-collapse-btn-canva {
          position: fixed;
          top: 50%;
          left: clamp(240px, 20vw, 260px);
          transform: translateY(-50%) translateX(-100%);
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-left: none;
          color: var(--text-muted);
          width: 28px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: left 0.3s ease, border-radius 0.3s ease, border 0.3s ease;
          border-radius: 0 8px 8px 0;
          z-index: 9999 !important;
          box-shadow: 2px 0 12px var(--shadow-lg);
          opacity: 1;
          pointer-events: auto;
        }

        .sidebar-collapse-btn-canva:hover {
          background: var(--hover-bg);
          border-color: var(--border-light);
          color: var(--text-primary);
          box-shadow: 2px 0 16px var(--shadow-lg);
        }

        /* When sidebar is collapsed, adjust button position */
        .sidebar-collapse-btn-canva.collapsed {
          left: 70px;
          border-left: 1px solid var(--border-color);
          border-right: none;
          border-radius: 8px 0 0 8px;
        }

        .sidebar-collapse-btn-integrated {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          border-radius: 6px;
        }

        .sidebar-collapse-btn-integrated:hover {
          background: var(--hover-bg);
          border-color: var(--border-light);
          color: var(--text-primary);
        }

        .pos-sidebar-modern.collapsed .sidebar-footer-modern {
          justify-content: center;
        }

        .sidebar-brand-modern {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .brand-icon-modern {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: #007bff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .brand-icon-collapsed {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: #007bff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          margin: 0 auto;
        }

        .brand-text-modern {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .brand-name-modern {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .brand-version-modern {
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .sidebar-nav-modern {
          padding: 12px 8px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .nav-item-modern {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 6px;
          color: var(--text-secondary);
          text-decoration: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          font-weight: 500;
          font-size: 0.9rem;
          background: transparent;
          margin: 2px 8px;
        }

        .nav-item-modern:hover {
          background: var(--hover-bg);
          color: var(--text-primary);
          transform: translateX(4px);
          box-shadow: 0 2px 8px var(--shadow-sm);
        }

        .nav-item-modern.active {
          background: rgba(0, 123, 255, 0.7);
          color: #fff;
          box-shadow: 0 2px 12px rgba(0, 123, 255, 0.4);
        }

        .nav-item-modern.active:hover {
          background: rgba(0, 123, 255, 0.8);
          transform: translateX(4px);
        }

        .nav-item-modern.active:hover {
          background: rgba(0, 123, 255, 0.8);
          transform: translateX(4px);
        }

        .nav-icon-wrapper-modern {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          flex-shrink: 0;
        }

        .nav-icon-modern {
          color: inherit;
          transition: all 0.2s ease;
        }

        .nav-text-modern {
          flex: 1;
          transition: all 0.3s ease;
          color: var(--text-secondary);
        }

        .nav-item-modern:hover .nav-text-modern,
        .nav-item-modern.active .nav-text-modern {
          color: inherit;
        }

        .nav-badge-modern {
          position: absolute;
          top: -4px;
          right: -4px;
          background: #dc3545;
          color: #fff;
          border-radius: 10px;
          min-width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 600;
          padding: 0 5px;
          border: 2px solid var(--bg-secondary);
        }

        .pos-sidebar-modern.collapsed .nav-badge-modern {
          top: 4px;
          right: 4px;
          font-size: 9px;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
        }

        .nav-divider-modern {
          margin: 16px 0 8px 0;
          padding: 0 12px;
        }

        .divider-line-modern {
          height: 1px;
          background: var(--border-color);
        }

        .divider-text-modern {
          font-size: 0.7rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 600;
          margin: 8px 0;
          display: block;
        }

        .nav-indicator-modern {
          position: absolute;
          right: 12px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #1976d2;
          box-shadow: 0 0 8px rgba(25, 118, 210, 0.8);
        }

        /* Mobile Styles */
        @media (max-width: 768px) {
          .pos-sidebar-modern {
            transform: translateX(-100%);
            width: 280px;
          }

          .pos-sidebar-modern.mobile-open {
            transform: translateX(0);
          }
        }

        /* Scrollbar */
        .pos-sidebar-modern::-webkit-scrollbar {
          width: 4px;
        }

        .pos-sidebar-modern::-webkit-scrollbar-track {
          background: var(--bg-tertiary);
        }

        .pos-sidebar-modern::-webkit-scrollbar-thumb {
          background: var(--border-color);
          border-radius: 2px;
        }

        .pos-sidebar-modern::-webkit-scrollbar-thumb:hover {
          background: var(--text-muted);
        }

        /* Liqui Moly Logo Styles */
        .liquimoly-logo {
          margin-right: 12px;
          display: flex;
          align-items: center;
        }

        .liquimoly-brand {
          background: linear-gradient(180deg, #1976d2 0%, #1976d2 50%, #dc3545 50%, #dc3545 100%);
          border-radius: 0;
          padding: 3px 6px;
          border: none;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          width: 45px;
          height: 20px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .liquimoly-text {
          font-size: 0.6rem;
          font-weight: 700;
          color: white;
          text-align: center;
          line-height: 0.9;
          letter-spacing: 0.3px;
          margin: 0;
          padding: 0;
        }

        .liquimoly-blue {
          margin-bottom: 0;
        }

        .liquimoly-red {
          margin-top: 0;
        }

        /* Notification badge pulse animation */
        @keyframes pulse {
          0% {
            transform: scale(1);
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          }
          50% {
            transform: scale(1.1);
            box-shadow: 0 2px 8px rgba(255, 68, 68, 0.5);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          }
        }

        .notification-badge {
          z-index: 10;
        }

        /* Toggle Switch Styles */
        .font-toggle-container,
        .theme-toggle-container {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 18px;
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
        }

        .font-toggle-container:hover,
        .theme-toggle-container:hover {
          background: var(--hover-bg);
        }

        .font-toggle-label,
        .theme-toggle-label {
          color: var(--text-primary);
          font-size: 1rem !important;
          user-select: none;
          cursor: pointer;
          flex: 1;
          font-weight: normal;
        }

        .font-toggle-switch,
        .theme-toggle-switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }

        .font-toggle-switch input,
        .theme-toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .font-toggle-slider,
        .theme-toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: 0.3s;
          border-radius: 24px;
        }

        .font-toggle-slider:before,
        .theme-toggle-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .font-toggle-switch input:checked + .font-toggle-slider {
          background-color: #28a745;
        }

        .font-toggle-switch input:checked + .font-toggle-slider:before {
          transform: translateX(20px);
        }

        .font-toggle-switch:hover .font-toggle-slider {
          box-shadow: 0 0 8px rgba(40, 167, 69, 0.4);
        }

        .theme-toggle-switch input:checked + .theme-toggle-slider {
          background-color: #007bff;
        }

        .theme-toggle-switch input:checked + .theme-toggle-slider:before {
          transform: translateX(20px);
        }

        .theme-toggle-switch:hover .theme-toggle-slider {
          box-shadow: 0 0 8px rgba(0, 123, 255, 0.4);
        }
      `}</style>
      
    </div>
  );
};

export default POSLayout; 
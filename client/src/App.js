import React, { useContext, useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './Login';
import MaintenanceMode from './components/MaintenanceMode';
import Home from './components/Home';
import POSLayout from './components/POSLayout';
import Dashboard from './components/Dashboard';
import Stock from './components/Stock';
import InventoryManagement from './components/InventoryManagement';
import InventoryAudit from './components/InventoryAudit';
import Location from './components/Location';
import Developer from './components/Developer';
import Request from './components/Request';
import Warehouse from './components/Warehouse';
import Cashier from './components/Cashier';
import Service from './components/Service';
import AddStock from './components/AddStock';
import PostStocks from './components/PostStocks';
import Suppliers from './components/Suppliers';
import PostSales from './components/PostSales';
import Customers from './components/Customers';
import Quotations from './components/Quotations';
import SalesHistory from './components/SalesHistory';
import Refunds from './components/Refunds';
import AdjustmentHistory from './components/AdjustmentHistory';
import UserManagement from './components/UserManagement';
import WarehouseDiscrepancyReports from './components/WarehouseDiscrepancyReports';
import PO from './components/PO';
import ShipmentChecking from './components/ShipmentChecking';
import PdfToExcel from './components/PdfToExcel';

import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

const App = () => {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);

  // Check maintenance mode on mount and when storage changes
  useEffect(() => {
    const checkMaintenanceMode = async () => {
      try {
        // Check server-side maintenance mode status (global)
        const response = await fetch('/api/maintenance/status');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.enabled) {
            // Server says maintenance mode is ON
            localStorage.setItem('maintenanceMode', 'true');
            localStorage.removeItem('maintenanceBypassed');
            setIsMaintenanceMode(true);
            return;
          }
        }
      } catch (error) {
        console.error('Error checking maintenance status:', error);
      }
      
      // Fallback to local storage check
      const maintenanceEnabled = localStorage.getItem('maintenanceMode');
      const isEnabled = maintenanceEnabled === 'true';
      const bypassed = localStorage.getItem('maintenanceBypassed') === 'true';
      setIsMaintenanceMode(isEnabled && !bypassed);
    };

    checkMaintenanceMode();

    // Listen for storage changes (in case maintenance mode is toggled in another tab)
    window.addEventListener('storage', checkMaintenanceMode);
    
    // Listen for custom event from Developer tools
    const handleMaintenanceModeChange = (e) => {
      checkMaintenanceMode();
    };
    window.addEventListener('maintenanceModeChanged', handleMaintenanceModeChange);
    
    // Check server status periodically (every 5 seconds)
    const interval = setInterval(checkMaintenanceMode, 5000);

    return () => {
      window.removeEventListener('storage', checkMaintenanceMode);
      window.removeEventListener('maintenanceModeChanged', handleMaintenanceModeChange);
      clearInterval(interval);
    };
  }, []);

  // Show maintenance mode if enabled and not bypassed
  if (isMaintenanceMode) {
    return <MaintenanceMode />;
  }

  return (
    <ThemeProvider>
      <div className="pos-app">
        <Routes>
        {/* Login route - accessible without authentication */}
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} 
        />
        
        {/* Home route - standalone, no sidebar */}
        <Route 
          path="/" 
          element={isAuthenticated ? <Home /> : <Navigate to="/login" replace />} 
        />
        
        {/* Protected routes - require authentication */}
        <Route 
          path="/*" 
          element={
            isAuthenticated ? (
              <POSLayout>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/stock" element={<Stock />} />
                  <Route path="/inventory-management" element={<InventoryManagement />} />
                  <Route path="/inventory-audit" element={<InventoryAudit />} />
                  <Route path="/location" element={<Location />} />
                  <Route path="/developer" element={<Developer />} />
                  <Route path="/warehouses" element={<Warehouse />} />
                  <Route path="/cashier" element={<Cashier />} />
                  <Route path="/service" element={<Service />} />

                  {/* Stock Workflow Routes */}
                  <Route path="/add-stock" element={<AddStock />} />
                  <Route path="/post-stocks" element={<PostStocks />} />
                  <Route path="/suppliers" element={<Suppliers />} />
                  <Route path="/post-sales" element={<PostSales />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/quotations" element={<Quotations />} />
                  <Route path="/sales-history" element={<SalesHistory />} />
                  <Route path="/refunds" element={<Refunds />} />
                  <Route path="/adjustment-history" element={<AdjustmentHistory />} />
                          <Route path="/requests" element={<Request />} />
        <Route path="/user-management" element={<UserManagement />} />
        <Route path="/warehouse-discrepancy-reports" element={<WarehouseDiscrepancyReports />} />
        <Route path="/po" element={<PO />} />
        <Route path="/shipment-checking" element={<ShipmentChecking />} />
                  <Route path="/pdf-to-excel" element={<PdfToExcel />} />
                </Routes>
              </POSLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
        </Routes>
      </div>
    </ThemeProvider>
  );
};

export default App;
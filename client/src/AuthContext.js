import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
  hasPermission: () => false,
  refreshUser: () => {}
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setIsAuthenticated(true);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // Check if user has permission to access a specific page
  const hasPermission = (permission) => {
    if (!user) {
      return false;
    }
    
    // If user is admin role, always allow access to everything
    if (user.role === 'admin') {
      return true;
    }
    
    // If no permissions set, deny access
    if (!user.permissions || user.permissions === null || user.permissions === undefined) {
      return false;
    }
    
    try {
      // Parse permissions if it's a string, otherwise use as-is
      let permissions;
      if (typeof user.permissions === 'string') {
        permissions = JSON.parse(user.permissions);
      } else {
        permissions = user.permissions;
      }
      
      // Return true if permission is explicitly set to true
      return permissions[permission] === true;
    } catch (error) {
      console.error('Error parsing permissions:', error);
      return false;
    }
  };

  // Refresh user data from server
  const refreshUser = async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (!result.error && result.data) {
          const userData = result.data;
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        }
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser && token) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated, hasPermission, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}; 
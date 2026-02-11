import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../AuthContext';

const UserManagement = () => {
  const { user: currentUser, refreshUser } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState(null);
  
  // Form states
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    password: '',
    role: 'user' // Default role
  });

  const [userPermissions, setUserPermissions] = useState({
    stocks: false,
    inventoryManagement: false,
    inventoryAudit: false,
    warehouses: false,
    cashier: false,
    service: false,
    quotations: false,
    salesHistory: false,
    requests: false,
    location: false,
    userManagement: false,
    developerTools: false,
    shipmentChecking: false
  });

  const [formErrors, setFormErrors] = useState({});

  // Permission labels (excluding dashboard since it's always accessible)
  const permissionLabels = {
    stocks: 'Stocks',
    inventoryManagement: 'Inventory Management',
    inventoryAudit: 'Inventory Audit',
    warehouses: 'Warehouses',
    cashier: 'Cashier',
    service: 'Service',
    quotations: 'Quotations',
    salesHistory: 'Sales History',
    requests: 'Requests',
    location: 'Location',
    userManagement: 'User Management',
    developerTools: 'Developer Tools',
    shipmentChecking: 'Shipment Checking'
  };

  // Fetch users from API
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('🔍 Fetch users response:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Failed to fetch users:', errorData);
        
        if (response.status === 403) {
          setError('You need admin privileges to access user management');
        } else {
          throw new Error(errorData.message || 'Failed to fetch users');
        }
        return;
      }

      const result = await response.json();
      console.log('📊 Users data received:', result);
      
      if (!result.error) {
        setUsers(result.data || []);
      } else {
        console.error('Error fetching users:', result.message);
        setError(result.message);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Open permissions modal for a user
  const handlePermissionsClick = (user) => {
    setSelectedUserForPermissions(user);
    
    // Parse permissions safely
    let permissionsObj = {
      stocks: false,
      inventoryManagement: false,
      inventoryAudit: false,
      warehouses: false,
      cashier: false,
      service: false,
      quotations: false,
      salesHistory: false,
      requests: false,
      location: false,
      userManagement: false,
      developerTools: false,
      shipmentChecking: false
    };
    
    if (user.permissions) {
      try {
        // Try to parse if it's a string, otherwise use as-is
        if (typeof user.permissions === 'string') {
          permissionsObj = JSON.parse(user.permissions);
        } else {
          permissionsObj = user.permissions;
        }
      } catch (error) {
        console.error('Error parsing user permissions:', error);
      }
    }
    
    setUserPermissions(permissionsObj);
    setShowPermissionsModal(true);
  };

  // Toggle a permission checkbox
  const handlePermissionToggle = (permissionKey) => {
    setUserPermissions(prev => ({
      ...prev,
      [permissionKey]: !prev[permissionKey]
    }));
  };

  // Save permissions
  const handleSavePermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${selectedUserForPermissions.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: selectedUserForPermissions.username,
          fullName: selectedUserForPermissions.fullName,
          role: selectedUserForPermissions.role, // Preserve the current role
          permissions: JSON.stringify(userPermissions)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update permissions');
      }

      const result = await response.json();
      if (!result.error) {
        fetchUsers(); // Refresh the user list
        
        // Show success message
        alert('Permissions saved successfully! Please refresh the page to see the changes in the sidebar for the affected user.');
        
        setShowPermissionsModal(false);
        setSelectedUserForPermissions(null);
      } else {
        console.error('Error updating permissions:', result.message);
        alert('Failed to update permissions: ' + result.message);
      }
    } catch (error) {
      console.error('Error updating permissions:', error);
      alert('Error updating permissions: ' + error.message);
    }
  };

  // Delete user
  const deleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/users/${userId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const result = await response.json();
        
        if (!response.ok) {
          alert(`Failed to delete user: ${result.message || 'Unknown error'}`);
          return;
        }

        if (!result.error) {
          alert('User deleted successfully!');
          fetchUsers(); // Refresh the user list
        } else {
          alert(`Error deleting user: ${result.message}`);
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        alert(`Error deleting user: ${error.message}`);
      }
    }
  };

  // Validation function
  const validateForm = (form) => {
    const errors = {};

    if (!form.username.trim()) {
      errors.username = 'Username is required';
    } else if (form.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }

    if (!form.password.trim()) {
      errors.password = 'Password is required';
    } else if (form.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    return errors;
  };

  // Create new user
  const handleCreateUser = async () => {
    // Check only username validation
    const errors = {};
    if (!newUserForm.username.trim()) {
      errors.username = 'Username is required';
    } else if (newUserForm.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }

    // If custom password provided, validate it
    if (newUserForm.password && newUserForm.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      // Use custom password if provided, otherwise use default
      const passwordToUse = newUserForm.password.trim() || '123456';
      
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: newUserForm.username,
          password: passwordToUse,
          fullName: newUserForm.username, // Use username as fullName
          role: newUserForm.role,
          permissions: JSON.stringify(userPermissions)
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Failed to create user');
      }

      const result = await response.json();
      if (!result.error) {
        fetchUsers(); // Refresh the user list
        setShowAddUserModal(false);
        setNewUserForm({
          username: '',
          password: '',
          role: 'user'
        });
        setFormErrors({});
        
        const passwordUsed = passwordToUse === '123456' ? 'Default password: 123456' : 'Custom password was set';
        alert(`User created successfully!\n\nUsername: ${newUserForm.username}\nPassword: ${passwordToUse}\n\nUser can login with these credentials.`);
      } else {
        setFormErrors({ general: result.message });
      }
    } catch (error) {
      console.error('Error creating user:', error);
      setFormErrors({ general: error.message });
    }
  };

  // Edit user
  const handleEditUser = (user) => {
    setEditingUser(user);
    setNewUserForm({
      username: user.username,
      password: '',
      role: user.role || 'user'
    });
    setFormErrors({});
    setShowAddUserModal(true);
  };

  // Update user
  const handleUpdateUser = async () => {
    // Validate username
    const errors = {};
    if (!newUserForm.username.trim()) {
      errors.username = 'Username is required';
    } else if (newUserForm.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }

    // Validate password if provided
    if (newUserForm.password && newUserForm.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const updateData = {
        username: newUserForm.username,
        fullName: newUserForm.username, // Use username as fullName
        role: newUserForm.role
      };

      // Only include password if it's provided
      if (newUserForm.password.trim()) {
        updateData.password = newUserForm.password;
      }

      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Failed to update user');
      }

      const result = await response.json();
      if (!result.error) {
        fetchUsers(); // Refresh the user list
        setShowAddUserModal(false);
        setEditingUser(null);
        setFormErrors({});
      } else {
        setFormErrors({ general: result.message });
      }
    } catch (error) {
      console.error('Error updating user:', error);
      setFormErrors({ general: error.message });
    }
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const displayName = user.fullName || user.username;
    const matchesSearch = displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.username.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="pos-container">
        <div className="pos-loading">
          <div className="pos-loading-spinner"></div>
          <div className="pos-loading-text">Loading user management...</div>
        </div>
      </div>
    );
  }

  // Show error if there's one
  if (error && users.length === 0) {
    return (
      <div className="pos-container">
        <div className="user-mgmt-header">
          <div className="user-mgmt-header-content">
            <div className="user-mgmt-title-section">
              <h1 className="user-mgmt-title">User Management</h1>
              <p className="user-mgmt-subtitle">Manage access permissions for your team</p>
            </div>
          </div>
        </div>
        <div style={{ padding: '40px', background: 'var(--card-bg)', borderRadius: '12px', marginTop: '20px' }}>
          <div style={{ color: '#dc3545', fontSize: '1.1rem', marginBottom: '10px' }}>⚠️ {error}</div>
          <div style={{ color: 'var(--text-muted)' }}>Please make sure you have admin privileges to access this page.</div>
          <button 
            onClick={() => fetchUsers()} 
            style={{
              marginTop: '20px',
              padding: '12px 24px',
              background: '#1976d2',
              color: 'var(--text-primary)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="component-wrapper">
      {/* Compact Header with Stats */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ 
          margin: 0, 
          fontSize: '1.5rem', 
          fontWeight: '600',
          color: 'var(--text-primary)'
        }}>
          User Management
        </h2>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'var(--card-bg)',
          padding: '8px 16px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}>
          <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16" style={{ color: '#1976d2' }}>
            <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
          </svg>
          <span style={{ color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: '600' }}>{users.length}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Users</span>
        </div>
      </div>

      {/* Search and Actions Bar */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        alignItems: 'center'
      }}>
        <div style={{
          flex: 1,
          position: 'relative'
        }}>
          <svg style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '18px',
            height: '18px',
            color: 'var(--text-muted)'
          }} fill="currentColor" viewBox="0 0 16 16">
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
          </svg>
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users..."
            style={{
              width: '100%',
              padding: '10px 16px 10px 40px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '0.95rem'
            }}
          />
        </div>
        
        <button 
          onClick={() => {
            setEditingUser(null);
            setNewUserForm({
              username: '',
              password: '',
              role: 'user'
            });
            setFormErrors({});
            setUserPermissions({
              stocks: false,
              inventoryManagement: false,
              inventoryAudit: false,
              warehouses: false,
              cashier: false,
              service: false,
              quotations: false,
              salesHistory: false,
              requests: false,
              location: false,
              userManagement: false,
              developerTools: false,
              shipmentChecking: false
            });
            setShowAddUserModal(true);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            background: '#1976d2',
            color: 'var(--text-primary)',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.95rem',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.target.style.background = '#1565c0';
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 4px 12px rgba(25, 118, 210, 0.3)';
          }}
          onMouseOut={(e) => {
            e.target.style.background = '#1976d2';
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = 'none';
          }}
        >
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
          </svg>
          Add User
        </button>
      </div>

      {/* User Cards Grid */}
      <div style={{ marginTop: '24px' }}>
        {filteredUsers.length === 0 ? (
          <div className="user-mgmt-empty-state">
            <div className="user-mgmt-empty-icon">
              <svg fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
              </svg>
            </div>
            <h3 className="user-mgmt-empty-title">No Users Found</h3>
            <p className="user-mgmt-empty-subtitle">Try adjusting your search or add a new user</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px'
          }}>
            {filteredUsers.map((user) => {
              const displayName = user.fullName || user.username;
              const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

              return (
                <div key={user.id} style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  {/* User Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #1976d2, #1565c0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem',
                      fontWeight: '700',
                      color: 'var(--text-primary)',
                      flexShrink: 0
                    }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px'
                      }}>
                        <h3 style={{
                          margin: 0,
                          fontSize: '1rem',
                          fontWeight: '600',
                          color: 'var(--text-primary)'
                        }}>
                          {displayName}
                        </h3>
                        <span style={{
                          background: user.role === 'admin' 
                            ? '#dc3545' 
                            : 'var(--bg-tertiary)',
                          color: user.role === 'admin' ? '#fff' : 'var(--text-primary)',
                          padding: '3px 10px',
                          borderRadius: '10px',
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {user.role || 'user'}
                        </span>
                      </div>
                      <div style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        fontWeight: '500'
                      }}>
                        @{user.username}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginTop: 'auto'
                  }}>
                    <button
                      onClick={() => handlePermissionsClick(user)}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: '#1976d2',
                        color: 'var(--text-primary)',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.background = '#1565c0';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.background = '#1976d2';
                      }}
                    >
                      Permissions
                    </button>
                    <button
                      onClick={() => handleEditUser(user)}
                      style={{
                        padding: '10px',
                        background: 'var(--bg-tertiary)',
                        color: '#1976d2',
                        border: '1px solid rgba(25, 118, 210, 0.3)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        transition: 'all 0.2s ease',
                        width: '48px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.background = 'rgba(25, 118, 210, 0.1)';
                        e.target.style.borderColor = 'rgba(25, 118, 210, 0.5)';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.background = 'var(--bg-tertiary)';
                        e.target.style.borderColor = 'rgba(25, 118, 210, 0.3)';
                      }}
                    >
                      <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
                        <path fillRule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteUser(user.id)}
                      style={{
                        padding: '10px',
                        background: 'rgba(220, 53, 69, 0.1)',
                        color: '#dc3545',
                        border: '1px solid rgba(220, 53, 69, 0.3)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        transition: 'all 0.2s ease',
                        width: '48px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.background = 'rgba(220, 53, 69, 0.15)';
                        e.target.style.borderColor = 'rgba(220, 53, 69, 0.5)';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.background = 'rgba(220, 53, 69, 0.1)';
                        e.target.style.borderColor = 'rgba(220, 53, 69, 0.3)';
                      }}
                    >
                      <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Permissions Modal */}
      {showPermissionsModal && selectedUserForPermissions && (
        <div className="user-mgmt-modal-overlay" onClick={() => setShowPermissionsModal(false)}>
          <div className="pos-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', width: '90%' }}>
            <div className="pos-modal-header">
              <h2>Manage Permissions: {selectedUserForPermissions.fullName || selectedUserForPermissions.username}</h2>
              <button 
                className="pos-modal-close"
                onClick={() => setShowPermissionsModal(false)}
              >
                ×
              </button>
            </div>
            <div className="pos-modal-body">
              <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
                Select which pages this user can access:
              </p>
              <div className="user-mgmt-permissions-grid">
                {Object.entries(permissionLabels).map(([key, label]) => (
                  <div key={key} className="user-mgmt-permission-item">
                    <input 
                      type="checkbox" 
                      checked={userPermissions[key] || false}
                      onChange={() => handlePermissionToggle(key)}
                      className="user-mgmt-permission-checkbox"
                    />
                    <label className="user-mgmt-permission-label">{label}</label>
                  </div>
                ))}
              </div>
            </div>
            <div className="pos-modal-actions">
              <button 
                className="pos-btn pos-btn-secondary"
                onClick={() => setShowPermissionsModal(false)}
              >
                Cancel
              </button>
              <button 
                className="pos-btn pos-btn-primary"
                onClick={handleSavePermissions}
              >
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit User Modal */}
      {showAddUserModal && (
        <div className="user-mgmt-modal-overlay">
          <div className="user-mgmt-modal">
            <div className="user-mgmt-modal-header">
              <h2 className="user-mgmt-modal-title">
                <svg className="user-mgmt-modal-icon" fill="currentColor" viewBox="0 0 16 16">
                  <path d={editingUser ? "M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708L11.707 8l3.147 3.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0L8.5 8.707l-3.146 3.147a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708L7.293 8 4.146 4.854a.5.5 0 0 1 0-.708l3-3a.5.5 0 0 1 .708 0L8.5 7.293l3.146-3.147z" : "M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"}/>
                </svg>
                {editingUser ? 'Edit User' : 'Add New User'}
              </h2>
              <button 
                onClick={() => {
                  setShowAddUserModal(false);
                  setEditingUser(null);
                }}
                className="user-mgmt-modal-close"
              >
                <svg fill="currentColor" viewBox="0 0 16 16">
                  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                </svg>
              </button>
            </div>

            <div className="user-mgmt-modal-body">
              {formErrors.general && (
                <div className="user-mgmt-error-message">
                  {formErrors.general}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="user-mgmt-form-group">
                  <label className="user-mgmt-form-label">Username *</label>
                  <input
                    type="text"
                    className={`user-mgmt-form-input ${formErrors.username ? 'error' : ''}`}
                    value={newUserForm.username}
                    onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                    placeholder="Enter username"
                  />
                  {formErrors.username && <span className="user-mgmt-error-text">{formErrors.username}</span>}
                </div>

                <div className="user-mgmt-form-group">
                  <label className="user-mgmt-form-label">Role *</label>
                    <select
                    className="user-mgmt-form-input"
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      color: 'var(--text-primary)',
                      fontSize: '1rem',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="user" style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}>User</option>
                    <option value="admin" style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}>Admin</option>
                  </select>
                </div>

                {editingUser ? (
                  <div className="user-mgmt-form-group">
                    <label className="user-mgmt-form-label">New Password *</label>
                    <input
                      type="password"
                      className={`user-mgmt-form-input ${formErrors.password ? 'error' : ''}`}
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                      placeholder="Enter new password"
                    />
                    {formErrors.password && <span className="user-mgmt-error-text">{formErrors.password}</span>}
                  </div>
                ) : (
                  <div className="user-mgmt-form-group">
                    <label className="user-mgmt-form-label">Password (optional)</label>
                    <input
                      type="password"
                      className={`user-mgmt-form-input ${formErrors.password ? 'error' : ''}`}
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                      placeholder="Leave empty for default password 123456"
                    />
                    {formErrors.password && <span className="user-mgmt-error-text">{formErrors.password}</span>}
                  </div>
                )}
              </div>
            </div>

            <div className="user-mgmt-modal-footer">
              <button 
                onClick={() => {
                  setShowAddUserModal(false);
                  setEditingUser(null);
                }}
                className="user-mgmt-btn user-mgmt-btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={editingUser ? handleUpdateUser : handleCreateUser}
                className="user-mgmt-btn user-mgmt-btn-primary"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <path d={editingUser ? "M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708L11.707 8l3.147 3.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0L8.5 8.707l-3.146 3.147a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708L7.293 8 4.146 4.854a.5.5 0 0 1 0-.708l3-3a.5.5 0 0 1 .708 0L8.5 7.293l3.146-3.147z" : "M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"}/>
                </svg>
                {editingUser ? 'Update User' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

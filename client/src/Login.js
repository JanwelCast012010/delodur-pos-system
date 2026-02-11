import React, { useState, useContext } from 'react';
import { AuthContext } from './AuthContext';
import { useNavigate } from 'react-router-dom';

import axios from 'axios';

const Login = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await axios.post('/api/auth/login', formData);
      const { token, user } = response.data;
      login(user, token);
      navigate('/dashboard');
    } catch (error) {
      setError(error.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg-dark">
      <div className="login-animated-bg"></div>
      
      {/* Floating Particles */}
      <div className="login-particles">
        <div className="login-particle"></div>
        <div className="login-particle"></div>
        <div className="login-particle"></div>
        <div className="login-particle"></div>
        <div className="login-particle"></div>
        <div className="login-particle"></div>
        <div className="login-particle"></div>
        <div className="login-particle"></div>
        <div className="login-particle"></div>
        <div className="login-particle"></div>
      </div>

      {/* Geometric Shapes */}
      <div className="login-geometric-shapes">
        <div className="login-shape"></div>
        <div className="login-shape"></div>
        <div className="login-shape"></div>
        <div className="login-shape"></div>
        <div className="login-shape"></div>
      </div>

      <div className="login-glass-card">
        <div className="login-subtitle">DELODUR CORPORATION</div>
        <h2 className="login-title">TRACK</h2>
        <form className="login-form" onSubmit={handleSubmit} autoComplete="off">
          {error && <div className="login-error">{error}</div>}
          <div className="login-field">
            <input
              id="username"
              name="username"
              type="text"
              value={formData.username}
              onChange={handleChange}
              placeholder=" "
              autoFocus
              required
            />
            <label htmlFor="username">Username</label>
          </div>
          <div className="login-field">
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder=" "
              required
            />
            <label htmlFor="password">Password</label>
          </div>
          <button 
            className={`login-btn ${loading ? 'loading' : ''}`} 
            type="submit" 
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div className="login-footer">
          <p>© 2025 DELODUR Corporation. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default Login; 
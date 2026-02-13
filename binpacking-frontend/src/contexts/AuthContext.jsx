import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Setup axios defaults - USE LOCALHOST NOT 0.0.0.0
  useEffect(() => {
    axios.defaults.baseURL = 'http://localhost:8000';
    axios.defaults.headers.common['Content-Type'] = 'application/json';
    axios.defaults.withCredentials = false;
    
    // Add response interceptor for better error handling
    axios.interceptors.response.use(
      response => response,
      error => {
        if (error.code === 'ERR_NETWORK') {
          console.error('Network error - backend not reachable at http://localhost:8000');
        }
        return Promise.reject(error);
      }
    );
  }, []);

  // Setup axios interceptor for token
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => axios.interceptors.request.eject(interceptor);
  }, []);

  // Check if user is already logged in
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('access_token');
      
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // Try to verify token with backend
        const response = await axios.get('/api/auth/verify');
        if (response.data.valid) {
          // Decode token for user info
          const payload = JSON.parse(atob(token.split('.')[1]));
          setUser({
            id: payload.id || 'admin_001',
            username: payload.sub || 'admin',
            email: payload.email || 'admin@binpacking.com',
            full_name: 'System Administrator',
            role: payload.role || 'super_admin',
            is_superuser: true
          });
        } else {
          localStorage.removeItem('access_token');
          localStorage.removeItem('token_type');
          localStorage.removeItem('expires_in');
        }
      } catch (err) {
        console.error('Token verification failed:', err);
        localStorage.removeItem('access_token');
        localStorage.removeItem('token_type');
        localStorage.removeItem('expires_in');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (username, password) => {
    try {
      setError(null);
      
      const params = new URLSearchParams();
      params.append('username', username.trim());
      params.append('password', password);
      
      console.log('Attempting login to:', 'http://localhost:8000/api/auth/login');
      
      const response = await axios.post('/api/auth/login', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      });
      
      console.log('Login successful:', response.data);
      
      const { access_token, token_type, expires_in, user } = response.data;
      
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('token_type', token_type);
      localStorage.setItem('expires_in', expires_in);
      
      setUser(user);
      setError(null);
      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      
      let message = 'Login failed';
      
      if (err.code === 'ERR_NETWORK') {
        message = '❌ Network error';
      } else if (err.response?.status === 401) {
        message = 'Invalid username or password. Use: admin / admin123';
      } else if (err.response?.data?.detail) {
        message = err.response.data.detail;
      }
      
      setError(message);
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('token_type');
      localStorage.removeItem('expires_in');
      setUser(null);
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      setError(null);
      
      const response = await axios.post('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      
      return { success: true, message: response.data.message };
    } catch (err) {
      console.error('Password change error:', err);
      const message = err.response?.data?.detail || 'Password change failed';
      setError(message);
      return { success: false, error: message };
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    changePassword,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'super_admin' || user?.is_superuser === true
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
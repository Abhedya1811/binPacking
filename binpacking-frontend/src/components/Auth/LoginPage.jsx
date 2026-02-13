import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Fade,
  Divider
} from '@mui/material';
import {
  LockOutlined,
  PersonOutlined,
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
  Warehouse as WarehouseIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, loading, error: authError, isAuthenticated } = useAuth();
  
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Show auth errors from context
  useEffect(() => {
    if (authError) {
      setErrorMessage(authError);
      setShowError(true);
    }
  }, [authError]);

  const validateForm = () => {
    const errors = {};
    if (!formData.username.trim()) errors.username = 'Username is required';
    if (!formData.password) errors.password = 'Password is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setErrorMessage('');
    setShowError(false);
    await login(formData.username.trim(), formData.password);
  };

  const handleCloseError = () => {
    setShowError(false);
    setErrorMessage('');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        backgroundColor: '#fafafa',
        backgroundImage: 'url(https://images.unsplash.com/photo-1578575437130-527eed3abbec?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.92)'
        }
      }}
    >
      <Fade in timeout={800}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 4, sm: 6 },
            width: { xs: '90%', sm: 460 },
            borderRadius: 2,
            position: 'relative',
            zIndex: 1,
            backgroundColor: 'white',
            boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
            border: '1px solid #eaeef2'
          }}
        >
          {/* Logo and Title */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                display: 'inline-flex',
                p: 2,
                borderRadius: '12px',
                backgroundColor: '#f0f4f8',
                color: '#1a3e60',
                mb: 2.5
              }}
            >
              <WarehouseIcon sx={{ fontSize: 40 }} />
            </Box>
            
            <Typography 
              variant="h4" 
              gutterBottom 
              fontWeight="700"
              sx={{
                color: '#1a3e60',
                letterSpacing: '-0.5px',
                fontSize: { xs: '1.8rem', sm: '2.2rem' }
              }}
            >
              3D Bin Packing
            </Typography>
            
            <Typography 
              variant="body1" 
              sx={{ 
                color: '#5f6b7a',
                fontWeight: 400,
                fontSize: '1rem'
              }}
            >
              Logistics Optimization Platform
            </Typography>
          </Box>

          {/* Error Alert */}
          {showError && (
            <Alert 
              severity="error" 
              onClose={handleCloseError}
              sx={{ 
                mb: 3, 
                borderRadius: 1.5,
                backgroundColor: '#fee9e7',
                color: '#b33e3e',
                border: '1px solid #ffccc7',
                '& .MuiAlert-icon': { color: '#b33e3e' }
              }}
            >
              {errorMessage}
            </Alert>
          )}
          
          {/* Login Form */}
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              error={!!formErrors.username}
              helperText={formErrors.username}
              sx={{ 
                mb: 2.5,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#fafbfc',
                  '& fieldset': {
                    borderColor: '#e0e6ec',
                  },
                  '&:hover fieldset': {
                    borderColor: '#1a3e60',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#1a3e60',
                    borderWidth: '1px'
                  }
                },
                '& .MuiInputLabel-root': {
                  color: '#5f6b7a',
                  '&.Mui-focused': {
                    color: '#1a3e60'
                  }
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutlined sx={{ color: '#8f9ba8', fontSize: 22 }} />
                  </InputAdornment>
                )
              }}
              variant="outlined"
              size="medium"
            />
            
            <TextField
              fullWidth
              label="Password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              error={!!formErrors.password}
              helperText={formErrors.password}
              sx={{ 
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#fafbfc',
                  '& fieldset': {
                    borderColor: '#e0e6ec',
                  },
                  '&:hover fieldset': {
                    borderColor: '#1a3e60',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#1a3e60',
                    borderWidth: '1px'
                  }
                },
                '& .MuiInputLabel-root': {
                  color: '#5f6b7a',
                  '&.Mui-focused': {
                    color: '#1a3e60'
                  }
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined sx={{ color: '#8f9ba8', fontSize: 22 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      sx={{ color: '#8f9ba8' }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              size="large"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
              sx={{
                py: 1.5,
                backgroundColor: '#1a3e60',
                color: 'white',
                fontSize: '1rem',
                fontWeight: 600,
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': {
                  backgroundColor: '#14324e',
                  boxShadow: 'none'
                },
                '&:disabled': {
                  backgroundColor: '#e0e6ec',
                  color: '#8f9ba8'
                }
              }}
            >
              {loading ? 'Signing in...' : 'Sign in to Dashboard'}
            </Button>
          </form>

          <Divider sx={{ 
            my: 4,
            color: '#e0e6ec'
          }} />
          
      

          {/* Footer */}
          <Typography 
            variant="caption" 
            sx={{ 
              display: 'block', 
              textAlign: 'center', 
              mt: 3,
              color: '#a0aab5',
              fontSize: '0.7rem',
              fontWeight: 400
            }}
          >
            © 2024 3D Bin Packing. All rights reserved.
          </Typography>
        </Paper>
      </Fade>
    </Box>
  );
};

export default LoginPage;
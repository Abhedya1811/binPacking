import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Avatar,
  Button,
  TextField,
  Divider,
  Chip,
  IconButton,
  Alert,
  Snackbar,
  InputAdornment,
  Paper,
  Grid
} from '@mui/material';
import {
  AdminPanelSettings as AdminIcon,
  Close as CloseIcon,
  Lock as LockIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Visibility,
  VisibilityOff,
  VpnKey as KeyIcon,
  Badge as BadgeIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const AdminProfile = ({ open, onClose }) => {
  const { user, changePassword } = useAuth();
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [errors, setErrors] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = async () => {
    // Validate
    const newErrors = {};
    
    if (!passwordData.current_password) {
      newErrors.current = 'Current password required';
    }
    
    if (!passwordData.new_password) {
      newErrors.new = 'New password required';
    } else if (passwordData.new_password.length < 8) {
      newErrors.new = 'Password must be at least 8 characters';
    }
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      newErrors.confirm = 'Passwords do not match';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setLoading(true);
    const result = await changePassword(passwordData.current_password, passwordData.new_password);
    setLoading(false);
    
    if (result.success) {
      setSnackbar({
        open: true,
        message: 'Password changed successfully!',
        severity: 'success'
      });
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      setErrors({});
    } else {
      setSnackbar({
        open: true,
        message: result.error,
        severity: 'error'
      });
    }
  };

  const handleClose = () => {
    setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    setErrors({});
    onClose();
  };

  if (!user) return null;

  return (
    <>
      <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
          py: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
              <AdminIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight="700">
                Admin Profile
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Super Administrator Account
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Grid container spacing={3}>
            {/* Profile Info */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                <Typography variant="subtitle2" fontWeight="600" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BadgeIcon fontSize="small" color="primary" />
                  Account Information
                </Typography>
                
                <Divider sx={{ my: 2 }} />
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.light', width: 56, height: 56 }}>
                      {user.full_name?.charAt(0) || 'A'}
                    </Avatar>
                    <Box>
                      <Typography variant="body1" fontWeight="600">
                        {user.full_name || 'System Administrator'}
                      </Typography>
                      <Chip 
                        label="Super Admin"
                        size="small"
                        color="primary"
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                  </Box>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={1}>
                      <PersonIcon fontSize="inherit" />
                      Username
                    </Typography>
                    <Typography variant="body2" fontWeight="500">
                      {user.username}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={1}>
                      <EmailIcon fontSize="inherit" />
                      Email
                    </Typography>
                    <Typography variant="body2" fontWeight="500">
                      {user.email || 'admin@binpacking.com'}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={1}>
                      <SecurityIcon fontSize="inherit" />
                      User ID
                    </Typography>
                    <Typography variant="body2" fontWeight="500">
                      {user.id || 'admin_001'}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
            
            {/* Password Change */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                <Typography variant="subtitle2" fontWeight="600" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <KeyIcon fontSize="small" color="primary" />
                  Change Password
                </Typography>
                
                <Divider sx={{ my: 2 }} />
                
                <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                  Password changes are temporary until server restart
                </Alert>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    fullWidth
                    label="Current Password"
                    type={showPassword.current ? 'text' : 'password'}
                    value={passwordData.current_password}
                    onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                    error={!!errors.current}
                    helperText={errors.current}
                    size="small"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton 
                            size="small"
                            onClick={() => setShowPassword({ ...showPassword, current: !showPassword.current })}
                          >
                            {showPassword.current ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                  />
                  
                  <TextField
                    fullWidth
                    label="New Password"
                    type={showPassword.new ? 'text' : 'password'}
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                    error={!!errors.new}
                    helperText={errors.new || 'Minimum 8 characters'}
                    size="small"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton 
                            size="small"
                            onClick={() => setShowPassword({ ...showPassword, new: !showPassword.new })}
                          >
                            {showPassword.new ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                  />
                  
                  <TextField
                    fullWidth
                    label="Confirm New Password"
                    type={showPassword.confirm ? 'text' : 'password'}
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                    error={!!errors.confirm}
                    helperText={errors.confirm}
                    size="small"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton 
                            size="small"
                            onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}
                          >
                            {showPassword.confirm ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                  />
                  
                  <Button
                    variant="contained"
                    onClick={handlePasswordChange}
                    disabled={loading}
                    sx={{ mt: 2 }}
                  >
                    {loading ? 'Updating...' : 'Update Password'}
                  </Button>
                </Box>
              </Paper>
            </Grid>
            
            {/* System Info */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2, borderRadius: 3, bgcolor: '#f8fafc' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Authentication System
                  </Typography>
                  <Chip 
                    label="Static Admin - No Database"
                    size="small"
                    variant="outlined"
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    JWT Auth • HS256 • 8h Expiry
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Rate Limit: 5/min • Lockout: 30-300s
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={handleClose} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default AdminProfile;
import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  Chip,
  Tooltip
} from '@mui/material';
import {
  Menu as MenuIcon,
  AdminPanelSettings as AdminIcon,
  Logout as LogoutIcon,
  VpnKey as KeyIcon,
  AccountCircle as ProfileIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Header = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleClose();
  };

  const handleProfile = () => {
    // Scroll to profile or open modal
    handleClose();
  };

  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 2, display: { sm: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            component="img"
            src="/logo192.png"
            alt="Logo"
            sx={{ height: 32, width: 32, display: { xs: 'none', sm: 'block' } }}
          />
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
            3D Bin Packing
          </Typography>
          <Chip 
            label="Admin" 
            size="small" 
            sx={{ 
              ml: 1, 
              bgcolor: 'rgba(255,255,255,0.2)',
              color: 'white',
              fontWeight: 500,
              display: { xs: 'none', sm: 'flex' }
            }} 
          />
        </Box>
        
        <Box sx={{ flexGrow: 1 }} />
        
        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {user.full_name || 'Admin'}
            </Typography>
            
            <Tooltip title="Account settings">
              <IconButton
                onClick={handleMenu}
                size="small"
                sx={{ ml: 2 }}
                aria-controls={open ? 'account-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
              >
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                  <AdminIcon fontSize="small" />
                </Avatar>
              </IconButton>
            </Tooltip>
            
            <Menu
              anchorEl={anchorEl}
              id="account-menu"
              open={open}
              onClose={handleClose}
              onClick={handleClose}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <MenuItem disabled>
                <ListItemIcon>
                  <ProfileIcon fontSize="small" />
                </ListItemIcon>
                {user.username}
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleProfile}>
                <ListItemIcon>
                  <KeyIcon fontSize="small" />
                </ListItemIcon>
                Change Password
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Header;
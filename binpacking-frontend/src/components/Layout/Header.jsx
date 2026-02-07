import React from 'react';
import { Container, Box, Typography, Chip } from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import './Header.css';

const Header = () => {
  return (
    <header className="header">
      <Container maxWidth="xl">
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            <LocalShippingIcon sx={{ fontSize: 40, color: '#1976d2' }} />
            <Box>
              <Typography variant="h4" fontWeight="bold" className="header-title">
                Container Packing System
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                3D & 2D Bin Packing Optimization
              </Typography>
            </Box>
          </Box>
          
          <Box display="flex" gap={1}>
            <Chip label="3D" color="primary" variant="outlined" />
            <Chip label="2D" color="secondary" variant="outlined" />
            <Chip label="Container" color="success" variant="outlined" />
          </Box>
        </Box>
      </Container>
    </header>
  );
};

export default Header;
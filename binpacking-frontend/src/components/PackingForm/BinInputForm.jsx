import React, { useState } from 'react';
import {
  Box,
  TextField,
  Grid,
  Paper,
  Typography,
  Button,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip
} from '@mui/material';
import {
  Height as HeightIcon,
 AspectRatio as WidthIcon,
  Straighten as DepthIcon,
  Category as CategoryIcon
} from '@mui/icons-material';
import './BinInputForm.css';

const BinInputForm = ({ containerSize, onContainerChange, onContainerTypeChange }) => {
  const [containerType, setContainerType] = useState('custom');
  
  const containerPresets = {
    '20ft': { width: 5.9, height: 2.39, depth: 2.38 },
    '40ft': { width: 12.03, height: 2.39, depth: 2.38 },
    '40ftHC': { width: 12.03, height: 2.69, depth: 2.38 },
    'pallet': { width: 1.2, height: 1.5, depth: 1.0 },
    'custom': containerSize
  };

  const handlePresetChange = (preset) => {
    setContainerType(preset);
    if (preset !== 'custom') {
      onContainerChange(containerPresets[preset]);
    }
  };

  const handleDimensionChange = (dimension, value) => {
    const newSize = { ...containerSize, [dimension]: parseFloat(value) || 0 };
    onContainerChange(newSize);
    if (containerType !== 'custom') setContainerType('custom');
  };

  return (
    <Paper className="bin-input-form" elevation={2}>
      <Box className="form-header">
        <CategoryIcon />
        <Typography variant="h6">Container Configuration</Typography>
      </Box>
      
      <Box className="preset-section">
        <Typography variant="subtitle2" gutterBottom>Container Type</Typography>
        <Box className="preset-chips">
          {Object.keys(containerPresets).map(preset => (
            <Chip
              key={preset}
              label={preset}
              onClick={() => handlePresetChange(preset)}
              variant={containerType === preset ? 'filled' : 'outlined'}
              color={containerType === preset ? 'primary' : 'default'}
              size="small"
            />
          ))}
        </Box>
      </Box>
      
      <Grid container spacing={3} className="dimensions-section">
        <Grid item xs={12} md={4}>
          <Box className="dimension-input">
            <WidthIcon className="dimension-icon" />
            <TextField
              fullWidth
              label="Width (m)"
              type="number"
              value={containerSize.width}
              onChange={(e) => handleDimensionChange('width', e.target.value)}
              InputProps={{ inputProps: { min: 0.1, max: 50, step: 0.1 } }}
              variant="outlined"
              size="small"
            />
            <Slider
              value={containerSize.width}
              onChange={(e, value) => handleDimensionChange('width', value)}
              min={0.1}
              max={20}
              step={0.1}
              valueLabelDisplay="auto"
              className="dimension-slider"
            />
          </Box>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Box className="dimension-input">
            <HeightIcon className="dimension-icon" />
            <TextField
              fullWidth
              label="Height (m)"
              type="number"
              value={containerSize.height}
              onChange={(e) => handleDimensionChange('height', e.target.value)}
              InputProps={{ inputProps: { min: 0.1, max: 20, step: 0.1 } }}
              variant="outlined"
              size="small"
            />
            <Slider
              value={containerSize.height}
              onChange={(e, value) => handleDimensionChange('height', value)}
              min={0.1}
              max={10}
              step={0.1}
              valueLabelDisplay="auto"
              className="dimension-slider"
            />
          </Box>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Box className="dimension-input">
            <DepthIcon className="dimension-icon" />
            <TextField
              fullWidth
              label="Depth/Length (m)"
              type="number"
              value={containerSize.depth}
              onChange={(e) => handleDimensionChange('depth', e.target.value)}
              InputProps={{ inputProps: { min: 0.1, max: 50, step: 0.1 } }}
              variant="outlined"
              size="small"
            />
            <Slider
              value={containerSize.depth}
              onChange={(e, value) => handleDimensionChange('depth', value)}
              min={0.1}
              max={20}
              step={0.1}
              valueLabelDisplay="auto"
              className="dimension-slider"
            />
          </Box>
        </Grid>
      </Grid>
      
      {/* Advanced Options */}
      <Box className="advanced-options">
        <Typography variant="subtitle2" gutterBottom>Advanced Options</Typography>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Packing Algorithm</InputLabel>
              <Select
                defaultValue="maximal-rectangles"
                label="Packing Algorithm"
                onChange={(e) => onContainerTypeChange('algorithm', e.target.value)}
              >
                <MenuItem value="maximal-rectangles">Maximal Rectangles (3D)</MenuItem>
                <MenuItem value="guillotine">Guillotine Cut (2D)</MenuItem>
                <MenuItem value="skyline">Skyline Algorithm</MenuItem>
                <MenuItem value="genetic">Genetic Algorithm</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Rotation Allowed</InputLabel>
              <Select
                defaultValue="all"
                label="Rotation Allowed"
                onChange={(e) => onContainerTypeChange('rotation', e.target.value)}
              >
                <MenuItem value="all">All rotations</MenuItem>
                <MenuItem value="height-only">Height only</MenuItem>
                <MenuItem value="none">No rotation</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>
      
      {/* Volume Display */}
      <Box className="volume-display">
        <Typography variant="body2">Container Volume:</Typography>
        <Typography variant="h5">
          {(containerSize.width * containerSize.height * containerSize.depth).toFixed(2)} m³
        </Typography>
      </Box>
    </Paper>
  );
};

export default BinInputForm;
import React, { useState, useEffect } from 'react';
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
  Chip,
  InputAdornment,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormGroup,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import {
  Height as HeightIcon,
  AspectRatio as WidthIcon,
  Straighten as DepthIcon,
  Category as CategoryIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import './BinInputForm.css';

// All container dimensions from the specification (in meters)
const CONTAINER_PRESETS = {
  // 20' Containers
  '20ft GP Wooden': { width: 2.352, height: 2.393, depth: 5.900, type: '20ft Standard', description: '20\' General Purpose - Wooden Floor' },
  '20ft GP Steel': { width: 2.352, height: 2.393, depth: 5.900, type: '20ft Standard', description: '20\' General Purpose - Steel Floor' },
  '20ft Hardtop': { width: 2.350, height: 2.384, depth: 5.895, type: '20ft Hardtop', description: '20\' Hardtop Container - Wooden Floor' },
  '20ft Open Top Wooden': { width: 2.350, height: 2.380, depth: 5.895, type: '20ft Open Top', description: '20\' Open Top - Wooden Floor' },
  '20ft Open Top Steel': { width: 2.352, height: 2.378, depth: 5.895, type: '20ft Open Top', description: '20\' Open Top - Steel Floor' },
  
  // 40' Standard Height (8'6")
  '40ft GP Wooden': { width: 2.352, height: 2.395, depth: 12.032, type: '40ft Standard', description: '40\' General Purpose - Wooden Floor' },
  '40ft Hardtop': { width: 2.342, height: 2.388, depth: 12.020, type: '40ft Hardtop', description: '40\' Hardtop Container - Wooden Floor' },
  '40ft Open Top Wooden': { width: 2.350, height: 2.377, depth: 12.030, type: '40ft Open Top', description: '40\' Open Top - Wooden Floor' },
  '40ft Open Top Steel': { width: 2.350, height: 2.380, depth: 12.029, type: '40ft Open Top', description: '40\' Open Top - Steel Floor' },
  
  // 40' High Cube (9'6")
  '40ft HC GP Wooden': { width: 2.432, height: 2.700, depth: 12.032, type: '40ft High Cube', description: '40\' High Cube GP - Wooden Floor' },
  '40ft HC GP Steel': { width: 2.352, height: 2.700, depth: 12.032, type: '40ft High Cube', description: '40\' High Cube GP - Steel Floor' },
  '40ft HC Hardtop Wooden': { width: 2.352, height: 2.695, depth: 12.032, type: '40ft High Cube Hardtop', description: '40\' High Cube Hardtop - Wooden Floor' },
  '40ft HC Hardtop Steel': { width: 2.350, height: 2.693, depth: 12.029, type: '40ft High Cube Hardtop', description: '40\' High Cube Hardtop - Steel Floor' },
  '40ft HC Open Top Steel': { width: 2.352, height: 2.683, depth: 12.029, type: '40ft High Cube Open Top', description: '40\' High Cube Open Top - Steel Floor' },
  
  // 45' High Cube (9'6")
  '45ft HC GP Wooden': { width: 2.352, height: 2.700, depth: 13.556, type: '45ft High Cube', description: '45\' High Cube GP - Wooden Floor' },
  
  // Refrigerated Containers
  '20ft Reefer': { width: 2.284, height: 2.267, depth: 5.450, type: '20ft Reefer', description: '20\' Refrigerated Container' },
  '40ft HC Reefer': { width: 2.280, height: 2.525, depth: 11.578, type: '40ft High Cube Reefer', description: '40\' High Cube Refrigerated' },
  '40ft HC Reefer CA': { width: 2.290, height: 2.540, depth: 11.590, type: '40ft High Cube Reefer CA', description: '40\' High Cube Reefer - Controlled Atmosphere' },
  
  // Flatracks & Platforms
  '20ft Flatrack': { width: 2.220, height: null, depth: 5.835, type: '20ft Flatrack', description: '20\' Flatrack (no sides/roof)', isOpen: true },
  '40ft HC Flatrack': { width: 2.224, height: null, depth: 11.652, type: '40ft High Cube Flatrack', description: '40\' High Cube Flatrack', isOpen: true },
  '20ft Platform': { width: 2.438, height: 0.370, depth: 6.058, type: '20ft Platform', description: '20\' Platform (Collapsed Flatrack)' },
  '40ft Platform': { width: 2.245, height: 0.648, depth: 12.192, type: '40ft Platform', description: '40\' Platform (Collapsed Flatrack)' }
};

const UNIT_CONVERSIONS = {
  meters: 1,
  cm: 0.01,
  feet: 0.3048,
  inches: 0.0254
};

const UNIT_DISPLAY = {
  meters: 'm',
  cm: 'cm',
  feet: 'ft',
  inches: 'in'
};

const BinInputForm = ({ containerSize, onContainerChange, onContainerTypeChange }) => {
  const [containerType, setContainerType] = useState('custom');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [unit, setUnit] = useState('meters');
  const [displayDimensions, setDisplayDimensions] = useState({
    width: Number(containerSize.width.toFixed(3)),
    height: Number(containerSize.height.toFixed(3)),
    depth: Number(containerSize.depth.toFixed(3))
  });

  // Update display dimensions when container size changes
  useEffect(() => {
    const factor = UNIT_CONVERSIONS[unit];
    setDisplayDimensions({
      width: Number((containerSize.width / factor).toFixed(3)),
      height: Number((containerSize.height / factor).toFixed(3)),
      depth: Number((containerSize.depth / factor).toFixed(3))
    });
  }, [containerSize, unit]);

  const handlePresetChange = (preset) => {
    setContainerType(preset);
    if (preset !== 'custom') {
      const presetData = CONTAINER_PRESETS[preset];
      const newSize = {
        width: presetData.width,
        height: presetData.height || 2.0,
        depth: presetData.depth
      };
      onContainerChange(newSize);
    }
  };

  const handleDimensionChange = (dimension, value) => {
    // Allow empty value temporarily
    if (value === '') {
      const newDisplayDimensions = { ...displayDimensions, [dimension]: '' };
      setDisplayDimensions(newDisplayDimensions);
      return;
    }

    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) return;

    // Convert from current unit to meters
    const meterValue = numericValue * UNIT_CONVERSIONS[unit];
    const newSize = { ...containerSize, [dimension]: meterValue };
    onContainerChange(newSize);
    if (containerType !== 'custom') setContainerType('custom');
  };

  const handleDimensionBlur = (dimension, value) => {
    // Format the value on blur to 3 decimals
    if (value === '') {
      const formattedValue = (containerSize[dimension] / UNIT_CONVERSIONS[unit]).toFixed(3);
      setDisplayDimensions(prev => ({
        ...prev,
        [dimension]: Number(formattedValue)
      }));
    } else {
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        const formattedValue = numericValue.toFixed(3);
        setDisplayDimensions(prev => ({
          ...prev,
          [dimension]: Number(formattedValue)
        }));
      }
    }
  };

  const handleUnitChange = (newUnit) => {
    // Convert current display values to new unit
    const oldFactor = UNIT_CONVERSIONS[unit];
    const newFactor = UNIT_CONVERSIONS[newUnit];
    
    // Convert from meters to new unit
    setDisplayDimensions({
      width: Number((containerSize.width / newFactor).toFixed(3)),
      height: Number((containerSize.height / newFactor).toFixed(3)),
      depth: Number((containerSize.depth / newFactor).toFixed(3))
    });
    
    setUnit(newUnit);
  };

  const categories = [
    { value: 'all', label: 'All Containers' },
    { value: '20ft', label: '20\' Containers' },
    { value: '40ft', label: '40\' Standard' },
    { value: '40ftHC', label: '40\' High Cube' },
    { value: '45ft', label: '45\' Containers' },
    { value: 'reefer', label: 'Refrigerated' },
    { value: 'flatrack', label: 'Flatracks & Platforms' }
  ];

  const filteredPresets = Object.entries(CONTAINER_PRESETS).filter(([key, value]) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === '20ft' && key.includes('20ft')) return true;
    if (selectedCategory === '40ft' && key.includes('40ft') && !key.includes('HC')) return true;
    if (selectedCategory === '40ftHC' && key.includes('40ft HC')) return true;
    if (selectedCategory === '45ft' && key.includes('45ft')) return true;
    if (selectedCategory === 'reefer' && key.includes('Reefer')) return true;
    if (selectedCategory === 'flatrack' && (key.includes('Flatrack') || key.includes('Platform'))) return true;
    return false;
  });

  // Calculate volume in cubic meters
  const volumeM3 = containerSize.width * containerSize.height * containerSize.depth;
  
  // Convert volume to cubic feet (1 m³ = 35.315 ft³)
  const volumeFt3 = volumeM3 * 35.315;

  return (
    <Paper className="bin-input-form" elevation={2} sx={{ p: 2 }}>
      <Box className="form-header" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <CategoryIcon color="primary" />
        <Typography variant="h6">Container Configuration</Typography>
      </Box>
      
      {/* Unit Selection */}
      <Box className="unit-section" sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Display Units</Typography>
        <Box className="unit-buttons" sx={{ display: 'flex', gap: 0.5 }}>
          {Object.keys(UNIT_CONVERSIONS).map(unitType => (
            <Chip
              key={unitType}
              label={UNIT_DISPLAY[unitType]}
              onClick={() => handleUnitChange(unitType)}
              variant={unit === unitType ? 'filled' : 'outlined'}
              color={unit === unitType ? 'primary' : 'default'}
              size="small"
              sx={{ minWidth: 45 }}
            />
          ))}
        </Box>
      </Box>
      
      {/* Category Filter */}
      <Box className="category-section" sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Filter by Type</Typography>
        <FormControl fullWidth size="small">
          <Select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            displayEmpty
          >
            {categories.map(cat => (
              <MenuItem key={cat.value} value={cat.value}>{cat.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      
      {/* Container Presets */}
      <Accordion defaultExpanded sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">Container Presets</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box className="preset-section">
            <Box className="preset-chips" sx={{ maxHeight: '200px', overflowY: 'auto' }}>
              <Chip
                label="Custom"
                onClick={() => handlePresetChange('custom')}
                variant={containerType === 'custom' ? 'filled' : 'outlined'}
                color={containerType === 'custom' ? 'primary' : 'default'}
                size="small"
                sx={{ m: 0.5 }}
              />
              {filteredPresets.map(([key, value]) => (
                <Chip
                  key={key}
                  label={key}
                  onClick={() => handlePresetChange(key)}
                  variant={containerType === key ? 'filled' : 'outlined'}
                  color={containerType === key ? 'primary' : 'default'}
                  size="small"
                  title={value.description}
                  sx={{ m: 0.5 }}
                />
              ))}
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>
      
      {/* Dimensions Section */}
      <Grid container spacing={2} className="dimensions-section" sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <Box className="dimension-input">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <WidthIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              <Typography variant="body2" fontWeight="500">Width</Typography>
              <Typography variant="caption" color="textSecondary" sx={{ ml: 'auto' }}>
                ({UNIT_DISPLAY[unit]})
              </Typography>
            </Box>
            <TextField
              fullWidth
              type="number"
              value={displayDimensions.width}
              onChange={(e) => handleDimensionChange('width', e.target.value)}
              onBlur={(e) => handleDimensionBlur('width', e.target.value)}
              InputProps={{
                inputProps: { 
                  min: 0.001, 
                  max: 50, 
                  step: unit === 'meters' ? 0.001 : unit === 'cm' ? 0.1 : 0.001,
                  style: { textAlign: 'right' }
                },
                endAdornment: <InputAdornment position="end">{UNIT_DISPLAY[unit]}</InputAdornment>
              }}
              variant="outlined"
              size="small"
            />
            <Box sx={{ px: 1, mt: 1 }}>
              <Slider
                value={containerSize.width}
                onChange={(e, value) => {
                  const newValue = value;
                  onContainerChange({ ...containerSize, width: newValue });
                }}
                min={0.001}
                max={unit === 'meters' ? 5 : unit === 'cm' ? 500 : 16}
                step={0.001}
                size="small"
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => 
                  `${(value / UNIT_CONVERSIONS[unit]).toFixed(3)} ${UNIT_DISPLAY[unit]}`
                }
              />
            </Box>
          </Box>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Box className="dimension-input">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <HeightIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              <Typography variant="body2" fontWeight="500">Height</Typography>
              <Typography variant="caption" color="textSecondary" sx={{ ml: 'auto' }}>
                ({UNIT_DISPLAY[unit]})
              </Typography>
            </Box>
            <TextField
              fullWidth
              type="number"
              value={displayDimensions.height}
              onChange={(e) => handleDimensionChange('height', e.target.value)}
              onBlur={(e) => handleDimensionBlur('height', e.target.value)}
              InputProps={{
                inputProps: { 
                  min: 0.001, 
                  max: 20, 
                  step: unit === 'meters' ? 0.001 : unit === 'cm' ? 0.1 : 0.001,
                  style: { textAlign: 'right' }
                },
                endAdornment: <InputAdornment position="end">{UNIT_DISPLAY[unit]}</InputAdornment>
              }}
              variant="outlined"
              size="small"
            />
            <Box sx={{ px: 1, mt: 1 }}>
              <Slider
                value={containerSize.height}
                onChange={(e, value) => {
                  const newValue = value;
                  onContainerChange({ ...containerSize, height: newValue });
                }}
                min={0.001}
                max={unit === 'meters' ? 5 : unit === 'cm' ? 500 : 16}
                step={0.001}
                size="small"
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => 
                  `${(value / UNIT_CONVERSIONS[unit]).toFixed(3)} ${UNIT_DISPLAY[unit]}`
                }
              />
            </Box>
          </Box>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Box className="dimension-input">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <DepthIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              <Typography variant="body2" fontWeight="500">Length</Typography>
              <Typography variant="caption" color="textSecondary" sx={{ ml: 'auto' }}>
                ({UNIT_DISPLAY[unit]})
              </Typography>
            </Box>
            <TextField
              fullWidth
              type="number"
              value={displayDimensions.depth}
              onChange={(e) => handleDimensionChange('depth', e.target.value)}
              onBlur={(e) => handleDimensionBlur('depth', e.target.value)}
              InputProps={{
                inputProps: { 
                  min: 0.001, 
                  max: 50, 
                  step: unit === 'meters' ? 0.001 : unit === 'cm' ? 0.1 : 0.001,
                  style: { textAlign: 'right' }
                },
                endAdornment: <InputAdornment position="end">{UNIT_DISPLAY[unit]}</InputAdornment>
              }}
              variant="outlined"
              size="small"
            />
            <Box sx={{ px: 1, mt: 1 }}>
              <Slider
                value={containerSize.depth}
                onChange={(e, value) => {
                  const newValue = value;
                  onContainerChange({ ...containerSize, depth: newValue });
                }}
                min={0.001}
                max={unit === 'meters' ? 20 : unit === 'cm' ? 2000 : 65}
                step={0.001}
                size="small"
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => 
                  `${(value / UNIT_CONVERSIONS[unit]).toFixed(3)} ${UNIT_DISPLAY[unit]}`
                }
              />
            </Box>
          </Box>
        </Grid>
      </Grid>
      
      {/* Volume Display */}
      <Box sx={{ 
        mb: 2, 
        p: 1.5, 
        bgcolor: 'primary.light', 
        color: 'primary.contrastText',
        borderRadius: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Typography variant="body2">Container Volume:</Typography>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="h6">
            {volumeM3.toFixed(3)} m³
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            {volumeFt3.toFixed(1)} ft³
          </Typography>
        </Box>
      </Box>
      
      {/* Advanced Options */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">Advanced Options</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Packing Algorithm</InputLabel>
                <Select
                  defaultValue="maximal"
                  label="Packing Algorithm"
                  onChange={(e) => onContainerTypeChange('algorithm', e.target.value)}
                >
                  <MenuItem value="maximal">Maximal (Best fill)</MenuItem>
                  <MenuItem value="medium">Medium (Balanced)</MenuItem>
                  <MenuItem value="small">Small (Faster)</MenuItem>               
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
            <Grid item xs={12}>
              <FormGroup>
                <FormControlLabel 
                  control={<Checkbox size="small" />} 
                  label="Allow overhang (if supported)" 
                />
                <FormControlLabel 
                  control={<Checkbox size="small" />} 
                  label="Consider weight distribution" 
                />
              </FormGroup>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
};

export default BinInputForm;
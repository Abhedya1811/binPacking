import React, { useState } from 'react';
import {
  Box,
  Button,
  Grid,
  Paper,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Chip,
  Switch,
  FormControlLabel,
  Slider,
  Divider
} from '@mui/material';
import {
  Calculate as CalculateIcon,
  Refresh as ResetIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Speed as SpeedIcon,
  SwapHoriz as RotateIcon,
  Sort as SortIcon
} from '@mui/icons-material';
import './PackingControls.css';
import { PackingService } from '../../services/packingService';

const PackingControls = ({
  onCalculate,
  onReset,
  onSave,
  onExport,
  loading = false,
  disabled = false,
  options = {},
  onOptionsChange
}) => {
  const [expanded, setExpanded] = useState(false);

  const handleOptionChange = (key, value) => {
    if (onOptionsChange) {
      onOptionsChange(key, value);
    }
  };
      // In your App.jsx or component
      const testBackend = async () => {
        try {
          const result = await PackingService.testBackend();
          console.log('✅ Backend test successful:', result);
          alert('Backend connection successful!');
        } catch (error) {
          console.error('❌ Backend test failed:', error);
          alert(`Backend error: ${error.message}`);
        }
      };

  const defaultOptions = {
    algorithm: 'maximal-rectangles',
    rotation: 'all',
    sorting: 'volume-desc',
    allowOverhang: false,
    considerWeight: false,
    considerFragile: true,
    timeLimit: 5,
    ...options
  };

  return (
    <Paper className="packing-controls" elevation={2}>
      <Box className="controls-header">
        <Box display="flex" alignItems="center" gap={1}>
          <CalculateIcon />
          <Typography variant="h6">Packing Controls</Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Tooltip title="Advanced Settings">
            <IconButton 
              size="small" 
              onClick={() => setExpanded(!expanded)}
              className={expanded ? 'expanded' : ''}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Divider />

      {/* Main Controls */}
      <Box className="main-controls">
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              startIcon={<CalculateIcon />}
              onClick={onCalculate}
              disabled={disabled || loading}
              className="calculate-btn"
            >
              {loading ? 'Calculating...' : 'Calculate Packing'}
            </Button>
          </Grid>
          
          <Grid item xs={6} md={4}>
            <Button
              fullWidth
              variant="outlined"
              color="secondary"
              startIcon={<ResetIcon />}
              onClick={onReset}
              disabled={loading}
            >
              Reset All
            </Button>
          </Grid>
          
          <Grid item xs={6} md={4}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={onSave}
              disabled={loading || disabled}
            >
              Save Configuration
            </Button>
          </Grid>
        </Grid>
      </Box>

      {expanded && (
        <>
          <Divider />
          <Box className="advanced-controls">
            <Typography variant="subtitle2" gutterBottom className="section-title">
              <SettingsIcon fontSize="small" /> Advanced Packing Options
            </Typography>
            
            <Grid container spacing={3}>
              {/* Algorithm Selection */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <SpeedIcon fontSize="small" /> Algorithm
                    </Box>
                  </InputLabel>
                  <Select
                    value={defaultOptions.algorithm}
                    label="Algorithm"
                    onChange={(e) => handleOptionChange('algorithm', e.target.value)}
                  >
                    <MenuItem value="maximal-rectangles">
                      Maximal Rectangles (3D)
                    </MenuItem>
                    <MenuItem value="guillotine">
                      Guillotine Cut (2D/3D)
                    </MenuItem>
                    <MenuItem value="skyline">
                      Skyline Algorithm
                    </MenuItem>
                    <MenuItem value="genetic">
                      Genetic Algorithm
                    </MenuItem>
                    <MenuItem value="first-fit">
                      First Fit Decreasing
                    </MenuItem>
                    <MenuItem value="best-fit">
                      Best Fit Decreasing
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
             
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <RotateIcon fontSize="small" /> Item Rotation
                    </Box>
                  </InputLabel>
                  <Select
                    value={defaultOptions.rotation}
                    label="Item Rotation"
                    onChange={(e) => handleOptionChange('rotation', e.target.value)}
                  >
                    <MenuItem value="all">All rotations allowed</MenuItem>
                    <MenuItem value="height-only">Height fixed (pallet mode)</MenuItem>
                    <MenuItem value="none">No rotation</MenuItem>
                    <MenuItem value="x-only">X-axis only</MenuItem>
                    <MenuItem value="y-only">Y-axis only</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Sorting Options */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <SortIcon fontSize="small" /> Sorting Order
                    </Box>
                  </InputLabel>
                  <Select
                    value={defaultOptions.sorting}
                    label="Sorting Order"
                    onChange={(e) => handleOptionChange('sorting', e.target.value)}
                  >
                    <MenuItem value="volume-desc">Volume (largest first)</MenuItem>
                    <MenuItem value="volume-asc">Volume (smallest first)</MenuItem>
                    <MenuItem value="height-desc">Height (tallest first)</MenuItem>
                    <MenuItem value="width-desc">Width (widest first)</MenuItem>
                    <MenuItem value="depth-desc">Depth (deepest first)</MenuItem>
                    <MenuItem value="weight-desc">Weight (heaviest first)</MenuItem>
                    <MenuItem value="area-desc">Surface Area</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Time Limit */}
              <Grid item xs={12} md={6}>
                <Box className="slider-control">
                  <Typography variant="body2" gutterBottom>
                    Time Limit: {defaultOptions.timeLimit}s
                  </Typography>
                  <Slider
                    value={defaultOptions.timeLimit}
                    onChange={(e, value) => handleOptionChange('timeLimit', value)}
                    min={1}
                    max={30}
                    step={1}
                    valueLabelDisplay="auto"
                    marks={[
                      { value: 1, label: '1s' },
                      { value: 15, label: '15s' },
                      { value: 30, label: '30s' }
                    ]}
                  />
                </Box>
              </Grid>

              {/* Toggle Switches */}
              <Grid item xs={12}>
                <Box className="toggle-switches">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={defaultOptions.allowOverhang}
                        onChange={(e) => handleOptionChange('allowOverhang', e.target.checked)}
                        size="small"
                      />
                    }
                    label="Allow Overhang"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={defaultOptions.considerWeight}
                        onChange={(e) => handleOptionChange('considerWeight', e.target.checked)}
                        size="small"
                      />
                    }
                    label="Consider Weight Distribution"
                  />
                  <button onClick={testBackend}>
                    Test Backend Connection
                  </button>
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={defaultOptions.considerFragile}
                        onChange={(e) => handleOptionChange('considerFragile', e.target.checked)}
                        size="small"
                      />
                    }
                    label="Handle Fragile Items Carefully"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={defaultOptions.allowFlipping}
                        onChange={(e) => handleOptionChange('allowFlipping', e.target.checked)}
                        size="small"
                      />
                    }
                    label="Allow Item Flipping"
                  />
                </Box>
              </Grid>

              {/* Quick Actions */}
              <Grid item xs={12}>
                <Box className="quick-actions">
                  <Typography variant="subtitle2" gutterBottom>
                    Quick Actions:
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    <Chip
                      label="Optimize for Speed"
                      onClick={() => handleOptionChange('algorithm', 'first-fit')}
                      variant="outlined"
                      size="small"
                    />
                    <Chip
                      label="Optimize for Space"
                      onClick={() => handleOptionChange('algorithm', 'maximal-rectangles')}
                      variant="outlined"
                      size="small"
                    />
                    <Chip
                      label="Pallet Mode"
                      onClick={() => handleOptionChange('rotation', 'height-only')}
                      variant="outlined"
                      size="small"
                    />
                    <Chip
                      label="Heavy Bottom"
                      onClick={() => handleOptionChange('sorting', 'weight-desc')}
                      variant="outlined"
                      size="small"
                    />
                    <Chip
                      label="Export Settings"
                      onClick={onExport}
                      icon={<DownloadIcon />}
                      variant="outlined"
                      size="small"
                    />
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </>
      )}

      {/* Status Indicators */}
      <Divider />
      <Box className="status-indicators">
        <Grid container spacing={1}>
          <Grid item xs={4}>
            <Box className="status-item">
              <Typography variant="caption" color="text.secondary">
                Algorithm:
              </Typography>
              <Chip 
                label={defaultOptions.algorithm} 
                size="small" 
                variant="outlined"
              />
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box className="status-item">
              <Typography variant="caption" color="text.secondary">
                Rotation:
              </Typography>
              <Chip 
                label={defaultOptions.rotation} 
                size="small" 
                variant="outlined"
              />
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box className="status-item">
              <Typography variant="caption" color="text.secondary">
                Time Limit:
              </Typography>
              <Chip 
                label={`${defaultOptions.timeLimit}s`} 
                size="small" 
                variant="outlined"
              />
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
};

export default PackingControls;
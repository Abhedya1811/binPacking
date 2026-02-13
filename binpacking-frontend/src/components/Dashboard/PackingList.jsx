import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  Divider,
  Grid,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Numbers as NumberIcon,
  Layers as LayerIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Print as PrintIcon,
  ZoomIn as ZoomIcon,
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
  Web as HtmlIcon
} from '@mui/icons-material';
import { usePacking } from '../../hooks/usePacking';
import './PackingList.css';

const PackingList = ({ packingResult, onViewItem, onExport }) => {
  const [viewMode, setViewMode] = useState('list');
  const [sortBy, setSortBy] = useState('layer');

  if (!packingResult || !packingResult.packedItems) {
    return (
      <Paper className="packing-list empty">
        <Box className="empty-state">
          <CheckIcon sx={{ fontSize: 60, color: '#ccc' }} />
          <Typography color="text.secondary">
            No packing result yet. Calculate packing to see instructions.
          </Typography>
        </Box>
      </Paper>
    );
  }

  const { packedItems, instructions, efficiency, volumeUsed } = packingResult;

  // Group items by layer
  const layers = {};
  packedItems.forEach(item => {
    const layer = Math.floor(item.y / 2); // Adjust based on your layer height
    if (!layers[layer]) layers[layer] = [];
    layers[layer].push(item);
  });

  // Sort layers
  const sortedLayers = Object.entries(layers)
    .sort(([a], [b]) => a - b)
    .map(([layer, items]) => ({
      layer: parseInt(layer),
      items: items.sort((a, b) => a.x - b.x || a.z - b.z)
    }));

  const handleExport = (format) => {
    if (onExport) onExport(format);
  };

  return (
    <Paper className="packing-list" elevation={2}>
      <Box className="list-header">
        <Box>
          <Typography variant="h6">Packing Instructions</Typography>
          <Typography variant="body2" color="text.secondary">
            {packedItems.length} items packed • {efficiency.toFixed(1)}% efficiency
          </Typography>
        </Box>
        
        <Box className="header-actions">
          <FormControl size="small" sx={{ minWidth: 120, mr: 1 }}>
            <InputLabel>View</InputLabel>
            <Select
              value={viewMode}
              label="View"
              onChange={(e) => setViewMode(e.target.value)}
            >
              <MenuItem value="list">List View</MenuItem>
              <MenuItem value="layers">Layer View</MenuItem>
              <MenuItem value="steps">Step by Step</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      <Divider />

      {/* Statistics Bar */}
      <Box className="stats-bar">
        <Chip icon={<CheckIcon />} label={`${packedItems.length} items packed`} />
        <Chip icon={<LayerIcon />} label={`${sortedLayers.length} layers`} />
        <Chip label={`${volumeUsed.toFixed(2)} m³ used`} color="primary" />
        <Chip label={`${efficiency.toFixed(1)}% efficiency`} color="success" />
      </Box>

      {/* Instructions by Layer */}
      {viewMode === 'layers' ? (
        sortedLayers.map(({ layer, items }) => (
          <Box key={layer} className="layer-section">
            <Typography variant="subtitle1" className="layer-title">
              <LayerIcon sx={{ mr: 1 }} />
              Layer {layer + 1} - {items.length} items
            </Typography>
            <List dense>
              {items.map((item, index) => (
                <ListItem key={index} className="instruction-item">
                  <ListItemIcon>
                    <Box className="item-color" style={{ backgroundColor: item.color }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2">
                          {item.name}
                        </Typography>
                        <Chip label={`(${item.x},${item.y},${item.z})`} size="small" />
                      </Box>
                    }
                    secondary={
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption">
                          Size: {item.width}m × {item.height}m × {item.depth}m
                        </Typography>
                        {item.rotation && (
                          <Chip
                            label={`Rot: ${item.rotation}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    }
                  />
                  <IconButton size="small" onClick={() => onViewItem && onViewItem(item)}>
                    <ZoomIcon />
                  </IconButton>
                </ListItem>
              ))}
            </List>
          </Box>
        ))
      ) : (
        /* List View */
        <List className="instructions-list">
          {instructions && instructions.length > 0 ? (
            instructions.map((instruction, index) => (
              <ListItem key={index} className="instruction-step">
                <ListItemIcon>
                  <NumberIcon>{index + 1}</NumberIcon>
                </ListItemIcon>
                <ListItemText
                  primary={instruction.step}
                  secondary={instruction.description}
                />
                {instruction.item && (
                  <Chip
                    label={instruction.item}
                    size="small"
                    style={{ backgroundColor: instruction.color }}
                  />
                )}
              </ListItem>
            ))
          ) : (
            packedItems.map((item, index) => (
              <ListItem key={index} className="instruction-item">
                <ListItemIcon>
                  <Box className="item-color" style={{ backgroundColor: item.color }} />
                </ListItemIcon>
                <ListItemText
                  primary={`${index + 1}. Place ${item.name}`}
                  secondary={`Position: (${item.x.toFixed(2)}, ${item.y.toFixed(2)}, ${item.z.toFixed(2)}) • Rotation: ${item.rotation || '0,0,0'}`}
                />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => onViewItem && onViewItem(item)}
                >
                  View
                </Button>
              </ListItem>
            ))
          )}
        </List>
      )}

      {/* Export Options - Enhanced */}
      <Box className="export-section">
        <Typography variant="subtitle2" gutterBottom sx={{ mb: 1.5 }}>
          Export Packing Plan:
        </Typography>
        <Grid container spacing={1}>
          <Grid item>
            <Tooltip title="Download PDF Report with 3D Views">
              <Button
                variant="contained"
                size="small"
                startIcon={<PdfIcon />}
                onClick={() => handleExport('pdf')}
                sx={{
                  background: '#3b82f6',
                  '&:hover': { background: '#2563eb' }
                }}
              >
                PDF Report
              </Button>
            </Tooltip>
          </Grid>
          <Grid item>
            <Tooltip title="Download Excel Data with Item Positions">
              <Button
                variant="contained"
                size="small"
                startIcon={<ExcelIcon />}
                onClick={() => handleExport('excel')}
                sx={{
                  background: '#10b981',
                  '&:hover': { background: '#059669' }
                }}
              >
                Excel Data
              </Button>
            </Tooltip>
          </Grid>
          <Grid item>
            <Tooltip title="Open HTML Report in Browser">
              <Button
                variant="contained"
                size="small"
                startIcon={<HtmlIcon />}
                onClick={() => handleExport('html')}
                sx={{
                  background: '#8b5cf6',
                  '&:hover': { background: '#7c3aed' }
                }}
              >
                HTML Report
              </Button>
            </Tooltip>
          </Grid>
          <Grid item>
            <Tooltip title="Export as JSON">
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={() => handleExport('json')}
              >
                JSON
              </Button>
            </Tooltip>
          </Grid>
          <Grid item>
            <Tooltip title="Print Packing List">
              <Button
                variant="outlined"
                size="small"
                startIcon={<PrintIcon />}
                onClick={() => window.print()}
              >
                Print
              </Button>
            </Tooltip>
          </Grid>
        </Grid>
        
        {/* Export Info Banner */}
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
            borderRadius: 1,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            fontSize: '0.85rem'
          }}
        >
          <DownloadIcon fontSize="small" />
          <span>Export reports in multiple formats: PDF with 3D views, Excel with item data, and HTML report</span>
        </Box>
      </Box>
    </Paper>
  );
};

export default PackingList;
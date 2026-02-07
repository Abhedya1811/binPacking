import React, { useState } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  Button,
  Box,
  Typography,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  Chip,
  Card,
  CardContent,
  Divider,
  Stack
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as DuplicateIcon,
  Upload as UploadIcon,
  TableChart as TableIcon,
  GridView as CubeIcon,
  ViewModule as ModuleIcon,
  Apps as AppsIcon,
  Dashboard as DashboardIcon,
  AddBox as AddBoxIcon,
  Palette as PaletteIcon,
  ClearAll as ClearAllIcon
} from '@mui/icons-material';
import { generateRandomColor } from '../../utils/colors';
import './ItemInputForm.css';

const ItemInputForm = ({ items = [], onItemsChange, onImport, onTemplate }) => {
  const [newItem, setNewItem] = useState({
    name: '',
    width: 0.5,
    height: 0.5,
    depth: 0.5,
    quantity: 1,
    weight: 0,
    fragile: false,
    color: generateRandomColor()
  });

  const itemTemplates = {
    'boxes': [
      { name: 'Small Box', width: 0.5, height: 0.5, depth: 0.5, quantity: 1, color: '#3b82f6' },
      { name: 'Medium Box', width: 1.0, height: 0.8, depth: 0.8, quantity: 1, color: '#10b981' },
      { name: 'Large Box', width: 1.2, height: 1.0, depth: 1.0, quantity: 1, color: '#f59e0b' }
    ],
    'pallets': [
      { name: 'Euro Pallet', width: 1.2, height: 0.15, depth: 0.8, quantity: 1, color: '#ef4444' },
      { name: 'Standard Pallet', width: 1.0, height: 0.15, depth: 1.2, quantity: 1, color: '#8b5cf6' }
    ],
    'cylinders': [
      { name: 'Cylinder S', width: 0.3, height: 0.6, depth: 0.3, quantity: 1, color: '#06b6d4' },
      { name: 'Cylinder M', width: 0.4, height: 0.8, depth: 0.4, quantity: 1, color: '#ec4899' }
    ]
  };

  const handleAddItem = () => {
    if (!newItem.name.trim()) {
      alert('Please enter item name');
      return;
    }
    
    // FIXED: Only add ONE item entry with quantity field
    const itemToAdd = {
      ...newItem,
      id: Date.now(),
      color: generateRandomColor()
    };
    
    // Check if item already exists (same dimensions)
    const existingItemIndex = items.findIndex(item => 
      item.name === newItem.name && 
      item.width === newItem.width && 
      item.height === newItem.height && 
      item.depth === newItem.depth
    );
    
    if (existingItemIndex !== -1) {
      // Update quantity of existing item
      const updatedItems = [...items];
      updatedItems[existingItemIndex].quantity += newItem.quantity;
      onItemsChange(updatedItems);
    } else {
      // Add new item with quantity
      onItemsChange([...items, itemToAdd]);
    }
    
    // Reset form
    setNewItem({
      name: '',
      width: 0.5,
      height: 0.5,
      depth: 0.5,
      quantity: 1,
      weight: 0,
      fragile: false,
      color: generateRandomColor()
    });
  };

  const handleUpdateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    onItemsChange(updated);
  };

  const handleDeleteItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    onItemsChange(updated);
  };

  const handleDuplicateItem = (index) => {
    const itemToDuplicate = { 
      ...items[index], 
      id: Date.now(),
      name: `${items[index].name} (Copy)`
    };
    onItemsChange([...items, itemToDuplicate]);
  };

  const handleImportTemplate = (templateType) => {
    onTemplate(itemTemplates[templateType]);
  };

  const calculateItemVolume = (item) => {
    return (item.width * item.height * item.depth * (item.quantity || 1)).toFixed(3);
  };

  const totalItems = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const totalVolume = items.reduce((sum, item) => {
    return sum + (item.width * item.height * item.depth * (item.quantity || 1));
  }, 0);

  return (
    <Box className="item-input-container">
      {/* Header with Stats */}
      <Card sx={{ mb: 2, backgroundColor: '#f8fafc' }}>
        <CardContent sx={{ py: 2 }}>
          <Grid container alignItems="center" spacing={2}>
            <Grid item>
              <CubeIcon color="primary" />
            </Grid>
            <Grid item xs>
              <Typography variant="h6" fontWeight="600">
                Items to Pack
              </Typography>
            </Grid>
            <Grid item>
              <Stack direction="row" spacing={1}>
                <Chip 
                  label={`${totalItems} items`} 
                  color="primary" 
                  variant="outlined"
                  size="small"
                  icon={<CubeIcon />}
                />
                <Chip 
                  label={`${totalVolume.toFixed(2)} m³`} 
                  color="success" 
                  variant="outlined"
                  size="small"
                />
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Quick Add Form - UPDATED LAYOUT */}
      <Card sx={{ mb: 3 }}>
  <CardContent>
    <Typography variant="subtitle1" fontWeight="600" gutterBottom>
      <AddIcon sx={{ mr: 1, fontSize: 20 }} />
      Add New Item
    </Typography>

    {/* TOP ROW – 4 FIELDS */}
    <Grid container spacing={2}>
      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          size="small"
          label="Item Name"
          value={newItem.name}
          onChange={(e) =>
            setNewItem({ ...newItem, name: e.target.value })
          }
          placeholder="e.g., Box A"
        />
      </Grid>

      <Grid item xs={6} sm={2.5}>
        <TextField
          fullWidth
          size="small"
          label="Width (m)"
          type="number"
          value={newItem.width}
          onChange={(e) =>
            setNewItem({ ...newItem, width: parseFloat(e.target.value) || 0 })
          }
          inputProps={{ step: 0.01, min: 0.01 }}
        />
      </Grid>

      <Grid item xs={6} sm={2.5}>
        <TextField
          fullWidth
          size="small"
          label="Height (m)"
          type="number"
          value={newItem.height}
          onChange={(e) =>
            setNewItem({ ...newItem, height: parseFloat(e.target.value) || 0 })
          }
          inputProps={{ step: 0.01, min: 0.01 }}
        />
      </Grid>

      <Grid item xs={6} sm={2.5}>
        <TextField
          fullWidth
          size="small"
          label="Depth (m)"
          type="number"
          value={newItem.depth}
          onChange={(e) =>
            setNewItem({ ...newItem, depth: parseFloat(e.target.value) || 0 })
          }
          inputProps={{ step: 0.01, min: 0.01 }}
        />
      </Grid>
    </Grid>

    {/* BOTTOM ROW – Quantity LEFT | Button RIGHT */}
    <Grid
      container
      spacing={2}
      alignItems="center"
      sx={{ mt: 3 }}
    >
      {/* LEFT: Quantity */}
      <Grid item xs={12} sm={3}>
  <TextField
    fullWidth
    size="small"
    label="Quantity"
    type="number"
    value={newItem.quantity}
    onChange={(e) =>
      setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })
    }
    inputProps={{ min: 1 }}
  />
</Grid>


      {/* Spacer */}
      <Grid item xs />

      {/* RIGHT: Button */}
      <Grid item>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddItem}
          disabled={!newItem.name.trim()}
          sx={{
            minWidth: 150,
            height: 40,
            borderRadius: 2,
          }}
        >
          Add Item
        </Button>
      </Grid>
    </Grid>
  </CardContent>
</Card>



      {/* Quick Templates */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="600" gutterBottom>
            <AddBoxIcon sx={{ mr: 1, fontSize: 20 }} />
            Quick Templates
          </Typography>
          
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              size="small"
              startIcon={<CubeIcon />}
              onClick={() => handleImportTemplate('boxes')}
              sx={{ borderRadius: 2 }}
            >
              Add Boxes
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<CubeIcon />}
              onClick={() => handleImportTemplate('pallets')}
              sx={{ borderRadius: 2 }}
            >
              Add Pallets
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<CubeIcon />}
              onClick={() => handleImportTemplate('cylinders')}
              sx={{ borderRadius: 2 }}
            >
              Add Cylinders
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<ClearAllIcon />}
              onClick={() => onItemsChange([])}
              disabled={items.length === 0}
              sx={{ borderRadius: 2 }}
            >
              Clear All
            </Button>
            <Tooltip title="Import from CSV">
              <Button
                variant="outlined"
                size="small"
                startIcon={<UploadIcon />}
                onClick={onImport}
                sx={{ borderRadius: 2 }}
              >
                Import CSV
              </Button>
            </Tooltip>
          </Stack>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Grid container alignItems="center">
              <Grid item>
                <TableIcon sx={{ mr: 1, color: 'text.secondary' }} />
              </Grid>
              <Grid item xs>
                <Typography variant="subtitle1" fontWeight="600">
                  Items List
                </Typography>
              </Grid>
              <Grid item>
                <Typography variant="caption" color="text.secondary">
                  {items.length} unique items • {totalItems} total pieces
                </Typography>
              </Grid>
            </Grid>
          </Box>
          
          {items.length === 0 ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <CubeIcon sx={{ fontSize: 60, color: '#e0e0e0', mb: 2 }} />
              <Typography variant="body1" color="text.secondary" gutterBottom>
                No items added yet
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Add items above to start packing
              </Typography>
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell width="50px">Color</TableCell>
                    <TableCell>Item Name</TableCell>
                    <TableCell align="center">Width (m)</TableCell>
                    <TableCell align="center">Height (m)</TableCell>
                    <TableCell align="center">Depth (m)</TableCell>
                    <TableCell align="center">Qty</TableCell>
                    <TableCell align="center">Weight (kg)</TableCell>
                    <TableCell align="center">Total Vol (m³)</TableCell>
                    <TableCell align="center" width="100px">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id || index} hover>
                      <TableCell>
                        <Box
                          sx={{
                            width: 20,
                            height: 20,
                            borderRadius: 1,
                            backgroundColor: item.color,
                            border: '1px solid #ccc'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={item.name}
                          onChange={(e) => handleUpdateItem(index, 'name', e.target.value)}
                          size="small"
                          fullWidth
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <TextField
                          type="number"
                          value={item.width}
                          onChange={(e) => handleUpdateItem(index, 'width', parseFloat(e.target.value))}
                          size="small"
                          sx={{ width: 70 }}
                          inputProps={{ step: 0.01 }}
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <TextField
                          type="number"
                          value={item.height}
                          onChange={(e) => handleUpdateItem(index, 'height', parseFloat(e.target.value))}
                          size="small"
                          sx={{ width: 70 }}
                          inputProps={{ step: 0.01 }}
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <TextField
                          type="number"
                          value={item.depth}
                          onChange={(e) => handleUpdateItem(index, 'depth', parseFloat(e.target.value))}
                          size="small"
                          sx={{ width: 70 }}
                          inputProps={{ step: 0.01 }}
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <TextField
                          type="number"
                          value={item.quantity || 1}
                          onChange={(e) => handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          size="small"
                          sx={{ width: 60 }}
                          inputProps={{ min: 1 }}
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <TextField
                          type="number"
                          value={item.weight || 0}
                          onChange={(e) => handleUpdateItem(index, 'weight', parseFloat(e.target.value))}
                          size="small"
                          sx={{ width: 70 }}
                          inputProps={{ step: 0.1 }}
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        {(item.width * item.height * item.depth * (item.quantity || 1)).toFixed(3)}
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <Tooltip title="Duplicate">
                            <IconButton 
                              size="small" 
                              onClick={() => handleDuplicateItem(index)}
                              color="primary"
                            >
                              <DuplicateIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton 
                              size="small" 
                              onClick={() => handleDeleteItem(index)} 
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          
          {/* Summary Footer */}
          {items.length > 0 && (
            <Box sx={{ 
              p: 2, 
              borderTop: 1, 
              borderColor: 'divider',
              backgroundColor: '#fafafa'
            }}>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Unique Items:
                  </Typography>
                  <Typography variant="body2" fontWeight="600">
                    {items.length}
                  </Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Total Pieces:
                  </Typography>
                  <Typography variant="body2" fontWeight="600">
                    {totalItems}
                  </Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Total Volume:
                  </Typography>
                  <Typography variant="body2" fontWeight="600">
                    {totalVolume.toFixed(2)} m³
                  </Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Total Weight:
                  </Typography>
                  <Typography variant="body2" fontWeight="600">
                    {items.reduce((sum, item) => sum + ((item.weight || 0) * (item.quantity || 1)), 0).toFixed(1)} kg
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ItemInputForm;
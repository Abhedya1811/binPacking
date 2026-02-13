import React, { useState } from 'react';
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
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
  Stack,
  Alert,
  AlertTitle
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
  ClearAll as ClearAllIcon,
  Edit as EditIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon
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
    
    const itemToAdd = {
      ...newItem,
      id: Date.now(),
      color: generateRandomColor()
    };
    
    const existingItemIndex = items.findIndex(item => 
      item.name === newItem.name && 
      item.width === newItem.width && 
      item.height === newItem.height && 
      item.depth === newItem.depth
    );
    
    if (existingItemIndex !== -1) {
      const updatedItems = [...items];
      updatedItems[existingItemIndex].quantity += newItem.quantity;
      onItemsChange(updatedItems);
    } else {
      onItemsChange([...items, itemToAdd]);
    }
    
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

  /* ---------------- IMPORT STATE ---------------- */
  const [importSummary, setImportSummary] = useState({
    open: false,
    issues: [],
    processedItems: []
  });

  const cleanName = (name) =>
    String(name || "").replace(/[^a-zA-Z0-9.\s]/g, "");

  const round3 = (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return 0;
    return Math.round(num * 1000) / 1000;
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

  /* ---------------- FILE IMPORT ---------------- */
  const processImport = (rows) => {
    let issues = [];
    let processed = [];

    rows.forEach((row, index) => {
      // FIXED: Match exact column names from the Excel file with correct mapping
      const originalName = row['ITEM NAME'] || row['Item Name'] || row['Name'] || row.name || "";
      const cleanedName = cleanName(originalName);

      // FIXED: Correct column mapping based on your Excel structure
      // Your columns: ITEM NAME | WIDTH(m) | DEPTH(m) | HEIGHT(m) | QUANTITY
      const width = round3(row['WIDTH(m)'] || row['Width'] || row.width || 0.5);
      const depth = round3(row['DEPTH(m)'] || row['Depth'] || row.depth || 0.5);
      const height = round3(row['HEIGHT(m)'] || row['Height'] || row.height || 0.5);
      const quantity = parseInt(row['QUANTITY'] || row['Quantity'] || row.quantity || 1);

      console.log('Importing item:', {
        name: originalName,
        width,
        depth,
        height,
        quantity
      });

      // Validate dimensions
      if (width <= 0) {
        issues.push({
          type: "invalid_dimensions",
          itemName: originalName,
          message: "Width must be greater than 0"
        });
      }
      
      if (depth <= 0) {
        issues.push({
          type: "invalid_dimensions",
          itemName: originalName,
          message: "Depth must be greater than 0"
        });
      }
      
      if (height <= 0) {
        issues.push({
          type: "invalid_dimensions",
          itemName: originalName,
          message: "Height must be greater than 0"
        });
      }

      // Detect Special Characters
      const specialMatch = originalName.match(/[^a-zA-Z0-9.\s]/g);
      if (specialMatch) {
        issues.push({
          type: "special",
          symbols: [...new Set(specialMatch)],
          name: originalName
        });
      }

      // Detect Duplicate in existing items
      const duplicate = items.find(
        (item) =>
          item.name === cleanedName &&
          item.width === width &&
          item.height === height &&
          item.depth === depth
      );

      if (duplicate) {
        issues.push({
          type: "duplicate",
          name: cleanedName,
          existingItem: duplicate
        });
      }

      // Only add item if it has a name
      if (cleanedName) {
        processed.push({
          id: Date.now() + index + Math.random(),
          name: cleanedName,
          width: width > 0 ? width : 0.5,
          height: height > 0 ? height : 0.5,
          depth: depth > 0 ? depth : 0.5,
          quantity: quantity > 0 ? quantity : 1,
          weight: 0, // Default weight since not in Excel
          fragile: false,
          color: generateRandomColor()
        });
      }
    });

    setImportSummary({
      open: true,
      issues,
      processedItems: processed
    });
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        let workbook;
        let jsonData;
        
        if (file.name.endsWith('.csv')) {
          // Parse CSV
          workbook = XLSX.read(e.target.result, { type: "string" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          jsonData = XLSX.utils.sheet_to_json(sheet);
        } else {
          // Parse Excel files (xls, xlsx)
          const data = new Uint8Array(e.target.result);
          workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          
          // FIXED: Convert to JSON with headers
          jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          
          // Get headers from first row
          const headers = jsonData[0];
          const rows = [];
          
          // Process each data row
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row && row.some(cell => cell !== undefined && cell !== null && cell !== '')) {
              const rowObj = {};
              headers.forEach((header, index) => {
                if (header) {
                  // Clean the header - remove spaces and special characters for matching
                  const cleanHeader = String(header).trim();
                  rowObj[cleanHeader] = row[index];
                }
              });
              rows.push(rowObj);
            }
          }
          jsonData = rows;
        }

        console.log('Parsed Excel data:', jsonData);
        processImport(jsonData);
      } catch (error) {
        console.error("Error parsing file:", error);
        alert(`Error parsing file: ${error.message}. Please check the file format.`);
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }

    // Clear input
    event.target.value = '';
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

  /* ---------------- IMPORT SUMMARY HANDLERS ---------------- */
  const handleImportConfirm = (accept) => {
    if (accept) {
      // Filter out any items with invalid dimensions before adding
      const validItems = importSummary.processedItems.filter(item => 
        item.width > 0 && item.height > 0 && item.depth > 0 && item.name.trim()
      );
      onItemsChange([...items, ...validItems]);
    }

    setImportSummary({
      open: false,
      issues: [],
      processedItems: []
    });
  };

  const handleUpdateImportedItem = (index, field, value) => {
    const updatedProcessed = [...importSummary.processedItems];
    
    if (field === 'width' || field === 'height' || field === 'depth') {
      value = parseFloat(value) || 0;
    } else if (field === 'quantity') {
      value = parseInt(value) || 1;
    } else if (field === 'weight') {
      value = parseFloat(value) || 0;
    }
    
    updatedProcessed[index][field] = value;
    
    // Re-check for duplicates after update
    const duplicateIssues = [...importSummary.issues].filter(issue => 
      issue.type !== 'duplicate' || issue.name !== updatedProcessed[index].name
    );
    
    const duplicate = items.find(
      (item) =>
        item.name === updatedProcessed[index].name &&
        item.width === updatedProcessed[index].width &&
        item.height === updatedProcessed[index].height &&
        item.depth === updatedProcessed[index].depth
    );
    
    if (duplicate) {
      duplicateIssues.push({
        type: "duplicate",
        name: updatedProcessed[index].name,
        existingItem: duplicate
      });
    }
    
    setImportSummary({
      ...importSummary,
      processedItems: updatedProcessed,
      issues: duplicateIssues
    });
  };

  const handleDeleteImportedItem = (index) => {
    const updatedProcessed = importSummary.processedItems.filter((_, i) => i !== index);
    const deletedItem = importSummary.processedItems[index];
    
    // Remove issues related to deleted item
    const updatedIssues = importSummary.issues.filter(issue => 
      issue.name !== deletedItem.name
    );
    
    setImportSummary({
      ...importSummary,
      processedItems: updatedProcessed,
      issues: updatedIssues
    });
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

      {/* Quick Add Form */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="600" gutterBottom>
            <AddIcon sx={{ mr: 1, fontSize: 20 }} />
            Add New Item
          </Typography>

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

          <Grid container spacing={2} alignItems="center" sx={{ mt: 3 }}>
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

            <Grid item xs />
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
            <Tooltip title="Import from CSV / Excel">
              <Button
                variant="outlined"
                size="small"
                startIcon={<UploadIcon />}
                component="label"
                sx={{ borderRadius: 2 }}
              >
                Import CSV/Excel
                <input
                  type="file"
                  hidden
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                />
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

      {/* Enhanced Import Summary Dialog - WITHOUT ROW NUMBERS */}
      <Dialog 
        open={importSummary.open} 
        maxWidth="lg" 
        fullWidth
        scroll="paper"
      >
        <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Box display="flex" alignItems="center">
            <UploadIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Import Preview & Validation</Typography>
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0 }}>
          {/* Issues Summary */}
          {importSummary.issues.length > 0 && (
            <Box sx={{ p: 3, bgcolor: '#fff4e5' }}>
              <Alert severity="warning" icon={<WarningIcon />}>
                <AlertTitle>Validation Issues Found ({importSummary.issues.length})</AlertTitle>
                <Stack spacing={1}>
                  {importSummary.issues.map((issue, index) => (
                    <Typography key={index} variant="body2">
                      • {issue.type === "duplicate" && 
                        `Duplicate of existing item "${issue.name}"`}
                      {issue.type === "special" && 
                        `Special characters found: ${issue.symbols.join(', ')} in "${issue.name}"`}
                      {issue.type === "invalid_dimensions" && 
                        `${issue.message} for "${issue.itemName || issue.name}"`}
                    </Typography>
                  ))}
                </Stack>
              </Alert>
            </Box>
          )}

          {/* Items Table - NO ROW COLUMN */}
          {importSummary.processedItems.length > 0 ? (
            <>
              <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight="600">
                  Items to Import ({importSummary.processedItems.length})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Edit items below before confirming import. Weight field added with default value 0kg.
                </Typography>
              </Box>
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item Name</TableCell>
                      <TableCell align="center">Width (m)</TableCell>
                      <TableCell align="center">Depth (m)</TableCell>
                      <TableCell align="center">Height (m)</TableCell>
                      <TableCell align="center">Quantity</TableCell>                  
                      <TableCell align="center" width="80px">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importSummary.processedItems.map((item, index) => {
                      const hasDuplicate = importSummary.issues.some(
                        issue => issue.type === 'duplicate' && issue.name === item.name
                      );
                      const hasInvalidDimensions = importSummary.issues.some(
                        issue => issue.type === 'invalid_dimensions' && 
                        (issue.itemName === item.name || issue.name === item.name)
                      );
                      
                      return (
                        <TableRow 
                          key={item.id || index}
                          sx={{
                            bgcolor: hasDuplicate ? '#fff3cd' : hasInvalidDimensions ? '#f8d7da' : 'inherit'
                          }}
                        >
                          <TableCell>
                            <TextField
                              value={item.name}
                              onChange={(e) => handleUpdateImportedItem(index, 'name', e.target.value)}
                              size="small"
                              variant="standard"
                              InputProps={{ disableUnderline: true }}
                              error={!item.name.trim()}
                              helperText={!item.name.trim() ? "Required" : ""}
                              sx={{ width: 150 }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              type="number"
                              value={item.width}
                              onChange={(e) => handleUpdateImportedItem(index, 'width', e.target.value)}
                              size="small"
                              sx={{ width: 70 }}
                              inputProps={{ step: 0.01, min: 0.01 }}
                              variant="standard"
                              InputProps={{ disableUnderline: true }}
                              error={item.width <= 0}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              type="number"
                              value={item.depth}
                              onChange={(e) => handleUpdateImportedItem(index, 'depth', e.target.value)}
                              size="small"
                              sx={{ width: 70 }}
                              inputProps={{ step: 0.01, min: 0.01 }}
                              variant="standard"
                              InputProps={{ disableUnderline: true }}
                              error={item.depth <= 0}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              type="number"
                              value={item.height}
                              onChange={(e) => handleUpdateImportedItem(index, 'height', e.target.value)}
                              size="small"
                              sx={{ width: 70 }}
                              inputProps={{ step: 0.01, min: 0.01 }}
                              variant="standard"
                              InputProps={{ disableUnderline: true }}
                              error={item.height <= 0}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleUpdateImportedItem(index, 'quantity', e.target.value)}
                              size="small"
                              sx={{ width: 60 }}
                              inputProps={{ min: 1 }}
                              variant="standard"
                              InputProps={{ disableUnderline: true }}
                              error={item.quantity < 1}
                            />
                          </TableCell>
                      
                        
                          <TableCell align="center">
                            <Stack direction="row" spacing={0.5} justifyContent="center">
                              <Tooltip title="Delete">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleDeleteImportedItem(index)}
                                  color="error"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No items to import</Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button 
            color="error" 
            onClick={() => handleImportConfirm(false)}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={() => handleImportConfirm(true)}
            startIcon={<CheckCircleIcon />}
            disabled={importSummary.processedItems.filter(item => 
              item.width > 0 && item.height > 0 && item.depth > 0 && item.name.trim()
            ).length === 0}
          >
            Import {importSummary.processedItems.filter(item => 
              item.width > 0 && item.height > 0 && item.depth > 0 && item.name.trim()
            ).length} Items
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItemInputForm;
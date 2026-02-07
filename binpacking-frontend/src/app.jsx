import React, { useState, useRef } from 'react';
import { 
  Grid, 
  Box, 
  Snackbar, 
  Alert, 
  CircularProgress, 
  CssBaseline, 
  Drawer,
  Paper,
  IconButton,
  Tooltip,
  Typography,
  Button,
  Tabs,
  Tab
} from '@mui/material';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import BinVisualizerWrapper from './components/Packing3D/BinVisualizerWrapper'; // Correct import
import BinInputForm from './components/PackingForm/BinInputForm';
import ItemInputForm from './components/PackingForm/ItemInputForm';
import StatisticsPanel from './components/Dashboard/StatisticsPanel';
import PackingList from './components/Dashboard/PackingList';
import PackingControls from './components/PackingForm/PackingControls';
import { usePacking } from './hooks/usePacking';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import InventoryIcon from '@mui/icons-material/Inventory';
import SettingsApplicationsIcon from '@mui/icons-material/SettingsApplications';
import './app.css';

function App() {
  const [containerSize, setContainerSize] = useState({
    width: 12,
    height: 8,
    depth: 10,
    maxWeight: 10000
  });
  
  const [items, setItems] = useState([]);
  const [packingOptions, setPackingOptions] = useState({
    algorithm: 'maximal-rectangles',
    rotation: 'all',
    sorting: 'volume-desc',
    allowOverhang: false,
    considerWeight: true,
    considerFragile: true
  });
  
  const {
    packingResult,
    loading,
    error,
    history,
    calculatePacking,
    loadFromHistory,
    clearHistory
  } = usePacking();
  
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [configWidth, setConfigWidth] = useState(350); // Default width in pixels
  const [isResizing, setIsResizing] = useState(false);
  const [activeTab, setActiveTab] = useState(1); // Default to Items tab

  const resizerRef = useRef(null);
  const configPanelRef = useRef(null);

  const handleCalculate = async () => {
    try {
      if (items.length === 0) {
        setNotification({
          open: true,
          message: 'Please add items to pack',
          severity: 'warning'
        });
        return;
      } 
      
      const result = await calculatePacking(containerSize, items, packingOptions);
      
      setNotification({
        open: true,
        message: `Packing calculated! Efficiency: ${result.efficiency.toFixed(1)}%`,
        severity: 'success'
      });
      
      // Show sidebar after calculation
      setSidebarOpen(true);
    } catch (err) {
      setNotification({
        open: true,
        message: `Error: ${err.message}`,
        severity: 'error'
      });
    }
  };

  const handleContainerChange = (newSize) => {
    setContainerSize(newSize);
  };
    
  const handleOptionChange = (key, value) => {
    setPackingOptions(prev => ({ ...prev, [key]: value }));
  };

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  // Handle mouse down for resizing
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = configWidth;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(250, Math.min(600, startWidth + deltaX)); // Min 250px, Max 600px
      setConfigWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Prevent text selection while resizing
  React.useEffect(() => {
    if (isResizing) {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  // Create a stable key for the visualizer
  const visualizerKey = React.useMemo(() => {
    if (!packingResult) return 'visualizer-empty';
    // Create a stable key based on the packing result data
    const dataStr = JSON.stringify(packingResult);
    let hash = 0;
    for (let i = 0; i < dataStr.length; i++) {
      const char = dataStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `visualizer-${Math.abs(hash)}`;
  }, [packingResult]);

  return (
    <div className="app-container">
      <CssBaseline />
      <Header />
      
      <Box className="main-content">
        {/* Sidebar Drawer */}
        <Drawer
          variant="persistent"
          anchor="right"
          open={sidebarOpen}
          sx={{
            '& .MuiDrawer-paper': {
              width: 300,
              marginTop: '80px',
              height: 'calc(100vh - 80px)',
              boxSizing: 'border-box'
            }
          }}
        >
          <Sidebar 
            history={history} 
            onLoadHistory={loadFromHistory}
            onClose={() => setSidebarOpen(false)}
          />
        </Drawer>
        
        {/* Main Content - Split Layout */}
        <Box 
          className="content-container"
          sx={{
            marginRight: sidebarOpen ? '300px' : '0',
            transition: 'margin-right 0.3s ease',
            display: 'flex',
            height: 'calc(100vh - 80px)',
            overflow: 'hidden'
          }}
        >
          {/* Left Panel - Configuration (Draggable Width) */}
          <Box
            ref={configPanelRef}
            sx={{
              width: `${configWidth}px`,
              minWidth: `${configWidth}px`,
              height: '100%',
              display: 'flex',
              position: 'relative',
              transition: isResizing ? 'none' : 'width 0.1s ease'
            }}
          >
            <Paper 
              className="config-panel"
              elevation={3}
              sx={{
                width: '100%',
                height: '100%',
                overflowY: 'auto',
                borderRight: '1px solid #e0e0e0',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Config Panel Header */}
              <Box className="config-header" sx={{ 
                p: 2, 
                borderBottom: '1px solid #e0e0e0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#f8fafc'
              }}>
                <Typography variant="h6" sx={{ color: '#1e40af' }}>
                  Packing Configuration
                </Typography>
                <Tooltip title="Adjust panel width">
                  <DragHandleIcon 
                    sx={{ 
                      cursor: 'col-resize',
                      color: '#64748b',
                      '&:hover': { color: '#334155' }
                    }}
                  />
                </Tooltip>
              </Box>
              
              {/* Config Panel Content */}
              <Box className="config-content" sx={{ p: 2, flex: 1, overflowY: 'auto' }}>
                {/* Loading Overlay */}
                {loading && (
                  <Box className="loading-overlay">
                    <CircularProgress />
                    <Box mt={2}>Calculating optimal packing...</Box>
                  </Box>
                )}
                
                {/* Navigation Tabs */}
                <Tabs 
                  value={activeTab} 
                  onChange={(e, newValue) => setActiveTab(newValue)}
                  sx={{ mb: 2 }}
                  variant="fullWidth"
                >
                  <Tab 
                    icon={<LocalShippingIcon />} 
                    label="Container" 
                    sx={{ minHeight: '48px', fontSize: '0.75rem' }}
                  />
                  <Tab 
                    icon={<InventoryIcon />} 
                    label={`Items (${items.length})`}
                    sx={{ minHeight: '48px', fontSize: '0.75rem' }}
                  />
                  <Tab 
                    icon={<SettingsApplicationsIcon />} 
                    label="Options"
                    sx={{ minHeight: '48px', fontSize: '0.75rem' }}
                  />
                </Tabs>
                
                {/* Tab Content */}
                <Box sx={{ pt: 1 }}>
                  {/* Container Tab */}
                  {activeTab === 0 && (
                    <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
                      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, fontSize: '0.9rem' }}>
                        Container Dimensions
                      </Typography>
                      <BinInputForm
                        containerSize={containerSize}
                        onContainerChange={handleContainerChange}
                        onContainerTypeChange={handleOptionChange}
                      />
                    </Paper>
                  )}
                  
                  {/* Items Tab */}
                  {activeTab === 1 && (
                    <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
                      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, fontSize: '0.9rem' }}>
                        Items to Pack
                      </Typography>
                      <ItemInputForm
                        items={items}
                        onItemsChange={setItems}
                        onImport={() => console.log('Import CSV')}
                        onTemplate={(templateItems) => setItems(templateItems)}
                      />
                    </Paper>
                  )}
                  
                  {/* Options Tab */}
                  {activeTab === 2 && (
                    <Paper sx={{ p: 2, borderRadius: 2 }}>
                      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, fontSize: '0.9rem' }}>
                        Packing Options
                      </Typography>
                      <PackingControls
                        onCalculate={handleCalculate}
                        onReset={() => setItems([])}
                        loading={loading}
                        disabled={items.length === 0}
                        options={packingOptions}
                        onOptionsChange={handleOptionChange}
                      />
                    </Paper>
                  )}
                </Box>
                
                {/* Quick Status Bar */}
                <Paper sx={{ 
                  mt: 2, 
                  p: 1.5, 
                  borderRadius: 2, 
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #bae6fd'
                }}>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Container Volume:
                      </Typography>
                      <Typography variant="body2" fontWeight="medium" fontSize="0.8rem">
                        {(containerSize.width * containerSize.height * containerSize.depth).toFixed(2)} m³
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Items Count:
                      </Typography>
                      <Typography variant="body2" fontWeight="medium" fontSize="0.8rem">
                        {items.length} items
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Box>
            </Paper>
            
            {/* Resizer Handle */}
            <Box
              ref={resizerRef}
              className="resizer-handle"
              onMouseDown={handleMouseDown}
              sx={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: '6px',
                cursor: 'col-resize',
                backgroundColor: isResizing ? '#3b82f6' : 'transparent',
                transition: 'background-color 0.2s',
                zIndex: 10,
                '&:hover': {
                  backgroundColor: '#3b82f6'
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: '50%',
                  left: '1px',
                  right: '1px',
                  height: '40px',
                  transform: 'translateY(-50%)',
                  backgroundColor: isResizing ? 'white' : '#94a3b8',
                  borderRadius: '2px'
                }
              }}
            />
          </Box>
          
          {/* Right Panel - Full Screen Visualization */}
          <Box className="visualization-panel" sx={{ 
            flex: 1,
            height: '100%',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Full Screen Visualization */}
            <Box className="full-visualization" sx={{ 
              flex: 1,
              position: 'relative',
              backgroundColor: '#0f172a'
            }}>
              {/* Use the wrapper component with proper key */}
              <BinVisualizerWrapper
                key={visualizerKey}
                packingResult={packingResult}
                isLoading={loading}
                originalItems={items}
              />
              
              {/* Visualization Controls Overlay */}
              <Box className="visualization-controls" sx={{
                position: 'absolute',
                top: 16,
                left: 16,
                right: 16,
                display: 'flex',
                justifyContent: 'space-between',
                pointerEvents: 'none',
                '& > *': {
                  pointerEvents: 'auto'
                }
              }}>
                {/* Left side controls */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Tooltip title="Toggle History Panel">
                    <IconButton 
                      size="small" 
                      sx={{ 
                        backgroundColor: 'white',
                        '&:hover': { backgroundColor: '#f5f5f5' }
                      }}
                      onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                      <HistoryIcon />
                      {history.length > 0 && (
                        <Typography variant="caption" sx={{ ml: 0.5 }}>
                          {history.length}
                        </Typography>
                      )}
                    </IconButton>
                  </Tooltip>
                </Box>
                
                {/* Right side controls - View modes */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Paper sx={{ 
                    display: 'flex', 
                    padding: '2px',
                    borderRadius: '6px'
                  }}>
                    {['3D', 'Top', 'Front', 'Side'].map((view) => (
                      <Button 
                        key={view}
                        size="small"
                        sx={{ 
                          minWidth: 'auto',
                          px: 2,
                          py: 0.5,
                          borderRadius: '4px',
                          backgroundColor: view === '3D' ? '#3b82f6' : 'transparent',
                          color: view === '3D' ? 'white' : '#666',
                          fontSize: '0.75rem',
                          '&:hover': {
                            backgroundColor: view === '3D' ? '#2563eb' : '#f5f5f5'
                          }
                        }}
                      >
                        {view}
                      </Button>
                    ))}
                  </Paper>
                </Box>
              </Box>
              
              {/* Resize Indicator */}
              {isResizing && (
                <Box sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  pointerEvents: 'none',
                  zIndex: 1000
                }}>
                  Width: {configWidth}px
                </Box>
              )}
            </Box>
            
            {/* Results Panel (Collapsible) */}
            {packingResult && (
              <Paper 
                className="results-panel" 
                elevation={3}
                sx={{ 
                  height: '300px',
                  borderTop: '2px solid #e0e0e0',
                  display: 'flex',
                  flexDirection: 'column',
                  flexShrink: 0
                }}
              >
                <Box sx={{ 
                  p: 2, 
                  borderBottom: '1px solid #e0e0e0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#f8fafc'
                }}>
                  <Typography variant="h6">Packing Results</Typography>
                  <Typography variant="caption" color="primary" fontWeight="bold">
                    Efficiency: {packingResult.efficiency?.toFixed(1) || '0.0'}%
                  </Typography>
                </Box>
                
                <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <StatisticsPanel
                        containerStats={{
                          volume: containerSize.width * containerSize.height * containerSize.depth
                        }}
                        packingStats={{
                          packedItems: packingResult.packedCount || 0,
                          totalItems: packingResult.totalItems || items.length,
                          efficiency: packingResult.efficiency || 0,
                          volumeUsed: packingResult.volumeUsed || 0
                        }}
                        algorithmStats={{
                          name: packingOptions.algorithm
                        }}
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <PackingList
                        packingResult={packingResult}
                        onViewItem={(item) => console.log('View item:', item)}
                        onExport={(format) => console.log('Export as:', format)}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Paper>
            )}
          </Box>
        </Box>
      </Box>
      
      {/* Notifications */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
      
      {/* Error Display */}
      {error && (
        <Snackbar
          open={!!error}
          autoHideDuration={8000}
          onClose={() => {/* Handle error close */}}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        </Snackbar>
      )}
    </div>
  );
}

export default App;
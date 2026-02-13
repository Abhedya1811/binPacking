import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
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
  Tab,
  Avatar,
  Badge,
  Chip,
  Fade,
  Zoom,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon
} from '@mui/material';
import {
  History as HistoryIcon,
  Settings as SettingsIcon,
  DragHandle as DragHandleIcon,
  LocalShipping as LocalShippingIcon,
  Inventory as InventoryIcon,
  SettingsApplications as SettingsApplicationsIcon,
  Menu as MenuIcon,
  AdminPanelSettings as AdminIcon,
  Logout as LogoutIcon,
  AccountCircle as ProfileIcon,
  Notifications as NotificationsIcon,
  Refresh as RefreshIcon,
  Dashboard as DashboardIcon,
  Assessment as AssessmentIcon,
  Timeline as TimelineIcon,
  ThreeDRotation as ThreeDIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  DragIndicator as DragIndicatorIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Header from '../Layout/Header';
import Sidebar from '../Layout/Sidebar';
import BinVisualizerWrapper from '../Packing3D/BinVisualizerWrapper';
import BinInputForm from '../PackingForm/BinInputForm';
import ItemInputForm from '../PackingForm/ItemInputForm';
import StatisticsPanel from './StatisticsPanel';
import PackingList from './PackingList';
import PackingControls from '../PackingForm/PackingControls';
import PackingReportGenerator from '../Packing3D/PackingReportGenerator';
import { usePacking } from '../../hooks/usePacking';
import AdminProfile from './AdminProfile';
import './Dashboard.css';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // Original App.jsx state
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
  const [configWidth, setConfigWidth] = useState(600);
  const [isResizing, setIsResizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState(1);
  const [anchorEl, setAnchorEl] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Results panel state
  const [resultsHeight, setResultsHeight] = useState(350);
  const [isResizingResults, setIsResizingResults] = useState(false);
  const [isResultsVisible, setIsResultsVisible] = useState(true);
  const [minResultsHeight] = useState(250);
  const [maxResultsHeight] = useState(500);

  // FIXED: Create all refs
  const packingReportRef = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const visualizerRef = useRef(null); // ← ADD THIS LINE - This was missing!

  const resizerRef = useRef(null);
  const configPanelRef = useRef(null);
  const resultsResizerRef = useRef(null);
  const visualizationRef = useRef(null);

  // Update time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Handle menu
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileOpen = () => {
    setProfileOpen(true);
    handleMenuClose();
  };

  // Original App.jsx functions
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
      localStorage.removeItem('packingSavedAngles');
    
    // If you have access to the PackingReportGenerator ref, also clear its state
    if (packingReportRef.current && packingReportRef.current.clearSavedAngles) {
      packingReportRef.current.clearSavedAngles();
    }
      setNotification({
        open: true,
        message: `Packing calculated! Efficiency: ${result.efficiency?.toFixed(1) || '0'}%`,
        severity: 'success'
      });
      
      setSidebarOpen(true);
      
      // Auto-show results when calculation completes
      setIsResultsVisible(true);
      setResultsHeight(350);
      
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

  // Toggle collapse
  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    if (!isCollapsed) {
      setConfigWidth(48);
    } else {
      setConfigWidth(600);
    }
  };

  // Left panel resize handlers
  const handleMouseDown = (e) => {
    if (isCollapsed) return;
    
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = configWidth;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(48, Math.min(800, startWidth + deltaX));
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

  // Results panel resize handlers
  const handleResultsMouseDown = (e) => {
    e.preventDefault();
    setIsResizingResults(true);
    
    const startY = e.clientY;
    const startHeight = resultsHeight;

    const handleMouseMove = (e) => {
      const deltaY = startY - e.clientY;
      const newHeight = Math.max(minResultsHeight, Math.min(maxResultsHeight, startHeight + deltaY));
      setResultsHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizingResults(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Toggle results visibility
  const toggleResults = () => {
    if (isResultsVisible) {
      setIsResultsVisible(false);
    } else {
      setIsResultsVisible(true);
      setResultsHeight(350);
    }
  };

  // Handle export functions
  const handleExport = async (format) => {
    if (!packingReportRef.current) {
      console.error('PackingReportGenerator ref not available');
      return;
    }

    switch(format) {
      case 'pdf':
        await packingReportRef.current.generatePDF();
        break;
      case 'excel':
        await packingReportRef.current.generateExcel();
        break;
      case 'html':
        await packingReportRef.current.generateHTML();
        break;
      case 'json':
        // Handle JSON export
        const jsonStr = JSON.stringify(packingResult, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `packing-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    if (isResizing || isResizingResults) {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = isResizing ? 'col-resize' : 'row-resize';
    } else {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, isResizingResults]);

  const visualizerKey = React.useMemo(() => {
    if (!packingResult) return 'visualizer-empty';
    const dataStr = JSON.stringify(packingResult);
    let hash = 0;
    for (let i = 0; i < dataStr.length; i++) {
      const char = dataStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `visualizer-${Math.abs(hash)}`;
  }, [packingResult]);

  // Format time
  const formatTime = () => {
    return currentTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format date
  const formatDate = () => {
    return currentTime.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="dashboard-container">
      <CssBaseline />
      
      {/* Enhanced Header with Admin Profile */}
      <Box className="dashboard-header">
        <Paper 
          elevation={0} 
          sx={{ 
            borderRadius: 0,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            backdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(255, 255, 255, 0.95)'
          }}
        >
          <Box className="header-content">
            {/* Logo and Title */}
            <Box className="header-left">
              <Box className="logo-container">
                <ThreeDIcon className="logo-icon" />
                <Typography variant="h6" className="logo-text">
                  3D Packing Optimizer
                </Typography>
                <Chip 
                  label="PRO"
                  size="small"
                  className="pro-badge"
                />
              </Box>
            </Box>

            {/* Center - Quick Stats */}
            <Box className="header-center">
              <Chip
                icon={<AssessmentIcon />}
                label={`${items.length} Items`}
                variant="outlined"
                size="small"
              />
              <Chip
                icon={<TimelineIcon />}
                label={`${history.length} Jobs`}
                variant="outlined"
                size="small"
              />
              <Chip
                icon={<DashboardIcon />}
                label={formatDate()}
                variant="outlined"
                size="small"
              />
            </Box>

            {/* Right - Admin Actions */}
            <Box className="header-right">
              <Tooltip title="Refresh">
                <IconButton size="small">
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Notifications">
                <IconButton size="small">
                  <Badge badgeContent={3} color="error">
                    <NotificationsIcon />
                  </Badge>
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Settings">
                <IconButton size="small">
                  <SettingsIcon />
                </IconButton>
              </Tooltip>
              
              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
              
              <Box className="admin-profile">
                <Box className="admin-info">
                  <Typography variant="body2" className="admin-greeting">
                    {formatTime()}
                  </Typography>
                  <Typography variant="body2" className="admin-name">
                    {user?.full_name || 'Admin'}
                  </Typography>
                </Box>
                <IconButton
                  onClick={handleMenuOpen}
                  className="admin-avatar"
                >
                  <Badge
                    overlap="circular"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    variant="dot"
                    color="success"
                  >
                    <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
                      <AdminIcon fontSize="small" />
                    </Avatar>
                  </Badge>
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Admin Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          onClick={handleMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{
            elevation: 3,
            sx: {
              mt: 1.5,
              minWidth: 200,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider'
            }
          }}
        >
          <MenuItem disabled>
            <ListItemIcon>
              <ProfileIcon fontSize="small" />
            </ListItemIcon>
            <Box>
              <Typography variant="body2" fontWeight="600">
                {user?.full_name || 'Administrator'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.email || 'admin@binpacking.com'}
              </Typography>
            </Box>
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleProfileOpen}>
            <ListItemIcon>
              <AdminIcon fontSize="small" />
            </ListItemIcon>
            Admin Profile
          </MenuItem>
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            Logout
          </MenuItem>
        </Menu>
      </Box>
      
      {/* Admin Profile Dialog */}
      <AdminProfile open={profileOpen} onClose={() => setProfileOpen(false)} />
      
      {/* Main Content */}
      <Box className="main-content">
        {/* History Sidebar Drawer */}
        <Drawer
          variant="persistent"
          anchor="right"
          open={sidebarOpen}
          sx={{
            '& .MuiDrawer-paper': {
              width: 320,
              marginTop: '72px',
              height: 'calc(100vh - 72px)',
              boxSizing: 'border-box',
              borderLeft: '1px solid',
              borderColor: 'divider',
              boxShadow: '-4px 0 20px rgba(0,0,0,0.05)'
            }
          }}
        >
          <Sidebar 
            history={history} 
            onLoadHistory={loadFromHistory}
            onClose={() => setSidebarOpen(false)}
          />
        </Drawer>
        
        {/* Main Content Container */}
        <Box 
          className="content-container"
          sx={{
            marginRight: sidebarOpen ? '320px' : '0',
            transition: 'margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            height: 'calc(100vh - 72px)',
            overflow: 'hidden'
          }}
        >
          {/* Left Panel - Configuration */}
          <Box
            ref={configPanelRef}
            sx={{
              width: `${configWidth}px`,
              minWidth: `${configWidth}px`,
              height: '100%',
              display: 'flex',
              position: 'relative',
              transition: isResizing ? 'none' : 'width 0.2s ease'
            }}
          >
            <Paper 
              className="config-panel"
              elevation={0}
              sx={{
                width: '100%',
                height: '100%',
                overflowY: isCollapsed ? 'hidden' : 'auto',
                borderRight: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
                bgcolor: '#fafbfc',
                position: 'relative'
              }}
            >
              {/* Collapse Button */}
              <Box
                sx={{
                  position: 'absolute',
                  right: -12,
                  top: 24,
                  zIndex: 100,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '50%',
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 2,
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'primary.main',
                    color: 'white',
                    borderColor: 'primary.main'
                  },
                  transition: 'all 0.2s'
                }}
                onClick={handleToggleCollapse}
              >
                <Tooltip title={isCollapsed ? "Expand panel" : "Collapse panel"}>
                  <IconButton size="small" sx={{ p: 0 }}>
                    {isCollapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </Box>

              {!isCollapsed ? (
                /* Expanded View */
                <>
                  {/* Config Panel Header */}
                  <Box className="config-header">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SettingsApplicationsIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                      <Typography variant="subtitle1" fontWeight="600">
                        Configuration
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip 
                        label={`v2.1.0`}
                        size="small"
                        variant="outlined"
                        sx={{ height: 24, fontSize: '0.7rem' }}
                      />
                      <Tooltip title="Drag to resize">
                        <DragHandleIcon 
                          className="resize-handle"
                          onMouseDown={handleMouseDown}
                          sx={{ 
                            cursor: 'col-resize',
                            color: 'text.secondary',
                            '&:hover': { color: 'primary.main' }
                          }}
                        />
                      </Tooltip>
                    </Box>
                  </Box>
                  
                  {/* Config Panel Content */}
                  <Box className="config-content">
                    {/* Loading Overlay */}
                    {loading && (
                      <Fade in={loading}>
                        <Box className="loading-overlay-modern">
                          <CircularProgress size={40} thickness={4} />
                          <Box mt={2} textAlign="center">
                            <Typography variant="body2" fontWeight="600" gutterBottom>
                              Calculating Optimal Packing
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Using {packingOptions.algorithm} algorithm
                            </Typography>
                          </Box>
                        </Box>
                      </Fade>
                    )}
                    
                    {/* Navigation Tabs */}
                    <Box className="tabs-container">
                      <Tabs 
                        value={activeTab} 
                        onChange={(e, newValue) => setActiveTab(newValue)}
                        variant="fullWidth"
                        sx={{
                          '& .MuiTab-root': {
                            minHeight: 56,
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            textTransform: 'none'
                          }
                        }}
                      >
                        <Tab 
                          icon={<LocalShippingIcon sx={{ fontSize: 20 }} />} 
                          label="Container" 
                          iconPosition="start"
                        />
                        <Tab 
                          icon={<InventoryIcon sx={{ fontSize: 20 }} />} 
                          label={`Items (${items.length})`}
                          iconPosition="start"
                        />
                        <Tab 
                          icon={<SettingsApplicationsIcon sx={{ fontSize: 20 }} />} 
                          label="Algorithm"
                          iconPosition="start"
                        />
                      </Tabs>
                    </Box>
                    
                    {/* Tab Content */}
                    <Box className="tab-content">
                      {/* Container Tab */}
                      {activeTab === 0 && (
                        <Zoom in={activeTab === 0} timeout={300}>
                          <Box>
                            <Paper className="section-paper">
                              <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                                Container Dimensions
                              </Typography>
                              <BinInputForm
                                containerSize={containerSize}
                                onContainerChange={handleContainerChange}
                                onContainerTypeChange={handleOptionChange}
                              />
                            </Paper>
                          </Box>
                        </Zoom>
                      )}
                      
                      {/* Items Tab */}
                      {activeTab === 1 && (
                        <Zoom in={activeTab === 1} timeout={300}>
                          <Box>
                            <Paper className="section-paper">
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="subtitle2" fontWeight="600">
                                  Items to Pack
                                </Typography>
                                <Chip 
                                  label={`${items.length} items`}
                                  size="small"
                                  color={items.length > 0 ? 'success' : 'default'}
                                />
                              </Box>
                              <ItemInputForm
                                items={items}
                                onItemsChange={setItems}
                                onImport={() => console.log('Import CSV')}
                                onTemplate={(templateItems) => setItems(templateItems)}
                              />
                            </Paper>
                          </Box>
                        </Zoom>
                      )}
                      
                      {/* Algorithm Tab */}
                      {activeTab === 2 && (
                        <Zoom in={activeTab === 2} timeout={300}>
                          <Box>
                            <Paper className="section-paper">
                              <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                                Packing Algorithm
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
                          </Box>
                        </Zoom>
                      )}
                    </Box>
                    
                    {/* Quick Status Bar */}
                    <Paper className="status-paper">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <DashboardIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                        <Typography variant="caption" fontWeight="600" color="primary">
                          CURRENT SESSION
                        </Typography>
                      </Box>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Container Volume
                          </Typography>
                          <Typography variant="body2" fontWeight="700" fontSize="0.9rem">
                            {(containerSize.width * containerSize.height * containerSize.depth).toFixed(2)} m³
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Items Count
                          </Typography>
                          <Typography variant="body2" fontWeight="700" fontSize="0.9rem">
                            {items.length} items
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Algorithm
                          </Typography>
                          <Typography variant="body2" fontWeight="600" fontSize="0.8rem" sx={{ textTransform: 'capitalize' }}>
                            {packingOptions.algorithm}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Rotation
                          </Typography>
                          <Typography variant="body2" fontWeight="600" fontSize="0.8rem" sx={{ textTransform: 'capitalize' }}>
                            {packingOptions.rotation}
                          </Typography>
                        </Grid>
                      </Grid>
                      
                      {items.length > 0 && (
                        <Button
                          fullWidth
                          variant="contained"
                          onClick={handleCalculate}
                          disabled={loading}
                          sx={{ mt: 2 }}
                        >
                          {loading ? 'Calculating...' : 'Run Packing Algorithm'}
                        </Button>
                      )}
                    </Paper>
                  </Box>
                </>
              ) : (
                /* Collapsed View - Vertical Icons */
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    pt: 4,
                    gap: 3
                  }}
                >
                  <Tooltip title="Container Configuration" placement="right">
                    <IconButton 
                      onClick={() => {
                        setIsCollapsed(false);
                        setActiveTab(0);
                      }}
                      sx={{
                        bgcolor: activeTab === 0 ? 'primary.main' : 'transparent',
                        color: activeTab === 0 ? 'white' : 'text.secondary',
                        '&:hover': {
                          bgcolor: activeTab === 0 ? 'primary.dark' : 'action.hover'
                        }
                      }}
                    >
                      <LocalShippingIcon />
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title={`Items (${items.length})`} placement="right">
                    <IconButton 
                      onClick={() => {
                        setIsCollapsed(false);
                        setActiveTab(1);
                      }}
                      sx={{
                        bgcolor: activeTab === 1 ? 'primary.main' : 'transparent',
                        color: activeTab === 1 ? 'white' : 'text.secondary',
                        '&:hover': {
                          bgcolor: activeTab === 1 ? 'primary.dark' : 'action.hover'
                        }
                      }}
                    >
                      <Badge badgeContent={items.length} color="primary">
                        <InventoryIcon />
                      </Badge>
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title="Algorithm Settings" placement="right">
                    <IconButton 
                      onClick={() => {
                        setIsCollapsed(false);
                        setActiveTab(2);
                      }}
                      sx={{
                        bgcolor: activeTab === 2 ? 'primary.main' : 'transparent',
                        color: activeTab === 2 ? 'white' : 'text.secondary',
                        '&:hover': {
                          bgcolor: activeTab === 2 ? 'primary.dark' : 'action.hover'
                        }
                      }}
                    >
                      <SettingsApplicationsIcon />
                    </IconButton>
                  </Tooltip>
                  
                  <Divider sx={{ width: '80%', my: 1 }} />
                  
                  <Tooltip title="Run Algorithm" placement="right">
                    <IconButton 
                      onClick={handleCalculate}
                      disabled={loading || items.length === 0}
                      color="primary"
                      sx={{
                        bgcolor: 'primary.main',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'primary.dark'
                        },
                        '&:disabled': {
                          bgcolor: 'action.disabledBackground',
                          color: 'action.disabled'
                        }
                      }}
                    >
                      <AssessmentIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </Paper>
            
            {/* Resizer Handle - Only show when expanded */}
            {!isCollapsed && (
              <Box
                ref={resizerRef}
                className="resizer-handle"
                onMouseDown={handleMouseDown}
                sx={{
                  position: 'absolute',
                  right: -3,
                  top: 0,
                  bottom: 0,
                  width: '6px',
                  cursor: 'col-resize',
                  backgroundColor: isResizing ? 'primary.main' : 'transparent',
                  transition: 'background-color 0.2s',
                  zIndex: 20,
                  '&:hover': {
                    backgroundColor: 'primary.main',
                    opacity: 0.5
                  }
                }}
              />
            )}
          </Box>
          
          {/* Right Panel - 3D Visualization */}
          <Box 
            className="visualization-panel"
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              bgcolor: '#f5f7fa',
              position: 'relative',
              overflow: 'hidden'
            }}
            ref={containerRef}
          >
            {/* Visualization container with dynamic height */}
            <Box 
              ref={visualizationRef}
              className="visualization-container"
              sx={{
                height: isResultsVisible && packingResult 
                  ? `calc(100% - ${resultsHeight}px - 8px)`
                  : '100%',
                position: 'relative',
                overflow: 'hidden',
                transition: isResizingResults ? 'none' : 'height 0.3s ease',
                bgcolor: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Box sx={{ width: '100%', height: '100%' }}>
                <BinVisualizerWrapper
                  ref={visualizerRef} // ← Pass the visualizerRef here
                  key={visualizerKey}
                  packingResult={packingResult}
                  isLoading={loading}
                  originalItems={items}
                />
              </Box>
              
              {/* Visualization Controls Overlay */}
              <Box 
                className="visualization-controls"
                sx={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  left: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  pointerEvents: 'none',
                  '& > *': {
                    pointerEvents: 'auto'
                  }
                }}
              >
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Tooltip title="History Panel">
                    <IconButton 
                      size="small"
                      onClick={() => setSidebarOpen(!sidebarOpen)}
                      sx={{ 
                        bgcolor: 'background.paper',
                        boxShadow: 2,
                        '&:hover': { bgcolor: 'background.paper' }
                      }}
                    >
                      <Badge badgeContent={history.length} color="primary">
                        <HistoryIcon />
                      </Badge>
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title="Reset View">
                    <IconButton 
                      size="small"
                      onClick={() => {
                        // Reset view through the ref if available
                        if (visualizerRef.current && visualizerRef.current.resetView) {
                          visualizerRef.current.resetView();
                        }
                      }}
                      sx={{ 
                        bgcolor: 'background.paper',
                        boxShadow: 2,
                        '&:hover': { bgcolor: 'background.paper' }
                      }}
                    >
                      <ThreeDIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                
                
              </Box>
            </Box>
            
            {/* Results Panel Resizer Handle */}
            {packingResult && isResultsVisible && (
              <Box
                ref={resultsResizerRef}
                onMouseDown={handleResultsMouseDown}
                sx={{
                  height: '8px',
                  cursor: 'row-resize',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: isResizingResults ? 'primary.main' : 'divider',
                  transition: 'background-color 0.2s',
                  '&:hover': {
                    bgcolor: 'primary.light'
                  },
                  position: 'relative',
                  zIndex: 30,
                  flexShrink: 0
                }}
              >
                <DragIndicatorIcon 
                  sx={{ 
                    fontSize: 16, 
                    color: isResizingResults ? 'white' : 'text.secondary',
                    transform: 'rotate(90deg)'
                  }} 
                />
              </Box>
            )}
            
            {/* Results Panel */}
            {packingResult && isResultsVisible && (
              <Fade in={isResultsVisible}>
                <Paper 
                  sx={{
                    height: `${resultsHeight}px`,
                    overflowY: 'auto',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 0,
                    p: 2,
                    transition: isResizingResults ? 'none' : 'height 0.3s ease',
                    bgcolor: 'white',
                    zIndex: 20,
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {/* Results Panel Header */}
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      mb: 1.5,
                      pb: 1,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      flexShrink: 0
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AssessmentIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                      <Typography variant="subtitle1" fontWeight="600">
                        Packing Results
                      </Typography>
                      <Chip 
                        label={`${packingResult.efficiency?.toFixed(1) || '0'}%`}
                        size="small"
                        color={packingResult.efficiency > 70 ? 'success' : 'warning'}
                        sx={{ fontWeight: 600, ml: 1 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Tooltip title="Toggle results panel">
                        <IconButton size="small" onClick={toggleResults}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  
                  <Box sx={{ overflowY: 'auto', flex: 1 }}>
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
                          onExport={handleExport}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                </Paper>
              </Fade>
            )}
            
            {/* Button to show results if hidden */}
            {packingResult && !isResultsVisible && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 790,
                  right: 50,
                  zIndex: 50
                }}
              >
                <Button
                  variant="contained"
                  startIcon={<AssessmentIcon />}
                  onClick={toggleResults}
                  sx={{
                    borderRadius: 30,
                    boxShadow: 3,
                    bgcolor: 'primary.main',
                    '&:hover': {
                      bgcolor: 'primary.dark'
                    }
                  }}
                >
                  Show Results
                </Button>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
      
      {/* PackingReportGenerator with ref */}
      {packingResult && (
        <PackingReportGenerator
        ref={packingReportRef}
        packingResult={packingResult}
        containerRef={containerRef}
        canvasRef={visualizerRef}
        showCamera={false}
        />
      )}
      
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
          variant="filled"
          sx={{ 
            width: '100%',
            boxShadow: 3,
            '& .MuiAlert-icon': { alignItems: 'center' }
          }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
      
      {/* Error Display */}
      {error && (
        <Snackbar
          open={!!error}
          autoHideDuration={8000}
          onClose={() => {}}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="error" variant="filled" sx={{ boxShadow: 3 }}>
            {error}
          </Alert>
        </Snackbar>
      )}
    </div>
  );
};

export default Dashboard;
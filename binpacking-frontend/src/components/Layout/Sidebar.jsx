import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Typography,
  Paper,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  History as HistoryIcon,
  Close as CloseIcon,
  CheckCircle as SuccessIcon
} from '@mui/icons-material';
import './Sidebar.css';

const Sidebar = ({ history = [], onLoadHistory, onClose }) => {
  return (
    <Paper className="sidebar" elevation={3}>
      {/* Sidebar Header */}
      <Box className="sidebar-header">
        <Box display="flex" alignItems="center" gap={1}>
          <HistoryIcon />
          <Typography variant="h6">Packing History</Typography>
        </Box>
        
        {onClose && (
          <Tooltip title="Close">
            <IconButton size="small" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Divider />

      {/* History List */}
      <Box className="history-list">
        {history.length === 0 ? (
          <Box className="empty-history">
            <HistoryIcon sx={{ fontSize: 40, color: '#ccc', mb: 2 }} />
            <Typography color="text.secondary" align="center">
              No packing history yet
            </Typography>
            <Typography variant="caption" color="text.secondary" align="center">
              Calculate packing to see history
            </Typography>
          </Box>
        ) : (
          <List dense>
            {history.map((item, index) => (
              <ListItem key={index} disablePadding>
                <ListItemButton
                  onClick={() => onLoadHistory && onLoadHistory(item)}
                  className="history-item"
                >
                  <ListItemText
                    primary={
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" noWrap>
                          {item.name || `Packing ${index + 1}`}
                        </Typography>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <SuccessIcon fontSize="small" color="success" />
                          <Typography variant="caption" color="success.main">
                            {item.efficiency}%
                          </Typography>
                        </Box>
                      </Box>
                    }
                    secondary={
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">
                          {item.containerSize || `${item.container?.width || 0}m`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Footer Stats */}
      {history.length > 0 && (
        <>
          <Divider />
          <Box className="sidebar-footer">
            <Typography variant="caption" color="text.secondary">
              {history.length} packing{history.length !== 1 ? 's' : ''}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Avg: {(
                history.reduce((sum, item) => sum + (item.efficiency || 0), 0) / history.length
              ).toFixed(1)}%
            </Typography>
          </Box>
        </>
      )}
    </Paper>
  );
};

export default Sidebar;
import { useState, useCallback } from 'react';
import { api } from '../services/api';

export const usePacking = () => {
  const [packingResult, setPackingResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  const calculatePacking = useCallback(async (container, items, options = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔧 [usePacking] Starting calculation...');
      
      // Prepare data for backend
      const packingData = {
        binWidth: parseFloat(container.width) || 100,
        binHeight: parseFloat(container.height) || 80,
        binDepth: parseFloat(container.depth) || 60,
        maxWeight: parseFloat(container.maxWeight) || 10000,
        binName: "Container",
        
        items: items.map((item, index) => ({
          id: String(item.id || `item_${Date.now()}_${index}`),
          name: String(item.name || `Item ${index}`),
          width: parseFloat(item.width),
          height: parseFloat(item.height),
          depth: parseFloat(item.depth),
          weight: parseFloat(item.weight || 0),
          quantity: parseInt(item.quantity || 1),
          canRotate: item.rotation !== false,
          color: item.color
        })),
        
        algorithm: options.algorithm || 'maxrects'
      };

      console.log('📤 [usePacking] Sending to api.calculatePacking:', packingData);
      
      // Call API
      const apiResponse = await api.calculatePacking(packingData);
      
      console.log('📥 [usePacking] RAW API Response:', apiResponse);
      
      // TRANSFORM THE RESPONSE HERE
      const transformedResult = transformBackendResult(apiResponse, container, items);
      
      console.log('✅ Transformed result:', transformedResult);
      
      // Store the result
      setPackingResult(transformedResult);
      
      // Add to history
      if (transformedResult) {
        const historyItem = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          container: container,
          itemsCount: items.length,
          efficiency: transformedResult.efficiency,
          volumeUsed: transformedResult.volumeUsed,
          algorithm: options.algorithm,
          result: transformedResult
        };
        
        setHistory(prev => [historyItem, ...prev.slice(0, 9)]);
      }
      
      return transformedResult;
    } catch (err) {
      console.error('❌ [usePacking] Packing error:', err);
      setError(err.message || 'Failed to calculate packing');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Transformation function
  const transformBackendResult = (backendResult, originalContainer, originalItems) => {
    console.log('🔄 Transforming backend result...');
    
    if (!backendResult) {
      console.warn('⚠️ Backend result is null/undefined');
      return null;
    }
    
    // Get first bin
    const firstBin = backendResult.bins?.[0];
    if (!firstBin) {
      console.warn('⚠️ No bins in response');
      return null;
    }
    
    // Use visualization_data items if available, otherwise use bin items
    const visualizationItems = backendResult.visualization_data?.items || [];
    const binItems = firstBin.items || [];
    const itemsToUse = visualizationItems.length > 0 ? visualizationItems : binItems;
    
    const statistics = backendResult.statistics || {};
    
    console.log('📦 Processing items:', {
      visualizationItems: visualizationItems.length,
      binItems: binItems.length,
      using: itemsToUse.length
    });
    
    // Transform packed items
    const packedItems = itemsToUse.map((item, index) => {
      return {
        id: item.id || `packed_${index}`,
        name: (item.id || '').split('_')[0] || `Item ${index}`,
        x: parseFloat(item.position?.[0] || 0),
        y: parseFloat(item.position?.[1] || 0),
        z: parseFloat(item.position?.[2] || 0),
        width: parseFloat(item.dimensions?.[0] || 0),
        height: parseFloat(item.dimensions?.[1] || 0),
        depth: parseFloat(item.dimensions?.[2] || 0),
        rotation: Array.isArray(item.rotation) 
          ? item.rotation.map(r => parseFloat(r))
          : [0, 0, 0],
        color: item.color || '#3498db',
        layer: Math.floor(item.position?.[1] || 0)
      };
    });
    
    console.log('✅ Packed items transformed:', packedItems.length);
    
    // Create final result
    const result = {
      success: statistics.success !== false,
      packedItems: packedItems,
      efficiency: firstBin.utilization || statistics.space_utilization || 0,
      volumeUsed: statistics.packed_volume || 0,
      containerVolume: statistics.container_volume || 
        (originalContainer.width * originalContainer.height * originalContainer.depth),
      totalItems: statistics.total_items || originalItems.reduce((sum, item) => sum + (item.quantity || 1), 0),
      packedCount: packedItems.length,
      statistics: statistics,
      warnings: statistics.validation_warnings || [],
      executionTime: statistics.execution_time_ms || 0,
      visualization_data: {
        ...backendResult.visualization_data,
        items: itemsToUse,
        container: backendResult.visualization_data?.container || {
          width: originalContainer.width,
          height: originalContainer.height,
          depth: originalContainer.depth,
          color: '#3B82F6'
        }
      }
    };
    
    console.log('🎯 Final result ready:', {
      success: result.success,
      packedItemsCount: result.packedItems.length,
      efficiency: result.efficiency
    });
    
    return result;
  };

  const loadFromHistory = useCallback((historyItem) => {
    console.log('📚 Loading from history:', historyItem);
    setPackingResult(historyItem.result);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const exportResult = useCallback((format = 'json') => {
    if (!packingResult) return null;
    
    switch (format) {
      case 'json':
        return JSON.stringify(packingResult, null, 2);
      case 'csv':
        return convertToCSV(packingResult);
      case 'pdf':
        return generatePDF(packingResult);
      default:
        return null;
    }
  }, [packingResult]);

  return {
    packingResult,
    loading,
    error,
    history,
    calculatePacking,
    loadFromHistory,
    clearHistory,
    exportResult
  };
};

// Helper function for CSV export
const convertToCSV = (result) => {
  if (!result?.packedItems?.length) return '';
  
  const headers = ['Item', 'Position X', 'Position Y', 'Position Z', 'Rotation', 'Layer'];
  const rows = result.packedItems.map(item => [
    item.name,
    item.x,
    item.y,
    item.z,
    item.rotation?.join(',') || '0,0,0',
    item.layer || 1
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
};

// Mock PDF generation
const generatePDF = (result) => {
  console.log('PDF generation not implemented');
  return null;
};
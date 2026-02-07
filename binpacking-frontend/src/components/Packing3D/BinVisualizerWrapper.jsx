// BinVisualizerWrapper.jsx
import React, { memo, useEffect, useState } from 'react';
import BinVisualizer from './BinVisualizer';

const BinVisualizerWrapper = ({ 
  packingResult, 
  isLoading, 
  originalItems = [] 
}) => {
  // Create a stable reference to prevent unnecessary re-renders
  const [stablePackingResult, setStablePackingResult] = useState(null);
  const [stableOriginalItems, setStableOriginalItems] = useState([]);
  const [renderKey, setRenderKey] = useState(0);
  
  // Debounce rapid changes to packingResult
  useEffect(() => {
    if (!packingResult) {
      setStablePackingResult(null);
      return;
    }
    
    // Only update if the data is meaningfully different
    const currentStr = JSON.stringify(stablePackingResult);
    const newStr = JSON.stringify(packingResult);
    
    if (currentStr !== newStr) {
      console.log('📦 Wrapper: Packing result changed, updating...');
      setStablePackingResult(packingResult);
      // Force a new render key to handle Three.js cleanup/reinit properly
      setRenderKey(prev => prev + 1);
    }
  }, [packingResult]);
  
  // Stabilize originalItems
  useEffect(() => {
    const currentStr = JSON.stringify(stableOriginalItems);
    const newStr = JSON.stringify(originalItems);
    
    if (currentStr !== newStr) {
      setStableOriginalItems(originalItems);
    }
  }, [originalItems]);

  // If component is being rapidly re-rendered, show a fallback
  if (isLoading) {
    return (
      <div style={{ 
        width: '100%', 
        height: '600px', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f4f8',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #e2e8f0',
          borderTop: '3px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <div style={{ fontSize: '16px', color: '#4b5563' }}>
          Loading visualization...
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <BinVisualizer
      key={`bin-visualizer-${renderKey}`}
      packingResult={stablePackingResult}
      isLoading={isLoading}
      originalItems={stableOriginalItems}
    />
  );
};

// Custom comparison function to prevent unnecessary re-renders
const areEqual = (prevProps, nextProps) => {
  // Always re-render if loading state changes
  if (prevProps.isLoading !== nextProps.isLoading) {
    return false;
  }
  
  // Compare packingResult
  const prevResultStr = JSON.stringify(prevProps.packingResult);
  const nextResultStr = JSON.stringify(nextProps.packingResult);
  
  if (prevResultStr !== nextResultStr) {
    return false;
  }
  
  // Compare originalItems
  const prevItemsStr = JSON.stringify(prevProps.originalItems);
  const nextItemsStr = JSON.stringify(nextProps.originalItems);
  
  return prevItemsStr === nextItemsStr;
};

export default memo(BinVisualizerWrapper, areEqual);
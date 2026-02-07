// Export packing results as JSON
export const exportToJSON = (packingResult, container, items) => {
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        software: 'Container Packing System'
      },
      container: container,
      items: items,
      result: packingResult,
      summary: {
        efficiency: packingResult.efficiency,
        volumeUsed: packingResult.volumeUsed,
        containerVolume: packingResult.containerVolume,
        packedCount: packingResult.packedCount,
        totalItems: packingResult.totalItems
      }
    };
    
    return JSON.stringify(exportData, null, 2);
  };
  
  // Export packing results as CSV
  export const exportToCSV = (packedItems) => {
    const headers = [
      'Item Name',
      'Width (m)',
      'Height (m)',
      'Depth (m)',
      'Position X',
      'Position Y',
      'Position Z',
      'Rotation',
      'Layer',
      'Volume (m³)'
    ];
    
    const rows = packedItems.map(item => [
      item.name,
      item.width,
      item.height,
      item.depth,
      item.x,
      item.y,
      item.z,
      item.rotation || '0,0,0',
      item.layer || 1,
      (item.width * item.height * item.depth).toFixed(3)
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    return csvContent;
  };
  
  // Generate packing instructions text
  export const generateInstructions = (packedItems) => {
    let instructions = 'PACKING INSTRUCTIONS\n';
    instructions += '====================\n\n';
    
    // Group by layer
    const layers = {};
    packedItems.forEach(item => {
      const layer = Math.floor(item.y / 2); // Assuming 2m layer height
      if (!layers[layer]) layers[layer] = [];
      layers[layer].push(item);
    });
    
    // Sort layers
    Object.keys(layers)
      .sort((a, b) => a - b)
      .forEach((layer, layerIndex) => {
        instructions += `LAYER ${layerIndex + 1}:\n`;
        instructions += '-'.repeat(20) + '\n';
        
        layers[layer].forEach((item, index) => {
          instructions += `${index + 1}. Place ${item.name} at position (${item.x.toFixed(2)}, ${item.y.toFixed(2)}, ${item.z.toFixed(2)})\n`;
          if (item.rotation) {
            instructions += `   Rotation: ${item.rotation}\n`;
          }
          instructions += `   Dimensions: ${item.width}m × ${item.height}m × ${item.depth}m\n\n`;
        });
      });
    
    return instructions;
  };
  
  // Create download file
  export const createDownloadFile = (content, filename, type = 'text/plain') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Format statistics for export
  export const formatStatistics = (packingResult) => {
    return {
      'Packing Efficiency': `${packingResult.efficiency.toFixed(2)}%`,
      'Container Volume': `${packingResult.containerVolume.toFixed(2)} m³`,
      'Volume Used': `${packingResult.volumeUsed.toFixed(2)} m³`,
      'Empty Space': `${(packingResult.containerVolume - packingResult.volumeUsed).toFixed(2)} m³`,
      'Items Packed': `${packingResult.packedCount} of ${packingResult.totalItems}`,
      'Space Utilization': `${((packingResult.volumeUsed / packingResult.containerVolume) * 100).toFixed(2)}%`
    };
  };
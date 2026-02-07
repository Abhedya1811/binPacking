import { api } from './api';

export class PackingService {
  /**
   * Validate input dimensions before sending to backend
   */
  static validateInputs(binData, items) {
    const errors = [];
    
    // Validate bin dimensions
    if (!binData.width || binData.width <= 0) {
      errors.push('Bin width must be positive');
    }
    if (!binData.height || binData.height <= 0) {
      errors.push('Bin height must be positive');
    }
    if (!binData.depth || binData.depth <= 0) {
      errors.push('Bin depth must be positive');
    }
    
    // Validate items
    items.forEach((item, index) => {
      if (!item.name?.trim()) {
        errors.push(`Item ${index + 1}: Name is required`);
      }
      if (!item.width || item.width <= 0) {
        errors.push(`Item ${index + 1}: Width must be positive`);
      }
      if (!item.height || item.height <= 0) {
        errors.push(`Item ${index + 1}: Height must be positive`);
      }
      if (!item.depth || item.depth <= 0) {
        errors.push(`Item ${index + 1}: Depth must be positive`);
      }
      if (item.quantity < 1) {
        errors.push(`Item ${index + 1}: Quantity must be at least 1`);
      }
      
      // Check if item fits in bin
      if (binData.width && item.width > binData.width) {
        errors.push(`Item ${index + 1}: Width (${item.width}) exceeds bin width (${binData.width})`);
      }
      if (binData.height && item.height > binData.height) {
        errors.push(`Item ${index + 1}: Height (${item.height}) exceeds bin height (${binData.height})`);
      }
      if (binData.depth && item.depth > binData.depth) {
        errors.push(`Item ${index + 1}: Depth (${item.depth}) exceeds bin depth (${binData.depth})`);
      }
    });
    
    return errors;
  }
  
  /**
   * Calculate packing efficiency locally (client-side estimation)
   */
  static calculateEfficiencyEstimation(binData, items) {
    const binVolume = binData.width * binData.height * binData.depth;
    let totalItemVolume = 0;
    
    items.forEach(item => {
      const itemVolume = item.width * item.height * item.depth * item.quantity;
      totalItemVolume += itemVolume;
    });
    
    const efficiency = (totalItemVolume / binVolume) * 100;
    const wastedVolume = binVolume - totalItemVolume;
    
    return {
      estimatedEfficiency: Math.min(100, Math.max(0, efficiency)),
      totalItemVolume,
      binVolume,
      wastedVolume,
      canFit: totalItemVolume <= binVolume * 1.5, // Allow some overflow
    };
  }
  
  /**
   * Send packing request to backend - ✅ FIXED VERSION
   */
  static async calculatePacking(binData, items, constraints = {}) {
    // ✅ CORRECT PAYLOAD FORMAT:
    const payload = {
      bin_config: {
        name: binData.name || 'Main Bin',
        width: parseFloat(binData.width),
        height: parseFloat(binData.height),
        depth: parseFloat(binData.depth),
        max_weight: binData.maxWeight ? parseFloat(binData.maxWeight) : null,
      },
      items: items.map(item => ({
        id: item.id || `item_${Date.now()}_${Math.random()}`,
        name: item.name,
        width: parseFloat(item.width),
        height: parseFloat(item.height),
        depth: parseFloat(item.depth),
        weight: item.weight ? parseFloat(item.weight) : 0,
        quantity: parseInt(item.quantity),
        can_rotate: item.canRotate !== false,
        // priority: item.priority || 1, // Remove if not in schema
      })),
      // ✅ CORRECT: algorithm at root level, not inside constraints
      algorithm: constraints.algorithm || 'maxrects',
    };
    
    console.log('Sending to backend:', payload); // Debug log
    
    try {
      const response = await api.calculatePacking(payload);
      return response;
    } catch (error) {
      console.error('Packing calculation failed:', error);
      throw new Error(`Packing failed: ${error.message}`);
    }
  }
  
  /**
   * Generate packing instructions from result
   */
  static generateInstructions(packingResult) {
    const instructions = [];
    
    if (!packingResult?.bins) return instructions;
    
    packingResult.bins.forEach((bin, binIndex) => {
      instructions.push(`**Bin ${binIndex + 1}** (${bin.utilization || 0}% utilized):`);
      
      // Sort items by Z position (bottom to top)
      const sortedItems = [...(bin.items || [])].sort((a, b) => 
        a.position[2] - b.position[2]
      );
      
      sortedItems.forEach((item, itemIndex) => {
        const pos = item.position || [0, 0, 0];
        instructions.push(
          `  ${itemIndex + 1}. Place **${item.name || 'Item'}** ` +
          `at position X:${pos[0].toFixed(1)}, Y:${pos[1].toFixed(1)}, Z:${pos[2].toFixed(1)} ` +
          `(Rotation: ${this.getRotationDescription(item.rotation)})`
        );
      });
      
      if (bin.items?.length === 0) {
        instructions.push(`  No items in this bin`);
      }
      
      instructions.push(''); // Empty line between bins
    });
    
    return instructions;
  }
  
  /**
   * Convert rotation array to human-readable description
   */
  static getRotationDescription(rotation) {
    if (!rotation || !Array.isArray(rotation)) return 'None';
    
    const [x, y, z] = rotation;
    const rotations = [];
    
    if (x !== 0) rotations.push(`${x}° around X`);
    if (y !== 0) rotations.push(`${y}° around Y`);
    if (z !== 0) rotations.push(`${z}° around Z`);
    
    return rotations.length > 0 ? rotations.join(', ') : 'None';
  }
  
  /**
   * Export packing result to various formats
   */
  static exportResult(result, format = 'json') {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(result, null, 2);
        
      case 'csv':
        let csv = 'Bin,Item,Width,Height,Depth,Position_X,Position_Y,Position_Z,Rotation_X,Rotation_Y,Rotation_Z\n';
        
        result.bins?.forEach((bin, binIndex) => {
          bin.items?.forEach(item => {
            const pos = item.position || [0, 0, 0];
            const rot = item.rotation || [0, 0, 0];
            csv += `Bin ${binIndex + 1},${item.name},${item.dimensions[0]},${item.dimensions[1]},${item.dimensions[2]},${pos[0]},${pos[1]},${pos[2]},${rot[0]},${rot[1]},${rot[2]}\n`;
          });
        });
        return csv;
        
      case 'text':
        return this.generateInstructions(result).join('\n');
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
  
  /**
   * Download packing result as file
   */
  static downloadResult(result, filename = 'packing-result', format = 'json') {
    const content = this.exportResult(result, format);
    const blob = new Blob([content], { type: this.getMimeType(format) });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = `${filename}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  static getMimeType(format) {
    const mimeTypes = {
      json: 'application/json',
      csv: 'text/csv',
      text: 'text/plain',
    };
    return mimeTypes[format] || 'text/plain';
  }
  
  // ✅ Add test method
  static async testBackend() {
    const testData = {
      binData: {
        width: 100,
        height: 80,
        depth: 60,
        maxWeight: 500,
        name: "Test Bin"
      },
      items: [
        {
          id: "test_item_1",
          name: "Test Box",
          width: 30,
          height: 20,
          depth: 15,
          weight: 5,
          quantity: 1,
          canRotate: true
        }
      ],
      constraints: {
        algorithm: "maxrects"
      }
    };
    
    return this.calculatePacking(testData.binData, testData.items, testData.constraints);
  }
}
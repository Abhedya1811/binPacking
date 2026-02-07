// Calculate total volume of items
export const calculateTotalItemsVolume = (items) => {
    return items.reduce((total, item) => {
      const itemVolume = item.width * item.height * item.depth;
      const quantity = item.quantity || 1;
      return total + (itemVolume * quantity);
    }, 0);
  };
  
  // Calculate total weight of items
  export const calculateTotalWeight = (items) => {
    return items.reduce((total, item) => {
      const weight = item.weight || 0;
      const quantity = item.quantity || 1;
      return total + (weight * quantity);
    }, 0);
  };
  
  // Sort items by various criteria
  export const sortItems = (items, criteria = 'volume-desc') => {
    const itemsCopy = [...items];
    
    switch (criteria) {
      case 'volume-desc':
        return itemsCopy.sort((a, b) => {
          const volA = a.width * a.height * a.depth;
          const volB = b.width * b.height * b.depth;
          return volB - volA;
        });
        
      case 'volume-asc':
        return itemsCopy.sort((a, b) => {
          const volA = a.width * a.height * a.depth;
          const volB = b.width * b.height * b.depth;
          return volA - volB;
        });
        
      case 'height-desc':
        return itemsCopy.sort((a, b) => b.height - a.height);
        
      case 'width-desc':
        return itemsCopy.sort((a, b) => b.width - a.width);
        
      case 'depth-desc':
        return itemsCopy.sort((a, b) => b.depth - a.depth);
        
      case 'weight-desc':
        return itemsCopy.sort((a, b) => (b.weight || 0) - (a.weight || 0));
        
      default:
        return itemsCopy;
    }
  };
  
  // Calculate possible rotations for an item
  export const getPossibleRotations = (item, rotationMode = 'all') => {
    const { width, height, depth } = item;
    const rotations = [];
    
    if (rotationMode === 'all') {
      // All 6 possible orientations
      rotations.push(
        { width, height, depth }, // Original
        { width: depth, height, depth: width }, // Rotate around Y
        { width: height, height: width, depth }, // Rotate around Z
        { width: depth, height: width, depth: height }, // Rotate around X and Y
        { width: height, height: depth, depth: width }, // Rotate around Y and Z
        { width, height: depth, depth: height } // Rotate around X and Z
      );
    } else if (rotationMode === 'height-only') {
      // Only rotate keeping height vertical
      rotations.push(
        { width, height, depth },
        { width: depth, height, depth: width }
      );
    } else {
      // No rotation
      rotations.push({ width, height, depth });
    }
    
    // Remove duplicates
    const uniqueRotations = [];
    const seen = new Set();
    
    rotations.forEach(rot => {
      const key = `${rot.width},${rot.height},${rot.depth}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueRotations.push(rot);
      }
    });
    
    return uniqueRotations;
  };
  
  // Calculate packing density
  export const calculatePackingDensity = (packedVolume, containerVolume) => {
    return (packedVolume / containerVolume) * 100;
  };
  
  // Calculate center of gravity
  export const calculateCenterOfGravity = (packedItems) => {
    if (packedItems.length === 0) return { x: 0, y: 0, z: 0 };
    
    let totalMass = 0;
    let sumX = 0, sumY = 0, sumZ = 0;
    
    packedItems.forEach(item => {
      const volume = item.width * item.height * item.depth;
      const density = 1000; // Assuming 1000 kg/m³ for simplicity
      const mass = volume * density;
      
      const centerX = item.x + item.width / 2;
      const centerY = item.y + item.height / 2;
      const centerZ = item.z + item.depth / 2;
      
      totalMass += mass;
      sumX += centerX * mass;
      sumY += centerY * mass;
      sumZ += centerZ * mass;
    });
    
    return {
      x: sumX / totalMass,
      y: sumY / totalMass,
      z: sumZ / totalMass
    };
  };
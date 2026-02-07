// Calculate volume of item
export const calculateVolume = (width, height, depth) => {
    return width * height * depth;
  };
  
  // Calculate surface area
  export const calculateSurfaceArea = (width, height, depth) => {
    return 2 * (width * height + width * depth + height * depth);
  };
  
  // Check if item fits in container
  export const checkFit = (item, container, position) => {
    const { x, y, z } = position;
    const { width: w, height: h, depth: d } = item;
    const { width: cw, height: ch, depth: cd } = container;
    
    return (
      x >= 0 && x + w <= cw &&
      y >= 0 && y + h <= ch &&
      z >= 0 && z + d <= cd
    );
  };
  
  // Calculate packing efficiency
  export const calculateEfficiency = (packedVolume, containerVolume) => {
    if (containerVolume === 0) return 0;
    return (packedVolume / containerVolume) * 100;
  };
  
  // Convert 3D coordinates to 2D (for top view)
  export const to2DTopView = (x, z, width, depth) => {
    return { x, y: z, width, height: depth };
  };
  
  // Convert 3D coordinates to 2D (for front view)
  export const to2DFrontView = (x, y, width, height) => {
    return { x, y: height - y, width, height: -height };
  };
  
  // Calculate distance between two points in 3D
  export const calculateDistance = (x1, y1, z1, x2, y2, z2) => {
    return Math.sqrt(
      Math.pow(x2 - x1, 2) +
      Math.pow(y2 - y1, 2) +
      Math.pow(z2 - z1, 2)
    );
  };
  
  // Generate vertices for a 3D box
  export const generateBoxVertices = (x, y, z, width, height, depth) => {
    return [
      // Front face
      { x: x, y: y, z: z },
      { x: x + width, y: y, z: z },
      { x: x + width, y: y + height, z: z },
      { x: x, y: y + height, z: z },
      
      // Back face
      { x: x, y: y, z: z + depth },
      { x: x + width, y: y, z: z + depth },
      { x: x + width, y: y + height, z: z + depth },
      { x: x, y: y + height, z: z + depth }
    ];
  };
  
  // Calculate center point of item
  export const calculateCenter = (x, y, z, width, height, depth) => {
    return {
      x: x + width / 2,
      y: y + height / 2,
      z: z + depth / 2
    };
  };
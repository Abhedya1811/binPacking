// Validate container dimensions
export const validateContainer = (container) => {
    const errors = [];
    const { width, height, depth } = container;
    
    if (!width || width <= 0) errors.push('Width must be positive');
    if (!height || height <= 0) errors.push('Height must be positive');
    if (!depth || depth <= 0) errors.push('Depth must be positive');
    
    if (width > 100) errors.push('Width exceeds maximum (100m)');
    if (height > 50) errors.push('Height exceeds maximum (50m)');
    if (depth > 100) errors.push('Depth exceeds maximum (100m)');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };
  
  // Validate item dimensions
  export const validateItem = (item) => {
    const errors = [];
    const { name, width, height, depth, quantity } = item;
    
    if (!name || name.trim() === '') errors.push('Item name is required');
    if (!width || width <= 0) errors.push('Width must be positive');
    if (!height || height <= 0) errors.push('Height must be positive');
    if (!depth || depth <= 0) errors.push('Depth must be positive');
    if (!quantity || quantity <= 0) errors.push('Quantity must be positive');
    
    if (width > 20) errors.push('Width exceeds maximum (20m)');
    if (height > 20) errors.push('Height exceeds maximum (20m)');
    if (depth > 20) errors.push('Depth exceeds maximum (20m)');
    if (quantity > 1000) errors.push('Quantity exceeds maximum (1000)');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };
  
  // Validate if item fits in container
  export const validateItemFits = (item, container) => {
    const { width: iw, height: ih, depth: id } = item;
    const { width: cw, height: ch, depth: cd } = container;
    
    // Check if any dimension is larger than container
    if (iw > cw || ih > ch || id > cd) {
      return {
        fits: false,
        reason: 'Item dimensions exceed container dimensions'
      };
    }
    
    // Check volume
    const itemVolume = iw * ih * id;
    const containerVolume = cw * ch * cd;
    
    if (itemVolume > containerVolume) {
      return {
        fits: false,
        reason: 'Item volume exceeds container volume'
      };
    }
    
    return {
      fits: true,
      reason: 'Item fits in container'
    };
  };
  
  // Validate packing options
  export const validatePackingOptions = (options) => {
    const errors = [];
    const { algorithm, rotation } = options;
    
    const validAlgorithms = [
      'maximal-rectangles',
      'guillotine',
      'skyline',
      'genetic'
    ];
    
    if (!validAlgorithms.includes(algorithm)) {
      errors.push(`Invalid algorithm. Must be one of: ${validAlgorithms.join(', ')}`);
    }
    
    const validRotations = ['all', 'height-only', 'none'];
    if (!validRotations.includes(rotation)) {
      errors.push(`Invalid rotation. Must be one of: ${validRotations.join(', ')}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };
  
  // Calculate total items validation
  export const validateTotalItems = (items) => {
    const totalItems = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    
    if (totalItems > 1000) {
      return {
        isValid: false,
        error: 'Maximum 1000 items allowed'
      };
    }
    
    return {
      isValid: true,
      count: totalItems
    };
  };
  
  // Sanitize input values
  export const sanitizeInput = (value, type = 'number') => {
    if (type === 'number') {
      const num = parseFloat(value);
      return isNaN(num) ? 0 : Math.max(0, num);
    }
    
    if (type === 'string') {
      return String(value).trim().slice(0, 100); // Limit to 100 chars
    }
    
    return value;
  };
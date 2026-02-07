// Generate random color
export const generateRandomColor = () => {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 70 + Math.floor(Math.random() * 20); // 70-90%
    const lightness = 50 + Math.floor(Math.random() * 20); // 50-70%
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };
  
  // Generate color based on index (for consistent item colors)
  export const getColorByIndex = (index) => {
    const colors = [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // yellow
      '#ef4444', // red
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#06b6d4', // cyan
      '#84cc16', // lime
      '#f97316', // orange
      '#6366f1', // indigo
      '#14b8a6', // teal
      '#f43f5e'  // rose
    ];
    return colors[index % colors.length];
  };
  
  // Generate color palette for items
  export const generateColorPalette = (count) => {
    const colors = [];
    const hueStep = 360 / count;
    
    for (let i = 0; i < count; i++) {
      const hue = (i * hueStep) % 360;
      colors.push(`hsl(${hue}, 70%, 60%)`);
    }
    
    return colors;
  };
  
  // Get contrasting text color for background
  export const getContrastColor = (backgroundColor) => {
    // Convert hex to RGB
    let r, g, b;
    
    if (backgroundColor.startsWith('#')) {
      const hex = backgroundColor.replace('#', '');
      r = parseInt(hex.substr(0, 2), 16);
      g = parseInt(hex.substr(2, 2), 16);
      b = parseInt(hex.substr(4, 2), 16);
    } else if (backgroundColor.startsWith('hsl')) {
      // Parse HSL
      const hsl = backgroundColor.match(/\d+/g);
      r = parseInt(hsl[0]);
      g = parseInt(hsl[1]);
      b = parseInt(hsl[2]);
    } else {
      return '#000000'; // Default black
    }
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return black or white based on luminance
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };
  
  // Lighten/darken color
  export const adjustColor = (color, amount) => {
    // For HSL colors
    if (color.startsWith('hsl')) {
      const hsl = color.match(/\d+/g);
      let l = parseInt(hsl[2]);
      l = Math.min(100, Math.max(0, l + amount));
      return `hsl(${hsl[0]}, ${hsl[1]}%, ${l}%)`;
    }
    
    // For hex colors (simplified)
    return color;
  };
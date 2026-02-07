const API_BASE_URL = 'http://127.0.0.1:8000/api';

export const api = {
  async calculatePacking(data) {
    console.log('📤 [api.js] Received data:', data);
    
    // FIXED: Use the correct data structure
    const requestData = {
      bin_config: {
        width: parseFloat(data.binWidth || 100),
        height: parseFloat(data.binHeight || 80),
        depth: parseFloat(data.binDepth || 60),
        max_weight: parseFloat(data.maxWeight || 500),
        name: data.binName || "Container"
      },
      
      items: data.items.map((item, index) => ({
        id: String(item.id || `item_${Date.now()}_${index}`),
        name: item.name || "Item",
        width: parseFloat(item.width),
        height: parseFloat(item.height),
        depth: parseFloat(item.depth),
        weight: parseFloat(item.weight || 0),
        quantity: parseInt(item.quantity || 1),
        can_rotate: item.canRotate !== false,
        // ✅ Convert HSL to hex or send null
        color: this._hslToHex(item.color) || null
      })),
      
      algorithm: data.algorithm || "maxrects"
    };
    
    console.log("📤 [api.js] Sending request to backend:", JSON.stringify(requestData, null, 2));

    const response = await fetch(`${API_BASE_URL}/packing/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ [api.js] API error response:", errorText);
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log("📥 [api.js] Received response from backend:", result);
    return result; // Return raw response
  },

  // Helper function to convert HSL to hex
  _hslToHex(hslString) {
    if (!hslString || !hslString.startsWith('hsl(')) {
      return hslString;
    }
    
    try {
      const matches = hslString.match(/hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
      if (!matches) return null;
      
      const h = parseInt(matches[1]) / 360;
      const s = parseInt(matches[2]) / 100;
      const l = parseInt(matches[3]) / 100;
      
      let r, g, b;
      
      if (s === 0) {
        r = g = b = l;
      } else {
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      
      const toHex = (x) => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };
      
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } catch (error) {
      console.warn('Failed to convert HSL to hex:', error);
      return null;
    }
  },

  // Quick test endpoint
  async testConnection() {
    const testData = {
      binWidth: 100,
      binHeight: 80,
      binDepth: 60,
      maxWeight: 500,
      binName: "Test Container",
      items: [
        {
          id: "test_item_1",
          name: "Test Box",
          width: 30,
          height: 20,
          depth: 15,
          weight: 5,
          quantity: 1,
          canRotate: true,
          color: "#FF6B6B"
        }
      ],
      algorithm: "maxrects"
    };

    return this.calculatePacking(testData);
  },

  // Get packing algorithms
  async getAlgorithms() {
    const response = await fetch(`${API_BASE_URL}/packing/algorithms`);
    return await response.json();
  },
};
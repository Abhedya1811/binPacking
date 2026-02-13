import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

const PackingReportGenerator = forwardRef(({ 
  packingResult, 
  containerRef, 
  canvasRef,
  showCamera = true // Default to true for backward compatibility
}, ref) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedAngles, setSavedAngles] = useState([]);
  const [showAngleMenu, setShowAngleMenu] = useState(false);
  const angleMenuRef = useRef(null);
  const cameraButtonRef = useRef(null);

  // Load saved angles from localStorage on mount
  useEffect(() => {
    const loadSavedAngles = () => {
      try {
        const saved = localStorage.getItem('packingSavedAngles');
        if (saved) {
          const parsed = JSON.parse(saved);
          console.log('📸 Loaded saved angles from localStorage:', parsed.length);
          setSavedAngles(parsed);
        }
      } catch (e) {
        console.error('Failed to load from localStorage:', e);
      }
    };
    
    loadSavedAngles();
  }, []);

  // Monitor savedAngles changes
  useEffect(() => {
    console.log('📸 savedAngles state changed:', savedAngles.length);
  }, [savedAngles]);

  // Close angle menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (angleMenuRef.current && !angleMenuRef.current.contains(event.target) &&
          cameraButtonRef.current && !cameraButtonRef.current.contains(event.target)) {
        setShowAngleMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Capture 3D view from canvas
  const captureCanvas = async () => {
    if (!canvasRef?.current) {
      console.error('Canvas ref is null or undefined');
      return null;
    }
    
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      let canvasElement = null;
      
      if (canvasRef.current.getCanvas && typeof canvasRef.current.getCanvas === 'function') {
        canvasElement = canvasRef.current.getCanvas();
      } 
      else if (canvasRef.current instanceof HTMLCanvasElement) {
        canvasElement = canvasRef.current;
      }
      else if (canvasRef.current && canvasRef.current.current instanceof HTMLCanvasElement) {
        canvasElement = canvasRef.current.current;
      }
      else if (canvasRef.current && canvasRef.current.querySelector) {
        canvasElement = canvasRef.current.querySelector('canvas');
      }
      
      if (!canvasElement) {
        console.error('Could not find canvas element');
        return null;
      }
      
      if (!(canvasElement instanceof HTMLCanvasElement)) {
        console.error('Element is not a canvas');
        return null;
      }
      
      const dataUrl = canvasElement.toDataURL('image/png');
      return dataUrl;
    } catch (error) {
      console.error('Error capturing canvas:', error);
      return null;
    }
  };

  // Save current camera angle - NO POPUP
  const saveCurrentAngle = async () => {
    if (savedAngles.length >= 10) {
      return;
    }

    const imageData = await captureCanvas();
    if (!imageData) {
      return;
    }

    const newAngle = {
      id: Date.now(),
      timestamp: new Date().toLocaleString(),
      imageData,
      name: `Angle ${savedAngles.length + 1}`
    };
    
    setSavedAngles(prevAngles => {
      const updated = [...prevAngles, newAngle];
      // Save to localStorage for persistence
      localStorage.setItem('packingSavedAngles', JSON.stringify(updated));
      return updated;
    });
    
    setShowAngleMenu(false);
  };

  // Delete saved angle
  const deleteAngle = (id) => {
    setSavedAngles(prevAngles => {
      const updated = prevAngles.filter(angle => angle.id !== id);
      localStorage.setItem('packingSavedAngles', JSON.stringify(updated));
      return updated;
    });
  };

  // Rename angle
  const renameAngle = (id, newName) => {
    setSavedAngles(prevAngles => {
      const updated = prevAngles.map(angle => 
        angle.id === id ? { ...angle, name: newName } : angle
      );
      localStorage.setItem('packingSavedAngles', JSON.stringify(updated));
      return updated;
    });
  };

  // Clear all angles
  const clearAllAngles = () => {
    if (savedAngles.length > 0) {
      setSavedAngles([]);
      localStorage.removeItem('packingSavedAngles');
      setShowAngleMenu(false);
    }
  };

  // Calculate total volume
  const calculateTotalVolume = (result) => {
    try {
      const items = result?.visualization_data?.items || 
                   result?.bins?.[0]?.items || 
                   result?.packedItems || [];
      
      return items.reduce((sum, item) => {
        try {
          const [w, h, d] = item.dimensions || [0, 0, 0];
          return sum + (w * h * d * (item.quantity || 1));
        } catch (e) {
          return sum;
        }
      }, 0);
    } catch (e) {
      return 0;
    }
  };

  // Generate step-by-step instructions with colors
  const generateStepByStepInstructions = (items) => {
    if (!items || items.length === 0) return [];
    
    // Sort items by layer (y-position) then by x and z
    const sortedItems = [...items].sort((a, b) => {
      if (a.position[1] !== b.position[1]) return a.position[1] - b.position[1];
      if (a.position[0] !== b.position[0]) return a.position[0] - b.position[0];
      return a.position[2] - b.position[2];
    });
    
    return sortedItems.map((item, index) => {
      const [w, h, d] = item.dimensions || [0, 0, 0];
      const [x, y, z] = item.position || [0, 0, 0];
      const [rx, ry, rz] = item.rotation || [0, 0, 0];
      
      return {
        step: index + 1,
        name: item.name || item.id || `Item ${index + 1}`,
        color: item.color || '#cccccc',
        dimensions: `${w.toFixed(2)} × ${h.toFixed(2)} × ${d.toFixed(2)} m`,
        position: `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`,
        rotation: rx !== 0 || ry !== 0 || rz !== 0 ? `(${rx}°, ${ry}°, ${rz}°)` : 'No rotation',
        volume: (w * h * d * (item.quantity || 1)).toFixed(3)
      };
    });
  };

  // Generate PDF Report with dynamic pages for up to 10 photos
  const generatePDF = async () => {
    setIsGenerating(true);
    
    // Try to get angles from multiple sources
    let anglesToUse = [];
    
    // First try from state
    if (savedAngles && savedAngles.length > 0) {
      anglesToUse = [...savedAngles];
      console.log('📸 Using angles from state:', anglesToUse.length);
    } 
    // Then try from localStorage
    else {
      try {
        const saved = localStorage.getItem('packingSavedAngles');
        if (saved) {
          anglesToUse = JSON.parse(saved);
          console.log('📸 Using angles from localStorage:', anglesToUse.length);
          // Update state with localStorage values
          setSavedAngles(anglesToUse);
        }
      } catch (e) {
        console.error('Error loading from localStorage:', e);
      }
    }
    
    console.log('📸 Final anglesToUse length:', anglesToUse.length);
    
    try {
      // Use standard A4 portrait
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Cover Page
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('3D Bin Packing Report', 20, 25);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 55);
      
      // Container Info
      let containerWidth = 17, containerHeight = 8, containerDepth = 10;
      
      try {
        if (packingResult?.visualization_data?.container) {
          const container = packingResult.visualization_data.container;
          containerWidth = parseFloat(container.width) || 17;
          containerHeight = parseFloat(container.height) || 8;
          containerDepth = parseFloat(container.depth) || 10;
        } else if (packingResult?.bins?.[0]?.dimensions) {
          const dims = packingResult.bins[0].dimensions;
          containerWidth = parseFloat(dims[0]) || 17;
          containerHeight = parseFloat(dims[1]) || 8;
          containerDepth = parseFloat(dims[2]) || 10;
        }
      } catch (e) {}
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Container Dimensions', 20, 75);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Width: ${containerWidth.toFixed(1)} m`, 20, 90);
      doc.text(`Height: ${containerHeight.toFixed(1)} m`, 20, 100);
      doc.text(`Depth: ${containerDepth.toFixed(1)} m`, 20, 110);
      doc.text(`Volume: ${(containerWidth * containerHeight * containerDepth).toFixed(2)} m³`, 20, 120);
      
      // Statistics
      const packedItems = packingResult?.visualization_data?.items?.length || 
                         packingResult?.bins?.[0]?.items?.length || 
                         packingResult?.packedItems?.length || 0;
      
      const unpackedItems = packingResult?.visualization_data?.unpacked_items?.length ||
                           packingResult?.unpacked_items?.length || 0;
      
      const totalVolume = calculateTotalVolume(packingResult);
      const containerVolume = containerWidth * containerHeight * containerDepth;
      const efficiency = containerVolume > 0 ? (totalVolume / containerVolume) * 100 : 0;
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Packing Statistics', 120, 75);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Packed Items: ${packedItems}`, 120, 90);
      doc.text(`Unpacked Items: ${unpackedItems}`, 120, 100);
      doc.text(`Total Volume: ${totalVolume.toFixed(2)} m³`, 120, 110);
      doc.text(`Space Utilization: ${efficiency.toFixed(1)}%`, 120, 120);
      
      // Camera Angles Pages - DYNAMIC PAGES for up to 10 photos (3 per page)
      if (anglesToUse && anglesToUse.length > 0) {
        console.log('📸 Adding', anglesToUse.length, 'angles to PDF');
        
        // Group angles into chunks of 3 per page
        const angleChunks = [];
        for (let i = 0; i < anglesToUse.length; i += 3) {
          angleChunks.push(anglesToUse.slice(i, i + 3));
        }
        
        console.log('📸 Created', angleChunks.length, 'pages with', angleChunks.map(c => c.length).join(', '), 'images per page');
        
        angleChunks.forEach((chunk, pageIndex) => {
          doc.addPage();
          
          doc.setFontSize(18);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(59, 130, 246);
          doc.text(`Camera Angles - Page ${pageIndex + 1} of ${angleChunks.length}`, 20, 20);
          doc.setTextColor(0, 0, 0);
          
          // Calculate layout based on number of images on this page
          const imagesOnPage = chunk.length;
          const imgWidth = pageWidth - 40; // Full width minus margins
          const imgHeight = 70; // Fixed height
          const spacing = 15; // Space between images
          const startY = 40;
          
          // Place images vertically
          chunk.forEach((angle, index) => {
            const y = startY + (imgHeight + spacing) * index;
            
            try {
              // Add image - full width
              doc.addImage(angle.imageData, 'PNG', 20, y, imgWidth, imgHeight);
              
              // Add title/label below image
              doc.setFontSize(10);
              doc.setFont('helvetica', 'bold');
              doc.text(angle.name, 20, y + imgHeight + 5);
              
              // Add timestamp
              doc.setFontSize(8);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(100, 100, 100);
              doc.text(angle.timestamp, 20, y + imgHeight + 12);
              doc.setTextColor(0, 0, 0);
            } catch (e) {
              console.error('Error adding image to PDF:', e);
            }
          });
          
          // Add caption at bottom of page
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(150, 150, 150);
          doc.text(`Page ${pageIndex + 1} of ${angleChunks.length} • ${chunk.length} angle${chunk.length !== 1 ? 's' : ''}`, 20, 280);
          doc.setTextColor(0, 0, 0);
        });
      } else {
        console.log('📸 No angles to add to PDF');
        // Optional: Add a note that no angles were saved
        doc.addPage();
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text('Camera Angles', 20, 20);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.text('No camera angles were saved for this report.', 20, 50);
        doc.text('Use the camera button (📸) to save different views.', 20, 70);
      }
      
      // Step-by-Step Packing Instructions with COLOR BACKGROUND
      const items = packingResult?.visualization_data?.items || 
                   packingResult?.bins?.[0]?.items || 
                   packingResult?.packedItems || [];
      
      if (items.length > 0) {
        doc.addPage();
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text('Step-by-Step Packing Instructions', 20, 20);
        doc.setTextColor(0, 0, 0);
        
        const instructions = generateStepByStepInstructions(items);
        
        // Create step-by-step table with COLOR BACKGROUND for item names
        const stepData = instructions.map(step => [
          step.step,
          step.name,
          step.dimensions,
          step.position,
          step.rotation,
          `${step.volume} m³`
        ]);
        
        doc.autoTable({
          startY: 30,
          head: [['Step', 'Item', 'Dimensions', 'Position', 'Rotation', 'Volume']],
          body: stepData,
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246], textColor: 255 },
          styles: { fontSize: 9 },
          // Add COLOR BACKGROUND to item names
          didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 1) {
              const item = instructions[data.row.index];
              if (item && item.color) {
                const { x, y, width, height } = data.cell;
                // Fill the entire cell with the color
                doc.setFillColor(item.color);
                doc.rect(x, y, width, height, 'F');
                // Redraw the text in black on top
                doc.setTextColor(0, 0, 0);
                doc.setFont('helvetica', 'normal');
                doc.text(item.name, x + 2, y + (height/2) + 2);
              }
            }
          }
        });
      }
      
      // Packed Items Details Table with COLOR BACKGROUND
      if (items.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Packed Items Details', 20, 20);
        
        const tableData = items.map((item, index) => {
          try {
            const [w, h, d] = item.dimensions || [0, 0, 0];
            const [x, y, z] = item.position || [0, 0, 0];
            const volume = (w * h * d * (item.quantity || 1)).toFixed(3);
            
            return [
              index + 1,
              item.name || item.id || `Item ${index + 1}`,
              `${w.toFixed(2)}×${h.toFixed(2)}×${d.toFixed(2)}`,
              item.quantity || 1,
              `${volume} m³`,
              `(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`
            ];
          } catch (e) {
            return [index + 1, 'Error', '0×0×0', 1, '0 m³', '(0,0,0)'];
          }
        });
        
        doc.autoTable({
          startY: 30,
          head: [['#', 'Item Name', 'Dimensions (m)', 'Qty', 'Volume', 'Position']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246], textColor: 255 },
          styles: { fontSize: 10 },
          // Add COLOR BACKGROUND to item names
          didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 1) {
              const item = items[data.row.index];
              if (item && item.color) {
                const { x, y, width, height } = data.cell;
                // Fill the entire cell with the color
                doc.setFillColor(item.color);
                doc.rect(x, y, width, height, 'F');
                // Redraw the text in black on top
                doc.setTextColor(0, 0, 0);
                doc.setFont('helvetica', 'normal');
                const displayName = item.name || item.id || `Item ${data.row.index + 1}`;
                doc.text(displayName, x + 2, y + (height/2) + 2);
              }
            }
          }
        });
      }
      
      // Unpacked Items Table
      const unpacked = packingResult?.visualization_data?.unpacked_items ||
                      packingResult?.unpacked_items || [];
      
      if (unpacked.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38);
        doc.text('Unpacked Items', 20, 20);
        doc.setTextColor(0, 0, 0);
        
        const unpackedData = unpacked.map((item, index) => {
          try {
            const [w, h, d] = item.dimensions || [0, 0, 0];
            const volume = (w * h * d * (item.quantity || 1)).toFixed(3);
            
            return [
              index + 1,
              item.name || item.id || `Item ${index + 1}`,
              `${w.toFixed(2)}×${h.toFixed(2)}×${d.toFixed(2)}`,
              item.quantity || 1,
              `${volume} m³`,
              item.reason || 'No space available'
            ];
          } catch (e) {
            return [index + 1, 'Error', '0×0×0', 1, '0 m³', 'Unknown'];
          }
        });
        
        doc.autoTable({
          startY: 30,
          head: [['#', 'Item Name', 'Dimensions (m)', 'Qty', 'Volume', 'Reason']],
          body: unpackedData,
          theme: 'grid',
          headStyles: { fillColor: [220, 38, 38], textColor: 255 },
          styles: { fontSize: 10 },
          // Add COLOR BACKGROUND to item names
          didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 1) {
              const item = unpacked[data.row.index];
              if (item && item.color) {
                const { x, y, width, height } = data.cell;
                // Fill the entire cell with the color
                doc.setFillColor(item.color);
                doc.rect(x, y, width, height, 'F');
                // Redraw the text in black on top
                doc.setTextColor(0, 0, 0);
                doc.setFont('helvetica', 'normal');
                const displayName = item.name || item.id || `Item ${data.row.index + 1}`;
                doc.text(displayName, x + 2, y + (height/2) + 2);
              }
            }
          }
        });
      }
      
      // Save PDF - ANGLES ARE NOT CLEARED
      doc.save(`packing-report-${new Date().toISOString().split('T')[0]}.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate Excel Report
  const generateExcel = () => {
    setIsGenerating(true);
    
    try {
      const wb = XLSX.utils.book_new();
      
      // Container Info
      let containerWidth = 17, containerHeight = 8, containerDepth = 10;
      
      try {
        if (packingResult?.visualization_data?.container) {
          const container = packingResult.visualization_data.container;
          containerWidth = parseFloat(container.width) || 17;
          containerHeight = parseFloat(container.height) || 8;
          containerDepth = parseFloat(container.depth) || 10;
        } else if (packingResult?.bins?.[0]?.dimensions) {
          const dims = packingResult.bins[0].dimensions;
          containerWidth = parseFloat(dims[0]) || 17;
          containerHeight = parseFloat(dims[1]) || 8;
          containerDepth = parseFloat(dims[2]) || 10;
        }
      } catch (e) {}
      
      const containerData = [
        ['CONTAINER INFORMATION'],
        ['Dimension', 'Value (m)'],
        ['Width', containerWidth],
        ['Height', containerHeight],
        ['Depth', containerDepth],
        ['Volume', `${(containerWidth * containerHeight * containerDepth).toFixed(2)} m³`],
        [],
        ['PACKING SUMMARY'],
        ['Metric', 'Value'],
        ['Packed Items', packingResult?.visualization_data?.items?.length || packingResult?.bins?.[0]?.items?.length || packingResult?.packedItems?.length || 0],
        ['Unpacked Items', packingResult?.visualization_data?.unpacked_items?.length || packingResult?.unpacked_items?.length || 0],
        ['Total Volume', `${calculateTotalVolume(packingResult).toFixed(2)} m³`],
        ['Space Utilization', `${((calculateTotalVolume(packingResult) / (containerWidth * containerHeight * containerDepth)) * 100).toFixed(1)}%`]
      ];
      
      const containerSheet = XLSX.utils.aoa_to_sheet(containerData);
      XLSX.utils.book_append_sheet(wb, containerSheet, 'Summary');
      
      // Packed Items with Colors
      const items = packingResult?.visualization_data?.items || 
                   packingResult?.bins?.[0]?.items || 
                   packingResult?.packedItems || [];
      
      const packedData = [
        ['ID', 'Name', 'Color', 'Width (m)', 'Height (m)', 'Depth (m)', 'Quantity', 'Volume (m³)', 'Position X', 'Position Y', 'Position Z', 'Rotation X', 'Rotation Y', 'Rotation Z']
      ];
      
      items.forEach(item => {
        try {
          const [w, h, d] = item.dimensions || [0, 0, 0];
          const [x, y, z] = item.position || [0, 0, 0];
          const [rx, ry, rz] = item.rotation || [0, 0, 0];
          const volume = (w * h * d * (item.quantity || 1)).toFixed(3);
          
          packedData.push([
            item.id || '',
            item.name || '',
            item.color || '#10b981',
            w,
            h,
            d,
            item.quantity || 1,
            volume,
            x,
            y,
            z,
            rx,
            ry,
            rz
          ]);
        } catch (e) {}
      });
      
      const packedSheet = XLSX.utils.aoa_to_sheet(packedData);
      XLSX.utils.book_append_sheet(wb, packedSheet, 'Packed Items');
      
      // Step-by-Step Instructions
      if (items.length > 0) {
        const instructions = generateStepByStepInstructions(items);
        const stepData = [
          ['Step', 'Item Name', 'Color', 'Dimensions (m)', 'Position', 'Rotation', 'Volume (m³)'],
          ...instructions.map(step => [
            step.step,
            step.name,
            step.color,
            step.dimensions,
            step.position,
            step.rotation,
            step.volume
          ])
        ];
        
        const stepSheet = XLSX.utils.aoa_to_sheet(stepData);
        XLSX.utils.book_append_sheet(wb, stepSheet, 'Step-by-Step');
      }
      
      // Unpacked Items
      const unpacked = packingResult?.visualization_data?.unpacked_items ||
                      packingResult?.unpacked_items || [];
      
      if (unpacked.length > 0) {
        const unpackedData = [
          ['ID', 'Name', 'Color', 'Width (m)', 'Height (m)', 'Depth (m)', 'Quantity', 'Volume (m³)', 'Reason']
        ];
        
        unpacked.forEach(item => {
          try {
            const [w, h, d] = item.dimensions || [0, 0, 0];
            const volume = (w * h * d * (item.quantity || 1)).toFixed(3);
            
            unpackedData.push([
              item.id || '',
              item.name || '',
              item.color || '#ef4444',
              w,
              h,
              d,
              item.quantity || 1,
              volume,
              item.reason || 'No space available'
            ]);
          } catch (e) {}
        });
        
        const unpackedSheet = XLSX.utils.aoa_to_sheet(unpackedData);
        XLSX.utils.book_append_sheet(wb, unpackedSheet, 'Unpacked Items');
      }
      
      // Camera Angles Sheet
      if (savedAngles.length > 0) {
        const anglesData = [
          ['SAVED CAMERA ANGLES'],
          ['Name', 'Timestamp'],
          ...savedAngles.map(angle => [angle.name, angle.timestamp])
        ];
        
        const anglesSheet = XLSX.utils.aoa_to_sheet(anglesData);
        XLSX.utils.book_append_sheet(wb, anglesSheet, 'Camera Angles');
      }
      
      XLSX.writeFile(wb, `packing-data-${new Date().toISOString().split('T')[0]}.xlsx`);
      
    } catch (error) {
      console.error('Error generating Excel:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate HTML Report
  const generateHTML = async () => {
    setIsGenerating(true);
    
    try {
      const imageData = await captureCanvas();
      
      // Container dimensions
      let containerWidth = 17, containerHeight = 8, containerDepth = 10;
      
      try {
        if (packingResult?.visualization_data?.container) {
          const container = packingResult.visualization_data.container;
          containerWidth = parseFloat(container.width) || 17;
          containerHeight = parseFloat(container.height) || 8;
          containerDepth = parseFloat(container.depth) || 10;
        } else if (packingResult?.bins?.[0]?.dimensions) {
          const dims = packingResult.bins[0].dimensions;
          containerWidth = parseFloat(dims[0]) || 17;
          containerHeight = parseFloat(dims[1]) || 8;
          containerDepth = parseFloat(dims[2]) || 10;
        }
      } catch (e) {}
      
      const packedItems = packingResult?.visualization_data?.items?.length || 
                         packingResult?.bins?.[0]?.items?.length || 
                         packingResult?.packedItems?.length || 0;
      
      const unpackedItems = packingResult?.visualization_data?.unpacked_items?.length ||
                           packingResult?.unpacked_items?.length || 0;
      
      const totalVolume = calculateTotalVolume(packingResult);
      const containerVolume = containerWidth * containerHeight * containerDepth;
      const efficiency = containerVolume > 0 ? (totalVolume / containerVolume) * 100 : 0;
      
      const items = packingResult?.visualization_data?.items || 
                   packingResult?.bins?.[0]?.items || 
                   packingResult?.packedItems || [];
      
      const unpacked = packingResult?.visualization_data?.unpacked_items ||
                      packingResult?.unpacked_items || [];
      
      // Generate step-by-step instructions HTML with colors
      const instructions = generateStepByStepInstructions(items);
      const instructionsHTML = instructions.map(step => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${step.step}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; background-color: ${step.color};">${step.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${step.dimensions}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${step.position}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${step.rotation}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${step.volume}</td>
        </tr>
      `).join('');
      
      // Generate camera angles HTML
      const cameraAnglesHTML = savedAngles.map((angle, index) => `
        <div class="camera-angle-card">
          <div class="camera-angle-header">
            <span class="camera-angle-name">${angle.name}</span>
            <span class="camera-angle-time">${angle.timestamp}</span>
          </div>
          <img src="${angle.imageData}" alt="${angle.name}" class="camera-angle-image" />
        </div>
      `).join('');
      
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>3D Bin Packing Report</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f1f5f9;
                padding: 40px 20px;
              }
              .report {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                border-radius: 24px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                overflow: hidden;
              }
              .header {
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                padding: 40px;
                color: white;
              }
              .title {
                font-size: 32px;
                font-weight: 700;
                margin-bottom: 8px;
              }
              .date {
                font-size: 14px;
                opacity: 0.9;
              }
              .stats-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 20px;
                padding: 40px;
                background: #f8fafc;
              }
              .stat-card {
                background: white;
                padding: 24px;
                border-radius: 16px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                border-left: 4px solid #3b82f6;
              }
              .stat-label {
                font-size: 12px;
                text-transform: uppercase;
                color: #64748b;
                letter-spacing: 1px;
                margin-bottom: 8px;
              }
              .stat-value {
                font-size: 32px;
                font-weight: 700;
                color: #0f172a;
              }
              .stat-unit {
                font-size: 14px;
                color: #64748b;
                margin-left: 4px;
              }
              .camera-angles {
                padding: 40px;
                background: #f8fafc;
              }
              .camera-angles-title {
                font-size: 20px;
                font-weight: 600;
                color: #0f172a;
                margin-bottom: 24px;
                display: flex;
                align-items: center;
                gap: 8px;
              }
              .camera-angles-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 24px;
              }
              .camera-angle-card {
                background: white;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                border: 1px solid #e2e8f0;
              }
              .camera-angle-header {
                padding: 12px;
                background: #f1f5f9;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
              }
              .camera-angle-name {
                font-weight: 600;
                color: #0f172a;
                font-size: 13px;
              }
              .camera-angle-time {
                font-size: 11px;
                color: #64748b;
              }
              .camera-angle-image {
                width: 100%;
                height: 180px;
                object-fit: cover;
              }
              .section {
                padding: 40px;
                border-top: 1px solid #e2e8f0;
              }
              .section-title {
                font-size: 20px;
                font-weight: 600;
                color: #0f172a;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                gap: 8px;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                font-size: 14px;
              }
              th {
                background: #3b82f6;
                color: white;
                padding: 12px;
                text-align: left;
                font-weight: 600;
              }
              td {
                padding: 12px;
                border-bottom: 1px solid #e2e8f0;
              }
              tr:hover {
                background: #f1f5f9;
              }
              .packed-row td {
                background: #f0fdf4;
              }
              .unpacked-row td {
                background: #fef2f2;
              }
              .badge {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
              }
              .badge-success {
                background: #dcfce7;
                color: #059669;
              }
              .badge-error {
                background: #fee2e2;
                color: #dc2626;
              }
              .footer {
                padding: 30px;
                text-align: center;
                color: #64748b;
                font-size: 12px;
                border-top: 1px solid #e2e8f0;
              }
              .print-button {
                position: fixed;
                bottom: 30px;
                right: 30px;
                background: #3b82f6;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 50px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(59,130,246,0.4);
                display: flex;
                align-items: center;
                gap: 8px;
                z-index: 1000;
              }
              .print-button:hover {
                background: #2563eb;
              }
              @media print {
                body { background: white; }
                .print-button { display: none; }
                .report { box-shadow: none; }
              }
            </style>
          </head>
          <body>
            <div class="report">
              <div class="header">
                <div class="title">📦 3D Bin Packing Report</div>
                <div class="date">Generated: ${new Date().toLocaleString()}</div>
              </div>
              
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-label">Container</div>
                  <div class="stat-value">${containerWidth.toFixed(1)}×${containerHeight.toFixed(1)}×${containerDepth.toFixed(1)}</div>
                  <div class="stat-unit">meters</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Packed Items</div>
                  <div class="stat-value">${packedItems}</div>
                  <div class="stat-unit">units</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Unpacked Items</div>
                  <div class="stat-value">${unpackedItems}</div>
                  <div class="stat-unit">units</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Utilization</div>
                  <div class="stat-value">${efficiency.toFixed(1)}%</div>
                  <div class="stat-unit">space</div>
                </div>
              </div>
              
              ${savedAngles.length > 0 ? `
              <div class="camera-angles">
                <div class="camera-angles-title">
                  <span>📸 Saved Camera Angles (${savedAngles.length})</span>
                </div>
                <div class="camera-angles-grid">
                  ${cameraAnglesHTML}
                </div>
              </div>
              ` : ''}
              
              <div class="section">
                <div class="section-title">
                  <span>📋 Step-by-Step Packing Instructions</span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Step</th>
                      <th>Item Name</th>
                      <th>Dimensions (m)</th>
                      <th>Position</th>
                      <th>Rotation</th>
                      <th>Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${instructionsHTML}
                  </tbody>
                </table>
              </div>
              
              <div class="section">
                <div class="section-title">
                  <span>📋 Packed Items (${items.length})</span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item Name</th>
                      <th>Dimensions (m)</th>
                      <th>Qty</th>
                      <th>Volume (m³)</th>
                      <th>Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.map((item, i) => {
                      try {
                        const [w, h, d] = item.dimensions || [0, 0, 0];
                        const [x, y, z] = item.position || [0, 0, 0];
                        const volume = (w * h * d * (item.quantity || 1)).toFixed(3);
                        return `
                          <tr class="packed-row">
                            <td><strong>${i + 1}</strong></td>
                            <td style="background-color: ${item.color || '#10b981'};">${item.name || item.id || `Item ${i + 1}`}</td>
                            <td>${w.toFixed(2)}×${h.toFixed(2)}×${d.toFixed(2)}</td>
                            <td>${item.quantity || 1}</td>
                            <td>${volume}</td>
                            <td>(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})</td>
                          </tr>
                        `;
                      } catch (e) {
                        return '';
                      }
                    }).join('')}
                  </tbody>
                </table>
              </div>
              
              ${unpacked.length > 0 ? `
              <div class="section">
                <div class="section-title">
                  <span>⚠️ Unpacked Items (${unpacked.length})</span>
                </div>
                <table>
                  <thead>
                    <tr style="background: #dc2626;">
                      <th>#</th>
                      <th>Item Name</th>
                      <th>Dimensions (m)</th>
                      <th>Qty</th>
                      <th>Volume (m³)</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${unpacked.map((item, i) => {
                      try {
                        const [w, h, d] = item.dimensions || [0, 0, 0];
                        const volume = (w * h * d * (item.quantity || 1)).toFixed(3);
                        return `
                          <tr class="unpacked-row">
                            <td><strong>${i + 1}</strong></td>
                            <td style="background-color: ${item.color || '#ef4444'};">${item.name || item.id || `Item ${i + 1}`}</td>
                            <td>${w.toFixed(2)}×${h.toFixed(2)}×${d.toFixed(2)}</td>
                            <td>${item.quantity || 1}</td>
                            <td>${volume}</td>
                            <td style="color: #dc2626;">${item.reason || 'No space available'}</td>
                          </tr>
                        `;
                      } catch (e) {
                        return '';
                      }
                    }).join('')}
                  </tbody>
                </table>
              </div>
              ` : ''}
              
              <div class="footer">
                <p>Generated by 3D Bin Packing System • ${new Date().toLocaleString()}</p>
              </div>
            </div>
          </body>
        </html>
      `;
      
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      win.document.title = '3D Packing Report';
      
    } catch (error) {
      console.error('Error generating HTML:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    generatePDF,
    generateExcel,
    generateHTML,
    clearSavedAngles: () => {
      setSavedAngles([]);
      localStorage.removeItem('packingSavedAngles');
    }
  }));

  return (
    <>
      {/* Camera Button - Only render if showCamera is true */}
      {showCamera && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end'
        }}>
          <div ref={cameraButtonRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowAngleMenu(!showAngleMenu)}
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '30px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span style={{ fontSize: '16px' }}>📸</span>
              Camera ({savedAngles.length}/10)
              <span style={{ fontSize: '12px', marginLeft: '4px' }}>▼</span>
            </button>

            {/* Camera Angle Menu */}
            {showAngleMenu && (
              <div
                ref={angleMenuRef}
                style={{
                  position: 'absolute',
                  bottom: '50px',
                  right: '0',
                  width: '280px',
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  zIndex: 1001
                }}
              >
                <div style={{
                  padding: '16px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                  color: 'white'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>📸</span>
                    <span style={{ fontWeight: '600', fontSize: '14px' }}>Saved Camera Angles</span>
                    <span style={{
                      marginLeft: 'auto',
                      background: 'rgba(255,255,255,0.2)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px'
                    }}>
                      {savedAngles.length}/10
                    </span>
                  </div>
                </div>

                <div style={{ padding: '12px' }}>
                  <button
                    onClick={saveCurrentAngle}
                    disabled={savedAngles.length >= 10 || isGenerating}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: savedAngles.length >= 10 || isGenerating ? '#e2e8f0' : '#8b5cf6',
                      color: savedAngles.length >= 10 || isGenerating ? '#64748b' : 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: savedAngles.length >= 10 || isGenerating ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>📸</span>
                    {isGenerating ? 'Generating...' : 'Save Current Angle'}
                  </button>
                </div>

                {savedAngles.length > 0 ? (
                  <>
                    <div style={{
                      maxHeight: '300px',
                      overflowY: 'auto',
                      borderTop: '1px solid #e2e8f0',
                      borderBottom: '1px solid #e2e8f0'
                    }}>
                      {savedAngles.map((angle) => (
                        <div
                          key={angle.id}
                          style={{
                            padding: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            borderBottom: '1px solid #f1f5f9',
                            background: '#fff'
                          }}
                        >
                          <div style={{
                            width: '50px',
                            height: '50px',
                            background: '#f1f5f9',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            flexShrink: 0,
                            border: '1px solid #e2e8f0'
                          }}>
                            <img
                              src={angle.imageData}
                              alt={angle.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <input
                              type="text"
                              value={angle.name}
                              onChange={(e) => renameAngle(angle.id, e.target.value)}
                              style={{
                                width: '100%',
                                border: 'none',
                                background: 'transparent',
                                fontSize: '13px',
                                fontWeight: '600',
                                color: '#0f172a',
                                padding: '2px 4px',
                                borderBottom: '1px dashed #cbd5e1',
                                marginBottom: '4px'
                              }}
                            />
                            <div style={{
                              fontSize: '10px',
                              color: '#64748b',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {angle.timestamp}
                            </div>
                          </div>

                          <button
                            onClick={() => deleteAngle(angle.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ fontSize: '16px' }}>🗑️</span>
                          </button>
                        </div>
                      ))}
                    </div>

                    <div style={{ padding: '12px' }}>
                      <button
                        onClick={clearAllAngles}
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: 'transparent',
                          color: '#ef4444',
                          border: '1px solid #ef4444',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        <span>🗑️</span>
                        Clear All Angles
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{
                    padding: '24px 16px',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '12px',
                    borderTop: '1px solid #e2e8f0'
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>📸</div>
                    <p>No camera angles saved yet.</p>
                    <p style={{ marginTop: '4px', fontSize: '11px' }}>
                      Click "Save Current Angle" to capture views.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
});

export default PackingReportGenerator;
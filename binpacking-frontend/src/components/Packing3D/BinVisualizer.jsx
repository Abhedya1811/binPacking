import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const BinVisualizer = ({ packingResult, isLoading, originalItems = [] }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const animationFrameId = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const [hoveredItem, setHoveredItem] = useState(null);
  const [initializationError, setInitializationError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const itemMeshesRef = useRef([]);
  const unpackedMeshesRef = useRef([]);
  const containerGroupRef = useRef(null);
  const unpackedAreaGroupRef = useRef(null);
  const [debugInfo, setDebugInfo] = useState('');
  const isRenderingRef = useRef(false);
  const isMountedRef = useRef(true);
  const [viewMode, setViewMode] = useState('3D');
  const [outOfBoundsItems, setOutOfBoundsItems] = useState([]);
  const [showUnpackedArea, setShowUnpackedArea] = useState(true);

  console.log('🎯 BinVisualizer received:', {
    hasPackingResult: !!packingResult,
    packedItems: packingResult?.packedItems?.length,
    bins: packingResult?.bins?.[0]?.items?.length,
    visualizationData: packingResult?.visualization_data?.items?.length,
    container: packingResult?.visualization_data?.container,
    unpackedItems: packingResult?.visualization_data?.unpacked_items?.length,
    hasUnpackedItems: !!packingResult?.visualization_data?.unpacked_items
  });

  // Cleanup function
  const cleanupScene = useCallback((skipSceneReset = false) => {
    console.log('🧹 Cleaning up scene...');
    
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    
    // Clean up packed items
    itemMeshesRef.current.forEach(mesh => {
      if (mesh && mesh.parent) {
        mesh.parent.remove(mesh);
      }
      if (mesh) {
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      }
    });
    itemMeshesRef.current = [];
    
    // Clean up unpacked items
    unpackedMeshesRef.current.forEach(mesh => {
      if (mesh && mesh.parent) {
        mesh.parent.remove(mesh);
      }
      if (mesh) {
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      }
    });
    unpackedMeshesRef.current = [];
    
    if (containerGroupRef.current && containerGroupRef.current.parent) {
      containerGroupRef.current.parent.remove(containerGroupRef.current);
      containerGroupRef.current.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      containerGroupRef.current = null;
    }
    
    if (unpackedAreaGroupRef.current && unpackedAreaGroupRef.current.parent) {
      unpackedAreaGroupRef.current.parent.remove(unpackedAreaGroupRef.current);
      unpackedAreaGroupRef.current.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      unpackedAreaGroupRef.current = null;
    }
    
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
    
    if (!skipSceneReset && sceneRef.current) {
      const toRemove = [];
      sceneRef.current.traverse((child) => {
        if (child.userData && (child.userData.isPackedItem || child.userData.isContainer || child.userData.isUnpackedItem || child.userData.isUnpackedArea)) {
          toRemove.push(child);
        }
      });
      
      toRemove.forEach(child => {
        if (child.parent) {
          child.parent.remove(child);
        }
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
    
    isRenderingRef.current = false;
    console.log('✅ Cleanup complete');
  }, []);

  // Initialize Three.js
  useEffect(() => {
    console.log('🔄 Initializing Three.js...');
    
    isMountedRef.current = true;
    let initAttempted = false;
    
    const initThreeJS = () => {
      if (!isMountedRef.current || !canvasRef.current || initAttempted) {
        return false;
      }
      
      initAttempted = true;

      try {
        // SCENE
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf0f4f8);
        sceneRef.current = scene;

        // CAMERA
        const camera = new THREE.PerspectiveCamera(
          60,
          canvasRef.current.clientWidth / canvasRef.current.clientHeight,
          0.1,
          1000
        );
        camera.position.set(25, 20, 25);
        camera.lookAt(0, 5, 0);
        cameraRef.current = camera;

        // RENDERER
        const renderer = new THREE.WebGLRenderer({
          canvas: canvasRef.current,
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true
        });
        
        renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        rendererRef.current = renderer;

        // CONTROLS
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 1;
        controls.maxDistance = 150;
        controls.maxPolarAngle = Math.PI / 2;
        controlsRef.current = controls;

        // LIGHTS
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(20, 30, 20);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        scene.add(directionalLight);

        // Add a second directional light from the other side
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight2.position.set(-20, 20, -20);
        scene.add(directionalLight2);

        // GRID - Larger grid for both container and unpacked area
        const gridSize = 50;
        const gridHelper = new THREE.GridHelper(gridSize, gridSize, 0xcccccc, 0xcccccc);
        gridHelper.position.y = 0;
        scene.add(gridHelper);

        // Add axes helper for better orientation
        const axesHelper = new THREE.AxesHelper(10);
        axesHelper.position.y = 0.1;
        scene.add(axesHelper);

        console.log('✅ Three.js initialized');
        setIsInitialized(true);
        return true;

      } catch (error) {
        console.error('❌ Three.js init error:', error);
        setInitializationError(`Three.js failed: ${error.message}`);
        return false;
      }
    };

    // Animation loop
    const startAnimationLoop = () => {
      if (!isMountedRef.current || isRenderingRef.current) return;
      
      isRenderingRef.current = true;
      
      const animate = () => {
        if (!isMountedRef.current || !isRenderingRef.current) {
          return;
        }
        
        animationFrameId.current = requestAnimationFrame(animate);
        
        if (controlsRef.current) {
          controlsRef.current.update();
        }
        
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      };
      
      animate();
    };

    // MOUSE INTERACTION
    const handleMouseMove = (event) => {
      if (!canvasRef.current || !sceneRef.current || !cameraRef.current) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      
      // Combine both packed and unpacked items for hover detection
      const allItems = [...itemMeshesRef.current, ...unpackedMeshesRef.current];
      const intersects = raycasterRef.current.intersectObjects(allItems);
      
      if (intersects.length > 0) {
        const item = intersects[0].object;
        setHoveredItem({
          name: item.userData.itemName,
          dimensions: item.userData.dimensions,
          color: item.userData.originalColor,
          position: item.userData.originalPosition,
          isOutOfBounds: item.userData.isOutOfBounds,
          isUnpacked: item.userData.isUnpacked,
          rotation: item.userData.rotation,
          reason: item.userData.reason
        });
        
        // Highlight hovered item
        allItems.forEach(obj => {
          if (obj.material) {
            if (obj === item) {
              obj.material.emissive = new THREE.Color(0x333333);
              obj.material.emissiveIntensity = 0.5;
            } else {
              obj.material.emissive = new THREE.Color(0x000000);
              obj.material.emissiveIntensity = 0;
            }
          }
        });
      } else {
        setHoveredItem(null);
        allItems.forEach(obj => {
          if (obj.material) {
            obj.material.emissive = new THREE.Color(0x000000);
            obj.material.emissiveIntensity = 0;
          }
        });
      }
    };

    // Handle resize
    const handleResize = () => {
      if (!canvasRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height, false);
    };

    // Initialize
    const initTimer = setTimeout(() => {
      if (initThreeJS()) {
        window.addEventListener('resize', handleResize);
        if (canvasRef.current) {
          canvasRef.current.addEventListener('mousemove', handleMouseMove);
        }
        setTimeout(startAnimationLoop, 100);
      }
    }, 100);

    // Cleanup
    return () => {
      console.log('🧹 Component unmounting...');
      isMountedRef.current = false;
      clearTimeout(initTimer);
      
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('mousemove', handleMouseMove);
      }
      window.removeEventListener('resize', handleResize);
      
      cleanupScene(true);
      
      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }
      
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, [cleanupScene]);

  // Update camera based on view mode
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    
    const containerWidth = parseFloat(packingResult?.visualization_data?.container?.width) || 17.0;
    const containerHeight = parseFloat(packingResult?.visualization_data?.container?.height) || 8.0;
    
    switch(viewMode) {
      case 'Top':
        cameraRef.current.position.set(0, 40, 0);
        cameraRef.current.lookAt(containerWidth/2, containerHeight/2, 0);
        controlsRef.current.enableRotate = false;
        controlsRef.current.target.set(containerWidth/2, containerHeight/2, 0);
        break;
      case 'Front':
        cameraRef.current.position.set(containerWidth/2, containerHeight/2, 40);
        cameraRef.current.lookAt(containerWidth/2, containerHeight/2, 0);
        controlsRef.current.enableRotate = false;
        controlsRef.current.target.set(containerWidth/2, containerHeight/2, 0);
        break;
      case 'Side':
        cameraRef.current.position.set(40, containerHeight/2, 0);
        cameraRef.current.lookAt(containerWidth/2, containerHeight/2, 0);
        controlsRef.current.enableRotate = false;
        controlsRef.current.target.set(containerWidth/2, containerHeight/2, 0);
        break;
      default: // '3D'
        cameraRef.current.position.set(25, 20, 25);
        cameraRef.current.lookAt(containerWidth/2, containerHeight/2, 0);
        controlsRef.current.enableRotate = true;
        controlsRef.current.target.set(containerWidth/2, containerHeight/2, 0);
    }
    
    controlsRef.current.update();
  }, [viewMode, packingResult]);

  // Helper function to handle rotation dimensions
  const getRotatedDimensions = (width, height, depth, rotX, rotY, rotZ) => {
    const is90X = Math.abs(Math.abs(rotX % 360) - 90) < 1;
    const is90Y = Math.abs(Math.abs(rotY % 360) - 90) < 1;
    const is90Z = Math.abs(Math.abs(rotZ % 360) - 90) < 1;
    
    let w = width, h = height, d = depth;
    
    if (is90X) {
      [h, d] = [d, h];
    }
    
    if (is90Y) {
      [w, d] = [d, w];
    }
    
    if (is90Z) {
      [w, h] = [h, w];
    }
    
    return { width: w, height: h, depth: d };
  };

  // Create visualization
  useEffect(() => {
    if (!packingResult || !sceneRef.current || !isInitialized) {
      console.log('⚠️ Cannot create visualization:', {
        hasPackingResult: !!packingResult,
        hasScene: !!sceneRef.current,
        isInitialized
      });
      return;
    }

    console.log('🔄 Creating visualization from packing result...');
    
    // Clean up previous visualization
    cleanupScene();
    itemMeshesRef.current = [];
    unpackedMeshesRef.current = [];
    setOutOfBoundsItems([]);
    
    // Get container data
    let containerData = null;
    if (packingResult.visualization_data?.container) {
      containerData = packingResult.visualization_data.container;
      console.log('✅ Using visualization_data container:', containerData);
    } else if (packingResult.bins?.[0]?.dimensions) {
      containerData = {
        width: packingResult.bins[0].dimensions[0],
        height: packingResult.bins[0].dimensions[1],
        depth: packingResult.bins[0].dimensions[2],
        color: '#3B82F6'
      };
      console.log('✅ Using bins container');
    }

    if (!containerData) {
      console.log('❌ No container data found');
      setDebugInfo('No container data');
      return;
    }

    // Parse container dimensions
    const containerWidth = parseFloat(containerData.width) || 17.0;
    const containerHeight = parseFloat(containerData.height) || 8.0;
    const containerDepth = parseFloat(containerData.depth) || 10.0;
    const containerColor = containerData.color || '#3B82F6';

    console.log('📦 Container dimensions:', {
      width: containerWidth,
      height: containerHeight,
      depth: containerDepth
    });

    // Get unpacked items data
    let unpackedItems = [];
    if (packingResult.visualization_data?.unpacked_items) {
      unpackedItems = packingResult.visualization_data.unpacked_items;
      console.log('✅ Using visualization_data unpacked_items:', unpackedItems.length);
    } else if (packingResult.unpacked_items) {
      unpackedItems = packingResult.unpacked_items;
      console.log('✅ Using unpacked_items:', unpackedItems.length);
    }

    console.log(`📦 Unpacked items: ${unpackedItems.length}`);

    // Create main container group
    containerGroupRef.current = new THREE.Group();
    
    // Container mesh (transparent)
    const containerGeometry = new THREE.BoxGeometry(containerWidth, containerHeight, containerDepth);
    const containerMaterial = new THREE.MeshPhongMaterial({
      color: new THREE.Color(containerColor),
      transparent: true,
      opacity: 0.03,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    
    const containerMesh = new THREE.Mesh(containerGeometry, containerMaterial);
    containerMesh.position.set(containerWidth / 2, containerHeight / 2, containerDepth / 2);
    containerMesh.userData.isContainer = true;
    containerGroupRef.current.add(containerMesh);

    // Container wireframe
    const edges = new THREE.EdgesGeometry(containerGeometry);
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color: 0x1e40af,
      linewidth: 2,
      transparent: true,
      opacity: 0.9
    });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    wireframe.position.set(containerWidth / 2, containerHeight / 2, containerDepth / 2);
    containerGroupRef.current.add(wireframe);

    sceneRef.current.add(containerGroupRef.current);

    // Create unpacked area group (positioned to the right of container)
    unpackedAreaGroupRef.current = new THREE.Group();
    
    // Calculate unpacked area position (to the right of container with some spacing)
    const unpackedAreaX = containerWidth + 15; // 15 units spacing
    
    // Unpacked area visual representation (dashed box)
    const unpackedAreaWidth = 30;  // Fixed width for unpacked area
    const unpackedAreaHeight = containerHeight;
    const unpackedAreaDepth = Math.max(containerDepth, 15);
    
    const unpackedAreaGeometry = new THREE.BoxGeometry(unpackedAreaWidth, unpackedAreaHeight, unpackedAreaDepth);
    const unpackedAreaMaterial = new THREE.MeshPhongMaterial({
      color: 0x9ca3af,
      transparent: true,
      opacity: 0.02,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    
    const unpackedAreaMesh = new THREE.Mesh(unpackedAreaGeometry, unpackedAreaMaterial);
    unpackedAreaMesh.position.set(unpackedAreaX, unpackedAreaHeight / 2, unpackedAreaDepth / 2);
    unpackedAreaMesh.userData.isUnpackedArea = true;
    unpackedAreaGroupRef.current.add(unpackedAreaMesh);

    // Unpacked area wireframe (dashed lines)
    createDashedBox(unpackedAreaWidth, unpackedAreaHeight, unpackedAreaDepth, unpackedAreaX, unpackedAreaHeight / 2, unpackedAreaDepth / 2, 0x6b7280);
    
    sceneRef.current.add(unpackedAreaGroupRef.current);

    // Get packed items data
    let items = [];
    if (packingResult.visualization_data?.items) {
      items = packingResult.visualization_data.items;
      console.log('✅ Using visualization_data items:', items.length);
    } else if (packingResult.bins?.[0]?.items) {
      items = packingResult.bins[0].items;
      console.log('✅ Using bins items:', items.length);
    } else if (packingResult.packedItems) {
      items = packingResult.packedItems;
      console.log('✅ Using packedItems:', items.length);
    }

    // Create packed items
    console.log(`📦 Creating ${items.length} packed items`);
    
    items.forEach((item, index) => {
      try {
        let width, height, depth, posX, posY, posZ, rotX, rotY, rotZ, color, id, name;
        
        [width, height, depth] = item.dimensions.map(d => parseFloat(d) || 0.5);
        [posX, posY, posZ] = item.position.map(p => parseFloat(p) || 0);
        [rotX, rotY, rotZ] = item.rotation.map(r => parseFloat(r) || 0);
        
        // Use color from backend response
        color = item.color || '#FF6B6B';
        id = item.id || `item_${index}`;
        name = item.original_name || item.name || id;

        // Validate dimensions
        width = Math.max(width, 0.01);
        height = Math.max(height, 0.01);
        depth = Math.max(depth, 0.01);

        // Get rotated dimensions
        const rotatedDims = getRotatedDimensions(width, height, depth, rotX, rotY, rotZ);
        const effectiveWidth = rotatedDims.width;
        const effectiveHeight = rotatedDims.height;
        const effectiveDepth = rotatedDims.depth;

        // CRITICAL: Packing algorithm returns position from bottom-left-back corner
        // For visualization, we need to shift from container corner
        // But we'll keep the original coordinates for now
        
        // Position relative to container corner (as provided by algorithm)
        const centerX = posX + effectiveWidth / 2;
        const centerY = posY + effectiveHeight / 2;
        const centerZ = posZ + effectiveDepth / 2;

        // Create mesh
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshPhongMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: 0.85,
          shininess: 50,
          specular: new THREE.Color(0x222222)
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // Set position
        mesh.position.set(centerX, centerY, centerZ);
        
        // Apply rotation in radians
        mesh.rotation.set(
          THREE.MathUtils.degToRad(rotX),
          THREE.MathUtils.degToRad(rotY),
          THREE.MathUtils.degToRad(rotZ)
        );
        
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Store metadata
        mesh.userData.isPackedItem = true;
        mesh.userData.itemName = name || `Item ${index}`;
        mesh.userData.dimensions = { width, height, depth };
        mesh.userData.effectiveDimensions = rotatedDims;
        mesh.userData.originalColor = color;
        mesh.userData.originalPosition = { x: posX, y: posY, z: posZ };
        mesh.userData.centerPosition = { x: centerX, y: centerY, z: centerZ };
        mesh.userData.isOutOfBounds = false;
        mesh.userData.isUnpacked = false;
        mesh.userData.rotation = { x: rotX, y: rotY, z: rotZ };
        
        sceneRef.current.add(mesh);
        itemMeshesRef.current.push(mesh);

      } catch (error) {
        console.error(`❌ Error creating packed item ${index}:`, error);
      }
    });

    // Create unpacked items
    console.log(`📦 Creating ${unpackedItems.length} unpacked items`);
    
    // Organize unpacked items in a grid layout
    const gridCellSize = 10; // Space between items
    const itemsPerRow = 3;
    
    unpackedItems.forEach((item, index) => {
      try {
        let width, height, depth, color, id, name, reason;
        
        [width, height, depth] = item.dimensions.map(d => parseFloat(d) || 0.5);
        
        // Use color from backend response or default
        color = item.color || '#ef4444';
        id = item.id || `unpacked_${index}`;
        name = item.name || id;
        reason = item.reason || 'No space available';

        // Validate dimensions
        width = Math.max(width, 0.01);
        height = Math.max(height, 0.01);
        depth = Math.max(depth, 0.01);

        // Calculate grid position within unpacked area
        const row = Math.floor(index / itemsPerRow);
        const col = index % itemsPerRow;
        
        // Position within unpacked area
        const startX = unpackedAreaX - unpackedAreaWidth / 2 + gridCellSize / 2;
        const startZ = unpackedAreaDepth / 2 - gridCellSize / 2;
        
        const posX = startX + col * gridCellSize;
        const posZ = startZ - row * gridCellSize;
        const posY = height / 2; // Place on ground

        // Create mesh
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshPhongMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: 0.7,
          shininess: 30,
          specular: new THREE.Color(0x111111)
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // Set position
        mesh.position.set(posX, posY, posZ);
        
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Store metadata
        mesh.userData.isUnpackedItem = true;
        mesh.userData.itemName = name;
        mesh.userData.dimensions = { width, height, depth };
        mesh.userData.originalColor = color;
        mesh.userData.originalPosition = { x: posX, y: posY, z: posZ };
        mesh.userData.isOutOfBounds = false;
        mesh.userData.isUnpacked = true;
        mesh.userData.reason = reason;
        
        sceneRef.current.add(mesh);
        unpackedMeshesRef.current.push(mesh);

      } catch (error) {
        console.error(`❌ Error creating unpacked item ${index}:`, error);
      }
    });

    // Create a separator line between container and unpacked area
    const separatorGeometry = new THREE.BufferGeometry();
    const separatorVertices = new Float32Array([
      containerWidth + 5, 0, 0,
      containerWidth + 5, containerHeight + 5, 0
    ]);
    separatorGeometry.setAttribute('position', new THREE.BufferAttribute(separatorVertices, 3));
    
    const separatorMaterial = new THREE.LineDashedMaterial({
      color: 0x64748b,
      dashSize: 1,
      gapSize: 0.5,
      linewidth: 1
    });
    
    const separatorLine = new THREE.Line(separatorGeometry, separatorMaterial);
    separatorLine.computeLineDistances();
    sceneRef.current.add(separatorLine);

    // Set debug info
    const packedCount = items.length;
    const unpackedCount = unpackedItems.length;
    const efficiency = packingResult?.statistics?.space_utilization || 0;
    
    setDebugInfo(`Packed: ${packedCount} | Unpacked: ${unpackedCount} | Utilization: ${efficiency.toFixed(1)}%`);

    // Adjust camera to show both areas
    if (cameraRef.current && controlsRef.current) {
      // Calculate total width including both areas
      const totalWidth = containerWidth + unpackedAreaWidth + 15; // 15 spacing
      const maxHeight = Math.max(containerHeight, unpackedAreaHeight);
      
      cameraRef.current.position.set(totalWidth / 2, maxHeight * 1.5, totalWidth * 0.8);
      cameraRef.current.lookAt(totalWidth / 2, maxHeight/2, 0);
      
      controlsRef.current.target.set(totalWidth / 2, maxHeight/2, 0);
      controlsRef.current.update();
    }

    // Restart animation loop
    if (!animationFrameId.current) {
      const animate = () => {
        if (!isMountedRef.current) return;
        
        animationFrameId.current = requestAnimationFrame(animate);
        
        if (controlsRef.current) {
          controlsRef.current.update();
        }
        
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      };
      
      animate();
      isRenderingRef.current = true;
    }

  }, [packingResult, isInitialized, cleanupScene]);

  // Helper function to create dashed box
  const createDashedBox = (width, height, depth, centerX, centerY, centerZ, color) => {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const halfDepth = depth / 2;
    
    // Create 12 edges for the box
    const edges = [
      // Bottom edges
      [[-halfWidth, -halfHeight, -halfDepth], [halfWidth, -halfHeight, -halfDepth]],
      [[halfWidth, -halfHeight, -halfDepth], [halfWidth, -halfHeight, halfDepth]],
      [[halfWidth, -halfHeight, halfDepth], [-halfWidth, -halfHeight, halfDepth]],
      [[-halfWidth, -halfHeight, halfDepth], [-halfWidth, -halfHeight, -halfDepth]],
      
      // Top edges
      [[-halfWidth, halfHeight, -halfDepth], [halfWidth, halfHeight, -halfDepth]],
      [[halfWidth, halfHeight, -halfDepth], [halfWidth, halfHeight, halfDepth]],
      [[halfWidth, halfHeight, halfDepth], [-halfWidth, halfHeight, halfDepth]],
      [[-halfWidth, halfHeight, halfDepth], [-halfWidth, halfHeight, -halfDepth]],
      
      // Vertical edges
      [[-halfWidth, -halfHeight, -halfDepth], [-halfWidth, halfHeight, -halfDepth]],
      [[halfWidth, -halfHeight, -halfDepth], [halfWidth, halfHeight, -halfDepth]],
      [[halfWidth, -halfHeight, halfDepth], [halfWidth, halfHeight, halfDepth]],
      [[-halfWidth, -halfHeight, halfDepth], [-halfWidth, halfHeight, halfDepth]]
    ];
    
    edges.forEach(([start, end]) => {
      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        start[0], start[1], start[2],
        end[0], end[1], end[2]
      ]);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      
      const material = new THREE.LineDashedMaterial({
        color: color,
        dashSize: 0.5,
        gapSize: 0.3,
        linewidth: 1
      });
      
      const line = new THREE.Line(geometry, material);
      line.computeLineDistances();
      line.position.set(centerX, centerY, centerZ);
      
      if (unpackedAreaGroupRef.current) {
        unpackedAreaGroupRef.current.add(line);
      } else {
        sceneRef.current.add(line);
      }
    });
  };

  // Calculate stats
  const packedCount = packingResult?.visualization_data?.items?.length || 
                     packingResult?.bins?.[0]?.items?.length || 
                     packingResult?.packedItems?.length || 0;
  
  const unpackedCount = packingResult?.visualization_data?.unpacked_items?.length ||
                       packingResult?.unpacked_items?.length || 0;
  
  const efficiency = packingResult?.statistics?.space_utilization || 
                    packingResult?.statistics?.packing_efficiency || 
                    packingResult?.efficiency || 0;

  // Handle view mode change
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
  };

  // Toggle unpacked area visibility
  const toggleUnpackedArea = () => {
    setShowUnpackedArea(!showUnpackedArea);
    if (unpackedAreaGroupRef.current) {
      unpackedAreaGroupRef.current.visible = !showUnpackedArea;
    }
  };

  // Error display
  if (initializationError) {
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
        <div style={{ fontSize: '48px', color: '#ef4444' }}>⚠️</div>
        <div style={{ fontSize: '18px', color: '#1e293b', fontWeight: '600' }}>
          Graphics Error
        </div>
        <div style={{ fontSize: '14px', color: '#475569' }}>
          {initializationError}
        </div>
      </div>
    );
  }

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

  if (!packingResult) {
    return (
      <div style={{ 
        width: '100%', 
        height: '600px', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f4f8',
        flexDirection: 'column',
        gap: '15px'
      }}>
        <div style={{ fontSize: '40px', color: '#94a3b8' }}>📦</div>
        <div style={{ fontSize: '18px', color: '#4b5563' }}>No Data</div>
        <div style={{ fontSize: '14px', color: '#64748b' }}>
          Run packing calculation
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '600px', 
        position: 'relative',
        background: '#f0f4f8',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #e2e8f0'
      }}
    >
      {/* Stats */}
      <div style={{
        position: 'absolute',
        top: '70px',
        left: '12px',
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#1e293b',
        zIndex: 100,
        border: '1px solid rgba(203, 213, 225, 0.6)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        minWidth: '200px'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          marginBottom: '8px',
          paddingBottom: '8px',
          borderBottom: '1px solid rgba(203, 213, 225, 0.3)'
        }}>
          <span style={{ 
            fontSize: '16px',
            fontWeight: '600', 
            color: '#3b82f6' 
          }}>📦 Packing Results</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ fontWeight: '600', color: '#475569', minWidth: '80px' }}>Packed:</span>
          <span style={{ 
            background: '#dcfce7',
            padding: '2px 8px',
            borderRadius: '4px',
            fontWeight: '600',
            color: '#059669'
          }}>{packedCount}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ fontWeight: '600', color: '#475569', minWidth: '80px' }}>Unpacked:</span>
          <span style={{ 
            background: '#fee2e2',
            padding: '2px 8px',
            borderRadius: '4px',
            fontWeight: '600',
            color: '#dc2626'
          }}>{unpackedCount}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ fontWeight: '600', color: '#475569', minWidth: '80px' }}>Efficiency:</span>
          <span style={{ 
            color: efficiency > 70 ? '#10b981' : 
                   efficiency > 30 ? '#f59e0b' : '#ef4444',
            fontWeight: '600'
          }}>
            {typeof efficiency === 'number' ? efficiency.toFixed(1) : '0.0'}%
          </span>
        </div>
        {unpackedCount > 0 && (
          <div style={{ 
            marginTop: '6px',
            paddingTop: '6px',
            borderTop: '1px solid rgba(239, 68, 68, 0.3)',
            fontSize: '12px'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              color: '#ef4444',
              marginBottom: '4px'
            }}>
              <span style={{ fontWeight: '600' }}>⚠️ {unpackedCount} items couldn't fit</span>
            </div>
          </div>
        )}
      </div>

      {/* Hover tooltip */}
      {hoveredItem && (
        <div style={{
          position: 'absolute',
          top: '70px',
          right: '12px',
          background: hoveredItem.isUnpacked ? 'rgba(239, 68, 68, 0.95)' : 'rgba(0, 0, 0, 0.9)',
          color: 'white',
          padding: '12px 14px',
          borderRadius: '8px',
          fontSize: '12px',
          zIndex: 100,
          maxWidth: '300px',
          border: hoveredItem.isUnpacked ? '1px solid #ef4444' : '1px solid #374151',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          <div style={{ 
            fontWeight: '600', 
            marginBottom: '6px', 
            color: hoveredItem.isUnpacked ? '#fecaca' : '#60a5fa',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {hoveredItem.isUnpacked ? '📦' : '✓'} {hoveredItem.name}
            {hoveredItem.isUnpacked && (
              <span style={{ 
                fontSize: '11px', 
                background: 'rgba(255,255,255,0.2)', 
                padding: '1px 6px', 
                borderRadius: '3px' 
              }}>
                Unpacked
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', marginBottom: '4px', opacity: 0.9 }}>
            <div>Size: {hoveredItem.dimensions.width.toFixed(2)} × {hoveredItem.dimensions.height.toFixed(2)} × {hoveredItem.dimensions.depth.toFixed(2)}</div>
            {hoveredItem.rotation && (
              <div>Rotation: ({hoveredItem.rotation.x}°, {hoveredItem.rotation.y}°, {hoveredItem.rotation.z}°)</div>
            )}
            {hoveredItem.isUnpacked && hoveredItem.reason && (
              <div style={{ 
                marginTop: '4px', 
                padding: '4px 6px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '3px',
                fontStyle: 'italic'
              }}>
                Reason: {hoveredItem.reason}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: 'grab'
        }}
      />

      {/* View mode buttons */}
      <div style={{
        position: 'absolute',
        bottom: '50px',
        right: '12px',
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '6px',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#64748b',
        border: '1px solid rgba(203, 213, 225, 0.6)',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        zIndex: 100
      }}>
        {['3D', 'Top', 'Front', 'Side'].map((mode) => (
          <button
            key={mode}
            onClick={() => handleViewModeChange(mode)}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: '4px',
              background: viewMode === mode ? '#3b82f6' : 'transparent',
              color: viewMode === mode ? 'white' : '#64748b',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: viewMode === mode ? '600' : '400',
              transition: 'all 0.2s',
              minWidth: '50px'
            }}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Toggle unpacked area button */}
      {packingResult?.visualization_data?.unpacked_items?.length > 0 && (
        <button
          onClick={toggleUnpackedArea}
          style={{
            position: 'absolute',
            bottom: '50px',
            right: '250px',
            background: showUnpackedArea ? 'rgba(239, 68, 68, 0.95)' : 'rgba(34, 197, 94, 0.95)',
            color: 'white',
            padding: '6px 12px',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            zIndex: 100,
            transition: 'all 0.2s'
          }}
        >
          {showUnpackedArea ? '👁️' : '👁️‍🗨️'}
          {showUnpackedArea ? ' Hide Unpacked' : ' Show Unpacked'}
        </button>
      )}

      {/* Controls hint */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        left: '12px',
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#64748b',
        border: '1px solid rgba(203, 213, 225, 0.6)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span style={{ fontSize: '14px' }}>🖱️</span>
        <span>Drag to rotate • Scroll to zoom</span>
      </div>
      
      {/* Legend */}
      <div style={{
        position: 'absolute',
        top: '140px',
        left: '12px',
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '11px',
        color: '#475569',
        border: '1px solid rgba(203, 213, 225, 0.6)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', background: '#3b82f6', borderRadius: '2px' }}></div>
          <span>Container</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '2px' }}></div>
          <span>Packed Items</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '2px', opacity: 0.7 }}></div>
          <span>Unpacked Items</span>
        </div>
      </div>
      
      {/* Debug info */}
      <div style={{
        position: 'absolute',
        top: '180px',
        left: '12px',
        background: 'rgba(0, 0, 0, 0.7)',
        color: outOfBoundsItems.length > 0 ? '#fca5a5' : '#90cdf4',
        padding: '6px 10px',
        borderRadius: '4px',
        fontSize: '11px',
        fontFamily: 'monospace',
        zIndex: 90
      }}>
        {debugInfo || `Items: ${itemMeshesRef.current.length}`}
      </div>
    </div>
  );
};

export default BinVisualizer;
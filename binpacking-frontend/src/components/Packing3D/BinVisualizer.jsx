import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import PackingReportGenerator from './PackingReportGenerator';

const BinVisualizer = forwardRef(({ packingResult, isLoading, originalItems = [] }, ref) => {
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
  const separatorLineRef = useRef(null);
  const dashedLinesRef = useRef([]);
  const [debugInfo, setDebugInfo] = useState('');
  const isRenderingRef = useRef(false);
  const isMountedRef = useRef(true);
  const [viewMode, setViewMode] = useState('3D');
  const [outOfBoundsItems, setOutOfBoundsItems] = useState([]);
  const [showUnpackedArea, setShowUnpackedArea] = useState(true);

  // ==================== EXPOSE METHODS TO PARENT VIA REF ====================
  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    getScene: () => sceneRef.current,
    getCamera: () => cameraRef.current,
    resetView: () => {
      if (cameraRef.current && controlsRef.current) {
        const containerData = packingResult?.visualization_data?.container;
        if (containerData) {
          const width = parseFloat(containerData.width) || 17.0;
          const height = parseFloat(containerData.height) || 8.0;
          const depth = parseFloat(containerData.depth) || 10.0;
          cameraRef.current.position.set(width * 0.8, height * 0.8, depth * 1.5);
          cameraRef.current.lookAt(width/2, height/2, depth/2);
          controlsRef.current.target.set(width/2, height/2, depth/2);
        } else {
          cameraRef.current.position.set(20, 15, 20);
          cameraRef.current.lookAt(8.5, 4, 5);
          controlsRef.current.target.set(8.5, 4, 5);
        }
        controlsRef.current.update();
      }
    }
  }));

  console.log('🎯 BinVisualizer received:', {
    hasPackingResult: !!packingResult,
    packedItems: packingResult?.packedItems?.length,
    bins: packingResult?.bins?.[0]?.items?.length,
    visualizationData: packingResult?.visualization_data?.items?.length,
    container: packingResult?.visualization_data?.container,
    unpackedItems: packingResult?.visualization_data?.unpacked_items?.length,
    hasUnpackedItems: !!packingResult?.visualization_data?.unpacked_items
  });

  // ==================== HELPER FUNCTIONS ====================

  const createDashedBox = useCallback((width, height, depth, centerX, centerY, centerZ, color) => {
    if (!width || !height || !depth) return;
    
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const halfDepth = depth / 2;
    
    const edges = [
      [[-halfWidth, -halfHeight, -halfDepth], [halfWidth, -halfHeight, -halfDepth]],
      [[halfWidth, -halfHeight, -halfDepth], [halfWidth, -halfHeight, halfDepth]],
      [[halfWidth, -halfHeight, halfDepth], [-halfWidth, -halfHeight, halfDepth]],
      [[-halfWidth, -halfHeight, halfDepth], [-halfWidth, -halfHeight, -halfDepth]],
      [[-halfWidth, halfHeight, -halfDepth], [halfWidth, halfHeight, -halfDepth]],
      [[halfWidth, halfHeight, -halfDepth], [halfWidth, halfHeight, halfDepth]],
      [[halfWidth, halfHeight, halfDepth], [-halfWidth, halfHeight, halfDepth]],
      [[-halfWidth, halfHeight, halfDepth], [-halfWidth, halfHeight, -halfDepth]],
      [[-halfWidth, -halfHeight, -halfDepth], [-halfWidth, halfHeight, -halfDepth]],
      [[halfWidth, -halfHeight, -halfDepth], [halfWidth, halfHeight, -halfDepth]],
      [[halfWidth, -halfHeight, halfDepth], [halfWidth, halfHeight, halfDepth]],
      [[-halfWidth, -halfHeight, halfDepth], [-halfWidth, halfHeight, halfDepth]]
    ];
    
    edges.forEach(([start, end]) => {
      try {
        const geometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
          start[0], start[1], start[2],
          end[0], end[1], end[2]
        ]);
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        
        const material = new THREE.LineDashedMaterial({
          color: color,
          dashSize: 0.5,
          gapSize: 0.3
        });
        
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        line.position.set(centerX, centerY, centerZ);
        line.userData.isDashedLine = true;
        
        dashedLinesRef.current.push({ line, geometry, material });
        
        if (unpackedAreaGroupRef.current) {
          unpackedAreaGroupRef.current.add(line);
        } else if (sceneRef.current) {
          sceneRef.current.add(line);
        }
      } catch (error) {
        console.error('Error creating dashed box:', error);
      }
    });
  }, []);

  const getRotatedDimensions = useCallback((width, height, depth, rotX, rotY, rotZ) => {
    const rx = Math.abs(rotX % 360);
    const ry = Math.abs(rotY % 360);
    const rz = Math.abs(rotZ % 360);
    
    let w = width, h = height, d = depth;
    
    if (Math.abs(rz - 90) < 1 || Math.abs(rz - 270) < 1) {
      [w, h] = [h, w];
    }
    
    if (Math.abs(ry - 90) < 1 || Math.abs(ry - 270) < 1) {
      [w, d] = [d, w];
    }
    
    if (Math.abs(rx - 90) < 1 || Math.abs(rx - 270) < 1) {
      [h, d] = [d, h];
    }
    
    return { width: w, height: h, depth: d };
  }, []);

  // ==================== CLEANUP FUNCTION ====================

  const cleanupScene = useCallback((skipSceneReset = false) => {
    console.log('🧹 Cleaning up scene...');
    
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    
    if (separatorLineRef.current) {
      try {
        if (separatorLineRef.current.parent) {
          separatorLineRef.current.parent.remove(separatorLineRef.current);
        }
        if (separatorLineRef.current.geometry) separatorLineRef.current.geometry.dispose();
        if (separatorLineRef.current.material) separatorLineRef.current.material.dispose();
      } catch (e) {}
      separatorLineRef.current = null;
    }
    
    dashedLinesRef.current.forEach(({ line, geometry, material }) => {
      try {
        if (line.parent) line.parent.remove(line);
        if (geometry) geometry.dispose();
        if (material) material.dispose();
      } catch (e) {}
    });
    dashedLinesRef.current = [];
    
    itemMeshesRef.current.forEach(mesh => {
      try {
        if (mesh && mesh.parent) mesh.parent.remove(mesh);
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
      } catch (e) {}
    });
    itemMeshesRef.current = [];
    
    unpackedMeshesRef.current.forEach(mesh => {
      try {
        if (mesh && mesh.parent) mesh.parent.remove(mesh);
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
      } catch (e) {}
    });
    unpackedMeshesRef.current = [];
    
    if (containerGroupRef.current) {
      try {
        if (containerGroupRef.current.parent) {
          containerGroupRef.current.parent.remove(containerGroupRef.current);
        }
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
      } catch (e) {}
      containerGroupRef.current = null;
    }
    
    if (unpackedAreaGroupRef.current) {
      try {
        if (unpackedAreaGroupRef.current.parent) {
          unpackedAreaGroupRef.current.parent.remove(unpackedAreaGroupRef.current);
        }
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
      } catch (e) {}
      unpackedAreaGroupRef.current = null;
    }
    
    if (controlsRef.current) {
      try {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      } catch (e) {}
    }
    
    if (!skipSceneReset && sceneRef.current) {
      try {
        const toRemove = [];
        sceneRef.current.traverse((child) => {
          if (child.userData && (
            child.userData.isPackedItem || 
            child.userData.isContainer || 
            child.userData.isUnpackedItem || 
            child.userData.isUnpackedArea || 
            child.userData.isDashedLine
          )) {
            toRemove.push(child);
          }
        });
        
        toRemove.forEach(child => {
          if (child.parent) child.parent.remove(child);
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      } catch (e) {}
    }
    
    isRenderingRef.current = false;
    console.log('✅ Cleanup complete');
  }, []);

  // ==================== THREE.JS INITIALIZATION ====================

  useEffect(() => {
    console.log('🔄 Initializing Three.js...');
    
    isMountedRef.current = true;
    let initAttempted = false;
    
    const initThreeJS = () => {
      if (!isMountedRef.current || !canvasRef.current || initAttempted) return false;
      initAttempted = true;

      try {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf8fafc);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(
          60,
          canvasRef.current.clientWidth / canvasRef.current.clientHeight,
          0.01,
          1000
        );
        camera.position.set(20, 15, 20);
        camera.lookAt(8.5, 4, 5);
        cameraRef.current = camera;

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

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.rotateSpeed = 0.8;
        controls.zoomSpeed = 1.2;
        controls.panSpeed = 0.8;
        controls.screenSpacePanning = true;
        controls.minDistance = 5;
        controls.maxDistance = 200;
        controls.maxPolarAngle = Math.PI / 2;
        controls.target.set(8.5, 4, 5);
        controlsRef.current = controls;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.9);
        mainLight.position.set(20, 30, 20);
        mainLight.castShadow = true;
        mainLight.receiveShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0xffeedd, 0.5);
        fillLight.position.set(-20, 20, -30);
        scene.add(fillLight);

        const backLight = new THREE.DirectionalLight(0xccddff, 0.3);
        backLight.position.set(-10, 0, -30);
        scene.add(backLight);

        const gridHelper = new THREE.GridHelper(100, 50, 0x94a3b8, 0xcbd5e1);
        gridHelper.position.y = 0;
        scene.add(gridHelper);

        console.log('✅ Three.js initialized');
        setIsInitialized(true);
        return true;

      } catch (error) {
        console.error('❌ Three.js init error:', error);
        setInitializationError(`Three.js failed: ${error.message}`);
        return false;
      }
    };

    const startAnimationLoop = () => {
      if (!isMountedRef.current || isRenderingRef.current) return;
      isRenderingRef.current = true;
      
      const animate = () => {
        if (!isMountedRef.current || !isRenderingRef.current) return;
        animationFrameId.current = requestAnimationFrame(animate);
        
        if (controlsRef.current) controlsRef.current.update();
        
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      };
      
      animate();
    };

    // FIXED: Mouse interaction with better error handling
    const handleMouseMove = (event) => {
      if (!canvasRef.current || !sceneRef.current || !cameraRef.current) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      
      const allItems = [...itemMeshesRef.current, ...unpackedMeshesRef.current];
      const intersects = raycasterRef.current.intersectObjects(allItems);
      
      if (intersects.length > 0) {
        const item = intersects[0].object;
        
        // Debug: Log what's in userData
        console.log('📦 Hovered item userData:', item.userData);
        
        // Ensure we have valid data with fallbacks
        const userData = item.userData || {};
        
        setHoveredItem({
          name: userData.itemName || userData.name || 'Unknown Item',
          dimensions: userData.dimensions || { width: 0, height: 0, depth: 0 },
          color: userData.originalColor || userData.color || '#cccccc',
          position: userData.originalPosition || { x: 0, y: 0, z: 0 },
          isOutOfBounds: userData.isOutOfBounds || false,
          isUnpacked: userData.isUnpacked || false,
          rotation: userData.rotation || { x: 0, y: 0, z: 0 },
          reason: userData.reason || ''
        });
        
        // Highlight hovered item
        allItems.forEach(obj => {
          if (obj.material) {
            try {
              if (obj === item) {
                obj.material.emissive = new THREE.Color(0x444444);
                obj.material.emissiveIntensity = 0.5;
              } else {
                obj.material.emissive = new THREE.Color(0x000000);
                obj.material.emissiveIntensity = 0;
              }
            } catch (e) {}
          }
        });
      } else {
        setHoveredItem(null);
        allItems.forEach(obj => {
          if (obj.material) {
            try {
              obj.material.emissive = new THREE.Color(0x000000);
              obj.material.emissiveIntensity = 0;
            } catch (e) {}
          }
        });
      }
    };

    const handleResize = () => {
      if (!canvasRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    const initTimer = setTimeout(() => {
      if (initThreeJS()) {
        window.addEventListener('resize', handleResize);
        if (canvasRef.current) {
          canvasRef.current.addEventListener('mousemove', handleMouseMove);
        }
        setTimeout(startAnimationLoop, 100);
      }
    }, 100);

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

  // ==================== CAMERA VIEW MODE ====================

  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current || !packingResult) return;
    
    const containerData = packingResult?.visualization_data?.container || 
                         (packingResult?.bins?.[0]?.dimensions ? {
                           width: packingResult.bins[0].dimensions[0],
                           height: packingResult.bins[0].dimensions[1],
                           depth: packingResult.bins[0].dimensions[2]
                         } : null);
    
    const containerWidth = parseFloat(containerData?.width) || 17.0;
    const containerHeight = parseFloat(containerData?.height) || 8.0;
    const containerDepth = parseFloat(containerData?.depth) || 10.0;
    
    const unpackedItems = packingResult?.visualization_data?.unpacked_items || 
                         packingResult?.unpacked_items || [];
    const hasUnpackedItems = unpackedItems.length > 0;
    
    const containerCenterX = containerWidth / 2;
    const containerCenterY = containerHeight / 2;
    const containerCenterZ = containerDepth / 2;
    
    let targetX = containerCenterX;
    let targetY = containerCenterY;
    let targetZ = containerCenterZ;
    let cameraPos = { x: 0, y: 0, z: 0 };
    
    if (hasUnpackedItems && showUnpackedArea) {
      const unpackedAreaWidth = 30;
      const totalWidth = containerWidth + unpackedAreaWidth + 15;
      targetX = totalWidth / 2;
    }
    
    switch(viewMode) {
      case 'Top':
        cameraPos = { x: targetX, y: 50, z: targetZ };
        controlsRef.current.enableRotate = false;
        controlsRef.current.enablePan = true;
        break;
      case 'Front':
        cameraPos = { x: targetX, y: targetY, z: 50 };
        controlsRef.current.enableRotate = false;
        controlsRef.current.enablePan = true;
        break;
      case 'Side':
        cameraPos = { x: 50, y: targetY, z: targetZ };
        controlsRef.current.enableRotate = false;
        controlsRef.current.enablePan = true;
        break;
      default:
        if (hasUnpackedItems && showUnpackedArea) {
          cameraPos = { 
            x: targetX + 15, 
            y: containerHeight * 1.8, 
            z: containerDepth * 1.8 
          };
        } else {
          cameraPos = { 
            x: containerWidth * 0.8, 
            y: containerHeight * 1.2, 
            z: containerDepth * 1.2 
          };
        }
        controlsRef.current.enableRotate = true;
        controlsRef.current.enablePan = true;
        break;
    }
    
    try {
      cameraRef.current.position.set(cameraPos.x, cameraPos.y, cameraPos.z);
      cameraRef.current.lookAt(targetX, targetY, targetZ);
      controlsRef.current.target.set(targetX, targetY, targetZ);
      controlsRef.current.update();
    } catch (error) {
      console.error('Error updating camera:', error);
    }
    
  }, [viewMode]);

  // ==================== VISUALIZATION CREATION ====================

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
    
    cleanupScene();
    itemMeshesRef.current = [];
    unpackedMeshesRef.current = [];
    setOutOfBoundsItems([]);
    
    let containerData = null;
    if (packingResult.visualization_data?.container) {
      containerData = packingResult.visualization_data.container;
    } else if (packingResult.bins?.[0]?.dimensions) {
      containerData = {
        width: packingResult.bins[0].dimensions[0],
        height: packingResult.bins[0].dimensions[1],
        depth: packingResult.bins[0].dimensions[2],
        color: '#3B82F6'
      };
    }

    if (!containerData) {
      console.log('❌ No container data found');
      setDebugInfo('No container data');
      return;
    }

    const containerWidth = parseFloat(containerData.width) || 17.0;
    const containerHeight = parseFloat(containerData.height) || 8.0;
    const containerDepth = parseFloat(containerData.depth) || 10.0;

    console.log('📦 Container dimensions:', { containerWidth, containerHeight, containerDepth });

    let unpackedItems = [];
    if (packingResult.visualization_data?.unpacked_items) {
      unpackedItems = packingResult.visualization_data.unpacked_items;
    } else if (packingResult.unpacked_items) {
      unpackedItems = packingResult.unpacked_items;
    }

    // ============ CREATE CONTAINER ============
    containerGroupRef.current = new THREE.Group();
    
    const containerGeometry = new THREE.BoxGeometry(containerWidth, containerHeight, containerDepth);
    const containerMaterial = new THREE.MeshPhongMaterial({
      color: 0x3B82F6,
      transparent: true,
      opacity: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    
    const containerMesh = new THREE.Mesh(containerGeometry, containerMaterial);
    containerMesh.position.set(containerWidth / 2, containerHeight / 2, containerDepth / 2);
    containerMesh.userData.isContainer = true;
    containerGroupRef.current.add(containerMesh);

    const edges = new THREE.EdgesGeometry(containerGeometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x1e40af });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    wireframe.position.set(containerWidth / 2, containerHeight / 2, containerDepth / 2);
    containerGroupRef.current.add(wireframe);

    const boundaryMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });

    const bottomBoundary = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(containerWidth, 0.01, containerDepth)),
      boundaryMaterial
    );
    bottomBoundary.position.set(containerWidth / 2, 0, containerDepth / 2);
    containerGroupRef.current.add(bottomBoundary);

    const topBoundary = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(containerWidth, 0.01, containerDepth)),
      boundaryMaterial
    );
    topBoundary.position.set(containerWidth / 2, containerHeight, containerDepth / 2);
    containerGroupRef.current.add(topBoundary);

    const leftBoundary = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.01, containerHeight, containerDepth)),
      boundaryMaterial
    );
    leftBoundary.position.set(0, containerHeight / 2, containerDepth / 2);
    containerGroupRef.current.add(leftBoundary);

    const rightBoundary = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.01, containerHeight, containerDepth)),
      boundaryMaterial
    );
    rightBoundary.position.set(containerWidth, containerHeight / 2, containerDepth / 2);
    containerGroupRef.current.add(rightBoundary);

    const frontBoundary = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(containerWidth, containerHeight, 0.01)),
      boundaryMaterial
    );
    frontBoundary.position.set(containerWidth / 2, containerHeight / 2, 0);
    containerGroupRef.current.add(frontBoundary);

    const backBoundary = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(containerWidth, containerHeight, 0.01)),
      boundaryMaterial
    );
    backBoundary.position.set(containerWidth / 2, containerHeight / 2, containerDepth);
    containerGroupRef.current.add(backBoundary);

    const cornerPoints = [
      [0, 0, 0], [containerWidth, 0, 0], [0, containerHeight, 0], [containerWidth, containerHeight, 0],
      [0, 0, containerDepth], [containerWidth, 0, containerDepth], [0, containerHeight, containerDepth], [containerWidth, containerHeight, containerDepth]
    ];
    
    cornerPoints.forEach(pos => {
      try {
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.15),
          new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        sphere.position.set(pos[0], pos[1], pos[2]);
        containerGroupRef.current.add(sphere);
      } catch (e) {}
    });

    sceneRef.current.add(containerGroupRef.current);

    // ============ CREATE PACKED ITEMS ============
    let items = [];
    if (packingResult.visualization_data?.items) {
      items = packingResult.visualization_data.items;
    } else if (packingResult.bins?.[0]?.items) {
      items = packingResult.bins[0].items;
    } else if (packingResult.packedItems) {
      items = packingResult.packedItems;
    }

    console.log(`📦 Creating ${items.length} packed items`);
    
    items.forEach((item, index) => {
      try {
        if (!item.dimensions || !item.position) {
          console.warn(`Item ${index} missing dimensions or position:`, item);
          return;
        }
        
        let width, height, depth, posX, posY, posZ, rotX, rotY, rotZ, color, id, name;
        
        [width, height, depth] = item.dimensions.map(d => {
          if (d && typeof d === 'object' && d.toString) {
            return parseFloat(d.toString());
          }
          return parseFloat(d) || 0.5;
        });
        
        [posX, posY, posZ] = item.position.map(p => {
          if (p && typeof p === 'object' && p.toString) {
            return parseFloat(p.toString());
          }
          return parseFloat(p) || 0;
        });
        
        [rotX, rotY, rotZ] = (item.rotation || [0, 0, 0]).map(r => {
          if (r && typeof r === 'object' && r.toString) {
            return parseFloat(r.toString());
          }
          return parseFloat(r) || 0;
        });
        
        color = item.color || '#10b981';
        id = item.id || `item_${index}`;
        name = item.original_name || item.name || id;

        width = Math.max(width, 0.01);
        height = Math.max(height, 0.01);
        depth = Math.max(depth, 0.01);

        const maxX = containerWidth - width - 0.001;
        const maxY = containerHeight - height - 0.001;
        const maxZ = containerDepth - depth - 0.001;
        
        posX = Math.max(0.001, Math.min(posX, maxX));
        posY = Math.max(0.001, Math.min(posY, maxY));
        posZ = Math.max(0.001, Math.min(posZ, maxZ));

        const rotatedDims = getRotatedDimensions(width, height, depth, rotX, rotY, rotZ);
        
        const centerX = posX + rotatedDims.width / 2;
        const centerY = posY + rotatedDims.height / 2;
        const centerZ = posZ + rotatedDims.depth / 2;

        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshPhongMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: 0.9,
          shininess: 60,
          emissive: new THREE.Color(0x222222),
          emissiveIntensity: 0.1,
          specular: new THREE.Color(0x333333)
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(centerX, centerY, centerZ);
        mesh.rotation.set(
          THREE.MathUtils.degToRad(rotX),
          THREE.MathUtils.degToRad(rotY),
          THREE.MathUtils.degToRad(rotZ)
        );
        
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        const edges2 = new THREE.EdgesGeometry(geometry);
        const line2 = new THREE.LineSegments(
          edges2, 
          new THREE.LineBasicMaterial({ color: 0x000000 })
        );
        mesh.add(line2);
        
        // FIXED: Enhanced userData with multiple fallback fields
        mesh.userData = {
          isPackedItem: true,
          itemName: name,
          name: name,
          dimensions: { width, height, depth },
          width: width,
          height: height,
          depth: depth,
          rotatedDimensions: rotatedDims,
          originalColor: color,
          color: color,
          originalPosition: { x: posX, y: posY, z: posZ },
          position: { x: posX, y: posY, z: posZ },
          centerPosition: { x: centerX, y: centerY, z: centerZ },
          isOutOfBounds: false,
          isUnpacked: false,
          rotation: { x: rotX, y: rotY, z: rotZ }
        };
        
        sceneRef.current.add(mesh);
        itemMeshesRef.current.push(mesh);
        
        console.log(`✅ Created ${name} with userData:`, mesh.userData);

      } catch (error) {
        console.error(`❌ Error creating packed item ${index}:`, error);
      }
    });

    // ============ CREATE UNPACKED AREA AND ITEMS ============
    if (unpackedItems.length > 0) {
      console.log(`📦 Creating unpacked area with ${unpackedItems.length} items`);
      
      unpackedAreaGroupRef.current = new THREE.Group();
      
      const unpackedAreaX = containerWidth + 15;
      const unpackedAreaWidth = 30;
      const unpackedAreaHeight = containerHeight;
      const unpackedAreaDepth = Math.max(containerDepth, 15);
      
      const unpackedAreaGeometry = new THREE.BoxGeometry(unpackedAreaWidth, unpackedAreaHeight, unpackedAreaDepth);
      const unpackedAreaMaterial = new THREE.MeshPhongMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.02,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      
      const unpackedAreaMesh = new THREE.Mesh(unpackedAreaGeometry, unpackedAreaMaterial);
      unpackedAreaMesh.position.set(unpackedAreaX, unpackedAreaHeight / 2, unpackedAreaDepth / 2);
      unpackedAreaMesh.userData.isUnpackedArea = true;
      unpackedAreaGroupRef.current.add(unpackedAreaMesh);

      createDashedBox(
        unpackedAreaWidth, 
        unpackedAreaHeight, 
        unpackedAreaDepth, 
        unpackedAreaX, 
        unpackedAreaHeight / 2, 
        unpackedAreaDepth / 2, 
        0xef4444
      );
      
      sceneRef.current.add(unpackedAreaGroupRef.current);
      
      const gridCellSize = 8;
      const itemsPerRow = 3;
      
      unpackedItems.forEach((item, index) => {
        try {
          if (!item.dimensions) {
            console.warn(`Unpacked item ${index} missing dimensions:`, item);
            return;
          }
          
          let width, height, depth, color, id, name, reason;
          
          [width, height, depth] = item.dimensions.map(d => {
            if (d && typeof d === 'object' && d.toString) {
              return parseFloat(d.toString());
            }
            return parseFloat(d) || 0.5;
          });
          
          color = item.color || '#ef4444';
          id = item.id || `unpacked_${index}`;
          name = item.name || id;
          reason = item.reason || 'No space available';

          width = Math.max(width, 0.01);
          height = Math.max(height, 0.01);
          depth = Math.max(depth, 0.01);

          const row = Math.floor(index / itemsPerRow);
          const col = index % itemsPerRow;
          
          const startX = unpackedAreaX - unpackedAreaWidth / 2 + gridCellSize / 2;
          const startZ = unpackedAreaDepth / 2 - gridCellSize / 2;
          
          const cornerX = startX + col * gridCellSize;
          const cornerZ = startZ - row * gridCellSize;
          const cornerY = 0;
          
          const maxX = unpackedAreaX + unpackedAreaWidth / 2 - width - 0.001;
          const minX = unpackedAreaX - unpackedAreaWidth / 2 + 0.001;
          const maxZ = unpackedAreaDepth - depth - 0.001;
          const minZ = 0.001;
          
          const clampedX = Math.max(minX, Math.min(cornerX, maxX));
          const clampedZ = Math.max(minZ, Math.min(cornerZ, maxZ));
          const clampedY = Math.max(0.001, cornerY);
          
          const centerX = clampedX + width / 2;
          const centerY = clampedY + height / 2;
          const centerZ = clampedZ + depth / 2;

          const geometry = new THREE.BoxGeometry(width, height, depth);
          const material = new THREE.MeshPhongMaterial({
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.8,
            shininess: 30,
            emissive: new THREE.Color(0x331111),
            emissiveIntensity: 0.1
          });
          
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(centerX, centerY, centerZ);
          
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          
          const edges2 = new THREE.EdgesGeometry(geometry);
          const line2 = new THREE.LineSegments(
            edges2, 
            new THREE.LineBasicMaterial({ color: 0x440000 })
          );
          mesh.add(line2);
          
          // FIXED: Enhanced userData with multiple fallback fields
          mesh.userData = {
            isUnpackedItem: true,
            itemName: name,
            name: name,
            dimensions: { width, height, depth },
            width: width,
            height: height,
            depth: depth,
            originalColor: color,
            color: color,
            originalPosition: { x: clampedX, y: clampedY, z: clampedZ },
            position: { x: clampedX, y: clampedY, z: clampedZ },
            centerPosition: { x: centerX, y: centerY, z: centerZ },
            isOutOfBounds: false,
            isUnpacked: true,
            reason: reason
          };
          
          sceneRef.current.add(mesh);
          unpackedMeshesRef.current.push(mesh);
          
          console.log(`✅ Created unpacked ${name}`);

        } catch (error) {
          console.error(`❌ Error creating unpacked item ${index}:`, error);
        }
      });

      try {
        const points = [];
        points.push(new THREE.Vector3(containerWidth + 7.5, 0, 0));
        points.push(new THREE.Vector3(containerWidth + 7.5, containerHeight + 2, 0));
        
        const separatorGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const separatorMaterial = new THREE.LineDashedMaterial({
          color: 0x94a3b8,
          dashSize: 0.5,
          gapSize: 0.3
        });
        
        const separatorLine = new THREE.Line(separatorGeometry, separatorMaterial);
        separatorLine.computeLineDistances();
        sceneRef.current.add(separatorLine);
        separatorLineRef.current = separatorLine;
      } catch (error) {
        console.error('Error creating separator line:', error);
      }
    }

    const packedCount = items.length;
    const unpackedCount = unpackedItems.length;
    const efficiency = packingResult?.statistics?.space_utilization || 
                      packingResult?.statistics?.packing_efficiency || 
                      packingResult?.efficiency || 0;
    
    setDebugInfo(`Packed: ${packedCount} | Unpacked: ${unpackedCount} | Utilization: ${efficiency.toFixed(1)}%`);

  }, [packingResult, isInitialized, cleanupScene, getRotatedDimensions, createDashedBox]);

  // ==================== TOGGLE UNPACKED AREA VISIBILITY ====================
  
  useEffect(() => {
    if (unpackedAreaGroupRef.current) {
      unpackedAreaGroupRef.current.visible = showUnpackedArea;
    }
    
    unpackedMeshesRef.current.forEach(mesh => {
      if (mesh) {
        mesh.visible = showUnpackedArea;
      }
    });
    
    if (separatorLineRef.current) {
      separatorLineRef.current.visible = showUnpackedArea;
    }
    
    console.log(`👁️ Unpacked area visibility: ${showUnpackedArea ? 'SHOW' : 'HIDE'}`);
    
  }, [showUnpackedArea]);

  // ==================== STATS CALCULATION ====================

  const packedCount = packingResult?.visualization_data?.items?.length || 
                     packingResult?.bins?.[0]?.items?.length || 
                     packingResult?.packedItems?.length || 0;
  
  const unpackedCount = packingResult?.visualization_data?.unpacked_items?.length ||
                       packingResult?.unpacked_items?.length || 0;
  
  const efficiency = packingResult?.statistics?.space_utilization || 
                    packingResult?.statistics?.packing_efficiency || 
                    packingResult?.efficiency || 0;

  const containerVolume = (() => {
    try {
      const container = packingResult?.visualization_data?.container || 
                       (packingResult?.bins?.[0]?.dimensions ? {
                         width: packingResult.bins[0].dimensions[0],
                         height: packingResult.bins[0].dimensions[1],
                         depth: packingResult.bins[0].dimensions[2]
                       } : null);
      
      if (!container) return '0.00';
      
      const width = container.width || (Array.isArray(container) ? container[0] : 17.0);
      const height = container.height || (Array.isArray(container) ? container[1] : 8.0);
      const depth = container.depth || (Array.isArray(container) ? container[2] : 10.0);
      
      return (parseFloat(width) * parseFloat(height) * parseFloat(depth)).toFixed(2);
    } catch (error) {
      console.error('Error calculating container volume:', error);
      return '0.00';
    }
  })();

  // ==================== HANDLERS ====================

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
  };

  const toggleUnpackedArea = () => {
    setShowUnpackedArea(!showUnpackedArea);
  };

  // ==================== RENDER ====================

  if (initializationError) {
    return (
      <div style={{ 
        width: '100%', 
        height: '600px', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
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
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 16px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            marginTop: '10px'
          }}
        >
          Reload
        </button>
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
        background: '#f8fafc',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid #e2e8f0',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <div style={{ fontSize: '16px', color: '#4b5563' }}>
          Loading 3D visualization...
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!packingResult) {
    return (
      <div style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        borderRadius: '12px',
        flexDirection: 'column',
        gap: '15px'
      }}>
        <div style={{ fontSize: '60px', color: '#94a3b8' }}>📦</div>
        <div style={{ fontSize: '20px', color: '#334155', fontWeight: '600' }}>No Packing Data</div>
        <div style={{ fontSize: '14px', color: '#64748b' }}>
          Run packing calculation to see 3D visualization
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        background: '#f8fafc',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
      }}
    >
      {/* Stats Card - Top Left */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        background: 'rgba(255, 255, 255, 0.98)',
        padding: '16px 20px',
        borderRadius: '12px',
        fontSize: '13px',
        color: '#1e293b',
        zIndex: 100,
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        minWidth: '240px',
        backdropFilter: 'blur(8px)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px', 
          marginBottom: '12px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '10px'
        }}>
          <span style={{ 
            fontSize: '18px',
            fontWeight: '700', 
            color: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ fontSize: '22px' }}>📦</span> Packing Results
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontWeight: '600', color: '#475569' }}>Container:</span>
          <span style={{ fontWeight: '500', color: '#0f172a' }}>
            {containerVolume} m³
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontWeight: '600', color: '#475569' }}>Packed:</span>
          <span style={{ 
            background: '#dcfce7',
            padding: '4px 12px',
            borderRadius: '20px',
            fontWeight: '600',
            color: '#059669',
            fontSize: '12px'
          }}>{packedCount} items</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontWeight: '600', color: '#475569' }}>Unpacked:</span>
          <span style={{ 
            background: '#fee2e2',
            padding: '4px 12px',
            borderRadius: '20px',
            fontWeight: '600',
            color: '#dc2626',
            fontSize: '12px'
          }}>{unpackedCount} items</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontWeight: '600', color: '#475569' }}>Utilization:</span>
          <span style={{ 
            color: efficiency > 70 ? '#059669' : efficiency > 30 ? '#d97706' : '#dc2626',
            fontWeight: '700',
            fontSize: '14px'
          }}>
            {typeof efficiency === 'number' ? efficiency.toFixed(1) : '0.0'}%
          </span>
        </div>
        
        {unpackedCount > 0 && (
          <div style={{ 
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #fee2e2',
            fontSize: '12px',
            color: '#b91c1c',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ fontSize: '14px' }}>⚠️</span>
            <span style={{ fontWeight: '600' }}>{unpackedCount} items couldn't fit</span>
          </div>
        )}
      </div>
  
      {/* Hover Tooltip - Top Right */}
      {hoveredItem && hoveredItem.dimensions && (
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          background: hoveredItem.isUnpacked ? '#991b1b' : '#0f172a',
          color: 'white',
          padding: '16px 20px',
          borderRadius: '12px',
          fontSize: '13px',
          zIndex: 100,
          maxWidth: '300px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          border: hoveredItem.isUnpacked ? '1px solid #ef4444' : '1px solid #334155',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ 
            fontWeight: '700', 
            marginBottom: '10px', 
            color: hoveredItem.isUnpacked ? '#fecaca' : '#93c5fd',
            fontSize: '15px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '18px' }}>{hoveredItem.isUnpacked ? '📦' : '✓'}</span>
            {hoveredItem.name}
            {hoveredItem.isUnpacked && (
              <span style={{ 
                fontSize: '11px', 
                background: 'rgba(255,255,255,0.15)', 
                padding: '2px 8px', 
                borderRadius: '12px' 
              }}>
                Unpacked
              </span>
            )}
          </div>
          
          <div style={{ fontSize: '12px', opacity: 0.95, lineHeight: '1.6' }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '6px' }}>
              <span style={{ minWidth: '60px', color: '#cbd5e1' }}>Dimensions:</span>
              <span style={{ fontWeight: '600' }}>
                {hoveredItem.dimensions.width?.toFixed(2) || '0.00'} × {hoveredItem.dimensions.height?.toFixed(2) || '0.00'} × {hoveredItem.dimensions.depth?.toFixed(2) || '0.00'} m
              </span>
            </div>
            
            {hoveredItem.rotation && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '6px' }}>
                <span style={{ minWidth: '60px', color: '#cbd5e1' }}>Rotation:</span>
                <span style={{ fontWeight: '600' }}>
                  ({hoveredItem.rotation.x || 0}°, {hoveredItem.rotation.y || 0}°, {hoveredItem.rotation.z || 0}°)
                </span>
              </div>
            )}
            
            {!hoveredItem.isUnpacked && hoveredItem.position && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '6px' }}>
                <span style={{ minWidth: '60px', color: '#cbd5e1' }}>Position:</span>
                <span style={{ fontWeight: '600' }}>
                  ({hoveredItem.position.x?.toFixed(1) || '0.0'}, {hoveredItem.position.y?.toFixed(1) || '0.0'}, {hoveredItem.position.z?.toFixed(1) || '0.0'})
                </span>
              </div>
            )}
            
            {hoveredItem.isUnpacked && hoveredItem.reason && (
              <div style={{ 
                marginTop: '10px', 
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '6px',
                fontStyle: 'italic',
                borderLeft: '3px solid #ef4444'
              }}>
                {hoveredItem.reason}
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
  
      {/* View Mode Controls - Left Side */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        background: 'rgba(255, 255, 255, 0.98)',
        padding: '8px',
        borderRadius: '12px',
        fontSize: '12px',
        color: '#64748b',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        zIndex: 100,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        backdropFilter: 'blur(8px)'
      }}>
        {['3D', 'Top', 'Front', 'Side'].map((mode) => (
          <button
            key={mode}
            onClick={() => handleViewModeChange(mode)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '8px',
              background: viewMode === mode ? '#3b82f6' : 'transparent',
              color: viewMode === mode ? 'white' : '#475569',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: viewMode === mode ? '600' : '500',
              transition: 'all 0.2s',
              minWidth: '60px'
            }}
          >
            {mode}
          </button>
        ))}
      </div>
  
      {/* Toggle Unpacked Button - Bottom Right */}
      {unpackedCount > 0 && (
        <button
          onClick={toggleUnpackedArea}
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            background: showUnpackedArea ? '#ef4444' : '#10b981',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '30px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transition: 'all 0.2s'
          }}
        >
          <span style={{ fontSize: '16px' }}>{showUnpackedArea ? '👁️' : '👁️‍🗨️'}</span>
          {showUnpackedArea ? 'Hide Unpacked' : 'Show Unpacked'}
        </button>
      )}
  
      {/* Controls Hint */}
      <div style={{
        position: 'absolute',
        bottom: '80px',
        left: '20px',
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '10px 16px',
        borderRadius: '30px',
        fontSize: '12px',
        color: '#475569',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        backdropFilter: 'blur(8px)'
      }}>
        <span style={{ fontSize: '16px' }}>🖱️</span>
        <span>Drag to rotate • Scroll to zoom • Right drag to pan</span>
      </div>
      
      {/* Color Legend */}
      <div style={{
        position: 'absolute',
        bottom: '140px',
        left: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        zIndex: 100,
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '8px 16px',
        borderRadius: '30px',
        border: '1px solid #e2e8f0',
        backdropFilter: 'blur(8px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', background: '#3b82f6', borderRadius: '3px', opacity: 0.3 }}></div>
          <span style={{ fontSize: '11px', color: '#475569' }}>Container</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '3px' }}></div>
          <span style={{ fontSize: '11px', color: '#475569' }}>Packed</span>
        </div>
        {showUnpackedArea && unpackedCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '3px' }}></div>
            <span style={{ fontSize: '11px', color: '#475569' }}>Unpacked</span>
          </div>
        )}
      </div>
  
      {/* Report Generator - Camera Button at Bottom Right */}
      {packingResult && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'flex-end',
          pointerEvents: 'auto',
          maxWidth: 'min(300px, 90vw)',
          transition: 'all 0.2s ease',
          
          '@media (max-width: 768px)': {
            bottom: '16px',
            right: '16px',
          },
          
          '@media (max-width: 480px)': {
            bottom: '12px',
            right: '12px',
          },
        }}>
          <PackingReportGenerator 
            packingResult={packingResult}
            containerRef={containerRef}
            canvasRef={canvasRef}
            showCamera={true}
            cameraPosition="bottom-right"
          />
        </div>
      )}
    </div>
  );
});

export default BinVisualizer;
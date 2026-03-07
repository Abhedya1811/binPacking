// components/Packing3D/BinVisualizer.jsx
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  Grid, 
  Html, 
  Line,
  useHelper
} from '@react-three/drei';
import * as THREE from 'three';
import PackingReportGenerator from './PackingReportGenerator';

// ==================== CONTAINER COMPONENT ====================
const Container = ({ width, height, depth }) => {
  const containerRef = useRef();
  
  return (
    <group ref={containerRef}>
      {/* Transparent container volume */}
      <mesh position={[width/2, height/2, depth/2]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#3B82F6" transparent opacity={0.05} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Container wireframe */}
      <lineSegments position={[width/2, height/2, depth/2]}>
        <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
        <lineBasicMaterial color="#1e40af" />
      </lineSegments>
      
      {/* Boundary lines - RED */}
      <Line
        points={[
          [0, 0, 0], [width, 0, 0], [width, 0, depth], [0, 0, depth], [0, 0, 0]
        ]}
        color="#ff0000"
        lineWidth={1}
      />
      <Line
        points={[
          [0, height, 0], [width, height, 0], [width, height, depth], [0, height, depth], [0, height, 0]
        ]}
        color="#ff0000"
        lineWidth={1}
      />
      <Line
        points={[[0, 0, 0], [0, height, 0]]}
        color="#ff0000"
        lineWidth={1}
      />
      <Line
        points={[[width, 0, 0], [width, height, 0]]}
        color="#ff0000"
        lineWidth={1}
      />
      <Line
        points={[[width, 0, depth], [width, height, depth]]}
        color="#ff0000"
        lineWidth={1}
      />
      <Line
        points={[[0, 0, depth], [0, height, depth]]}
        color="#ff0000"
        lineWidth={1}
      />
      
      {/* Corner markers */}
      {[
        [0, 0, 0], [width, 0, 0], [0, height, 0], [width, height, 0],
        [0, 0, depth], [width, 0, depth], [0, height, depth], [width, height, depth]
      ].map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
      ))}
    </group>
  );
};

// ==================== PACKED ITEM COMPONENT - FIXED HOVER ====================
const PackedItem = ({ item, index, containerDims, onHover }) => {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  
  // Parse item data with EXACT backend coordinates
  const [width, height, depth] = item.dimensions.map(d => Number(d.toFixed(3)));
  const [posX, posY, posZ] = item.position.map(p => Number(p.toFixed(3)));
  const [rotX, rotY, rotZ] = (item.rotation || [0, 0, 0]).map(r => Number(r.toFixed(1)));
  
  // Calculate center position (backend provides bottom-left-front corner)
  const centerX = posX + width / 2;
  const centerY = posY + height / 2;
  const centerZ = posZ + depth / 2;
  
  // Strict boundary check with small epsilon
  const epsilon = 0.01;
  const isWithinBounds = (
    posX >= -epsilon && posX + width <= containerDims[0] + epsilon &&
    posY >= -epsilon && posY + height <= containerDims[1] + epsilon &&
    posZ >= -epsilon && posZ + depth <= containerDims[2] + epsilon
  );
  
  const color = item.color || '#10b981';
  const name = item.original_name || item.name || item.id || `Item ${index}`;
  
  // FIX: The dimensions already represent the rotated state
  const rotation = [0, 0, 0]; // No additional rotation needed
  
  return (
    <group>
      {/* Main item mesh - FIXED HOVER */}
      <mesh
        ref={meshRef}
        position={[centerX, centerY, centerZ]}
        rotation={rotation}
        userData={{ isPackedItem: true, name, index }}
        onPointerOver={(e) => {
          // Stop propagation to prevent parent elements from receiving the event
          e.stopPropagation();
          setHovered(true);
          onHover({
            name,
            dimensions: { width, height, depth },
            color,
            position: { x: posX, y: posY, z: posZ },
            isOutOfBounds: !isWithinBounds,
            isUnpacked: false,
            rotation: { x: rotX, y: rotY, z: rotZ }
          });
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          onHover(null);
        }}
        onPointerMove={(e) => {
          // Stop propagation to prevent multiple items from being detected
          e.stopPropagation();
        }}
      >
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={color}
          emissive={new THREE.Color(0x000000)}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
      
      {/* Edge lines - NO rotation */}
      <lineSegments
        position={[centerX, centerY, centerZ]}
        rotation={rotation}
      >
        <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
        <lineBasicMaterial color={!isWithinBounds ? "#ff0000" : "#000000"} />
      </lineSegments>
      
      {/* Hover highlight - only show for this specific item */}
      {hovered && (
        <lineSegments
          position={[centerX, centerY, centerZ]}
          rotation={rotation}
        >
          <edgesGeometry args={[new THREE.BoxGeometry(width + 0.05, height + 0.05, depth + 0.05)]} />
          <lineBasicMaterial color="#ffffff" linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
};

// ==================== UNPACKED ITEM COMPONENT - FIXED HOVER ====================
const UnpackedItem = ({ item, index, containerDims, onHover }) => {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  
  // Position unpacked items in a grid to the right of container
  const containerWidth = containerDims[0];
  const unpackedAreaX = containerWidth + 15;
  const gridSize = 8;
  const itemsPerRow = 3;
  
  const row = Math.floor(index / itemsPerRow);
  const col = index % itemsPerRow;
  
  const [width, height, depth] = item.dimensions.map(d => Number(d.toFixed(3)));
  const color = item.color || '#ef4444';
  const name = item.name || `Unpacked ${index}`;
  const reason = item.reason || 'No space available';
  
  // Calculate position in unpacked area
  const posX = unpackedAreaX - 15 + col * gridSize;
  const posZ = 5 - row * gridSize;
  const posY = height / 2; // Sit on ground
  
  const centerX = posX + width / 2;
  const centerY = posY;
  const centerZ = posZ + depth / 2;
  
  return (
    <mesh
      ref={meshRef}
      position={[centerX, centerY, centerZ]}
      userData={{ isUnpackedItem: true, name, index }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover({
          name,
          dimensions: { width, height, depth },
          color,
          position: { x: posX, y: 0, z: posZ },
          isOutOfBounds: false,
          isUnpacked: true,
          reason
        });
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        onHover(null);
      }}
      onPointerMove={(e) => {
        e.stopPropagation();
      }}
    >
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial
        color={color}
        emissive={new THREE.Color(0x000000)}
        roughness={0.4}
        metalness={0.1}
      />
      
      {/* Edge lines */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
        <lineBasicMaterial color="#440000" />
      </lineSegments>
      
      {/* Hover highlight */}
      {hovered && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(width + 0.05, height + 0.05, depth + 0.05)]} />
          <lineBasicMaterial color="#ffff00" />
        </lineSegments>
      )}
    </mesh>
  );
};

// ==================== UNPACKED AREA COMPONENT ====================
const UnpackedArea = ({ containerDims, show }) => {
  if (!show) return null;
  
  const containerWidth = containerDims[0];
  const containerHeight = containerDims[1];
  const containerDepth = containerDims[2];
  
  const areaWidth = 30;
  const areaHeight = containerHeight;
  const areaDepth = Math.max(containerDepth, 15);
  const areaX = containerWidth + 15;
  
  return (
    <group>
      {/* Semi-transparent area */}
      <mesh position={[areaX, areaHeight/2, areaDepth/2]}>
        <boxGeometry args={[areaWidth, areaHeight, areaDepth]} />
        <meshStandardMaterial color="#ef4444" transparent opacity={0.02} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Dashed border */}
      <Line
        points={[
          [areaX - areaWidth/2, 0, 0],
          [areaX + areaWidth/2, 0, 0],
          [areaX + areaWidth/2, areaHeight, 0],
          [areaX - areaWidth/2, areaHeight, 0],
          [areaX - areaWidth/2, 0, 0]
        ]}
        color="#ef4444"
        lineWidth={1}
        dashed
        dashSize={0.5}
        gapSize={0.3}
      />
      <Line
        points={[
          [areaX - areaWidth/2, 0, areaDepth],
          [areaX + areaWidth/2, 0, areaDepth],
          [areaX + areaWidth/2, areaHeight, areaDepth],
          [areaX - areaWidth/2, areaHeight, areaDepth],
          [areaX - areaWidth/2, 0, areaDepth]
        ]}
        color="#ef4444"
        lineWidth={1}
        dashed
        dashSize={0.5}
        gapSize={0.3}
      />
      
      {/* Separator line */}
      <Line
        points={[[containerWidth + 7.5, 0, 0], [containerWidth + 7.5, containerHeight + 2, 0]]}
        color="#94a3b8"
        lineWidth={1}
        dashed
        dashSize={0.5}
        gapSize={0.3}
      />
    </group>
  );
};

// ==================== KEYBOARD CONTROLS COMPONENT ====================
const KeyboardControls = ({ controlsRef }) => {
  const { camera } = useThree();
  const keys = useRef({
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    w: false,
    a: false,
    s: false,
    d: false,
    q: false,
    e: false
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key in keys.current) {
        keys.current[e.key] = true;
        e.preventDefault(); // Prevent page scrolling
      }
    };

    const handleKeyUp = (e) => {
      if (e.key in keys.current) {
        keys.current[e.key] = false;
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame(() => {
    if (!controlsRef.current) return;

    const moveSpeed = 0.5;
    const controls = controlsRef.current;
    const camera = controls.object;
    
    // Get camera's forward and right vectors
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0; // Keep movement horizontal
    forward.normalize();
    
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    right.normalize();
    
    const up = new THREE.Vector3(0, 1, 0);
    
    // Calculate movement
    const moveDelta = new THREE.Vector3(0, 0, 0);
    
    // Arrow keys and WASD
    if (keys.current.ArrowUp || keys.current.w) {
      moveDelta.add(forward.clone().multiplyScalar(moveSpeed));
    }
    if (keys.current.ArrowDown || keys.current.s) {
      moveDelta.sub(forward.clone().multiplyScalar(moveSpeed));
    }
    if (keys.current.ArrowLeft || keys.current.a) {
      moveDelta.sub(right.clone().multiplyScalar(moveSpeed));
    }
    if (keys.current.ArrowRight || keys.current.d) {
      moveDelta.add(right.clone().multiplyScalar(moveSpeed));
    }
    // Vertical movement
    if (keys.current.q) {
      moveDelta.y -= moveSpeed;
    }
    if (keys.current.e) {
      moveDelta.y += moveSpeed;
    }
    
    if (moveDelta.length() > 0) {
      // Move camera
      camera.position.add(moveDelta);
      // Update controls target to maintain focus
      controls.target.add(moveDelta);
      controls.update();
    }
  });

  return null;
};

// ==================== CAMERA CONTROLLER ====================
const CameraController = ({ viewMode, containerDims, showUnpackedArea, controlsRef }) => {
  const { camera, controls } = useThree();
  
  useEffect(() => {
    if (!controls) return;
    
    const [width, height, depth] = containerDims;
    let center = [width/2, height/2, depth/2];
    
    if (showUnpackedArea) {
      const totalWidth = width + 30 + 15;
      center[0] = totalWidth / 2;
    }
    
    let targetPos;
    let targetCenter = [...center];
    
    switch(viewMode) {
      case 'Top':
        targetPos = [center[0], height * 3, center[2]];
        controls.enableRotate = false;
        break;
      case 'Front':
        targetPos = [center[0], center[1], depth * 3];
        controls.enableRotate = false;
        break;
      case 'Side':
        targetPos = [width * 3, center[1], center[2]];
        controls.enableRotate = false;
        break;
      case 'X-Axis Scroll':
        targetPos = [center[0] + 30, center[1] + 10, center[2] + 20];
        controls.enableRotate = true;
        break;
      default: // 3D
        if (showUnpackedArea) {
          targetPos = [center[0] + 15, height * 1.8, depth * 1.8];
        } else {
          targetPos = [width * 0.8, height * 1.2, depth * 1.2];
        }
        controls.enableRotate = true;
        break;
    }
    
    camera.position.set(targetPos[0], targetPos[1], targetPos[2]);
    controls.target.set(targetCenter[0], targetCenter[1], targetCenter[2]);
    controls.update();
    
  }, [viewMode, containerDims, showUnpackedArea, camera, controls]);
  
  return null;
};

// ==================== COLLAPSIBLE STATS CARD ====================
const CollapsibleStatsCard = ({ packingResult, outOfBoundsCount }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const packedCount = packingResult?.visualization_data?.items?.length || 0;
  const unpackedCount = packingResult?.visualization_data?.unpacked_items?.length || 0;
  const efficiency = packingResult?.statistics?.space_utilization || 0;
  const algorithm = packingResult?.statistics?.algorithm || 'standard';
  const container = packingResult?.visualization_data?.container || { width: 0, height: 0, depth: 0 };
  const containerVolume = (container.width * container.height * container.depth).toFixed(2);

  return (
    <div style={{
      position: 'absolute',
      top: '16px',
      left: '16px',
      background: 'rgba(255, 255, 255, 0.98)',
      borderRadius: '12px',
      fontSize: '13px',
      color: '#1e293b',
      zIndex: 100,
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      minWidth: isCollapsed ? '60px' : '280px',
      backdropFilter: 'blur(8px)',
      transition: 'all 0.3s ease'
    }}>
      {/* Header - always visible */}
      <div 
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px', 
          padding: '16px 20px',
          cursor: 'pointer',
          borderBottom: isCollapsed ? 'none' : '1px solid #e2e8f0',
        }}
      >
        <span style={{ fontSize: '22px' }}>📦</span>
        {!isCollapsed && (
          <span style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
            Packing Results
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '16px' }}>
          {isCollapsed ? '▶' : '▼'}
        </span>
      </div>
      
      {/* Content - hidden when collapsed */}
      {!isCollapsed && (
        <div style={{ padding: '0 20px 16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontWeight: '600', color: '#475569' }}>Algorithm:</span>
            <span style={{ 
              fontWeight: '600',
              color: '#0891b2',
              background: '#e0f2fe',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px'
            }}>
              {algorithm}
            </span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontWeight: '600', color: '#475569' }}>Container:</span>
            <span style={{ fontWeight: '500', color: '#0f172a' }}>{containerVolume} m³</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
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
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
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
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontWeight: '600', color: '#475569' }}>Utilization:</span>
            <span style={{ 
              color: efficiency > 70 ? '#059669' : efficiency > 30 ? '#d97706' : '#dc2626',
              fontWeight: '700',
              fontSize: '14px'
            }}>
              {typeof efficiency === 'number' ? efficiency.toFixed(1) : '0.0'}%
            </span>
          </div>
          
          {outOfBoundsCount > 0 && (
            <div style={{ 
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid #fecaca',
              fontSize: '12px',
              color: '#991b1b',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>⚠️</span>
              <span style={{ fontWeight: '600' }}>{outOfBoundsCount} items out of bounds</span>
            </div>
          )}
          
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
              <span>⚠️</span>
              <span style={{ fontWeight: '600' }}>{unpackedCount} items couldn't fit</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==================== HOVER TOOLTIP ====================
const HoverTooltip = ({ item }) => {
  if (!item) return null;
  
  return (
    <div style={{
      position: 'absolute',
      top: '16px',
      right: '16px',
      background: item.isOutOfBounds ? '#7f1d1d' : (item.isUnpacked ? '#991b1b' : '#0f172a'),
      color: 'white',
      padding: '16px 20px',
      borderRadius: '12px',
      fontSize: '13px',
      zIndex: 100,
      maxWidth: '300px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      border: item.isOutOfBounds ? '2px solid #ef4444' : (item.isUnpacked ? '1px solid #ef4444' : '1px solid #334155'),
      backdropFilter: 'blur(8px)'
    }}>
      <div style={{ 
        fontWeight: '700', 
        marginBottom: '10px', 
        color: item.isOutOfBounds ? '#fecaca' : (item.isUnpacked ? '#fecaca' : '#93c5fd'),
        fontSize: '15px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        <span>{item.isOutOfBounds ? '⚠️' : (item.isUnpacked ? '📦' : '✓')}</span>
        {item.name}
        {item.isOutOfBounds && (
          <span style={{ fontSize: '11px', background: '#ef4444', padding: '2px 8px', borderRadius: '12px' }}>
            OUT OF BOUNDS
          </span>
        )}
        {item.isUnpacked && !item.isOutOfBounds && (
          <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '12px' }}>
            Unpacked
          </span>
        )}
      </div>
      
      <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '6px' }}>
          <span style={{ minWidth: '60px', color: '#cbd5e1' }}>Dimensions:</span>
          <span style={{ fontWeight: '600' }}>
            {item.dimensions.width.toFixed(3)} × {item.dimensions.height.toFixed(3)} × {item.dimensions.depth.toFixed(3)} m
          </span>
        </div>
        
        {item.rotation && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '6px' }}>
            <span style={{ minWidth: '60px', color: '#cbd5e1' }}>Rotation:</span>
            <span style={{ fontWeight: '600' }}>
              ({item.rotation.x}°, {item.rotation.y}°, {item.rotation.z}°)
            </span>
          </div>
        )}
        
        {!item.isUnpacked && item.position && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '6px' }}>
            <span style={{ minWidth: '60px', color: '#cbd5e1' }}>Position:</span>
            <span style={{ fontWeight: '600' }}>
              ({item.position.x.toFixed(3)}, {item.position.y.toFixed(3)}, {item.position.z.toFixed(3)})
            </span>
          </div>
        )}
        
        {item.isUnpacked && item.reason && (
          <div style={{ 
            marginTop: '10px', 
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '6px',
            fontStyle: 'italic',
            borderLeft: '3px solid #ef4444'
          }}>
            {item.reason}
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== VIEW CONTROLS ====================
const ViewControls = ({ viewMode, setViewMode, showUnpackedArea, setShowUnpackedArea, unpackedCount, outOfBoundsCount }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const viewModes = ['3D', 'Top', 'Front', 'Side', 'X-Axis Scroll'];
  
  return (
    <>
      {/* View mode dropdown */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        zIndex: 100,
      }} ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          style={{
            background: 'rgba(255, 255, 255, 0.98)',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#1e293b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            backdropFilter: 'blur(8px)',
            minWidth: '150px'
          }}
        >
          <span>🎥 {viewMode}</span>
          <span style={{ marginLeft: 'auto' }}>{isDropdownOpen ? '▲' : '▼'}</span>
        </button>
        
        {isDropdownOpen && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '0',
            marginBottom: '8px',
            background: 'rgba(255, 255, 255, 0.98)',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            backdropFilter: 'blur(8px)',
            minWidth: '150px'
          }}>
            {viewModes.map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setViewMode(mode);
                  setIsDropdownOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '8px',
                  background: viewMode === mode ? '#3b82f6' : 'transparent',
                  color: viewMode === mode ? 'white' : '#475569',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: viewMode === mode ? '600' : '500',
                  textAlign: 'left',
                  marginBottom: '2px'
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Color legend */}
      <div style={{
        position: 'absolute',
        bottom: '80px',
        left: '20px',
        display: 'flex',
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
        {outOfBoundsCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '3px' }}></div>
            <span style={{ fontSize: '11px', color: '#475569' }}>Out of Bounds</span>
          </div>
        )}
        {showUnpackedArea && unpackedCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '3px', opacity: 0.5 }}></div>
            <span style={{ fontSize: '11px', color: '#475569' }}>Unpacked</span>
          </div>
        )}
      </div>
      
      {/* Controls hint */}
      <div style={{
        position: 'absolute',
        bottom: '140px',
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
        <span>🖱️</span>
        <span>Mouse: rotate/zoom • Arrow Keys: move camera • Q/E: up/down</span>
      </div>

      {/* Toggle unpacked button */}
      {unpackedCount > 0 && (
        <button
          onClick={() => setShowUnpackedArea(!showUnpackedArea)}
          style={{
            position: 'absolute',
            bottom: '90px',
            right: '20px',
            background: showUnpackedArea ? '#ef4444' : '#10b981',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '30px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
        >
          <span>{showUnpackedArea ? '👁️' : '👁️‍🗨️'}</span>
          {showUnpackedArea ? 'Hide Unpacked' : 'Show Unpacked'}
        </button>
      )}
    </>
  );
};

// ==================== MAIN BIN VISUALIZER COMPONENT ====================
const BinVisualizer = forwardRef(({ packingResult, isLoading, originalItems = [] }, ref) => {
  const [hoveredItem, setHoveredItem] = useState(null);
  const [outOfBoundsItems, setOutOfBoundsItems] = useState([]);
  const [showUnpackedArea, setShowUnpackedArea] = useState(true);
  const [viewMode, setViewMode] = useState('3D');
  const controlsRef = useRef();
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Expose methods to parent including canvas capture
  useImperativeHandle(ref, () => ({
    resetView: () => {
      if (controlsRef.current) {
        controlsRef.current.reset();
      }
    },
    getCanvas: () => {
      // Try to get canvas from multiple sources
      const canvas = document.querySelector('canvas');
      if (canvas) {
        return canvas;
      }
      return canvasRef.current ? canvasRef.current : null;
    },
    captureScreenshot: () => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        return canvas.toDataURL('image/png');
      }
      return null;
    }
  }));

  // Track out-of-bounds items
  useEffect(() => {
    if (!packingResult?.visualization_data?.items) return;
    
    const container = packingResult.visualization_data.container;
    if (!container) return;
    
    const containerDims = [container.width, container.height, container.depth];
    const outOfBounds = [];
    
    packingResult.visualization_data.items.forEach(item => {
      const [w, h, d] = item.dimensions;
      const [x, y, z] = item.position;
      
      // Use small epsilon for floating point tolerance
      const eps = 0.01;
      if (x < -eps || x + w > containerDims[0] + eps ||
          y < -eps || y + h > containerDims[1] + eps ||
          z < -eps || z + d > containerDims[2] + eps) {
        outOfBounds.push(item.original_name || item.name || item.id);
      }
    });
    
    setOutOfBoundsItems(outOfBounds);
    
    if (outOfBounds.length > 0) {
      console.warn(`🚨 ${outOfBounds.length} items out of bounds:`, outOfBounds);
    }
  }, [packingResult]);

  if (isLoading) {
    return (
      <div style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e2e8f0',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ fontSize: '16px', color: '#4b5563' }}>Loading 3D visualization...</div>
        </div>
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
        background: '#f8fafc'
      }}>
        <div style={{ fontSize: '20px', color: '#94a3b8' }}>No packing data</div>
      </div>
    );
  }

  const container = packingResult.visualization_data?.container || {
    width: 16.4,
    height: 8,
    depth: 10
  };
  
  const packedItems = packingResult.visualization_data?.items || [];
  const unpackedItems = packingResult.visualization_data?.unpacked_items || [];
  
  const containerDims = [container.width, container.height, container.depth];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#f8fafc' }} ref={containerRef}>
      {/* UI Overlays */}
      <CollapsibleStatsCard packingResult={packingResult} outOfBoundsCount={outOfBoundsItems.length} />
      <HoverTooltip item={hoveredItem} />
      <ViewControls 
        viewMode={viewMode}
        setViewMode={setViewMode}
        showUnpackedArea={showUnpackedArea}
        setShowUnpackedArea={setShowUnpackedArea}
        unpackedCount={unpackedItems.length}
        outOfBoundsCount={outOfBoundsItems.length}
      />
      
      {/* Three.js Canvas - with preserveDrawingBuffer for screenshots */}
      <Canvas
        shadows
        camera={{ position: [20, 15, 20], fov: 60 }}
        style={{ background: '#f8fafc' }}
        onPointerDown={(e) => {
          // Allow camera controls when clicking on canvas
          e.stopPropagation();
        }}
        ref={canvasRef}
        gl={{ preserveDrawingBuffer: true }} // CRITICAL for screenshots
      >
        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[20, 30, 20]}
          intensity={0.9}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-20, 20, -30]} intensity={0.5} />
        <directionalLight position={[-10, 0, -30]} intensity={0.3} />
        
        {/* Grid */}
        <Grid
          args={[100, 100]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#94a3b8"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#cbd5e1"
          fadeDistance={200}
          position={[containerDims[0]/2, 0, containerDims[2]/2]}
        />
        
        {/* Container */}
        <Container width={containerDims[0]} height={containerDims[1]} depth={containerDims[2]} />
        
        {/* Packed Items */}
        {packedItems.map((item, index) => (
          <PackedItem
            key={`packed-${index}-${item.id || index}`}
            item={item}
            index={index}
            containerDims={containerDims}
            onHover={setHoveredItem}
          />
        ))}
        
        {/* Unpacked Area and Items */}
        {showUnpackedArea && (
          <>
            <UnpackedArea containerDims={containerDims} show={unpackedItems.length > 0} />
            {unpackedItems.map((item, index) => (
              <UnpackedItem
                key={`unpacked-${index}-${item.id || index}`}
                item={item}
                index={index}
                containerDims={containerDims}
                onHover={setHoveredItem}
              />
            ))}
          </>
        )}
        
        {/* Camera Controller */}
        <CameraController 
          viewMode={viewMode}
          containerDims={containerDims}
          showUnpackedArea={showUnpackedArea && unpackedItems.length > 0}
          controlsRef={controlsRef}
        />
        
        {/* Orbit Controls */}
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.8}
          zoomSpeed={1.2}
          panSpeed={0.8}
          minDistance={5}
          maxDistance={200}
          maxPolarAngle={Math.PI / 2}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
        />
        
        {/* Keyboard Controls for Arrow Key Movement */}
        <KeyboardControls controlsRef={controlsRef} />
      </Canvas>

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
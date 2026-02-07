import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const useThreeSetup = (canvasRef) => {
  const sceneRef = useRef(new THREE.Scene());
  const rendererRef = useRef(null);
  const animationFrameId = useRef(null);

  // Initialize Three.js scene
  useEffect(() => {
    if (!canvasRef.current) return;

    // Scene
    const scene = sceneRef.current;
    scene.background = new THREE.Color(0x1a1a1a);
    scene.fog = new THREE.Fog(0x1a1a1a, 10, 300);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      50,
      canvasRef.current.clientWidth / canvasRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(120, 100, 120);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Grid helper
    const gridHelper = new THREE.GridHelper(200, 20, 0x6b6b6b, 0x6b6b6b);
    gridHelper.material.opacity = 0.25;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(100);
    scene.add(axesHelper);

    // Animation loop
    const animate = () => {
      animationFrameId.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      if (!canvasRef.current) return;
      
      camera.aspect = canvasRef.current.clientWidth / canvasRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    };
    
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      renderer.dispose();
      
      // Dispose geometries and materials
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    };
  }, [canvasRef]);

  // Add object to scene
  const addObject = useCallback((object) => {
    sceneRef.current.add(object);
    return object;
  }, []);

  // Remove object from scene
  const removeObject = useCallback((object) => {
    sceneRef.current.remove(object);
    
    // Cleanup
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(material => material.dispose());
      } else {
        object.material.dispose();
      }
    }
  }, []);

  // Clear all objects except lights and helpers
  const clearScene = useCallback(() => {
    const objectsToRemove = [];
    
    sceneRef.current.traverse((object) => {
      if (
        object.type !== 'AmbientLight' &&
        object.type !== 'DirectionalLight' &&
        object.type !== 'GridHelper' &&
        object.type !== 'AxesHelper'
      ) {
        objectsToRemove.push(object);
      }
    });
    
    objectsToRemove.forEach(removeObject);
  }, [removeObject]);

  // Get scene statistics
  const getSceneStats = useCallback(() => {
    let vertices = 0;
    let triangles = 0;
    let objects = 0;
    
    sceneRef.current.traverse((object) => {
      if (object.isMesh) {
        objects++;
        if (object.geometry) {
          vertices += object.geometry.attributes.position.count;
          triangles += object.geometry.index ? object.geometry.index.count / 3 : 0;
        }
      }
    });
    
    return {
      vertices,
      triangles,
      objects,
      drawCalls: rendererRef.current?.info.render.calls || 0,
      memory: rendererRef.current?.info.memory.geometries || 0,
    };
  }, []);

  return {
    scene: sceneRef.current,
    renderer: rendererRef.current,
    addObject,
    removeObject,
    clearScene,
    getSceneStats,
  };
};
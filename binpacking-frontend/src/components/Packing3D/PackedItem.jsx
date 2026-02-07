import React, { useRef, useState } from 'react';
import { Box, Text } from '@react-three/drei';
import * as THREE from 'three';

const PackedItem = ({ item }) => {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  
  const { 
    id, 
    dimensions = [10, 10, 10], 
    position = [0, 0, 0], 
    rotation = [0, 0, 0],
    color = '#e74c3c',
    name = 'Item'
  } = item;
  
  const [width, height, depth] = dimensions;
  
  return (
    <group 
      position={position}
      rotation={rotation.map(r => THREE.MathUtils.degToRad(r))}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={hovered ? '#f39c12' : color}
          metalness={0.2}
          roughness={0.5}
          transparent
          opacity={0.9}
        />
      </mesh>
      
      {/* Item label (shown on hover) */}
      {hovered && (
        <Text
          position={[0, height/2 + 2, 0]}
          fontSize={2}
          color="white"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.3}
          outlineColor="#000"
        >
          {name}
        </Text>
      )}
      
      {/* Dimension indicators */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([
              0, 0, 0,
              width, 0, 0
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#ffffff" linewidth={1} />
      </line>
    </group>
  );
};

export default PackedItem;
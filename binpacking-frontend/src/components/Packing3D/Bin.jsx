// Bin.jsx
import React from 'react';
import { Box, Text } from '@react-three/drei';

const Bin = ({ dimensions, position = [0, 0, 0], color = '#3498db', opacity = 0.15, wireframe = true, label }) => {
  return (
    <group position={position}>
      <Box args={dimensions}>
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          wireframe={wireframe}
          side={THREE.DoubleSide}
        />
      </Box>
      
      {/* Label */}
      {label && (
        <Text
          position={[0, dimensions[1]/2 + 5, 0]}
          fontSize={4}
          color="white"
          anchorX="center"
          anchorY="bottom"
        >
          {label}
        </Text>
      )}
      
      {/* Dimensions display */}
      <Text
        position={[0, -dimensions[1]/2 - 5, 0]}
        fontSize={3}
        color="#ccc"
        anchorX="center"
        anchorY="top"
      >
        {`${dimensions[0]}×${dimensions[1]}×${dimensions[2]}`}
      </Text>
    </group>
  );
};

export default Bin;
import React, { Suspense, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Box, Environment } from '@react-three/drei';
import { Card } from '@/components/ui/card';
import * as THREE from 'three';

interface ModelProps {
  materialColor: string;
  geometry?: THREE.BufferGeometry;
}

const Model: React.FC<ModelProps> = ({ materialColor, geometry }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current && !geometry) {
      // Only rotate the default box when no custom geometry is loaded
      meshRef.current.rotation.x += 0.01;
      meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        {geometry ? (
          <primitive object={geometry} />
        ) : (
          <boxGeometry args={[2, 1, 1]} />
        )}
        <meshStandardMaterial 
          color={materialColor} 
          roughness={0.3} 
          metalness={0.1}
          side={THREE.DoubleSide} 
        />
      </mesh>
      <Text
        position={[0, -2, 0]}
        fontSize={0.3}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {geometry ? 'Uploaded Model' : '3D Model Preview'}
      </Text>
    </group>
  );
};

interface ThreeViewerProps {
  materialColor?: string;
  geometry?: THREE.BufferGeometry;
}

const ThreeViewer: React.FC<ThreeViewerProps> = ({ 
  materialColor = "#00ccff", 
  geometry 
}) => {
  return (
    <Card className="w-full h-96 bg-gradient-tech border-border overflow-hidden">
      <div className="w-full h-full">
        <Canvas
          camera={{ position: [5, 5, 5], fov: 60 }}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <Environment preset="studio" />
            <ambientLight intensity={0.4} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <Model materialColor={materialColor} geometry={geometry} />
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minDistance={3}
              maxDistance={15}
            />
          </Suspense>
        </Canvas>
      </div>
    </Card>
  );
};

export default ThreeViewer;
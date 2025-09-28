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
    if (meshRef.current && geometry) {
      // Gentle rotation for uploaded models
      meshRef.current.rotation.y += 0.005;
    }
  });

  useEffect(() => {
    if (meshRef.current && geometry) {
      // Center and scale the loaded geometry
      const box = new THREE.Box3().setFromObject(meshRef.current);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      // Center the geometry
      geometry.translate(-center.x, -center.y, -center.z);
      
      // Scale to fit in a 3x3x3 box
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 3 / maxDim;
      geometry.scale(scale, scale, scale);
      
      // Compute normals for proper lighting
      geometry.computeVertexNormals();
    }
  }, [geometry]);

  if (!geometry) {
    return null; // Don't render anything if no geometry is provided
  }

  return (
    <group>
      <mesh ref={meshRef}>
        <primitive object={geometry} />
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
        Uploaded Model
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
  if (!geometry) {
    return null; // Don't render the viewer if no geometry is provided
  }

  return (
    <Card className="w-full h-96 bg-gradient-tech border-border overflow-hidden">
      <div className="w-full h-full">
        <Canvas
          camera={{ position: [3, 3, 3], fov: 60 }}
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
              minDistance={1}
              maxDistance={10}
              target={[0, 0, 0]}
            />
          </Suspense>
        </Canvas>
      </div>
    </Card>
  );
};

export default ThreeViewer;
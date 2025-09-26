import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Box, Environment } from '@react-three/drei';
import { Card } from '@/components/ui/card';

interface ModelProps {
  materialColor: string;
}

const Model: React.FC<ModelProps> = ({ materialColor }) => {
  return (
    <group>
      <Box args={[2, 1, 1]} position={[0, 0, 0]}>
        <meshStandardMaterial color={materialColor} roughness={0.3} metalness={0.1} />
      </Box>
      <Text
        position={[0, -2, 0]}
        fontSize={0.3}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        3D Model Preview
      </Text>
    </group>
  );
};

interface ThreeViewerProps {
  materialColor?: string;
}

const ThreeViewer: React.FC<ThreeViewerProps> = ({ materialColor = "#00ccff" }) => {
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
            <Model materialColor={materialColor} />
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
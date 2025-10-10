import React, { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Material } from '@/types/materials';
import * as THREE from 'three';

interface ModelProps {
  materialColor: string;
  geometry?: THREE.BufferGeometry;
  scale: number;
}

interface Dimensions {
  width: number;
  height: number;
  depth: number;
}

const Model: React.FC<ModelProps> = ({ materialColor, geometry, scale }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current && geometry) {
      meshRef.current.rotation.y += 0.005;
    }
  });

  useEffect(() => {
    if (meshRef.current && geometry) {
      const box = new THREE.Box3().setFromObject(meshRef.current);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      geometry.translate(-center.x, -center.y, -center.z);
      
      const maxDim = Math.max(size.x, size.y, size.z);
      const fitScale = 3 / maxDim;
      geometry.scale(fitScale, fitScale, fitScale);
      
      geometry.computeVertexNormals();
    }
  }, [geometry]);

  if (!geometry) {
    return null;
  }

  return (
    <group scale={[scale, scale, scale]}>
      <mesh ref={meshRef}>
        <primitive object={geometry} />
        <meshStandardMaterial 
          color={materialColor} 
          roughness={0.3} 
          metalness={0.1}
          side={THREE.DoubleSide} 
        />
      </mesh>
    </group>
  );
};

// Custom zoom handler component
const ZoomHandler = () => {
  const { camera, gl } = useThree();

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Only zoom if shift key is pressed
      if (e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        
        const zoomSpeed = 0.002;
        const delta = e.deltaY * zoomSpeed;
        
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.position.z = Math.max(1, Math.min(10, camera.position.z + delta));
        }
      }
      // Otherwise, allow normal page scrolling
    };

    const canvas = gl.domElement;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [camera, gl]);

  return null;
};

interface ThreeViewerProps {
  materialColor?: string;
  geometry?: THREE.BufferGeometry;
  materials: Material[];
  selectedMaterial: Material | null;
  onMaterialSelect: (material: Material) => void;
  scale: number;
}

const ThreeViewer: React.FC<ThreeViewerProps> = ({ 
  materialColor = "#00ccff", 
  geometry,
  materials,
  selectedMaterial,
  onMaterialSelect,
  scale
}) => {
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);
  const [showControls, setShowControls] = useState(true);
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (geometry) {
      const box = new THREE.Box3().setFromBufferAttribute(
        geometry.attributes.position as THREE.BufferAttribute
      );
      const size = box.getSize(new THREE.Vector3());
      setDimensions({
        width: size.x * scale,
        height: size.y * scale,
        depth: size.z * scale,
      });
    }
  }, [geometry, scale]);

  // Auto-hide controls after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowControls(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!geometry) {
    return null;
  }

  const getMaterialColor = (material: Material) => {
    switch (material.id) {
      case 'pla': return '#22c55e';
      case 'petg': return '#a855f7';
      case 'abs': return '#f59e0b';
      case 'nylon': return '#ec4899';
      default: return '#00ccff';
    }
  };

  return (
    <div className="relative">
      <Card className="w-full h-[600px] bg-gradient-tech border-border overflow-hidden">
        <div className="w-full h-full relative">
          {/* Dimensions Display */}
          {dimensions && (
            <div className="absolute top-4 left-4 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-3 text-xs space-y-1">
              <div className="font-semibold mb-1">Object Size</div>
              <div>W: {dimensions.width.toFixed(1)} mm</div>
              <div>H: {dimensions.height.toFixed(1)} mm</div>
              <div>D: {dimensions.depth.toFixed(1)} mm</div>
            </div>
          )}

          {/* Material Toolbar */}
          <div className="absolute top-4 right-4 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-2 space-y-2">
            <div className="text-xs font-semibold mb-2 px-2">Materials</div>
            <TooltipProvider>
              {materials.map((material) => (
                <Tooltip key={material.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={selectedMaterial?.id === material.id ? "default" : "outline"}
                      size="sm"
                      className="w-full justify-start gap-2"
                      onClick={() => onMaterialSelect(material)}
                    >
                      <div 
                        className="w-4 h-4 rounded-full border border-border"
                        style={{ backgroundColor: getMaterialColor(material) }}
                      />
                      <span className="text-xs">{material.name}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <div className="space-y-1">
                      <div className="font-semibold">{material.name}</div>
                      <div className="text-xs">{material.description}</div>
                      <div className="text-xs text-muted-foreground">
                        €{material.costPerKg}/kg · {material.properties.strength} strength
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>

          {/* Controls Cheatsheet */}
          <div 
            className={`absolute bottom-4 left-4 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-3 text-xs space-y-2 transition-opacity duration-1000 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="font-semibold mb-2">3D Controls</div>
            <div className="space-y-1 text-muted-foreground">
              <div>🖱️ Left Click + Drag: Rotate</div>
              <div>🖱️ Right Click + Drag: Pan</div>
              <div>⇧ Shift + Scroll: Zoom In/Out</div>
            </div>
          </div>

          <Canvas
            camera={{ position: [3, 3, 3], fov: 60 }}
            style={{ background: 'transparent' }}
          >
            <Suspense fallback={null}>
              <Environment preset="studio" />
              <ambientLight intensity={0.4} />
              <directionalLight position={[10, 10, 5]} intensity={1} />
              <Model materialColor={materialColor} geometry={geometry} scale={scale} />
              <OrbitControls
                ref={controlsRef}
                enablePan={true}
                enableZoom={false}
                enableRotate={true}
                minDistance={1}
                maxDistance={10}
                target={[0, 0, 0]}
                zoomSpeed={0.5}
                mouseButtons={{
                  LEFT: THREE.MOUSE.ROTATE,
                  MIDDLE: THREE.MOUSE.DOLLY,
                  RIGHT: THREE.MOUSE.PAN,
                }}
              />
              <ZoomHandler />
            </Suspense>
          </Canvas>
        </div>
      </Card>
    </div>
  );
};

export default ThreeViewer;

import React, { Suspense, useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import MaterialSelector from '@/components/MaterialSelector';
import { Material } from '@/types/materials';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
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

  if (!geometry) return null;

  return (
    <group scale={[scale, scale, scale]}>
      <mesh ref={meshRef}>
        <primitive object={geometry} />
        <meshStandardMaterial color={materialColor} roughness={0.3} metalness={0.1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

const CameraAutoFit: React.FC<{ scale: number }> = ({ scale }) => {
  const { camera } = useThree();
  const prevScale = useRef(scale);

  useEffect(() => {
    if (prevScale.current !== scale) {
      prevScale.current = scale;
      const dist = 3 * Math.max(scale, 0.5) + 2;
      const ratio = 1 / Math.sqrt(3);
      camera.position.set(dist * ratio, dist * ratio, dist * ratio);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }
  }, [scale, camera]);

  return null;
};

const ZoomHandler = () => {
  const { camera, gl } = useThree();
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY * 0.002;
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.position.z = Math.max(1, Math.min(10, camera.position.z + delta));
        }
      }
    };
    const canvas = gl.domElement;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [camera, gl]);
  return null;
};

const NavigationOverlay: React.FC = () => {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className={cn(
      "absolute inset-0 z-20 flex items-center justify-center pointer-events-none transition-opacity duration-700",
      visible ? "opacity-80" : "opacity-0"
    )}>
      <div className="bg-foreground/80 text-background rounded-xl px-6 py-4 text-center space-y-2 backdrop-blur-sm max-w-xs">
        {isMobile ? (
          <>
            <p className="text-sm font-medium">☝️ One finger to rotate</p>
            <p className="text-sm font-medium">✌️ Two fingers to pan</p>
            <p className="text-sm font-medium">🤏 Pinch to zoom</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">🖱️ Left click + drag to rotate</p>
            <p className="text-sm font-medium">🖱️ Right click + drag to pan</p>
            <p className="text-sm font-medium">⇧ Shift + scroll to zoom</p>
          </>
        )}
      </div>
    </div>
  );
};

interface ThreeViewerProps {
  materialColor?: string;
  geometry?: THREE.BufferGeometry;
  materials: Material[];
  selectedMaterial: Material | null;
  onMaterialSelect: (material: Material) => void;
  scale: number;
  onScaleChange: (scale: number) => void;
  dimensions?: Dimensions | null;
}

const ThreeViewer: React.FC<ThreeViewerProps> = ({
  materialColor = "#888888",
  geometry,
  materials,
  selectedMaterial,
  onMaterialSelect,
  scale,
  onScaleChange,
  dimensions: externalDimensions,
}) => {
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);
  const [scaleInput, setScaleInput] = useState(scale.toString());

  useEffect(() => {
    if (geometry) {
      const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position as THREE.BufferAttribute);
      const size = box.getSize(new THREE.Vector3());
      setDimensions({ width: size.x * scale, height: size.y * scale, depth: size.z * scale });
    }
  }, [geometry, scale]);

  useEffect(() => {
    setScaleInput(scale.toFixed(2));
  }, [scale]);

  if (!geometry) return null;

  const handleScaleInputChange = (value: string) => {
    setScaleInput(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) onScaleChange(numValue);
  };

  return (
    <div className="relative">
      {/* Canvas area with light background */}
      <div className="w-full h-[560px] bg-secondary/30 rounded-2xl overflow-hidden relative">
        {/* Top bar: dimensions + scale */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-3">
          {/* Scale */}
          <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm border border-border rounded-lg px-3 py-2">
            <span className="text-xs text-muted-foreground font-medium">Scale</span>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={scaleInput}
              onChange={(e) => handleScaleInputChange(e.target.value)}
              className="w-16 h-7 text-xs border-0 bg-transparent p-0 text-center font-semibold"
              placeholder="1.0"
            />
          </div>

          {/* Dimensions */}
          {dimensions && (
            <div className="flex items-center gap-4 bg-card/80 backdrop-blur-sm border border-border rounded-lg px-4 py-2 text-xs">
              <div><span className="text-muted-foreground">W </span><span className="font-semibold">{dimensions.width.toFixed(1)}</span></div>
              <div><span className="text-muted-foreground">H </span><span className="font-semibold">{dimensions.height.toFixed(1)}</span></div>
              <div><span className="text-muted-foreground">D </span><span className="font-semibold">{dimensions.depth.toFixed(1)}</span></div>
              <span className="text-muted-foreground">mm</span>
            </div>
          )}
        </div>

        {/* 3D Canvas */}
        <Canvas camera={{ position: [3, 3, 3], fov: 60 }} style={{ background: 'transparent' }}>
          <Suspense fallback={null}>
            <Environment preset="studio" />
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={0.8} />
            <Model materialColor={materialColor} geometry={geometry} scale={scale} />
            <CameraAutoFit scale={scale} />
            <OrbitControls
              enablePan={true}
              enableZoom={false}
              enableRotate={true}
              minDistance={1}
              maxDistance={10}
              target={[0, 0, 0]}
              mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
            />
            <ZoomHandler />
          </Suspense>
        </Canvas>

        {/* Navigation instructions overlay */}
        <NavigationOverlay />

        {/* Bottom material bar */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-5 py-4 bg-gradient-to-t from-card/90 to-transparent">
          <MaterialSelector selectedMaterial={selectedMaterial} onMaterialSelect={onMaterialSelect} />
        </div>
      </div>
    </div>
  );
};

export default ThreeViewer;

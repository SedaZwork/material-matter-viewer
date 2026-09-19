import React, { Suspense, useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, ContactShadows } from '@react-three/drei';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import MaterialSelector from '@/components/MaterialSelector';
import { Material } from '@/types/materials';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Focus, Maximize2 } from 'lucide-react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

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
  if (!geometry) return null;

  const hasVertexColors = !!geometry.attributes.color;

  return (
    <group scale={[scale, scale, scale]}>
      <mesh castShadow receiveShadow>
        <primitive object={geometry} />
        <meshStandardMaterial
          color={hasVertexColors ? '#ffffff' : materialColor}
          vertexColors={hasVertexColors}
          roughness={0.42}
          metalness={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

const CameraRig: React.FC<{
  scale: number;
  controlsRef: React.RefObject<OrbitControlsImpl>;
  resetSignal: number;
}> = ({ scale, controlsRef, resetSignal }) => {
  const { camera } = useThree();

  useEffect(() => {
    const dist = Math.max(5.6, 5.8 * scale);
    camera.position.set(dist * 0.64, dist * 0.48, dist * 0.64);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    controlsRef.current?.target.set(0, 0, 0);
    controlsRef.current?.update();
  }, [scale, resetSignal, camera, controlsRef]);

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
      <div className="bg-viewport-panel text-viewport-foreground rounded-lg border border-viewport-border px-6 py-4 text-center space-y-2 backdrop-blur-xl max-w-xs shadow-elevated">
        {isMobile ? (
          <>
            <p className="text-sm font-medium">One finger to rotate</p>
            <p className="text-sm font-medium">Two fingers to pan</p>
            <p className="text-sm font-medium">Pinch to zoom</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">Drag to orbit</p>
            <p className="text-sm font-medium">Right drag to pan</p>
            <p className="text-sm font-medium">Scroll to zoom</p>
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
  const [scaleInput, setScaleInput] = useState(scale.toString());
  const [resetSignal, setResetSignal] = useState(0);
  const viewerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const normalizedGeometry = useMemo(() => {
    if (!geometry) return undefined;
    const clone = geometry.clone();
    const box = new THREE.Box3().setFromBufferAttribute(clone.attributes.position as THREE.BufferAttribute);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);
    clone.translate(-center.x, -center.y, -center.z);
    if (maxDimension > 0) {
      const fitScale = 3 / maxDimension;
      clone.scale(fitScale, fitScale, fitScale);
    }
    if (!clone.attributes.normal) clone.computeVertexNormals();
    return clone;
  }, [geometry]);

  const dimensions = useMemo(() => {
    if (externalDimensions) {
      return {
        width: externalDimensions.width * scale,
        height: externalDimensions.height * scale,
        depth: externalDimensions.depth * scale,
      };
    }
    if (!geometry) return null;
    const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position as THREE.BufferAttribute);
    const size = box.getSize(new THREE.Vector3());
    return { width: size.x * scale, height: size.y * scale, depth: size.z * scale };
  }, [externalDimensions, geometry, scale]);

  useEffect(() => {
    setScaleInput(scale.toFixed(2));
  }, [scale]);

  if (!geometry) return null;

  const handleScaleInputChange = (value: string) => {
    setScaleInput(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) onScaleChange(numValue);
  };

  const enterFullscreen = () => {
    if (viewerRef.current?.requestFullscreen) void viewerRef.current.requestFullscreen();
  };

  return (
    <div className="relative" ref={viewerRef}>
      <div className="w-full h-[560px] min-h-[420px] bg-viewport rounded-xl overflow-hidden relative border border-viewport-border shadow-elevated md:h-[640px]">
        {/* Top bar: dimensions + scale */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-start justify-between gap-3 p-3 md:p-5 pointer-events-none">
          {/* Scale */}
          <div className="flex items-center gap-2 bg-viewport-panel text-viewport-foreground backdrop-blur-xl border border-viewport-border rounded-lg px-3 py-2 pointer-events-auto">
            <span className="text-xs text-viewport-muted font-medium">Scale</span>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={scaleInput}
              onChange={(e) => handleScaleInputChange(e.target.value)}
              className="w-16 h-7 text-xs border-0 bg-transparent p-0 text-center font-semibold text-viewport-foreground focus-visible:ring-0"
              placeholder="1.0"
            />
          </div>

          {/* Dimensions */}
          {dimensions && (
            <div className="hidden sm:flex items-center gap-4 bg-viewport-panel text-viewport-foreground backdrop-blur-xl border border-viewport-border rounded-lg px-4 py-2 text-xs">
              <div><span className="text-viewport-muted">W </span><span className="font-semibold">{dimensions.width.toFixed(1)}</span></div>
              <div><span className="text-viewport-muted">H </span><span className="font-semibold">{dimensions.height.toFixed(1)}</span></div>
              <div><span className="text-viewport-muted">D </span><span className="font-semibold">{dimensions.depth.toFixed(1)}</span></div>
              <span className="text-viewport-muted">mm</span>
            </div>
          )}

          <TooltipProvider>
            <div className="flex gap-2 pointer-events-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button aria-label="Center model" variant="ghost" size="icon" onClick={() => setResetSignal(value => value + 1)} className="h-9 w-9 bg-viewport-panel text-viewport-foreground border border-viewport-border hover:bg-viewport-control hover:text-viewport-foreground">
                    <Focus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Center model</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button aria-label="Full screen" variant="ghost" size="icon" onClick={enterFullscreen} className="h-9 w-9 bg-viewport-panel text-viewport-foreground border border-viewport-border hover:bg-viewport-control hover:text-viewport-foreground">
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Full screen</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {/* 3D Canvas */}
        <Canvas shadows camera={{ position: [3.1, 2.3, 3.1], fov: 48, near: 0.1, far: 100 }} dpr={[1, 2]}>
          <color attach="background" args={['#0d0d10']} />
          <fog attach="fog" args={['#0d0d10', 10, 24]} />
          <Suspense fallback={null}>
            <ambientLight intensity={0.55} />
            <hemisphereLight args={['#dfe7f2', '#1a1a20', 0.7]} />
            <directionalLight position={[6, 9, 5]} intensity={2.2} castShadow />
            <directionalLight position={[-5, 3, -4]} intensity={0.8} color="#6a9bcc" />
            <directionalLight position={[0, -4, -6]} intensity={0.4} color="#ffd9b0" />
            <Model materialColor={materialColor} geometry={normalizedGeometry} scale={scale} />
            <ContactShadows position={[0, -1.62 * scale, 0]} opacity={0.45} scale={9} blur={2.5} far={5} />
            <Grid
              position={[0, -1.65 * scale, 0]}
              args={[30, 30]}
              cellSize={0.25}
              cellThickness={0.5}
              cellColor="#55545c"
              sectionSize={1}
              sectionThickness={1}
              sectionColor="#777580"
              fadeDistance={14}
              fadeStrength={1.5}
              infiniteGrid
            />
            <CameraRig scale={scale} controlsRef={controlsRef} resetSignal={resetSignal} />
            <OrbitControls
              ref={controlsRef}
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minDistance={1.5}
              maxDistance={20}
              target={[0, 0, 0]}
              dampingFactor={0.08}
              enableDamping
              screenSpacePanning
              mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
            />
            <GizmoHelper alignment="bottom-right" margin={[76, 118]}>
              <GizmoViewport axisColors={['#c86a6a', '#788c5d', '#6a9bcc']} labelColor="#f5f3ee" />
            </GizmoHelper>
          </Suspense>
        </Canvas>

        {/* Navigation instructions overlay */}
        <NavigationOverlay />

        {/* Bottom material bar */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-3 py-3 md:px-5 md:py-4 bg-gradient-to-t from-viewport via-viewport/90 to-transparent pointer-events-none">
          <div className="pointer-events-auto">
          <MaterialSelector selectedMaterial={selectedMaterial} onMaterialSelect={onMaterialSelect} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreeViewer;

import React, { Suspense, useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, ContactShadows, Environment, Lightformer } from '@react-three/drei';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import MaterialSelector from '@/components/MaterialSelector';
import { Material, MaterialPBR } from '@/types/materials';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Focus, Maximize2, Hand, ScanLine, X, Pause, Play, RotateCcw, MapPin, Trash2, SlidersHorizontal } from 'lucide-react';
import CameraBackdrop from '@/components/CameraBackdrop';
import { useCamera } from '@/hooks/useCamera';
import { useViewerTracking } from '@/hooks/useViewerTracking';
import TrackedModel, { DEFAULT_CALIBRATION, type FingerCalibration } from '@/components/TrackedModel';
import LibraryModelPicker, { type LibraryModel } from '@/components/LibraryModelPicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

const normalizedCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
/** Center and fit a geometry to `size` viewer units (cached per source geometry). */
function normalize(geometry: THREE.BufferGeometry, size: number) {
  const cached = normalizedCache.get(geometry);
  if (cached) return cached;
  const clone = geometry.clone();
  clone.computeBoundingBox();
  const box = clone.boundingBox!;
  const center = box.getCenter(new THREE.Vector3());
  const max = Math.max(...box.getSize(new THREE.Vector3()).toArray()) || 1;
  clone.translate(-center.x, -center.y, -center.z);
  clone.scale(size / max, size / max, size / max);
  normalizedCache.set(geometry, clone);
  return clone;
}

interface ModelProps {
  materialColor: string;
  pbr?: MaterialPBR;
  geometry?: THREE.BufferGeometry;
  scale: number;
}

interface Dimensions {
  width: number;
  height: number;
  depth: number;
}

const Model: React.FC<ModelProps> = ({ materialColor, pbr, geometry, scale }) => {
  if (!geometry) return null;

  const hasVertexColors = !!geometry.attributes.color;
  const useVertex = hasVertexColors && (!pbr || pbr.metalness < 0.5);

  return (
    <group scale={[scale, scale, scale]}>
      <mesh castShadow receiveShadow>
        <primitive object={geometry} />
        <meshStandardMaterial
          color={useVertex ? '#ffffff' : (pbr?.color ?? materialColor)}
          vertexColors={useVertex}
          roughness={pbr?.roughness ?? 0.42}
          metalness={pbr?.metalness ?? 0.12}
          envMapIntensity={pbr?.envIntensity ?? 1}
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
  cameraBackground?: boolean;
  recipe?: string;
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
  cameraBackground = false,
  recipe = 'upload',
}) => {
  const { isActive: cameraActive, videoRef: registerVideo } = useCamera();
  const tracking = useViewerTracking();
  const trackingVideo = useRef<HTMLVideoElement>(null);
  const [finger, setFinger] = useState(13);
  const [axis, setAxis] = useState<'x' | 'y' | 'z'>('y');
  const [paused, setPaused] = useState(false);
  const [placeSignal, setPlaceSignal] = useState(0);
  const [calibration, setCalibration] = useState<FingerCalibration>(DEFAULT_CALIBRATION);
  const [extras, setExtras] = useState<LibraryModel[]>([]);
  const panelButton = 'bg-viewport-panel text-viewport-foreground border-viewport-border hover:bg-viewport-control hover:text-viewport-foreground';
  const activeTracking = tracking.mode !== 'off';
  const showCamera = (cameraBackground && cameraActive) || activeTracking;
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
    <div className={cn('relative', activeTracking && 'fixed inset-0 z-50 bg-viewport')} ref={viewerRef}>
      <div className={cn('w-full min-h-[420px] bg-viewport overflow-hidden relative border border-viewport-border shadow-elevated', activeTracking ? 'h-dvh' : 'h-[560px] rounded-xl md:h-[640px]')}>
        {!activeTracking && cameraBackground && <CameraBackdrop />}
        {tracking.mode === 'hand' && <video ref={element => { trackingVideo.current = element; registerVideo(element); }} playsInline muted aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />}
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
                  <Button aria-label={activeTracking ? 'Reset placement' : 'Center model'} variant="ghost" size="icon" onClick={() => setResetSignal(value => value + 1)} className="h-9 w-9 bg-viewport-panel text-viewport-foreground border border-viewport-border hover:bg-viewport-control hover:text-viewport-foreground">
                    <Focus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{activeTracking ? 'Reset placement' : 'Center model'}</TooltipContent>
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

        <div className="absolute top-20 inset-x-3 z-20 flex flex-wrap items-center gap-2 md:inset-x-5">
          <Button variant="outline" disabled={tracking.busy} onClick={() => { setPaused(false); if (activeTracking) void tracking.stop(); else void tracking.start(recipe === 'ring' ? 'hand' : 'plane', viewerRef.current); }} className={panelButton}>
            {activeTracking ? <X /> : recipe === 'ring' ? <Hand /> : <ScanLine />}
            {activeTracking ? 'Exit tracking' : recipe === 'ring' ? 'Try on finger' : 'Place on surface'}
          </Button>
          {activeTracking && <>
            <Button variant="outline" onClick={() => setPaused(value => !value)} className={panelButton}>
              {paused ? <Play /> : <Pause />}{paused ? 'Resume' : 'Pause'}
            </Button>
            <Button variant="outline" onClick={() => { setPaused(false); setResetSignal(value => value + 1); }} className={panelButton}>
              <RotateCcw />Reset tracking
            </Button>
          </>}
          {tracking.mode === 'plane' && <Button onClick={() => { setPaused(false); setPlaceSignal(value => value + 1); }}><MapPin />Place object</Button>}
          <LibraryModelPicker className={panelButton} onAdd={model => setExtras(list => [...list.filter(item => item.id !== model.id), model])} />
          {extras.length > 0 && <Button variant="outline" onClick={() => setExtras([])} className={panelButton}><Trash2 />Clear added ({extras.length})</Button>}
          {tracking.mode === 'hand' && <>
            <Select value={String(finger)} onValueChange={value => setFinger(Number(value))}>
              <SelectTrigger aria-label="Tracked finger" className="w-32 bg-viewport-panel text-viewport-foreground border-viewport-border"><SelectValue /></SelectTrigger>
              <SelectContent>{[[5, 'Index'], [9, 'Middle'], [13, 'Ring'], [17, 'Little']].map(([id, name]) => <SelectItem key={id} value={String(id)}>{name} finger</SelectItem>)}</SelectContent>
            </Select>
            <Select value={axis} onValueChange={value => { if (value === 'x' || value === 'y' || value === 'z') setAxis(value); }}>
              <SelectTrigger aria-label="Ring hole axis" className="w-24 bg-viewport-panel text-viewport-foreground border-viewport-border"><SelectValue /></SelectTrigger>
              <SelectContent>{['x', 'y', 'z'].map(value => <SelectItem key={value} value={value}>Axis {value.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
          </>}
          {recipe === 'ring' && (
            <Popover>
              <PopoverTrigger asChild><Button variant="outline" className={panelButton}><SlidersHorizontal />Finger fit</Button></PopoverTrigger>
              <PopoverContent className="w-72 space-y-4">
                <p className="text-sm font-medium">Adjust how the ring sits on your finger</p>
                {([['size', 'Ring size on finger', 0.6, 1.6, 0.01, `${Math.round(calibration.size * 100)}%`],
                   ['slide', 'Position along finger', 0, 1, 0.01, `${Math.round(calibration.slide * 100)}%`],
                   ['twist', 'Rotation', -180, 180, 1, `${calibration.twist}°`]] as const).map(([key, label, min, max, step, shown]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex justify-between text-xs"><span>{label}</span><span className="text-muted-foreground">{shown}</span></div>
                    <Slider aria-label={label} min={min} max={max} step={step} value={[calibration[key]]} onValueChange={([value]) => setCalibration(current => ({ ...current, [key]: value }))} />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Preview only — your order size doesn't change.</p>
                <Button variant="outline" size="sm" onClick={() => setCalibration(DEFAULT_CALIBRATION)}>Reset fit</Button>
              </PopoverContent>
            </Popover>
          )}
          {tracking.status && <p role="status" className="basis-full max-w-md rounded-md bg-viewport-panel px-3 py-2 text-xs text-viewport-foreground">{tracking.status}</p>}
        </div>

        {/* 3D Canvas */}
        <Canvas shadows gl={{ alpha: true }} onCreated={({ gl }) => { tracking.renderer.current = gl; }} camera={{ position: [3.1, 2.3, 3.1], fov: 48, near: 0.01, far: 100 }} dpr={[1, 2]}>
          {!showCamera && <color attach="background" args={['#0d0d10']} />}
          {!showCamera && <fog attach="fog" args={['#0d0d10', 10, 24]} />}
          <Suspense fallback={null}>
            <ambientLight intensity={0.55} />
            <hemisphereLight args={['#dfe7f2', '#1a1a20', 0.7]} />
            <directionalLight position={[6, 9, 5]} intensity={2.2} castShadow />
            <directionalLight position={[-5, 3, -4]} intensity={0.8} color="#6a9bcc" />
            <directionalLight position={[0, -4, -6]} intensity={0.4} color="#ffd9b0" />
            {/* Locally-built studio reflections (no network fetch) so metals read correctly */}
            <Environment resolution={256} frames={1}>
              <Lightformer form="rect" intensity={4} position={[0, 5, -3]} scale={[10, 3, 1]} />
              <Lightformer form="rect" intensity={2} position={[-5, 1, 2]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
              <Lightformer form="rect" intensity={2} position={[5, 1, 2]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} />
              <Lightformer form="ring" intensity={1.5} position={[0, 2, 5]} scale={3} />
            </Environment>
            {activeTracking ? <>
              <TrackedModel geometry={geometry} pbr={selectedMaterial?.pbr} color={materialColor} scale={scale} mode={tracking.mode} video={trackingVideo} plane={tracking.plane} finger={finger} axis={axis} reset={resetSignal} onStatus={tracking.setStatus} paused={paused} place={placeSignal} calibration={calibration} />
              {tracking.mode === 'plane' && extras.map((extra, index) => <TrackedModel key={extra.id} quiet geometry={extra.geometry} pbr={selectedMaterial?.pbr} color={materialColor} scale={1} mode="plane" video={trackingVideo} plane={tracking.plane} finger={finger} axis={axis} reset={resetSignal} onStatus={tracking.setStatus} paused={paused} place={placeSignal} offset={0.12 * (index + 1)} />)}
            </> : <>
            <Model materialColor={materialColor} pbr={selectedMaterial?.pbr} geometry={normalizedGeometry} scale={scale} />
            {extras.map((extra, index) => <group key={extra.id} position={[2.6 * (index + 1), 0, 0]}><Model materialColor={materialColor} pbr={selectedMaterial?.pbr} geometry={normalize(extra.geometry, 2)} scale={1} /></group>)}
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
            </>}
          </Suspense>
        </Canvas>

        {/* Navigation instructions overlay */}
        {!activeTracking && <NavigationOverlay />}

        {/* Bottom material bar */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-3 py-3 md:px-5 md:py-4 bg-gradient-to-t from-viewport via-viewport/90 to-transparent pointer-events-none">
          <div className="pointer-events-auto">
          <MaterialSelector materials={materials} selectedMaterial={selectedMaterial} onMaterialSelect={onMaterialSelect} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreeViewer;

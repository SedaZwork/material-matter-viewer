import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { ArrowLeft, Download, RotateCcw, ShoppingCart, Eye, Camera, CameraOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { productRecipes } from '@/data/recipes';
import { useCamera } from '@/hooks/useCamera';
import { cn } from '@/lib/utils';

type TextureType = 'voronoi' | 'hexagonal' | 'bricks';

interface ControlPoint { x: number; y: number; }

const DEFAULT_POINTS: ControlPoint[] = [
  { x: 0, y: 0 },
  { x: 0.1, y: 0.05 },
  { x: 0.2, y: 0.25 },
  { x: 0.13, y: 0.5 },
  { x: 0.22, y: 0.8 },
  { x: 0.16, y: 1 }
];

const VesselGenerator = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const recipe = location.state?.recipe || productRecipes.find(r => r.id === 'ceramic-vessel');

  const [points, setPoints] = useState<ControlPoint[]>(DEFAULT_POINTS);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [segments, setSegments] = useState(128);
  const [heightScale, setHeightScale] = useState(1);
  const [radiusScale, setRadiusScale] = useState(1);
  const [textureType, setTextureType] = useState<TextureType>('voronoi');
  const [textureScaleX, setTextureScaleX] = useState(8);
  const [textureScaleY, setTextureScaleY] = useState(8);
  const [textureScaleZ, setTextureScaleZ] = useState(8);
  const [textureStrength, setTextureStrength] = useState(0.02);
  const [material, setMaterial] = useState(recipe?.materials[0] || 'porcelain');
  const [quantity, setQuantity] = useState(1);
  const [splineSmoothness, setSplineSmoothness] = useState(0.5);
  const [arMode, setArMode] = useState(false);

  const { videoRef, isActive: cameraActive, error: cameraError, start: startCamera, stop: stopCamera } = useCamera();

  // Toggle AR mode
  const toggleAR = async () => {
    if (arMode) {
      setArMode(false);
      stopCamera();
      // Restore opaque background
      if (sceneRef.current && rendererRef.current) {
        sceneRef.current.background = new THREE.Color('#c9d0d6');
        rendererRef.current.setClearAlpha(1);
      }
    } else {
      await startCamera();
      setArMode(true);
      // Make scene transparent for AR overlay
      if (sceneRef.current && rendererRef.current) {
        sceneRef.current.background = null;
        rendererRef.current.setClearAlpha(0);
      }
    }
  };

  const smoothCurvePoints = useMemo(() => {
    if (points.length < 2) return [];
    const splinePoints = points.map((p, i) => {
      const radius = i === 0 ? 0 : Math.max(0.001, p.x * radiusScale);
      return new THREE.Vector3(radius, p.y * heightScale, 0);
    });
    const curve = new THREE.CatmullRomCurve3(splinePoints, false, 'catmullrom', splineSmoothness);
    const sampled = curve.getPoints(100);
    return sampled.map(p => new THREE.Vector2(p.x, p.y));
  }, [points, heightScale, radiusScale, splineSmoothness]);

  const curvePoints = useMemo(() => {
    return points.map((p, i) => {
      const radius = i === 0 ? 0 : Math.max(0.01, p.x * radiusScale);
      return new THREE.Vector2(radius, p.y * heightScale);
    });
  }, [points, heightScale, radiusScale]);

  // Initialize Three.js
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#c9d0d6');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 100);
    camera.position.set(2, 1.2, 2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(5, 8, 6);
    dir.castShadow = true;
    scene.add(ambient, dir);

    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.4);
    fillLight.position.set(-5, 3, -5);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(4, 20, 0xb0b8c4, 0xd4dbe3);
    scene.add(grid);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = true;
    controls.minDistance = 1;
    controls.maxDistance = 5;
    controlsRef.current = controls;

    const mat = new THREE.MeshStandardMaterial({
      color: '#d4a574',
      metalness: 0.1,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });

    const geometry = new THREE.LatheGeometry(curvePoints, segments);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshRef.current = mesh;
    scene.add(mesh);

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      controls.dispose();
      geometry.dispose();
      mat.dispose();
      renderer.dispose();
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update geometry
  useEffect(() => {
    if (!meshRef.current) return;
    const geometry = new THREE.LatheGeometry(curvePoints, segments);
    const pos = geometry.attributes.position;

    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const radial = Math.sqrt(x * x + z * z);
      const theta = Math.atan2(z, x);

      let noise = 0;
      const u = theta * textureScaleX;
      const v = y * textureScaleY;
      const w = radial * textureScaleZ;

      if (textureType === 'voronoi') {
        noise = Math.sin(u) * Math.cos(v) * 0.5 + Math.sin(u * 1.7 + v * 0.8) * 0.5;
        noise += Math.sin(w * 0.5) * 0.3;
      } else if (textureType === 'hexagonal') {
        noise = Math.cos(u) + Math.cos(0.5 * u + 0.866 * v) + Math.cos(0.5 * u - 0.866 * v);
        noise /= 3;
        noise += Math.sin(w) * 0.2;
      } else {
        const brick = (Math.sin(u * 0.7 + Math.floor(v) * 0.8) > 0 ? 1 : -1) * 0.5;
        noise = brick + Math.sin(v * 2.4) * 0.2;
        noise += Math.cos(w) * 0.15;
      }

      const displaced = radial + noise * textureStrength;
      pos.setXYZ(i, Math.cos(theta) * displaced, y, Math.sin(theta) * displaced);
    }

    geometry.computeVertexNormals();
    meshRef.current.geometry.dispose();
    meshRef.current.geometry = geometry;
  }, [curvePoints, segments, textureScaleX, textureScaleY, textureScaleZ, textureStrength, textureType]);

  const downloadModel = () => {
    if (!meshRef.current) return;
    const exporter = new STLExporter();
    const stlString = exporter.parse(meshRef.current, { binary: false }) as string;
    const blob = new Blob([stlString], { type: 'model/stl' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ceramic-vessel.stl';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setPoints(DEFAULT_POINTS);
    setSegments(128);
    setHeightScale(1);
    setRadiusScale(1);
    setTextureType('voronoi');
    setTextureScaleX(8);
    setTextureScaleY(8);
    setTextureScaleZ(8);
    setTextureStrength(0.02);
    setSplineSmoothness(0.5);
    setSelectedPoint(null);
  };

  const calculateSurfaceAndDimensions = useMemo(() => {
    const curveToUse = smoothCurvePoints.length > 0 ? smoothCurvePoints : curvePoints;
    let maxRadius = 0, maxHeight = 0;
    curveToUse.forEach(p => {
      if (p.x > maxRadius) maxRadius = p.x;
      if (p.y > maxHeight) maxHeight = p.y;
    });
    let surfaceArea = 0;
    for (let i = 0; i < curveToUse.length - 1; i++) {
      const p1 = curveToUse[i], p2 = curveToUse[i + 1];
      const dy = p2.y - p1.y, dr = p2.x - p1.x, rAvg = (p1.x + p2.x) / 2;
      surfaceArea += 2 * Math.PI * rAvg * Math.sqrt(dy * dy + dr * dr);
    }
    const baseArea = Math.PI * maxRadius * maxRadius;
    const textureAreaMultiplier = 1 + textureStrength * 2;
    return {
      width: maxRadius * 2 * 100,
      height: maxHeight * 100,
      depth: maxRadius * 2 * 100,
      surfaceArea: (surfaceArea + baseArea) * textureAreaMultiplier * 10000,
    };
  }, [points, smoothCurvePoints, curvePoints, heightScale, radiusScale, textureStrength]);

  const getSTLData = (): string | null => {
    if (!meshRef.current) return null;
    const exporter = new STLExporter();
    return exporter.parse(meshRef.current, { binary: false }) as string;
  };

  const viewInMaterialViewer = () => {
    if (!meshRef.current) return;
    const stlString = getSTLData();
    if (!stlString) return;
    sessionStorage.setItem('vesselSTL', stlString);
    navigate('/', { state: { fromVessel: true } });
  };

  // Slider row helper
  const SliderRow = ({ label, value, onChange, min, max, step, suffix = '' }: {
    label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; suffix?: string;
  }) => (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-black/50">{label}</span>
        <span className="text-black/80 font-medium">{value.toFixed(step < 0.1 ? (step < 0.01 ? 3 : 2) : 1)}{suffix}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
    </div>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden relative" style={{ background: '#c9d0d6' }}>
      {/* Background effects matching RecipeGallery */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.35),transparent_55%)] pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-70 pointer-events-none z-20" />
      <div className="absolute top-[120px] right-0 w-[220px] h-[1px] bg-gradient-to-r from-fuchsia-400 via-cyan-300 to-yellow-300 opacity-70 blur-[1px] rotate-[-12deg] pointer-events-none" />
      <div className="absolute bottom-[180px] left-[10%] w-[320px] h-[2px] bg-gradient-to-r from-violet-400 via-pink-300 to-cyan-300 opacity-60 blur-[2px] rotate-[8deg] pointer-events-none" />
      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[size:80px_80px]" />
      </div>

      {/* Left Panel - Glass Controls */}
      <aside className="relative z-10 w-[360px] shrink-0 overflow-y-auto border-r border-white/30 bg-white/25 backdrop-blur-2xl p-5">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.4em] text-black/45">Recipe · Procedural</div>
            <h1 className="text-xl font-light tracking-tight text-[#111] mt-1">Ceramic Vessel</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-black/50 hover:text-black hover:bg-black/5 rounded-full"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </div>

        {/* Profile Curve Editor */}
        <div className="mb-5">
          <h2 className="mb-2 text-xs font-medium text-black/55 uppercase tracking-wider">Profile Curve</h2>
          <div className="rounded-2xl bg-white/40 backdrop-blur-xl p-3 border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
            <svg viewBox="0 0 220 280" className="h-[240px] w-full">
              <line x1="0" y1="0" x2="220" y2="0" stroke="rgba(0,0,0,0.08)" strokeWidth="0.5" />
              <line x1="0" y1="140" x2="220" y2="140" stroke="rgba(0,0,0,0.08)" strokeWidth="0.5" />
              <line x1="0" y1="280" x2="220" y2="280" stroke="rgba(0,0,0,0.08)" strokeWidth="0.5" />
              <line x1="0" y1="0" x2="0" y2="280" stroke="rgba(0,0,0,0.1)" strokeWidth="1" strokeDasharray="4" />
              <polyline
                points={points.map((p) => `${p.x * 220},${(1 - p.y) * 280}`).join(' ')}
                fill="none"
                stroke="#d4a574"
                strokeWidth={2}
              />
              <circle cx={0} cy={280} r={7} fill="#22c55e" stroke="white" strokeWidth={1.5} />
              <text x="12" y="284" fill="#22c55e" fontSize="9">Base</text>
              {points.map((p, idx) => idx === 0 ? null : (
                <circle
                  key={idx}
                  cx={p.x * 220}
                  cy={(1 - p.y) * 280}
                  r={selectedPoint === idx ? 9 : 6}
                  fill={selectedPoint === idx ? '#f59e0b' : '#d4a574'}
                  stroke="white"
                  strokeWidth={1.5}
                  className="cursor-pointer transition-all hover:fill-amber-500"
                  onClick={() => setSelectedPoint(selectedPoint === idx ? null : idx)}
                />
              ))}
            </svg>
          </div>

          {selectedPoint !== null && selectedPoint > 0 && (
            <div className="mt-3 space-y-3 rounded-2xl bg-white/40 backdrop-blur-xl p-3 border border-white/50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-black/50">Point {selectedPoint}</span>
                <button onClick={() => setSelectedPoint(null)} className="text-black/30 hover:text-black text-lg leading-none">×</button>
              </div>
              <SliderRow label="Radius" value={points[selectedPoint].x} onChange={(v) => setPoints(prev => prev.map((p, i) => i === selectedPoint ? { ...p, x: v } : p))} min={0.05} max={0.4} step={0.005} />
              <SliderRow label="Height" value={points[selectedPoint].y} onChange={(v) => setPoints(prev => prev.map((p, i) => i === selectedPoint ? { ...p, y: v } : p))} min={0} max={1} step={0.005} />
            </div>
          )}
        </div>

        {/* Shape Parameters */}
        <div className="mb-5 rounded-2xl bg-white/35 backdrop-blur-xl p-4 border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.04)] space-y-4">
          <h2 className="text-xs font-medium text-black/55 uppercase tracking-wider">Shape</h2>
          <SliderRow label="Segments" value={segments} onChange={setSegments} min={32} max={256} step={8} />
          <SliderRow label="Height Scale" value={heightScale} onChange={setHeightScale} min={0.6} max={1.8} step={0.01} />
          <SliderRow label="Radius Scale" value={radiusScale} onChange={setRadiusScale} min={0.5} max={1.8} step={0.01} />
          <SliderRow label="Spline Smoothness" value={splineSmoothness} onChange={setSplineSmoothness} min={0} max={1} step={0.01} />
        </div>

        {/* Texture */}
        <div className="mb-5 rounded-2xl bg-white/35 backdrop-blur-xl p-4 border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.04)] space-y-4">
          <h2 className="text-xs font-medium text-black/55 uppercase tracking-wider">Surface Texture</h2>
          <div className="space-y-1.5">
            <span className="text-xs text-black/50">Pattern</span>
            <Select value={textureType} onValueChange={(v) => setTextureType(v as TextureType)}>
              <SelectTrigger className="bg-white/50 border-white/60 text-black/80 rounded-xl h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="voronoi">Voronoi Pattern</SelectItem>
                <SelectItem value="hexagonal">Hexagonal Grid</SelectItem>
                <SelectItem value="bricks">Brick Pattern</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SliderRow label="Scale X" value={textureScaleX} onChange={setTextureScaleX} min={2} max={30} step={0.5} />
          <SliderRow label="Scale Y" value={textureScaleY} onChange={setTextureScaleY} min={2} max={30} step={0.5} />
          <SliderRow label="Scale Z" value={textureScaleZ} onChange={setTextureScaleZ} min={2} max={30} step={0.5} />
          <SliderRow label="Relief" value={textureStrength} onChange={setTextureStrength} min={0} max={0.08} step={0.001} suffix="mm" />
        </div>

        {/* Material & Quantity */}
        <div className="mb-5 rounded-2xl bg-white/35 backdrop-blur-xl p-4 border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.04)] space-y-4">
          <h2 className="text-xs font-medium text-black/55 uppercase tracking-wider">Options</h2>
          {recipe && (
            <div className="space-y-1.5">
              <span className="text-xs text-black/50">Material</span>
              <Select value={material} onValueChange={setMaterial}>
                <SelectTrigger className="bg-white/50 border-white/60 text-black/80 rounded-xl h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {recipe.materials.map((m: string) => (
                    <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <span className="text-xs text-black/50">Quantity</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-9 h-9 rounded-xl bg-white/50 border border-white/60 text-black/60 hover:bg-white/70 flex items-center justify-center text-lg">-</button>
              <span className="text-black/80 font-medium w-8 text-center">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="w-9 h-9 rounded-xl bg-white/50 border border-white/60 text-black/60 hover:bg-white/70 flex items-center justify-center text-lg">+</button>
            </div>
          </div>
        </div>

        {/* Dimensions */}
        <div className="mb-5 rounded-2xl bg-white/35 backdrop-blur-xl p-4 border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
          <h2 className="text-xs font-medium text-black/55 uppercase tracking-wider mb-3">Dimensions</h2>
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            {[
              ['W', calculateSurfaceAndDimensions.width],
              ['H', calculateSurfaceAndDimensions.height],
              ['D', calculateSurfaceAndDimensions.depth],
            ].map(([label, val]) => (
              <div key={label as string} className="rounded-xl bg-white/40 p-2">
                <p className="text-black/40 text-[10px] uppercase">{label}</p>
                <p className="text-black/80 font-medium text-sm">{(val as number).toFixed(1)}<span className="text-[10px] text-black/40">mm</span></p>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs border-t border-black/5 pt-2">
            <span className="text-black/40">Surface Area</span>
            <span className="text-black/70 font-medium">{(calculateSurfaceAndDimensions.surfaceArea / 100).toFixed(2)} cm²</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button onClick={resetAll} variant="outline" className="flex-1 rounded-xl bg-white/40 border-white/50 text-black/60 hover:bg-white/60 hover:text-black">
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset
            </Button>
            <Button onClick={downloadModel} variant="outline" className="flex-1 rounded-xl bg-white/40 border-white/50 text-black/60 hover:bg-white/60 hover:text-black">
              <Download className="w-3.5 h-3.5 mr-1.5" /> STL
            </Button>
          </div>
          <div className="flex gap-2">
            <Button onClick={viewInMaterialViewer} variant="outline" className="flex-1 rounded-xl bg-white/40 border-white/50 text-black/60 hover:bg-white/60 hover:text-black">
              <Eye className="w-3.5 h-3.5 mr-1.5" /> 3D View
            </Button>
            <Button onClick={viewInMaterialViewer} className="flex-1 rounded-xl bg-[#1f2328] text-white hover:bg-[#1f2328]/90">
              <ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Checkout
            </Button>
          </div>
        </div>
      </aside>

      {/* Right Panel - 3D Viewport */}
      <main className="flex-1 relative z-10">
        {/* Camera video behind canvas */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-all duration-700",
            cameraActive ? "opacity-100" : "opacity-0 pointer-events-none",
            cameraActive && !arMode ? "blur-xl scale-105" : ""
          )}
        />

        {/* 3D canvas (transparent in AR mode) */}
        <div ref={mountRef} className="absolute inset-0 w-full h-full" />

        {/* AR toggle button */}
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          <button
            onClick={toggleAR}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-full border backdrop-blur-2xl transition-all duration-300 text-sm font-medium shadow-[0_8px_32px_rgba(0,0,0,0.1)]",
              arMode
                ? "bg-black/60 border-white/20 text-white hover:bg-black/70"
                : "bg-white/40 border-white/50 text-black/70 hover:bg-white/60"
            )}
          >
            {arMode ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            {arMode ? 'Exit AR' : 'AR Preview'}
          </button>
        </div>

        {/* AR mode indicator */}
        {arMode && (
          <div className="absolute top-4 left-4 z-20">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-xl border border-white/10 text-white text-xs">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              AR Mode — Place vessel in real space
            </div>
          </div>
        )}

        {cameraError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl bg-red-500/80 backdrop-blur-xl text-white text-sm">
            {cameraError}
          </div>
        )}

        {/* Controls hint */}
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="inline-flex items-center gap-4 px-4 py-2.5 rounded-full bg-white/30 backdrop-blur-2xl border border-white/40 text-xs text-black/50 shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
            <span>Drag: Rotate</span>
            <span>Right-drag: Pan</span>
            <span>Scroll: Zoom</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default VesselGenerator;

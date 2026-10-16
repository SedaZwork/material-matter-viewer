import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import {
  ArrowLeft, Download, RotateCcw, ShoppingCart, Eye, Camera, CameraOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useCamera } from '@/hooks/useCamera';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

type PatternType = 'organic' | 'wave' | 'strips' | 'petals' | 'checker' | 'chisel' | 'dots';

interface ControlPoint { x: number; y: number; }

const PATTERN_LABELS: Record<PatternType, string> = {
  organic:  'Organic noise',
  wave:     'Wave rings',
  strips:   'Vertical strips',
  petals:   'Petals',
  checker:  'Checker',
  chisel:   'Chisel facets',
  dots:     'Raised dots',
};

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_POINTS: ControlPoint[] = [
  { x: 0,    y: 0    },
  { x: 0.10, y: 0.05 },
  { x: 0.20, y: 0.25 },
  { x: 0.13, y: 0.50 },
  { x: 0.22, y: 0.80 },
  { x: 0.16, y: 1.00 },
];

// ── Displacement kernels ───────────────────────────────────────────────────────
// Each function returns a signed scalar in [-1, 1].
// `theta` ∈ [−π, π], `ny` ∈ [0, 1] (normalised height), `sx/sy` are UI scale params.

function displace(
  pattern: PatternType,
  theta: number,
  ny: number,
  sx: number,
  sy: number,
): number {
  const T = theta; // angle around axis
  const Y = ny;    // normalised height 0→1

  switch (pattern) {
    case 'organic': {
      // Multi-frequency sine lattice that looks hand-formed.
      const a = Math.sin(T * sx + Y * sy * 0.7) * Math.cos(T * sx * 0.6 - Y * sy * 1.1);
      const b = Math.sin(T * sx * 1.9 + Y * sy * 0.4) * 0.45;
      const c = Math.cos(T * sx * 0.5 + Y * sy * 1.8) * 0.3;
      return (a + b + c) / 1.75;
    }
    case 'wave': {
      // Pure horizontal sine rings — no theta dependence.
      return Math.sin(Y * sy * Math.PI * 2 + Math.PI * 0.5) *
             (0.6 + 0.4 * Math.cos(T * sx * 0.5));
    }
    case 'strips': {
      // Sharp vertical ridges: triangular wave in theta, smooth in height.
      const raw = Math.sin(T * sx);
      // Sharpen with sign + soft clamp for crease-like ridges.
      const sharp = Math.tanh(raw * 4) * 0.85;
      // Slight height modulation so they taper toward top/bottom.
      const hMod = 0.6 + 0.4 * Math.sin(Y * Math.PI);
      return sharp * hMod;
    }
    case 'petals': {
      // Rounded lobes: theta cosine raised to an even power × bell in height.
      const numPetals = Math.max(2, Math.round(sx));
      const thetaBump = Math.pow(Math.cos(T * numPetals), 2);
      const heightBell = Math.sin(Y * sy * Math.PI * 0.5 + 0.2);
      return (thetaBump * heightBell * 2 - 0.5);
    }
    case 'checker': {
      // Checkerboard tiles: sign-product of sine in theta and height.
      const tSign = Math.sign(Math.sin(T * sx));
      const ySign = Math.sign(Math.sin(Y * sy * Math.PI));
      return tSign * ySign * 0.9;
    }
    case 'chisel': {
      // Triangular wave (sawtooth blended) in theta → angular facets.
      // frac = 0→1 within each tooth
      const period = (2 * Math.PI) / Math.max(1, sx);
      const frac = ((T % period) + period) % period / period;
      // Triangular wave: 0→1→0
      const tri = frac < 0.5 ? frac * 2 : (1 - frac) * 2;
      // Height-based shading so facets catch light differently at each ring.
      const yFade = 0.5 + 0.5 * Math.cos(Y * sy * Math.PI);
      return (tri * 2 - 1) * (0.6 + 0.4 * yFade);
    }
    case 'dots': {
      // Raised hemispherical bumps on a cylindrical grid.
      const cols = Math.max(2, Math.round(sx));          // bumps around circumference
      const rows = Math.max(1, Math.round(sy));           // bump rows up the height
      const dotRadius = Math.PI / (cols * 1.4);           // angular half-width of each bump
      const thetaNorm = ((T + Math.PI) / (2 * Math.PI)); // 0..1
      const cellT = (thetaNorm * cols) % 1;              // fraction inside column cell
      const cellY = (Y * rows) % 1;                      // fraction inside row cell
      // Map cell fractions to signed distance from cell centre.
      const dT = (cellT - 0.5) * (2 * Math.PI / cols);  // radians offset from centre
      const dY = (cellY - 0.5) * (1 / rows);            // normalised offset from centre
      const distSq = dT * dT + (dY * Math.PI) ** 2;
      const r = Math.sqrt(distSq) / dotRadius;
      return r < 1 ? Math.cos(r * Math.PI * 0.5) ** 2 * 2 - 1 : -0.15;
    }
    default:
      return 0;
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

const VesselGenerator = () => {
  const navigate = useNavigate();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Profile curve
  const [points, setPoints] = useState<ControlPoint[]>(DEFAULT_POINTS);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

  // Shape
  const [segments, setSegments] = useState(128);
  const [heightScale, setHeightScale] = useState(1);
  const [radiusScale, setRadiusScale] = useState(1);
  const [splineSmoothness, setSplineSmoothness] = useState(0.5);

  // Surface
  const [pattern, setPattern] = useState<PatternType>('organic');
  const [scaleX, setScaleX] = useState(8);   // angular frequency / count
  const [scaleY, setScaleY] = useState(8);   // height frequency / count
  const [strength, setStrength] = useState(0.025);
  const [twist, setTwist] = useState(0);     // total twist in radians

  // AR
  const [arMode, setArMode] = useState(false);
  const { videoRef, isActive: cameraActive, error: cameraError, start: startCamera, stop: stopCamera } = useCamera();

  // ── Curve helpers ──────────────────────────────────────────────────────────

  const lathePoints = useMemo<THREE.Vector2[]>(() => {
    if (points.length < 2) return [];
    const spline = points.map((p, i) => new THREE.Vector3(
      i === 0 ? 0 : Math.max(0.001, p.x * radiusScale),
      p.y * heightScale,
      0,
    ));
    const curve = new THREE.CatmullRomCurve3(spline, false, 'catmullrom', splineSmoothness);
    return curve.getPoints(100).map(p => new THREE.Vector2(p.x, p.y));
  }, [points, heightScale, radiusScale, splineSmoothness]);

  // ── Geometry builder ────────────────────────────────────────────────────────
  // Returns a new BufferGeometry with displacement + twist applied.

  const buildGeometry = (): THREE.BufferGeometry => {
    const base = new THREE.LatheGeometry(lathePoints, segments);
    const pos = base.attributes.position as THREE.Float32BufferAttribute;

    // Height extent for twist normalisation.
    let maxY = 0;
    for (let i = 0; i < pos.count; i++) maxY = Math.max(maxY, pos.getY(i));
    if (maxY === 0) maxY = 1;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      const r = Math.sqrt(x * x + z * z);
      const theta = Math.atan2(z, x);
      const ny = y / maxY; // normalised height

      // 1. Displacement in radial direction.
      const d = displace(pattern, theta, ny, scaleX, scaleY);
      const rNew = Math.max(0.001, r + d * strength);

      // 2. Twist applied AFTER displacement (avoids displacing a pre-twisted surface).
      const thetaNew = theta + twist * ny;

      pos.setXYZ(i, Math.cos(thetaNew) * rNew, y, Math.sin(thetaNew) * rNew);
    }

    base.computeVertexNormals();
    return base;
  };

  // ── Three.js scene initialisation ──────────────────────────────────────────

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = null; // transparent; backdrop drawn by CSS
    sceneRef.current = scene;

    const w = mountRef.current.clientWidth;
    const h = mountRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.set(2, 1.2, 2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(5, 8, 6);
    dir.castShadow = true;
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0x94a3b8, 0.5);
    fill.position.set(-5, 3, -5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffd9b0, 0.35);
    rim.position.set(0, -4, -6);
    scene.add(rim);

    const grid = new THREE.GridHelper(4, 20, 0x9ba3b0, 0xc4cbda);
    scene.add(grid);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 0.8;
    controls.maxDistance = 6;
    controlsRef.current = controls;

    const mat = new THREE.MeshStandardMaterial({
      color: '#d4a574',
      metalness: 0.05,
      roughness: 0.48,
      side: THREE.DoubleSide,
    });

    const geo = buildGeometry();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshRef.current = mesh;
    scene.add(mesh);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w2 = mountRef.current.clientWidth;
      const h2 = mountRef.current.clientHeight;
      cameraRef.current.aspect = w2 / h2;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w2, h2);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rebuild geometry on param change ──────────────────────────────────────

  useEffect(() => {
    if (!meshRef.current) return;
    const newGeo = buildGeometry();
    meshRef.current.geometry.dispose();
    meshRef.current.geometry = newGeo;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lathePoints, segments, pattern, scaleX, scaleY, strength, twist]);

  // ── AR toggle ─────────────────────────────────────────────────────────────

  const toggleAR = async () => {
    if (arMode) {
      setArMode(false);
      stopCamera();
    } else {
      const ok = await startCamera();
      if (!ok) return;
      setArMode(true);
    }
  };

  // ── Dimensions ────────────────────────────────────────────────────────────

  const dims = useMemo(() => {
    let maxR = 0, maxH = 0;
    lathePoints.forEach(p => {
      if (p.x > maxR) maxR = p.x;
      if (p.y > maxH) maxH = p.y;
    });
    // Surface area approximation
    let sa = 0;
    for (let i = 0; i < lathePoints.length - 1; i++) {
      const p1 = lathePoints[i], p2 = lathePoints[i + 1];
      const dy = p2.y - p1.y, dr = p2.x - p1.x, rAvg = (p1.x + p2.x) / 2;
      sa += 2 * Math.PI * rAvg * Math.sqrt(dy * dy + dr * dr);
    }
    sa += Math.PI * maxR * maxR; // base
    sa *= 1 + strength * 3;     // texture area multiplier
    return {
      w: maxR * 2 * 100,
      h: maxH * 100,
      d: maxR * 2 * 100,
      sa: sa * 10000,
    };
  }, [lathePoints, strength]);

  // ── Export ────────────────────────────────────────────────────────────────

  const downloadSTL = () => {
    if (!meshRef.current) return;
    const exporter = new STLExporter();
    const blob = new Blob([exporter.parse(meshRef.current, { binary: false }) as string], { type: 'model/stl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ceramic-vessel.stl'; a.click();
    URL.revokeObjectURL(url);
  };

  const sendToViewer = () => {
    if (!meshRef.current) return;
    // Use in-memory transfer to avoid sessionStorage quota limits.
    const geo = meshRef.current.geometry as THREE.BufferGeometry;
    (window as any).__transferGeometry = geo.toJSON();
    navigate('/', { state: { fromVessel: true, recipe: 'vessel' } });
  };

  // ── Reset ─────────────────────────────────────────────────────────────────

  const resetAll = () => {
    setPoints(DEFAULT_POINTS);
    setSegments(128);
    setHeightScale(1);
    setRadiusScale(1);
    setSplineSmoothness(0.5);
    setPattern('organic');
    setScaleX(8);
    setScaleY(8);
    setStrength(0.025);
    setTwist(0);
    setSelectedPoint(null);
  };

  // ── Shared slider row ──────────────────────────────────────────────────────

  const SliderRow = ({
    label, value, onChange, min, max, step, suffix = '', decimals,
  }: {
    label: string; value: number; onChange: (v: number) => void;
    min: number; max: number; step: number; suffix?: string; decimals?: number;
  }) => {
    const dp = decimals ?? (step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0);
    return (
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="text-foreground font-medium">{value.toFixed(dp)}{suffix}</span>
        </div>
        <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen w-full overflow-hidden relative bg-secondary">
      {/* Subtle aero background accents */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_10%,hsl(var(--primary)/0.07),transparent_60%)] pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent pointer-events-none z-20" />

      {/* ── Left panel ── */}
      <aside className="relative z-10 w-[320px] lg:w-[360px] shrink-0 overflow-y-auto border-r border-border bg-card/80 backdrop-blur-xl p-5 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Recipe · Procedural</p>
            <h1 className="text-xl font-semibold tracking-tight text-foreground mt-0.5">Ceramic Vessel</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Back to gallery">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </div>

        {/* Profile Curve Editor */}
        <section className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Profile Curve</Label>
          <div className="rounded-xl bg-background/60 border border-border p-3 shadow-card">
            <svg viewBox="0 0 220 280" className="h-[200px] w-full">
              {/* Guide lines */}
              {[0, 140, 280].map(y => (
                <line key={y} x1="0" y1={y} x2="220" y2={y} stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.5" />
              ))}
              <line x1="0" y1="0" x2="0" y2="280" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" strokeDasharray="4" />
              {/* Curve */}
              <polyline
                points={points.map(p => `${p.x * 220},${(1 - p.y) * 280}`).join(' ')}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
              />
              {/* Base point (fixed) */}
              <circle cx={0} cy={280} r={7} fill="hsl(var(--accent-foreground)/0.7)" stroke="white" strokeWidth={1.5} />
              <text x="11" y="284" fill="hsl(var(--muted-foreground))" fontSize="9">base</text>
              {/* Control points */}
              {points.map((p, idx) => idx === 0 ? null : (
                <circle
                  key={idx}
                  cx={p.x * 220}
                  cy={(1 - p.y) * 280}
                  r={selectedPoint === idx ? 8 : 5.5}
                  fill={selectedPoint === idx ? 'hsl(var(--primary))' : 'hsl(var(--primary)/0.55)'}
                  stroke="white"
                  strokeWidth={1.5}
                  className="cursor-pointer transition-all hover:fill-primary"
                  onClick={() => setSelectedPoint(selectedPoint === idx ? null : idx)}
                />
              ))}
            </svg>
          </div>

          {selectedPoint !== null && selectedPoint > 0 && (
            <div className="rounded-xl bg-background/60 border border-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Point {selectedPoint}</span>
                <button onClick={() => setSelectedPoint(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
              </div>
              <SliderRow
                label="Radius" value={points[selectedPoint].x}
                onChange={v => setPoints(prev => prev.map((p, i) => i === selectedPoint ? { ...p, x: v } : p))}
                min={0.02} max={0.42} step={0.005}
              />
              <SliderRow
                label="Height" value={points[selectedPoint].y}
                onChange={v => setPoints(prev => prev.map((p, i) => i === selectedPoint ? { ...p, y: v } : p))}
                min={0} max={1} step={0.005}
              />
            </div>
          )}
        </section>

        {/* Shape */}
        <section className="rounded-xl bg-background/60 border border-border p-4 space-y-4">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Shape</Label>
          <SliderRow label="Segments" value={segments} onChange={setSegments} min={32} max={256} step={8} />
          <SliderRow label="Height scale" value={heightScale} onChange={setHeightScale} min={0.5} max={2.0} step={0.01} />
          <SliderRow label="Radius scale" value={radiusScale} onChange={setRadiusScale} min={0.3} max={2.0} step={0.01} />
          <SliderRow label="Spline tension" value={splineSmoothness} onChange={setSplineSmoothness} min={0} max={1} step={0.01} />
        </section>

        {/* Surface */}
        <section className="rounded-xl bg-background/60 border border-border p-4 space-y-4">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Surface pattern</Label>

          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Pattern</span>
            <Select value={pattern} onValueChange={v => setPattern(v as PatternType)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PATTERN_LABELS) as PatternType[]).map(k => (
                  <SelectItem key={k} value={k}>{PATTERN_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <SliderRow label="Frequency / count (angular)" value={scaleX} onChange={setScaleX} min={1} max={32} step={0.5} decimals={1} />
          <SliderRow label="Frequency / count (height)" value={scaleY} onChange={setScaleY} min={1} max={24} step={0.5} decimals={1} />
          <SliderRow label="Relief depth" value={strength} onChange={setStrength} min={0} max={0.12} step={0.001} suffix=" mm" />
          <SliderRow label="Twist" value={twist} onChange={setTwist} min={-Math.PI * 2} max={Math.PI * 2} step={0.05} suffix="°" decimals={1} />
        </section>

        {/* Dimensions */}
        <section className="rounded-xl bg-background/60 border border-border p-4 space-y-3">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dimensions</Label>
          <div className="grid grid-cols-3 gap-2 text-center">
            {([['W', dims.w], ['H', dims.h], ['D', dims.d]] as [string, number][]).map(([l, v]) => (
              <div key={l} className="rounded-lg bg-secondary/60 p-2">
                <p className="text-[10px] uppercase text-muted-foreground">{l}</p>
                <p className="text-foreground font-semibold text-sm">{v.toFixed(1)}<span className="text-[10px] text-muted-foreground"> mm</span></p>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs border-t border-border pt-2">
            <span className="text-muted-foreground">Surface area</span>
            <span className="text-foreground font-medium">{(dims.sa / 100).toFixed(1)} cm²</span>
          </div>
        </section>

        {/* Actions */}
        <section className="space-y-2 mt-auto">
          <div className="flex gap-2">
            <Button onClick={resetAll} variant="outline" className="flex-1 gap-1.5 text-sm">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </Button>
            <Button onClick={downloadSTL} variant="outline" className="flex-1 gap-1.5 text-sm">
              <Download className="w-3.5 h-3.5" /> STL
            </Button>
          </div>
          <div className="flex gap-2">
            <Button onClick={sendToViewer} variant="outline" className="flex-1 gap-1.5 text-sm">
              <Eye className="w-3.5 h-3.5" /> 3D View
            </Button>
            <Button onClick={sendToViewer} className="flex-1 gap-1.5 text-sm">
              <ShoppingCart className="w-3.5 h-3.5" /> Checkout
            </Button>
          </div>
        </section>
      </aside>

      {/* ── Right: 3D viewport ── */}
      <main className="flex-1 relative z-10 bg-viewport overflow-hidden">
        {/* Camera video (AR mode or blurred backdrop) */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-all duration-700',
            cameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none',
            cameraActive && !arMode ? 'blur-xl scale-105' : '',
          )}
        />

        {/* Three.js canvas */}
        <div ref={mountRef} className="absolute inset-0 w-full h-full" />

        {/* AR toggle */}
        <div className="absolute top-4 right-4 z-20">
          <Button
            variant="outline"
            onClick={toggleAR}
            className={cn(
              'gap-2 rounded-full border backdrop-blur-xl text-sm font-medium shadow-elevated transition-all duration-300',
              arMode
                ? 'bg-viewport-panel border-viewport-border text-viewport-foreground hover:bg-viewport-control'
                : 'bg-card/70 border-border/60 hover:bg-card',
            )}
          >
            {arMode ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            {arMode ? 'Exit AR' : 'AR Preview'}
          </Button>
        </div>

        {arMode && (
          <div className="absolute top-4 left-4 z-20">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-viewport-panel/80 backdrop-blur-xl border border-viewport-border text-viewport-foreground text-xs">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              AR mode — place in real space
            </div>
          </div>
        )}

        {cameraError && (
          <p className="absolute top-16 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl bg-destructive/80 backdrop-blur-xl text-destructive-foreground text-sm">
            {cameraError}
          </p>
        )}

        {/* Controls hint */}
        <div className="absolute bottom-4 left-4 z-10">
          <div className="inline-flex items-center gap-4 px-4 py-2.5 rounded-full bg-viewport-panel/70 backdrop-blur-xl border border-viewport-border text-xs text-viewport-muted">
            <span>Drag · rotate</span>
            <span>Right-drag · pan</span>
            <span>Scroll · zoom</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default VesselGenerator;

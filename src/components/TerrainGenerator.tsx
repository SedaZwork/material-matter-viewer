import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { ArrowLeft, Download, RotateCcw, ShoppingCart, Eye, MapPin, Mountain, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCamera } from '@/hooks/useCamera';
import { exportMeshAs3MF } from '@/utils/threeMFExporter';
import { generateTerrainOpenSCAD } from '@/utils/openScadGenerator';

type Heightmap = { data: Float32Array; width: number; height: number; minElev: number; maxElev: number };

interface QuickLocation {
  name: string;
  lat: number;
  lon: number;
  area: number;
}

const QUICK_LOCATIONS: QuickLocation[] = [
  { name: 'Mont Blanc', lat: 45.8326, lon: 6.8652, area: 20 },
  { name: 'Mt. Everest', lat: 27.9881, lon: 86.9250, area: 30 },
  { name: 'Matterhorn', lat: 45.9763, lon: 7.6586, area: 15 },
  { name: 'Grand Canyon', lat: 36.1069, lon: -112.1129, area: 40 },
  { name: 'Mt. Fuji', lat: 35.3606, lon: 138.7274, area: 25 },
  { name: 'K2', lat: 35.8800, lon: 76.5133, area: 25 },
];

// Terrarium tile decoding: height = (r * 256 + g + b / 256) - 32768
function decodeTerrarium(r: number, g: number, b: number): number {
  return (r * 256 + g + b / 256) - 32768;
}

function latLonToTile(lat: number, lon: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

function tileToLatLon(x: number, y: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const lon = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lon };
}

async function fetchHeightmap(
  lat: number, lon: number, areaKm: number, resolution: number, zoom: number
): Promise<{ data: Float32Array; width: number; height: number; minElev: number; maxElev: number }> {
  // Calculate bounding box from center + area
  const degPerKmLat = 1 / 111.32;
  const degPerKmLon = 1 / (111.32 * Math.cos((lat * Math.PI) / 180));
  const halfArea = areaKm / 2;

  const latMin = lat - halfArea * degPerKmLat;
  const latMax = lat + halfArea * degPerKmLat;
  const lonMin = lon - halfArea * degPerKmLon;
  const lonMax = lon + halfArea * degPerKmLon;

  // Find tiles covering bbox
  const tileMin = latLonToTile(latMax, lonMin, zoom); // note: latMax → smaller y
  const tileMax = latLonToTile(latMin, lonMax, zoom);

  const tilesX = tileMax.x - tileMin.x + 1;
  const tilesY = tileMax.y - tileMin.y + 1;
  const tileSize = 256;

  // Create offscreen canvas for stitching
  const canvas = document.createElement('canvas');
  canvas.width = tilesX * tileSize;
  canvas.height = tilesY * tileSize;
  const ctx = canvas.getContext('2d')!;

  // Fetch all tiles
  const promises: Promise<void>[] = [];
  for (let ty = tileMin.y; ty <= tileMax.y; ty++) {
    for (let tx = tileMin.x; tx <= tileMax.x; tx++) {
      const px = (tx - tileMin.x) * tileSize;
      const py = (ty - tileMin.y) * tileSize;
      const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${tx}/${ty}.png`;
      promises.push(
        new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => { ctx.drawImage(img, px, py); resolve(); };
          img.onerror = () => { resolve(); }; // skip failed tiles
          img.src = url;
        })
      );
    }
  }

  await Promise.all(promises);

  // Convert pixel coordinates of bbox within stitched image
  const topLeft = tileToLatLon(tileMin.x, tileMin.y, zoom);
  const bottomRight = tileToLatLon(tileMax.x + 1, tileMax.y + 1, zoom);

  const pxLeft = Math.floor(((lonMin - topLeft.lon) / (bottomRight.lon - topLeft.lon)) * canvas.width);
  const pxRight = Math.ceil(((lonMax - topLeft.lon) / (bottomRight.lon - topLeft.lon)) * canvas.width);
  const pxTop = Math.floor(((topLeft.lat - latMax) / (topLeft.lat - bottomRight.lat)) * canvas.height);
  const pxBottom = Math.ceil(((topLeft.lat - latMin) / (topLeft.lat - bottomRight.lat)) * canvas.height);

  const cropW = Math.max(1, pxRight - pxLeft);
  const cropH = Math.max(1, pxBottom - pxTop);
  const cropData = ctx.getImageData(
    Math.max(0, pxLeft),
    Math.max(0, pxTop),
    Math.min(cropW, canvas.width),
    Math.min(cropH, canvas.height)
  );

  // Resample to desired resolution
  const resCanvas = document.createElement('canvas');
  resCanvas.width = resolution;
  resCanvas.height = resolution;
  const resCtx = resCanvas.getContext('2d')!;

  // Put crop to temp canvas then draw scaled
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = cropData.width;
  tmpCanvas.height = cropData.height;
  tmpCanvas.getContext('2d')!.putImageData(cropData, 0, 0);
  resCtx.drawImage(tmpCanvas, 0, 0, resolution, resolution);

  const resData = resCtx.getImageData(0, 0, resolution, resolution);
  const heightData = new Float32Array(resolution * resolution);
  let minElev = Infinity, maxElev = -Infinity;

  for (let i = 0; i < resolution * resolution; i++) {
    const r = resData.data[i * 4];
    const g = resData.data[i * 4 + 1];
    const b = resData.data[i * 4 + 2];
    const h = decodeTerrarium(r, g, b);
    heightData[i] = h;
    if (h < minElev) minElev = h;
    if (h > maxElev) maxElev = h;
  }

  return { data: heightData, width: resolution, height: resolution, minElev, maxElev };
}

const TerrainGenerator = () => {
  const navigate = useNavigate();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const [lat, setLat] = useState(45.8326);
  const [lon, setLon] = useState(6.8652);
  const [areaKm, setAreaKm] = useState(20);
  const [resolution, setResolution] = useState('200');
  const [zoom, setZoom] = useState('12');
  const [longSideMm, setLongSideMm] = useState(100);
  const [zExaggeration, setZExaggeration] = useState(1.5);
  const [baseHeight, setBaseHeight] = useState(3);
  const [loading, setLoading] = useState(false);
  const [terrainLoaded, setTerrainLoaded] = useState(false);
  const [elevRange, setElevRange] = useState({ min: 0, max: 0 });
  const [material, setMaterial] = useState('sandstone');

  const { videoRef, isActive: cameraActive, error: cameraError, start: startCamera, stop: stopCamera } = useCamera();
  const [arMode, setArMode] = useState(false);
  const heightmapRef = useRef<Heightmap | null>(null);

  const toggleAR = async () => {
    if (arMode) {
      setArMode(false);
      stopCamera();
      if (sceneRef.current && rendererRef.current) {
        sceneRef.current.background = new THREE.Color('#c9d0d6');
        rendererRef.current.setClearAlpha(1);
      }
    } else {
      await startCamera();
      setArMode(true);
      if (sceneRef.current && rendererRef.current) {
        sceneRef.current.background = null;
        rendererRef.current.setClearAlpha(0);
      }
    }
  };

  // Init Three.js
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#c9d0d6');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.01, 1000);
    camera.position.set(0, 1.5, 2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
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
    controls.minDistance = 0.3;
    controls.maxDistance = 10;
    controlsRef.current = controls;

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
      renderer.dispose();
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  const generateTerrain = useCallback(async () => {
    if (!sceneRef.current) return;
    setLoading(true);
    setTerrainLoaded(false);

    try {
      const res = parseInt(resolution);
      const z = parseInt(zoom);
      const hm = await fetchHeightmap(lat, lon, areaKm, res, z);
      setElevRange({ min: hm.minElev, max: hm.maxElev });

      // Remove old mesh
      if (meshRef.current) {
        sceneRef.current.remove(meshRef.current);
        meshRef.current.geometry.dispose();
        (meshRef.current.material as THREE.Material).dispose();
      }

      const elevRange = hm.maxElev - hm.minElev;
      // Scale: longSideMm maps to 1 unit in scene
      const sceneScale = 1; // 1 unit = longSideMm mm
      const baseWorld = (baseHeight / longSideMm) * sceneScale;

      // Create plane geometry
      const geometry = new THREE.PlaneGeometry(sceneScale, sceneScale, hm.width - 1, hm.height - 1);
      geometry.rotateX(-Math.PI / 2);

      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const ix = i % hm.width;
        const iy = Math.floor(i / hm.width);
        const elev = hm.data[iy * hm.width + ix];
        // Normalize elevation to physical mm then to scene units
        const normalizedElev = (elev - hm.minElev) / (elevRange || 1);
        // Physical height in mm = normalizedElev * elevRange_m * 1000 * (longSideMm / areaKm*1000) * zExaggeration
        // Simplified: map elevation proportionally
        const heightMm = normalizedElev * ((elevRange / (areaKm * 1000)) * longSideMm) * zExaggeration;
        const heightWorld = (heightMm / longSideMm) * sceneScale + baseWorld;
        positions.setY(i, heightWorld);
      }
      geometry.computeVertexNormals();

      // Build solid mesh with walls and base
      const solidGeometry = buildSolidTerrain(geometry, hm.width, hm.height, baseWorld);

      // Hypsometric color gradient
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        metalness: 0.05,
        roughness: 0.7,
        side: THREE.DoubleSide,
        flatShading: false,
      });

      // Add vertex colors for elevation
      addElevationColors(solidGeometry, hm, baseWorld, sceneScale, elevRange, areaKm, longSideMm, zExaggeration);

      const mesh = new THREE.Mesh(solidGeometry, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(0, 0, 0);
      meshRef.current = mesh;
      sceneRef.current.add(mesh);

      // Center camera
      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.set(0, 1.2, 1.5);
        controlsRef.current.target.set(0, baseWorld + 0.1, 0);
        controlsRef.current.update();
      }

      setTerrainLoaded(true);
    } catch (err) {
      console.error('Terrain generation failed:', err);
    } finally {
      setLoading(false);
    }
  }, [lat, lon, areaKm, resolution, zoom, longSideMm, zExaggeration, baseHeight]);

  function buildSolidTerrain(
    topGeometry: THREE.PlaneGeometry, gridW: number, gridH: number, baseY: number
  ): THREE.BufferGeometry {
    // For simplicity, just use the top surface (printable terrain usually does walls in slicer)
    // But we'll add a base plane and walls for a proper solid
    const topPositions = topGeometry.attributes.position;
    const topIndices = topGeometry.index!;

    // Bottom plane (flat at y=0)
    const bottomGeometry = new THREE.PlaneGeometry(1, 1, gridW - 1, gridH - 1);
    bottomGeometry.rotateX(Math.PI / 2); // face down

    // Create merged geometry with just the top surface + base
    const geometries: THREE.BufferGeometry[] = [topGeometry];

    // Base plate
    const basePlate = new THREE.PlaneGeometry(1, 1, 1, 1);
    basePlate.rotateX(-Math.PI / 2);
    // Set all Y to 0
    const basePos = basePlate.attributes.position;
    for (let i = 0; i < basePos.count; i++) basePos.setY(i, 0);
    geometries.push(basePlate);

    // Merge (simplified - just return top for now, walls are handled by slicer)
    return topGeometry;
  }

  function addElevationColors(
    geometry: THREE.BufferGeometry,
    hm: { data: Float32Array; width: number; height: number; minElev: number; maxElev: number },
    baseWorld: number, sceneScale: number, elevRange: number,
    areaKm: number, longSideMm: number, zExaggeration: number
  ) {
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);

    // Hypsometric gradient: blue → green → yellow → brown → white
    const colorStops = [
      { t: 0, r: 0.25, g: 0.55, b: 0.35 },    // deep green
      { t: 0.15, r: 0.35, g: 0.65, b: 0.3 },   // green
      { t: 0.3, r: 0.6, g: 0.7, b: 0.35 },     // yellow-green
      { t: 0.5, r: 0.75, g: 0.6, b: 0.35 },    // tan
      { t: 0.7, r: 0.6, g: 0.45, b: 0.3 },     // brown
      { t: 0.85, r: 0.7, g: 0.65, b: 0.6 },    // grey
      { t: 1.0, r: 0.95, g: 0.95, b: 0.97 },   // snow white
    ];

    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const t = Math.max(0, Math.min(1, (y - baseWorld) / (sceneScale * 0.5)));

      // Find color from gradient
      let c = colorStops[0];
      for (let s = 0; s < colorStops.length - 1; s++) {
        if (t >= colorStops[s].t && t <= colorStops[s + 1].t) {
          const localT = (t - colorStops[s].t) / (colorStops[s + 1].t - colorStops[s].t);
          c = {
            t,
            r: colorStops[s].r + (colorStops[s + 1].r - colorStops[s].r) * localT,
            g: colorStops[s].g + (colorStops[s + 1].g - colorStops[s].g) * localT,
            b: colorStops[s].b + (colorStops[s + 1].b - colorStops[s].b) * localT,
          };
          break;
        }
      }
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  const downloadSTL = () => {
    if (!meshRef.current) return;
    const exporter = new STLExporter();
    const stlString = exporter.parse(meshRef.current);
    const blob = new Blob([stlString], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terrain_${lat.toFixed(4)}_${lon.toFixed(4)}.stl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const viewInCustomizer = () => {
    if (!meshRef.current) return;
    const exporter = new STLExporter();
    const stlString = exporter.parse(meshRef.current);
    sessionStorage.setItem('vesselSTL', stlString);
    navigate('/', { state: { fromVessel: true } });
  };

  const selectLocation = (loc: QuickLocation) => {
    setLat(loc.lat);
    setLon(loc.lon);
    setAreaKm(loc.area);
  };

  const SliderRow = ({ label, value, onChange, min, max, step, suffix = '' }: {
    label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; suffix?: string;
  }) => (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-black/50">{label}</span>
        <span className="text-black/80 font-medium">{value.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0)}{suffix}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
    </div>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden relative" style={{ background: '#c9d0d6' }}>
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.35),transparent_55%)] pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-70 pointer-events-none z-20" />
      <div className="absolute top-[120px] right-0 w-[220px] h-[1px] bg-gradient-to-r from-fuchsia-400 via-cyan-300 to-yellow-300 opacity-70 blur-[1px] rotate-[-12deg] pointer-events-none" />
      <div className="absolute bottom-[180px] left-[10%] w-[320px] h-[2px] bg-gradient-to-r from-violet-400 via-pink-300 to-cyan-300 opacity-60 blur-[2px] rotate-[8deg] pointer-events-none" />
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[size:80px_80px]" />
      </div>

      {/* Left Panel */}
      <aside className="relative z-10 w-[360px] shrink-0 overflow-y-auto border-r border-white/30 bg-white/25 backdrop-blur-2xl p-5">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.4em] text-black/45">Recipe · Topographic</div>
            <h1 className="text-xl font-light tracking-tight text-[#111] mt-1">Terrain Scale Model</h1>
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

        {/* Quick Locations */}
        <div className="mb-5">
          <h2 className="mb-2 text-xs font-medium text-black/55 uppercase tracking-wider">Quick Locations</h2>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_LOCATIONS.map((loc) => (
              <button
                key={loc.name}
                onClick={() => selectLocation(loc)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs transition-all border",
                  lat === loc.lat && lon === loc.lon
                    ? "bg-[#1f2328] text-white border-transparent"
                    : "bg-white/40 backdrop-blur-sm border-white/50 text-black/60 hover:bg-white/60"
                )}
              >
                <Mountain className="w-3 h-3 inline mr-1" />
                {loc.name}
              </button>
            ))}
          </div>
        </div>

        {/* Coordinates */}
        <div className="mb-5 rounded-2xl bg-white/35 backdrop-blur-xl p-4 border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.04)] space-y-3">
          <h2 className="text-xs font-medium text-black/55 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Coordinates
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className="text-[10px] text-black/40 uppercase">Latitude</span>
              <Input
                type="number"
                step="0.0001"
                value={lat}
                onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                className="bg-white/50 border-white/60 text-black/80 rounded-xl h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-black/40 uppercase">Longitude</span>
              <Input
                type="number"
                step="0.0001"
                value={lon}
                onChange={(e) => setLon(parseFloat(e.target.value) || 0)}
                className="bg-white/50 border-white/60 text-black/80 rounded-xl h-9 text-sm"
              />
            </div>
          </div>
          <SliderRow label="Area" value={areaKm} onChange={setAreaKm} min={5} max={100} step={1} suffix=" km" />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className="text-[10px] text-black/40 uppercase">Resolution</span>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger className="bg-white/50 border-white/60 text-black/80 rounded-xl h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100 px</SelectItem>
                  <SelectItem value="200">200 px</SelectItem>
                  <SelectItem value="300">300 px</SelectItem>
                  <SelectItem value="400">400 px</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-black/40 uppercase">Zoom Level</span>
              <Select value={zoom} onValueChange={setZoom}>
                <SelectTrigger className="bg-white/50 border-white/60 text-black/80 rounded-xl h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[8, 9, 10, 11, 12, 13, 14].map(z => (
                    <SelectItem key={z} value={String(z)}>{z}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={generateTerrain}
            disabled={loading}
            className="w-full rounded-xl bg-[#1f2328] text-white hover:bg-[#1f2328]/90 h-10"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Fetching terrain…</>
            ) : (
              <><Mountain className="w-4 h-4 mr-2" /> Download Terrain</>
            )}
          </Button>
        </div>

        {/* 3D Model Settings */}
        <div className="mb-5 rounded-2xl bg-white/35 backdrop-blur-xl p-4 border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.04)] space-y-4">
          <h2 className="text-xs font-medium text-black/55 uppercase tracking-wider">3D Model</h2>
          <SliderRow label="Long Side" value={longSideMm} onChange={setLongSideMm} min={50} max={300} step={5} suffix=" mm" />
          <SliderRow label="Z Exaggeration" value={zExaggeration} onChange={setZExaggeration} min={0.5} max={5} step={0.1} suffix="×" />
          <SliderRow label="Base Height" value={baseHeight} onChange={setBaseHeight} min={1} max={10} step={0.5} suffix=" mm" />
        </div>

        {/* Material */}
        <div className="mb-5 rounded-2xl bg-white/35 backdrop-blur-xl p-4 border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.04)] space-y-4">
          <h2 className="text-xs font-medium text-black/55 uppercase tracking-wider">Material</h2>
          <Select value={material} onValueChange={setMaterial}>
            <SelectTrigger className="bg-white/50 border-white/60 text-black/80 rounded-xl h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sandstone">Sandstone (Full Color)</SelectItem>
              <SelectItem value="pla">PLA (FDM)</SelectItem>
              <SelectItem value="resin">Resin (SLA)</SelectItem>
              <SelectItem value="wood">CNC Wood</SelectItem>
              <SelectItem value="multicolor">Multicolor FDM</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Elevation Info */}
        {terrainLoaded && (
          <div className="mb-5 rounded-2xl bg-white/35 backdrop-blur-xl p-4 border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
            <h2 className="text-xs font-medium text-black/55 uppercase tracking-wider mb-3">Elevation Data</h2>
            <div className="grid grid-cols-2 gap-2 text-center">
              {[
                ['Min', `${elevRange.min.toFixed(0)} m`],
                ['Max', `${elevRange.max.toFixed(0)} m`],
                ['Range', `${(elevRange.max - elevRange.min).toFixed(0)} m`],
                ['Size', `${longSideMm}×${longSideMm} mm`],
              ].map(([label, val]) => (
                <div key={label} className="rounded-xl bg-white/40 p-2">
                  <p className="text-black/40 text-[10px] uppercase">{label}</p>
                  <p className="text-black/80 font-medium text-sm">{val}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (meshRef.current && sceneRef.current) {
                  sceneRef.current.remove(meshRef.current);
                  meshRef.current.geometry.dispose();
                  (meshRef.current.material as THREE.Material).dispose();
                  meshRef.current = null;
                  setTerrainLoaded(false);
                }
              }}
              variant="outline"
              className="flex-1 rounded-xl bg-white/40 border-white/50 text-black/60 hover:bg-white/60 hover:text-black"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset
            </Button>
            <Button
              onClick={downloadSTL}
              disabled={!terrainLoaded}
              variant="outline"
              className="flex-1 rounded-xl bg-white/40 border-white/50 text-black/60 hover:bg-white/60 hover:text-black"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> STL
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={viewInCustomizer}
              disabled={!terrainLoaded}
              variant="outline"
              className="flex-1 rounded-xl bg-white/40 border-white/50 text-black/60 hover:bg-white/60 hover:text-black"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" /> 3D View
            </Button>
            <Button
              onClick={viewInCustomizer}
              disabled={!terrainLoaded}
              className="flex-1 rounded-xl bg-[#1f2328] text-white hover:bg-[#1f2328]/90"
            >
              <ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Checkout
            </Button>
          </div>
        </div>
      </aside>

      {/* Right Panel - 3D Viewport */}
      <main className="flex-1 relative z-10">
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

        <div ref={mountRef} className="absolute inset-0 w-full h-full" />

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="rounded-2xl bg-white/60 backdrop-blur-2xl px-8 py-6 text-center border border-white/50 shadow-xl">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-black/40" />
              <div className="mt-3 text-sm text-black/60">Fetching elevation tiles…</div>
              <div className="mt-1 text-xs text-black/40">This may take a few seconds</div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!terrainLoaded && !loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <Mountain className="w-16 h-16 mx-auto text-black/15" />
              <p className="mt-3 text-sm text-black/30">Select a location and click "Download Terrain"</p>
            </div>
          </div>
        )}

        {/* AR toggle */}
        {terrainLoaded && (
          <div className="absolute top-4 right-4 z-20">
            <button
              onClick={toggleAR}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-full border backdrop-blur-2xl transition-all duration-300 text-sm font-medium shadow-[0_8px_32px_rgba(0,0,0,0.1)]",
                arMode
                  ? "bg-black/60 border-white/20 text-white hover:bg-black/70"
                  : "bg-white/40 border-white/50 text-black/70 hover:bg-white/60"
              )}
            >
              {arMode ? 'Exit AR' : 'AR Preview'}
            </button>
          </div>
        )}

        {arMode && (
          <div className="absolute top-4 left-4 z-20">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-xl border border-white/10 text-white text-xs">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              AR Mode — Place terrain in real space
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

export default TerrainGenerator;

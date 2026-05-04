import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { ArrowLeft, Download, Settings, RotateCcw, Save, ShoppingCart, Eye, Box, Sliders, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { productRecipes } from '@/data/recipes';

type TextureType = 'voronoi' | 'hexagonal' | 'bricks';

interface ControlPoint {
  x: number;
  y: number;
}

// First point is always at base (radius 0, y = 0) for closed bottom
const DEFAULT_POINTS: ControlPoint[] = [
  { x: 0, y: 0 },        // Base - always at center, non-editable
  { x: 0.1, y: 0.05 },   // Slight flare at bottom
  { x: 0.2, y: 0.25 },   // Body
  { x: 0.13, y: 0.5 },   // Neck start
  { x: 0.22, y: 0.8 },   // Upper body
  { x: 0.16, y: 1 }      // Rim
];

const VesselGenerator = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  
  // Get recipe from location state or use default
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
  const [wallThickness, setWallThickness] = useState(0.02);
  const [showInner, setShowInner] = useState(false);
  const [material, setMaterial] = useState(recipe?.materials[0] || 'porcelain');
  const [quantity, setQuantity] = useState(1);
  const [splineSmoothness, setSplineSmoothness] = useState(0.5);
  const [activeTab, setActiveTab] = useState('shape');

  // Generate smooth curve using CatmullRom spline
  const smoothCurvePoints = useMemo(() => {
    if (points.length < 2) return [];
    
    // Create Vector3 points for CatmullRom (y is height, x is radius)
    const splinePoints = points.map((p, i) => {
      const radius = i === 0 ? 0 : Math.max(0.001, p.x * radiusScale);
      return new THREE.Vector3(radius, p.y * heightScale, 0);
    });
    
    // Create CatmullRom curve with tension control
    const curve = new THREE.CatmullRomCurve3(splinePoints, false, 'catmullrom', splineSmoothness);
    
    // Sample more points for smooth curve
    const sampledPoints = curve.getPoints(100);
    
    // Convert back to Vector2 for LatheGeometry
    return sampledPoints.map(p => new THREE.Vector2(p.x, p.y));
  }, [points, heightScale, radiusScale, splineSmoothness]);

  // Generate curve points for LatheGeometry (using original points for direct control)
  const curvePoints = useMemo(() => {
    return points.map((p, i) => {
      // Force first point to be at center (radius = 0) for closed base
      const radius = i === 0 ? 0 : Math.max(0.01, p.x * radiusScale);
      return new THREE.Vector2(radius, p.y * heightScale);
    });
  }, [points, heightScale, radiusScale]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#020617');

    const camera = new THREE.PerspectiveCamera(
      50, 
      mountRef.current.clientWidth / mountRef.current.clientHeight, 
      0.1, 
      100
    );
    camera.position.set(2, 1.2, 2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(5, 8, 6);
    dir.castShadow = true;
    scene.add(ambient, dir);

    const fillLight = new THREE.DirectionalLight(0x818cf8, 0.4);
    fillLight.position.set(-5, 3, -5);
    scene.add(fillLight);

    // Grid
    const grid = new THREE.GridHelper(4, 20, 0x374151, 0x1f2937);
    scene.add(grid);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = true;
    controls.minDistance = 1;
    controls.maxDistance = 5;
    controlsRef.current = controls;

    // Material
    const material = new THREE.MeshStandardMaterial({
      color: '#d4a574',
      metalness: 0.1,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });

    // Initial geometry
    const geometry = new THREE.LatheGeometry(curvePoints, segments);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshRef.current = mesh;
    scene.add(mesh);

    // Animation loop
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    // Handle resize
    const onResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', onResize);
      controls.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update geometry when parameters change
  useEffect(() => {
    if (!meshRef.current) return;

    const geometry = new THREE.LatheGeometry(curvePoints, segments);
    const pos = geometry.attributes.position;

    // Apply procedural texture displacement with separate X, Y, and Z scales
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      
      const radial = Math.sqrt(x * x + z * z);
      const theta = Math.atan2(z, x);
      
      let noise = 0;
      // Use separate X (circumference), Y (height), and Z (depth/radial) texture scales
      const u = theta * textureScaleX;
      const v = y * textureScaleY;
      const w = radial * textureScaleZ;

      if (textureType === 'voronoi') {
        noise = Math.sin(u) * Math.cos(v) * 0.5 + Math.sin(u * 1.7 + v * 0.8) * 0.5;
        // Add Z influence for more complex pattern
        noise += Math.sin(w * 0.5) * 0.3;
      } else if (textureType === 'hexagonal') {
        noise = Math.cos(u) + Math.cos(0.5 * u + 0.866 * v) + Math.cos(0.5 * u - 0.866 * v);
        noise /= 3;
        // Add Z influence
        noise += Math.sin(w) * 0.2;
      } else {
        const brick = (Math.sin(u * 0.7 + Math.floor(v) * 0.8) > 0 ? 1 : -1) * 0.5;
        noise = brick + Math.sin(v * 2.4) * 0.2;
        // Add Z influence for brick depth variation
        noise += Math.cos(w) * 0.15;
      }

      const displaced = radial + noise * textureStrength;
      pos.setXYZ(i, Math.cos(theta) * displaced, y, Math.sin(theta) * displaced);
    }

    geometry.computeVertexNormals();
    meshRef.current.geometry.dispose();
    meshRef.current.geometry = geometry;
  }, [curvePoints, segments, textureScaleX, textureScaleY, textureScaleZ, textureStrength, textureType]);

  // Download STL
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

  // Reset to defaults
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

  // Calculate effective surface area using the actual geometry
  // This uses the smooth curve points for accurate calculation
  const calculateSurfaceAndDimensions = useMemo(() => {
    // Use smooth curve points for accurate surface calculation
    const curveToUse = smoothCurvePoints.length > 0 ? smoothCurvePoints : curvePoints;
    
    // Calculate dimensions from the curve
    let maxRadius = 0;
    let maxHeight = 0;
    
    curveToUse.forEach(p => {
      if (p.x > maxRadius) maxRadius = p.x;
      if (p.y > maxHeight) maxHeight = p.y;
    });
    
    const width = maxRadius * 2;
    const depth = maxRadius * 2;
    const height = maxHeight;
    
    // Calculate surface area using the actual curve points
    // This gives us the effective surface area including texture displacement
    let surfaceArea = 0;
    
    // Surface area of lathe = 2π × ∫(r × √(1 + (dr/dy)²)) dy
    for (let i = 0; i < curveToUse.length - 1; i++) {
      const p1 = curveToUse[i];
      const p2 = curveToUse[i + 1];
      
      const dy = p2.y - p1.y;
      const dr = p2.x - p1.x;
      const rAvg = (p1.x + p2.x) / 2;
      
      // Arc length formula for surface of revolution
      const segmentArea = 2 * Math.PI * rAvg * Math.sqrt(dy * dy + dr * dr);
      surfaceArea += segmentArea;
    }
    
    // Add base area (closed bottom)
    const baseArea = Math.PI * maxRadius * maxRadius;
    const totalSurfaceArea = surfaceArea + baseArea;
    
    // Add texture displacement area (approximate based on texture strength)
    const textureAreaMultiplier = 1 + textureStrength * 2; // Roughness adds surface area
    const finalSurfaceArea = totalSurfaceArea * textureAreaMultiplier;
    
    return {
      width: width * 100, // Convert to mm
      height: height * 100,
      depth: depth * 100,
      surfaceArea: finalSurfaceArea * 10000, // Convert to mm² (1 unit² = 100mm × 100mm)
      smoothSurfaceArea: surfaceArea * 10000, // Without texture
      baseArea: baseArea * 10000,
      wallArea: surfaceArea * 10000,
      volume: 0 // Not used for ceramic vessels
    };
  }, [points, smoothCurvePoints, curvePoints, heightScale, radiusScale, textureStrength]);

  // Save configuration and proceed to checkout
  const saveAndContinue = () => {
    const config = {
      customization: {
        points,
        segments,
        heightScale,
        radiusScale,
        textureType,
        textureScaleX,
        textureScaleY,
        textureScaleZ,
        textureStrength,
      },
      material,
      quantity,
    };
    
    navigate('/checkout', { 
      state: { 
        recipe,
        config,
        stlData: meshRef.current ? getSTLData() : null,
        modelDimensions: calculateSurfaceAndDimensions,
        surfaceArea: calculateSurfaceAndDimensions.surfaceArea
      } 
    });
  };

  // Get STL data as string
  const getSTLData = (): string | null => {
    if (!meshRef.current) return null;
    const exporter = new STLExporter();
    return exporter.parse(meshRef.current, { binary: false }) as string;
  };

  // View in Material Viewer - navigate to model viewer page
  const viewInMaterialViewer = () => {
    if (!meshRef.current) return;
    const exporter = new STLExporter();
    const stlString = exporter.parse(meshRef.current, { binary: false }) as string;
    
    // Store in sessionStorage for the viewer to pick up
    sessionStorage.setItem('importedSTL', stlString);
    sessionStorage.setItem('importedSTLName', 'ceramic-vessel');
    
    // Navigate to model viewer with the STL data
    const config = {
      customization: {
        points,
        segments,
        heightScale,
        radiusScale,
        textureType,
        textureScaleX,
        textureScaleY,
        textureScaleZ,
        textureStrength,
      },
      material,
      quantity,
    };
    
    navigate('/viewer', { 
      state: { 
        recipe,
        config,
        stlData: stlString,
        modelDimensions: calculateSurfaceAndDimensions,
        surfaceArea: calculateSurfaceAndDimensions.surfaceArea
      } 
    });
  };

  return (
    <div className="flex h-screen w-full bg-slate-950">
      {/* Left Panel - Controls */}
      <aside className="w-[380px] overflow-y-auto border-r border-white/10 bg-slate-900/80 p-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Ceramic Vessel Generator</h1>
            <p className="text-sm text-white/50">Procedural design tool</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/')}
            className="text-white/60 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Profile Curve Editor */}
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-white/80 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Profile Curve (Editable Spline)
          </h2>
          <div className="rounded-xl bg-slate-950/50 p-3 border border-white/10">
            <svg viewBox="0 0 220 300" className="h-[280px] w-full">
              {/* Grid lines */}
              <line x1="0" y1="0" x2="220" y2="0" stroke="#374151" strokeWidth="0.5" />
              <line x1="0" y1="150" x2="220" y2="150" stroke="#374151" strokeWidth="0.5" />
              <line x1="0" y1="300" x2="220" y2="300" stroke="#374151" strokeWidth="0.5" />
              
              {/* Center line (axis of revolution) */}
              <line x1="0" y1="0" x2="0" y2="300" stroke="#374151" strokeWidth="1" strokeDasharray="4" />
              
              {/* Profile curve */}
              <polyline
                points={points.map((p) => `${p.x * 220},${(1 - p.y) * 300}`).join(' ')}
                fill="none"
                stroke="#d4a574"
                strokeWidth={2}
              />
              
              {/* Base point (non-editable, always at center) */}
              <circle
                cx={0}
                cy={300}
                r={8}
                fill="#22c55e"
                stroke="#fff"
                strokeWidth={1.5}
              />
              <text x="15" y="305" fill="#22c55e" fontSize="10" className="pointer-events-none">Base</text>
              
              {/* Control points (editable, skip first point) */}
              {points.map((p, idx) => idx === 0 ? null : (
                <circle
                  key={idx}
                  cx={p.x * 220}
                  cy={(1 - p.y) * 300}
                  r={selectedPoint === idx ? 10 : 7}
                  fill={selectedPoint === idx ? '#f59e0b' : '#d4a574'}
                  stroke="#fff"
                  strokeWidth={1.5}
                  className="cursor-pointer transition-all hover:fill-white"
                  onClick={() => setSelectedPoint(selectedPoint === idx ? null : idx)}
                />
              ))}
            </svg>
            
            <p className="mt-2 text-xs text-white/40 text-center">
              Green point = closed base (non-editable). Click other points to edit.
            </p>
          </div>

          {/* Selected point controls */}
          {selectedPoint !== null && selectedPoint > 0 && (
            <div className="mt-3 space-y-3 rounded-xl bg-white/5 p-3 border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Point {selectedPoint} (editable)</span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedPoint(null)}
                  className="text-white/40 hover:text-white h-6"
                >
                  ×
                </Button>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-white/40">
                  <span>Radius</span>
                  <span className="text-white">{points[selectedPoint].x.toFixed(3)}</span>
                </div>
                <Slider
                  value={[points[selectedPoint].x]}
                  onValueChange={([v]) => setPoints((prev) => 
                    prev.map((p, i) => i === selectedPoint ? { ...p, x: v } : p)
                  )}
                  min={0.05}
                  max={0.4}
                  step={0.005}
                  className="py-2"
                />
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-white/40">
                  <span>Height</span>
                  <span className="text-white">{points[selectedPoint].y.toFixed(3)}</span>
                </div>
                <Slider
                  value={[points[selectedPoint].y]}
                  onValueChange={([v]) => setPoints((prev) => 
                    prev.map((p, i) => i === selectedPoint ? { ...p, y: v } : p)
                  )}
                  min={0}
                  max={1}
                  step={0.005}
                  className="py-2"
                />
              </div>
            </div>
          )}
          {selectedPoint === 0 && (
            <div className="mt-3 rounded-xl bg-emerald-500/10 p-3 border border-emerald-500/20">
              <p className="text-sm text-emerald-400">
                Base point is fixed at center (radius = 0) to ensure closed bottom.
              </p>
            </div>
          )}
        </div>

        {/* Shape Parameters */}
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-white/80">Shape Parameters</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label className="text-white/60">Revolution Segments</Label>
                <span className="text-white">{segments}</span>
              </div>
              <Slider
                value={[segments]}
                onValueChange={([v]) => setSegments(v)}
                min={32}
                max={256}
                step={8}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label className="text-white/60">Height Scale</Label>
                <span className="text-white">{heightScale.toFixed(2)}</span>
              </div>
              <Slider
                value={[heightScale]}
                onValueChange={([v]) => setHeightScale(v)}
                min={0.6}
                max={1.8}
                step={0.01}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label className="text-white/60">Radius Scale</Label>
                <span className="text-white">{radiusScale.toFixed(2)}</span>
              </div>
              <Slider
                value={[radiusScale]}
                onValueChange={([v]) => setRadiusScale(v)}
                min={0.5}
                max={1.8}
                step={0.01}
              />
            </div>
          </div>
        </div>

        {/* Texture Parameters */}
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-white/80">Surface Texture</h2>
          
          <div className="space-y-2 mb-4">
            <Label className="text-white/60 text-sm">Texture Type</Label>
            <Select value={textureType} onValueChange={(v) => setTextureType(v as TextureType)}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="voronoi">Voronoi Pattern</SelectItem>
                <SelectItem value="hexagonal">Hexagonal Grid</SelectItem>
                <SelectItem value="bricks">Brick Pattern</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {/* Texture Scale X (circumferential) */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label className="text-white/60">Scale X (Circumference)</Label>
                <span className="text-white">{textureScaleX.toFixed(1)}</span>
              </div>
              <Slider
                value={[textureScaleX]}
                onValueChange={([v]) => setTextureScaleX(v)}
                min={2}
                max={30}
                step={0.5}
              />
            </div>

            {/* Texture Scale Y (vertical) */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label className="text-white/60">Scale Y (Height)</Label>
                <span className="text-white">{textureScaleY.toFixed(1)}</span>
              </div>
              <Slider
                value={[textureScaleY]}
                onValueChange={([v]) => setTextureScaleY(v)}
                min={2}
                max={30}
                step={0.5}
              />
            </div>

            {/* Texture Scale Z (radial/depth) */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label className="text-white/60">Scale Z (Radial)</Label>
                <span className="text-white">{textureScaleZ.toFixed(1)}</span>
              </div>
              <Slider
                value={[textureScaleZ]}
                onValueChange={([v]) => setTextureScaleZ(v)}
                min={2}
                max={30}
                step={0.5}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label className="text-white/60">Relief Strength</Label>
                <span className="text-white">{(textureStrength * 1000).toFixed(1)}mm</span>
              </div>
              <Slider
                value={[textureStrength]}
                onValueChange={([v]) => setTextureStrength(v)}
                min={0}
                max={0.08}
                step={0.001}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {/* Material Selection */}
          {recipe && (
            <div className="space-y-2">
              <Label className="text-white/60 text-sm">Material</Label>
              <Select value={material} onValueChange={setMaterial}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {recipe.materials.map(m => (
                    <SelectItem key={m} value={m}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-2">
            <Label className="text-white/60 text-sm">Quantity</Label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 rounded-lg bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
              >
                -
              </button>
              <span className="text-white text-lg font-medium w-8 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 rounded-lg bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>

          {/* Model Dimensions & Surface Area */}
          <div className="bg-white/5 rounded-xl p-3">
            <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Model Dimensions</h3>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div>
                <p className="text-white/50 text-xs">Width</p>
                <p className="text-white font-medium">{calculateSurfaceAndDimensions.width.toFixed(1)}mm</p>
              </div>
              <div>
                <p className="text-white/50 text-xs">Height</p>
                <p className="text-white font-medium">{calculateSurfaceAndDimensions.height.toFixed(1)}mm</p>
              </div>
              <div>
                <p className="text-white/50 text-xs">Depth</p>
                <p className="text-white font-medium">{calculateSurfaceAndDimensions.depth.toFixed(1)}mm</p>
              </div>
            </div>
            <div className="border-t border-white/10 pt-2">
              <div className="flex justify-between">
                <span className="text-white/50 text-xs">Surface Area</span>
                <span className="text-white font-medium">{(calculateSurfaceAndDimensions.surfaceArea / 100).toFixed(2)} cm²</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={resetAll}
              className="flex-1 border-white/20 text-white hover:bg-white/10"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button 
              onClick={downloadModel}
              variant="outline"
              className="flex-1 border-white/20 text-white hover:bg-white/10"
            >
              <Download className="w-4 h-4 mr-2" />
              STL
            </Button>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={viewInMaterialViewer}
              variant="outline"
              className="flex-1 border-white/20 text-white hover:bg-white/10"
            >
              <Eye className="w-4 h-4 mr-2" />
              View in 3D
            </Button>
            <Button 
              onClick={saveAndContinue}
              className="flex-1 bg-white text-slate-900 hover:bg-white/90"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Checkout
            </Button>
          </div>
        </div>
      </aside>

      {/* Right Panel - 3D View */}
      <main className="flex-1 relative">
        <div ref={mountRef} className="h-full w-full" />
        
        {/* Info overlay */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-slate-900/80 backdrop-blur-xl rounded-xl p-3 border border-white/10 inline-flex items-center gap-4 text-sm text-white/60">
            <span>Left click + drag: Rotate</span>
            <span>Right click + drag: Pan</span>
            <span>Scroll: Zoom</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default VesselGenerator;
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import { Material, PrintSettings } from '@/types/materials';
import { materials } from '@/data/materials';
import ThreeViewer from '@/components/ThreeViewer';
import CostCalculator from '@/components/CostCalculator';
import CheckoutButton from '@/components/CheckoutButton';
import ManufacturingOptions from '@/components/ManufacturingOptions';
import FileAnalysis from '@/components/FileAnalysis';
import { FabricatorRegistration } from '@/components/FabricatorRegistration';
import { PrintExamplesCarousel } from '@/components/PrintExamplesCarousel';
import RecipeGallery from '@/components/RecipeGallery';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Printer, Upload, LogOut, LogIn, User, ShoppingCart } from 'lucide-react';
import * as THREE from 'three';

interface Dimensions { width: number; height: number; depth: number; }

const Index = () => {
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [loadedGeometry, setLoadedGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [selectedFabricatorId, setSelectedFabricatorId] = useState<string | null>(null);
  const [finalCost, setFinalCost] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [scale, setScale] = useState(1);
  const [volume, setVolume] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);
  const [showLanding, setShowLanding] = useState(true);
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    materialId: '', volume: 0, infill: 20, supports: false,
    laborCostPerHour: 15, estimatedPrintTime: 2, electricityCostPerKwh: 0.12, printerPowerConsumption: 200,
  });

  const handleMaterialSelect = (material: Material) => {
    setSelectedMaterial(material);
    setPrintSettings(prev => ({ ...prev, materialId: material.id }));
    setTimeout(() => {
      document.getElementById('checkout-controls')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
  };

  const handleVolumeCalculated = (vol: number) => {
    setVolume(vol);
    setPrintSettings(prev => ({ ...prev, volume: vol }));
  };

  const handleModelLoaded = (geometry: THREE.BufferGeometry) => {
    setLoadedGeometry(geometry.clone());
    const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position as THREE.BufferAttribute);
    const size = box.getSize(new THREE.Vector3());
    setDimensions({ width: size.x, height: size.y, depth: size.z });
  };

  const handleLoadExternalModel = async (modelName: string, downloadUrl: string) => {
    if (!downloadUrl) {
      toast({ title: "Error", description: "No download URL available", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    toast({ title: "Downloading Model", description: `Loading ${modelName}...` });
    try {
      const { data, error } = await supabase.functions.invoke('thingiverse-proxy', {
        body: { url: downloadUrl, action: 'download' }, method: 'POST',
      });
      if (error) throw error;
      const blob = new Blob([data], { type: 'application/octet-stream' });
      const file = new File([blob], `${modelName}.stl`, { type: 'application/sla' });
      const text = await file.text();
      handleModelLoaded(parseSTL(text));
      toast({ title: "Model Loaded", description: `${modelName} loaded!` });
    } catch (error) {
      logger.error("Failed to load external model", error);
      toast({ title: "Error", description: "Failed to load model.", variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  const parseSTL = (stlString: string): THREE.BufferGeometry => {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [], normals: number[] = [];
    let currentNormal: number[] = [];
    for (const line of stlString.split('\n')) {
      const t = line.trim();
      if (t.startsWith('facet normal')) {
        const p = t.split(/\s+/);
        currentNormal = [parseFloat(p[2]), parseFloat(p[3]), parseFloat(p[4])];
      } else if (t.startsWith('vertex')) {
        const p = t.split(/\s+/);
        vertices.push(parseFloat(p[1]), parseFloat(p[2]), parseFloat(p[3]));
        normals.push(...currentNormal);
      }
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return geometry;
  };

  const scrollToManufacturing = () => {
    document.getElementById('manufacturing-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSignOut = async () => { await signOut(); navigate('/auth'); };

  const getMaterialColor = () => {
    if (!selectedMaterial) return '#888888';
    const map: Record<string, string> = { pla: '#22c55e', petg: '#a855f7', abs: '#f59e0b', nylon: '#ec4899' };
    return map[selectedMaterial.id] || '#888888';
  };

  // --- Header ---
  const Header = () => (
    <header className="border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Printer className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">0K3D<span className="text-muted-foreground font-light">.print</span></h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FabricatorRegistration />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 w-9 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-secondary text-foreground text-xs font-medium">
                        {user.email?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-52" align="end">
                  <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled><User className="mr-2 h-3.5 w-3.5" /><span className="text-xs">{user.email}</span></DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut}><LogOut className="mr-2 h-3.5 w-3.5" /><span>Sign Out</span></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate('/auth')} className="text-xs">
                <LogIn className="w-3.5 h-3.5 mr-1.5" /> Sign In
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );

  // --- Upload screen ---
  if (!loadedGeometry) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 py-16">
          <div className="max-w-xl mx-auto text-center">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-6">
              <Upload className="w-7 h-7 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-2">Upload Your 3D Model</h2>
            <p className="text-muted-foreground text-sm mb-8">
              Upload an STL file to preview, configure materials, and order prints
            </p>
            <FileAnalysis onVolumeCalculated={handleVolumeCalculated} onModelLoaded={handleModelLoaded} />
          </div>
        </main>
      </div>
    );
  }

  // --- Main customizer view ---
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-6 py-6">
        <div className="flex gap-6 max-w-[1400px] mx-auto">
          {/* Main area */}
          <div className="flex-1 space-y-5">
            {/* 3D Viewer */}
            <div className="relative">
              {isLoading && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-50 flex items-center justify-center rounded-2xl">
                  <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <ThreeViewer
                materialColor={getMaterialColor()}
                geometry={loadedGeometry}
                materials={materials}
                selectedMaterial={selectedMaterial}
                onMaterialSelect={handleMaterialSelect}
                scale={scale}
                onScaleChange={setScale}
                dimensions={dimensions}
              />
            </div>

            {/* Checkout bar */}
            <div id="checkout-controls" className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border shadow-card">
              <div className="flex items-center gap-2 flex-1">
                <Label htmlFor="quantity" className="text-xs text-muted-foreground whitespace-nowrap">Qty</Label>
                <Input
                  id="quantity" type="number" min="1" value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="w-20 h-9 text-sm"
                />
              </div>
              <Button
                className="h-9 px-6 text-sm font-medium"
                onClick={scrollToManufacturing}
                disabled={!selectedMaterial}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Continue to Checkout
              </Button>
            </div>

            {/* Manufacturing */}
            <div id="manufacturing-section" className="space-y-4 pt-2">
              <ManufacturingOptions
                material={selectedMaterial}
                settings={printSettings}
                baseCost={volume * (selectedMaterial?.costPerKg || 0) * (selectedMaterial?.density || 0) * scale ** 3 / 1000}
                dimensions={dimensions}
                scale={scale}
                onSelectFabricator={(fabricatorId, cost) => { setSelectedFabricatorId(fabricatorId); setFinalCost(cost); }}
              />
              {selectedFabricatorId && (
                <CheckoutButton
                  material={selectedMaterial} settings={printSettings}
                  selectedFabricatorId={selectedFabricatorId} finalCost={finalCost}
                  quantity={quantity} scale={scale}
                />
              )}
            </div>
          </div>

          {/* Sidebar examples */}
          <aside className="w-[130px] shrink-0 hidden lg:block">
            <div className="sticky top-20">
              <h3 className="text-[10px] font-medium text-muted-foreground tracking-widest uppercase mb-3">Examples</h3>
              <PrintExamplesCarousel onModelSelect={handleLoadExternalModel} />
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t border-border mt-16">
        <div className="container mx-auto px-6 py-4 text-center">
          <p className="text-[11px] text-muted-foreground tracking-wide">
            0K3D.print — Democratizing Physical-Digital Creation
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;

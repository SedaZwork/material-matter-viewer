import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Material, PrintSettings } from '@/types/materials';
import { materials } from '@/data/materials';
import MaterialSelector from '@/components/MaterialSelector';
import ThreeViewer from '@/components/ThreeViewer';
import PrintSettingsComponent from '@/components/PrintSettings';
import CostCalculator from '@/components/CostCalculator';
import CheckoutButton from '@/components/CheckoutButton';
import ManufacturingOptions from '@/components/ManufacturingOptions';
import FileAnalysis from '@/components/FileAnalysis';
import { FabricatorRegistration } from '@/components/FabricatorRegistration';
import { PrintExamplesCarousel } from '@/components/PrintExamplesCarousel';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Printer, Calculator, Palette, Settings, Upload, LogOut, User, ShoppingCart } from 'lucide-react';
import * as THREE from 'three';

interface Dimensions {
  width: number;
  height: number;
  depth: number;
}

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [loadedGeometry, setLoadedGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [selectedFabricatorId, setSelectedFabricatorId] = useState<string | null>(null);
  const [finalCost, setFinalCost] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [volume, setVolume] = useState<number>(0);
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    materialId: '',
    volume: 0,
    infill: 20,
    supports: false,
    laborCostPerHour: 15,
    estimatedPrintTime: 2,
    electricityCostPerKwh: 0.12,
    printerPowerConsumption: 200,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleMaterialSelect = (material: Material) => {
    setSelectedMaterial(material);
    setPrintSettings(prev => ({ ...prev, materialId: material.id }));
    
    // Auto scroll to quantity and checkout
    setTimeout(() => {
      const element = document.getElementById('checkout-controls');
      element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
  };

  const handleVolumeCalculated = (vol: number) => {
    setVolume(vol);
    setPrintSettings(prev => ({ ...prev, volume: vol }));
  };

  const handleModelLoaded = (geometry: THREE.BufferGeometry) => {
    const clonedGeometry = geometry.clone();
    setLoadedGeometry(clonedGeometry);
    
    // Calculate dimensions
    const box = new THREE.Box3().setFromBufferAttribute(
      geometry.attributes.position as THREE.BufferAttribute
    );
    const size = box.getSize(new THREE.Vector3());
    setDimensions({
      width: size.x,
      height: size.y,
      depth: size.z,
    });
  };

  const scrollToManufacturing = () => {
    const element = document.getElementById('manufacturing-section');
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getMaterialColor = () => {
    if (!selectedMaterial) return '#00ccff';
    
    switch (selectedMaterial.id) {
      case 'pla': return '#22c55e';   // Green
      case 'petg': return '#a855f7';  // Purple
      case 'abs': return '#f59e0b';   // Orange/Amber
      case 'nylon': return '#ec4899'; // Pink
      default: return '#00ccff';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="text-center">
          <Printer className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  if (!loadedGeometry) {
    // Show upload area when no model is loaded
    return (
      <div className="min-h-screen bg-gradient-hero">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Printer className="w-8 h-8 text-primary" />
                </div>
                <div>
                <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  3D Printing Online Service
                </h1>
                <p className="text-muted-foreground">
                  Upload your 3D model and order professional prints
                </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FabricatorRegistration />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar>
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>
                      <User className="mr-2 h-4 w-4" />
                      <span className="text-xs">{user?.email}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        {/* Upload Area */}
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="flex items-center gap-2 justify-center mb-4">
                <Upload className="w-8 h-8 text-primary" />
                <h2 className="text-2xl font-semibold">Upload Your 3D Model</h2>
              </div>
              <p className="text-muted-foreground">
                Start by uploading an STL file to analyze and calculate printing costs
              </p>
            </div>
            
            <FileAnalysis 
              onVolumeCalculated={handleVolumeCalculated}
              onModelLoaded={handleModelLoaded}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header with minimal border */}
      <header className="border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg border border-primary/20 bg-primary/5">
                <Printer className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-light tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                  0K3D.print
                </h1>
                <p className="text-xs text-muted-foreground font-light">
                  Physical-Digital Creation Platform
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FabricatorRegistration />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full border border-border/50">
                    <Avatar>
                      <AvatarFallback className="bg-primary/5 text-primary text-xs">
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuLabel className="font-light">My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    <User className="mr-2 h-3.5 w-3.5" />
                    <span className="text-xs font-light">{user?.email}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    <span className="font-light">Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with Sidebar Gallery */}
      <main className="container mx-auto px-6 py-6">
        <div className="flex gap-6 max-w-[1600px] mx-auto">
          {/* Main Content Area */}
          <div className="flex-1 space-y-6">
            {/* 3D Viewer Section */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm overflow-hidden">
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
              
              {/* Quantity and Checkout Below Viewer */}
              <div id="checkout-controls" className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                <div className="space-y-2">
                  <Label htmlFor="quantity" className="text-xs font-light text-muted-foreground">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="h-11 border-border/50 bg-background/50 font-light"
                  />
                </div>
                
                <div className="flex items-end">
                  <Button 
                    className="w-full h-11 font-light border border-primary/20" 
                    size="lg"
                    onClick={scrollToManufacturing}
                    disabled={!selectedMaterial}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Continue to Checkout
                  </Button>
                </div>
              </div>
            </div>

            {/* Manufacturing Options Section */}
            <div id="manufacturing-section" className="space-y-4 pt-4">
              
              <ManufacturingOptions
                material={selectedMaterial}
                settings={printSettings}
                baseCost={volume * (selectedMaterial?.costPerKg || 0) * (selectedMaterial?.density || 0) * scale * scale * scale / 1000}
                dimensions={dimensions}
                scale={scale}
                onSelectFabricator={(fabricatorId, cost) => {
                  setSelectedFabricatorId(fabricatorId);
                  setFinalCost(cost);
                }}
              />
              
              {selectedFabricatorId && (
                <CheckoutButton 
                  material={selectedMaterial}
                  settings={printSettings}
                  selectedFabricatorId={selectedFabricatorId}
                  finalCost={finalCost}
                  quantity={quantity}
                  scale={scale}
                />
              )}
            </div>
          </div>

          {/* Right Sidebar - Vertical Gallery */}
          <aside className="w-[140px] shrink-0">
            <div className="sticky top-6">
              <div className="mb-3">
                <h3 className="text-xs font-light text-muted-foreground tracking-wide">EXAMPLES</h3>
              </div>
              <PrintExamplesCarousel />
            </div>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 bg-background/50 backdrop-blur-xl mt-16">
        <div className="container mx-auto px-6 py-4 text-center">
          <p className="text-xs font-light text-muted-foreground tracking-wide">
            Democratizing Physical-Digital Creation
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;

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
import { Printer, Calculator, Palette, Settings, Upload, LogOut, User } from 'lucide-react';
import * as THREE from 'three';

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
  };

  const handleVolumeCalculated = (vol: number) => {
    setVolume(vol);
    setPrintSettings(prev => ({ ...prev, volume: vol }));
  };

  const handleModelLoaded = (geometry: THREE.BufferGeometry) => {
    const clonedGeometry = geometry.clone();
    setLoadedGeometry(clonedGeometry);
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
                  Professional 3D printing delivered to your door
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

      {/* Main Content with Model Loaded */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* 3D Viewer Section */}
          <div className="space-y-4">
            <ThreeViewer 
              materialColor={getMaterialColor()} 
              geometry={loadedGeometry}
              materials={materials}
              selectedMaterial={selectedMaterial}
              onMaterialSelect={handleMaterialSelect}
              scale={scale}
            />
            
            {/* Controls Below Viewer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="scale">Scale ({scale.toFixed(2)}x)</Label>
                <Input
                  id="scale"
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                />
              </div>
              
              <div className="flex items-end">
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={scrollToManufacturing}
                  disabled={!selectedMaterial}
                >
                  Continue to Checkout
                </Button>
              </div>
            </div>
          </div>

          {/* Manufacturing Options Section */}
          <div id="manufacturing-section" className="space-y-6 pt-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold mb-2">Choose Your Manufacturer</h2>
              <p className="text-muted-foreground">
                Supporting local production for a sustainable future
              </p>
            </div>
            
            <ManufacturingOptions
              material={selectedMaterial}
              settings={printSettings}
              baseCost={volume * (selectedMaterial?.costPerKg || 0) * (selectedMaterial?.density || 0) * scale * scale * scale / 1000}
              onSelectFabricator={(fabricatorId, cost) => {
                setSelectedFabricatorId(fabricatorId);
                setFinalCost(cost);
              }}
            />
            
            <CheckoutButton 
              material={selectedMaterial}
              settings={printSettings}
              selectedFabricatorId={selectedFabricatorId}
              finalCost={finalCost}
              quantity={quantity}
              scale={scale}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/30 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-muted-foreground">
          <p>Professional 3D printing cost estimation tool</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;

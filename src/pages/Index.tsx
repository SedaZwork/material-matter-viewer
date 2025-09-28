import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Material, PrintSettings } from '@/types/materials';
import { materials } from '@/data/materials';
import MaterialSelector from '@/components/MaterialSelector';
import ThreeViewer from '@/components/ThreeViewer';
import PrintSettingsComponent from '@/components/PrintSettings';
import CostCalculator from '@/components/CostCalculator';
import CheckoutButton from '@/components/CheckoutButton';
import FileAnalysis from '@/components/FileAnalysis';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Printer, Calculator, Palette, Settings, Upload, LogOut, User } from 'lucide-react';
import * as THREE from 'three';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [loadedGeometry, setLoadedGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [totalCost, setTotalCost] = useState<number>(0);
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

  const handleVolumeCalculated = (volume: number) => {
    setPrintSettings(prev => ({ ...prev, volume }));
  };

  const handleModelLoaded = (geometry: THREE.BufferGeometry) => {
    // Clone the geometry to avoid mutations affecting the original
    const clonedGeometry = geometry.clone();
    setLoadedGeometry(clonedGeometry);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleCostCalculated = (cost: number) => {
    setTotalCost(cost);
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
                    3D Print Cost Calculator
                  </h1>
                  <p className="text-muted-foreground">
                    Upload your 3D model to calculate printing costs
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{user?.email}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
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
                  3D Print Cost Calculator
                </h1>
                <p className="text-muted-foreground">
                  Calculate accurate printing costs with material properties and 3D preview
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{user?.email}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with Model Loaded */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - 3D Viewer */}
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">3D Model Preview</h2>
              <p className="text-muted-foreground text-sm">
                Your uploaded model with selected material
              </p>
            </div>
            
            <ThreeViewer materialColor={getMaterialColor()} geometry={loadedGeometry} />
            
            {selectedMaterial && (
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-card rounded-lg border border-border">
                  <div className={`w-3 h-3 rounded-full bg-${selectedMaterial.color}`} />
                  <span className="text-sm font-medium">{selectedMaterial.name}</span>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Model Info, Materials, Settings & Checkout */}
          <div className="space-y-6">
            {/* Model Info */}
            <div className="flex items-center gap-2 mb-4">
              <Upload className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Model Information</h2>
            </div>
            
            <FileAnalysis 
              onVolumeCalculated={handleVolumeCalculated}
              onModelLoaded={handleModelLoaded}
            />
            
            {/* Material Selection */}
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Material Selection</h2>
            </div>
            
            <MaterialSelector
              selectedMaterial={selectedMaterial}
              onMaterialSelect={handleMaterialSelect}
            />
            
            {/* Print Settings */}
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Print Configuration</h2>
            </div>
            
            <PrintSettingsComponent
              settings={printSettings}
              onSettingsChange={setPrintSettings}
            />
            
            {/* Cost Calculator & Checkout */}
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Cost & Checkout</h2>
            </div>
            
            <CostCalculator
              material={selectedMaterial}
              settings={printSettings}
              onCostCalculated={handleCostCalculated}
            />
            
            <CheckoutButton
              material={selectedMaterial}
              settings={printSettings}
              totalCost={totalCost}
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

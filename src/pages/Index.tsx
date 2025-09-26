import React, { useState } from 'react';
import { Material, PrintSettings } from '@/types/materials';
import { materials } from '@/data/materials';
import MaterialSelector from '@/components/MaterialSelector';
import ThreeViewer from '@/components/ThreeViewer';
import PrintSettingsComponent from '@/components/PrintSettings';
import CostCalculator from '@/components/CostCalculator';
import FileAnalysis from '@/components/FileAnalysis';
import { Printer, Calculator, Palette, Settings, Upload } from 'lucide-react';
import * as THREE from 'three';

const Index = () => {
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [loadedGeometry, setLoadedGeometry] = useState<THREE.BufferGeometry | null>(null);
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

  const handleMaterialSelect = (material: Material) => {
    setSelectedMaterial(material);
    setPrintSettings(prev => ({ ...prev, materialId: material.id }));
  };

  const handleVolumeCalculated = (volume: number) => {
    setPrintSettings(prev => ({ ...prev, volume }));
  };

  const handleModelLoaded = (geometry: THREE.BufferGeometry) => {
    setLoadedGeometry(geometry);
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

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
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
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Material Selection */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Material & Settings</h2>
            </div>
            
            <MaterialSelector
              selectedMaterial={selectedMaterial}
              onMaterialSelect={handleMaterialSelect}
            />
            
            <div className="flex items-center gap-2 mt-8 mb-4">
              <Upload className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">File Upload & Analysis</h2>
            </div>
            
            <FileAnalysis 
              onVolumeCalculated={handleVolumeCalculated}
              onModelLoaded={handleModelLoaded}
            />
            
            <div className="flex items-center gap-2 mt-8 mb-4">
              <Settings className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Print Configuration</h2>
            </div>
            
            <PrintSettingsComponent
              settings={printSettings}
              onSettingsChange={setPrintSettings}
            />
          </div>

          {/* Center Column - 3D Viewer */}
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">3D Model Preview</h2>
              <p className="text-muted-foreground text-sm">
                {loadedGeometry ? 'Your uploaded model with selected material' : 'Interactive 3D preview with selected material'}
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

          {/* Right Column - Cost Calculator */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Cost Analysis</h2>
            </div>
            
            <CostCalculator
              material={selectedMaterial}
              settings={printSettings}
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

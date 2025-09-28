import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Material, PrintSettings, CostBreakdown } from '@/types/materials';
import { Calculator, Zap, Clock, Package } from 'lucide-react';

interface CostCalculatorProps {
  material: Material | null;
  settings: PrintSettings;
  onCostCalculated?: (cost: number) => void;
}

const CostCalculator: React.FC<CostCalculatorProps> = ({ material, settings, onCostCalculated }) => {
  const calculateCosts = (): CostBreakdown => {
    if (!material || !settings.volume) {
      return { materialCost: 0, laborCost: 0, electricityCost: 0, total: 0 };
    }

    // Material cost calculation
    const materialVolumeKg = (settings.volume * material.density) / 1000; // Convert g to kg
    const infillMultiplier = settings.infill / 100;
    const supportMultiplier = settings.supports ? 1.2 : 1; // 20% extra for supports
    const materialCost = materialVolumeKg * infillMultiplier * supportMultiplier * material.costPerKg;

    // Labor cost
    const laborCost = settings.estimatedPrintTime * settings.laborCostPerHour;

    // Electricity cost
    const powerKw = settings.printerPowerConsumption / 1000;
    const electricityCost = powerKw * settings.estimatedPrintTime * settings.electricityCostPerKwh;

    const total = materialCost + laborCost + electricityCost;

    return {
      materialCost: Math.round(materialCost * 100) / 100,
      laborCost: Math.round(laborCost * 100) / 100,
      electricityCost: Math.round(electricityCost * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  };

  const costs = calculateCosts();
  
  // Call the callback when costs are calculated
  React.useEffect(() => {
    if (onCostCalculated) {
      onCostCalculated(costs.total);
    }
  }, [costs.total, onCostCalculated]);

  const materialWeight = material && settings.volume 
    ? Math.round((settings.volume * material.density * settings.infill / 100) * 100) / 100
    : 0;

  return (
    <Card className="bg-gradient-tech border-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="w-5 h-5 text-primary" />
          Cost Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {material && settings.volume > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="w-4 h-4" />
                  Material Weight
                </div>
                <div className="text-lg font-semibold">{materialWeight}g</div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  Print Time
                </div>
                <div className="text-lg font-semibold">{settings.estimatedPrintTime}h</div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full bg-${material.color}`} />
                  <span className="text-sm">{material.name} Material</span>
                </div>
                <span className="font-medium">${costs.materialCost}</span>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-sm">Labor Cost</span>
                </div>
                <span className="font-medium">${costs.laborCost}</span>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-yellow-500" />
                  <span className="text-sm">Electricity</span>
                </div>
                <span className="font-medium">${costs.electricityCost}</span>
              </div>
            </div>

            <Separator />

            <div className="flex justify-between items-center text-xl font-bold">
              <span>Total Cost</span>
              <Badge variant="outline" className="text-lg px-4 py-2 bg-primary/10 border-primary">
                ${costs.total}
              </Badge>
            </div>

            {settings.supports && (
              <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                * Support material adds ~20% to material cost
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <Calculator className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Select a material and enter volume to calculate costs</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CostCalculator;
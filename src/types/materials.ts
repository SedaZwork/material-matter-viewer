export interface Material {
  id: string;
  name: string;
  costPerKg: number;
  density: number; // g/cm³
  color: string;
  properties: {
    temperature: number;
    flexibility: 'low' | 'medium' | 'high';
    strength: 'low' | 'medium' | 'high';
    durability: 'low' | 'medium' | 'high';
  };
  description: string;
}

export interface PrintSettings {
  materialId: string;
  volume: number; // cm³
  infill: number; // percentage
  supports: boolean;
  laborCostPerHour: number;
  estimatedPrintTime: number; // hours
  electricityCostPerKwh: number;
  printerPowerConsumption: number; // watts
}

export interface CostBreakdown {
  materialCost: number;
  laborCost: number;
  electricityCost: number;
  total: number;
}
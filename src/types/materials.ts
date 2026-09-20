export type RecipeScope = 'upload' | 'ring' | 'vessel' | 'terrain';

export interface MaterialPBR {
  color: string;
  metalness: number;
  roughness: number;
  envIntensity?: number;
}

export interface Material {
  id: string;
  name: string;
  costPerKg: number;
  density: number; // g/cm³
  color: string;
  /** Physically-based appearance used by the 3D viewer. */
  pbr: MaterialPBR;
  /** Which product recipes offer this material. */
  recipes: RecipeScope[];
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

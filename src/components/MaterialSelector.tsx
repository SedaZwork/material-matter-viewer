import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { materials } from '@/data/materials';
import { Material } from '@/types/materials';
import { cn } from '@/lib/utils';

interface MaterialSelectorProps {
  selectedMaterial: Material | null;
  onMaterialSelect: (material: Material) => void;
}

const MATERIAL_COLORS: Record<string, string> = {
  pla: '#22c55e',
  petg: '#a855f7',
  abs: '#f59e0b',
  nylon: '#ec4899',
};

const MaterialSelector: React.FC<MaterialSelectorProps> = ({
  selectedMaterial,
  onMaterialSelect,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Surface Material</h3>
        {selectedMaterial && (
          <span className="text-xs text-muted-foreground">
            Selected: <span className="text-foreground font-medium">{selectedMaterial.name}</span>
          </span>
        )}
      </div>
      <TooltipProvider>
        <div className="flex items-center gap-3">
          {materials.map((material) => {
            const isSelected = selectedMaterial?.id === material.id;
            const color = MATERIAL_COLORS[material.id] || '#888';
            return (
              <Tooltip key={material.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onMaterialSelect(material)}
                    className={cn(
                      "relative w-12 h-12 rounded-full transition-all duration-200 focus:outline-none",
                      isSelected
                        ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                        : "hover:scale-105 hover:shadow-md"
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Select ${material.name}`}
                  >
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <div className="space-y-1">
                    <div className="font-semibold">{material.name}</div>
                    <div className="text-xs text-muted-foreground">{material.description}</div>
                    <div className="text-xs font-medium">
                      €{material.costPerKg}/kg · {material.density} g/cm³
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
};

export default MaterialSelector;

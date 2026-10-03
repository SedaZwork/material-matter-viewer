import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { materials as allMaterials } from '@/data/materials';
import { Material } from '@/types/materials';
import { cn } from '@/lib/utils';

interface MaterialSelectorProps {
  selectedMaterial: Material | null;
  onMaterialSelect: (material: Material) => void;
  materials?: Material[];
}

/** Swatch background that hints at the PBR finish (metallic sheen vs. matte). */
const swatchStyle = (m: Material): React.CSSProperties => {
  const { color, metalness, roughness } = m.pbr;
  if (metalness > 0.5) {
    const shine = Math.round((1 - roughness) * 85);
    return {
      background: `radial-gradient(circle at 32% 28%, hsl(0 0% 100% / ${shine}%), transparent 45%), linear-gradient(135deg, ${color}, hsl(0 0% 20% / 0.55)), ${color}`,
    };
  }
  return { backgroundColor: color };
};

const MaterialSelector: React.FC<MaterialSelectorProps> = ({
  selectedMaterial,
  onMaterialSelect,
  materials = allMaterials,
}) => {
  return (
    <div className="space-y-2 rounded-lg border border-viewport-border bg-viewport-panel px-3 py-2.5 text-viewport-foreground backdrop-blur-xl md:px-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-viewport-foreground">Surface material</h3>
        {selectedMaterial && (
          <span className="hidden text-xs text-viewport-muted sm:inline">
            Selected: <span className="text-viewport-foreground font-medium">{selectedMaterial.name}</span>
          </span>
        )}
      </div>
      <TooltipProvider>
        <div className="flex items-start gap-3 overflow-x-auto pb-1">
          {materials.map((material) => {
            const isSelected = selectedMaterial?.id === material.id;
            return (
              <Tooltip key={material.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onMaterialSelect(material)}
                    className={cn(
                      "flex w-14 shrink-0 flex-col items-center gap-1.5 focus:outline-none transition-all duration-200",
                      isSelected ? "scale-110" : "hover:scale-105"
                    )}
                    aria-label={`Select ${material.name}`}
                  >
                    <div
                      className={cn(
                        "relative w-8 h-8 rounded-full transition-all duration-200 md:w-9 md:h-9",
                        isSelected
                          ? "ring-2 ring-offset-2 ring-offset-viewport ring-viewport-foreground"
                          : "hover:shadow-md"
                      )}
                      style={swatchStyle(material)}
                    >
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className="w-4 h-4 text-primary-foreground drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className={cn(
                      "text-center text-[10px] leading-tight font-medium transition-colors",
                      isSelected ? "text-viewport-foreground" : "text-viewport-muted"
                    )}>
                      {material.name}
                    </span>
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

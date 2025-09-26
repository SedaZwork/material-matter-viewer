import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { materials } from '@/data/materials';
import { Material } from '@/types/materials';

interface MaterialSelectorProps {
  selectedMaterial: Material | null;
  onMaterialSelect: (material: Material) => void;
}

const MaterialSelector: React.FC<MaterialSelectorProps> = ({
  selectedMaterial,
  onMaterialSelect,
}) => {
  const getPropertyColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-destructive/20 text-destructive';
      case 'medium': return 'bg-yellow-500/20 text-yellow-500';
      case 'high': return 'bg-green-500/20 text-green-500';
      default: return 'bg-muted';
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Select Material</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {materials.map((material) => (
          <Card
            key={material.id}
            className={`cursor-pointer transition-all duration-300 hover:shadow-glow border-2 ${
              selectedMaterial?.id === material.id
                ? `border-${material.color} shadow-glow`
                : 'border-border hover:border-primary/30'
            }`}
            onClick={() => onMaterialSelect(material)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{material.name}</CardTitle>
                <div
                  className={`w-4 h-4 rounded-full bg-${material.color}`}
                />
              </div>
              <p className="text-sm text-muted-foreground">{material.description}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Cost per kg:</span>
                <span className="font-medium">${material.costPerKg}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Density:</span>
                <span className="font-medium">{material.density} g/cm³</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Print temp:</span>
                <span className="font-medium">{material.properties.temperature}°C</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge className={getPropertyColor(material.properties.strength)}>
                  Strength: {material.properties.strength}
                </Badge>
                <Badge className={getPropertyColor(material.properties.flexibility)}>
                  Flexibility: {material.properties.flexibility}
                </Badge>
                <Badge className={getPropertyColor(material.properties.durability)}>
                  Durability: {material.properties.durability}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MaterialSelector;
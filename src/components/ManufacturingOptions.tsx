import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, DollarSign, Leaf, Factory, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Material, PrintSettings } from '@/types/materials';
import { toast } from 'sonner';

interface Fabricator {
  fabricator_id: string;
  business_name: string;
  distance_km: number | null;
  final_price_multiplier: number;
  location_address: string;
}

interface ManufacturingOptionsProps {
  material: Material | null;
  settings: PrintSettings;
  baseCost: number;
  onSelectFabricator?: (fabricatorId: string, finalCost: number) => void;
}

const ManufacturingOptions: React.FC<ManufacturingOptionsProps> = ({
  material,
  settings,
  baseCost,
  onSelectFabricator,
}) => {
  const [fabricators, setFabricators] = useState<Fabricator[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'cheapest' | 'random' | 'local' | null>(null);

  useEffect(() => {
    if (material && settings.volume > 0) {
      fetchFabricators();
    }
  }, [material, settings.volume]);

  const fetchFabricators = async () => {
    setLoading(true);
    try {
      // Get user's location (for demo, using default coordinates)
      // In production, you'd want to get actual user location
      const userLat = 40.7128; // New York as example
      const userLng = -74.0060;

      const { data, error } = await supabase.rpc('find_available_fabricators', {
        p_technology: 'FDM', // Default to FDM, could be based on material
        p_user_lat: userLat,
        p_user_lng: userLng,
      });

      if (error) throw error;
      setFabricators(data || []);
    } catch (error) {
      console.error('Error fetching fabricators:', error);
      toast.error('Failed to load manufacturing options');
    } finally {
      setLoading(false);
    }
  };

  const getCheapestOption = (): Fabricator | null => {
    if (fabricators.length === 0) return null;
    return fabricators.reduce((prev, current) =>
      prev.final_price_multiplier < current.final_price_multiplier ? prev : current
    );
  };

  const getRandomOption = (): Fabricator | null => {
    if (fabricators.length === 0) return null;
    return fabricators[Math.floor(Math.random() * fabricators.length)];
  };

  const getLocalOption = (): Fabricator | null => {
    if (fabricators.length === 0) return null;
    const localFabs = fabricators.filter(f => f.distance_km !== null);
    if (localFabs.length === 0) return fabricators[0];
    return localFabs.reduce((prev, current) =>
      (prev.distance_km || Infinity) < (current.distance_km || Infinity) ? prev : current
    );
  };

  const handleSelectOption = (type: 'cheapest' | 'random' | 'local', fabricator: Fabricator | null) => {
    if (!fabricator) return;
    setSelectedOption(type);
    const finalCost = baseCost * fabricator.final_price_multiplier;
    if (onSelectFabricator) {
      onSelectFabricator(fabricator.fabricator_id, finalCost);
    }
    toast.success(`Selected ${type} manufacturing option`);
  };

  const cheapest = getCheapestOption();
  const random = getRandomOption();
  const local = getLocalOption();

  if (!material || settings.volume === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Factory className="w-5 h-5 text-primary" />
            Manufacturing Options
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <Factory className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Upload a model and select material to see manufacturing options</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Factory className="w-5 h-5 text-primary" />
            Manufacturing Options
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <Zap className="w-8 h-8 mx-auto mb-2 animate-pulse" />
            <p>Finding available manufacturers...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Factory className="w-5 h-5 text-primary" />
          Manufacturing Options
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Support local manufacturing and reduce carbon footprint
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Cheapest Option */}
          <div
            className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-primary ${
              selectedOption === 'cheapest' ? 'border-primary bg-primary/5' : 'border-border'
            }`}
            onClick={() => handleSelectOption('cheapest', cheapest)}
          >
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-5 h-5 text-green-500" />
              <h3 className="font-semibold">Cheapest</h3>
            </div>
            {cheapest ? (
              <>
                <p className="text-sm text-muted-foreground mb-2">{cheapest.business_name}</p>
                <Badge variant="outline" className="mb-2">
                  ${(baseCost * cheapest.final_price_multiplier).toFixed(2)}
                </Badge>
                <p className="text-xs text-muted-foreground">{cheapest.location_address}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No manufacturers available</p>
            )}
          </div>

          {/* Random Option */}
          <div
            className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-primary ${
              selectedOption === 'random' ? 'border-primary bg-primary/5' : 'border-border'
            }`}
            onClick={() => handleSelectOption('random', random)}
          >
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-yellow-500" />
              <h3 className="font-semibold">Fair Choice</h3>
            </div>
            {random ? (
              <>
                <p className="text-sm text-muted-foreground mb-2">{random.business_name}</p>
                <Badge variant="outline" className="mb-2">
                  ${(baseCost * random.final_price_multiplier).toFixed(2)}
                </Badge>
                <p className="text-xs text-muted-foreground">{random.location_address}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No manufacturers available</p>
            )}
          </div>

          {/* Local Best Option */}
          <div
            className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-primary ${
              selectedOption === 'local' ? 'border-primary bg-primary/5' : 'border-border'
            }`}
            onClick={() => handleSelectOption('local', local)}
          >
            <div className="flex items-center gap-2 mb-3">
              <Leaf className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold">Local Best</h3>
            </div>
            {local ? (
              <>
                <p className="text-sm text-muted-foreground mb-2">{local.business_name}</p>
                <Badge variant="outline" className="mb-2">
                  ${(baseCost * local.final_price_multiplier).toFixed(2)}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-green-600 mb-1">
                  <MapPin className="w-3 h-3" />
                  {local.distance_km ? `${local.distance_km} km away` : 'Nearby'}
                </div>
                <p className="text-xs text-muted-foreground">{local.location_address}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No manufacturers available</p>
            )}
          </div>
        </div>

        {/* Ecological Benefits */}
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mt-4">
          <div className="flex items-start gap-3">
            <Leaf className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                Choose Local, Choose Sustainable
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300">
                Local manufacturing reduces transportation emissions and supports your community's economy.
                {local && local.distance_km && (
                  <span className="block mt-1">
                    Save approximately {(local.distance_km * 0.21).toFixed(1)} kg of CO₂ by choosing local!
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ManufacturingOptions;

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, DollarSign, Leaf, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Material, PrintSettings } from '@/types/materials';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

interface Fabricator {
  fabricator_id: string;
  business_name: string;
  distance_km: number | null;
  final_price_multiplier: number;
  location_address: string;
  build_volume_x: number;
  build_volume_y: number;
  build_volume_z: number;
}

interface Dimensions {
  width: number;
  height: number;
  depth: number;
}

interface ManufacturingOptionsProps {
  material: Material | null;
  settings: PrintSettings;
  baseCost: number;
  dimensions: Dimensions | null;
  scale: number;
  onSelectFabricator?: (fabricatorId: string, finalCost: number) => void;
}

const ManufacturingOptions: React.FC<ManufacturingOptionsProps> = ({
  material,
  settings,
  baseCost,
  dimensions,
  scale,
  onSelectFabricator,
}) => {
  const [fabricators, setFabricators] = useState<Fabricator[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFabricator, setSelectedFabricator] = useState<Fabricator | null>(null);

  useEffect(() => {
    if (material && settings.volume > 0) {
      fetchFabricators();
    }
  }, [material, settings.volume]);

  const fetchFabricators = async () => {
    if (!dimensions) return;
    
    setLoading(true);
    try {
      // Get user's actual location from their profile
      let userLat: number | null = null;
      let userLng: number | null = null;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('location_lat, location_lng')
          .eq('user_id', user.id)
          .single();
        
        if (profile?.location_lat && profile?.location_lng) {
          userLat = profile.location_lat;
          userLng = profile.location_lng;
        }
      }
      
      // Fallback to browser geolocation if no profile location
      if (userLat === null && userLng === null && typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              maximumAge: 300000, // Cache for 5 minutes
            });
          });
          userLat = position.coords.latitude;
          userLng = position.coords.longitude;
        } catch (geoError) {
          logger.warn('Geolocation unavailable or denied', geoError);
        }
      }

      const scaledDimensions = {
        width: dimensions.width * scale,
        height: dimensions.height * scale,
        depth: dimensions.depth * scale,
      };

      const { data, error } = await supabase
        .rpc('find_matching_fabricators', {
          p_min_x: scaledDimensions.width,
          p_min_y: scaledDimensions.height,
          p_min_z: scaledDimensions.depth,
        });

      if (error) throw error;
      
      const compatibleFabricators = (data || []).map((fab: any) => {
        // Calculate distance only if user location is available
        let distance: number | null = null;
        if (userLat !== null && userLng !== null) {
          distance = Math.round(
            6371 * Math.acos(
              Math.cos(userLat * Math.PI / 180) * Math.cos(fab.location_lat * Math.PI / 180) *
              Math.cos((fab.location_lng - userLng) * Math.PI / 180) +
              Math.sin(userLat * Math.PI / 180) * Math.sin(fab.location_lat * Math.PI / 180)
            ) * 100
          ) / 100;
        }
        
        return {
          fabricator_id: fab.fabricator_id,
          business_name: fab.business_name,
          location_address: fab.location_address,
          distance_km: distance,
          final_price_multiplier: fab.price_multiplier,
          build_volume_x: fab.build_volume_x,
          build_volume_y: fab.build_volume_y,
          build_volume_z: fab.build_volume_z,
        };
      });
      
      setFabricators(compatibleFabricators);
    } catch (error) {
      logger.error('Error fetching fabricators', error);
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

  const handleSelectOption = (fabricator: Fabricator | null) => {
    if (!fabricator) return;
    setSelectedFabricator(fabricator);
    const finalCost = baseCost * fabricator.final_price_multiplier;
    if (onSelectFabricator) {
      onSelectFabricator(fabricator.fabricator_id, finalCost);
    }
  };

  const cheapest = getCheapestOption();
  const random = getRandomOption();
  const local = getLocalOption();

  if (!material || settings.volume === 0 || !dimensions) {
    return null;
  }

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <Zap className="w-8 h-8 mx-auto mb-2 animate-pulse" />
        <p>Finding available manufacturers...</p>
      </div>
    );
  }

  if (!selectedFabricator) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Cheapest Option */}
          <div
            className="border rounded-lg p-4 cursor-pointer transition-all hover:border-primary hover:bg-primary/5"
            onClick={() => handleSelectOption(cheapest)}
          >
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-5 h-5 text-green-500" />
              <h3 className="font-semibold">Cheapest</h3>
            </div>
            {cheapest ? (
              <>
                <p className="text-sm text-muted-foreground mb-2">{cheapest.business_name}</p>
                <Badge variant="outline" className="mb-2">
                  €{(baseCost * cheapest.final_price_multiplier).toFixed(2)}
                </Badge>
                <p className="text-xs text-muted-foreground">{cheapest.location_address}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No manufacturers available</p>
            )}
          </div>

          {/* Random Option */}
          <div
            className="border rounded-lg p-4 cursor-pointer transition-all hover:border-primary hover:bg-primary/5"
            onClick={() => handleSelectOption(random)}
          >
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-yellow-500" />
              <h3 className="font-semibold">Fair Choice</h3>
            </div>
            {random ? (
              <>
                <p className="text-sm text-muted-foreground mb-2">{random.business_name}</p>
                <Badge variant="outline" className="mb-2">
                  €{(baseCost * random.final_price_multiplier).toFixed(2)}
                </Badge>
                <p className="text-xs text-muted-foreground">{random.location_address}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No manufacturers available</p>
            )}
          </div>

          {/* Local Best Option */}
          <div
            className="border rounded-lg p-4 cursor-pointer transition-all hover:border-primary hover:bg-primary/5"
            onClick={() => handleSelectOption(local)}
          >
            <div className="flex items-center gap-2 mb-3">
              <Leaf className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold">Local & Sustainable</h3>
            </div>
            {local ? (
              <>
                <p className="text-sm text-muted-foreground mb-2">{local.business_name}</p>
                <Badge variant="outline" className="mb-2">
                  €{(baseCost * local.final_price_multiplier).toFixed(2)}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-green-600 mb-1">
                  <MapPin className="w-3 h-3" />
                  {local.distance_km ? `${local.distance_km} km away` : 'Distance unknown'}
                </div>
                <p className="text-xs text-muted-foreground">{local.location_address}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No manufacturers available</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show checkout section when fabricator is selected
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold">Total Price</h3>
              <p className="text-muted-foreground">Manufacturing by {selectedFabricator.business_name}</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-primary">
                €{(baseCost * selectedFabricator.final_price_multiplier).toFixed(2)}
              </div>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <MapPin className="w-4 h-4" />
              <span>{selectedFabricator.location_address}</span>
            </div>
            {selectedFabricator.distance_km && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Leaf className="w-4 h-4" />
                <span>{selectedFabricator.distance_km} km away - Saving ~{(selectedFabricator.distance_km * 0.21).toFixed(1)} kg CO₂</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setSelectedFabricator(null)}
            >
              Change Manufacturer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ManufacturingOptions;

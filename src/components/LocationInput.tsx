import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LocationInputProps {
  onLocationChange: (lat: number | null, lng: number | null, postalCode: string, country: string) => void;
}

export const LocationInput: React.FC<LocationInputProps> = ({ onLocationChange }) => {
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(false);

  // Load user's saved location
  useEffect(() => {
    const loadUserLocation = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('postal_code, country, location_lat, location_lng')
          .eq('user_id', user.id)
          .single();
        
        if (profile) {
          setPostalCode(profile.postal_code || '');
          setCountry(profile.country || '');
          onLocationChange(
            profile.location_lat, 
            profile.location_lng, 
            profile.postal_code || '', 
            profile.country || ''
          );
        }
      }
    };
    loadUserLocation();
  }, []);

  const geocodeAddress = async (postal: string, countryName: string) => {
    if (!postal || !countryName) return null;
    
    try {
      // Using Nominatim (OpenStreetMap) free geocoding API
      const query = encodeURIComponent(`${postal}, ${countryName}`);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
    return null;
  };

  const handleLocationUpdate = async () => {
    if (!postalCode || !country) {
      toast.error('Please enter both postal code and country');
      return;
    }

    setLoading(true);
    const location = await geocodeAddress(postalCode, country);
    
    if (location) {
      onLocationChange(location.lat, location.lng, postalCode, country);
      
      // Save to user profile if logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({
            postal_code: postalCode,
            country: country,
            location_lat: location.lat,
            location_lng: location.lng
          })
          .eq('user_id', user.id);
        
        toast.success('Location updated successfully');
      }
    } else {
      toast.error('Could not find location. Please check your postal code and country.');
    }
    setLoading(false);
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Delivery Location</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="postalCode">Postal Code</Label>
            <Input
              id="postalCode"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              onBlur={handleLocationUpdate}
              placeholder="28001"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              onBlur={handleLocationUpdate}
              placeholder="Spain"
              disabled={loading}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

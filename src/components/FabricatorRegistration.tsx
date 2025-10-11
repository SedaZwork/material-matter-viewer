import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Factory } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Technology = 'FDM' | 'SLA' | 'SLS' | 'MJF' | 'Binder_Jetting';

const TECHNOLOGIES: Technology[] = ['FDM', 'SLA', 'SLS', 'MJF', 'Binder_Jetting'];

export const FabricatorRegistration = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    businessName: '',
    address: '',
    email: '',
    phone: '',
    cif: '',
    capacity: 100,
    priceMultiplier: 1.0,
    buildVolumeX: 200,
    buildVolumeY: 200,
    buildVolumeZ: 200,
  });
  
  const [selectedTechnologies, setSelectedTechnologies] = useState<Technology[]>([]);

  const handleTechnologyToggle = (tech: Technology) => {
    setSelectedTechnologies(prev =>
      prev.includes(tech)
        ? prev.filter(t => t !== tech)
        : [...prev, tech]
    );
  };

  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      // Using OpenStreetMap Nominatim API for geocoding (free, no API key required)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to register as a fabricator",
        variant: "destructive",
      });
      return;
    }

    if (selectedTechnologies.length === 0) {
      toast({
        title: "Technology Required",
        description: "Please select at least one manufacturing technology",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Geocode the address
      const coordinates = await geocodeAddress(formData.address);
      
      if (!coordinates) {
        toast({
          title: "Invalid Address",
          description: "Could not find coordinates for the provided address. Please check and try again.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Insert fabricator data
      const { error } = await supabase
        .from('fabricators')
        .insert({
          user_id: user.id,
          business_name: formData.businessName,
          location_address: formData.address,
          location_lat: coordinates.lat,
          location_lng: coordinates.lng,
          technologies: selectedTechnologies,
          current_capacity: formData.capacity,
          price_multiplier: formData.priceMultiplier,
          build_volume_x: formData.buildVolumeX,
          build_volume_y: formData.buildVolumeY,
          build_volume_z: formData.buildVolumeZ,
        });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Your fabricator profile has been created successfully",
      });

      // Reset form and close dialog
      setFormData({
        businessName: '',
        address: '',
        email: '',
        phone: '',
        cif: '',
        capacity: 100,
        priceMultiplier: 1.0,
        buildVolumeX: 200,
        buildVolumeY: 200,
        buildVolumeZ: 200,
      });
      setSelectedTechnologies([]);
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to register fabricator",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Factory className="w-4 h-4" />
          Register as Fabricator
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register as Fabricator</DialogTitle>
          <DialogDescription>
            Join our decentralized manufacturing network and start receiving print jobs
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="businessName">Company Name *</Label>
              <Input
                id="businessName"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                required
                placeholder="Your Company Name"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
                placeholder="Street, City, Country"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contact@company.com"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+34 123 456 789"
              />
            </div>

            <div>
              <Label htmlFor="cif">CIF / Tax ID</Label>
              <Input
                id="cif"
                value={formData.cif}
                onChange={(e) => setFormData({ ...formData, cif: e.target.value })}
                placeholder="A12345678"
              />
            </div>

            <div>
              <Label htmlFor="capacity">Current Capacity (%) *</Label>
              <Input
                id="capacity"
                type="number"
                min="0"
                max="100"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                required
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="priceMultiplier">Price Multiplier *</Label>
              <Input
                id="priceMultiplier"
                type="number"
                step="0.1"
                min="0.5"
                max="3"
                value={formData.priceMultiplier}
                onChange={(e) => setFormData({ ...formData, priceMultiplier: parseFloat(e.target.value) })}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                1.0 = base price, higher values increase your pricing
              </p>
            </div>

            <div className="col-span-2">
              <Label className="mb-3 block">Build Volume (mm) *</Label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="buildVolumeX" className="text-xs">Width (X)</Label>
                  <Input
                    id="buildVolumeX"
                    type="number"
                    min="50"
                    value={formData.buildVolumeX}
                    onChange={(e) => setFormData({ ...formData, buildVolumeX: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="buildVolumeY" className="text-xs">Height (Y)</Label>
                  <Input
                    id="buildVolumeY"
                    type="number"
                    min="50"
                    value={formData.buildVolumeY}
                    onChange={(e) => setFormData({ ...formData, buildVolumeY: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="buildVolumeZ" className="text-xs">Depth (Z)</Label>
                  <Input
                    id="buildVolumeZ"
                    type="number"
                    min="50"
                    value={formData.buildVolumeZ}
                    onChange={(e) => setFormData({ ...formData, buildVolumeZ: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="col-span-2">
              <Label className="mb-3 block">Technologies Available *</Label>
              <div className="grid grid-cols-2 gap-3">
                {TECHNOLOGIES.map((tech) => (
                  <div key={tech} className="flex items-center space-x-2">
                    <Checkbox
                      id={tech}
                      checked={selectedTechnologies.includes(tech)}
                      onCheckedChange={() => handleTechnologyToggle(tech)}
                    />
                    <Label htmlFor={tech} className="cursor-pointer font-normal">
                      {tech}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Registering...' : 'Register Fabricator'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

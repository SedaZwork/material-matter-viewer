import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, ShoppingCart, Check } from 'lucide-react';
import { Material, PrintSettings } from '@/types/materials';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CheckoutButtonProps {
  material: Material | null;
  settings: PrintSettings;
  selectedFabricatorId: string | null;
  finalCost: number;
  quantity: number;
  scale: number;
}

const CheckoutButton: React.FC<CheckoutButtonProps> = ({ 
  material, 
  settings, 
  selectedFabricatorId,
  finalCost,
  quantity,
  scale
}) => {
  const handleCheckout = async () => {
    if (!material) {
      toast.error('Please select a material first');
      return;
    }
    
    if (settings.volume === 0) {
      toast.error('Please upload a 3D model first');
      return;
    }

    if (!selectedFabricatorId) {
      toast.error('Please select a manufacturing option first');
      return;
    }

    try {
      // Create print job in database
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('You must be logged in to place an order');
        return;
      }

      const { error } = await supabase.from('print_jobs').insert({
        user_id: user.id,
        material_name: material.name,
        volume: settings.volume * scale * scale * scale,
        infill: settings.infill,
        supports: settings.supports,
        estimated_print_time: settings.estimatedPrintTime,
        base_cost: finalCost,
        technology: 'FDM',
        assigned_fabricator_id: selectedFabricatorId,
        final_cost: finalCost * quantity,
        status: 'pending'
      });

      if (error) throw error;

      toast.success('Order placed successfully! 🎉', {
        description: 'Your local manufacturer will begin production soon.',
      });
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error('Failed to place order. Please try again.');
    }
  };

  const isReadyToOrder = material && settings.volume > 0 && selectedFabricatorId;

  return (
    <Card className="bg-card border-border max-w-md mx-auto">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-4 border-b border-border">
            <span className="text-lg font-semibold">Total Price:</span>
            <Badge variant="outline" className="text-2xl font-bold bg-primary/10 border-primary px-4 py-2">
              €{(finalCost * quantity).toFixed(2)}
            </Badge>
          </div>
          
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Quantity:</span>
              <span className="font-medium">{quantity}x</span>
            </div>
            <div className="flex justify-between">
              <span>Scale:</span>
              <span className="font-medium">{scale.toFixed(2)}x</span>
            </div>
            <div className="flex justify-between">
              <span>Material:</span>
              <span className="font-medium">{material?.name || 'Not selected'}</span>
            </div>
          </div>
          
          <Button
            onClick={handleCheckout}
            disabled={!isReadyToOrder}
            className="w-full h-14 text-lg font-semibold"
            size="lg"
          >
            {isReadyToOrder ? (
              <>
                <ShoppingCart className="w-5 h-5 mr-2" />
                Place Order
              </>
            ) : (
              <>
                <Check className="w-5 h-5 mr-2" />
                Select a Manufacturer
              </>
            )}
          </Button>
          
          {!isReadyToOrder && (
            <p className="text-xs text-muted-foreground text-center">
              {!material || settings.volume === 0 
                ? 'Upload a model and select a material' 
                : 'Select a manufacturing option above'}
            </p>
          )}
          
          <div className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
            <p>✓ Secure payment · ✓ Local production · ✓ Eco-friendly</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CheckoutButton;
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
  totalCost: number;
  selectedFabricatorId: string | null;
  finalCost: number;
}

const CheckoutButton: React.FC<CheckoutButtonProps> = ({ 
  material, 
  settings, 
  totalCost,
  selectedFabricatorId,
  finalCost
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
        volume: settings.volume,
        infill: settings.infill,
        supports: settings.supports,
        estimated_print_time: settings.estimatedPrintTime,
        base_cost: totalCost,
        technology: 'FDM',
        assigned_fabricator_id: selectedFabricatorId,
        final_cost: finalCost,
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
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShoppingCart className="w-5 h-5 text-primary" />
          Order Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Material:</span>
            <span className="text-sm font-medium">
              {material ? material.name : 'Not selected'}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Volume:</span>
            <span className="text-sm font-medium">
              {settings.volume > 0 ? `${settings.volume.toFixed(2)} cm³` : 'No model'}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Infill:</span>
            <span className="text-sm font-medium">{settings.infill}%</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Supports:</span>
            <span className="text-sm font-medium">
              {settings.supports ? 'Yes' : 'No'}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Est. Print Time:</span>
            <span className="text-sm font-medium">{settings.estimatedPrintTime}h</span>
          </div>
        </div>
        
        <div className="border-t border-border pt-4">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-semibold">Final Cost:</span>
            <Badge variant="outline" className="text-lg font-bold bg-primary/10 border-primary">
              ${finalCost > 0 ? finalCost.toFixed(2) : totalCost.toFixed(2)}
            </Badge>
          </div>
          
          <Button
            onClick={handleCheckout}
            disabled={!isReadyToOrder}
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            {isReadyToOrder ? (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Place Order
              </>
            ) : (
              <>
                <Check className="w-5 h-5 mr-2" />
                Complete Setup First
              </>
            )}
          </Button>
          
          {!isReadyToOrder && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              {!material || settings.volume === 0 
                ? 'Upload a model and select a material' 
                : 'Select a manufacturing option'}
            </p>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground text-center">
          <p>Secure payment processing</p>
          <p>Free shipping on orders over $50</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CheckoutButton;
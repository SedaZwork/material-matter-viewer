import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Check } from 'lucide-react';
import { Material, PrintSettings } from '@/types/materials';
import { PaymentDialog } from '@/components/PaymentDialog';
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
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const handlePaymentComplete = async (paymentMethod: string, customerDetails: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('You must be logged in to place an order');
        return;
      }

      const { error } = await supabase.from('print_jobs').insert({
        user_id: user.id,
        material_name: material?.name || 'Unknown',
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

      toast.success(`Order placed successfully! Payment: ${paymentMethod} 🎉`);
      toast.info(`Confirmation sent to ${customerDetails.email}`);
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error('Failed to place order. Please try again.');
    }
  };

  const handleCheckout = () => {
    if (!material || settings.volume === 0 || !selectedFabricatorId) {
      toast.error('Please complete all selections');
      return;
    }
    setShowPaymentDialog(true);
  };

  const isReadyToOrder = material && settings.volume > 0 && selectedFabricatorId;

  return (
    <>
      <Button
        onClick={handleCheckout}
        disabled={!isReadyToOrder}
        className="w-full h-14 text-lg font-semibold"
        size="lg"
      >
        {isReadyToOrder ? (
          <>
            <ShoppingCart className="w-5 h-5 mr-2" />
            Place Order - €{(finalCost * quantity).toFixed(2)}
          </>
        ) : (
          <>
            <Check className="w-5 h-5 mr-2" />
            Select a Manufacturer First
          </>
        )}
      </Button>

      <PaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        totalAmount={finalCost * quantity}
        orderId={undefined}
        onPaymentComplete={handlePaymentComplete}
      />
    </>
  );
};

export default CheckoutButton;

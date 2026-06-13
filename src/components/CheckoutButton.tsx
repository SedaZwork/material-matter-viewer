import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Check, LogIn } from 'lucide-react';
import { Material, PrintSettings } from '@/types/materials';
import { PaymentDialog } from '@/components/PaymentDialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/utils/logger';

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const handlePaymentComplete = async (paymentMethod: string, customerDetails: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('You must be logged in to place an order');
        return;
      }

      // Pull AI-generation context (set by RingGenerator) if present.
      let genCtx: any = null;
      try {
        const raw = sessionStorage.getItem('ringGenerationContext');
        if (raw) genCtx = JSON.parse(raw);
      } catch { /* ignore */ }

      const insertRow: Record<string, any> = {
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
        status: 'pending',
        source: genCtx?.source ?? 'upload',
      };
      if (genCtx?.refCode) insertRow.ref_code = genCtx.refCode;
      if (genCtx?.modelStoragePath) insertRow.model_storage_path = genCtx.modelStoragePath;
      if (genCtx?.conceptImageUrl) insertRow.concept_image_url = genCtx.conceptImageUrl;
      if (genCtx?.generationPrompt) insertRow.generation_prompt = genCtx.generationPrompt;
      if (genCtx?.generationMetadata) {
        insertRow.generation_metadata = {
          ...genCtx.generationMetadata,
          customer: { email: customerDetails?.email },
          payment_method: paymentMethod,
          quantity,
          scale,
        };
      }

      const { data: inserted, error } = await supabase
        .from('print_jobs')
        .insert(insertRow)
        .select('id, ref_code')
        .single();

      if (error) throw error;

      // Clear one-shot generation context after successful order.
      sessionStorage.removeItem('ringGenerationContext');

      toast.success(`Order ${inserted?.ref_code ?? ''} placed! Payment: ${paymentMethod} 🎉`);
      toast.info(`Confirmation sent to ${customerDetails.email}`);
    } catch (error) {
      logger.error('Order placement failed', error);
      toast.error('Failed to place order. Please try again.');
    }
  };

  const handleCheckout = () => {
    if (!user) {
      toast.info('Please sign in to place an order');
      navigate('/auth?returnTo=/');
      return;
    }
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

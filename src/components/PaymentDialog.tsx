import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Wallet, Bitcoin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  orderId?: string;
  onPaymentComplete: (paymentMethod: string, details: any) => void;
}

export const PaymentDialog: React.FC<PaymentDialogProps> = ({
  open,
  onOpenChange,
  totalAmount,
  orderId,
  onPaymentComplete,
}) => {
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<'stripe' | 'paypal' | 'bitcoin' | null>(null);
  const [customerDetails, setCustomerDetails] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: '',
  });

  const handlePayment = async () => {
    if (!selectedMethod) {
      toast({
        title: "Select Payment Method",
        description: "Please choose how you'd like to pay",
        variant: "destructive",
      });
      return;
    }

    // Validate customer details
    if (!customerDetails.fullName || !customerDetails.email || !customerDetails.address) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Processing Payment",
        description: `Redirecting to ${selectedMethod} checkout...`,
      });

      if (selectedMethod === 'stripe') {
        // Redirect to Stripe Checkout
        const { data, error } = await supabase.functions.invoke('create-checkout', {
          body: {
            amount: totalAmount,
            orderId: orderId,
          }
        });

        if (error) throw error;
        if (data?.url) {
          window.open(data.url, '_blank');
          onPaymentComplete(selectedMethod, customerDetails);
          onOpenChange(false);
        }
      } else if (selectedMethod === 'paypal') {
        // PayPal integration would go here
        toast({
          title: "PayPal Integration",
          description: "Please connect your PayPal business account in the integration settings.",
        });
      } else if (selectedMethod === 'bitcoin') {
        // Bitcoin payment would go here
        toast({
          title: "Bitcoin Payment",
          description: "Bitcoin payment integration coming soon.",
        });
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Failed",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Your Order</DialogTitle>
          <DialogDescription>
            Total Amount: €{totalAmount.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Customer Details Form */}
          <div className="space-y-4">
            <h3 className="font-semibold">Shipping Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={customerDetails.fullName}
                  onChange={(e) => setCustomerDetails({ ...customerDetails, fullName: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={customerDetails.email}
                  onChange={(e) => setCustomerDetails({ ...customerDetails, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={customerDetails.phone}
                  onChange={(e) => setCustomerDetails({ ...customerDetails, phone: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  value={customerDetails.address}
                  onChange={(e) => setCustomerDetails({ ...customerDetails, address: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={customerDetails.city}
                  onChange={(e) => setCustomerDetails({ ...customerDetails, city: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  value={customerDetails.postalCode}
                  onChange={(e) => setCustomerDetails({ ...customerDetails, postalCode: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={customerDetails.country}
                  onChange={(e) => setCustomerDetails({ ...customerDetails, country: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-4">
            <h3 className="font-semibold">Payment Method</h3>
            <div className="grid grid-cols-3 gap-4">
              <button
                className={`border-2 rounded-lg p-4 transition-all hover:border-primary ${
                  selectedMethod === 'stripe' ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onClick={() => setSelectedMethod('stripe')}
              >
                <CreditCard className="w-8 h-8 mx-auto mb-2 text-primary" />
                <div className="text-sm font-semibold">Credit Card</div>
                <div className="text-xs text-muted-foreground">via Stripe</div>
              </button>

              <button
                className={`border-2 rounded-lg p-4 transition-all hover:border-primary ${
                  selectedMethod === 'paypal' ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onClick={() => setSelectedMethod('paypal')}
              >
                <Wallet className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <div className="text-sm font-semibold">PayPal</div>
                <div className="text-xs text-muted-foreground">Secure payment</div>
              </button>

              <button
                className={`border-2 rounded-lg p-4 transition-all hover:border-primary ${
                  selectedMethod === 'bitcoin' ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onClick={() => setSelectedMethod('bitcoin')}
              >
                <Bitcoin className="w-8 h-8 mx-auto mb-2 text-orange-500" />
                <div className="text-sm font-semibold">Bitcoin</div>
                <div className="text-xs text-muted-foreground">Cryptocurrency</div>
              </button>
            </div>
          </div>

          {/* Payment Method Details */}
          {selectedMethod === 'stripe' && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground mb-3">
                You will be redirected to Stripe to complete your payment securely.
              </p>
              <div className="text-xs text-muted-foreground">
                Stripe accepts all major credit and debit cards.
              </div>
            </div>
          )}

          {selectedMethod === 'paypal' && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground mb-3">
                You will be redirected to PayPal to complete your payment.
              </p>
              <div className="text-xs text-muted-foreground">
                Log in with your PayPal account or pay as a guest.
              </div>
            </div>
          )}

          {selectedMethod === 'bitcoin' && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground mb-3">
                Bitcoin payment instructions will be provided after confirmation.
              </p>
              <div className="text-xs text-muted-foreground">
                Payment must be completed within 15 minutes.
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" className="flex-1" onClick={handlePayment}>
              Complete Payment - €{totalAmount.toFixed(2)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

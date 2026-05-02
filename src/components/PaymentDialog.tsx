import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Wallet, Bitcoin, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { logger } from '@/utils/logger';

const customerSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Please enter a valid email address').max(255),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  address: z.string().trim().min(5, 'Address must be at least 5 characters').max(200),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  postalCode: z.string().trim().max(20).optional().or(z.literal('')),
  country: z.string().trim().max(100).optional().or(z.literal('')),
});

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  orderId?: string;
  onPaymentComplete: (paymentMethod: string, details: any) => void;
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      isMetaMask?: boolean;
    };
  }
}

export const PaymentDialog: React.FC<PaymentDialogProps> = ({
  open, onOpenChange, totalAmount, orderId, onPaymentComplete,
}) => {
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<'stripe' | 'paypal' | 'bitcoin' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [customerDetails, setCustomerDetails] = useState({
    fullName: '', email: '', phone: '', address: '', city: '', postalCode: '', country: '',
  });

  const handlePayment = async () => {
    if (!selectedMethod) {
      toast({ title: "Select Payment Method", description: "Please choose how you'd like to pay", variant: "destructive" });
      return;
    }

    const validationResult = customerSchema.safeParse(customerDetails);
    if (!validationResult.success) {
      toast({ title: "Invalid Input", description: validationResult.error.issues[0].message, variant: "destructive" });
      return;
    }
    const validatedData = validationResult.data;
    setProcessing(true);

    try {
      if (selectedMethod === 'stripe') {
        const { data, error } = await supabase.functions.invoke('create-checkout', {
          body: { amount: totalAmount, orderId: orderId || `order_${Date.now()}` },
        });
        if (error) throw error;
        if (data?.url) {
          window.open(data.url, '_blank');
          onPaymentComplete(selectedMethod, validatedData);
          onOpenChange(false);
        } else {
          throw new Error('No checkout URL returned');
        }
      } else if (selectedMethod === 'paypal') {
        // Open PayPal.me or PayPal checkout
        const paypalUrl = `https://www.paypal.com/paypalme/0K3Dprint/${totalAmount}EUR`;
        window.open(paypalUrl, '_blank');
        toast({ title: "PayPal Payment", description: "Complete your payment in the PayPal window. Once done, your order will be confirmed." });
        onPaymentComplete(selectedMethod, validatedData);
        onOpenChange(false);
      } else if (selectedMethod === 'bitcoin') {
        await handleMetaMaskPayment(validatedData);
      }
    } catch (error) {
      logger.error('Payment processing failed', error);
      toast({ title: "Payment Failed", description: error instanceof Error ? error.message : "There was an error processing your payment.", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleMetaMaskPayment = async (validatedData: any) => {
    if (!window.ethereum?.isMetaMask) {
      toast({ title: "MetaMask Required", description: "Please install MetaMask browser extension to pay with crypto.", variant: "destructive" });
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    try {
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) throw new Error('No accounts found');

      // Convert EUR to ETH (approximate — in production use a price oracle)
      const ethPriceEur = 2500; // Placeholder rate
      const ethAmount = totalAmount / ethPriceEur;
      const weiAmount = '0x' + Math.floor(ethAmount * 1e18).toString(16);

      // Recipient address (replace with your actual wallet)
      const recipientAddress = '0x0000000000000000000000000000000000000000';

      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: accounts[0],
          to: recipientAddress,
          value: weiAmount,
          gas: '0x5208', // 21000 gas for simple transfer
        }],
      });

      toast({ title: "Transaction Sent!", description: `TX Hash: ${txHash.slice(0, 10)}...${txHash.slice(-8)}` });
      onPaymentComplete('bitcoin', { ...validatedData, txHash });
      onOpenChange(false);
    } catch (error: any) {
      if (error.code === 4001) {
        toast({ title: "Transaction Rejected", description: "You rejected the transaction in MetaMask.", variant: "destructive" });
      } else {
        throw error;
      }
    }
  };

  const updateField = (field: string, value: string) => {
    setCustomerDetails(prev => ({ ...prev, [field]: value }));
  };

  const paymentMethods = [
    { id: 'stripe' as const, icon: CreditCard, label: 'Credit Card', sub: 'via Stripe', color: 'text-primary' },
    { id: 'paypal' as const, icon: Wallet, label: 'PayPal', sub: 'Secure payment', color: 'text-blue-600' },
    { id: 'bitcoin' as const, icon: Bitcoin, label: 'Crypto', sub: 'via MetaMask', color: 'text-orange-500' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Your Order</DialogTitle>
          <DialogDescription>Total Amount: €{totalAmount.toFixed(2)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Customer Details */}
          <div className="space-y-4">
            <h3 className="font-semibold">Shipping Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input id="fullName" value={customerDetails.fullName} onChange={(e) => updateField('fullName', e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={customerDetails.email} onChange={(e) => updateField('email', e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" value={customerDetails.phone} onChange={(e) => updateField('phone', e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label htmlFor="address">Address *</Label>
                <Input id="address" value={customerDetails.address} onChange={(e) => updateField('address', e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" value={customerDetails.city} onChange={(e) => updateField('city', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input id="postalCode" value={customerDetails.postalCode} onChange={(e) => updateField('postalCode', e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" value={customerDetails.country} onChange={(e) => updateField('country', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="space-y-4">
            <h3 className="font-semibold">Payment Method</h3>
            <div className="grid grid-cols-3 gap-4">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  className={`border-2 rounded-lg p-4 transition-all hover:border-primary ${
                    selectedMethod === method.id ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                  onClick={() => setSelectedMethod(method.id)}
                >
                  <method.icon className={`w-8 h-8 mx-auto mb-2 ${method.color}`} />
                  <div className="text-sm font-semibold">{method.label}</div>
                  <div className="text-xs text-muted-foreground">{method.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Info panels */}
          {selectedMethod === 'stripe' && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground">You will be redirected to Stripe to complete your payment securely.</p>
              <p className="text-xs text-muted-foreground mt-1">Accepts all major credit and debit cards.</p>
            </div>
          )}
          {selectedMethod === 'paypal' && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground">You will be redirected to PayPal to complete your payment.</p>
              <p className="text-xs text-muted-foreground mt-1">Log in with your PayPal account or pay as a guest.</p>
            </div>
          )}
          {selectedMethod === 'bitcoin' && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground">Pay with ETH via MetaMask. The amount will be converted at current rates.</p>
              <p className="text-xs text-muted-foreground mt-1">
                {window.ethereum?.isMetaMask 
                  ? '✅ MetaMask detected — ready to pay' 
                  : '⚠️ MetaMask not detected — you will be prompted to install it'}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" className="flex-1" onClick={handlePayment} disabled={processing}>
              {processing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
              ) : (
                `Complete Payment — €${totalAmount.toFixed(2)}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

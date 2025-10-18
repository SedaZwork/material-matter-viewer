import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    const { amount, orderId } = await req.json();

    if (!amount || !orderId) {
      throw new Error("Missing required parameters: amount and orderId");
    }

    // Use Supabase's Stripe wrapper extension
    const { data, error } = await supabaseClient.functions.invoke('stripe-checkout', {
      body: {
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        customer_email: user.email,
        metadata: {
          order_id: orderId,
          user_id: user.id,
        },
        success_url: `${req.headers.get("origin")}/payment-success?order_id=${orderId}`,
        cancel_url: `${req.headers.get("origin")}/payment-canceled?order_id=${orderId}`,
      },
    });

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

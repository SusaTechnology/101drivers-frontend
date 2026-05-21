import React, { useEffect, useState } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface StripePaymentFormProps {
  clientSecret: string;
  onSuccess?: (paymentIntentId: string) => void;
  onError?: (message: string) => void;
}

export default function StripePaymentForm({
  clientSecret,
  onSuccess,
  onError,
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
    });

    if (error) {
      setMessage(error.message || "Payment failed");
      onError?.(error.message || "Payment failed");
    } else {
      // Payment succeeded — the webhook will handle status updates
      setMessage("Payment successful!");
      toast.success("Payment confirmed!");
      onSuccess?.("pi_" + Date.now());
    }

    setLoading(false);
  };

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-500">
        Loading payment form...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />

      {message && (
        <p className={message.includes("success") ? "text-green-600" : "text-red-600"}>
          {message}
        </p>
      )}

      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full py-3 rounded-2xl font-extrabold text-sm"
      >
        {loading ? "Processing..." : "Pay Now"}
      </Button>
    </form>
  );
}

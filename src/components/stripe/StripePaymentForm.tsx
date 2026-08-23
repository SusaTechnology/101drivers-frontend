import React, { useState } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";

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
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // No return_url — we stay on the page and handle success/error inline.
        // This enables the modal flow without browser redirect.
        return_url: `${window.location.origin}${window.location.pathname}?payment_intent=${clientSecret.split("_secret_")[0]}&redirect_status=success`,
      },
      // Redirect to return_url only on success. On error, stripe.confirmPayment
      // returns the error in the { error } object so we handle it inline.
      redirect: "if_required",
    });

    if (error) {
      setMessage(error.message || "Payment failed");
      onError?.(error.message || "Payment failed");
      setLoading(false);
    } else if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "requires_capture")) {
      setMessage(paymentIntent.status === "requires_capture" ? "Card authorized!" : "Payment successful!");
      setSucceeded(true);
      setLoading(false);
      onSuccess?.(paymentIntent.id);
    } else {
      // Stripe may redirect if redirect: "if_required" and the payment
      // requires additional actions (3DS, etc.). In that case the page will
      // navigate away. We handle the return via redirect_status in the wrapper.
      setLoading(false);
    }
  };

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-500">
        Loading payment form...
      </div>
    );
  }

  if (succeeded) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-3">
        <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
          Payment Successful
        </p>
        <p className="text-sm text-slate-500">
          Your payment has been processed. Thank you!
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />

      {message && !succeeded && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {message}
        </p>
      )}

      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full py-3 rounded-2xl font-extrabold text-sm"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </span>
        ) : (
          "Pay Now"
        )}
      </Button>
    </form>
  );
}

import React, { useEffect, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { RefreshCw } from "lucide-react";
import { getStripe } from "@/lib/stripe";
import { useDataQuery, useDataMutation } from "@/lib/tanstack/dataQuery";
import StripePaymentForm from "./StripePaymentForm";

interface StripePaymentWrapperProps {
  deliveryId: string;
  /** Dollar amount to display above the card form */
  amount?: number;
  onSuccess?: (paymentIntentId: string) => void;
  onError?: (message: string) => void;
}

export default function StripePaymentWrapper({
  deliveryId,
  amount,
  onSuccess,
  onError,
}: StripePaymentWrapperProps) {
  const [clientSecret, setClientSecret] = useState<string>("");
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Fetch Stripe publishable key ──
  const { data: configData } = useDataQuery<any>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/payments/stripe/config`,
    noFilter: true,
  });

  const publishableKey = configData?.publishableKey || "";

  // ── Create PaymentIntent (POST — backend expects POST, not GET) ──
  const intentMutation = useDataMutation<
    { clientSecret: string; paymentIntentId: string; status: string; amount: number },
    void
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/payments/stripe/payment-intent/${deliveryId}`,
    method: "POST",
    onSuccessInvalidate: false,
    successMessage: "",
    onSuccess: (data) => {
      console.log('[StripePaymentWrapper] PaymentIntent response:', data);
      // Handle both direct and nested response formats
      const secret = data?.clientSecret || data?.data?.clientSecret;
      if (secret) {
        setClientSecret(secret);
        setFetchError(null);
      } else {
        console.error('[StripePaymentWrapper] No clientSecret in response:', data);
        setFetchError("Failed to initialize payment — no client secret returned.");
      }
    },
    onError: (error) => {
      setFetchError(error.message || "Failed to initialize payment");
    },
  });

  // Auto-trigger PaymentIntent creation when deliveryId is available
  useEffect(() => {
    if (deliveryId && publishableKey && !clientSecret && !fetchError) {
      intentMutation.mutate();
    }
  }, [deliveryId, publishableKey]);

  // ── Handle Stripe redirect return (e.g. after 3DS) ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirectStatus = params.get("redirect_status");
    const paymentIntentId = params.get("payment_intent");

    if (redirectStatus === "succeeded" && paymentIntentId) {
      window.history.replaceState({}, "", window.location.pathname);
      setClientSecret("");
      onSuccess?.(paymentIntentId);
    } else if (redirectStatus && redirectStatus !== "succeeded") {
      window.history.replaceState({}, "", window.location.pathname);
      setFetchError(
        redirectStatus === "cancelled"
          ? "Payment was cancelled"
          : "Payment failed. Please try again.",
      );
    }
  }, [onSuccess]);

  // ── Render states ──

  if (intentMutation.isPending) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-600" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
        <p className="text-sm font-bold text-red-600 dark:text-red-400">{fetchError}</p>
        <p className="text-xs text-red-500 mt-1">Payment is not available at this time.</p>
        <button
          onClick={() => {
            setFetchError(null);
            intentMutation.mutate();
          }}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 transition"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    );
  }

  if (!publishableKey) {
    return (
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
        <p className="text-sm font-bold text-amber-600">Payment system not configured</p>
      </div>
    );
  }

  // Don't render Elements until we have a valid clientSecret
  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-600" />
      </div>
    );
  }

  const stripePromise = getStripe(publishableKey);

  return (
    <div>
      {/* Amount display */}
      {amount != null && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 mb-4">
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">Amount</span>
          <span className="text-lg font-black text-slate-900 dark:text-white">
            ${amount.toFixed(2)}
          </span>
        </div>
      )}
      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <StripePaymentForm
          clientSecret={clientSecret}
          onSuccess={onSuccess}
          onError={onError}
        />
      </Elements>
    </div>
  );
}

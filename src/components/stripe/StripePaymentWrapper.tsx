import React, { useEffect, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { useDataQuery } from "@/lib/tanstack/dataQuery";
import StripePaymentForm from "./StripePaymentForm";

interface StripePaymentWrapperProps {
  deliveryId: string;
  onSuccess?: (paymentIntentId: string) => void;
  onError?: (message: string) => void;
}

export default function StripePaymentWrapper({
  deliveryId,
  onSuccess,
  onError,
}: StripePaymentWrapperProps) {
  const [publishableKey, setPublishableKey] = useState<string>("");
  const [clientSecret, setClientSecret] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch Stripe config (publishable key)
  const { data: configData } = useDataQuery<any>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/payments/stripe/config`,
    noFilter: true,
  });

  useEffect(() => {
    if (configData?.publishableKey) {
      setPublishableKey(configData.publishableKey);
    }
  }, [configData]);

  // Create or get PaymentIntent
  useEffect(() => {
    if (!deliveryId) return;

    const token = localStorage.getItem("accessToken");
    fetch(
      `${import.meta.env.VITE_API_URL}/api/payments/stripe/payment-intent/${deliveryId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to initialize payment");
        setLoading(false);
      });
  }, [deliveryId]);

  // Handle Stripe redirect return (e.g., after 3DS authentication)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirectStatus = params.get("redirect_status");
    const paymentIntentId = params.get("payment_intent");

    if (redirectStatus === "succeeded" && paymentIntentId) {
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
      setClientSecret(""); // Clear to show success state
      onSuccess?.(paymentIntentId);
    } else if (redirectStatus && redirectStatus !== "succeeded") {
      // Payment failed or was cancelled after redirect
      window.history.replaceState({}, "", window.location.pathname);
      setError(
        redirectStatus === "cancelled"
          ? "Payment was cancelled"
          : "Payment failed. Please try again.",
      );
    }
  }, [onSuccess]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
        <p className="text-sm font-bold text-red-600 dark:text-red-400">{error}</p>
        <p className="text-xs text-red-500 mt-1">Payment is not available at this time.</p>
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

  const stripePromise = getStripe(publishableKey);

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <StripePaymentForm
        clientSecret={clientSecret}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
}

import React, { useState } from "react";
import { Elements, useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, RefreshCw, CreditCard } from "lucide-react";
import { getStripe } from "@/lib/stripe";
import { useDataQuery, useDataMutation } from "@/lib/tanstack/dataQuery";

// ── Inner form rendered inside <Elements> ──
function TipPaymentForm({
  clientSecret,
  tipAmount,
  driverName,
  onSuccess,
  onError,
}: {
  clientSecret: string;
  tipAmount: number;
  driverName: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname}?payment_intent=${clientSecret.split("_secret_")[0]}&redirect_status=success`,
      },
      redirect: "if_required",
    });

    if (error) {
      setMessage(error.message || "Tip payment failed");
      onError?.(error.message || "Tip payment failed");
      setLoading(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      setMessage("Tip sent!");
      setSucceeded(true);
      setLoading(false);
      onSuccess?.(paymentIntent.id);
    } else {
      setLoading(false);
    }
  };

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center p-6 text-slate-500 text-sm">
        Loading payment form...
      </div>
    );
  }

  if (succeeded) {
    return (
      <div className="flex flex-col items-center justify-center p-6 space-y-3">
        <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
          Tip Sent!
        </p>
        <p className="text-sm text-slate-500">
          ${tipAmount.toFixed(2)} tip sent to {driverName}. Thank you!
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Amount confirmation */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Tip Amount</span>
        <span className="text-lg font-black text-lime-600">${tipAmount.toFixed(2)}</span>
      </div>

      <PaymentElement />

      {message && !succeeded && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">{message}</p>
      )}

      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full py-3 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 font-extrabold text-sm"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Pay Tip ${tipAmount.toFixed(2)}
          </span>
        )}
      </Button>
    </form>
  );
}

// ── Public wrapper: fetches config + creates PaymentIntent ──
interface StripeTipPaymentWrapperProps {
  deliveryId: string;
  tipAmount: number;
  driverName: string;
  onSuccess?: (paymentIntentId: string) => void;
  onError?: (message: string) => void;
}

export default function StripeTipPaymentWrapper({
  deliveryId,
  tipAmount,
  driverName,
  onSuccess,
  onError,
}: StripeTipPaymentWrapperProps) {
  const [clientSecret, setClientSecret] = useState<string>("");
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch Stripe config
  const { data: configData } = useDataQuery<any>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/payments/stripe/config`,
    noFilter: true,
  });

  const publishableKey = configData?.publishableKey || "";

  // Create tip PaymentIntent
  const tipIntentMutation = useDataMutation<{ clientSecret: string }, { deliveryId: string; amount: number }>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/payments/stripe/tip-intent`,
    method: "POST",
    onSuccessInvalidate: false,
    onSuccess: (data) => {
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setFetchError(null);
      } else {
        setFetchError("Failed to create tip payment. Please try again.");
      }
    },
    onError: (error) => {
      setFetchError(error.message || "Failed to create tip payment.");
    },
  });

  // Auto-create intent when component mounts
  React.useEffect(() => {
    if (deliveryId && tipAmount > 0 && !clientSecret && !fetchError) {
      tipIntentMutation.mutate({ deliveryId, amount: tipAmount });
    }
  }, [deliveryId, tipAmount]);

  if (!publishableKey) {
    return (
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
        <p className="text-sm font-bold text-amber-600">Payment system not configured</p>
      </div>
    );
  }

  if (tipIntentMutation.isPending) {
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
        <button
          onClick={() => {
            setFetchError(null);
            tipIntentMutation.mutate({ deliveryId, amount: tipAmount });
          }}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 transition"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    );
  }

  const stripePromise = getStripe(publishableKey);

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <TipPaymentForm
        clientSecret={clientSecret}
        tipAmount={tipAmount}
        driverName={driverName}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
}

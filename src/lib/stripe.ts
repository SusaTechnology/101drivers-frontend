import { loadStripe, Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null>;

export function getStripe(publishableKey?: string): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey || (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY || "");
  }
  return stripePromise;
}

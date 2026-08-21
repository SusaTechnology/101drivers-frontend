import type { Stripe } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null>;

/**
 * Load Stripe.js once and cache the instance.
 * Call this inside a React component to get the stripe object for <Elements>.
 */
export function getStripe(publishableKey?: string): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(
      publishableKey ||
        (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY ||
        "",
    );
  }
  return stripePromise;
}

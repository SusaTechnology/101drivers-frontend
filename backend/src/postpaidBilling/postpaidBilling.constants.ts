// Postpaid billing constants (Option A — dealer weekly postpaid).
//
// These are referenced by:
//   • PostpaidBillingService — engine that talks to Stripe
//   • StripeWebhookController — routes invoice.* events to the engine
//   • Admin controllers — set cap / freeze / retry
//
// Keep all magic strings here so renames are safe.

// Stripe InvoiceItem metadata keys — we mirror our internal IDs back to
// Stripe so the weekly invoice PDF + dashboard can be cross-referenced
// with our DB. Stripe metadata values must be strings.
export const STRIPE_METADATA_KEYS = {
  DELIVERY_ID: "deliveryId",
  PAYMENT_ID: "paymentId",
  CUSTOMER_ID: "customerId",
  BILLING_MODE: "billingMode",
  SOURCE: "source", // always "postpaid-weekly"
} as const;

// Stripe InvoiceItem description template — what appears on each line of
// the weekly invoice PDF. The dealer sees this when they receive the
// Stripe-emailed invoice. Pickup + dropoff + distance baked in.
//
// Stripe cuts line-item descriptions at ~250 chars in some surfaces (PDF,
// email). We don't enforce a hard limit here but the engine formats the
// addresses to fit.
export const INVOICE_ITEM_DESCRIPTION_TEMPLATE =
  "Delivery #{deliveryId} — {pickup} → {dropoff} ({miles} mi) — ${amount}";

// Stripe event types we handle. Listed here so the webhook switch can
// reference them without literal-string drift.
export const STRIPE_INVOICE_EVENTS = {
  UPCOMING: "invoice.upcoming",
  FINALIZED: "invoice.finalized",
  PAYMENT_SUCCEEDED: "invoice.payment_succeeded",
  PAYMENT_FAILED: "invoice.payment_failed",
} as const;

// Postpaid billing env vars. Read at service construction so missing
// config fails fast (clear error in logs) instead of silently producing
// half-configured subscriptions.
export const POSTPAID_ENV = {
  STRIPE_POSTPAID_PRICE_ID: "STRIPE_POSTPAID_PRICE_ID",
} as const;

// Failure reasons written to Customer.billingFrozenReason. Short strings
// so admin UI can show them as-is.
export const FREEZE_REASONS = {
  CHARGE_FAILED: "Weekly Stripe charge failed — see invoice.payment_failed webhook",
  ADMIN_MANUAL: "Manually frozen by admin",
} as const;

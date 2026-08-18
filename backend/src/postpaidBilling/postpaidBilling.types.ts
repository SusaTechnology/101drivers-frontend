// Postpaid billing — DTOs and return shapes used across the engine,
// webhook, and admin controller. Keeping them in one place avoids
// duplicate type definitions in callers.

import type { EnumCustomerBillingMode, EnumPaymentStatus } from "@prisma/client";

// Pre-check result returned by canDealerCreateDelivery(). Consumed by
// the delivery-creation orchestrator before any DB writes.
export type DealerEligibilityResult = {
  ok: boolean;
  reason?:
    | "NOT_POSTPAID" // dealer is not on WEEKLY_POSTPAID billing — skip check (caller should not block)
    | "FROZEN" // billingFrozen=true — block creation
    | "NOT_APPROVED" // approvalStatus !== APPROVED — block creation
    | "NO_PAYMENT_METHOD" // no saved PM on Stripe — block creation
    | "NO_SUBSCRIPTION" // billingMode set but no stripeSubscriptionId — admin hasn't onboarded
    | "OVER_LIMIT"; // cap exceeded — block creation
  usedCents?: number;
  limitCents?: number | null;
  attemptedCents?: number;
};

// Result of setupDealerForPostpaid() — exposed for admin UI / testing.
export type SetupResult = {
  customerId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  billingMode: EnumCustomerBillingMode;
};

// Result of reportUsageToStripe() — exposed for the delivery orchestrator
// to know if reporting succeeded (continues silently on failure) or
// failed (admin should review).
export type ReportUsageResult = {
  deliveryId: string;
  paymentId: string;
  stripeInvoiceItemId: string | null;
  status: EnumPaymentStatus; // new status of the Payment row
  failureMessage?: string;
};

// Public surface of the PostpaidBillingService. Listed here so tests +
// callers can depend on the contract, not the implementation.
export type IPostpaidBillingService = {
  setupDealerForPostpaid(dealerId: string): Promise<SetupResult>;
  reportUsageToStripe(input: { deliveryId: string }): Promise<ReportUsageResult>;
  canDealerCreateDelivery(
    dealerId: string,
    amountCents: number,
  ): Promise<DealerEligibilityResult>;
  handleInvoiceUpcoming(invoiceId: string): Promise<void>;
  handleInvoicePaymentSucceeded(invoiceId: string): Promise<void>;
  handleInvoicePaymentFailed(invoiceId: string): Promise<void>;
  setCreditCap(dealerId: string, capCents: number | null): Promise<void>;
  unfreezeDealer(dealerId: string): Promise<void>;
  retryFailedCharge(dealerId: string): Promise<void>;
};

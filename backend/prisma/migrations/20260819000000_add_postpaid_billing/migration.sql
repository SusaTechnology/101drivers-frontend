-- Postpaid billing (Option A — dealer weekly postpaid via Stripe).
--
-- Adds:
--   • EnumCustomerBillingMode enum (WEEKLY_POSTPAID | PREPAID_AFTER_DELIVERY | PREPAID_INSTANT)
--   • Customer.billingMode, stripeSubscriptionId, postpaidCreditLimitCents,
--     billingFrozen, billingFrozenAt, billingFrozenReason
--   • Payment.stripeInvoiceItemId, stripeInvoiceId
--   • EnumPaymentStatus: PENDING_STRIPE_USAGE, USAGE_REPORTED, CHARGE_FAILED
--   • Indexes: Customer(billingMode, billingFrozen), Payment(stripeInvoiceId)
--
-- All new columns are nullable / have defaults, so existing rows remain valid
-- without backfill. Existing postpaid-enabled dealers keep postpaidEnabled=true
-- and can be migrated to billingMode=WEEKLY_POSTPAID via admin action or the
-- setupDealerForPostpaid() engine call.

-- 1. New enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EnumCustomerBillingMode') THEN
    CREATE TYPE "EnumCustomerBillingMode" AS ENUM (
      'WEEKLY_POSTPAID',
      'PREPAID_AFTER_DELIVERY',
      'PREPAID_INSTANT'
    );
  END IF;
END
$$;

-- 2. Customer columns
ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "billingMode" "EnumCustomerBillingMode",
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "postpaidCreditLimitCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "billingFrozen" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "billingFrozenAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "billingFrozenReason" TEXT;

-- 3. Customer index for billing-mode queries (frozen check at delivery create)
CREATE INDEX IF NOT EXISTS "Customer_billingMode_billingFrozen_idx"
  ON "Customer" ("billingMode", "billingFrozen");

-- 4. Payment columns
ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "stripeInvoiceItemId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeInvoiceId" TEXT;

-- 5. Payment index by stripeInvoiceId (used by weekly webhook to mark PAID)
CREATE INDEX IF NOT EXISTS "Payment_stripeInvoiceId_idx"
  ON "Payment" ("stripeInvoiceId");

-- 6. Extend EnumPaymentStatus with the postpaid lifecycle states.
--    Postgres requires ALTER TYPE ADD VALUE inside a transaction-safe form;
--    IF NOT EXISTS guards re-runs.
ALTER TYPE "EnumPaymentStatus" ADD VALUE IF NOT EXISTS 'PENDING_STRIPE_USAGE';
ALTER TYPE "EnumPaymentStatus" ADD VALUE IF NOT EXISTS 'USAGE_REPORTED';
ALTER TYPE "EnumPaymentStatus" ADD VALUE IF NOT EXISTS 'CHARGE_FAILED';

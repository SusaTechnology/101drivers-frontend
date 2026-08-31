-- Phase 1-4 Payment Resilience Fixes
--
-- This migration adds the schema support for multiple fixes:
--
-- Fix #1 — Usage report retry queue
--   Adds usageReportStatus / usageReportAttempts / usageReportLastError /
--   usageReportNextRetryAt columns to Payment, plus a new
--   EnumUsageReportStatus enum (PENDING / FAILED / PERMANENTLY_FAILED).
--   Used by a cron that retries failed reportUsageToStripe calls.
--
-- Fix #3 — Dispute tracking
--   Adds disputeId / disputeStatus columns to Payment so the
--   charge.dispute.closed webhook can revert REFUNDED → CAPTURED
--   when the admin wins a dispute.
--
-- Fix #4 — Webhook idempotency
--   Adds a unique stripeEventId column to PaymentEvent so Stripe
--   webhook retries don't insert duplicate audit rows.
--
-- Fix #5 — Partial refund tracking
--   Adds refundedAmountCents + refundStatus columns to Payment.
--   refundStatus is a new enum (NONE / PARTIAL / FULL). The legacy
--   `status` column still flips to REFUNDED only when FULL, so
--   existing code that reads `status` keeps working.
--
-- Fix #6 — Driver payout clawback on refund/dispute
--   New DriverPayoutAdjustment table + EnumAdjustmentStatus enum.
--   Records proportional clawbacks that get applied to the driver's
--   next payout. Reversible for the dispute-won case.
--
-- Fix #7 — Mid-trip card removal
--   Adds remainderChargeStatus / remainderAmount / remainderDueAt
--   columns to Payment. New EnumRemainderChargeStatus enum
--   (PENDING / RETRIED / UNCOLLECTIBLE). Used by a cron that retries
--   the remainder charge when the customer re-adds a card.
--
-- All new columns are nullable (or have defaults) so existing rows
-- work without backfill. New enums are created before any column
-- references them.

-- ── New enums ────────────────────────────────────────────────────

CREATE TYPE "EnumUsageReportStatus" AS ENUM ('PENDING', 'FAILED', 'PERMANENTLY_FAILED');
CREATE TYPE "EnumRefundStatus"       AS ENUM ('NONE', 'PARTIAL', 'FULL');
CREATE TYPE "EnumRemainderChargeStatus" AS ENUM ('PENDING', 'RETRIED', 'UNCOLLECTIBLE');
CREATE TYPE "EnumAdjustmentStatus"   AS ENUM ('PENDING', 'APPLIED', 'REVERSED');

-- ── Payment: new columns (Fixes #1, #3, #5, #7) ─────────────────

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "usageReportStatus"      "EnumUsageReportStatus",
  ADD COLUMN IF NOT EXISTS "usageReportAttempts"    INTEGER            NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "usageReportLastError"   TEXT,
  ADD COLUMN IF NOT EXISTS "usageReportNextRetryAt" TIMESTAMP(3);

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "refundedAmountCents"     INTEGER            NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "refundStatus"           "EnumRefundStatus" NOT NULL DEFAULT 'NONE';

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "disputeId"              TEXT,
  ADD COLUMN IF NOT EXISTS "disputeStatus"         TEXT;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "remainderChargeStatus"  "EnumRemainderChargeStatus",
  ADD COLUMN IF NOT EXISTS "remainderAmount"       DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "remainderDueAt"         TIMESTAMP(3);

-- New indexes for the cron queries
CREATE INDEX IF NOT EXISTS "Payment_usageReportStatus_usageReportNextRetryAt_idx"
  ON "Payment" ("usageReportStatus", "usageReportNextRetryAt");
CREATE INDEX IF NOT EXISTS "Payment_remainderChargeStatus_idx"
  ON "Payment" ("remainderChargeStatus");
CREATE INDEX IF NOT EXISTS "Payment_disputeId_idx"
  ON "Payment" ("disputeId");

-- ── PaymentEvent: webhook idempotency (Fix #4) ──────────────────

ALTER TABLE "PaymentEvent"
  ADD COLUMN IF NOT EXISTS "stripeEventId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentEvent_stripeEventId_key"
  ON "PaymentEvent" ("stripeEventId");

-- ── DriverPayoutAdjustment (Fix #6) ────────────────────────────

CREATE TABLE "DriverPayoutAdjustment" (
  "id"                       TEXT              NOT NULL,
  "createdAt"                TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3)      NOT NULL,
  "driverId"                 TEXT              NOT NULL,
  "deliveryId"               TEXT,
  "paymentId"                TEXT,
  "originalPayoutId"         TEXT,
  "amount"                   DOUBLE PRECISION  NOT NULL,
  "reason"                   TEXT              NOT NULL,
  "status"                   "EnumAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
  "appliedToPayoutId"        TEXT,
  "reversalOfAdjustmentId"   TEXT,
  "note"                     TEXT,
  "stripeEventId"             TEXT,

  PRIMARY KEY ("id"),
  CONSTRAINT "DriverPayoutAdjustment_driverId_fkey"
    FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DriverPayoutAdjustment_deliveryId_fkey"
    FOREIGN KEY ("deliveryId") REFERENCES "DeliveryRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "DriverPayoutAdjustment_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "DriverPayoutAdjustment_originalPayoutId_fkey"
    FOREIGN KEY ("originalPayoutId") REFERENCES "DriverPayout" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "DriverPayoutAdjustment_appliedToPayoutId_fkey"
    FOREIGN KEY ("appliedToPayoutId") REFERENCES "DriverPayout" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "DriverPayoutAdjustment_reversalOfAdjustmentId_fkey"
    FOREIGN KEY ("reversalOfAdjustmentId") REFERENCES "DriverPayoutAdjustment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DriverPayoutAdjustment_driverId_status_idx"
  ON "DriverPayoutAdjustment" ("driverId", "status");
CREATE INDEX IF NOT EXISTS "DriverPayoutAdjustment_deliveryId_idx"
  ON "DriverPayoutAdjustment" ("deliveryId");
CREATE INDEX IF NOT EXISTS "DriverPayoutAdjustment_paymentId_idx"
  ON "DriverPayoutAdjustment" ("paymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "DriverPayoutAdjustment_stripeEventId_key"
  ON "DriverPayoutAdjustment" ("stripeEventId");

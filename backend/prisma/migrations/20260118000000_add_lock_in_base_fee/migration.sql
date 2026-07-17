-- Lock-in Base Fee Feature
--
-- When a driver taps "Start Trip" (BOOKED → ACTIVE), we immediately capture
-- the existing auth-hold PaymentIntent for the quote's `baseFee` amount
-- (partial capture). The driver's % share of that fee is recorded as a
-- LOCK_IN_FEE DriverPayout and stays ELIGIBLE no matter what happens next
-- (cancellation, completion, etc.). At completion a *new* PaymentIntent is
-- created for the remainder (fullQuote − baseFee).
--
-- All new columns are nullable / have defaults so existing rows continue
-- to work (legacy single-PI flow when lockInBaseFee is NULL or 0).

-- ── DeliveryRequest: lock-in stamps written at trip start ────────────
ALTER TABLE "DeliveryRequest"
  ADD COLUMN "lockedInAt"              TIMESTAMP(3),
  ADD COLUMN "lockInBaseFee"           DOUBLE PRECISION,
  ADD COLUMN "lockInDriverSharePct"    DOUBLE PRECISION,
  ADD COLUMN "lockInPaymentIntentId"   TEXT,
  ADD COLUMN "lockInChargeId"          TEXT;

-- ── Payment: lock-in charge reference (PI #1 partial capture) ────────
ALTER TABLE "Payment"
  ADD COLUMN "lockInPaymentIntentId"   TEXT,
  ADD COLUMN "lockInChargeId"          TEXT,
  ADD COLUMN "lockInAmount"            DOUBLE PRECISION;

-- ── DriverPayout: type discriminator (TRIP_COMPLETION vs LOCK_IN_FEE) ─
CREATE TYPE "EnumDriverPayoutType" AS ENUM (
  'TRIP_COMPLETION',
  'LOCK_IN_FEE',
  'BONUS',
  'ADJUSTMENT'
);

ALTER TABLE "DriverPayout"
  ADD COLUMN "type" TEXT NOT NULL DEFAULT 'TRIP_COMPLETION';

ALTER TABLE "DriverPayout"
  ALTER COLUMN "type" TYPE "EnumDriverPayoutType"
  USING "type"::"EnumDriverPayoutType";

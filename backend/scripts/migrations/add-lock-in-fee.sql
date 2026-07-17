-- Migration: Add lock-in fee infrastructure
--
-- Implements the "lock-in base fee" feature: when a driver starts a trip,
-- the customer's existing auth hold is partially captured for the amount of
-- `PricingConfig.baseFee`. The driver immediately becomes eligible for a
-- minimum payout equal to their % share of that base fee. The remainder of
-- the quoted price is captured on a NEW PaymentIntent at trip completion.
--
-- If the trip is cancelled AFTER start, the base fee charge stays (no refund)
-- and the driver keeps the lock-in payout. If cancelled BEFORE start, the
-- legacy full-refund / $0-payout behavior is preserved.
--
-- Behavior is gated on `Quote.pricingSnapshot.baseFee` being > 0 at start
-- time. PER_MILE pricing configs always have a baseFee. FLAT_TIER and
-- CATEGORY_ABC configs may have a null/zero baseFee → no lock-in (legacy).
--
-- This migration is safe and idempotent. All new columns are nullable.
-- No data is lost; existing rows simply get NULL values, which the engine
-- treats as "no lock-in" (legacy behavior).
--
-- IMPORTANT: After running this, restart all backend connections
-- (pm2 stop + sleep 5 + pm2 start) because existing connections cache
-- the old enum metadata.
--
-- Usage:
--   psql -U <user> -d <database> -f add-lock-in-fee.sql
-- Or via Prisma:
--   npx prisma db execute --file scripts/migrations/add-lock-in-fee.sql --schema prisma/schema.prisma

-- ============================================================
-- Step 1: Add lock-in snapshot columns to DeliveryRequest
-- ============================================================
-- These are stamped at startTrip time. They snapshot the values in effect
-- when the trip started, so later PricingConfig edits don't retroactively
-- change money already moved.

ALTER TABLE "DeliveryRequest"
  ADD COLUMN IF NOT EXISTS "lockedInAt" TIMESTAMP(3);

ALTER TABLE "DeliveryRequest"
  ADD COLUMN IF NOT EXISTS "lockInBaseFee" DOUBLE PRECISION;

ALTER TABLE "DeliveryRequest"
  ADD COLUMN IF NOT EXISTS "lockInDriverSharePct" DOUBLE PRECISION;

ALTER TABLE "DeliveryRequest"
  ADD COLUMN IF NOT EXISTS "lockInPaymentIntentId" TEXT;

ALTER TABLE "DeliveryRequest"
  ADD COLUMN IF NOT EXISTS "lockInChargeId" TEXT;

-- ============================================================
-- Step 2: Add lock-in tracking columns to Payment
-- ============================================================
-- Payment.providerPaymentIntentId / providerChargeId continue to refer to
-- the "current" PaymentIntent. For lock-in deliveries, after start, those
-- fields still refer to PI #1 (the partially-captured one). At completion,
-- they're updated to point to PI #2 (the new one for the remainder).
-- The lockIn* columns preserve PI #1's IDs for audit/refund purposes.

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "lockInPaymentIntentId" TEXT;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "lockInChargeId" TEXT;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "lockInAmount" DOUBLE PRECISION;

-- ============================================================
-- Step 3: Add DriverPayout.type enum
-- ============================================================
-- Allows finance reports to distinguish lock-in payouts (created at start)
-- from normal completion payouts.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EnumDriverPayoutType') THEN
    CREATE TYPE "EnumDriverPayoutType" AS ENUM (
      'TRIP_COMPLETION',
      'LOCK_IN_FEE',
      'BONUS',
      'ADJUSTMENT'
    );
  END IF;
END
$$;

-- Add the column with a default of TRIP_COMPLETION so existing rows are
-- treated as legacy payouts.
ALTER TABLE "DriverPayout"
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'TRIP_COMPLETION';

-- Convert the text column to the enum type. Existing values are all
-- 'TRIP_COMPLETION' (from the default above), so the cast is safe.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'DriverPayout'
      AND column_name = 'type'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE "DriverPayout"
      ALTER COLUMN "type" TYPE "EnumDriverPayoutType"
      USING "type"::"EnumDriverPayoutType";
    ALTER TABLE "DriverPayout"
      ALTER COLUMN "type" SET DEFAULT 'TRIP_COMPLETION'::"EnumDriverPayoutType";
  END IF;
END
$$;

-- ============================================================
-- Step 4: Verify the migration
-- ============================================================
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('DeliveryRequest', 'Payment', 'DriverPayout')
  AND column_name LIKE 'lockIn%'
ORDER BY table_name, column_name;

SELECT typname, enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'EnumDriverPayoutType'
ORDER BY e.enumsortorder;

-- Referral tier payout safety: add tierNumber column + unique constraint.
--
-- Adds a `tierNumber` column to DriverPayout to identify which referrer
-- tier a REFERRAL_REFERRER payout rewards (1 = first N successful,
-- 2 = second N, etc.). Combined with the @@unique([driverId, type, tierNumber])
-- constraint, this prevents duplicate referrer tier payouts under race
-- conditions: if two trigger calls fire simultaneously when a referrer
-- crosses a tier boundary, only one will succeed in creating the
-- DriverPayout row; the other gets a unique-constraint error which
-- the application catches and treats as "already paid, fetch existing".
--
-- NULL for non-REFERRAL_REFERRER payouts (TRIP_COMPLETION, LOCK_IN_FEE,
-- BONUS, ADJUSTMENT, REFERRAL_REFERRED). Postgres treats NULLs as
-- distinct in unique constraints, so those rows don't conflict.

-- 1. Add tierNumber column (nullable Int)
ALTER TABLE "DriverPayout"
  ADD COLUMN IF NOT EXISTS "tierNumber" INTEGER;

-- 2. Add unique constraint on (driverId, type, tierNumber)
--    Postgres default for unique constraints: NULLs are distinct, so
--    rows with tierNumber = NULL don't conflict.
ALTER TABLE "DriverPayout"
  DROP CONSTRAINT IF EXISTS "DriverPayout_driverId_type_tierNumber_key";
ALTER TABLE "DriverPayout"
  ADD CONSTRAINT "DriverPayout_driverId_type_tierNumber_key"
  UNIQUE ("driverId", "type", "tierNumber");

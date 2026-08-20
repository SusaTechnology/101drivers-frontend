-- Migration: Add flatMiles column to PricingConfig
--
-- Adds an optional "free miles included" allowance to the PricingConfig table.
-- When pricingMode = PER_MILE and flatMiles is non-null, the pricing engine
-- computes the distance charge as:
--     distance_charge = max(0, miles - flatMiles) * perMileRate
-- When flatMiles is NULL or 0, behavior is unchanged (charge from mile 0).
--
-- This was previously only a manual SQL script (backend/scripts/migrations/
-- add-flat-miles.sql) and was never wired into the Prisma migration history.
-- As a result, fresh environments (and any DB that didn't run the manual
-- script) were missing the column entirely — causing the API to silently
-- drop flatMiles from the response and the pricing engine to fall back to
-- 0 (charge per-mile from mile 0).
--
-- This migration is idempotent: safe to re-run on databases that already
-- have the column from the manual script.

-- 1. Add nullable flatMiles column (DOUBLE PRECISION = Float? in Prisma).
ALTER TABLE "PricingConfig"
  ADD COLUMN IF NOT EXISTS "flatMiles" DOUBLE PRECISION;

-- 2. Verify column exists.
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'PricingConfig'
  AND column_name = 'flatMiles';

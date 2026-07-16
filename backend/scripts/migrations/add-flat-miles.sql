-- Migration: Add flatMiles column to PricingConfig
--
-- Adds an optional "free miles included" allowance to the PricingConfig table.
-- When pricingMode = PER_MILE and flatMiles is non-null, the pricing engine
-- computes the distance charge as:
--     distance_charge = max(0, miles - flatMiles) * perMileRate
-- When flatMiles is NULL or 0, behavior is unchanged (charge from mile 0).
--
-- This migration is safe and idempotent. No data is lost; existing configs
-- simply get NULL flatMiles, which is treated as 0 by the engine.
--
-- No connection-restart caveat applies here (column add only, no enum change).
--
-- Usage:
--   psql -U <user> -d <database> -f add-flat-miles.sql
-- Or via Prisma:
--   npx prisma db execute --file scripts/migrations/add-flat-miles.sql --schema prisma/schema.prisma

-- Step 1: Add nullable flatMiles column
ALTER TABLE "PricingConfig"
  ADD COLUMN IF NOT EXISTS "flatMiles" DOUBLE PRECISION;

-- Step 2: Verify column exists
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'PricingConfig'
  AND column_name = 'flatMiles';

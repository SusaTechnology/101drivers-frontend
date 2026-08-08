-- Migration: Reset pricing configs to the two supported models only.
--
-- Background:
--   The platform now supports exactly two pricing models:
--     1. ABC (progressive tiered) — schema name CATEGORY_ABC
--     2. Flat (with extra mileage) — schema name PER_MILE
--   The legacy FLAT_TIER mode is DEPRECATED: hidden from the admin UI and
--   its backend calculation branch is disabled. Existing FLAT_TIER configs
--   in the DB will be calculated as PER_MILE (Flat) at quote time.
--
-- This migration:
--   1. Deletes ALL existing pricing configs (and their cascaded tiers + rules).
--   2. Creates exactly two fresh configs with the user-supplied seed values:
--        - "ABC Pricing"  (CATEGORY_ABC, isDefault = true)
--        - "Flat Pricing" (PER_MILE,    isDefault = false)
--   3. Re-assigns any customers that pointed at a deleted config to the new
--      ABC default (so no customer is left orphaned).
--
-- Run with: psql $DATABASE_URL -f backend/scripts/migrations/reset-pricing-configs.sql
-- Idempotent: safe to re-run (deletes everything first).

BEGIN;

-- 1. Detach any customers currently pointing at a pricing config.
UPDATE "Customer"
SET "pricingConfigId" = NULL
WHERE "pricingConfigId" IS NOT NULL;

-- 2. Delete all existing pricing configs (cascade handles tiers + categoryRules).
DELETE FROM "PricingConfig";

-- 3. Create the two seed configs.
-- 3a. ABC (progressive tiered) — DEFAULT.
INSERT INTO "PricingConfig" (
  "id", "name", "description", "active", "isDefault",
  "pricingMode", "baseFee", "flatMiles", "perMileRate",
  "insuranceFee", "driverSharePct", "feePassThrough",
  "transactionFeeFixed", "transactionFeePct",
  "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(),
  'ABC Pricing',
  'Progressive tiered: $50 base + A(0-25 @ $2.00) + B(25-50 @ $1.80) + C(50+ @ $1.75). 15mi->$80, 25mi->$100, 50mi->$145, 100mi->$232.50.',
  true,  -- active
  true,  -- isDefault (only this row)
  'CATEGORY_ABC',
  50.00,  -- baseFee
  NULL,   -- flatMiles (ABC doesn't use it)
  NULL,   -- perMileRate (ABC doesn't use it; bands carry their own rates)
  8.00,   -- insuranceFee
  60.00,  -- driverSharePct
  true,   -- feePassThrough
  3.00,   -- transactionFeeFixed
  2.90,   -- transactionFeePct
  NOW(), NOW()
);

-- 3b. Flat (with extra mileage) — schema name PER_MILE.
INSERT INTO "PricingConfig" (
  "id", "name", "description", "active", "isDefault",
  "pricingMode", "baseFee", "flatMiles", "perMileRate",
  "insuranceFee", "driverSharePct", "feePassThrough",
  "transactionFeeFixed", "transactionFeePct",
  "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(),
  'Flat Pricing',
  'Flat with extra mileage: $101 covers first 25 mi, then $1.80/mi. 15mi->$101, 25mi->$101, 50mi->$146, 100mi->$236.',
  true,  -- active
  false, -- isDefault
  'PER_MILE',
  101.00, -- baseFee
  25.00,  -- flatMiles (free miles included in base)
  1.80,   -- perMileRate (applied to miles beyond flatMiles)
  8.00,   -- insuranceFee
  60.00,  -- driverSharePct
  true,   -- feePassThrough
  3.00,   -- transactionFeeFixed
  2.90,   -- transactionFeePct
  NOW(), NOW()
);

-- 4. Add the 3 ABC category rules (bands) for the ABC config.
INSERT INTO "PricingCategoryRule" (
  "id", "pricingConfigId", "category", "minMiles", "maxMiles",
  "baseFee", "perMileRate", "flatPrice",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  pc.id,
  'A', 0.00, 25.00,
  NULL, 2.00, NULL,
  NOW(), NOW()
FROM "PricingConfig" pc
WHERE pc."pricingMode" = 'CATEGORY_ABC' AND pc."isDefault" = true
UNION ALL
SELECT
  gen_random_uuid(),
  pc.id,
  'B', 25.00, 50.00,
  NULL, 1.80, NULL,
  NOW(), NOW()
FROM "PricingConfig" pc
WHERE pc."pricingMode" = 'CATEGORY_ABC' AND pc."isDefault" = true
UNION ALL
SELECT
  gen_random_uuid(),
  pc.id,
  'C', 50.00, NULL,
  NULL, 1.75, NULL,
  NOW(), NOW()
FROM "PricingConfig" pc
WHERE pc."pricingMode" = 'CATEGORY_ABC' AND pc."isDefault" = true;

-- 5. Ensure exactly one config has isDefault = true (safety net).
UPDATE "PricingConfig" SET "isDefault" = false
WHERE "id" NOT IN (
  SELECT "id" FROM "PricingConfig"
  WHERE "pricingMode" = 'CATEGORY_ABC' AND "name" = 'ABC Pricing'
  LIMIT 1
);
UPDATE "PricingConfig" SET "isDefault" = true
WHERE "pricingMode" = 'CATEGORY_ABC' AND "name" = 'ABC Pricing';

COMMIT;

-- Verification queries (run manually to confirm):
-- SELECT "name", "pricingMode", "isDefault", "active" FROM "PricingConfig";
-- SELECT "category", "minMiles", "maxMiles", "perMileRate" FROM "PricingCategoryRule" ORDER BY "category";

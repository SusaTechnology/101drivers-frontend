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
-- Strategy:
--   Prefer UPDATE-in-place over DELETE-then-reinsert so we preserve:
--     - PricingConfig IDs (so Customer.pricingConfigId links stay valid)
--     - createdAt timestamps (audit trail)
--     - Avoids FK constraint violations on PricingCategoryRule / Customer
--
--   For each of the two target modes (CATEGORY_ABC, PER_MILE):
--     a. If a config of that mode already exists → UPDATE it in place.
--     b. If none exists → INSERT a new one.
--   Then for any EXTRA configs (the user had 5, wants 2), delete their
--   children first (PricingCategoryRule, PricingTier) and detach any
--   Customer references before deleting the parent — Prisma's default
--   FK constraint is ON DELETE NO ACTION, so we MUST do this in order.
--
--   Finally, replace the kept ABC config's categoryRules with the correct
--   3-band structure (A:0-25@$2, B:25-50@$1.80, C:50+@$1.75).
--
-- Run with: psql $DATABASE_URL -f backend/scripts/migrations/reset-pricing-configs.sql
-- Idempotent: safe to re-run.

BEGIN;

-- ───────────────────────────────────────────────────────────────────
-- STEP 1: Detach customers from configs that will be DELETED.
--
-- We want to keep one CATEGORY_ABC config and one PER_MILE config.
-- Any customer whose pricingConfigId points at a config NOT in that
-- keep-set gets detached (set to NULL). They will then fall through
-- to the default config (the ABC one we promote in step 6).
--
-- We can't know the keep-IDs ahead of time, so we use a subquery:
-- keep the FIRST (by createdAt) CATEGORY_ABC and FIRST PER_MILE.
-- ───────────────────────────────────────────────────────────────────
UPDATE "Customer"
SET "pricingConfigId" = NULL
WHERE "pricingConfigId" IS NOT NULL
  AND "pricingConfigId" NOT IN (
    SELECT id FROM (
      (SELECT id, "pricingMode", "createdAt"
         FROM "PricingConfig"
        WHERE "pricingMode" = 'CATEGORY_ABC'
        ORDER BY "createdAt" ASC
        LIMIT 1)
      UNION ALL
      (SELECT id, "pricingMode", "createdAt"
         FROM "PricingConfig"
        WHERE "pricingMode" = 'PER_MILE'
        ORDER BY "createdAt" ASC
        LIMIT 1)
    ) AS keep_ids
  );

-- ───────────────────────────────────────────────────────────────────
-- STEP 2: Delete children of the configs we're about to remove.
--
-- Prisma's default FK constraint is ON DELETE NO ACTION, so we MUST
-- delete PricingCategoryRule and PricingTier rows BEFORE deleting
-- their parent PricingConfig. We delete only the children of configs
-- that are NOT in our keep-set.
-- ───────────────────────────────────────────────────────────────────
DELETE FROM "PricingCategoryRule"
WHERE "pricingConfigId" IN (
  SELECT id FROM "PricingConfig"
  WHERE id NOT IN (
    SELECT id FROM (
      (SELECT id FROM "PricingConfig"
        WHERE "pricingMode" = 'CATEGORY_ABC'
        ORDER BY "createdAt" ASC LIMIT 1)
      UNION ALL
      (SELECT id FROM "PricingConfig"
        WHERE "pricingMode" = 'PER_MILE'
        ORDER BY "createdAt" ASC LIMIT 1)
    ) AS keep_ids
  )
);

DELETE FROM "PricingTier"
WHERE "pricingConfigId" IN (
  SELECT id FROM "PricingConfig"
  WHERE id NOT IN (
    SELECT id FROM (
      (SELECT id FROM "PricingConfig"
        WHERE "pricingMode" = 'CATEGORY_ABC'
        ORDER BY "createdAt" ASC LIMIT 1)
      UNION ALL
      (SELECT id FROM "PricingConfig"
        WHERE "pricingMode" = 'PER_MILE'
        ORDER BY "createdAt" ASC LIMIT 1)
    ) AS keep_ids
  )
);

-- ───────────────────────────────────────────────────────────────────
-- STEP 3: Delete the unwanted PricingConfig rows themselves.
-- Now that their children are gone, the FK constraint passes.
-- ───────────────────────────────────────────────────────────────────
DELETE FROM "PricingConfig"
WHERE id NOT IN (
  SELECT id FROM (
    (SELECT id FROM "PricingConfig"
      WHERE "pricingMode" = 'CATEGORY_ABC'
      ORDER BY "createdAt" ASC LIMIT 1)
    UNION ALL
    (SELECT id FROM "PricingConfig"
      WHERE "pricingMode" = 'PER_MILE'
      ORDER BY "createdAt" ASC LIMIT 1)
  ) AS keep_ids
);

-- ───────────────────────────────────────────────────────────────────
-- STEP 4: UPSERT the ABC config (in place if it exists, else insert).
-- ───────────────────────────────────────────────────────────────────
INSERT INTO "PricingConfig" (
  "id", "name", "description", "active", "isDefault",
  "pricingMode", "baseFee", "flatMiles", "perMileRate",
  "insuranceFee", "driverSharePct", "feePassThrough",
  "transactionFeeFixed", "transactionFeePct",
  "createdAt", "updatedAt"
)
SELECT
  COALESCE(
    (SELECT id FROM "PricingConfig"
      WHERE "pricingMode" = 'CATEGORY_ABC'
      ORDER BY "createdAt" ASC LIMIT 1),
    gen_random_uuid()
  ),
  'ABC Pricing',
  'Progressive tiered: $50 base + A(0-25 @ $2.00) + B(25-50 @ $1.80) + C(50+ @ $1.75). 15mi->$80, 25mi->$100, 50mi->$145, 100mi->$232.50.',
  true,  -- active
  true,  -- isDefault (only this row)
  'CATEGORY_ABC',
  50.00, NULL, NULL,
  8.00, 60.00, true,
  3.00, 2.90,
  COALESCE(
    (SELECT "createdAt" FROM "PricingConfig"
      WHERE "pricingMode" = 'CATEGORY_ABC'
      ORDER BY "createdAt" ASC LIMIT 1),
    NOW()
  ),
  NOW()
ON CONFLICT (id) DO UPDATE SET
  "name"              = EXCLUDED."name",
  "description"       = EXCLUDED."description",
  "active"            = EXCLUDED."active",
  "isDefault"         = EXCLUDED."isDefault",
  "pricingMode"       = EXCLUDED."pricingMode",
  "baseFee"           = EXCLUDED."baseFee",
  "flatMiles"         = EXCLUDED."flatMiles",
  "perMileRate"       = EXCLUDED."perMileRate",
  "insuranceFee"      = EXCLUDED."insuranceFee",
  "driverSharePct"    = EXCLUDED."driverSharePct",
  "feePassThrough"    = EXCLUDED."feePassThrough",
  "transactionFeeFixed" = EXCLUDED."transactionFeeFixed",
  "transactionFeePct"   = EXCLUDED."transactionFeePct",
  "updatedAt"         = NOW();

-- ───────────────────────────────────────────────────────────────────
-- STEP 5: UPSERT the Flat (PER_MILE) config.
-- ───────────────────────────────────────────────────────────────────
INSERT INTO "PricingConfig" (
  "id", "name", "description", "active", "isDefault",
  "pricingMode", "baseFee", "flatMiles", "perMileRate",
  "insuranceFee", "driverSharePct", "feePassThrough",
  "transactionFeeFixed", "transactionFeePct",
  "createdAt", "updatedAt"
)
SELECT
  COALESCE(
    (SELECT id FROM "PricingConfig"
      WHERE "pricingMode" = 'PER_MILE'
      ORDER BY "createdAt" ASC LIMIT 1),
    gen_random_uuid()
  ),
  'Flat Pricing',
  'Flat with extra mileage: $101 covers first 25 mi, then $1.80/mi. 15mi->$101, 25mi->$101, 50mi->$146, 100mi->$236.',
  true,  -- active
  false, -- isDefault
  'PER_MILE',
  101.00, 25.00, 1.80,
  8.00, 60.00, true,
  3.00, 2.90,
  COALESCE(
    (SELECT "createdAt" FROM "PricingConfig"
      WHERE "pricingMode" = 'PER_MILE'
      ORDER BY "createdAt" ASC LIMIT 1),
    NOW()
  ),
  NOW()
ON CONFLICT (id) DO UPDATE SET
  "name"              = EXCLUDED."name",
  "description"       = EXCLUDED."description",
  "active"            = EXCLUDED."active",
  "isDefault"         = EXCLUDED."isDefault",
  "pricingMode"       = EXCLUDED."pricingMode",
  "baseFee"           = EXCLUDED."baseFee",
  "flatMiles"         = EXCLUDED."flatMiles",
  "perMileRate"       = EXCLUDED."perMileRate",
  "insuranceFee"      = EXCLUDED."insuranceFee",
  "driverSharePct"    = EXCLUDED."driverSharePct",
  "feePassThrough"    = EXCLUDED."feePassThrough",
  "transactionFeeFixed" = EXCLUDED."transactionFeeFixed",
  "transactionFeePct"   = EXCLUDED."transactionFeePct",
  "updatedAt"         = NOW();

-- ───────────────────────────────────────────────────────────────────
-- STEP 6: Replace the ABC config's categoryRules with the 3 correct
-- bands (A:0-25@$2, B:25-50@$1.80, C:50+@$1.75).
--
-- We DELETE the existing rules first because the band boundaries or
-- rates may have changed (e.g. legacy configs had per-rule baseFee
-- values that the new progressive-tiered math ignores).
-- ───────────────────────────────────────────────────────────────────
DELETE FROM "PricingCategoryRule"
WHERE "pricingConfigId" = (
  SELECT id FROM "PricingConfig"
  WHERE "pricingMode" = 'CATEGORY_ABC'
  ORDER BY "createdAt" ASC LIMIT 1
);

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
WHERE pc."pricingMode" = 'CATEGORY_ABC'
UNION ALL
SELECT
  gen_random_uuid(),
  pc.id,
  'B', 25.00, 50.00,
  NULL, 1.80, NULL,
  NOW(), NOW()
FROM "PricingConfig" pc
WHERE pc."pricingMode" = 'CATEGORY_ABC'
UNION ALL
SELECT
  gen_random_uuid(),
  pc.id,
  'C', 50.00, NULL,
  NULL, 1.75, NULL,
  NOW(), NOW()
FROM "PricingConfig" pc
WHERE pc."pricingMode" = 'CATEGORY_ABC';

-- ───────────────────────────────────────────────────────────────────
-- STEP 7: Ensure exactly ONE config has isDefault=true (the ABC one).
-- Any other row that might have isDefault=true gets flipped off so the
-- loadLatestActivePricingConfig() fallback resolves deterministically.
-- ───────────────────────────────────────────────────────────────────
UPDATE "PricingConfig" SET "isDefault" = false
WHERE "pricingMode" <> 'CATEGORY_ABC'
   OR "name" <> 'ABC Pricing';

UPDATE "PricingConfig" SET "isDefault" = true
WHERE "pricingMode" = 'CATEGORY_ABC' AND "name" = 'ABC Pricing';

COMMIT;

-- ───────────────────────────────────────────────────────────────────
-- Verification queries (run manually to confirm):
-- ───────────────────────────────────────────────────────────────────
-- SELECT "id", "name", "pricingMode", "isDefault", "active", "baseFee", "flatMiles", "perMileRate"
-- FROM "PricingConfig" ORDER BY "pricingMode";
--
-- SELECT pc."name", pcr."category", pcr."minMiles", pcr."maxMiles", pcr."perMileRate"
-- FROM "PricingCategoryRule" pcr
-- JOIN "PricingConfig" pc ON pc.id = pcr."pricingConfigId"
-- ORDER BY pc."name", pcr."category";
--
-- SELECT COUNT(*) AS orphaned_customers FROM "Customer" WHERE "pricingConfigId" IS NULL;

-- Migration: Add isDefault flag to PricingConfig.
--
-- The pricing engine's loadLatestActivePricingConfig() now prefers a config
-- marked isDefault=true; falls back to most-recent-active otherwise.
-- This column lets admins designate one canonical default config without
-- relying solely on `active` + `createdAt` ordering.
--
-- Idempotent: safe to re-run.

-- 1. Add column with default=false so existing rows are non-default.
ALTER TABLE "PricingConfig"
  ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- 2. Index for fast lookup of the default config.
CREATE INDEX IF NOT EXISTS "PricingConfig_isDefault_idx"
  ON "PricingConfig" ("isDefault");

-- 3. Safety net: ensure at most one row has isDefault=true. If multiple rows
--    happen to be true (e.g. after manual edits), keep only the most recent
--    one and clear the rest.
UPDATE "PricingConfig" SET "isDefault" = false
WHERE "id" NOT IN (
  SELECT "id" FROM "PricingConfig"
  WHERE "isDefault" = true
  ORDER BY "updatedAt" DESC
  LIMIT 1
)
AND "isDefault" = true;

-- 4. If NO config is marked default, promote the most-recent-active one.
UPDATE "PricingConfig" SET "isDefault" = true
WHERE "id" IN (
  SELECT "id" FROM "PricingConfig"
  WHERE "isDefault" = false
    AND "active" = true
    AND NOT EXISTS (SELECT 1 FROM "PricingConfig" WHERE "isDefault" = true)
  ORDER BY "createdAt" DESC
  LIMIT 1
);

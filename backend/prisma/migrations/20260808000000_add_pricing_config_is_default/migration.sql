-- Add isDefault column to PricingConfig.
--
-- Separates "this is the default config to use when no customer-specific
-- config is set" (isDefault) from "this config is currently usable"
-- (active). Previously the engine conflated the two by setting active=false
-- on every other config when a new default was saved — that broke the
-- ability to have multiple active configs in the system.
--
-- The pricing engine's loadLatestActivePricingConfig() now prefers
-- where: { active: true, isDefault: true } first, falling back to the
-- legacy "most recently created active config" behavior if no default
-- is set (so existing installations keep working until an admin picks one).
--
-- Also seed the column: if there's at least one active PricingConfig and
-- none is marked default, mark the most recently created one as default
-- so the engine's new preferred-lookup path finds a row on day one.

ALTER TABLE "PricingConfig"
  ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "PricingConfig_isDefault_idx"
  ON "PricingConfig" ("isDefault");

-- Seed: pick the most recently created active config (if any) as default,
-- but ONLY if no row is already marked default. Idempotent.
UPDATE "PricingConfig" SET "isDefault" = true
  WHERE id = (
    SELECT id FROM "PricingConfig"
      WHERE "active" = true
      ORDER BY "createdAt" DESC
      LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM "PricingConfig" WHERE "isDefault" = true
  );

-- Referral category snapshot: which payout program (driver / business /
-- residential referral) each referral belongs to. Stamped at apply time;
-- null for legacy rows (trigger engine falls back to legacy behavior).
CREATE TYPE "EnumReferralCategory" AS ENUM (
  'DRIVER_REFERRAL',
  'BUSINESS_REFERRAL',
  'RESIDENTIAL_REFERRAL'
);

ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "category" "EnumReferralCategory";

-- Backfill existing rows: referrals with a referred driver are driver
-- referrals; referrals with a referred customer are categorized by that
-- customer's CURRENT type (best-effort — historical rows only).
UPDATE "Referral" r
SET "category" = 'DRIVER_REFERRAL'
WHERE r."referredDriverId" IS NOT NULL AND r."category" IS NULL;

UPDATE "Referral" r
SET "category" = 'BUSINESS_REFERRAL'
WHERE r."referredCustomerId" IS NOT NULL
  AND r."category" IS NULL
  AND EXISTS (
    SELECT 1 FROM "Customer" c
    WHERE c."id" = r."referredCustomerId" AND c."customerType" = 'BUSINESS'
  );

UPDATE "Referral" r
SET "category" = 'RESIDENTIAL_REFERRAL'
WHERE r."referredCustomerId" IS NOT NULL
  AND r."category" IS NULL
  AND EXISTS (
    SELECT 1 FROM "Customer" c
    WHERE c."id" = r."referredCustomerId" AND c."customerType" = 'PRIVATE'
  );

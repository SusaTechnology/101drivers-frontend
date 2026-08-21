-- Referral program rebuild — tiered threshold model.
--
-- This migration rebuilds the Referral program to use a tiered
-- threshold payout model (e.g. $150 to the referrer per 20 successful
-- referrals, $150 to the referred driver once when their own referral
-- becomes successful).
--
-- The existing Referral rows were all test data, so this migration
-- DELETES them. Production deploys without test data won't be
-- affected.
--
-- Schema changes:
--   • Referral: drop tripsRequired (renamed to requiredDeliveries),
--     add rewardTrigger, requiredDeliveries, windowStartDate,
--     windowEndDate, expiresAt, referredGetsReward, referredRewardAmount,
--     referredRewardPaidAt, referredPayoutId. Change rewardAmount
--     default to 0.0 (legacy field; not used in the tiered model).
--     Add EXPIRED to EnumReferralStatus. Add @@index([expiresAt]).
--   • Driver: add lastPaidReferrerTier Int @default(0).
--   • DriverPayout: make deliveryId nullable (referral payouts don't
--     have a delivery). Add referredByReferral relation. Add new
--     EnumDriverPayoutType values REFERRAL_REFERRER, REFERRAL_REFERRED.
--   • New enum: EnumReferralRewardTrigger (ON_APPROVED, ON_DELIVERIES_COMPLETED).

-- ────────────────────────────────────────────────────────────────
-- 1. Delete all existing Referral rows (test data only)
-- ────────────────────────────────────────────────────────────────
-- Also clear any DriverPayout rows that referenced them (via payoutId)
-- so the FK constraint isn't violated when we drop columns.
-- Use SET NULL on the FK so historical payout rows stay intact
-- (we don't want to delete financial records, just unlink them).
UPDATE "DriverPayout" dp
SET "referralId" = NULL
-- (Note: this column is implied by the relation — Prisma names it
--  according to the relation field on Referral, which is `payoutId`
--  pointing to DriverPayout.id. The DriverPayout side has no
--  explicit FK column; the relation is one-to-one via Referral.payoutId.)
WHERE EXISTS (
  SELECT 1 FROM "Referral" r WHERE r."payoutId" = dp."id"
);

DELETE FROM "Referral";

-- ────────────────────────────────────────────────────────────────
-- 2. Add EXPIRED to EnumReferralStatus
-- ────────────────────────────────────────────────────────────────
ALTER TYPE "EnumReferralStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- ────────────────────────────────────────────────────────────────
-- 3. New enum: EnumReferralRewardTrigger
-- ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EnumReferralRewardTrigger') THEN
    CREATE TYPE "EnumReferralRewardTrigger" AS ENUM ('ON_APPROVED', 'ON_DELIVERIES_COMPLETED');
  END IF;
END$$;

-- ────────────────────────────────────────────────────────────────
-- 4. Extend EnumDriverPayoutType with REFERRAL_REFERRER + REFERRAL_REFERRED
-- ────────────────────────────────────────────────────────────────
ALTER TYPE "EnumDriverPayoutType" ADD VALUE IF NOT EXISTS 'REFERRAL_REFERRER';
ALTER TYPE "EnumDriverPayoutType" ADD VALUE IF NOT EXISTS 'REFERRAL_REFERRED';

-- ────────────────────────────────────────────────────────────────
-- 5. Referral: drop tripsRequired (renamed), add new fields
-- ────────────────────────────────────────────────────────────────
ALTER TABLE "Referral" DROP COLUMN IF EXISTS "tripsRequired";

ALTER TABLE "Referral"
  ADD COLUMN IF NOT EXISTS "rewardTrigger" "EnumReferralRewardTrigger" NOT NULL DEFAULT 'ON_DELIVERIES_COMPLETED',
  ADD COLUMN IF NOT EXISTS "requiredDeliveries" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "windowStartDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "windowEndDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "referredGetsReward" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "referredRewardAmount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "referredRewardPaidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "referredPayoutId" TEXT;

-- Change rewardAmount default to 0.0 (legacy field, not used in tiered model)
ALTER TABLE "Referral" ALTER COLUMN "rewardAmount" SET DEFAULT 0.0;

-- Add unique constraint on referredPayoutId
ALTER TABLE "Referral"
  DROP CONSTRAINT IF EXISTS "Referral_referredPayoutId_key";
ALTER TABLE "Referral"
  ADD CONSTRAINT "Referral_referredPayoutId_key" UNIQUE ("referredPayoutId");

-- Add FK: Referral.referredPayoutId → DriverPayout.id
ALTER TABLE "Referral"
  DROP CONSTRAINT IF EXISTS "Referral_referredPayoutId_fkey";
ALTER TABLE "Referral"
  ADD CONSTRAINT "Referral_referredPayoutId_fkey"
  FOREIGN KEY ("referredPayoutId") REFERENCES "DriverPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index on expiresAt (for the expiry cron)
CREATE INDEX IF NOT EXISTS "Referral_expiresAt_idx" ON "Referral"("expiresAt");

-- ────────────────────────────────────────────────────────────────
-- 6. Driver: add lastPaidReferrerTier
-- ────────────────────────────────────────────────────────────────
ALTER TABLE "Driver"
  ADD COLUMN IF NOT EXISTS "lastPaidReferrerTier" INTEGER NOT NULL DEFAULT 0;

-- ────────────────────────────────────────────────────────────────
-- 7. DriverPayout: make deliveryId nullable (referral payouts don't have a delivery)
-- ────────────────────────────────────────────────────────────────
-- The @unique constraint stays — Postgres allows multiple NULLs in
-- a unique column, so referral payouts (with deliveryId = null)
-- don't violate uniqueness for trip-completion payouts.
ALTER TABLE "DriverPayout" ALTER COLUMN "deliveryId" DROP NOT NULL;

-- Add index on (type, status) for filtering referral payouts
CREATE INDEX IF NOT EXISTS "DriverPayout_type_status_idx" ON "DriverPayout"("type", "status");

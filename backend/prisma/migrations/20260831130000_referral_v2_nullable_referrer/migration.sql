-- Referral V2 follow-up — make Referral.referrerId nullable to support
-- Customer referrers (where there's no Driver referrer).
--
-- Phase 1 (20260831120000_referral_v2) added the referrerUserId column but
-- forgot to relax the NOT NULL + FK constraint on referrerId. This
-- migration drops the old NOT NULL constraint and recreates the FK as
-- nullable so customer referrers (referralType=CUSTOMER) can set
-- referrerId=NULL and referrerUserId=<user_id> instead.
--
-- Backward compatibility:
--   - Existing Referral rows (Driver referrers) keep their referrerId.
--   - The FK still enforces referential integrity when referrerId is set.
--   - The @@index([referrerId, status]) index still works with NULLs
--     (Postgres indexes NULLs by default).

-- Step 1: drop the existing FK constraint (whatever name Postgres assigned)
-- The original FK was created by the base schema; its name is
-- "Referral_referrerId_fkey" by Prisma convention.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Referral_referrerId_fkey'
  ) THEN
    ALTER TABLE "Referral"
      DROP CONSTRAINT "Referral_referrerId_fkey";
  END IF;
END $$;

-- Step 2: re-create the FK as nullable (ON DELETE SET NULL is more
-- appropriate than RESTRICT now that referrerId is optional).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Referral_referrerId_fkey'
  ) THEN
    ALTER TABLE "Referral"
      ADD CONSTRAINT "Referral_referrerId_fkey"
      FOREIGN KEY ("referrerId") REFERENCES "Driver" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Step 3: alter the column to drop NOT NULL.
ALTER TABLE "Referral"
  ALTER COLUMN "referrerId" DROP NOT NULL;

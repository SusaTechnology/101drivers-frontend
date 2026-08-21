-- Update Referral program defaults to match the new advertised policy.
--
-- Old policy: $50 reward for 5 completed trips (no referral cap).
-- New policy: $150 reward for 30 completed trips within 30 days,
--             max 10 referrals per driver.
--
-- This migration only updates the COLUMN DEFAULTS so that new rows
-- created WITHOUT going through ReferralService.applyReferral (e.g.
-- direct DB inserts, manual backfills) get the new policy defaults.
--
-- IMPORTANT: This migration does NOT update existing rows. Existing
-- Referral rows keep their original tripsRequired / rewardAmount.
-- The actual values used for NEW referrals created via the API are
-- read from the admin-configured REFERRAL_PROGRAM_SETTINGS app
-- setting at applyReferral time (see backend/src/referral/referral.service.ts),
-- NOT from these column defaults. The column defaults are only a
-- backstop for direct DB inserts.
--
-- The admin can change the live program config at any time via:
--   PATCH /api/appSettings/referral-program
-- { rewardAmount, tripsRequired, daysToComplete, maxReferrals }
--
-- Existing referrals created before this migration keep their
-- original terms (5 trips / $50). New referrals created after
-- deploy will use whatever the admin has configured (defaults:
-- 30 trips / $150 / 30 days / 10 friends).

-- 1. Bump column defaults
ALTER TABLE "Referral" ALTER COLUMN "tripsRequired" SET DEFAULT 30;
ALTER TABLE "Referral" ALTER COLUMN "rewardAmount"  SET DEFAULT 150.0;

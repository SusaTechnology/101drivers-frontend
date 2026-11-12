-- Driver onboarding tracking for the admin Users surface: when the driver
-- last (re)submitted onboarding details (initial completion through an
-- invite/signup link, or the license edit page) and who did it (actor
-- email). NULL for rows that never went through those paths — no backfill
-- (same policy as invitedAt / ssnEncrypted).

ALTER TABLE "Driver" ADD COLUMN "lastOnboardingUpdateAt" TIMESTAMP(3);
ALTER TABLE "Driver" ADD COLUMN "lastOnboardingUpdateBy" TEXT;

-- Driver.invitedAt — the date the ADMIN sent the signup invite.
-- Stamped once by DriverApprovalEngine.inviteDriver on the first
-- WAITLISTED → INVITED transition; resends only rotate the onboarding
-- token. NULL = never invited (self-signup driver: his information
-- arrived at signup — User.createdAt — or at onboarding submit through
-- an invite link: onboardingCompletedAt). NULL also for drivers invited
-- before this column existed: no backfill (same policy as
-- Driver.ssnEncrypted); the full invite history lives in AdminAuditLog.
ALTER TABLE "Driver" ADD COLUMN "invitedAt" TIMESTAMP(3);

-- Add ADMIN_INVITE purpose to EnumEmailVerificationPurpose.
-- Used by the admin invite flow: single-use setup links emailed to new
-- administrators so they can set their own password (no default passwords).
ALTER TYPE "EnumEmailVerificationPurpose" ADD VALUE IF NOT EXISTS 'ADMIN_INVITE';

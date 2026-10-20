-- Full SSN, AES-256-GCM encrypted at rest.
--
-- Complements the identity-uniqueness migration: that one deliberately
-- removed the stored full SSN (only last 4 + peppered hashes remained),
-- which made the SSN maximally safe but invisible to admins. Background
-- checking is done MANUALLY for now (until a checker API is integrated),
-- and an admin cannot run a check with 4 digits — so the full SSN comes
-- back, but only in two-way-encrypted form (src/driver/ssn-crypto.util.ts,
-- AES-256-GCM keyed by SSN_ENCRYPTION_KEY or a server-secret-derived key).
-- The only decryption path is the admin reveal endpoint, and every
-- successful reveal writes an AdminAuditLog row.
--
-- No backfill is possible or needed: drivers onboarded before this column
-- have NO stored full SSN by design (the previous migration truncated the
-- value to its last 4), so there is nothing to encrypt. Their reveal
-- response simply reports "not on file" and falls back to the last 4.

ALTER TABLE "Driver" ADD COLUMN "ssnEncrypted" TEXT;

-- Driver identity uniqueness: one driver account per SSN / per driver license.
--
-- Adds two deterministic HMAC-SHA256 hash columns (app pepper — MUST match
-- src/driver/identity-hash.util.ts: same pepper, same normalization):
--   ssnHash           = HMAC(full 9-digit SSN)
--   licenseNumberHash = HMAC(normalized license number + ":" + issuing state)
-- US SSNs are nationally unique; US driver license numbers are unique within
-- an issuing state, so the license rule is per (number, state).
--
-- EXISTING ROWS ARE NOT TOUCHED — no backfill, no UPDATE, no truncation.
-- Every pre-existing Driver row keeps ssnHash / licenseNumberHash NULL, and
-- Postgres unique indexes allow any number of NULLs, so the rule is
-- invisible to existing accounts. Uniqueness applies ONLY to new
-- registrations: the app computes and stores the hashes at signup / profile
-- save, so only new (or newly saved) rows carry a hash and can collide.
--
-- Consequence (accepted): a new signup duplicating a LEGACY driver's SSN or
-- license is not detected, because legacy rows carry no hash. Legacy rows
-- also keep whatever value is currently stored in ssnLastFour — nothing is
-- rewritten, truncated, or removed.

ALTER TABLE "Driver" ADD COLUMN "ssnHash" TEXT;
ALTER TABLE "Driver" ADD COLUMN "licenseNumberHash" TEXT;

CREATE UNIQUE INDEX "Driver_ssnHash_key" ON "Driver"("ssnHash");
CREATE UNIQUE INDEX "Driver_licenseNumberHash_key" ON "Driver"("licenseNumberHash");

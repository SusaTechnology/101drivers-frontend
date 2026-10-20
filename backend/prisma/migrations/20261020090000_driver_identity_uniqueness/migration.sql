-- Driver identity uniqueness: one driver account per SSN / per driver license.
--
-- Adds two deterministic HMAC-SHA256 hash columns (app pepper — MUST match
-- src/driver/identity-hash.util.ts: same pepper, same normalization):
--   ssnHash           = HMAC(full 9-digit SSN)
--   licenseNumberHash = HMAC(normalized license number + ":" + issuing state)
-- US SSNs are nationally unique; US driver license numbers are unique within
-- an issuing state, so the license rule is per (number, state).
--
-- Privacy fix shipped alongside: onboarding used to store the FULL 9-digit
-- SSN in the "ssnLastFour" column (and later handed all 9 digits to Stripe
-- as ssn_last_4). This migration backfills the hash from the stored value
-- and then truncates the stored value to its last 4 digits — what the
-- column always claimed to hold. Going forward the service stores only the
-- last 4 + the hash; the full SSN is never persisted.
--
-- Unique indexes let multiple NULLs (pre-onboarding drivers), and are
-- created AFTER the backfill so existing rows participate immediately.
-- NOTE: if existing rows already contain a duplicated SSN / (license,
-- state) pair, the unique index creation fails loudly — resolve the
-- duplicates first (they are exactly the accounts this rule exists for).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "Driver" ADD COLUMN "ssnHash" TEXT;
ALTER TABLE "Driver" ADD COLUMN "licenseNumberHash" TEXT;

-- Backfill SSN hashes from rows that still hold the full 9 digits, and
-- replace the stored value with only its last 4 digits. Rows already
-- holding just 4 digits cannot produce a full-SSN hash and are left
-- untouched (their hash stays NULL — excluded from uniqueness, never a
-- false positive).
UPDATE "Driver"
SET "ssnHash" = encode(
      hmac("ssnLastFour", '101drivers-identity-hash-v1', 'sha256'),
      'hex'
    ),
    "ssnLastFour" = right("ssnLastFour", 4)
WHERE "ssnLastFour" IS NOT NULL
  AND "ssnLastFour" ~ '^\d{9}$';

-- Backfill license hashes for every onboarded driver.
-- Normalization mirrors identity-hash.util.ts: uppercase, strip everything
-- but A-Z0-9, then "<number>:<STATE>".
UPDATE "Driver"
SET "licenseNumberHash" = encode(
      hmac(
        regexp_replace(upper(btrim("licenseNumber")), '[^A-Z0-9]', '', 'g')
          || ':' || upper(btrim("licenseState")),
        '101drivers-identity-hash-v1',
        'sha256'
      ),
      'hex'
    )
WHERE "licenseNumber" IS NOT NULL
  AND length(btrim("licenseNumber")) > 0
  AND "licenseState" IS NOT NULL;

CREATE UNIQUE INDEX "Driver_ssnHash_key" ON "Driver"("ssnHash");
CREATE UNIQUE INDEX "Driver_licenseNumberHash_key" ON "Driver"("licenseNumberHash");

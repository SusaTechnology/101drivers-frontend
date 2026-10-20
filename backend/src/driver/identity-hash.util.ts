// src/driver/identity-hash.util.ts
//
// Deterministic identity hashes used to enforce ONE driver account per
// SSN / per driver license WITHOUT storing (or ever exposing) the raw
// identifiers a second time.
//
// Why HMAC and not a plain hash: an SSN is only 10^9 possible values, so
// an unkeyed SHA-256 of an SSN can be brute-forced in seconds from any DB
// dump. HMAC-SHA256 with an app-side pepper means the stored value cannot
// be reversed without the application's secret — and the raw identifiers
// are never stored in the hash columns at all.
//
// ⚠ KEEP IN SYNC with prisma/migrations/<ts>_driver_identity_uniqueness:
// that migration ONLY adds the nullable unique columns — it never backfills
// or modifies existing rows (legacy rows stay NULL and are excluded from
// uniqueness). Hashes are computed and stored exclusively by THIS module at
// signup / profile save, so the rule applies to new registrations only.
// If you rotate IDENTITY_HASH_PEPPER, rows written under the old pepper
// keep their old hashes (pepper is baked into the stored value) — new
// signups would not collide with them until they re-save their identity.
const PEPPER = process.env.IDENTITY_HASH_PEPPER || "101drivers-identity-hash-v1";

import { createHmac } from "crypto";

function hmacHex(value: string): string {
  return createHmac("sha256", PEPPER).update(value, "utf8").digest("hex");
}

/** Digits only — the runtime mirror of the DTO's ^\d{9}$ rule. */
export function normalizeSsn(input: string): string {
  return (input ?? "").replace(/\D/g, "");
}

/**
 * Hash of the FULL 9-digit SSN. Two drivers submitting the same SSN (even
 * with different formatting) produce the same hash; anything else differs.
 */
export function ssnIdentityHash(ssn9Digits: string): string {
  return hmacHex(normalizeSsn(ssn9Digits));
}

/**
 * License numbers are unique WITHIN an issuing state, not necessarily
 * across states (each state DMV numbers independently). Uniqueness is
 * therefore enforced per (license number, issuing state) — the same string
 * from two different states stays valid, the same CA number twice is
 * blocked. Normalization: uppercase, strip everything but A-Z0-9, so
 * "d 123 4567" and "D1234567" collide the same way.
 */
export function normalizeLicenseNumber(input: string): string {
  return (input ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function licenseIdentityHash(
  licenseNumber: string,
  licenseState: string
): string {
  const number = normalizeLicenseNumber(licenseNumber);
  const state = (licenseState ?? "").trim().toUpperCase();
  return hmacHex(`${number}:${state}`);
}

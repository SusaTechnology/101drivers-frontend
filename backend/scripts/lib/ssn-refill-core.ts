// scripts/lib/ssn-refill-core.ts
//
// PURE helpers for REFILLING driver SSNs. NO database, NO env reading here —
// the refill script owns I/O and key probing (via ssn-rekey-core).
//
// WHY REFILL EXISTS
// For some drivers no full 9-digit SSN exists ANYWHERE in the system:
//   • true-legacy rows: ssnLastFour holds 4 digits, and ssnHash is NULL —
//     the full value was never stored (or left no hash to recover from).
//     No script can reconstruct digits that no copy of exists. Honest math.
//   • rows whose old ciphertext is undecryptable under every known key
//     (the key text that wrote them is gone).
// For TEST accounts the practical fix is to assign a fresh 9-digit SSN,
// encrypted under the CURRENT server key, so the admin eye icon works.
//
// UNIQUENESS CONTRACT: refilled rows get NO ssnHash (stays NULL). Hashes are
// written only by the app at signup, so uniqueness keeps binding NEW
// registrations only — exactly the zero-touch rule this project committed to.
// A refilled (fake) SSN can therefore never block a future real signup.

import { randomInt } from "crypto";

export interface RefillRowShape {
  ssnEncrypted: string | null;
  ssnLastFour: string | null;
}

export type RefillDecision =
  | { action: "REFILL" }
  | { action: "SKIP_RECOVERABLE" } // ciphertext decrypts under SOME known key — rotate:ssn-key can save the real SSN
  | { action: "SKIP_BACKFILL_JOB" } // 9-digit value in ssnLastFour is REAL data — backfill:ssn-encrypted's job, not ours
  | { action: "SKIP_NOTHING_STORED" }; // no SSN anywhere at all — report only

/**
 * Decide what to do with one driver row.
 * @param encryptedRecoverable whether decryptSsn succeeds under ANY known key
 *        (caller probes via ssn-rekey-core classifyEncryptedSsn). Ignored when
 *        ssnEncrypted is null.
 */
export function decideRefill(row: RefillRowShape, encryptedRecoverable: boolean): RefillDecision {
  if (row.ssnEncrypted) {
    return encryptedRecoverable ? { action: "SKIP_RECOVERABLE" } : { action: "REFILL" };
  }
  const lf = row.ssnLastFour ?? "";
  if (/^\d{9}$/.test(lf)) return { action: "SKIP_BACKFILL_JOB" };
  if (/^\d{4}$/.test(lf)) return { action: "REFILL" };
  return { action: "SKIP_NOTHING_STORED" };
}

const pickDigits = (n: number): string => {
  let s = "";
  for (let i = 0; i < n; i++) s += String(randomInt(0, 10));
  return s;
};

/**
 * Generate a 9-digit SSN that passes the real-world validity shape
 * (area not 000/666/900-999, group not 00, serial not 0000) so test data
 * does not look obviously fake in the admin panel.
 *
 * @param prefix6 optional 6 digits: area+group fixed (e.g. "890456") so every
 *        refilled row is instantly recognizable as refilled test data; the
 *        last 3 digits stay random. Only 1,000 combinations exist per prefix —
 *        throws when exhausted.
 * @param used shared Set across the whole run — guarantees no duplicates.
 */
export function generatePlausibleSsn(prefix6?: string, used?: Set<string>): string {
  const seen = used ?? new Set<string>();
  let area: string;
  let group: string;
  let serial: string;

  if (prefix6 !== undefined) {
    area = prefix6.slice(0, 3);
    group = prefix6.slice(3, 6);
    serial = pickDigits(3);
  } else {
    do {
      area = pickDigits(3);
    } while (area === "000" || area === "666" || area >= "900");
    do {
      group = pickDigits(2);
    } while (group === "00");
    do {
      serial = pickDigits(4);
    } while (serial === "0000");
  }

  let ssn = area + group + serial;
  let attempts = 1;
  const maxAttempts = prefix6 !== undefined ? 1000 : 100000;
  while (seen.has(ssn)) {
    if (attempts >= maxAttempts) {
      throw new Error(
        prefix6 !== undefined
          ? `Prefix ${prefix6} exhausted: only 1,000 distinct SSNs exist per 6-digit prefix.`
          : "Could not generate a unique SSN (implausible).",
      );
    }
    attempts++;
    if (prefix6 !== undefined) {
      serial = pickDigits(3);
      ssn = area + group + serial;
    } else {
      do {
        area = pickDigits(3);
      } while (area === "000" || area === "666" || area >= "900");
      do {
        group = pickDigits(2);
      } while (group === "00");
      do {
        serial = pickDigits(4);
      } while (serial === "0000");
      ssn = area + group + serial;
    }
  }
  seen.add(ssn);
  return ssn;
}

/** True when the prefix option is well-formed (exactly 6 digits). */
export function isValidPrefix(prefix: string | undefined): boolean {
  return prefix === undefined || /^\d{6}$/.test(prefix);
}

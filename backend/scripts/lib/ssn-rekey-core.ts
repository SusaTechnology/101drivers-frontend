// scripts/lib/ssn-rekey-core.ts
//
// PURE core for SSN encryption-key rotation/repair. NO database, NO main() —
// the rotate script owns I/O; this file owns the key logic so it can be
// offline-tested exhaustively.
//
// THE PROBLEM IT SOLVES
// Every ssnEncrypted row is written under whatever key the server resolved
// AT WRITE TIME (SSN_ENCRYPTION_KEY if set+valid, else JWT-derived, else a
// dev-only fallback — see src/driver/ssn-crypto.util.ts deriveKey()). If the
// env changes AFTER rows were written (e.g. someone adds SSN_ENCRYPTION_KEY
// to .env when the rows were encrypted under the JWT-derived key), the app
// resolves a DIFFERENT key and every reveal answers DECRYPT_FAILED.
// No data is lost — the rows just need to be migrated to the final key.
//
// HOW THIS FILE KNOWS WHICH KEY A ROW WAS WRITTEN UNDER
// It does NOT re-implement key derivation. It mutates process.env around the
// REAL decryptSsn() (which re-reads env on every call) and lets the app's own
// crypto answer. All mutations are snapshot/restore'd and synchronous.
//
// SECURITY: functions here return labels/counts, never key values. The only
// plaintext exposure is the 9-digit SSN itself, which callers must mask.

import { decryptSsn, encryptSsn } from "../../src/driver/ssn-crypto.util";

export type SsnKeyCandidate = "current-env" | "old-explicit" | "jwt-derived" | "dev-fallback";

const MANAGED_ENV_KEYS = [
  "SSN_ENCRYPTION_KEY",
  "OLD_SSN_ENCRYPTION_KEY",
  "JWT_ACCESS_SECRET",
  "JWT_SECRET",
] as const;

export interface SsnKeyEnvSnapshot {
  SSN_ENCRYPTION_KEY?: string;
  OLD_SSN_ENCRYPTION_KEY?: string;
  JWT_ACCESS_SECRET?: string;
  JWT_SECRET?: string;
}

export function captureSsnKeyEnv(): SsnKeyEnvSnapshot {
  const snap: SsnKeyEnvSnapshot = {};
  for (const k of MANAGED_ENV_KEYS) {
    if (process.env[k] !== undefined) snap[k] = process.env[k];
  }
  return snap;
}

export function restoreSsnKeyEnv(snap: SsnKeyEnvSnapshot): void {
  for (const k of MANAGED_ENV_KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else process.env[k] = snap[k];
  }
}

/**
 * Run fn() with process.env arranged so the REAL deriveKey() resolves to the
 * given candidate. Always restores the previous env afterwards (sync crypto,
 * so no interleaving is possible).
 */
export function withCandidateEnv<T>(candidate: SsnKeyCandidate, fn: () => T): T {
  const snap = captureSsnKeyEnv();
  try {
    switch (candidate) {
      case "current-env":
        // Untouched — exactly what the running app resolves right now.
        break;
      case "old-explicit":
        // Caller guarantees OLD_SSN_ENCRYPTION_KEY is set and valid
        // (candidateProbeOrder filters). Setting it as SSN_ENCRYPTION_KEY
        // makes deriveKey() use it (explicit wins when >= 8 chars).
        process.env.SSN_ENCRYPTION_KEY = process.env.OLD_SSN_ENCRYPTION_KEY;
        break;
      case "jwt-derived":
        delete process.env.SSN_ENCRYPTION_KEY;
        break;
      case "dev-fallback":
        delete process.env.SSN_ENCRYPTION_KEY;
        delete process.env.JWT_ACCESS_SECRET;
        delete process.env.JWT_SECRET;
        break;
    }
    return fn();
  } finally {
    restoreSsnKeyEnv(snap);
  }
}

/** Which candidates are worth probing, in precedence order. */
export function candidateProbeOrder(): SsnKeyCandidate[] {
  const order: SsnKeyCandidate[] = ["current-env"];
  const old = process.env.OLD_SSN_ENCRYPTION_KEY;
  if (old !== undefined && old.trim().length >= 8) order.push("old-explicit");
  const jwt = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? "";
  if (jwt.length >= 8) order.push("jwt-derived");
  order.push("dev-fallback");
  return order;
}

/** The key source the app resolves RIGHT NOW (mirrors deriveKey precedence, for reporting/guards). */
export function currentKeySource(): "explicit" | "jwt" | "dev" {
  const explicit = process.env.SSN_ENCRYPTION_KEY;
  if (explicit !== undefined && explicit.trim().length >= 8) return "explicit";
  const jwt = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? "";
  if (jwt.length >= 8) return "jwt";
  return "dev";
}

/** Human-readable label of the current resolution. NEVER includes the value. */
export function currentKeyResolutionLabel(): string {
  const explicit = process.env.SSN_ENCRYPTION_KEY;
  if (explicit !== undefined && explicit.trim().length >= 8) {
    return "SSN_ENCRYPTION_KEY (explicit, from current env)";
  }
  if (explicit !== undefined) {
    // Set but silently ignored by deriveKey() — a dangerous trap worth naming.
    return (
      currentKeySource() === "jwt"
        ? "JWT-derived — WARNING: SSN_ENCRYPTION_KEY is set but SHORTER THAN 8 CHARS, so the app silently IGNORES it"
        : "DEV-ONLY fallback — WARNING: SSN_ENCRYPTION_KEY is set but SHORTER THAN 8 CHARS and no JWT secret is configured"
    );
  }
  return currentKeySource() === "jwt"
    ? "JWT-derived (no SSN_ENCRYPTION_KEY set)"
    : "DEV-ONLY fallback (no secrets configured)";
}

export interface SsnRowClassification {
  /** First candidate whose key decrypted the row. */
  candidate: SsnKeyCandidate;
  /** The recovered 9-digit SSN. Callers must mask before printing. */
  plaintext: string;
}

/**
 * Determine which key a row was written under by probing candidates with the
 * REAL decryptSsn. decryptSsn returns exactly 9 digits on success and null on
 * any failure, so a hit is unambiguous.
 */
export function classifyEncryptedSsn(payload: string): SsnRowClassification | "UNDECRYPTABLE" {
  for (const candidate of candidateProbeOrder()) {
    const plain = withCandidateEnv(candidate, () => decryptSsn(payload));
    if (plain) return { candidate, plaintext: plain };
  }
  return "UNDECRYPTABLE";
}

export type SsnRekeyPlan =
  | { ok: true; newEncrypted: string }
  | {
      ok: false;
      reason: "ENCRYPT_FAILED" | "ROUNDTRIP_FAILED" | "STILL_DECRYPTS_UNDER_OLD_KEY" | "LAST4_MISMATCH";
      detail?: string;
    };

/**
 * Verify-then-build the update for migrating one row to the CURRENT key.
 * Refuses (ok:false) instead of writing anything questionable — same guard
 * philosophy as the backfill script:
 *   1. last-4 cross-check: decrypted value must agree with the stored tail,
 *   2. encrypt under the CURRENT env resolution (the key the app will use
 *      after restart — env deliberately untouched here),
 *   3. round-trip: decrypt(new) === plaintext,
 *   4. negative guard: the new ciphertext must NOT decrypt under the OLD
 *      candidate (would mean the env juggling failed and we wrote garbage).
 */
export function buildSsnRekeyUpdate(
  plaintext: string,
  oldCandidate: SsnKeyCandidate,
  storedLastFour: string | null,
): SsnRekeyPlan {
  if (storedLastFour) {
    const storedTail = storedLastFour.slice(-4);
    if (plaintext.slice(-4) !== storedTail) {
      return {
        ok: false,
        reason: "LAST4_MISMATCH",
        detail: `decrypts to ...${plaintext.slice(-4)} but stored last-4 is ...${storedTail}`,
      };
    }
  }

  const newEncrypted = encryptSsn(plaintext);
  if (!newEncrypted) return { ok: false, reason: "ENCRYPT_FAILED" };

  const roundTrip = decryptSsn(newEncrypted);
  if (roundTrip !== plaintext) return { ok: false, reason: "ROUNDTRIP_FAILED" };

  if (oldCandidate !== "current-env") {
    const underOld = withCandidateEnv(oldCandidate, () => decryptSsn(newEncrypted));
    if (underOld === plaintext) return { ok: false, reason: "STILL_DECRYPTS_UNDER_OLD_KEY" };
  }

  return { ok: true, newEncrypted };
}

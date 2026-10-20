// src/driver/ssn-crypto.util.ts
//
// AES-256-GCM encryption for the full SSN at rest.
//
// WHY TWO-WAY ENCRYPTION (and not just the HMAC from identity-hash.util)?
// Background checking is manual for now (until a background-checker API is
// integrated), so admins must be able to SEE the full SSN — a one-way hash
// would make that impossible forever. At the same time a plaintext SSN in a
// DB dump is the crown-jewel identity credential. The compromise:
//   • ssnHash (HMAC-SHA256, identity-hash.util) — uniqueness, never readable
//   • ssnLastFour — display + Stripe ssn_last_4
//   • ssnEncrypted (THIS file) — recoverable only with the server key, and
//     the only decrypt path is the admin reveal endpoint, which audit-logs
//     every reveal (actor, driver, timestamp) in AdminAuditLog.
//
// KEY MANAGEMENT
//   1. SSN_ENCRYPTION_KEY env var (recommended for production): any
//      sufficiently long random string; it is hashed to a 32-byte AES key.
//   2. Fallback: derived (SHA-256, domain-separated) from the JWT access
//      secret so deployments keep working without a new env var. Still a
//      server-only secret — but rotating the JWT secret then breaks
//      decryption of rows encrypted under the old one, so set
//      SSN_ENCRYPTION_KEY explicitly and treat it as its own rotation
//      lifecycle.
//
// Ciphertext format: "enc:v1:<iv-b64>:<tag-b64>:<ciphertext-b64>" — the
// version prefix leaves room for future key rotation/rewrap tooling.
// decryptSsn NEVER throws: on any tamper/key-mismatch/garbage it returns
// null and the caller reports "cannot be decrypted" instead of leaking
// crypto errors.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const FORMAT_VERSION = "enc:v1";
const IV_BYTES = 12; // GCM standard nonce length

function deriveKey(): Buffer {
  const explicit = process.env.SSN_ENCRYPTION_KEY;
  if (explicit && explicit.trim().length >= 8) {
    return createHash("sha256").update(`ssn-enc:v1:${explicit.trim()}`, "utf8").digest();
  }
  const serverSecret =
    process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? "";
  if (serverSecret.length >= 8) {
    // Domain-separated derivation so this key can never coincide with a
    // key derived from the same secret for another purpose.
    return createHash("sha256")
      .update(`101drivers-ssn-encryption-v1:${serverSecret}`, "utf8")
      .digest();
  }
  // Dev-only last resort (no secrets configured at all): deterministic so
  // locally encrypted rows stay decryptable across restarts. Production
  // always has a JWT secret — and should set SSN_ENCRYPTION_KEY.
  return createHash("sha256")
    .update("101drivers-ssn-encryption-dev-only-v1", "utf8")
    .digest();
}

/** Encrypt a 9-digit SSN. Returns null for empty input (never throws). */
export function encryptSsn(ssn9Digits: string): string | null {
  const normalized = (ssn9Digits ?? "").replace(/\D/g, "");
  if (normalized.length !== 9) return null;
  try {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(normalized, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      FORMAT_VERSION,
      iv.toString("base64"),
      tag.toString("base64"),
      ciphertext.toString("base64"),
    ].join(":");
  } catch {
    // Encryption must never block onboarding — identityDataFor callers
    // treat null as "no encrypted copy" and everything else still stores.
    return null;
  }
}

/**
 * Decrypt an "enc:v1:..." payload. Returns null on ANY failure (wrong key,
 * tampered tag, malformed payload) — callers surface a neutral "cannot be
 * decrypted" state, never a crypto stack trace.
 */
export function decryptSsn(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const parts = payload.split(":");
  if (parts.length !== 5 || parts[0] !== FORMAT_VERSION) return null;
  try {
    const iv = Buffer.from(parts[1], "base64");
    const tag = Buffer.from(parts[2], "base64");
    const ciphertext = Buffer.from(parts[3], "base64");
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const ssn = plain.toString("utf8").replace(/\D/g, "");
    return ssn.length === 9 ? ssn : null;
  } catch {
    return null;
  }
}

/** "123456789" → "123-45-6789" for display; passthrough on odd input. */
export function formatSsnForDisplay(ssn9Digits: string): string {
  const s = (ssn9Digits ?? "").replace(/\D/g, "");
  return s.length === 9 ? `${s.slice(0, 3)}-${s.slice(3, 5)}-${s.slice(5)}` : ssn9Digits;
}

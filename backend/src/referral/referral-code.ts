/**
 * Referral code generator + validator — shared by Driver + Customer codes.
 *
 * This module is PURE LOGIC — it has no NestJS dependencies, no Prisma, no
 * I/O. It takes a "does this code already exist?" predicate and produces
 * a fresh unique code, or validates a user-provided code. Keeping the I/O
 * out makes this trivially unit-testable (see referral-code.test.ts).
 *
 * Character set (32 chars): ABCDEFGHJKLMNPQRSTUVWXYZ23456789
 *   - No 0, 1, I, O — visually ambiguous pairs that cause user error
 *
 * Code shape: 8 chars. Regex: ^[A-HJ-NP-Z2-9]{8}$
 *
 * Blocklist: a curated list of offensive/brand-confusing strings that the
 * generator must never emit AND the user is not allowed to claim as a
 * custom code. Matching is case-insensitive on the raw 8-char code. The
 * blocklist is intentionally short and conservative — we're not trying to
 * censor creativity, just keep the obviously-bad ones out of marketing
 * screenshots.
 */

// ── Character set ───────────────────────────────────────────────────
// No 0, 1, I, O — visually ambiguous. Order shuffled for clarity.
// Codes are stored UPPERCASE in the DB. The validator accepts any case
// from user input and normalizes to uppercase.
export const REFERRAL_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const REFERRAL_CODE_LENGTH = 8;
// Case-insensitive match — user input may be lowercase. The generator
// always emits uppercase (REFERRAL_CODE_CHARS is uppercase), and the
// validator normalizes input to uppercase before storage.
export const REFERRAL_CODE_REGEX = /^[A-HJ-NP-Z2-9]{8}$/i;

// ── Blocklist ───────────────────────────────────────────────────────
// Matched case-insensitively against the raw 8-char code. Add new
// entries here as they come up — keep them lowercase in the list.
//
// IMPORTANT: Every entry MUST match REFERRAL_CODE_REGEX (i.e. only chars
// from A-HJ-NP-Z2-9, no 0/1/I/O). Entries that don't match the regex can
// never be produced by the generator and can never pass the validator,
// so listing them is pointless. The referral-code.spec.ts test suite
// enforces this invariant.
//
// The blocklist is intentionally short and conservative — we're not
// trying to censor creativity, just keep the obviously-bad ones out of
// marketing screenshots.
export const REFERRAL_CODE_BLOCKLIST: ReadonlySet<string> = new Set([
  // Generic offensive (regex-clean only — no 0/1/I/O)
  "bullshxt", "fukfukfk", "fukkyewx",
  // Slurs / hate — never emit these under any circumstances
  // (regex-clean spellings; the variants with banned chars can't be
  // generated anyway, so they're not listed)
  "fagfagfx", "fagfagsg",
  // Brand-confusing (would mislead users into thinking they're using
  // an official 101drivers code or a competitor's code)
  "drvrsdrv", "drvrsxxx", "drvrxdrv",
  // Support / system-reserved (would confuse support flows)
  "spprtspp", "hlpmepls",
  // All-same-char codes (look like a bug, easy to typo-squat)
  "aaaaaaaa", "bbbbbbbb", "cccccccc", "dddddddd", "eeeeeeee",
  "ffffffff", "gggggggg", "hhhhhhhh", "jjjjjjjj", "kkkkkkkk",
  "llllllll", "mmmmmmmm", "nnnnnnnn", "pppppppp", "qqqqqqqq",
  "rrrrrrrr", "ssssssss", "tttttttt", "uuuuuuuu", "vvvvvvvv",
  "wwwwwwww", "xxxxxeee", "yyyyyyyy", "zzzzzzzz",
  "22222222", "33333333", "44444444", "55555555", "66666666",
  "77777777", "88888888", "99999999",
  // Sequential / keyboard-mash patterns
  "abcdwxyz", "qrstuvwx", "xyzabcde",
]);

/**
 * Check if a candidate code is in the blocklist. Case-insensitive.
 */
export function isReferralCodeBlocklisted(code: string): boolean {
  if (!code) return true;
  return REFERRAL_CODE_BLOCKLIST.has(code.toLowerCase());
}

/**
 * Validate that a user-provided custom referral code:
 *   - Matches the 8-char alphanumeric regex (no 0/1/I/O)
 *   - Is not in the blocklist
 *
 * Returns `{ ok: true }` or `{ ok: false, reason }`. Reason is a short
 * machine-readable string (not user-facing copy) — callers should map
 * to their own UI strings.
 */
export function validateCustomReferralCode(code: string): { ok: true } | { ok: false; reason: string } {
  if (!code || typeof code !== "string") {
    return { ok: false, reason: "EMPTY" };
  }
  if (!REFERRAL_CODE_REGEX.test(code)) {
    return { ok: false, reason: "INVALID_FORMAT" };
  }
  if (isReferralCodeBlocklisted(code)) {
    return { ok: false, reason: "BLOCKLISTED" };
  }
  return { ok: true };
}

/**
 * Generate a single random 8-char code. NOT unique-checked — caller
 * must check against existing codes (see generateUniqueReferralCode).
 *
 * Pure function: depends only on Math.random. Tests can stub
 * Math.random for deterministic output.
 */
export function generateReferralCodeCandidate(): string {
  let code = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += REFERRAL_CODE_CHARS.charAt(
      Math.floor(Math.random() * REFERRAL_CODE_CHARS.length),
    );
  }
  return code;
}

/**
 * Generate a unique, non-blocklisted 8-char referral code.
 *
 * Calls `exists` (a caller-provided async predicate — typically a
 * Prisma `findFirst` against Driver.referralCode, Customer.referralCode,
 * or Referral.referralCode) until it gets a code that:
 *   1. Is not in the blocklist
 *   2. Is not already in use (per the predicate)
 *
 * Bounded: gives up after 100 attempts and throws. In practice the
 * keyspace is 32^8 ≈ 1.1 trillion, so collision is astronomically
 * unlikely unless the table already has hundreds of millions of rows.
 */
export async function generateUniqueReferralCode(
  exists: (code: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = generateReferralCodeCandidate();
    if (isReferralCodeBlocklisted(candidate)) continue;
    const taken = await exists(candidate);
    if (!taken) return candidate;
  }
  throw new Error(
    "Failed to generate a unique referral code after 100 attempts — keyspace exhausted?",
  );
}

/**
 * Unit tests for the referral-code generator + validator.
 *
 * Pure-logic module — no NestJS, no Prisma, no I/O. Easy to test.
 */
import {
  REFERRAL_CODE_CHARS,
  REFERRAL_CODE_LENGTH,
  REFERRAL_CODE_REGEX,
  REFERRAL_CODE_BLOCKLIST,
  generateReferralCodeCandidate,
  generateUniqueReferralCode,
  isReferralCodeBlocklisted,
  validateCustomReferralCode,
} from "./referral-code";

describe("referral-code", () => {
  // ── Character set ────────────────────────────────────────────────
  describe("REFERRAL_CODE_CHARS", () => {
    it("excludes visually-ambiguous characters (0, 1, I, O)", () => {
      expect(REFERRAL_CODE_CHARS).not.toContain("0");
      expect(REFERRAL_CODE_CHARS).not.toContain("1");
      expect(REFERRAL_CODE_CHARS).not.toContain("I");
      expect(REFERRAL_CODE_CHARS).not.toContain("O");
    });

    it("contains 32 unique chars (26 letters - 2 ambiguous + 8 digits - 2 ambiguous)", () => {
      expect(REFERRAL_CODE_CHARS.length).toBe(32);
      // All unique
      expect(new Set(REFERRAL_CODE_CHARS).size).toBe(32);
    });
  });

  // ── Code shape ────────────────────────────────────────────────────
  describe("REFERRAL_CODE_LENGTH", () => {
    it("is 8", () => {
      expect(REFERRAL_CODE_LENGTH).toBe(8);
    });
  });

  // ── Generator ─────────────────────────────────────────────────────
  describe("generateReferralCodeCandidate", () => {
    it("produces an 8-char string matching the regex", () => {
      const code = generateReferralCodeCandidate();
      expect(code).toHaveLength(8);
      expect(REFERRAL_CODE_REGEX.test(code)).toBe(true);
    });

    it("every char comes from REFERRAL_CODE_CHARS", () => {
      // Run a few iterations to bump probability
      for (let i = 0; i < 50; i++) {
        const code = generateReferralCodeCandidate();
        for (const ch of code) {
          expect(REFERRAL_CODE_CHARS).toContain(ch);
        }
      }
    });

    it("is not deterministic (varies across calls with high probability)", () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) codes.add(generateReferralCodeCandidate());
      // Astronomically unlikely to get < 95 unique out of 100 with 32^8 keyspace
      expect(codes.size).toBeGreaterThan(95);
    });
  });

  // ── Blocklist ──────────────────────────────────────────────────────
  describe("isReferralCodeBlocklisted", () => {
    it("returns true for known blocklisted codes (case-insensitive)", () => {
      // Use entries that actually exist in the regex-clean blocklist
      expect(isReferralCodeBlocklisted("fukfukfk")).toBe(true);
      expect(isReferralCodeBlocklisted("FUKFUKFK")).toBe(true);
      expect(isReferralCodeBlocklisted("drvrsdrv")).toBe(true);
      expect(isReferralCodeBlocklisted("AAAAAAAA")).toBe(true);
      expect(isReferralCodeBlocklisted("22222222")).toBe(true);
    });

    it("returns false for clean codes", () => {
      expect(isReferralCodeBlocklisted("abcd2345")).toBe(false);
      expect(isReferralCodeBlocklisted("dealer23")).toBe(false);
      expect(isReferralCodeBlocklisted("xyz99abc")).toBe(false);
    });

    it("returns true for empty/blank input", () => {
      expect(isReferralCodeBlocklisted("")).toBe(true);
    });

    it("every entry in the blocklist is 8 chars and lowercase AND matches the regex", () => {
      // Sanity check on the blocklist itself — every entry must be
      // actually possible to generate (otherwise listing it is pointless)
      for (const entry of REFERRAL_CODE_BLOCKLIST) {
        expect(entry.length).toBe(8);
        expect(entry).toBe(entry.toLowerCase());
        expect(REFERRAL_CODE_REGEX.test(entry)).toBe(true);
      }
    });
  });

  // ── Custom code validator ─────────────────────────────────────────
  describe("validateCustomReferralCode", () => {
    it("accepts a clean 8-char alphanumeric code (no 0/1/I/O)", () => {
      // These are all uppercase, no 0/1/I/O, 8 chars
      expect(validateCustomReferralCode("ABCD2345")).toEqual({ ok: true });
      expect(validateCustomReferralCode("DEALER23")).toEqual({ ok: true });
      expect(validateCustomReferralCode("XYZ99ABC")).toEqual({ ok: true });
    });

    it("accepts lowercase input (case-insensitive)", () => {
      expect(validateCustomReferralCode("abcd2345")).toEqual({ ok: true });
      expect(validateCustomReferralCode("dealer23")).toEqual({ ok: true });
    });

    it("rejects empty input with EMPTY reason", () => {
      expect(validateCustomReferralCode("")).toEqual({ ok: false, reason: "EMPTY" });
      expect(validateCustomReferralCode(null as any)).toEqual({ ok: false, reason: "EMPTY" });
    });

    it("rejects wrong-length codes with INVALID_FORMAT", () => {
      expect(validateCustomReferralCode("abc123")).toEqual({ ok: false, reason: "INVALID_FORMAT" });
      expect(validateCustomReferralCode("abcd12345")).toEqual({ ok: false, reason: "INVALID_FORMAT" });
    });

    it("rejects forbidden chars (0, 1, I, O) with INVALID_FORMAT", () => {
      expect(validateCustomReferralCode("abcd0123")).toEqual({ ok: false, reason: "INVALID_FORMAT" });
      expect(validateCustomReferralCode("abcd1123")).toEqual({ ok: false, reason: "INVALID_FORMAT" });
      expect(validateCustomReferralCode("Ibcd1234")).toEqual({ ok: false, reason: "INVALID_FORMAT" });
      expect(validateCustomReferralCode("Obcd1234")).toEqual({ ok: false, reason: "INVALID_FORMAT" });
    });

    it("rejects blocklisted codes with BLOCKLISTED reason", () => {
      // Blocklist entries are lowercase 8-char strings; matching is
      // case-insensitive, so uppercase input should still be blocked.
      expect(validateCustomReferralCode("FUKFUKFK")).toEqual({ ok: false, reason: "BLOCKLISTED" });
      expect(validateCustomReferralCode("drvrsdrv")).toEqual({ ok: false, reason: "BLOCKLISTED" });
      expect(validateCustomReferralCode("AAAAAAAA")).toEqual({ ok: false, reason: "BLOCKLISTED" });
      expect(validateCustomReferralCode("22222222")).toEqual({ ok: false, reason: "BLOCKLISTED" });
    });
  });

  // ── Unique generator ──────────────────────────────────────────────
  describe("generateUniqueReferralCode", () => {
    it("returns the first candidate that exists() says is free", async () => {
      // Stub exists() to claim every code is free → returns first candidate
      const exists = jest.fn().mockResolvedValue(false);
      const code = await generateUniqueReferralCode(exists);
      expect(REFERRAL_CODE_REGEX.test(code)).toBe(true);
      expect(exists).toHaveBeenCalledTimes(1);
      expect(isReferralCodeBlocklisted(code)).toBe(false);
    });

    it("retries when exists() returns true, then returns first free code", async () => {
      // First 3 candidates "exist", 4th is free
      const exists = jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValue(false);
      const code = await generateUniqueReferralCode(exists);
      expect(REFERRAL_CODE_REGEX.test(code)).toBe(true);
      expect(exists).toHaveBeenCalledTimes(4);
    });

    it("retries when the candidate is blocklisted (without calling exists)", async () => {
      // Force the generator to produce a blocklisted code first by stubbing
      // Math.random. We make Math.random return 0 for the first 8 calls
      // (= "AAAAAAAA", blocklisted), then a sequence of small values that
      // produces "ABCDEFGH" (clean, not blocklisted).
      const originalRandom = Math.random;
      let call = 0;
      Math.random = jest.fn(() => {
        call++;
        // First 8 calls (candidate #1) all return 0 → char index 0 = 'A' → "AAAAAAAA" (blocklisted)
        // Next 8 calls (candidate #2) return 0, 1/32, 2/32, ..., 7/32 → "ABCDEFGH" (clean)
        if (call <= 8) return 0;
        const charIdx = (call - 9) % 8; // 0..7
        return charIdx / 32;
      });
      try {
        // exists() should NEVER be called for the blocklisted candidate.
        const exists = jest.fn().mockResolvedValue(false);
        const code = await generateUniqueReferralCode(exists);
        expect(REFERRAL_CODE_REGEX.test(code)).toBe(true);
        expect(isReferralCodeBlocklisted(code)).toBe(false);
        // exists() should only have been called for the second (non-blocklisted) candidate.
        expect(exists).toHaveBeenCalledTimes(1);
      } finally {
        Math.random = originalRandom;
      }
    });

    it("throws after 100 attempts if every code is taken", async () => {
      const exists = jest.fn().mockResolvedValue(true);
      await expect(generateUniqueReferralCode(exists)).rejects.toThrow(
        /100 attempts/,
      );
      // Should have called exists up to 100 times (some attempts may have been
      // blocklisted and skipped without calling exists, but never more than 100)
      expect(exists.mock.calls.length).toBeLessThanOrEqual(100);
    });
  });
});

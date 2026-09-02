/**
 * SignupStateUtil — normalizes the US state a customer declares at signup.
 *
 * The signup form sends a 2-letter code (e.g. "CA"); we are lenient and also
 * accept full state names ("California") plus surrounding whitespace, so an
 * old client or manual API call can't slip through with a weird format.
 *
 * The normalized 2-letter code is what gates the California auto-approval
 * rule (see AuthService.signupPrivateCustomer) and is persisted on the
 * Customer row as `signupState` for audit purposes.
 */
export class SignupStateUtil {
  /** Full state name → 2-letter code for the states we care about today. */
  private static readonly FULL_NAME_TO_CODE: Record<string, string> = {
    CALIFORNIA: "CA",
    // Extend this map if auto-approval (or state tracking) expands later.
  };

  /**
   * Normalize a raw state input to an uppercase 2-letter code, or null.
   * Accepts "CA", " ca ", "California". Returns null for empty/unknown input.
   * Unknown 2-letter codes pass through uppercased (still useful as data).
   */
  static normalize(raw?: string | null): string | null {
    if (!raw) return null;
    const cleaned = raw.trim().toUpperCase();
    if (!cleaned) return null;

    // Full state name → code (e.g. CALIFORNIA → CA)
    if (SignupStateUtil.FULL_NAME_TO_CODE[cleaned]) {
      return SignupStateUtil.FULL_NAME_TO_CODE[cleaned];
    }

    // Already a 2-letter code
    if (/^[A-Z]{2}$/.test(cleaned)) {
      return cleaned;
    }

    return null;
  }
}

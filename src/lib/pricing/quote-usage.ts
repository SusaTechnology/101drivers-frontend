// ============================================================
// Guest daily quote budget — client mirror (label only)
// ============================================================
//
// The DAILY QUOTE BUDGET is owned and enforced by the server: every
// quote-preview calculation is counted per client IP for guests (per
// user for accounts) and the endpoint answers 429 once the budget is
// gone. Nothing here can grant a 4th free calculation — this module
// exists ONLY so the landing page can tell the truth with its button
// label BEFORE an attempt:
//
//   used 0..limit-1  -> "Instant Quote" (click calculates)
//   budget exhausted -> "Continue"      (click opens the signup gate,
//                                        never calculates)
//
// Sources of truth the landing page mirrors, in order:
//   1. GET  /api/deliveryRequests/individual/quote-usage  (first paint —
//      covers refreshes, second tabs, and back-navigation, because the
//      counter is server-side per IP)
//   2. quoteUsage on a successful quote-preview response
//   3. the 429 error body (self-healing when 1 failed)
//
// A null snapshot means "unknown / not capped" and the UI falls back to
// normal behavior — the server stays the backstop either way.

export interface QuoteUsageSnapshot {
  /** Calculations used today by this identity. */
  used: number;
  /** Daily budget for this identity. */
  limit: number;
  /** Budget left today. null = unlimited for this caller. */
  remaining: number | null;
}

/**
 * Coerce an untrusted payload into a QuoteUsageSnapshot. Accepts the
 * shapes returned by the quote-usage GET, the quote-preview success
 * body ({ used, limit, remaining }) and a 429 error body
 * ({ used, limit } — already exhausted). Returns null for anything
 * malformed or explicitly unlimited, so a bad payload can never flip
 * the UI into the capped state.
 */
export function coerceQuoteUsage(
  raw: unknown,
  opts?: { exhausted?: boolean }
): QuoteUsageSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
  const used = num(r.used);
  const limit = num(r.limit);
  if (used == null || limit == null) return null;
  const remaining = opts?.exhausted
    ? 0
    : typeof r.remaining === "number" && Number.isFinite(r.remaining)
      ? r.remaining
      : Math.max(0, limit - used);
  return { used, limit, remaining };
}

/**
 * Read-only peek at the guest budget (first paint). Returns null on any
 * failure or when the caller is not a budgeted guest — the label then
 * stays normal and the server-side 429 remains the backstop.
 */
export async function fetchGuestQuoteUsage(): Promise<QuoteUsageSnapshot | null> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/deliveryRequests/individual/quote-usage`
    );
    if (!response.ok) return null;
    return coerceQuoteUsage(await response.json());
  } catch {
    return null;
  }
}

/** The cap message from the dev spec — one wording, reused everywhere. */
export function quoteCapMessage(limit: number): string {
  return (
    `You've used today's ${limit} free quote${limit === 1 ? "" : "s"}. ` +
    `Your saved quotes are safe — sign up to request delivery.`
  );
}

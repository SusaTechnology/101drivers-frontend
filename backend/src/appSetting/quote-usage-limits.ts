// ============================================================
// QUOTE USAGE LIMITS (daily budget for quote calculations)
// ============================================================
//
// WHY THIS EXISTS
// Every quote calculation (the two quote-preview endpoints) triggers
// BILLED Google Maps API calls server-side (Geocoding + Routes API).
// Without a daily budget, a bot or a curious user can grind the quote
// endpoint all day and run up the Google bill. This is the damper.
//
// ── THE SINGLE SOURCE FOR THE NUMBERS ────────────────────────────
// The limits live in the `AppSetting` DB row with key
// "QUOTE_USAGE_LIMITS" (a JSON object with the four fields below).
//
// HOW TO CHANGE THE NUMBERS (effective on the NEXT request — no
// restart, no redeploy):
//   1. Admin API (preferred):
//        PATCH /api/appSettings/quote-usage-limits
//        Authorization: Bearer <admin accessToken>
//        { "enabled": true, "guestDailyLimit": 3,
//          "privateCustomerDailyLimit": 10, "businessCustomerDailyLimit": 40 }
//   2. Direct DB (equally valid):
//        UPDATE "AppSetting"
//        SET value = '{"enabled":true,"guestDailyLimit":3,
//                      "privateCustomerDailyLimit":10,
//                      "businessCustomerDailyLimit":40}'
//        WHERE key = 'QUOTE_USAGE_LIMITS';
//
// FIELD SEMANTICS
//   enabled                      false = kill switch, limiting is fully
//                                off (every request passes). Turn this
//                                off first if anything ever looks wrong.
//   guestDailyLimit              Quote calculations per UTC day per IP
//                                for callers with no account (the
//                                landing-page flow). NOTE: people in
//                                the same office share one public IP —
//                                raise this if legit visitors share one.
//   privateCustomerDailyLimit    Per PRIVATE_CUSTOMER user per UTC day.
//   businessCustomerDailyLimit   Per BUSINESS_CUSTOMER user per UTC day.
//
//   A limit of 0 blocks that class entirely (useful for testing the
//   blocked UX). Drivers and admins are ALWAYS exempt — their route
//   metrics are operational (job feed, scheduling) and must never be
//   blocked. Creating/saving deliveries from an accepted quote is
//   never counted — only quote PREVIEWS are; real orders are revenue.
//
// These defaults are also the fallback used when the DB row has never
// been written — the app works out of the box and the numbers can be
// tuned live at any time without touching this file.

export const QUOTE_USAGE_LIMITS_KEY = "QUOTE_USAGE_LIMITS";

export interface QuoteUsageLimits {
  enabled: boolean;
  guestDailyLimit: number;
  privateCustomerDailyLimit: number;
  businessCustomerDailyLimit: number;
}

export const DEFAULT_QUOTE_USAGE_LIMITS: QuoteUsageLimits = {
  enabled: true,
  guestDailyLimit: 3,
  privateCustomerDailyLimit: 10,
  businessCustomerDailyLimit: 40,
};

/**
 * Coerce an unknown JSON payload (DB row or PATCH body) into a safe
 * QuoteUsageLimits object. Unknown/invalid fields fall back to the
 * defaults — a malformed row can never turn limiting off silently or
 * produce a NaN limit that blocks (or unblocks) everything.
 */
export function normalizeQuoteUsageLimits(raw: unknown): QuoteUsageLimits {
  const d = DEFAULT_QUOTE_USAGE_LIMITS;
  if (!raw || typeof raw !== "object") return { ...d };
  const r = raw as Record<string, unknown>;
  const bool = (v: unknown, fallback: boolean): boolean =>
    typeof v === "boolean" ? v : fallback;
  // Limits are whole, non-negative; anything else (negative, NaN,
  // string numbers) falls back to the default so a typo can't disable
  // or infinitely loosen the budget.
  const num = (v: unknown, fallback: number): number =>
    typeof v === "number" && Number.isFinite(v) && v >= 0
      ? Math.floor(v)
      : fallback;
  return {
    enabled: bool(r.enabled, d.enabled),
    guestDailyLimit: num(r.guestDailyLimit, d.guestDailyLimit),
    privateCustomerDailyLimit: num(
      r.privateCustomerDailyLimit,
      d.privateCustomerDailyLimit,
    ),
    businessCustomerDailyLimit: num(
      r.businessCustomerDailyLimit,
      d.businessCustomerDailyLimit,
    ),
  };
}
